import { Alert } from "../i18n/native";
import { t as translateUI } from "../i18n/core";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, FlatList, ActivityIndicator} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import {
  Settings, Camera, Star, ChevronRight, Pencil, Share2, BookOpen,
  Eye, EyeOff,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { diaryApi } from "../api/diary";
import { avatarOr } from "../utils/avatar";
import { hexToRgba } from "../utils/color";
import { backgroundBlurAndDim } from "../utils/profileBackground";
import ShareCardModal from "../components/ShareCardModal";
import ShareFan, { shareOptions } from "../components/salon/ShareFan";
import ProfileShareCard from "../components/ProfileShareCard";
import RetryImage from "../components/RetryImage";
import EditProfileModal from "../components/EditProfileModal";
import SocialFeedCard from "../components/SocialFeedCard";
import ProfileSkeleton from "../components/skeletons/ProfileSkeleton";
import ReelChart from "../components/salon/ReelChart";
import TicketCard from "../components/salon/TicketCard";
import { FONTS, upperTR } from "../theme/fonts";

// Profilin üst kısmı kişinin kendi filminin afişi: adı başlık, biyografisi slogan, sayıları
// afişin altındaki künye yazısı. Kapak fotoğrafı varsa afişin zemini o; yoksa kadife perde.
// Afiş fiziksel bir nesne olduğu için iki temada da aynı koyu renklerde.
const CURTAIN_FOLDS = 18;
function Curtain() {
  return (
    <View style={[StyleSheet.absoluteFillObject, { flexDirection: "row" }]} pointerEvents="none">
      {Array.from({ length: CURTAIN_FOLDS }, (_, i) => (
        <LinearGradient key={i} colors={["#3a1012", "#7a2428", "#4a1416"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      ))}
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(10,3,4,0.55)"]} style={StyleSheet.absoluteFillObject} />
    </View>
  );
}

function Spotlight() {
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="profileSpot" cx="50%" cy="22%" rx="60%" ry="62%" fx="50%" fy="18%">
          <Stop offset="0" stopColor="#ffe4aa" stopOpacity="0.5" />
          <Stop offset="0.55" stopColor="#ffe4aa" stopOpacity="0.1" />
          <Stop offset="1" stopColor="#ffe4aa" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50%" cy="22%" rx="60%" ry="62%" fill="url(#profileSpot)" />
    </Svg>
  );
}

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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [likedMovies, setLikedMovies] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [watchlists, setWatchlists] = useState([]);
  const [socialPosts, setSocialPosts] = useState([]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [questStreak, setQuestStreak] = useState(0);
  const [diaryStats, setDiaryStats] = useState(null);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [serverTasteDNA, setServerTasteDNA] = useState(null);
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
    api.quests(auth.token).then((data) => setQuestStreak(data.streak || 0)).catch(() => {});
    diaryApi.stats(auth.token).then(setDiaryStats).catch(() => setDiaryStats(null));
    api.tasteDNA(auth.token).then(setServerTasteDNA).catch(() => setServerTasteDNA(null));
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

  const localTasteDNA = useMemo(() => buildTasteDNA(likedMovies, profile, diaryEntries), [likedMovies, profile, diaryEntries]);
  const tasteDNA = serverTasteDNA || localTasteDNA;

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
      <View style={{ padding: 16, paddingTop: Math.max(insets.top, 12) + 6 }}>
        <View style={styles.onesheet}>
          {profile.coverUrl ? (
            <>
              <RetryImage source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(12,6,6,0.55)" }]} />
            </>
          ) : <Curtain />}
          <Spotlight />

          <View style={styles.osTopRow}>
            <TouchableOpacity style={styles.osIconBtn} onPress={() => pickPhoto("cover")} accessibilityRole="button" accessibilityLabel={translateUI("Afiş zeminini değiştir")}>
              {uploadingCover ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={16} color="#fbf2df" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.osIconBtn} onPress={() => navigation.navigate("Settings")} accessibilityRole="button" accessibilityLabel={translateUI("Ayarlar")}>
              <Settings size={16} color="#fbf2df" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => pickPhoto("avatar")} activeOpacity={0.85} style={styles.osAvatarWrap} accessibilityRole="button" accessibilityLabel={translateUI("Profil fotoğrafını değiştir")}>
            <RetryImage
              source={{ uri: avatarOr(profile.avatarUrl, auth.id) }}
              style={[styles.avatar, premiumStatus?.isPremium && styles.avatarPremiumRing]}
            />
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? <ActivityIndicator size="small" color={c.bg} /> : <Camera size={11} color={c.bg} />}
            </View>
          </TouchableOpacity>

          <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{upperTR(profile.name)}</Text>
          {!!profile.username && <Text style={styles.username}>{`@${profile.username}`}</Text>}
          <Text style={styles.bio}>{profile.bio || translateUI("Henüz bir biyografi eklemedin.")}</Text>

          <View style={styles.billing}>
            <Text style={styles.billingLine} numberOfLines={1}>{translateUI("PELLIX SUNAR · BİR ")}{upperTR(profile.name)}{translateUI(" PROFİLİ")}</Text>
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => setSub("likes")} accessibilityLabel={translateUI("{0} beğeni", {0: likeCount})}>
                <Text style={styles.statNum}>{likeCount}</Text>
                <Text style={styles.statLabel}>{translateUI("BEĞENİ")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.statItem, styles.statDivided]} onPress={() => navigation.navigate("FriendsList")} accessibilityLabel={translateUI("{0} arkadaş", {0: friends.length})}>
                <Text style={styles.statNum}>{friends.length}</Text>
                <Text style={styles.statLabel}>{translateUI("ARKADAŞ")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.statItem, styles.statDivided]} onPress={() => navigation.navigate("MyWatchlists")} accessibilityLabel={translateUI("{0} liste", {0: watchlists.length})}>
                <Text style={styles.statNum}>{watchlists.length}</Text>
                <Text style={styles.statLabel}>{translateUI("LİSTE")}</Text>
              </TouchableOpacity>
              {questStreak > 0 && (
                <TouchableOpacity style={[styles.statItem, styles.statDivided]} onPress={() => navigation.navigate("WeeklyQuests")} accessibilityLabel={translateUI("{0} hafta seri", {0: questStreak})}>
                  <Text style={styles.statNum}>{questStreak}</Text>
                  <Text style={styles.statLabel}>{translateUI("HAFTA SERİ")}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.profileActionsRow}>
          <TouchableOpacity style={styles.profileActionBtn} onPress={() => setShowEditProfile(true)}>
            <Pencil size={13} color={c.text} />
            <Text style={styles.profileActionBtnText}>{translateUI("Profili Düzenle")}</Text>
          </TouchableOpacity>
          <ShareFan
            style={styles.profileActionBtn}
            accessibilityLabel={translateUI("Profili paylaş")}
            options={shareOptions({
              message: `${profile.name} Pellix'te profilini paylaştı`,
              url: profile.username ? `https://open.pellix.app/u/${profile.username}` : "https://www.pellix.app",
              card: () => setShowShareCard(true),
            })}
          >
            <Share2 size={13} color={c.text} />
            <Text style={styles.profileActionBtnText}>{translateUI("Profili Paylaş")}</Text>
          </ShareFan>
        </View>

        <TouchableOpacity
          style={styles.diaryShortcut}
          onPress={() => navigation.navigate("Diary")}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={translateUI("İzleme Günlüğüm")}
        >
          <View style={styles.diaryShortcutIcon}>
            <BookOpen size={15} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.diaryShortcutTitle}>{translateUI("İzleme Günlüğüm")}</Text>
            <Text style={styles.diaryShortcutMeta} numberOfLines={1}>
              {diaryStats?.total
                ? translateUI("{0} izledim{1}", {0: diaryStats.total,1: diaryStats?.ratedTotal ? ` · ${diaryStats.ratedTotal} puan` : ""})
                : translateUI("İzlediklerini, puanlarını ve notlarını gör")}
            </Text>
          </View>
          <ChevronRight size={15} color={c.dim} />
        </TouchableOpacity>

        {/* Zevk DNA artık backend'de kullanıcının TÜM like/dislike + tüm puan geçmişinden
            hesaplanıyor. Bu ekranda yalnız aggregate sonuç gösteriliyor; profil özetindeki 30
            içerik ve Diary'nin ilk sayfası artık DNA hesabını sınırlamıyor. */}
        <View style={styles.tasteCard}>
          <View style={styles.insightHeader}>
            <Text style={styles.insightTitle}>{translateUI("Pellix seni böyle tanıyor")}</Text>
            <Text style={styles.signalText}>{tasteDNA.signalCount}{translateUI(" sinyal")}</Text>
          </View>

          {tasteDNA.genres.length > 0 ? (
            <ReelChart genres={tasteDNA.genres} />
          ) : (
            <Text style={styles.insightEmpty}>{translateUI("Keşfet'te birkaç seçim yaptığında makaran burada sarılmaya başlayacak.")}</Text>
          )}

          <View style={styles.typeSplitRow}>
            <Text style={styles.typeSplitLabel}>{translateUI("Film %")}{tasteDNA.filmPercent}</Text>
            <View style={styles.typeSplitTrack}>
              <View style={[styles.typeSplitFilm, { width: `${tasteDNA.filmPercent}%` }]} />
            </View>
            <Text style={styles.typeSplitLabel}>{translateUI("Dizi %")}{tasteDNA.showPercent}</Text>
          </View>
          {Number(diaryStats?.tasteCandidatesUnrated || 0) > 0 && (
            <TouchableOpacity style={styles.deepenTasteBtn} onPress={() => navigation.navigate("RateTaste")} activeOpacity={0.84}>
              <Star size={14} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.deepenTasteTitle}>{translateUI("İzlediklerini puanla")}</Text>
                <Text style={styles.deepenTasteMeta}>{diaryStats.tasteCandidatesUnrated}{translateUI(" beğenine puan verebilirsin")}{diaryStats.ratedTotal ? translateUI(" · {0} puanın var", {0: diaryStats.ratedTotal}) : ""}</Text>
              </View>
              <ChevronRight size={15} color={c.dim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Haftalık görevler Ana Sayfa'daki haftalık hedef alanında; rozetler Ayarlar > Rozetler'de.
            Profil, kimlik + Zevk DNA + içerik odağında daha kompakt tutuluyor. */}

        {!premiumStatus?.isPremium && (
          <TicketCard
            style={{ marginTop: 16 }}
            eyebrow="PREMIUM"
            title={translateUI("Premium'a geç")}
            subtitle={translateUI("Sınırsız öneri ve TasteMate, haftalık")}
            onPress={() => navigation.navigate("Premium")}
          />
        )}

        {(profile.favoriteMovie || profile.favoriteShow) && (
          <View style={styles.favRow}>
            {profile.favoriteMovie && <FavCard label={translateUI("Favori Film")} movie={profile.favoriteMovie} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteMovie })} />}
            {profile.favoriteShow && <FavCard label={translateUI("Favori Dizi")} movie={profile.favoriteShow} c={c} onPress={() => navigation.navigate("Detail", { movie: profile.favoriteShow })} />}
          </View>
        )}

        <View style={styles.contentTabs}>
          <TouchableOpacity style={[styles.contentTab, sub === "posts" && styles.contentTabActive]} onPress={() => setSub("posts")}>
            <Text style={[styles.contentTabText, sub === "posts" && styles.contentTabTextActive]}>{translateUI("Paylaşımlar")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contentTab, sub === "likes" && styles.contentTabActive]} onPress={() => setSub("likes")}>
            <Text style={[styles.contentTabText, sub === "likes" && styles.contentTabTextActive]}>{translateUI("Beğendiklerim")}</Text>
          </TouchableOpacity>
        </View>

        {sub === "posts" && (
          socialPosts.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              {socialPosts.map((item) => <SocialFeedCard key={item.id} item={item} navigation={navigation} compact />)}
            </View>
          ) : <Text style={styles.emptyText}>{translateUI("Henüz bir paylaşımın yok. Sosyal sekmesinden ilk Taste Post’unu oluşturabilirsin.")}</Text>
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
                  onPress={() => navigation.navigate("AllLikes", { userId: auth.id, title: translateUI("Beğendiklerim") })}
                >
                  <Text style={styles.seeAllBtnText}>{translateUI("Tümünü Gör (")}{likeCount}{translateUI(")")}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : <Text style={styles.emptyText}>{translateUI("Henüz beğendiğin bir şey yok. Keşfet'te afişleri duvarına asmaya başla.")}</Text>
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
          <Star size={10} color={c.accent} fill={c.accent} />
          <Text style={{ fontSize: 10, fontFamily: FONTS.monoMedium, color: c.accent, letterSpacing: 0.6 }}>{upperTR(label)}</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginTop: 3 }} numberOfLines={2}>{movie.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    onesheet: { borderRadius: 14, overflow: "hidden", backgroundColor: "#3f1214", alignItems: "center", paddingTop: 14, paddingHorizontal: 14 },
    osTopRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between" },
    osIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
    osAvatarWrap: { marginTop: -8 },
    avatar: { width: 96, height: 96, borderRadius: 999, borderWidth: 3, borderColor: "#efe4cc", backgroundColor: "#2a2520" },
    avatarPremiumRing: { borderColor: "#F5C518" },
    avatarEditBadge: {
      position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 999, backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#3f1214",
    },
    name: { fontSize: 52, lineHeight: 50, fontFamily: FONTS.marquee, color: "#fbf2df", marginTop: 14, textAlign: "center", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 14 },
    username: { fontSize: 12, fontFamily: FONTS.mono, color: "#e9d8b9", marginTop: 4 },
    bio: { fontSize: 14, fontStyle: "italic", color: "#f0dfc0", marginTop: 10, lineHeight: 20, textAlign: "center", maxWidth: 300 },
    billing: { alignSelf: "stretch", marginHorizontal: -14, marginTop: 20, paddingTop: 12, paddingBottom: 6, backgroundColor: "rgba(10,4,4,0.55)" },
    billingLine: { fontFamily: FONTS.marqueeMedium, fontSize: 11.5, letterSpacing: 1.6, color: "rgba(233,216,185,0.8)", textAlign: "center", paddingHorizontal: 10, marginBottom: 4 },
    statsRow: { flexDirection: "row" },
    profileActionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    profileActionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border,
    },
    profileActionBtnText: { fontSize: 14, fontWeight: "600", color: c.text },

    diaryShortcut: {
      marginTop: 10, minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    diaryShortcutIcon: { alignItems: "center", justifyContent: "center" },
    diaryShortcutTitle: { fontSize: 14.5, fontWeight: "700", color: c.text },
    diaryShortcutMeta: { fontSize: 12, color: c.dim, marginTop: 2 },

    tasteCard: {
      marginTop: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 18, padding: 15,
    },
    insightHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
    insightTitle: { fontSize: 24, fontFamily: FONTS.marquee, color: c.text, flexShrink: 1 },
    signalText: { fontSize: 11.5, color: c.dim, fontFamily: FONTS.mono },
    insightEmpty: { color: c.dim, fontSize: 12.5, lineHeight: 18, marginTop: 14 },
    typeSplitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    typeSplitLabel: { fontSize: 11.5, fontFamily: FONTS.mono, color: c.dim },
    typeSplitTrack: { flex: 1, height: 8, backgroundColor: "#6f9fb0", borderRadius: 999, overflow: "hidden" },
    typeSplitFilm: { height: "100%", backgroundColor: c.accent },

    deepenTasteBtn: { marginTop: 13, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    deepenTasteTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
    deepenTasteMeta: { color: c.dim, fontSize: 12, marginTop: 2 },
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
    statItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 50 },
    statDivided: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.14)" },
    statNum: { fontSize: 25, fontFamily: FONTS.marqueeBold, color: "#fbf2df" },
    statLabel: { fontSize: 11, fontFamily: FONTS.marqueeMedium, color: "rgba(233,216,185,0.75)", letterSpacing: 1.4 },
    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    contentTabs: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    contentTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
    contentTabActive: { borderBottomColor: c.accent },
    contentTabText: { color: c.dim, fontSize: 21, fontFamily: FONTS.marqueeBold },
    contentTabTextActive: { color: c.text },
    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    likeVisibilityBtn: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center", zIndex: 5 },
    emptyText: { color: c.dim, fontSize: 12, marginTop: 14 },
    seeAllBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    seeAllBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
  });
}
