import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, Animated, PanResponder, Keyboard, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Film, Tv, Clock, Star, Heart, X, Bookmark, Send, Share2, Play } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { platformName, platformLogo } from "../utils/platform";
import { avatarOr } from "../utils/avatar";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import RetryImage from "../components/RetryImage";
import ListPickerModal from "../components/ListPickerModal";
import SendToFriendModal from "../components/SendToFriendModal";
import SocialPostComposer from "../components/SocialPostComposer";
import TrailerPlayerModal from "../components/TrailerPlayerModal";
import SocialProofRow from "../components/SocialProofRow";
import { DetailExtraSkeleton, CommentsSkeleton } from "../components/skeletons/DetailSkeleton";

const DETAIL_HINT_KEY = "pellix_detail_drag_hint_seen";

const { height: SCREEN_H } = Dimensions.get("window");
// Poster ARTIK sabit boyutta — sadece panel, TRANSFORM (translateY) ile üstüne kayıyor/açılıyor.
// Bu, her karede pahalı bir "yeniden yerleşim" (layout) hesabı gerektiren height/top animasyonuna
// göre çok daha hafif, bu yüzden takılma çok azalıyor.
const POSTER_MAX_H = SCREEN_H - 240;   // poster'ın görünebileceği en büyük hâli (panel tam kapalıyken) — gradyan + başlık + IMDB puanı rahatça sığacak kadar pay bırakıyor
const PANEL_TOP = SCREEN_H * 0.08;     // panelin çıkabileceği en yukarı nokta
const DEFAULT_POSTER_H = SCREEN_H * 0.48; // ekran ilk açıldığındaki dinlenme konumu

const TRAVEL = POSTER_MAX_H - PANEL_TOP; // panelin toplam kayma mesafesi
const DEFAULT_TRANSLATE = POSTER_MAX_H - DEFAULT_POSTER_H;
const SNAP_TRANSLATES = [0, DEFAULT_TRANSLATE, TRAVEL]; // en açık, varsayılan, en kapalı
const POSTER_MIN_SCALE = 0.62; // panel en yukarı çekildiğinde posterin küçüleceği en düşük ölçek
const FADE_H = 90; // panelin üstündeki saydamlaşan geçiş şeridinin yüksekliği
const HANDLE_AREA_H = 100; // tutamaç + başlık + puan alanının kapladığı yaklaşık yükseklik

export default function DetailScreen({ route, navigation }) {
  const { movie } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [favMovieId, setFavMovieId] = useState(null);
  const [favShowId, setFavShowId] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState(null);

  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [extra, setExtra] = useState({ director: null, cast: [], similar: [], trailers: [] });
  const [extraLoading, setExtraLoading] = useState(true);
  const [socialStats, setSocialStats] = useState(null);
  const scrollRef = useRef(null);

  // DT1 — Like butonuna basınca küçük bir kalp sıçraması.
  const likeScale = useRef(new Animated.Value(1)).current;
  function popLike() {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: true, speed: 40, bounciness: 16 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
  }

  // DT2 — favori yıldızına basınca kısa bir parıltı sıçraması.
  const favScale = useRef(new Animated.Value(1)).current;

  // DT4 — favori işaretlenince (sessizce de beğeni sayan bir birleşik aksiyon) kısa bir onay.
  const [favToast, setFavToast] = useState(false);
  const favToastOpacity = useRef(new Animated.Value(0)).current;
  function showFavToast() {
    setFavToast(true);
    Animated.sequence([
      Animated.timing(favToastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(favToastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setFavToast(false));
  }

  // DT3 — sürüklenebilir poster-panel mekaniği ilk kez görülüyorsa tutamacı bir kere
  // hafifçe zıplatıp "buradan sürükleyebilirsin" ipucu veriyoruz; bir daha gösterilmiyor.
  const handleBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    AsyncStorage.getItem(DETAIL_HINT_KEY).then((seen) => {
      if (seen) return;
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(handleBounce, { toValue: -10, duration: 260, useNativeDriver: true }),
        Animated.spring(handleBounce, { toValue: 0, useNativeDriver: true, bounciness: 18 }),
        Animated.delay(150),
        Animated.timing(handleBounce, { toValue: -6, duration: 220, useNativeDriver: true }),
        Animated.spring(handleBounce, { toValue: 0, useNativeDriver: true, bounciness: 18 }),
      ]).start();
      AsyncStorage.setItem(DETAIL_HINT_KEY, "1").catch(() => {});
    }).catch(() => {});
  }, []);

  // Yorum kutusu panelin en altında olduğu için klavye açılınca gizleniyordu. Çözüm: klavyenin
  // yüksekliğini takip edip hem panele o kadar EKSTRA boşluk bırakıyoruz (kutu gerçekten
  // kaydırılıp görülebilsin diye) hem de yorum kutusuna dokununca paneli tam açıp en alta kaydırıyoruz.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates?.height || 0));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  function focusCommentInput() {
    snapTo(0); // paneli tam aç — yorum kutusuna en fazla yer bu konumda ayrılıyor
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  }

  // Panelin konumu — TEK bir transform (translateY) değeri, hem sürüklemede hem
  // yapışma animasyonunda kullanılıyor.
  const translateY = useRef(new Animated.Value(DEFAULT_TRANSLATE)).current;
  const startValue = useRef(DEFAULT_TRANSLATE);
  const currentValue = useRef(DEFAULT_TRANSLATE);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { currentValue.current = value; });
    return () => translateY.removeListener(id);
  }, [translateY]);

  function snapTo(value) {
    Animated.spring(translateY, { toValue: value, useNativeDriver: false, friction: 9, tension: 60 }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 2,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateY.stopAnimation();
        startValue.current = currentValue.current;
      },
      onPanResponderMove: (_, g) => {
        // Yukarı çekmek (g.dy negatif) => translateY 0'a yaklaşır => panel yukarı çıkar, poster daha çok örtülür.
        // Aşağı çekmek (g.dy pozitif) => translateY TRAVEL'e yaklaşır => panel aşağı iner, poster tamamen açılır.
        const next = startValue.current + g.dy;
        translateY.setValue(Math.min(TRAVEL, Math.max(0, next)));
      },
      onPanResponderRelease: () => {
        const value = currentValue.current;
        let nearest = SNAP_TRANSLATES[0];
        let minDist = Infinity;
        for (const p of SNAP_TRANSLATES) {
          const d = Math.abs(p - value);
          if (d < minDist) { minDist = d; nearest = p; }
        }
        snapTo(nearest);
      },
    })
  ).current;

  // Poster, panel tamamen kapanınca (translateY=TRAVEL, poster tam açık) doğal boyutunda,
  // panel yukarı çekilince (translateY=0) hafifçe küçülüyor. React Native scale'i MERKEZDEN
  // uygular; posterin ÜSTTEN sabit kalması (yapışık durması) için küçülürken yukarı doğru
  // NEGATİF bir telafi ofseti gerekiyor — önceki sürümde bu işaret yanlıştı, bu yüzden poster
  // üstten kopup aşağı kayıyormuş gibi görünüyordu.
  const posterScale = translateY.interpolate({ inputRange: [0, TRAVEL], outputRange: [POSTER_MIN_SCALE, 1], extrapolate: "clamp" });
  const posterOffsetY = translateY.interpolate({
    inputRange: [0, TRAVEL],
    outputRange: [-((1 - POSTER_MIN_SCALE) * POSTER_MAX_H) / 2, 0],
    extrapolate: "clamp",
  });

  // ÖNEMLİ DÜZELTME: panelin kendi iç yüksekliği hep SABİTTİ (SCREEN_H - PANEL_TOP), sadece
  // transform ile kaydırılıyordu. Bu yüzden panel "orta" konumdayken, ekranda görünen kısmın
  // ALTINDA KALAN içerik (yorumlar vs.) normal kaydırmayla asla erişilemiyordu — çünkü
  // ScrollView'ın kendi görünür alanı hep panelin TAM AÇIK haliyle aynı boyuttaydı, panel o an
  // ekranda ne kadar yer kaplıyorsa ona göre KÜÇÜLMÜYORDU. Şimdi kaydırılabilir alanın
  // yüksekliğini translateY'e bağlı, gerçekten görünen panel yüksekliğine göre hesaplıyoruz —
  // böylece panel büyütülmeden de altındaki içerik normal kaydırmayla görülebiliyor.
  const scrollAreaHeight = translateY.interpolate({
    inputRange: [0, TRAVEL],
    outputRange: [SCREEN_H - PANEL_TOP - FADE_H - HANDLE_AREA_H, SCREEN_H - PANEL_TOP - TRAVEL - FADE_H - HANDLE_AREA_H],
    extrapolate: "clamp",
  });

  useEffect(() => {
    api.interactions(auth.token).then((data) => {
      (data.results || []).forEach((row) => {
        if (row.movie_id !== movie.id) return;
        if (row.action === "like") setLiked(true);
        else if (row.action === "dislike") setDisliked(true);
      });
    }).catch(() => {});
    api.me(auth.token).then((me) => {
      setFavMovieId(me.favoriteMovie?.id || null);
      setFavShowId(me.favoriteShow?.id || null);
    }).catch(() => {});
    api.comments(auth.token, movie.id).then((data) => setComments(data.results || [])).catch(() => {}).finally(() => setCommentsLoading(false));
    api.movieExtra(auth.token, movie.id).then((data) => setExtra(data)).catch(() => {}).finally(() => setExtraLoading(false));
    api.socialStats(auth.token, [movie.id]).then((data) => setSocialStats(data.results?.[movie.id] || null)).catch(() => {});
  }, []);

  const isFavorite = movie.type === "Film" ? favMovieId === movie.id : favShowId === movie.id;

  function like() {
    const wasLiked = liked;
    hapticLight();
    if (!wasLiked) popLike();
    setLiked((v) => !v); setDisliked(false);
    setSocialStats((prev) => prev ? { ...prev, likes: Math.max(0, Number(prev.likes || 0) + (wasLiked ? -1 : 1)) } : prev);
    if (wasLiked) api.removeInteraction(auth.token, movie.id, "like").catch(() => {});
    else api.recordInteraction(auth.token, movie.id, "like").catch(() => {});
  }
  function dislike() {
    const wasDisliked = disliked;
    hapticLight();
    setDisliked((v) => !v); setLiked(false);
    if (liked) setSocialStats((prev) => prev ? { ...prev, likes: Math.max(0, Number(prev.likes || 0) - 1) } : prev);
    if (wasDisliked) api.removeInteraction(auth.token, movie.id, "dislike").catch(() => {});
    else api.recordInteraction(auth.token, movie.id, "dislike").catch(() => {});
  }

  async function toggleFavorite() {
    if (favBusy) return;
    setFavBusy(true);
    const becomingFavorite = !isFavorite;
    try {
      await api.updateFavorite(auth.token, isFavorite ? { movie_id: null, type: movie.type } : { movie_id: movie.id });
      if (movie.type === "Film") setFavMovieId(isFavorite ? null : movie.id);
      else setFavShowId(isFavorite ? null : movie.id);
      // Bir içeriği "favorim" olarak seçmek, onu zaten beğenmiş olman demek — otomatik like say.
      if (!isFavorite && !liked) {
        setLiked(true); setDisliked(false);
        setSocialStats((prev) => prev ? { ...prev, likes: Number(prev.likes || 0) + 1 } : prev);
        api.recordInteraction(auth.token, movie.id, "like").catch(() => {});
      }
      if (becomingFavorite) {
        // DT2/DT4 — özel, tek kişilik bir slota bir şey atarken sadece renk değişmesin diye
        // kısa bir parıltı sıçraması + "favorin oldu" onayı.
        hapticSuccess();
        Animated.sequence([
          Animated.spring(favScale, { toValue: 1.08, useNativeDriver: true, speed: 30, bounciness: 10 }),
          Animated.spring(favScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
        ]).start();
        showFavToast();
      }
    } catch { /* sessizce geç */ }
    setFavBusy(false);
  }

  async function addComment() {
    const text = comment.trim();
    if (!text) return;
    setComment("");
    // İyimser ekleme: hemen ekranda göster.
    const tempId = `temp-${Date.now()}`;
    setComments((cs) => [...cs, { id: tempId, name: auth.name, avatar_url: null, body: text, created_at: new Date().toISOString() }]);
    try {
      await api.addComment(auth.token, movie.id, text);
      // Geçici eşleştirme yerine listeyi doğrudan sunucudan tazeliyoruz — daha güvenilir.
      const fresh = await api.comments(auth.token, movie.id);
      setComments(fresh.results || []);
    } catch (e) {
      setComments((cs) => cs.filter((c) => c.id !== tempId)); // başarısız olursa geri al
      console.warn("Yorum eklenemedi:", e.message);
    }
  }

  function openTrailer(trailer) {
    if (!trailer?.key) return;
    hapticLight();
    setSelectedTrailer(trailer);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Poster: kabı sabit boyutta, ama içindeki görsel translateY'e bağlı hafif bir
          scale ile büyüyüp küçülüyor — üstten sabit kalacak şekilde (transformOrigin
          desteklenmediği için manuel telafi ediliyor). */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: POSTER_MAX_H, backgroundColor: c.bg, overflow: "hidden" }}>
        <Animated.View style={{ width: "100%", height: "100%", transform: [{ translateY: posterOffsetY }, { scale: posterScale }] }}>
          {movie.poster ? (
            <Image source={{ uri: movie.poster }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c.surface2 }]} />
          )}
        </Animated.View>
        <LinearGradient colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]} locations={[0, 0.3]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <ChevronLeft size={18} color="#fff" />
      </TouchableOpacity>

      {/* Panel: sabit boyutlu bir kutu (PANEL_TOP'tan ekranın altına kadar), sadece
          transform: translateY ile kayıyor — bu, height/top animasyonuna göre çok daha hafif.
          DIŞ kapsayıcı SAYDAM — böylece üstteki gradyan şeridi posteri gerçekten gösterebiliyor.
          Katı (opak) arka plan sadece İÇ kapsayıcıda. */}
      <Animated.View
        style={{
          position: "absolute", left: 0, right: 0, top: PANEL_TOP, bottom: 0,
          transform: [{ translateY }],
        }}
      >
        {/* Panelin TAM SINIRLARI İÇİNDE (negatif konum değil — önceki sürümde overflow:hidden
            tarafından tamamen kesiliyordu). Saydamdan panelin arka plan rengine geçiyor,
            altındaki poster gerçekten görünüyor. */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", c.bg]}
          locations={[0, 1]}
          style={{ height: FADE_H }}
          pointerEvents="none"
        />

        <View style={[styles.sheetBg, { backgroundColor: c.bg, flex: 1 }]}>
          <View {...panResponder.panHandlers} style={styles.handleWrap}>
            <Animated.View style={{ transform: [{ translateY: handleBounce }] }}>
              <View style={[styles.handle, { backgroundColor: c.dim }]} />
            </Animated.View>
            <View style={styles.peek}>
              <Text style={styles.title} numberOfLines={1}>{movie.title}</Text>
              <View style={styles.ratingRow}>
                <Star size={15} color={c.accent} fill={c.accent} />
                <Text style={styles.ratingNum}>{movie.imdb}</Text>
                <Text style={styles.metaText}>· {movie.year} · {movie.genre}</Text>
              </View>
            </View>
          </View>

          <Animated.View style={{ height: scrollAreaHeight }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.body, { paddingBottom: 30 + keyboardHeight }]}
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              {movie.type === "Film" ? <Film size={13} color={c.dim} /> : <Tv size={13} color={c.dim} />}
              <Text style={styles.metaText}>{movie.type}</Text>
            </View>
            {!!movie.runtime && (
              <View style={styles.metaItem}>
                <Clock size={12} color={c.dim} />
                <Text style={styles.metaText}>{movie.runtime}</Text>
              </View>
            )}
            <Text style={styles.metaText}>{Number(movie.votes || 0).toLocaleString("tr-TR")} oy · IMDB</Text>
          </View>

          {!!movie.overview && <Text style={styles.overview}>{movie.overview}</Text>}

          <View style={styles.platformsRow}>
            {Array.isArray(movie.platforms) && movie.platforms.length > 0 ? (
              movie.platforms.map((p, i) => {
                const logo = platformLogo(p);
                return (
                  <View key={i} style={styles.platformPill}>
                    {logo && <Image source={{ uri: logo }} style={styles.platformPillLogo} />}
                    <Text style={styles.platformPillText}>{platformName(p)}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.metaText}>Şu an TR'de bir platformda yayında değil.</Text>
            )}
          </View>

          <View style={styles.socialProofSection}>
            <SocialProofRow stats={socialStats} />
          </View>

          {/* Aksiyon butonları (like/dislike/paylaş/favorile) — eskiden oyuncular ve benzer
              içeriklerin ALTINDA, yorumların hemen üstünde duruyordu; kullanıcı içeriği
              beğenmek/kaydetmek için önce cast+benzer içerikleri geçmek zorunda kalıyordu.
              Artık platform bilgisinin hemen altında, oyuncular/benzer içeriklerin hemen
              üzerinde — ilk bakışta görülüyor. */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionMain, liked && { backgroundColor: c.accent2, borderColor: c.accent2 }]} onPress={like}>
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Heart size={16} color={liked ? "#fff" : c.text} fill={liked ? "#fff" : "none"} />
              </Animated.View>
              <Text style={[styles.actionMainText, liked && { color: "#fff" }]}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionMain, disliked && { backgroundColor: c.danger, borderColor: c.danger }]} onPress={dislike}>
              <X size={16} color={disliked ? "#fff" : c.text} />
              <Text style={[styles.actionMainText, disliked && { color: "#fff" }]}>Dislike</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSquare} onPress={() => setShowListPicker(true)}>
              <Bookmark size={16} color={c.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSquare} onPress={() => setSendOpen(true)}>
              <Send size={16} color={c.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.tastePostBtn} onPress={() => setPostComposerOpen(true)} activeOpacity={0.85}>
            <Share2 size={15} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tastePostTitle}>Taste Post olarak paylaş</Text>
              <Text style={styles.tastePostSub}>Bu içerik hakkında fikrini sosyal akışında paylaş.</Text>
            </View>
          </TouchableOpacity>

          {/* DT2 — favori tek kişilik, özel bir slot; artık diğer aksiyon kareleriyle aynı düz
              ağırlıkta değil, aktifken altın bir gradyan + basınca kısa bir parıltı sıçraması var. */}
          <Animated.View style={{ transform: [{ scale: favScale }] }}>
            <TouchableOpacity onPress={toggleFavorite} disabled={favBusy} activeOpacity={0.85}>
              {isFavorite ? (
                <LinearGradient
                  colors={["#FFD76A", "#c9a44c", "#9c7530"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.favBtn, { borderColor: "transparent" }]}
                >
                  <Star size={15} color="#14121a" fill="#14121a" />
                  <Text style={[styles.favBtnText, { color: "#14121a" }]}>
                    {movie.type === "Film" ? "Favori Filmin — kaldırmak için dokun" : "Favori Dizin — kaldırmak için dokun"}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.favBtn}>
                  <Star size={15} color={c.text} fill="none" />
                  <Text style={styles.favBtnText}>
                    {movie.type === "Film" ? "Favori Filmin Yap" : "Favori Dizin Yap"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {favToast && (
            <Animated.View style={[styles.favToast, { opacity: favToastOpacity }]}>
              <Star size={12} color="#14121a" fill="#14121a" />
              <Text style={styles.favToastText}>Favorin oldu!</Text>
            </Animated.View>
          )}

          <View style={styles.divider} />

          {extraLoading && <DetailExtraSkeleton />}

          {extra.trailers?.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <Text style={styles.castSectionLabel}>FRAGMANLAR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 8 }}>
                {extra.trailers.map((trailer) => (
                  <TouchableOpacity key={trailer.key} style={styles.trailerCard} activeOpacity={0.86} onPress={() => openTrailer(trailer)}>
                    <Image source={{ uri: trailer.thumbnail }} style={styles.trailerImage} />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.88)"]} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.trailerPlay}>
                      <Play size={18} color="#fff" fill="#fff" />
                    </View>
                    <View style={styles.trailerCopy}>
                      <Text style={styles.trailerTitle} numberOfLines={2}>{trailer.name}</Text>
                      <Text style={styles.trailerMeta}>{trailer.language === "tr" ? "Türkçe" : "Orijinal"} · {trailer.type === "Teaser" ? "Tanıtım" : "Fragman"}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {(extra.director || extra.cast.length > 0) && (
            <View style={{ marginTop: 18 }}>
              {extra.director && (
                <>
                  <Text style={styles.castSectionLabel}>YÖNETMEN</Text>
                  <TouchableOpacity
                    style={styles.directorCard}
                    activeOpacity={extra.director.id ? 0.7 : 1}
                    onPress={() => extra.director.id && navigation.navigate("Person", {
                      personId: extra.director.id,
                      name: extra.director.name,
                      photo: extra.director.photo,
                      role: "director",
                    })}
                  >
                    {extra.director.photo
                      ? <Image source={{ uri: extra.director.photo }} style={styles.castPhoto} />
                      : <View style={[styles.castPhoto, { backgroundColor: c.surface2 }]} />}
                    <Text style={styles.castName} numberOfLines={2}>{extra.director.name}</Text>
                    <Text style={styles.castCharacter}>Yönetmen</Text>
                  </TouchableOpacity>
                </>
              )}
              {extra.cast.length > 0 && (
                <>
                  <Text style={[styles.castSectionLabel, { marginTop: 10 }]}>OYUNCULAR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 8 }}>
                    {extra.cast.map((p, i) => (
                      <TouchableOpacity
                        key={i}
                        style={{ width: 62, alignItems: "center" }}
                        activeOpacity={p.id ? 0.7 : 1}
                        onPress={() => p.id && navigation.navigate("Person", { personId: p.id, name: p.name, photo: p.photo })}
                      >
                        {p.photo ? <Image source={{ uri: p.photo }} style={styles.castPhoto} /> : <View style={[styles.castPhoto, { backgroundColor: c.surface2 }]} />}
                        <Text style={styles.castName} numberOfLines={1}>{p.name}</Text>
                        {!!p.character && <Text style={styles.castCharacter} numberOfLines={1}>{p.character}</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          )}

          {extra.similar.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <Text style={styles.castSectionLabel}>BUNA BENZER İÇERİKLER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 8 }}>
                {extra.similar.map((m) => (
                  <TouchableOpacity key={m.id} style={{ width: 90 }} onPress={() => navigation.replace("Detail", { movie: m })}>
                    {m.poster ? <Image source={{ uri: m.poster }} style={styles.similarPoster} /> : <View style={[styles.similarPoster, { backgroundColor: c.surface2 }]} />}
                    <Text style={styles.castName} numberOfLines={1}>{m.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ marginTop: 22 }}>
            <Text style={styles.commentsTitle}>Yorumlar</Text>
            {commentsLoading ? (
              <CommentsSkeleton />
            ) : comments.length === 0 ? (
              <Text style={styles.noCommentsText}>Henüz yorum yok, ilk yorumu sen yaz.</Text>
            ) : comments.map((cm) => (
              <View key={cm.id} style={styles.commentRow}>
                <TouchableOpacity
                  onPress={() => {
                    if (Number(cm.user_id) === Number(auth.id)) navigation.navigate("MainTabs", { screen: "Profile" });
                    else navigation.navigate("OtherProfile", { userId: cm.user_id });
                  }}
                >
                  <RetryImage source={{ uri: avatarOr(cm.avatar_url, cm.user_id || cm.id) }} style={styles.commentAvatar} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentUser}>{cm.name}</Text>
                  <Text style={styles.commentText}>{cm.body}</Text>
                </View>
              </View>
            ))}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Yorum ekle"
                placeholderTextColor={c.dim}
                value={comment}
                onChangeText={setComment}
                onSubmitEditing={addComment}
                onFocus={focusCommentInput}
              />
              <TouchableOpacity style={styles.commentSendBtn} onPress={addComment}>
                <Send size={14} color={c.bg} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
          </Animated.View>
        </View>
      </Animated.View>

      {showListPicker && <ListPickerModal movie={movie} onClose={() => setShowListPicker(false)} />}
      {sendOpen && <SendToFriendModal movie={movie} onClose={() => setSendOpen(false)} />}
      <SocialPostComposer visible={postComposerOpen} initialMovie={movie} initialType="recommend" onClose={() => setPostComposerOpen(false)} />
      <TrailerPlayerModal trailer={selectedTrailer} onClose={() => setSelectedTrailer(null)} />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    backBtn: {
      position: "absolute", top: 46, left: 14, width: 34, height: 34, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", zIndex: 10,
    },
    sheetBg: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 12 },
    handleWrap: { alignItems: "center", paddingTop: 10 },
    handle: { width: 40, height: 5, borderRadius: 999, opacity: 0.5, marginBottom: 8 },
    peek: { paddingHorizontal: 18, paddingBottom: 14, width: "100%" },
    body: { paddingHorizontal: 18, paddingBottom: 30 },
    title: { fontSize: 22, fontWeight: "700", color: c.text },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 2 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, color: c.dim },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    ratingNum: { fontWeight: "800", color: c.text },
    overview: { fontSize: 13, color: c.dim, lineHeight: 20, marginTop: 14 },
    platformsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
    socialProofSection: { marginTop: 14 },
    platformPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    platformPillLogo: { width: 16, height: 16, borderRadius: 4, backgroundColor: "#fff" },
    platformPillText: { fontSize: 11, color: c.text },
    trailerCard: { width: 230, height: 130, borderRadius: 14, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    trailerImage: { width: "100%", height: "100%" },
    trailerPlay: { position: "absolute", left: "50%", top: "50%", marginLeft: -21, marginTop: -21, width: 42, height: 42, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.66)", alignItems: "center", justifyContent: "center", paddingLeft: 2 },
    trailerCopy: { position: "absolute", left: 11, right: 11, bottom: 9 },
    trailerTitle: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
    trailerMeta: { color: "rgba(255,255,255,0.72)", fontSize: 9.5, fontWeight: "700", marginTop: 2 },
    divider: { borderTopWidth: 1, borderStyle: "dashed", borderColor: c.border, marginVertical: 18 },
    castSectionLabel: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5 },
    directorCard: { width: 72, alignItems: "center", marginTop: 8 },
    castPhoto: { width: 56, height: 56, borderRadius: 999 },
    castName: { fontSize: 10, fontWeight: "700", color: c.text, marginTop: 5, textAlign: "center" },
    castCharacter: { fontSize: 9, color: c.dim, marginTop: 1, textAlign: "center" },
    similarPoster: { width: 90, height: 132, borderRadius: 10, marginBottom: 5 },
    actionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
    actionMain: {
      flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    },
    actionMainText: { fontWeight: "700", fontSize: 12, color: c.text },
    actionSquare: {
      width: 48, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
    },
    tastePostBtn: {
      marginTop: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.accent, borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 9,
    },
    tastePostTitle: { color: c.text, fontWeight: "800", fontSize: 12 },
    tastePostSub: { color: c.dim, fontSize: 10, marginTop: 2 },
    favBtn: {
      marginTop: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 11,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    },
    favBtnText: { fontWeight: "700", fontSize: 12, color: c.text },
    favToast: {
      flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", marginTop: 8,
      backgroundColor: "#FFD76A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    },
    favToastText: { fontSize: 11, fontWeight: "800", color: "#14121a" },
    listBtn: {
      marginTop: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 11,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    },
    listBtnText: { fontWeight: "700", fontSize: 12, color: c.text },
    commentsTitle: { fontWeight: "700", fontSize: 13, color: c.text, marginBottom: 10 },
    commentRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    commentAvatar: { width: 26, height: 26, borderRadius: 999, backgroundColor: c.surface2 },
    commentUser: { fontSize: 11, fontWeight: "700", color: c.text },
    commentText: { fontSize: 12, color: c.dim, marginTop: 1 },
    noCommentsText: { fontSize: 12, color: c.dim, paddingVertical: 8 },
    commentInputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    commentInput: { flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, color: c.text, fontSize: 12 },
    commentSendBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  });
}
