import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, FlatList, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  Settings, Camera, Star, ChevronRight, Crown, Pencil, Share2,
  Eye, EyeOff, Sparkles, Trophy, Flame,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { diaryApi } from "../api/diary";
import { avatarOr } from "../utils/avatar";
import { hexToRgba } from "../utils/color";
import { backgroundBlurAndDim } from "../utils/profileBackground";
import ShareCardModal from "../components/ShareCardModal";
import ProfileShareCard from "../components/ProfileShareCard";
import RetryImage from "../components/RetryImage";
import EditProfileModal from "../components/EditProfileModal";
import SocialFeedCard from "../components/SocialFeedCard";
import ProfileSkeleton from "../components/skeletons/ProfileSkeleton";

function splitGenres(value) {
  if (Array.isArray(value)) return value.flatMap(splitGenres);
  if (!value || typeof value !== "string") return [];
  return value
    .split(/[,/·|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function ratingPositiveWeight(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  if (rating >= 10) return 1.6;
  if (rating >= 9) return 1.4;
  if (rating >= 8) return 1.1;
  if (rating >= 7) return 0.75;
  if (rating >= 6) return 0.25;
  return 0;
}

function buildTasteDNA(likedMovies, profile, diaryEntries = []) {
  const genreWeights = new Map();
  let filmWeight = 0;
  let showWeight = 0;
  let deepRatingCount = 0;

  const addPositiveMovie = (movie, weight) => {
    if (!movie || !(weight > 0)) return;
    if (movie.type === "Film") filmWeight += weight;
    else if (movie.type === "Dizi") showWeight += weight;
    const genres = [...new Set(splitGenres(movie.genre || movie.genres))];
    const perGenre = genres.length ? weight / genres.length : 0;
    genres.forEach((genre) => genreWeights.set(genre, (genreWeights.get(genre) || 0) + perGenre));
  };

  // Fast “Zevkime göre” remains the baseline one-tap signal.
  (likedMovies || []).forEach((movie) => addPositiveMovie(movie, 1));

  // Watched-only carries no taste meaning. Ratings of 6+ deepen the positive identity using
  // the same strength curve as the server Taste Engine; low ratings remain avoidance evidence
  // server-side and therefore are intentionally not presented as a “favorite genre” here.
  (diaryEntries || []).forEach((entry) => {
    const weight = ratingPositiveWeight(entry?.rating);
    if (weight <= 0) return;
    deepRatingCount += 1;
    addPositiveMovie(entry.movie, weight);
  });

  // Explicit onboarding genres are a light prior, not equal to a real fast-like.
  (profile?.preferredGenres || []).forEach((genre) => {
    if (!genre) return;
    genreWeights.set(genre, (genreWeights.get(genre) || 0) + 0.25);
  });

  const genreTotal = [...genreWeights.values()].reduce((sum, value) => sum + value, 0) || 1;
  const genres = [...genreWeights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, weight]) => ({
      name,
      percent: Math.max(10, Math.round((weight / genreTotal) * 100)),
    }));

  const typeTotal = filmWeight + showWeight;
  const filmPercent = typeTotal ? Math.round((filmWeight / typeTotal) * 100) : 50;
  const showPercent = typeTotal ? 100 - filmPercent : 50;

  return {
    genres,
    filmPercent,
    showPercent,
    signalCount: (likedMovies?.length || 0) + deepRatingCount,
    deepRatingCount,
  };
}

export default function ProfileScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [likedMovies, setLikedMovies] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [watchlists, setWatchlists] = useState([]);
  const [socialPosts, setSocialPosts] = useState([]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [questStreak, setQuestStreak] = useState(0);
  const [questSummary, setQuestSummary] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [diaryStats, setDiaryStats] = useState(null);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(route?.params?.initialSub === "likes" ? "likes" : "posts"); // posts | likes
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (route?.params?.initialSub === "likes") setSub("likes");
    else if (route?.params?.initialSub) setSub("posts");
  }, [route?.params?.initialSub]);

  const load = useCallback(async () => {
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
      setFriends(friendsData.friends || []);
      setWatchlists(watchlistsData.results || []);
      hasLoadedRef.current = true;
    } catch { /* sessizce geç */ }
    setLoading(false);

    api.socialUserPosts(auth.token, auth.id).then((data) => setSocialPosts(data.results || [])).catch(() => setSocialPosts([]));
    api.quests(auth.token).then((data) => {
      setQuestStreak(data.streak || 0);
      setQuestSummary(data);
    }).catch(() => {});
    api.achievements(auth.token).then(setAchievements).catch(() => {});
    diaryApi.stats(auth.token).then(setDiaryStats).catch(() => setDiaryStats(null));
    diaryApi.list(auth.token, { page: 1, limit: 50 }).then((data) => setDiaryEntries(data.results || [])).catch(() => setDiaryEntries([]));
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

  async function toggleLikeVisibility(item) {
    const hidden = !item.profileHidden;
    setLikedMovies((prev) => prev.map((m) => Number(m.id) === Number(item.id) ? { ...m, profileHidden: hidden } : m));
    try {
      await api.setLikeProfileVisibility(auth.token, item.id, hidden);
    } catch {
      setLikedMovies((prev) => prev.map((m) => Number(m.id) === Number(item.id) ? { ...m, profileHidden: !hidden } : m));
    }
  }

  const tasteDNA = useMemo(() => buildTasteDNA(likedMovies, profile, diaryEntries), [likedMovies, profile, diaryEntries]);
  const questTotal = questSummary?.quests?.length || 0;
  const questCompleted = questSummary?.quests?.filter((q) => q.completed).length || 0;
  const questPercent = questTotal ? Math.round((questCompleted / questTotal) * 100) : 0;
  const unlockedBadges = (achievements?.badges || []).filter((badge) => badge.unlocked).slice(0, 3);

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ProfileSkeleton />
      </View>
    );
  }

  const showPremiumBackground = !!(premiumStatus?.isPremium && profile.profileBackgroundUrl);
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
        <TouchableOpacity
          style={styles.coverSettingsBadge}
          onPress={() => navigation.navigate("Settings")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Settings size={13} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>

      <View style={{ padding: 20 }}>
        <View style={styles.igHeaderRow}>
          <TouchableOpacity onPress={() => pickPhoto("avatar")} activeOpacity={0.85}>
            <RetryImage
              source={{ uri: avatarOr(profile.avatarUrl, auth.id) }}
              style={[styles.avatar, premiumStatus?.isPremium && styles.avatarPremiumRing]}
            />
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? <ActivityIndicator size="small" color={c.bg} /> : <Camera size={11} color={c.bg} />}
            </View>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => setSub("likes")}>
              <Text style={styles.statNum}>{likeCount}</Text>
              <Text style={styles.statLabel}>Zevk</Text>
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
        {!!profile.username && <Text style={styles.username}>{`@${profile.username}`}</Text>}
        <Text style={styles.bio}>{profile.bio || "Henüz bir biyografi eklemedin."}</Text>

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

        {/* Profil artık yalnızca sayaçlardan oluşmuyor; kullanıcının seçimlerinden oluşan yaşayan
            bir kimlik gösteriyor. Bu ilk Taste DNA sürümü tamamen mevcut veriden türetiliyor,
            yeni backend endpoint'i gerektirmiyor. */}
        <View style={styles.tasteCard}>
          <View style={styles.insightHeader}>
            <View style={[styles.insightIcon, { backgroundColor: "rgba(139,92,246,0.14)" }]}>
              <Sparkles size={15} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightEyebrow}>ZEVK DNA'N</Text>
              <Text style={styles.insightTitle}>Pellix seni böyle tanıyor</Text>
            </View>
            <Text style={styles.signalText}>{tasteDNA.signalCount} sinyal</Text>
          </View>

          {tasteDNA.genres.length > 0 ? (
            <View style={styles.genreDNAList}>
              {tasteDNA.genres.map((genre) => (
                <View key={genre.name} style={styles.genreDNARow}>
                  <Text style={styles.genreDNAName} numberOfLines={1}>{genre.name}</Text>
                  <View style={styles.genreDNATrack}>
                    <View style={[styles.genreDNAFill, { width: `${Math.min(100, genre.percent * 2.1)}%` }]} />
                  </View>
                  <Text style={styles.genreDNAPercent}>%{genre.percent}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.insightEmpty}>Keşfet'te birkaç seçim yaptığında burada zevkinin ilk çizgileri oluşacak.</Text>
          )}

          <View style={styles.typeSplitRow}>
            <Text style={styles.typeSplitLabel}>Film %{tasteDNA.filmPercent}</Text>
            <View style={styles.typeSplitTrack}>
              <View style={[styles.typeSplitFilm, { width: `${tasteDNA.filmPercent}%` }]} />
            </View>
            <Text style={styles.typeSplitLabel}>Dizi %{tasteDNA.showPercent}</Text>
          </View>
          {Number(diaryStats?.tasteCandidatesUnrated || 0) > 0 && (
            <TouchableOpacity style={styles.deepenTasteBtn} onPress={() => navigation.navigate("RateTaste")} activeOpacity={0.84}>
              <Star size={14} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.deepenTasteTitle}>İzlediklerini puanla</Text>
                <Text style={styles.deepenTasteMeta}>{diaryStats.tasteCandidatesUnrated} zevk sinyali daha derinleştirilebilir{diaryStats.ratedTotal ? ` · ${diaryStats.ratedTotal} puanın var` : ""}</Text>
              </View>
              <ChevronRight size={15} color={c.dim} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.retentionRow}>
          <TouchableOpacity style={styles.retentionCard} onPress={() => navigation.navigate("WeeklyQuests")} activeOpacity={0.86}>
            <View style={styles.retentionTopRow}>
              <View style={[styles.retentionIcon, { backgroundColor: "rgba(249,115,22,0.14)" }]}>
                <Flame size={15} color="#F97316" />
              </View>
              <Text style={styles.retentionValue}>{questTotal ? `${questCompleted}/${questTotal}` : "—"}</Text>
            </View>
            <Text style={styles.retentionTitle}>Bu Haftaki Hedefin</Text>
            <View style={styles.miniProgressTrack}>
              <View style={[styles.miniProgressFill, { width: `${questPercent}%` }]} />
            </View>
            <Text style={styles.retentionMeta}>
              {questTotal ? (questCompleted === questTotal ? "Ödülün hazır 🎁" : `${questTotal - questCompleted} görev kaldı`) : "Görevlerini gör"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.retentionCard} onPress={() => navigation.navigate("Settings", { initialSection: "badges" })} activeOpacity={0.86}>
            <View style={styles.retentionTopRow}>
              <View style={[styles.retentionIcon, { backgroundColor: "rgba(201,164,76,0.15)" }]}>
                <Trophy size={15} color={c.accent} />
              </View>
              <Text style={styles.retentionValue}>{achievements ? `${achievements.unlockedCount}/${achievements.totalCount}` : "—"}</Text>
            </View>
            <Text style={styles.retentionTitle}>Rozet Vitrini</Text>
            {unlockedBadges.length > 0 ? (
              <View style={styles.badgePreviewRow}>
                {unlockedBadges.map((badge) => (
                  <View key={badge.id} style={styles.badgePreviewBubble}>
                    <Text style={styles.badgePreviewIcon}>{badge.icon}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.badgeEmptyText}>İlk rozetini açmaya başla</Text>
            )}
            <Text style={styles.retentionMeta}>Tüm başarılarını gör →</Text>
          </TouchableOpacity>
        </View>

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

        <View style={styles.contentTabs}>
          <TouchableOpacity style={[styles.contentTab, sub === "posts" && styles.contentTabActive]} onPress={() => setSub("posts")}>
            <Text style={[styles.contentTabText, sub === "posts" && styles.contentTabTextActive]}>Paylaşımlar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contentTab, sub === "likes" && styles.contentTabActive]} onPress={() => setSub("likes")}>
            <Text style={[styles.contentTabText, sub === "likes" && styles.contentTabTextActive]}>Zevkim</Text>
          </TouchableOpacity>
        </View>

        {sub === "posts" && (
          socialPosts.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              {socialPosts.map((item) => <SocialFeedCard key={item.id} item={item} navigation={navigation} compact />)}
            </View>
          ) : <Text style={styles.emptyText}>Henüz bir paylaşımın yok. Sosyal sekmesinden ilk Taste Post’unu oluşturabilirsin.</Text>
        )}

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
                  <TouchableOpacity style={{ flex: 1, position: "relative" }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? <Image source={{ uri: item.poster }} style={[styles.posterThumb, item.profileHidden && { opacity: 0.48 }]} />
                      : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }, item.profileHidden && { opacity: 0.48 }]} />}
                    <TouchableOpacity
                      style={styles.likeVisibilityBtn}
                      onPress={(e) => { e.stopPropagation?.(); toggleLikeVisibility(item); }}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      {item.profileHidden ? <EyeOff size={14} color="#fff" /> : <Eye size={14} color="#fff" />}
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
              {likeCount > likedMovies.length && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => navigation.navigate("AllLikes", { userId: auth.id, title: "Zevkime göre" })}
                >
                  <Text style={styles.seeAllBtnText}>Tümünü Gör ({likeCount})</Text>
                </TouchableOpacity>
              )}
            </>
          ) : <Text style={styles.emptyText}>Henüz bir zevk sinyalin yok.</Text>
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
          socialCard={{
            kind: "profile", userId: auth.id, name: profile.name, username: profile.username, avatarUrl: profile.avatarUrl,
            likeCount, friendCount: profile.friendCount || 0, listCount: watchlists.length,
            favoriteMovie: profile.favoriteMovie ? { id: profile.favoriteMovie.id, title: profile.favoriteMovie.title, poster: profile.favoriteMovie.poster } : null,
            favoriteShow: profile.favoriteShow ? { id: profile.favoriteShow.id, title: profile.favoriteShow.title, poster: profile.favoriteShow.poster } : null,
            isPremium: !!premiumStatus?.isPremium,
            tasteDNA: {
              genres: tasteDNA.genres,
              filmPercent: tasteDNA.filmPercent,
              showPercent: tasteDNA.showPercent,
              signalCount: tasteDNA.signalCount,
            },
            streak: questStreak,
          }}
          previewHeight={555}
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
                    tasteDNA={tasteDNA}
                    streak={questStreak}
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
                    tasteDNA={tasteDNA}
                    streak={questStreak}
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
            tasteDNA={tasteDNA}
            streak={questStreak}
          />
        </ShareCardModal>
      )}
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
    cover: { height: 100, position: "relative" },
    coverEditBadge: {
      position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    coverSettingsBadge: {
      position: "absolute", bottom: 10, right: 10, width: 28, height: 28, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
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
    statsRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: 16 },
    profileActionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    profileActionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      paddingVertical: 9, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    profileActionBtnText: { fontSize: 12, fontWeight: "700", color: c.text },

    tasteCard: {
      marginTop: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 18, padding: 15,
    },
    insightHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    insightIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    insightEyebrow: { fontSize: 9.5, fontWeight: "900", color: "#8B5CF6", letterSpacing: 0.8 },
    insightTitle: { fontSize: 14, fontWeight: "800", color: c.text, marginTop: 1 },
    signalText: { fontSize: 10, color: c.dim, fontWeight: "700" },
    insightEmpty: { color: c.dim, fontSize: 11.5, lineHeight: 17, marginTop: 14 },
    genreDNAList: { gap: 9, marginTop: 14 },
    genreDNARow: { flexDirection: "row", alignItems: "center", gap: 8 },
    genreDNAName: { width: 82, fontSize: 11, fontWeight: "700", color: c.text },
    genreDNATrack: { flex: 1, height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: c.surface2 },
    genreDNAFill: { height: "100%", borderRadius: 999, backgroundColor: "#8B5CF6" },
    genreDNAPercent: { width: 30, textAlign: "right", fontSize: 10, color: c.dim, fontWeight: "700" },
    typeSplitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    typeSplitLabel: { fontSize: 10.5, fontWeight: "700", color: c.dim },
    typeSplitTrack: { flex: 1, height: 7, backgroundColor: "#2563EB", borderRadius: 999, overflow: "hidden" },
    typeSplitFilm: { height: "100%", backgroundColor: c.accent },

    deepenTasteBtn: { marginTop: 13, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    deepenTasteTitle: { color: c.text, fontSize: 11.5, fontWeight: "850" },
    deepenTasteMeta: { color: c.dim, fontSize: 9.5, marginTop: 2 },
    retentionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    retentionCard: {
      flex: 1, minHeight: 128, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 16, padding: 12,
    },
    retentionTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    retentionIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    retentionValue: { fontSize: 13, fontWeight: "900", color: c.text },
    retentionTitle: { fontSize: 11.5, fontWeight: "800", color: c.text, marginTop: 9 },
    retentionMeta: { fontSize: 9.5, fontWeight: "700", color: c.dim, marginTop: 7 },
    miniProgressTrack: { height: 5, borderRadius: 999, backgroundColor: c.surface2, overflow: "hidden", marginTop: 9 },
    miniProgressFill: { height: "100%", borderRadius: 999, backgroundColor: "#F97316" },
    badgePreviewRow: { flexDirection: "row", marginTop: 8 },
    badgePreviewBubble: {
      width: 29, height: 29, borderRadius: 999, alignItems: "center", justifyContent: "center",
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, marginRight: -4,
    },
    badgePreviewIcon: { fontSize: 14 },
    badgeEmptyText: { fontSize: 9.5, color: c.dim, marginTop: 10, minHeight: 29 },

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
    statNum: { fontSize: 17, fontWeight: "700", color: c.text, fontVariant: ["tabular-nums"] },
    statLabel: { fontSize: 10.5, color: c.dim, marginTop: 3, letterSpacing: 0.2 },
    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    contentTabs: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    contentTab: { flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
    contentTabActive: { borderBottomColor: c.accent },
    contentTabText: { color: c.dim, fontSize: 12.5, fontWeight: "800" },
    contentTabTextActive: { color: c.accent },
    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    likeVisibilityBtn: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center", zIndex: 5 },
    emptyText: { color: c.dim, fontSize: 12, marginTop: 14 },
    seeAllBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    seeAllBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
  });
}
