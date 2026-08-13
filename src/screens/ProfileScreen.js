import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, FlatList, ActivityIndicator, Alert, Modal } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  Settings, Camera, Star, PartyPopper, ChevronRight, Sparkles, Crown, Pencil, Share2,
  X, Lock,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { hexToRgba } from "../utils/color";
import { backgroundBlurAndDim } from "../utils/profileBackground";
import ShareCardModal from "../components/ShareCardModal";
import ProfileShareCard from "../components/ProfileShareCard";
import RetryImage from "../components/RetryImage";
import EditProfileModal from "../components/EditProfileModal";

// PR4 — rozet kartının kenar/parıltı rengini nadirlik katmanına göre belirliyor.
const TIER_COLORS = { bronze: "#B08D57", silver: "#9CA3AF", gold: "#F5C518" };
const TIER_LABELS = { bronze: "🥉 Bronz", silver: "🥈 Gümüş", gold: "🥇 Altın" };

export default function ProfileScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [likedMovies, setLikedMovies] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikedMovies, setDislikedMovies] = useState([]);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [watchlists, setWatchlists] = useState([]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [achievements, setAchievements] = useState(null);
  const [questStreak, setQuestStreak] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(route?.params?.initialSub || "likes"); // likes | dislikes | badges
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const hasLoadedRef = useRef(false);
  // Kullanıcı zaten bu sekmedeyken (tab zaten mount olmuşken) tekrar "initialSub" parametresiyle
  // yönlendirilirse (ör. rozet popup'ına tıklayınca) — useState'in ilk değeri artık işe yaramaz,
  // bu yüzden parametre her değiştiğinde de sekmeyi güncelliyoruz.
  useEffect(() => {
    if (route?.params?.initialSub) setSub(route.params.initialSub);
  }, [route?.params?.initialSub]);

  const load = useCallback(async () => {
    // Sadece İLK yüklemede tam ekran spinner göster — Detay sayfasından geri dönüş gibi
    // odaklanma bazlı yenilemelerde arka planda sessizce güncellensin, ekran "zıplamasın".
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [me, selfProfile, friendsData, watchlistsData] = await Promise.all([
        api.me(auth.token),
        api.userProfile(auth.token, auth.id),
        api.friends(auth.token),
        api.watchlists(auth.token),
      ]);
      setProfile({ ...me, friendCount: friendsData.friends?.length || 0 });
      setLikedMovies(selfProfile.likedMovies || []);
      setLikeCount(selfProfile.likeCount ?? (selfProfile.likedMovies || []).length);
      setDislikedMovies(selfProfile.dislikedMovies || []);
      setDislikeCount(me.dislikeCount ?? (selfProfile.dislikedMovies || []).length);
      setFriends(friendsData.friends || []);
      setWatchlists(watchlistsData.results || []);
      hasLoadedRef.current = true;
    } catch { /* sessizce geç */ }
    setLoading(false);
    api.achievements(auth.token).then(setAchievements).catch(() => {});
    api.quests(auth.token).then((data) => setQuestStreak(data.streak || 0)).catch(() => {});
  }, [auth.token, auth.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const loadPremium = () => api.premiumStatus(auth.token).then(setPremiumStatus).catch(() => {});
    loadPremium();
    const unsub = navigation.addListener("focus", loadPremium);
    return unsub;
  }, [navigation, auth.token]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", load);
    return unsub;
  }, [navigation, load]);

  async function pickPhoto(kind) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin gerekli", "Fotoğraf seçmek için galeri izni vermelisin."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === "avatar" ? [1, 1] : [3, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;

    const setUploading = kind === "avatar" ? setUploadingAvatar : setUploadingCover;
    setUploading(true);
    try {
      const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await api.updatePhoto(auth.token, kind === "avatar" ? { avatar_url: dataUrl } : { cover_url: dataUrl });
      setProfile((prev) => ({ ...prev, [kind === "avatar" ? "avatarUrl" : "coverUrl"]: dataUrl }));
    } catch { Alert.alert("Hata", "Fotoğraf yüklenemedi, tekrar dene."); }
    setUploading(false);
  }

  if (loading || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  // Premium arka planı SADECE gerçekten premium olan (paylaşımı iptal edip süresi dolan birinin
  // eski üretilmiş görseli otomatik gizleniyor — premiumStatus her odaklanmada tazeleniyor)
  // kullanıcılarda gösteriliyor.
  //
  // ÖNEMLİ (tasarım geçmişi): Bu ÜÇÜNCÜ hali. (1) Önce ekranın TAMAMINI kaplayan sabit bir
  // arka plandı — "aşırı ön planda, featureların önüne geçiyor" diye düzeltildi. (2) Sonra
  // sadece kapak fotoğrafı alanına (ve SADECE kullanıcının kendi kapak fotoğrafı YOKSA)
  // sıkıştırıldı — ama bu sefer kullanıcının kendi kapak fotoğrafı olduğunda arka plan hiç
  // görünmüyordu ("değişmedi hiç" şikayeti) VE kavramsal olarak yanlıştı: kullanıcı bunun bir
  // "kapak fotoğrafı" değil, SAYFANIN GENELİNE yayılan bir TEMA olmasını istiyor. (3) Şimdi:
  // kapak fotoğrafından tamamen BAĞIMSIZ — sayfanın kendisinin sabit arka planı (kaydırılan
  // içeriğin ARKASINDA duruyor, "duvar kağıdı" gibi). Kapak fotoğrafı (profile.coverUrl) hâlâ
  // kendi başına, bu temadan etkilenmeden çalışıyor. Üzerine hafif bir bulanıklık + karartma var
  // (blurRadius 14, %60 karartma — bir artifact mockup'ı üzerinden ayarlanan denge) — görsel hâlâ
  // fark edilir ama rozet/liste gibi asıl içerikle yarışmıyor.
  const showPremiumBackground = !!(premiumStatus?.isPremium && profile.profileBackgroundUrl);
  // Ayarlar'daki slider'dan gelen belirginlik tercihi — bkz. utils/profileBackground.js.
  const { blurRadius: bgBlurRadius, dim: bgDim } = backgroundBlurAndDim(profile.profileBackgroundIntensity);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {showPremiumBackground && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Image source={{ uri: profile.profileBackgroundUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={bgBlurRadius} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: hexToRgba(c.bg, bgDim) }]} />
        </View>
      )}
      <ScrollView style={[styles.container, showPremiumBackground && { backgroundColor: "transparent" }]}>
      <TouchableOpacity
        style={[styles.cover, { backgroundColor: profile.coverUrl ? c.surface2 : c.accent }]}
        onPress={() => pickPhoto("cover")}
        activeOpacity={0.85}
      >
        {profile.coverUrl && <RetryImage source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.coverEditBadge}>
          {uploadingCover ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={13} color="#fff" />}
        </View>
        {/* Premium rozeti artık Ayarlar'da yaşıyor, burada tekrarına gerek yok. Ayarlar
            butonu da artık üç ikonlu bir header satırı değil, kapak fotoğrafının sağ altında
            yüzen tek bir "adacık". */}
        <TouchableOpacity
          style={styles.coverSettingsBadge}
          onPress={() => navigation.navigate("Settings")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Settings size={13} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>

      <View style={{ padding: 20 }}>
        {/* Instagram düzeni: avatar solda, dört istatistik sağında TEK satırda — eskiden
            istatistikler bio'nun altında ayrı bir satırdı, artık avatarla aynı hizada. */}
        <View style={styles.igHeaderRow}>
          <TouchableOpacity onPress={() => pickPhoto("avatar")} activeOpacity={0.85}>
            {/* PM1 — Premium artık profilde görünen bir kimlik: altın çerçeve. */}
            <RetryImage
              source={{ uri: avatarOr(profile.avatarUrl, auth.id) }}
              style={[styles.avatar, premiumStatus?.isPremium && styles.avatarPremiumRing]}
            />
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? <ActivityIndicator size="small" color={c.bg} /> : <Camera size={11} color={c.bg} />}
            </View>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            {/* PR1 — eskiden her sayının kendi rengi + ikonu vardı, kalabalık ve göz yorucuydu.
                Artık tek tip, sade bir tipografi (ince ayraçlarla ayrılmış) — sayılar zaten
                tıklanabilir olduğu bilindiği için ayrıca bir "Arkadaşlar"/"Listelerim" sekmesi
                tekrarına gerek yok, dokununca ayrı bir sayfa açılıyor. */}
            <TouchableOpacity style={styles.statItem} onPress={() => setSub("likes")}>
              <Text style={styles.statNum}>{likeCount}</Text>
              <Text style={styles.statLabel}>Beğeni</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate("FriendsList")}>
              <Text style={styles.statNum}>{friends.length}</Text>
              <Text style={styles.statLabel}>Arkadaş</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate("MyWatchlists")}>
              <Text style={styles.statNum}>{watchlists.length}</Text>
              <Text style={styles.statLabel}>Liste</Text>
            </TouchableOpacity>
            {/* PR7 — en az 1 haftalık seri varsa (bkz. computeQuestStreak backend'de), kaç
                hafta üst üste tüm görevleri tamamladığını gösteriyor. */}
            {questStreak > 0 && (
              <>
                <View style={styles.statDivider} />
                <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate("WeeklyQuests")}>
                  <Text style={styles.statNum}>{questStreak}</Text>
                  <Text style={styles.statLabel}>Hafta Seri</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.username}>{profile.username ? `@${profile.username} · ` : ""}{profile.email}</Text>
        <Text style={styles.bio}>{profile.bio || "Henüz bir biyografi eklemedin."}</Text>

        {/* Instagram'daki "Profili Düzenle" tam genişlik butonunun aynısı — yanına Paylaş
            eklenip ikiye bölündü, artık küçük yuvarlak ikon butonları değiller. */}
        <View style={styles.profileActionsRow}>
          <TouchableOpacity style={styles.profileActionBtn} onPress={() => setShowEditProfile(true)}>
            <Pencil size={13} color={c.text} />
            <Text style={styles.profileActionBtnText}>Profili Düzenle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileActionBtn} onPress={() => setShowShareCard(true)}>
            <Share2 size={13} color={c.text} />
            <Text style={styles.profileActionBtnText}>Profili Paylaş</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate("GroupParty")} style={styles.partyCardShadow}>
          <LinearGradient
            colors={["#7C3AED", "#DB2777", "#F97316"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.partyCard}
          >
            <Sparkles size={14} color="rgba(255,255,255,0.55)" style={styles.partySparkleTop} />
            <Sparkles size={10} color="rgba(255,255,255,0.4)" style={styles.partySparkleBottom} />
            <View style={styles.partyIconWrap}>
              <PartyPopper size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.partyTitle}>MatchParty</Text>
                <View style={styles.partyBadge}><Text style={styles.partyBadgeText}>DENE</Text></View>
              </View>
              <Text style={styles.partySubtitle}>Arkadaşlarınla birlikte kaydır, ortak beğendiklerinizi anında bul</Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Premium değilse HÂLÂ büyük, göz alıcı kart — profildeki tek gerçek "yükselt" çağrısı,
            küçültmek ikna gücünü zayıflatırdı. Premium olunca artık ikna etmesi gereken bir şey
            kalmadığı için yerini header'daki küçük pill'e bırakıyor (bkz. topRow). */}
        {!premiumStatus?.isPremium && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate("Premium")}
            style={styles.premiumCardShadow}
          >
            <LinearGradient colors={["#F59E0B", "#EA580C", "#DC2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumCard}>
              <View style={styles.partyIconWrap}>
                <Crown size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.partyTitle}>Premium'a Geç</Text>
                <Text style={styles.partySubtitle}>Sınırsız AI önerisi ve TasteMate — haftalık</Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {(profile.favoriteMovie || profile.favoriteShow) && (
          <View style={styles.favRow}>
            {profile.favoriteMovie && <FavCard label="Favori Film" movie={profile.favoriteMovie} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteMovie })} />}
            {profile.favoriteShow && <FavCard label="Favori Dizi" movie={profile.favoriteShow} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteShow })} />}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
          {[["likes", "Beğeniler"], ["dislikes", "Beğenmediklerim"], ["badges", `Rozetler${achievements ? ` (${achievements.unlockedCount}/${achievements.totalCount})` : ""}`]].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => setSub(id)} style={[styles.tabBtn, sub === id && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}>
              <Text style={[styles.tabText, sub === id && { color: c.accent }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {sub === "likes" && (
          likedMovies.length > 0 ? (
            <>
              <FlatList
                data={likedMovies}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: 6 }}
                contentContainerStyle={{ gap: 6 }}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? <Image source={{ uri: item.poster }} style={styles.posterThumb} />
                      : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }]} />}
                  </TouchableOpacity>
                )}
              />
              {likeCount > likedMovies.length && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => navigation.navigate("AllLikes", { userId: auth.id, title: "Beğenilerim" })}
                >
                  <Text style={styles.seeAllBtnText}>Tümünü Gör ({likeCount})</Text>
                </TouchableOpacity>
              )}
            </>
          ) : <Text style={styles.emptyText}>Henüz bir beğeni yok.</Text>
        )}

        {sub === "dislikes" && (
          dislikedMovies.length > 0 ? (
            <>
              <FlatList
                data={dislikedMovies}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: 6 }}
                contentContainerStyle={{ gap: 6 }}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? <Image source={{ uri: item.poster }} style={styles.posterThumb} />
                      : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }]} />}
                  </TouchableOpacity>
                )}
              />
              {dislikeCount > dislikedMovies.length && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => navigation.navigate("AllLikes", { kind: "dislikes", title: "Beğenmediklerim" })}
                >
                  <Text style={styles.seeAllBtnText}>Tümünü Gör ({dislikeCount})</Text>
                </TouchableOpacity>
              )}
            </>
          ) : <Text style={styles.emptyText}>Henüz bir beğenmeme yok.</Text>
        )}

        {sub === "badges" && (
          !achievements ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.badgeGrid}>
              {achievements.badges.map((b) => {
                // PR4 — sadece açılmış rozetler nadirlik rengini gösteriyor; kilitliyken renk
                // sızdırmak, henüz görmediği bir rozetin ne kadar zor olduğunu erkenden ele veriyordu.
                const tierColor = b.unlocked ? TIER_COLORS[b.tier] : c.border;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.badgeCard, { borderColor: tierColor }, !b.unlocked && styles.badgeCardLocked]}
                    onPress={() => setSelectedBadge(b)}
                    activeOpacity={0.8}
                  >
                    {!b.unlocked && (
                      <View style={styles.badgeLockIcon}><Lock size={9} color={c.dim} /></View>
                    )}
                    <Text style={[styles.badgeIcon, !b.unlocked && { opacity: 0.2 }]}>{b.icon}</Text>
                    {/* PR3 — kilitli rozetler artık isim/açıklamayı göstermiyor, "???" gizemiyle
                        merak uyandırıyor; gerçek isim ancak dokununca (detay kartında) açığa çıkıyor. */}
                    <Text style={[styles.badgeName, !b.unlocked && { color: c.dim }]} numberOfLines={1}>
                      {b.unlocked ? b.name : "???"}
                    </Text>
                    <Text style={styles.badgeDesc} numberOfLines={2}>
                      {b.unlocked ? b.desc : `${b.progress.current}/${b.progress.target}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}
      </View>
      {showEditProfile && (
        <EditProfileModal
          profile={profile}
          isPremium={premiumStatus?.isPremium}
          navigation={navigation}
          onClose={() => setShowEditProfile(false)}
          onSaved={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
        />
      )}
      {showShareCard && (
        <ShareCardModal
          onClose={() => setShowShareCard(false)}
          shareMessage={`${profile.name} pellix'te profilini paylaştı 🎬`}
          shareUrl={profile.username ? `https://open.pellix.app/u/${profile.username}` : undefined}
          pages={
            showPremiumBackground
              ? [
                  <ProfileShareCard
                    key="ai"
                    avatarUrl={profile.avatarUrl}
                    userId={auth.id}
                    name={profile.name}
                    username={profile.username}
                    likeCount={likeCount}
                    friendCount={profile.friendCount || 0}
                    listCount={watchlists.length}
                    favoriteMovie={profile.favoriteMovie}
                    favoriteShow={profile.favoriteShow}
                    isPremium={premiumStatus?.isPremium}
                    backgroundUrl={profile.profileBackgroundUrl}
                  />,
                  <ProfileShareCard
                    key="default"
                    avatarUrl={profile.avatarUrl}
                    userId={auth.id}
                    name={profile.name}
                    username={profile.username}
                    likeCount={likeCount}
                    friendCount={profile.friendCount || 0}
                    listCount={watchlists.length}
                    favoriteMovie={profile.favoriteMovie}
                    favoriteShow={profile.favoriteShow}
                    isPremium={premiumStatus?.isPremium}
                    backgroundUrl={profile.profileBackgroundUrl}
                    forceDefault
                  />,
                ]
              : undefined
          }
        >
          <ProfileShareCard
            avatarUrl={profile.avatarUrl}
            userId={auth.id}
            name={profile.name}
            username={profile.username}
            likeCount={likeCount}
            friendCount={profile.friendCount || 0}
            listCount={watchlists.length}
            favoriteMovie={profile.favoriteMovie}
            favoriteShow={profile.favoriteShow}
            isPremium={premiumStatus?.isPremium}
            backgroundUrl={profile.profileBackgroundUrl}
          />
        </ShareCardModal>
      )}
      {/* PR5 — bir rozete dokununca ilerlemesini görebiliyorsun (ör. "62/100 beğeni"), kilitliyken
          bile — hedefe ne kadar kaldığını bilmek, kilit adı gizli kalsa bile motive edici. */}
      <Modal visible={!!selectedBadge} transparent animationType="fade" onRequestClose={() => setSelectedBadge(null)}>
        <TouchableOpacity style={styles.badgeModalBackdrop} activeOpacity={1} onPress={() => setSelectedBadge(null)}>
          {selectedBadge && (
            <View style={styles.badgeModalCard} onStartShouldSetResponder={() => true}>
              <TouchableOpacity style={styles.badgeModalClose} onPress={() => setSelectedBadge(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={16} color={c.dim} />
              </TouchableOpacity>
              <Text style={[styles.badgeModalIcon, !selectedBadge.unlocked && { opacity: 0.3 }]}>{selectedBadge.icon}</Text>
              <Text style={styles.badgeModalName}>{selectedBadge.unlocked ? selectedBadge.name : "??? Rozeti"}</Text>
              {selectedBadge.unlocked && (
                <View style={[styles.tierChip, { backgroundColor: `${TIER_COLORS[selectedBadge.tier]}22` }]}>
                  <Text style={[styles.tierChipText, { color: TIER_COLORS[selectedBadge.tier] }]}>{TIER_LABELS[selectedBadge.tier]}</Text>
                </View>
              )}
              <Text style={styles.badgeModalDesc}>
                {selectedBadge.unlocked ? selectedBadge.desc : "Bu rozeti henüz açmadın. Nasıl açılacağı, kilidini açtığında ortaya çıkacak."}
              </Text>
              <View style={styles.badgeModalProgressTrack}>
                <View style={[
                  styles.badgeModalProgressFill,
                  { width: `${Math.min(selectedBadge.progress.current / selectedBadge.progress.target, 1) * 100}%`, backgroundColor: selectedBadge.unlocked ? "#4ADE80" : c.accent },
                ]} />
              </View>
              <Text style={styles.badgeModalProgressLabel}>{selectedBadge.progress.current}/{selectedBadge.progress.target}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
      </ScrollView>
    </View>
  );
}

function FavCard({ label, movie, c, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ flex: 1, flexDirection: "row", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 8, alignItems: "center" }}>
      {movie.poster ? (
        <Image source={{ uri: movie.poster }} style={{ width: 40, height: 58, borderRadius: 8 }} />
      ) : (
        <View style={{ width: 40, height: 58, borderRadius: 8, backgroundColor: c.surface2 }} />
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Star size={9} color={c.accent} fill={c.accent} />
          <Text style={{ fontSize: 8, fontWeight: "800", color: c.accent }}>{label.toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", color: c.text, marginTop: 2 }} numberOfLines={1}>{movie.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center" },
    cover: { height: 100, position: "relative" },
    coverEditBadge: {
      position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    // Ayarlar artık kapak fotoğrafının sağ altında yüzen küçük bir "adacık" — eskiden profil
    // içeriğinin en üstünde, kalem/paylaş ile birlikte üç ikonlu bir satırdı.
    coverSettingsBadge: {
      position: "absolute", bottom: 10, right: 10, width: 28, height: 28, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    // ÖNEMLİ: alignItems "flex-end" — sayılar artık avatarla DİKEY ORTALANMIYOR, avatarın TAM
    // ALT KENARINA hizalanıyor (statsRow'daki paddingTop, o hizadan bir tık daha aşağı iter).
    // justifyContent "space-between" + statsRow'un artık flex:1 OLMAMASI (sadece kendi doğal
    // genişliği kadar yer kaplaması) sayıları avatardan uzaklaştırıp sağa, kompakt bir küme
    // halinde topluyor — eskisi gibi kalan tüm genişliğe yayılmıyorlar.
    igHeaderRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -40, zIndex: 5, elevation: 5 },
    avatar: { width: 76, height: 76, borderRadius: 999, borderWidth: 4, borderColor: c.bg, zIndex: 6 },
    avatarPremiumRing: { borderColor: "#F5C518" },
    avatarEditBadge: {
      position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: 999, backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg, zIndex: 10, elevation: 10,
    },
    name: { fontSize: 20, fontWeight: "700", color: c.text, marginTop: 12 },
    username: { fontSize: 12, color: c.dim, marginTop: 2 },
    bio: { fontSize: 13, color: c.text, marginTop: 8, lineHeight: 19 },
    // Avatarla aynı satırda, ama artık kalan genişliği doldurmuyor — kendi doğal genişliğinde,
    // sıkışık (küçük gap) bir küme, sağa yaslı. paddingTop, igHeaderRow'un flex-end hizalamasının
    // üzerine "bir tık daha aşağı" nüansını ekliyor.
    statsRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: 16 },
    profileActionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    profileActionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      paddingVertical: 9, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    profileActionBtnText: { fontSize: 12, fontWeight: "700", color: c.text },
    partyCardShadow: {
      marginTop: 18, borderRadius: 20,
      shadowColor: "#DB2777", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8,
    },
    partyCard: {
      flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20,
      paddingVertical: 18, paddingHorizontal: 18, overflow: "hidden",
    },
    partySparkleTop: { position: "absolute", top: 12, right: 46 },
    partySparkleBottom: { position: "absolute", bottom: 14, right: 20 },
    partyIconWrap: {
      width: 52, height: 52, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center", justifyContent: "center",
    },
    partyTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
    partyBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    partyBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
    partySubtitle: { fontSize: 11.5, color: "rgba(255,255,255,0.9)", marginTop: 3, lineHeight: 16 },
    premiumCardShadow: {
      marginTop: 10, borderRadius: 20,
      shadowColor: "#EA580C", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
    },
    premiumCard: {
      flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20,
      paddingVertical: 16, paddingHorizontal: 18, overflow: "hidden",
    },
    statItem: { alignItems: "center" },
    statDivider: { width: 1, height: 24, backgroundColor: c.border, alignSelf: "center" },
    // Kalın/renkli ikonlu haliyle gözü yoruyordu — artık sade, tek düzen bir tipografi:
    // orta ağırlıkta bir rakam + altında ince harf aralıklı bir etiket, ince ayraçlarla ayrılmış.
    statNum: { fontSize: 17, fontWeight: "700", color: c.text, fontVariant: ["tabular-nums"] },
    statLabel: { fontSize: 10.5, color: c.dim, marginTop: 3, letterSpacing: 0.2 },
    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    tabRow: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { paddingVertical: 10, marginRight: 20 },
    tabText: { fontSize: 12, fontWeight: "700", color: c.dim },
    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    emptyText: { color: c.dim, fontSize: 12, marginTop: 14 },
    seeAllBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    seeAllBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
    badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
    badgeCard: {
      width: "31%", backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.accent, borderRadius: 14,
      padding: 10, alignItems: "center", position: "relative",
    },
    badgeCardLocked: { backgroundColor: c.surface2 },
    badgeLockIcon: {
      position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 999,
      backgroundColor: c.surface, alignItems: "center", justifyContent: "center",
    },
    badgeIcon: { fontSize: 26 },
    badgeName: { fontSize: 10, fontWeight: "800", color: c.text, marginTop: 6, textAlign: "center" },
    badgeDesc: { fontSize: 9, color: c.dim, marginTop: 3, textAlign: "center", lineHeight: 12 },

    badgeModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 30 },
    badgeModalCard: {
      width: "100%", maxWidth: 300, backgroundColor: c.surface, borderRadius: 22, padding: 24,
      alignItems: "center", borderWidth: 1, borderColor: c.border,
    },
    badgeModalClose: { position: "absolute", top: 12, right: 12, padding: 4 },
    badgeModalIcon: { fontSize: 44, marginBottom: 10 },
    badgeModalName: { fontSize: 17, fontWeight: "800", color: c.text, textAlign: "center" },
    tierChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
    tierChipText: { fontSize: 10.5, fontWeight: "800" },
    badgeModalDesc: { fontSize: 12, color: c.dim, marginTop: 10, textAlign: "center", lineHeight: 17 },
    badgeModalProgressTrack: { width: "100%", height: 6, borderRadius: 999, backgroundColor: c.surface2, marginTop: 16, overflow: "hidden" },
    badgeModalProgressFill: { height: "100%", borderRadius: 999 },
    badgeModalProgressLabel: { fontSize: 10.5, color: c.dim, marginTop: 6, fontWeight: "700" },
  });
}
