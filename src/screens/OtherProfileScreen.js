import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Lock, Star, PartyPopper, MoreVertical, Flag, Ban, ShieldOff, Sparkles, Crown } from "lucide-react-native";
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

export default function OtherProfileScreen({ route, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
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
    setBusy(true);
    try { await api.unfriend(auth.token, userId); load(); } catch {}
    setBusy(false);
  }
  async function startChat() {
    try {
      const { chat_id } = await api.chatWith(auth.token, userId);
      // ÖNEMLİ: OtherProfile, kök stack'te MainTabs'ın KARDEŞİ (içinde değil) — "Chat" adı
      // sadece MainTabs'ın bir sekmesi olarak var. Doğrudan navigation.navigate("Chat", ...)
      // kök stack'te böyle bir rota bulamadığı için sessizce hiçbir şey yapmıyordu (boş ekran
      // gibi görünüyordu). Önce MainTabs'a, sonra onun içindeki Chat sekmesine iniyoruz.
      //
      // ÖNEMLİ DÜZELTME (2): Sohbetler sekmesi bu oturumda hiç ziyaret edilmediyse, doğrudan
      // "ChatConversation"a atlamak ChatList'i hiç OLUŞTURMADAN o sekmenin TEK rotası yapıyordu
      // — geri tuşu Ana Sayfa'ya düşüyordu, alt sekmeden tekrar Sohbetler'e basınca da hep AYNI
      // sohbet açılıyordu (App.js'teki push bildirimi akışında AYNI hatayı zaten çözmüştük,
      // buradaki de birebir aynı kök neden). Önce ChatList'i temel olarak kuruyoruz, hemen
      // ardından (liste artık temelde dururken) sohbeti ÜSTÜNE ekliyoruz.
      const friendParams = { chatId: chat_id, friendId: userId, friendName: profile.name, friendAvatar: avatarOr(profile.avatarUrl, userId) };
      // ÖNEMLİ DÜZELTME: Sabit 300ms yerine, navigasyon state'inin GERÇEKTEN değiştiğini
      // dinleyip ikinci adımı ancak o zaman tetikliyoruz — cihaz hızından bağımsız, deterministik.
      navigation.navigate("MainTabs", { screen: "Chat", params: { screen: "ChatList" } });
      const unsub = navigation.addListener("state", () => {
        unsub();
        navigation.navigate("MainTabs", { screen: "Chat", params: { screen: "ChatConversation", params: friendParams } });
      });
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

  if (resolveError) {
    return (
      <View style={[styles.center, { flex: 1, padding: 20 }]}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", textAlign: "center" }}>Kullanıcı bulunamadı</Text>
        <Text style={{ color: c.dim, fontSize: 12.5, textAlign: "center", marginTop: 6 }}>Bu bağlantı artık geçerli olmayabilir.</Text>
      </View>
    );
  }

  if (loading || !profile) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  // Arkadaşının profil teması da (Premium'sa, bir tane üretmişse) kendi profilindeki AYNI
  // muameleyi görüyor — kapak fotoğrafından bağımsız, sayfanın kaydırılan içeriğinin ARKASINDA
  // sabit duran, ağır karartılmış/bulanık bir "duvar kağıdı" (bkz. ProfileScreen.js'deki aynı
  // yaklaşımın gerekçesi).
  const showPremiumBackground = !!(profile.isPremium && profile.profileBackgroundUrl);
  // Belirginlik profil sahibinin kendi tercihi — bkz. GET /api/users/:id'deki
  // profileBackgroundIntensity, utils/profileBackground.js.
  const { blurRadius: bgBlurRadius, dim: bgDim } = backgroundBlurAndDim(profile.profileBackgroundIntensity);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {showPremiumBackground && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Image source={{ uri: profile.profileBackgroundUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={bgBlurRadius} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: hexToRgba(c.bg, bgDim) }]} />
        </View>
      )}
      <View style={[styles.header, showPremiumBackground && { backgroundColor: "transparent", borderBottomColor: "transparent" }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{profile.name}</Text>
        <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.backBtn}>
          <MoreVertical size={20} color={c.text} />
        </TouchableOpacity>
      </View>

      {profile.isBlocked && (
        <View style={styles.blockedBanner}>
          <Ban size={13} color={c.danger} />
          <Text style={styles.blockedBannerText}>Bu kullanıcıyı engelledin</Text>
          <TouchableOpacity onPress={unblock} disabled={busy}>
            <Text style={styles.unblockLink}>Engeli Kaldır</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={showPremiumBackground && { backgroundColor: "transparent" }}>
        <View style={[styles.cover, { backgroundColor: profile.coverUrl ? c.surface2 : c.accent }]}>
          {profile.coverUrl && <RetryImage source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFillObject} />}
        </View>

        <View style={{ padding: 20 }}>
          <View style={styles.topRow}>
            {/* PM1 — Premium artık profilde de görünen bir kimlik: altın çerçeve + taç rozeti.
                Gerçek bir fotoğrafı varsa dokununca tam boyutta görülebiliyor — yoksa (bkz.
                utils/avatar.js, artık sahte/rastgele bir fotoğraf üretmiyor) gösterecek gerçek
                bir şey olmadığı için dokunma etkisiz. */}
            <TouchableOpacity
              activeOpacity={profile.avatarUrl ? 0.85 : 1}
              onPress={() => profile.avatarUrl && setShowAvatarLightbox(true)}
            >
              <RetryImage
                source={{ uri: avatarOr(profile.avatarUrl, profile.id) }}
                style={[styles.avatar, profile.isPremium && styles.avatarPremiumRing]}
              />
              {profile.isPremium && (
                <View style={styles.premiumCrownBadge}>
                  <Crown size={11} color="#111" fill="#111" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{profile.friendCount}</Text>
                <Text style={styles.statLabel}>Arkadaş</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{profile.likeCount}</Text>
                <Text style={styles.statLabel}>Beğeni</Text>
              </View>
              {profile.matchPercent != null && (
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: c.accent }]}>%{profile.matchPercent}</Text>
                  <Text style={styles.statLabel}>Uyum</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.name}>{profile.name}</Text>
          {!!profile.username && <Text style={styles.username}>@{profile.username}</Text>}
          <Text style={styles.bio}>{profile.bio || "Bu kullanıcı henüz bir biyografi eklemedi."}</Text>

          {(profile.favoriteMovie || profile.favoriteShow) && (
            <View style={styles.favRow}>
              {profile.favoriteMovie && <FavCard label="FAVORİ FİLM" movie={profile.favoriteMovie} c={c} navigation={navigation} />}
              {profile.favoriteShow && <FavCard label="FAVORİ DİZİ" movie={profile.favoriteShow} c={c} navigation={navigation} />}
            </View>
          )}

          <View style={styles.actionsRow}>
            {profile.relationship === "friends" && (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={startChat}>
                  <Text style={styles.primaryBtnText}>Mesaj Gönder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={unfriend} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>Arkadaşlıktan Çık</Text>
                </TouchableOpacity>
              </>
            )}
            {profile.relationship === "pending_sent" && (
              <View style={[styles.primaryBtn, { backgroundColor: c.surface2 }]}>
                <Text style={[styles.primaryBtnText, { color: c.dim }]}>İstek Gönderildi</Text>
              </View>
            )}
            {profile.relationship === "pending_received" && (
              <TouchableOpacity style={styles.primaryBtn} onPress={acceptRequest} disabled={busy}>
                <Text style={styles.primaryBtnText}>İsteği Kabul Et</Text>
              </TouchableOpacity>
            )}
            {profile.relationship === "none" && (
              <TouchableOpacity style={styles.primaryBtn} onPress={sendRequest} disabled={busy}>
                <Text style={styles.primaryBtnText}>Arkadaş Ekle</Text>
              </TouchableOpacity>
            )}
          </View>

          {profile.relationship === "friends" && (
            <View style={styles.funRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.funCardShadow}
                onPress={() => navigation.navigate("Blend", { friendId: profile.id, friendName: profile.name, friendAvatar: profile.avatarUrl })}
              >
                <LinearGradient colors={["#0EA5E9", "#6366F1", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.funCard}>
                  <Sparkles size={44} color="rgba(255,255,255,0.25)" style={styles.funSparkle} />
                  <View style={styles.funIconWrap}>
                    <Sparkles size={20} color="#fff" />
                  </View>
                  <Text style={styles.funTitle}>Blend</Text>
                  <Text style={styles.funSubtitle}>Ortak zevkinizi keşfet</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.funCardShadow}
                onPress={() => navigation.navigate("MatchParty", { friend: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl } })}
              >
                <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.funCard}>
                  <PartyPopper size={44} color="rgba(255,255,255,0.25)" style={styles.funSparkle} />
                  <View style={styles.funIconWrap}>
                    <PartyPopper size={20} color="#fff" />
                  </View>
                  <Text style={styles.funTitle}>MatchParty</Text>
                  <Text style={styles.funSubtitle}>Birlikte kaydırın, eşleşin</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.contentTabs}>
            <TouchableOpacity style={[styles.contentTab, contentTab === "posts" && styles.contentTabActive]} onPress={() => setContentTab("posts")}>
              <Text style={[styles.contentTabText, contentTab === "posts" && styles.contentTabTextActive]}>Paylaşımlar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contentTab, contentTab === "likes" && styles.contentTabActive]} onPress={() => setContentTab("likes")}>
              <Text style={[styles.contentTabText, contentTab === "likes" && styles.contentTabTextActive]}>Beğeniler</Text>
            </TouchableOpacity>
          </View>

          {contentTab === "posts" ? (
            socialPosts.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                {socialPosts.slice(0, 8).map((item) => <SocialFeedCard key={item.id} item={item} navigation={navigation} compact />)}
              </View>
            ) : <Text style={styles.emptyText}>Henüz bir paylaşımı yok.</Text>
          ) : profile.canSeeLikes ? (
            profile.likedMovies?.length > 0 ? (
              <>
                <FlatList data={profile.likedMovies} numColumns={3} scrollEnabled={false}
                  columnWrapperStyle={{ gap: 6 }} contentContainerStyle={{ gap: 6, marginTop: 12 }}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                      {item.poster ? <Image source={{ uri: item.poster }} style={styles.posterThumb} /> : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }]} />}
                    </TouchableOpacity>
                  )}
                />
                {profile.likeCount > profile.likedMovies.length && (
                  <TouchableOpacity style={styles.seeAllBtn} onPress={() => navigation.navigate("AllLikes", { userId, title: `${profile.name} — Beğeniler` })}>
                    <Text style={styles.seeAllBtnText}>Tümünü Gör ({profile.likeCount})</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : <Text style={styles.emptyText}>Henüz bir beğeni yok.</Text>
          ) : (
            <View style={styles.lockedBox}><Lock size={20} color={c.dim} /><Text style={styles.emptyText}>Bu kullanıcının beğenileri gizli.</Text></View>
          )}
        </View>
      </ScrollView>

      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowMenu(false)} />
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuRow} onPress={() => { setShowMenu(false); setShowReport(true); }}>
              <View style={styles.menuIconWrap}><Flag size={16} color={c.text} /></View>
              <Text style={styles.menuText}>Şikayet Et</Text>
            </TouchableOpacity>
            {profile.isBlocked ? (
              <TouchableOpacity style={styles.menuRow} onPress={unblock}>
                <View style={styles.menuIconWrap}><ShieldOff size={16} color={c.text} /></View>
                <Text style={styles.menuText}>Engeli Kaldır</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuRow} onPress={confirmBlock}>
                <View style={styles.menuIconWrap}><Ban size={16} color={c.danger} /></View>
                <Text style={[styles.menuText, { color: c.danger }]}>Engelle</Text>
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

function FavCard({ label, movie, c, navigation }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("Detail", { movie })}
      style={{ flex: 1, flexDirection: "row", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 8, alignItems: "center" }}
    >
      {movie.poster ? (
        <Image source={{ uri: movie.poster }} style={{ width: 40, height: 58, borderRadius: 8 }} />
      ) : (
        <View style={{ width: 40, height: 58, borderRadius: 8, backgroundColor: c.surface2 }} />
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Star size={9} color={c.accent} fill={c.accent} />
          <Text style={{ fontSize: 8, fontWeight: "800", color: c.accent }}>{label}</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", color: c.text, marginTop: 2 }} numberOfLines={1}>{movie.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg,
    },
    backBtn: { padding: 2 },
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text, flex: 1 },
    blockedBanner: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    blockedBannerText: { flex: 1, fontSize: 12, color: c.dim, fontWeight: "600" },
    unblockLink: { fontSize: 12, color: c.accent, fontWeight: "700" },
    menuOverlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
      backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-start", alignItems: "flex-end",
      paddingTop: 90, paddingRight: 16,
    },
    menuSheet: {
      backgroundColor: c.surface, borderRadius: 14, paddingVertical: 6, width: 200,
      borderWidth: 1, borderColor: c.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
    },
    menuRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
    menuIconWrap: { width: 26, alignItems: "center" },
    menuText: { fontSize: 13, fontWeight: "600", color: c.text },
    cover: { height: 90 },
    topRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    avatar: { width: 76, height: 76, borderRadius: 999, marginTop: -40, borderWidth: 4, borderColor: c.bg },
    avatarPremiumRing: { borderColor: "#F5C518" },
    premiumCrownBadge: {
      position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 999,
      backgroundColor: "#F5C518", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg,
    },
    statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-evenly" },
    statBox: { alignItems: "center" },
    statNum: { fontSize: 18, fontWeight: "800", color: c.text },
    statLabel: { fontSize: 11, color: c.dim, marginTop: 2 },
    name: { fontSize: 20, fontWeight: "700", color: c.text, marginTop: 14 },
    username: { fontSize: 12, color: c.dim, marginTop: 2 },
    bio: { fontSize: 13, color: c.dim, marginTop: 6, lineHeight: 19 },
    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 18 },
    primaryBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    primaryBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
    secondaryBtn: { backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center", borderWidth: 1, borderColor: c.border },
    secondaryBtnText: { color: c.text, fontWeight: "700", fontSize: 12 },
    funRow: { flexDirection: "row", gap: 10, marginTop: 12 },
    funCardShadow: {
      flex: 1, borderRadius: 18,
      shadowColor: "#6366F1", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
    },
    funCard: { borderRadius: 18, padding: 14, overflow: "hidden", minHeight: 96, justifyContent: "flex-end" },
    funSparkle: { position: "absolute", top: -6, right: -6 },
    funIconWrap: {
      width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center", justifyContent: "center", marginBottom: 8,
    },
    funTitle: { fontSize: 14, fontWeight: "800", color: "#fff" },
    funSubtitle: { fontSize: 10.5, color: "rgba(255,255,255,0.9)", marginTop: 2, lineHeight: 14 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: c.text, marginTop: 26, marginBottom: 10 },
    contentTabs: { flexDirection: "row", marginTop: 26, borderBottomWidth: 1, borderBottomColor: c.border },
    contentTab: { flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
    contentTabActive: { borderBottomColor: c.accent },
    contentTabText: { color: c.dim, fontSize: 12.5, fontWeight: "800" },
    contentTabTextActive: { color: c.accent },
    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    emptyText: { color: c.dim, fontSize: 12 },
    seeAllBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    seeAllBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
    lockedBox: { alignItems: "center", paddingVertical: 20, gap: 8 },
  });
}
