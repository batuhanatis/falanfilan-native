import { Alert } from "../i18n/native";
import { t as translateUI } from "../i18n/core";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Lock, MoreVertical, Flag, Ban, ShieldOff, Sparkles, Crown, Mail, UserMinus, UserPlus, Check, Clock } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { hexToRgba } from "../utils/color";
import { backgroundBlurAndDim } from "../utils/profileBackground";
import RetryImage from "../components/RetryImage";
import ReportUserModal from "../components/ReportUserModal";
import ImageLightbox from "../components/ImageLightbox";
import SocialFeedCard from "../components/SocialFeedCard";
import ProfileSkeleton from "../components/skeletons/ProfileSkeleton";
import ReelChart from "../components/salon/ReelChart";
import TicketCard from "../components/salon/TicketCard";
import FavCard from "../components/salon/FavCard";
import { Curtain, Spotlight } from "../components/salon/OneSheet";
import { FONTS, upperTR } from "../theme/fonts";

// Başkasının profili de kendi profilin gibi "Salon" dilinde: üstte kişinin afişi (kapak ya da kadife
// perde, spot ışığı, tabela harfiyle adı, künye satırında beğeni · arkadaş · uyum), altında ilişkiye
// göre tek bir eylem, arkadaşsanız Blend ve MatchParty bilet kartları, görünür beğenilerinden sarılan
// film makarası, favoriler ve paylaşımlar/beğeniler.

function splitGenres(value) {
  if (Array.isArray(value)) return value.flatMap(splitGenres);
  if (!value || typeof value !== "string") return [];
  return value.split(/[,/·|]/).map((x) => x.trim()).filter(Boolean);
}

// Makara yalnızca profilde zaten görünen beğenilerden (en fazla 30, gizlenenler hariç) hesaplanıyor;
// gizli beğeniye ya da puanlara bakmıyor.
function reelFromLikes(likedMovies) {
  const weights = new Map();
  let film = 0, show = 0;
  (likedMovies || []).forEach((m) => {
    if (m.type === "Film") film += 1; else if (m.type === "Dizi") show += 1;
    const genres = [...new Set(splitGenres(m.genre || m.genres))];
    genres.forEach((g) => weights.set(g, (weights.get(g) || 0) + 1 / genres.length));
  });
  const total = [...weights.values()].reduce((a, b) => a + b, 0) || 1;
  const genres = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([name, w]) => ({ name, percent: Math.max(10, Math.round((w / total) * 100)) }));
  const filmPercent = film + show ? Math.round((film / (film + show)) * 100) : 50;
  return { genres, filmPercent, showPercent: 100 - filmPercent };
}

export default function OtherProfileScreen({ route, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);

  // ÖNEMLİ (derin bağlantı desteği): Paylaşım linkleri (pellix.app/u/kullaniciadi gibi)
  // kullanıcı ADI taşıyor, sayısal ID değil — ama bu ekranın geri kalanı (arkadaşlık, engelleme,
  // sohbet vs.) hep sayısal ID kullanıyor. route.params.userId zaten varsa (uygulama içinden
  // normal navigasyonla gelindiyse) direkt onu kullanıyoruz; sadece route.params.username
  // geldiyse (dış bağlantıdan geldiyse) önce bunu ID'ye çeviriyoruz.
  const [userId, setUserId] = useState(route.params.userId || null);
  const [resolveError, setResolveError] = useState(false);

  useEffect(() => {
    if (!route.params.userId && route.params.username) {
      api.userByUsername(auth.token, route.params.username)
        .then((data) => setUserId(data.id))
        .catch(() => setResolveError(true));
    }
  }, [route.params.userId, route.params.username]);

  // ÖNEMLİ: Kendi paylaşım linkine (open.pellix.app/u/kendi-kullanici-adin) kendin tıklarsan,
  // bu ekran "başka birinin profili" gibi davranmamalı — normalde uygulama içinde kendi adına
  // hiç dokunmuyorsun, direkt Profilim sekmesine gidiyorsun. Aynı deneyimi burada da veriyoruz:
  // çözülen ID kendi ID'nle eşleşiyorsa, bu ekranı hiç göstermeden Profilim'e yönlendiriyoruz.
  useEffect(() => {
    if (userId && auth?.id && Number(userId) === Number(auth.id)) {
      navigation.replace("MainTabs", { screen: "Profile" });
    }
  }, [userId, auth?.id]);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [socialPosts, setSocialPosts] = useState([]);
  const [contentTab, setContentTab] = useState("posts");

  const load = useCallback(() => {
    if (!userId) return; // henüz kullanıcı adı çözülmediyse (dış bağlantı akışı) bekle
    setLoading(true);
    api.userProfile(auth.token, userId)
      .then((data) => {
        setProfile(data);
        api.socialUserPosts(auth.token, userId).then((posts) => setSocialPosts(posts.results || [])).catch(() => setSocialPosts([]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function sendRequest() {
    setBusy(true);
    try { await api.friendRequest(auth.token, userId); load(); } catch {}
    setBusy(false);
  }
  async function acceptRequest() {
    setBusy(true);
    try { await api.friendRespond(auth.token, userId, true); load(); } catch {}
    setBusy(false);
  }
  async function unfriend() {
    setShowMenu(false);
    setBusy(true);
    try { await api.unfriend(auth.token, userId); load(); } catch {}
    setBusy(false);
  }
  function confirmUnfriend() {
    setShowMenu(false);
    Alert.alert(
      "Arkadaşlıktan Çık",
      `${profile.name} ile arkadaşlığını sonlandırmak istediğine emin misin?`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Arkadaşlıktan Çık", style: "destructive", onPress: unfriend },
      ]
    );
  }
  async function startChat() {
    try {
      const { chat_id } = await api.chatWith(auth.token, userId);
      // Profil kaynaklı sohbeti Chat sekmesinin kendi stack'ine koymuyoruz. Kök stack'te
      // profil ekranının ÜSTÜNE açıldığı için geri hareketi deterministik biçimde bu profile döner;
      // ayrıca alt bardaki Sohbet sekmesinin son rotasını kirletmez.
      const friendParams = {
        chatId: chat_id,
        friendId: userId,
        friendName: profile.name,
        friendAvatar: avatarOr(profile.avatarUrl, userId),
      };
      navigation.navigate("ProfileChat", friendParams);
    } catch {}
  }

  function confirmBlock() {
    setShowMenu(false);
    Alert.alert(
      "Engelle",
      `${profile.name} kişisini engellemek istediğine emin misin? Artık birbirinize mesaj gönderemezsiniz, arkadaşsanız arkadaşlık da kalkar.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Engelle", style: "destructive", onPress: async () => { setBusy(true); try { await api.blockUser(auth.token, userId); load(); } catch {} setBusy(false); } },
      ]
    );
  }
  async function unblock() {
    setShowMenu(false);
    setBusy(true);
    try { await api.unblockUser(auth.token, userId); load(); } catch {}
    setBusy(false);
  }

  const reel = useMemo(() => reelFromLikes(profile?.likedMovies), [profile?.likedMovies]);

  if (resolveError) {
    return (
      <View style={[styles.center, { flex: 1, padding: 20 }]}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", textAlign: "center" }}>{translateUI("Kullanıcı bulunamadı")}</Text>
        <Text style={{ color: c.dim, fontSize: 12.5, textAlign: "center", marginTop: 6 }}>{translateUI("Bu bağlantı artık geçerli olmayabilir.")}</Text>
      </View>
    );
  }

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ProfileSkeleton />
      </View>
    );
  }

  // Arkadaşının profil teması da (Premium'sa, bir tane üretmişse) kendi profilindeki AYNI
  // muameleyi görüyor — sayfanın kaydırılan içeriğinin ARKASINDA sabit duran, karartılmış
  // "duvar kağıdı" (bkz. ProfileScreen.js). Belirginlik profil sahibinin kendi tercihi.
  const showPremiumBackground = !!(profile.isPremium && profile.profileBackgroundUrl);
  const { blurRadius: bgBlurRadius, dim: bgDim } = backgroundBlurAndDim(profile.profileBackgroundIntensity);
  const friends = profile.relationship === "friends";
  const hasMatch = profile.matchPercent != null;
  const visibleLikes = profile.canSeeLikes ? (profile.likedMovies || []) : [];
  const showReel = reel.genres.length > 0 && visibleLikes.length >= 3;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {showPremiumBackground && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Image source={{ uri: profile.profileBackgroundUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={bgBlurRadius} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: hexToRgba(c.bg, bgDim) }]} />
        </View>
      )}

      <ScrollView style={[styles.container, showPremiumBackground && { backgroundColor: "transparent" }]}>
        <View style={{ padding: 16, paddingTop: Math.max(insets.top, 12) + 6 }}>
          {profile.isBlocked && (
            <View style={styles.blockedBanner}>
              <Ban size={13} color={c.danger} />
              <Text style={styles.blockedBannerText}>{translateUI("Bu kullanıcıyı engelledin")}</Text>
              <TouchableOpacity onPress={unblock} disabled={busy}>
                <Text style={styles.unblockLink}>{translateUI("Engeli Kaldır")}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.onesheet}>
            {profile.coverUrl ? (
              <>
                <RetryImage source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(12,6,6,0.55)" }]} />
              </>
            ) : <Curtain />}
            <Spotlight id="otherProfileSpot" />

            <View style={styles.osTopRow}>
              <TouchableOpacity style={styles.osIconBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={translateUI("Geri")}>
                <ChevronLeft size={18} color="#fbf2df" />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {friends && (
                  <TouchableOpacity style={styles.osIconBtn} onPress={startChat} accessibilityRole="button" accessibilityLabel={translateUI("Mesaj gönder")}>
                    <Mail size={16} color="#fbf2df" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.osIconBtn} onPress={() => setShowMenu(true)} accessibilityRole="button" accessibilityLabel={translateUI("Seçenekler")}>
                  <MoreVertical size={16} color="#fbf2df" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Gerçek bir fotoğrafı varsa dokununca tam boyutta görülüyor; yoksa (utils/avatar.js
                sahte fotoğraf üretmiyor) gösterecek bir şey olmadığı için dokunma etkisiz. */}
            <TouchableOpacity
              activeOpacity={profile.avatarUrl ? 0.85 : 1}
              onPress={() => profile.avatarUrl && setShowAvatarLightbox(true)}
              style={styles.osAvatarWrap}
            >
              <RetryImage
                source={{ uri: avatarOr(profile.avatarUrl, profile.id) }}
                style={[styles.avatar, profile.isPremium && styles.avatarPremiumRing]}
              />
              {profile.isPremium && (
                <View style={styles.premiumCrownBadge}>
                  <Crown size={12} color="#111" fill="#111" />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{upperTR(profile.name)}</Text>
            {!!profile.username && <Text style={styles.username}>{`@${profile.username}`}</Text>}
            <Text style={styles.bio}>{profile.bio || translateUI("Bu kullanıcı henüz bir biyografi eklemedi.")}</Text>

            <View style={styles.billing}>
              <Text style={styles.billingLine} numberOfLines={1}>{translateUI("PELLIX SUNAR · BİR ")}{upperTR(profile.name)}{translateUI(" PROFİLİ")}</Text>
              <View style={styles.statsRow}>
                <TouchableOpacity
                  style={styles.statItem}
                  disabled={!profile.canSeeLikes}
                  onPress={() => setContentTab("likes")}
                  accessibilityLabel={translateUI("{0} beğeni", { 0: profile.likeCount })}
                >
                  <Text style={styles.statNum}>{profile.likeCount}</Text>
                  <Text style={styles.statLabel}>{translateUI("BEĞENİ")}</Text>
                </TouchableOpacity>
                <View style={[styles.statItem, styles.statDivided]} accessibilityLabel={translateUI("{0} arkadaş", { 0: profile.friendCount })}>
                  <Text style={styles.statNum}>{profile.friendCount}</Text>
                  <Text style={styles.statLabel}>{translateUI("ARKADAŞ")}</Text>
                </View>
                {hasMatch && (
                  <View style={[styles.statItem, styles.statDivided]} accessibilityLabel={translateUI("Uyum %{0}", { 0: profile.matchPercent })}>
                    <Text style={[styles.statNum, styles.statNumMatch]}>{translateUI("%{0}", { 0: profile.matchPercent })}</Text>
                    <Text style={[styles.statLabel, styles.statLabelMatch]}>{translateUI("UYUM")}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* İlişkiye göre tek eylem; arkadaşsanız mesaj başlıkta, burada iki bilet var. */}
          {!friends && (
            <View style={styles.profileActionsRow}>
              {profile.relationship === "pending_sent" && (
                <View style={[styles.profileActionBtn, { opacity: 0.7 }]}>
                  <Clock size={14} color={c.dim} />
                  <Text style={[styles.profileActionBtnText, { color: c.dim }]}>{translateUI("İstek Gönderildi")}</Text>
                </View>
              )}
              {profile.relationship === "pending_received" && (
                <TouchableOpacity style={[styles.profileActionBtn, styles.profileActionBtnPrimary]} onPress={acceptRequest} disabled={busy}>
                  <Check size={14} color={c.bg} />
                  <Text style={[styles.profileActionBtnText, { color: c.bg }]}>{translateUI("İsteği Kabul Et")}</Text>
                </TouchableOpacity>
              )}
              {profile.relationship === "none" && (
                <TouchableOpacity style={[styles.profileActionBtn, styles.profileActionBtnPrimary]} onPress={sendRequest} disabled={busy}>
                  <UserPlus size={14} color={c.bg} />
                  <Text style={[styles.profileActionBtnText, { color: c.bg }]}>{translateUI("Arkadaş Ekle")}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {friends && (
            <View style={{ gap: 12, marginTop: 14 }}>
              <TicketCard
                eyebrow={hasMatch ? translateUI("%{0} UYUM", { 0: profile.matchPercent }) : translateUI("İKİNİZE ÖZEL")}
                title={translateUI("Blend")}
                subtitle={translateUI("Ortak beğenilerinizi keşfet")}
                onPress={() => navigation.navigate("Blend", { friendId: profile.id, friendName: profile.name, friendAvatar: profile.avatarUrl })}
              />
              <TicketCard
                eyebrow={translateUI("BİRLİKTE SEÇİN")}
                title={translateUI("MatchParty")}
                subtitle={translateUI("Birlikte kaydırın, eşleşin")}
                onPress={() => navigation.navigate("MatchParty", { friend: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl } })}
              />
            </View>
          )}

          {showReel && (
            <View style={styles.tasteCard}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightTitle}>{translateUI("Film makarası")}</Text>
                <Text style={styles.signalText}>{translateUI("{0} beğeniden", { 0: visibleLikes.length })}</Text>
              </View>
              <ReelChart genres={reel.genres} />
              <View style={styles.typeSplitRow}>
                <Text style={styles.typeSplitLabel}>{translateUI("Film %")}{reel.filmPercent}</Text>
                <View style={styles.typeSplitTrack}>
                  <View style={[styles.typeSplitFilm, { width: `${reel.filmPercent}%` }]} />
                </View>
                <Text style={styles.typeSplitLabel}>{translateUI("Dizi %")}{reel.showPercent}</Text>
              </View>
            </View>
          )}

          {(profile.favoriteMovie || profile.favoriteShow) && (
            <View style={styles.favRow}>
              {profile.favoriteMovie && <FavCard label={translateUI("Favori Film")} movie={profile.favoriteMovie} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteMovie })} />}
              {profile.favoriteShow && <FavCard label={translateUI("Favori Dizi")} movie={profile.favoriteShow} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteShow })} />}
            </View>
          )}

          <View style={styles.contentTabs}>
            <TouchableOpacity style={[styles.contentTab, contentTab === "posts" && styles.contentTabActive]} onPress={() => setContentTab("posts")}>
              <Text style={[styles.contentTabText, contentTab === "posts" && styles.contentTabTextActive]}>{translateUI("Paylaşımlar")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contentTab, contentTab === "likes" && styles.contentTabActive]} onPress={() => setContentTab("likes")}>
              <Text style={[styles.contentTabText, contentTab === "likes" && styles.contentTabTextActive]}>{translateUI("Beğeniler")}</Text>
            </TouchableOpacity>
          </View>

          {contentTab === "posts" ? (
            socialPosts.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                {socialPosts.slice(0, 8).map((item) => <SocialFeedCard key={item.id} item={item} navigation={navigation} compact />)}
              </View>
            ) : (
              <View style={styles.emptyPosts}>
                <View style={styles.emptyPostsIcon}>
                  <Sparkles size={22} color={c.dim} />
                </View>
                <Text style={styles.emptyPostsTitle}>{translateUI("Henüz paylaşım yok")}</Text>
                <Text style={styles.emptyPostsText}>{translateUI("Bu kullanıcı daha hiçbir şey paylaşmadı.")}</Text>
              </View>
            )
          ) : profile.canSeeLikes ? (
            visibleLikes.length > 0 ? (
              <>
                <FlatList data={visibleLikes} numColumns={3} scrollEnabled={false}
                  columnWrapperStyle={{ gap: 6 }} contentContainerStyle={{ gap: 6, marginTop: 12 }}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                      {item.poster ? <Image source={{ uri: item.poster }} style={styles.posterThumb} /> : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }]} />}
                    </TouchableOpacity>
                  )}
                />
                {profile.likeCount > visibleLikes.length && (
                  <TouchableOpacity style={styles.seeAllBtn} onPress={() => navigation.navigate("AllLikes", { userId, title: translateUI("{0} — Beğeniler", { 0: profile.name }) })}>
                    <Text style={styles.seeAllBtnText}>{translateUI("Tümünü Gör (")}{profile.likeCount}{translateUI(")")}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : <Text style={styles.emptyText}>{translateUI("Henüz bir beğeni yok.")}</Text>
          ) : (
            <View style={styles.lockedBox}><Lock size={20} color={c.dim} /><Text style={styles.emptyText}>{translateUI("Bu kullanıcının beğenileri gizli.")}</Text></View>
          )}
        </View>
      </ScrollView>

      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowMenu(false)} />
          <View style={[styles.menuSheet, { marginTop: Math.max(insets.top, 12) + 64 }]}>
            {friends && (
              <TouchableOpacity style={styles.menuRow} onPress={confirmUnfriend} disabled={busy}>
                <View style={styles.menuIconWrap}><UserMinus size={16} color={c.danger} /></View>
                <Text style={[styles.menuText, { color: c.danger }]}>{translateUI("Arkadaşlıktan Çık")}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuRow} onPress={() => { setShowMenu(false); setShowReport(true); }}>
              <View style={styles.menuIconWrap}><Flag size={16} color={c.text} /></View>
              <Text style={styles.menuText}>{translateUI("Şikayet Et")}</Text>
            </TouchableOpacity>
            {profile.isBlocked ? (
              <TouchableOpacity style={styles.menuRow} onPress={unblock}>
                <View style={styles.menuIconWrap}><ShieldOff size={16} color={c.text} /></View>
                <Text style={styles.menuText}>{translateUI("Engeli Kaldır")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuRow} onPress={confirmBlock}>
                <View style={styles.menuIconWrap}><Ban size={16} color={c.danger} /></View>
                <Text style={[styles.menuText, { color: c.danger }]}>{translateUI("Engelle")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {showReport && <ReportUserModal userId={userId} userName={profile.name} onClose={() => setShowReport(false)} />}
      {showAvatarLightbox && profile.avatarUrl && (
        <ImageLightbox uri={profile.avatarUrl} onClose={() => setShowAvatarLightbox(false)} />
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center", backgroundColor: c.bg },

    blockedBanner: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 10,
    },
    blockedBannerText: { flex: 1, fontSize: 12, color: c.dim, fontWeight: "600" },
    unblockLink: { fontSize: 12, color: c.accent, fontWeight: "700" },

    // afiş (ProfileScreen ile aynı ölçüler)
    onesheet: { borderRadius: 14, overflow: "hidden", backgroundColor: "#3f1214", alignItems: "center", paddingTop: 14, paddingHorizontal: 14 },
    osTopRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between" },
    osIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
    osAvatarWrap: { marginTop: -8 },
    avatar: { width: 96, height: 96, borderRadius: 999, borderWidth: 3, borderColor: "#efe4cc", backgroundColor: "#2a2520" },
    avatarPremiumRing: { borderColor: "#F5C518" },
    premiumCrownBadge: {
      position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 999,
      backgroundColor: "#F5C518", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#3f1214",
    },
    name: { fontSize: 52, lineHeight: 50, fontFamily: FONTS.marquee, color: "#fbf2df", marginTop: 14, textAlign: "center", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 14 },
    username: { fontSize: 12, fontFamily: FONTS.mono, color: "#e9d8b9", marginTop: 4 },
    bio: { fontSize: 14, fontStyle: "italic", color: "#f0dfc0", marginTop: 10, lineHeight: 20, textAlign: "center", maxWidth: 300 },
    billing: { alignSelf: "stretch", marginHorizontal: -14, marginTop: 20, paddingTop: 12, paddingBottom: 6, backgroundColor: "rgba(10,4,4,0.55)" },
    billingLine: { fontFamily: FONTS.marqueeMedium, fontSize: 11.5, letterSpacing: 1.6, color: "rgba(233,216,185,0.8)", textAlign: "center", paddingHorizontal: 10, marginBottom: 4 },
    statsRow: { flexDirection: "row" },
    statItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 50 },
    statDivided: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.14)" },
    statNum: { fontSize: 25, fontFamily: FONTS.marqueeBold, color: "#fbf2df" },
    statNumMatch: { color: "#e2c171" },
    statLabel: { fontSize: 11, fontFamily: FONTS.marqueeMedium, color: "rgba(233,216,185,0.75)", letterSpacing: 1.4 },
    statLabelMatch: { color: "rgba(226,193,113,0.9)" },

    profileActionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    profileActionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border,
    },
    profileActionBtnPrimary: { backgroundColor: c.accent, borderColor: c.accent },
    profileActionBtnText: { fontSize: 14, fontWeight: "600", color: c.text },

    tasteCard: {
      marginTop: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 18, padding: 15,
    },
    insightHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
    insightTitle: { fontSize: 24, fontFamily: FONTS.marquee, color: c.text, flexShrink: 1 },
    signalText: { fontSize: 11.5, color: c.dim, fontFamily: FONTS.mono },
    typeSplitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    typeSplitLabel: { fontSize: 11.5, fontFamily: FONTS.mono, color: c.dim },
    typeSplitTrack: { flex: 1, height: 8, backgroundColor: "#6f9fb0", borderRadius: 999, overflow: "hidden" },
    typeSplitFilm: { height: "100%", backgroundColor: c.accent },

    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    contentTabs: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    contentTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
    contentTabActive: { borderBottomColor: c.accent },
    contentTabText: { color: c.dim, fontSize: 21, fontFamily: FONTS.marqueeBold },
    contentTabTextActive: { color: c.text },
    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    emptyText: { color: c.dim, fontSize: 12, marginTop: 14 },
    emptyPosts: { minHeight: 170, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    emptyPostsIcon: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
    emptyPostsTitle: { color: c.text, fontSize: 22, fontFamily: FONTS.marquee, textAlign: "center" },
    emptyPostsText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 4 },
    seeAllBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    seeAllBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
    lockedBox: { alignItems: "center", paddingVertical: 20, gap: 8 },

    menuOverlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
      backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-start", alignItems: "flex-end", paddingRight: 16,
    },
    menuSheet: {
      backgroundColor: c.surface, borderRadius: 14, paddingVertical: 6, width: 200,
      borderWidth: 1, borderColor: c.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
    },
    menuRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
    menuIconWrap: { width: 26, alignItems: "center" },
    menuText: { fontSize: 13, fontWeight: "600", color: c.text },
  });
}
