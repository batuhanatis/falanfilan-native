import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, Animated, PanResponder } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Film, Tv, Clock, Star, Heart, X, Bookmark, Send, ListVideo } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { platformName, platformLogo } from "../utils/platform";
import ListPickerModal from "../components/ListPickerModal";
import SendToFriendModal from "../components/SendToFriendModal";

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
  const [inWatchlist, setInWatchlist] = useState(false);
  const [favMovieId, setFavMovieId] = useState(null);
  const [favShowId, setFavShowId] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([{ user: "Elif Kaya", text: "Finali gerçekten çok etkileyiciydi." }]);

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
        else if (row.action === "watchlist") setInWatchlist(true);
      });
    }).catch(() => {});
    api.me(auth.token).then((me) => {
      setFavMovieId(me.favoriteMovie?.id || null);
      setFavShowId(me.favoriteShow?.id || null);
    }).catch(() => {});
  }, []);

  const isFavorite = movie.type === "Film" ? favMovieId === movie.id : favShowId === movie.id;

  function like() {
    const wasLiked = liked;
    setLiked((v) => !v); setDisliked(false);
    if (wasLiked) api.removeInteraction(auth.token, movie.id, "like").catch(() => {});
    else api.recordInteraction(auth.token, movie.id, "like").catch(() => {});
  }
  function dislike() {
    const wasDisliked = disliked;
    setDisliked((v) => !v); setLiked(false);
    if (wasDisliked) api.removeInteraction(auth.token, movie.id, "dislike").catch(() => {});
    else api.recordInteraction(auth.token, movie.id, "dislike").catch(() => {});
  }
  function watch() {
    const wasInWatchlist = inWatchlist;
    setInWatchlist((v) => !v);
    if (wasInWatchlist) api.removeInteraction(auth.token, movie.id, "watchlist").catch(() => {});
    else api.recordInteraction(auth.token, movie.id, "watchlist").catch(() => {});
  }

  async function toggleFavorite() {
    if (favBusy) return;
    setFavBusy(true);
    try {
      await api.updateFavorite(auth.token, isFavorite ? { movie_id: null, type: movie.type } : { movie_id: movie.id });
      if (movie.type === "Film") setFavMovieId(isFavorite ? null : movie.id);
      else setFavShowId(isFavorite ? null : movie.id);
    } catch { /* sessizce geç */ }
    setFavBusy(false);
  }

  function addComment() {
    if (!comment.trim()) return;
    setComments((cs) => [...cs, { user: auth.name, text: comment.trim() }]);
    setComment("");
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
            <View style={[styles.handle, { backgroundColor: c.dim }]} />
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
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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

          <View style={styles.divider} />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionMain, liked && { backgroundColor: c.accent2, borderColor: c.accent2 }]} onPress={like}>
              <Heart size={16} color={liked ? "#fff" : c.text} fill={liked ? "#fff" : "none"} />
              <Text style={[styles.actionMainText, liked && { color: "#fff" }]}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionMain, disliked && { backgroundColor: c.danger, borderColor: c.danger }]} onPress={dislike}>
              <X size={16} color={disliked ? "#fff" : c.text} />
              <Text style={[styles.actionMainText, disliked && { color: "#fff" }]}>Dislike</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionSquare, inWatchlist && { backgroundColor: c.accent, borderColor: c.accent }]} onPress={watch}>
              <Bookmark size={16} color={inWatchlist ? c.bg : c.text} fill={inWatchlist ? c.bg : "none"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSquare} onPress={() => setSendOpen(true)}>
              <Send size={16} color={c.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.favBtn, isFavorite && { backgroundColor: c.accent, borderColor: "transparent" }]}
            onPress={toggleFavorite}
            disabled={favBusy}
          >
            <Star size={15} color={isFavorite ? "#14121a" : c.text} fill={isFavorite ? "#14121a" : "none"} />
            <Text style={[styles.favBtnText, isFavorite && { color: "#14121a" }]}>
              {isFavorite
                ? (movie.type === "Film" ? "Favori Filmin — kaldırmak için dokun" : "Favori Dizin — kaldırmak için dokun")
                : (movie.type === "Film" ? "Favori Filmin Yap" : "Favori Dizin Yap")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.listBtn} onPress={() => setShowListPicker(true)}>
            <ListVideo size={15} color={c.text} />
            <Text style={styles.listBtnText}>Bir Listeye Ekle</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 22 }}>
            <Text style={styles.commentsTitle}>Yorumlar</Text>
            {comments.map((cm, i) => (
              <View key={i} style={styles.commentRow}>
                <View style={styles.commentAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentUser}>{cm.user}</Text>
                  <Text style={styles.commentText}>{cm.text}</Text>
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
    platformPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    platformPillLogo: { width: 16, height: 16, borderRadius: 4, backgroundColor: "#fff" },
    platformPillText: { fontSize: 11, color: c.text },
    divider: { borderTopWidth: 1, borderStyle: "dashed", borderColor: c.border, marginVertical: 18 },
    actionsRow: { flexDirection: "row", gap: 10 },
    actionMain: {
      flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    },
    actionMainText: { fontWeight: "700", fontSize: 12, color: c.text },
    actionSquare: {
      width: 48, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
    },
    favBtn: {
      marginTop: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 11,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    },
    favBtnText: { fontWeight: "700", fontSize: 12, color: c.text },
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
    commentInputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    commentInput: { flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, color: c.text, fontSize: 12 },
    commentSendBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  });
}
