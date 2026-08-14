import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Heart, X, Star, ListVideo, Send } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { platformName, platformLogo } from "../utils/platform";
import SwipeableCard from "../components/SwipeableCard";
import ListPickerModal from "../components/ListPickerModal";
import SendToFriendModal from "../components/SendToFriendModal";
import Confetti from "../components/Confetti";

const STOCK_TARGET = 10;

export default function DiscoverScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  // Uygulama açılır açılmaz arka planda toplanmış bir kuyruk varsa (bkz. PrefetchContext),
  // "Hepsi" filtresine ilk girişte onu kullanıyoruz — kullanıcı hiç beklemeden kaydırmaya
  // başlayabiliyor. Ref'te tutuyoruz ki context sonradan güncellense bile SADECE bir kez,
  // sadece mount anındaki değeri kullanalım (kullanıcı filtre değiştirdikten sonra tekrar
  // devreye girip mevcut listeyi bozmasın).
  const prefetchedDiscoverRef = useRef(usePrefetch().discoverQueue);
  const styles = makeStyles(c);

  const [filterType, setFilterType] = useState("All"); // All | Movie | TV Shows
  const [queue, setQueue] = useState([]);
  const [shownIds, setShownIds] = useState(new Set());
  const [stockReady, setStockReady] = useState(false);
  const filterGenerationRef = useRef(0);
  const activeFilterRef = useRef("All");
  const growingRef = useRef(new Set());
  const cardRef = useRef(null);
  const [pickerMovie, setPickerMovie] = useState(null);
  const [sendMovie, setSendMovie] = useState(null);
  // DC3/DC4 — beğenince küçük bir konfeti patlaması + bu turda ne kadar beğenip/geçtiğini ve
  // en çok hangi türü seçtiğini tutan bir oturum özeti (deste tükenince gösteriliyor).
  const [likeBurstKey, setLikeBurstKey] = useState(0);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const [sessionLikes, setSessionLikes] = useState(0);
  const [sessionSkips, setSessionSkips] = useState(0);
  const [sessionGenreCounts, setSessionGenreCounts] = useState({});
  // Daha önce like/dislike/skip ile "oy verilmiş" içerikler — Discover kuyruğuna hiç girmesinler.
  // Promise'i ref'te önbelleğe alıyoruz: growQueue her çağrıldığında bunu BEKLİYOR, bu yüzden
  // interactions isteği henüz bitmeden ilk kuyruk oluşturulursa bile oy verilenler sızmıyor.
  const votedIdsPromiseRef = useRef(null);
  function getVotedIds() {
    if (!votedIdsPromiseRef.current) {
      votedIdsPromiseRef.current = api.interactions(auth.token).then((data) => {
        const voted = new Set();
        (data.results || []).forEach((row) => {
          if (row.action === "like" || row.action === "dislike") voted.add(row.movie_id);
        });
        return voted;
      }).catch(() => new Set());
    }
    return votedIdsPromiseRef.current;
  }

  function matchesType(m) {
    return filterType === "All" || (filterType === "Movie" ? m.type === "Film" : m.type === "Dizi");
  }

  const growQueue = useCallback(async (existingQueue, existingShown, existingFilter, generation = filterGenerationRef.current) => {
    const growKey = `${generation}:${existingFilter}`;
    if (growingRef.current.has(growKey)) return [];
    growingRef.current.add(growKey);
    try {
      const votedIds = await getVotedIds();
      const usedIds = new Set([...existingQueue.map((m) => m.id), ...existingShown, ...votedIds]);
      const apiType = existingFilter === "Movie" ? "movie" : existingFilter === "TV Shows" ? "tv" : null;

      // Taste Engine geniş cache havuzunu kullanıcının gerçek like/dislike geçmişine göre sıralıyor.
      // 120 kart istiyoruz; ekranda kullanılanlar tekrar elendikten sonra da stok hızla tükenmesin.
      const data = await api.recommendations(auth.token, apiType, 120);
      if (generation !== filterGenerationRef.current || activeFilterRef.current !== existingFilter) return [];

      return (data.results || [])
        .filter((m) => !usedIds.has(m.id))
        .map((m) => existingFilter === "Movie"
          ? { ...m, type: "Film" }
          : existingFilter === "TV Shows"
            ? { ...m, type: "Dizi" }
            : m)
        .filter((m) => existingFilter === "All" || (existingFilter === "Movie" ? m.type === "Film" : m.type === "Dizi"));
    } catch {
      return [];
    } finally {
      growingRef.current.delete(growKey);
    }
  }, [auth.token]);

  const resetForFilter = useCallback(async (nextFilter) => {
    const generation = ++filterGenerationRef.current;
    activeFilterRef.current = nextFilter;
    setStockReady(false);
    setShownIds(new Set());
    setQueue([]);
    setSessionLikes(0);
    setSessionSkips(0);
    setSessionGenreCounts({});
    // Önden yüklenmiş bir kuyruk varsa (sadece "Hepsi" filtresi için geçerli, sadece bir kez)
    // direkt onu kullan — ağa hiç istek atmadan anında hazır.
    if (nextFilter === "All" && prefetchedDiscoverRef.current && prefetchedDiscoverRef.current.length > 0) {
      const preloaded = prefetchedDiscoverRef.current;
      prefetchedDiscoverRef.current = null;
      // ÖNEMLİ DÜZELTME: Bu kuyruk uygulama açılışında, kullanıcı henüz hiçbir şey
      // beğenmemişken önceden hazırlanmış olabilir — Discover'a gelmeden önce Home'da bir film
      // beğenmişse, o film hâlâ bu bayat kuyrukta kalıp "az önce beğendim, neden yine çıktı?"
      // hissi yaratıyordu. Göstermeden hemen önce GÜNCEL oy verilenler listesiyle bir kez daha filtreliyoruz.
      const votedIds = await getVotedIds();
      if (generation !== filterGenerationRef.current || activeFilterRef.current !== nextFilter) return;
      const fresh = preloaded.filter((m) => !votedIds.has(m.id));
      setQueue(fresh);
      setStockReady(true);
      return;
    }
    prefetchedDiscoverRef.current = null;
    const gathered = await growQueue([], new Set(), nextFilter, generation);
    if (generation !== filterGenerationRef.current || activeFilterRef.current !== nextFilter) return;
    setQueue(gathered.filter((m) => nextFilter === "All" || (nextFilter === "Movie" ? m.type === "Film" : m.type === "Dizi")));
    setStockReady(true);
  }, [growQueue]);

  useEffect(() => { resetForFilter(filterType); }, [filterType]);

  // Sıradaki kartların ağır oyuncu/benzer verisini kullanıcı dokunmadan arka planda hazırla.
  // api katmanı aynı içerik için tekrar ve paralel istekleri otomatik olarak tekilleştirir.
  useEffect(() => {
    queue.slice(0, 3).forEach((movie) => api.prefetchMovieExtra(auth.token, movie.id));
  }, [queue, auth.token]);

  async function replenishIfLow(restQueue, newShown) {
    if (restQueue.length >= STOCK_TARGET) return;
    const expectedFilter = filterType;
    const generation = filterGenerationRef.current;
    const gathered = await growQueue(restQueue, newShown, expectedFilter, generation);
    if (generation !== filterGenerationRef.current || activeFilterRef.current !== expectedFilter) return;
    if (gathered.length > 0) {
      setQueue((prev) => {
        const validPrev = prev.filter((m) => expectedFilter === "All" || (expectedFilter === "Movie" ? m.type === "Film" : m.type === "Dizi"));
        const seen = new Set(validPrev.map((m) => m.id));
        const validNew = gathered.filter((m) => !seen.has(m.id) && (expectedFilter === "All" || (expectedFilter === "Movie" ? m.type === "Film" : m.type === "Dizi")));
        return [...validPrev, ...validNew];
      });
    }
  }

  function handleSwipe(direction) {
    const top = queue[0];
    if (!top) return;
    const rest = queue.slice(1);
    const newShown = new Set(shownIds); newShown.add(top.id);
    setShownIds(newShown);
    setQueue(rest);

    if (direction === "right") {
      setSessionLikes((v) => v + 1);
      const genre = top.genre;
      if (genre) setSessionGenreCounts((prev) => ({ ...prev, [genre]: (prev[genre] || 0) + 1 }));
      // DC3 — beğenilen her içerikte küçük bir konfeti patlaması; başarılı bir swipe artık
      // sadece bir kartın kaybolması değil, hafif bir ödül anı.
      setLikeBurstKey((k) => k + 1);
      setShowLikeBurst(true);
      setTimeout(() => setShowLikeBurst(false), 900);
    } else {
      setSessionSkips((v) => v + 1);
    }

    api.recordInteraction(auth.token, top.id, direction === "right" ? "like" : "skip").catch(() => {});
    replenishIfLow(rest, newShown);
  }

  const current = queue[0];
  const next = queue[1];

  return (
    <View style={styles.container}>
      {!stockReady ? (
        // DC5 — Home'daki AYNI "İçerikler hazırlanıyor..." metni kullanılıyordu; Discover kendi
        // sesine kavuştu (kaydırma/keşif temalı).
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={{ color: c.dim, marginTop: 10, fontSize: 12 }}>Kartların karılıyor...</Text>
        </View>
      ) : !current ? (
        <View style={styles.center}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>Bu turu bitirdin</Text>
          {/* DC4 — deste tükenince artık sessizce "içerik kalmadı" demek yerine bu turda ne
              yapıldığına dair küçük bir özet gösteriyoruz; sıfırdan bir şey görmemiş de olsa
              (ör. filtre değişince anında biten deste) 0'lı bir özetle garip durmasın diye
              sadece en az bir swipe yapılmışsa gösteriliyor. */}
          {sessionLikes + sessionSkips > 0 ? (
            <Text style={{ color: c.dim, fontSize: 12.5, marginTop: 6, textAlign: "center", maxWidth: 260 }}>
              Bu turda {sessionLikes} şey beğendin
              {(() => {
                const top = Object.entries(sessionGenreCounts).sort((a, b) => b[1] - a[1])[0];
                return top ? `, en çok ${top[0]} seçtin` : "";
              })()}.
            </Text>
          ) : (
            <Text style={{ color: c.dim, fontSize: 12, marginTop: 6 }}>Daha sonra tekrar bak, ya da baştan başla.</Text>
          )}
          {/* ÖNEMLİ: resetForFilter, o an seçili filtreyi (Hepsi/Film/Dizi) koruyarak
              "gösterilenler" listesini sıfırlayıp yeniden dolduruyor — hangi filtre aktifken
              içerik biterse bitsin (sadece "Hepsi" değil) çalışıyor. */}
          <TouchableOpacity style={styles.restartBtn} onPress={() => resetForFilter(filterType)}>
            <Text style={styles.restartBtnText}>Baştan Göster</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.stage}>
          {showLikeBurst && <Confetti key={likeBurstKey} count={16} spread={280} fast />}
          {next && (
            <View style={[styles.card, styles.cardBehind]}>
              <Image source={{ uri: next.poster }} style={StyleSheet.absoluteFillObject} />
            </View>
          )}
          {/* key={current.id} ÇOK ÖNEMLİ: her yeni kart için React'in bileşeni SIFIRDAN
              kurmasını sağlar, böylece konum/animasyon değeri her zaman temiz başlar. */}
          <SwipeableCard
            key={current.id}
            ref={cardRef}
            style={styles.card}
            onSwipeLeft={() => handleSwipe("left")}
            onSwipeRight={() => handleSwipe("right")}
          >
            {(pan) => {
              const likeOpacity = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 1], extrapolate: "clamp" });
              const skipOpacity = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1, 0], extrapolate: "clamp" });
              // DC2 — damgalar eskiden sadece solup beliriyordu, hiç "sıçramıyordu". Artık
              // eşiğe yaklaştıkça büyüyerek (0.7 → 1.15) hafif bir pop efektiyle beliriyor.
              const likeScale = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0.7, 1.15], extrapolate: "clamp" });
              const skipScale = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1.15, 0.7], extrapolate: "clamp" });
              return (
                <>
                  {/* Sağ üstteki ayrı "üç nokta" butonu kaldırıldı — Detay'a gitme artık doğrudan
                      görselin kendisine dokununca oluyor. Sürükleyerek kaydırmayla ÇAKIŞMIYOR:
                      SwipeableCard'ın PanResponder'ı sadece 6px'ten fazla hareket olunca jesti
                      "alıyor" (onMoveShouldSetPanResponder), düz bir dokunuşta hiç devreye
                      girmiyor — bu yüzden altındaki TouchableOpacity'nin onPress'i normal çalışıyor. */}
                  <TouchableOpacity
                    activeOpacity={1}
                    style={StyleSheet.absoluteFillObject}
                    onPress={() => navigation.navigate("Detail", { movie: current })}
                  >
                    <Image source={{ uri: current.poster }} style={StyleSheet.absoluteFillObject} />
                  </TouchableOpacity>
                  <LinearGradient colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0)"]} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

                  {/* Paylaş ve Bir Listeye Ekle — artık menüde değil, kartın sağ altında ayrı
                      ayrı, doğrudan tıklanabilir butonlar. */}
                  <View style={styles.cardActionsCol}>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => setPickerMovie(current)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <ListVideo size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => setSendMovie(current)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Send size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <Animated.View style={[styles.stampLike, { opacity: likeOpacity, transform: [{ rotate: "-12deg" }, { scale: likeScale }] }]}>
                    <Text style={styles.stampLikeText}>EKLE</Text>
                  </Animated.View>
                  <Animated.View style={[styles.stampSkip, { opacity: skipOpacity, transform: [{ rotate: "12deg" }, { scale: skipScale }] }]}>
                    <Text style={styles.stampSkipText}>GEÇ</Text>
                  </Animated.View>

                  <View style={styles.cardInfo} pointerEvents="none">
                    <Text style={styles.cardTitle} numberOfLines={1}>{current.title}</Text>
                    <View style={styles.cardMetaRow}>
                      <Star size={11} color={c.accent} fill={c.accent} />
                      <Text style={styles.cardMeta}>{current.imdb} · {current.year} · {current.type}</Text>
                    </View>
                    {Array.isArray(current.platforms) && current.platforms.length > 0 && (
                      <View style={styles.platformsRow}>
                        {current.platforms.slice(0, 5).map((p, i) => {
                          const logo = platformLogo(p);
                          const name = platformName(p);
                          return logo ? (
                            <Image key={i} source={{ uri: logo }} style={styles.platformLogo} />
                          ) : (
                            <View key={i} style={styles.platformFallback}>
                              <Text style={styles.platformFallbackText} numberOfLines={1}>{name}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </>
              );
            }}
          </SwipeableCard>
        </View>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.pillWrap}>
          <View style={styles.pillRow}>
            {[["All", "Tümü"], ["Movie", "Film"], ["TV Shows", "Dizi"]].map(([id, label]) => (
              <TouchableOpacity
                key={id}
                onPress={() => setFilterType(id)}
                style={[styles.pill, filterType === id && styles.pillActive]}
              >
                <Text style={[styles.pillText, filterType === id && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {stockReady && current && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionCircle, { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" }]} onPress={() => cardRef.current?.swipeLeft()}>
            <X size={24} color={c.danger} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCircle, { backgroundColor: c.accent2 }]} onPress={() => cardRef.current?.swipeRight()}>
            <Heart size={24} color="#fff" fill="#fff" />
          </TouchableOpacity>
        </View>
      )}
      {pickerMovie && <ListPickerModal movie={pickerMovie} onClose={() => setPickerMovie(null)} />}
      {sendMovie && <SendToFriendModal movie={sendMovie} onClose={() => setSendMovie(null)} />}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    restartBtn: {
      marginTop: 20, backgroundColor: c.accent, borderRadius: 999,
      paddingHorizontal: 24, paddingVertical: 12,
    },
    restartBtnText: { color: c.bg, fontWeight: "800", fontSize: 13.5 },
    stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingTop: 104, paddingBottom: 92 },
    card: {
      position: "absolute", top: 104, bottom: 92, left: 10, right: 10,
      borderRadius: 22, overflow: "hidden", backgroundColor: c.surface2,
    },
    cardBehind: { transform: [{ scale: 0.96 }] },
    // ÖNEMLİ: Kartın GERÇEKTEN sağ alt köşesinde dursun diye cardInfo'yla (bottom:14) aynı
    // hizaya indirdik — eskiden "bottom: 82" ile gereğinden çok yukarıda kalıyordu.
    cardActionsCol: { position: "absolute", right: 14, bottom: 14, gap: 10, zIndex: 15 },
    cardActionBtn: {
      width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
    },
    // Rotate artık burada değil — DC2 sıçrama efekti için scale ile birlikte JSX'te inline
    // veriliyor (aynı "transform" anahtarı olduğu için ikisi ayrı yerde tutulamıyor).
    stampLike: {
      position: "absolute", top: 24, left: 20, borderWidth: 3, borderColor: c.accent2,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
    },
    stampLikeText: { color: c.accent2, fontWeight: "800", fontSize: 18 },
    stampSkip: {
      position: "absolute", top: 24, right: 20, borderWidth: 3, borderColor: c.danger,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
    },
    stampSkipText: { color: c.danger, fontWeight: "800", fontSize: 18 },
    cardInfo: { position: "absolute", left: 16, right: 16, bottom: 14 },
    cardTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
    cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    cardMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
    platformsRow: { flexDirection: "row", gap: 5, marginTop: 8, flexWrap: "wrap" },
    platformLogo: { width: 22, height: 22, borderRadius: 6, backgroundColor: "#fff" },
    platformFallback: { backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    platformFallbackText: { fontSize: 9, color: "#fff" },
    topBar: { position: "absolute", top: 44, left: 14, right: 14, flexDirection: "row", alignItems: "center" },
    backBtn: {
      width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
    },
    pillWrap: { flex: 1, alignItems: "center" },
    pillRow: {
      flexDirection: "row", gap: 3,
      backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: 3,
    },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    pillActive: { backgroundColor: "#fff" },
    pillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    pillTextActive: { color: "#14121a" },
    actionsRow: { position: "absolute", bottom: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 26 },
    actionCircle: { width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  });
}
