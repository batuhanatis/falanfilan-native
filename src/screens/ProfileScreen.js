import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, FlatList, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Settings, Camera, Star, PartyPopper, ChevronRight, Sparkles, Crown, Sun, Moon, Plus, Share2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import NewListModal from "../components/NewListModal";
import ShareCardModal from "../components/ShareCardModal";
import ProfileShareCard from "../components/ProfileShareCard";
import RetryImage from "../components/RetryImage";

export default function ProfileScreen({ navigation, route }) {
  const { c, mode, setMode } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [likedMovies, setLikedMovies] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikedMovies, setDislikedMovies] = useState([]);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [watchlists, setWatchlists] = useState([]);
  const [showNewList, setShowNewList] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(route?.params?.initialSub || "likes"); // likes | watchlist | friends | badges
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(null);

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

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={[styles.cover, { backgroundColor: profile.coverUrl ? c.surface2 : c.accent }]}
        onPress={() => pickPhoto("cover")}
        activeOpacity={0.85}
      >
        {profile.coverUrl && <RetryImage source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.coverEditBadge}>
          {uploadingCover ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={13} color="#fff" />}
        </View>
      </TouchableOpacity>

      <View style={{ padding: 20 }}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => pickPhoto("avatar")} activeOpacity={0.85}>
            <RetryImage source={{ uri: avatarOr(profile.avatarUrl, auth.id) }} style={styles.avatar} />
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? <ActivityIndicator size="small" color={c.bg} /> : <Camera size={11} color={c.bg} />}
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setMode(mode === "dark" ? "light" : "dark")}>
              {mode === "dark" ? <Sun size={15} color={c.text} /> : <Moon size={15} color={c.text} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowShareCard(true)}>
              <Share2 size={15} color={c.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Settings")}>
              <Settings size={15} color={c.text} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.username}>{profile.username ? `@${profile.username} · ` : ""}{profile.email}</Text>
        <Text style={styles.bio}>{profile.bio || "Henüz bir biyografi eklemedin."}</Text>

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statItem} onPress={() => setSub("likes")}>
            <Text style={styles.statNum}>{likeCount}</Text>
            <Text style={styles.statLabel}>Beğeni</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={() => setSub("friends")}>
            <Text style={styles.statNum}>{friends.length}</Text>
            <Text style={styles.statLabel}>Arkadaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={() => setSub("watchlist")}>
            <Text style={styles.statNum}>{watchlists.length}</Text>
            <Text style={styles.statLabel}>Liste</Text>
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

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigation.navigate("Premium")}
          style={styles.premiumCardShadow}
        >
          {premiumStatus?.isPremium ? (
            <LinearGradient colors={["#16A34A", "#15803D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumCard}>
              <View style={styles.partyIconWrap}>
                <Crown size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.partyTitle}>Premium Aktif ✓</Text>
                <Text style={styles.partySubtitle}>
                  {premiumStatus.premiumUntil
                    ? `${new Date(premiumStatus.premiumUntil).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} tarihine kadar sınırsız`
                    : "Sınırsız AI önerisi ve TasteMate"}
                </Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
          ) : (
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
          )}
        </TouchableOpacity>

        {(profile.favoriteMovie || profile.favoriteShow) && (
          <View style={styles.favRow}>
            {profile.favoriteMovie && <FavCard label="Favori Film" movie={profile.favoriteMovie} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteMovie })} />}
            {profile.favoriteShow && <FavCard label="Favori Dizi" movie={profile.favoriteShow} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteShow })} />}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
          {[["likes", "Beğeniler"], ["dislikes", "Beğenmediklerim"], ["watchlist", "Listelerim"], ["friends", "Arkadaşlar"], ["badges", `Rozetler${achievements ? ` (${achievements.unlockedCount}/${achievements.totalCount})` : ""}`]].map(([id, label]) => (
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

        {sub === "watchlist" && (
          <>
            <TouchableOpacity style={styles.newListToggle} onPress={() => setShowNewList(true)}>
              <Plus size={15} color={c.accent} />
              <Text style={styles.newListToggleText}>Yeni Liste Oluştur</Text>
            </TouchableOpacity>

            {watchlists.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {watchlists.map((wl) => (
                  <TouchableOpacity
                    key={wl.id}
                    style={styles.watchlistCard}
                    onPress={() => navigation.navigate("WatchlistDetail", { watchlistId: wl.id, name: wl.name })}
                  >
                    {wl.previewPoster ? (
                      <Image source={{ uri: wl.previewPoster }} style={styles.watchlistPreview} />
                    ) : (
                      <View style={[styles.watchlistPreview, { backgroundColor: c.surface2 }]} />
                    )}
                    <Text style={styles.watchlistName} numberOfLines={1}>{wl.name}</Text>
                    <Text style={styles.watchlistCount}>{wl.count} içerik{wl.isPublic ? " · Herkese Açık" : ""}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : <Text style={styles.emptyText}>Henüz bir listen yok.</Text>}

            <NewListModal
              visible={showNewList}
              onClose={() => setShowNewList(false)}
              onCreated={(list) => setWatchlists((prev) => [...prev, list])}
            />
          </>
        )}

        {sub === "friends" && (
          friends.length > 0 ? (
            friends.map((f) => (
              <TouchableOpacity key={f.id} style={styles.friendRow} onPress={() => navigation.navigate("OtherProfile", { userId: f.id })}>
                <RetryImage source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.friendAvatar} />
                <Text style={styles.friendName}>{f.name}</Text>
              </TouchableOpacity>
            ))
          ) : <Text style={styles.emptyText}>Henüz arkadaşın yok.</Text>
        )}

        {sub === "badges" && (
          !achievements ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.badgeGrid}>
              {achievements.badges.map((b) => (
                <View key={b.id} style={[styles.badgeCard, !b.unlocked && styles.badgeCardLocked]}>
                  <Text style={[styles.badgeIcon, !b.unlocked && { opacity: 0.25 }]}>{b.icon}</Text>
                  <Text style={[styles.badgeName, !b.unlocked && { color: c.dim }]} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>{b.desc}</Text>
                </View>
              ))}
            </View>
          )
        )}
      </View>
      {showShareCard && (
        <ShareCardModal
          onClose={() => setShowShareCard(false)}
          shareMessage={`${profile.name} pellix'te profilini paylaştı 🎬`}
          shareUrl={profile.username ? `https://open.pellix.app/u/${profile.username}` : undefined}
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
          />
        </ShareCardModal>
      )}
    </ScrollView>
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
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: -40, zIndex: 5, elevation: 5 },
    avatar: { width: 76, height: 76, borderRadius: 999, borderWidth: 4, borderColor: c.bg, zIndex: 6 },
    avatarEditBadge: {
      position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: 999, backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg, zIndex: 10, elevation: 10,
    },
    headerActions: { flexDirection: "row", gap: 8, marginBottom: 4 },
    iconBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    name: { fontSize: 20, fontWeight: "700", color: c.text, marginTop: 12 },
    username: { fontSize: 12, color: c.dim, marginTop: 2 },
    bio: { fontSize: 13, color: c.text, marginTop: 8, lineHeight: 19 },
    statsRow: { flexDirection: "row", gap: 22, marginTop: 14 },
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
    statItem: { alignItems: "flex-start" },
    statNum: { fontSize: 16, fontWeight: "800", color: c.text },
    statLabel: { fontSize: 10, color: c.dim, marginTop: 1 },
    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    tabRow: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { paddingVertical: 10, marginRight: 20 },
    tabText: { fontSize: 12, fontWeight: "700", color: c.dim },
    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    emptyText: { color: c.dim, fontSize: 12, marginTop: 14 },
    seeAllBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    seeAllBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
    watchlistCard: { width: "31%", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 8 },
    newListToggle: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderWidth: 1, borderColor: c.accent, borderStyle: "dashed", borderRadius: 12,
      paddingVertical: 12, marginBottom: 12,
    },
    newListToggleText: { color: c.accent, fontWeight: "700", fontSize: 13 },
    watchlistPreview: { width: "100%", aspectRatio: 1, borderRadius: 8, marginBottom: 6 },
    watchlistName: { fontSize: 11, fontWeight: "700", color: c.text },
    watchlistCount: { fontSize: 10, color: c.dim, marginTop: 1 },
    friendRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    friendAvatar: { width: 38, height: 38, borderRadius: 999 },
    friendName: { fontSize: 13, fontWeight: "600", color: c.text },
    badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
    badgeCard: {
      width: "31%", backgroundColor: c.surface, borderWidth: 1, borderColor: c.accent, borderRadius: 14,
      padding: 10, alignItems: "center",
    },
    badgeCardLocked: { borderColor: c.border },
    badgeIcon: { fontSize: 26 },
    badgeName: { fontSize: 10, fontWeight: "800", color: c.text, marginTop: 6, textAlign: "center" },
    badgeDesc: { fontSize: 9, color: c.dim, marginTop: 3, textAlign: "center", lineHeight: 12 },
  });
}
