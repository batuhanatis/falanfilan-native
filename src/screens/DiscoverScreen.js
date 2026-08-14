import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Modal, TextInput, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X, Star, ListVideo, Send, Search, Sparkles } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { platformName, platformLogo } from "../utils/platform";
import SwipeableCard from "../components/SwipeableCard";
import ListPickerModal from "../components/ListPickerModal";
import SendToFriendModal from "../components/SendToFriendModal";
import Confetti from "../components/Confetti";
import AIZone from "../components/AIZone";

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
  const growingRef = useRef(false);
  const cardRef = useRef(null);
  const [pickerMovie, setPickerMovie] = useState(null);
  const [sendMovie, setSendMovie] = useState(null);
  const [showAiTools, setShowAiTools] = useState(false);
  const [aiLabel, setAiLabel] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRequestRef = useRef(0);
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
          if (row.action === "like" || row.action === "dislike" || row.action === "skip") voted.add(row.movie_id);
        });
        return voted;
      }).catch(() => new Set());
    }
    return votedIdsPromiseRef.current;
  }

  function matchesType(m) {
    return filterType === "All" || (filterType === "Movie" ? m.type === "Film" : m.type === "Dizi");
  }

  const growQueue = useCallback(async (existingQueue, existingShown, existingFilter) => {
    if (growingRef.current) return [];
    growingRef.current = true;
    try {
      const votedIds = await getVotedIds();
      const usedIds = new Set([...existingQueue.map((m) => m.id), ...existingShown, ...votedIds]);
      const data = await api.recommendations(auth.token);
      return (data.results || [])
        .filter((m) => !usedIds.has(m.id))
        .filter((m) => existingFilter === "All" || (existingFilter === "Movie" ? m.type === "Film" : m.type === "Dizi"))
        .slice(0, Math.max(STOCK_TARGET, 18));
    } catch {
      return [];
    } finally {
      growingRef.current = false;
    }
  }, [auth.token]);

  const resetForFilter = useCallback(async (nextFilter) => {
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
      const fresh = preloaded.filter((m) => !votedIds.has(m.id));
      setQueue(fresh);
      setStockReady(true);
      return;
    }
    prefetchedDiscoverRef.current = null;
    const gathered = await growQueue([], new Set(), nextFilter);
    setQueue(gathered);
    setStockReady(true);
  }, [growQueue]);

  useEffect(() => { resetForFilter(filterType); }, [filterType]);

  async function replenishIfLow(restQueue, newShown) {
    if (restQueue.length >= STOCK_TARGET) return;
    const gathered = await growQueue(restQueue, newShown, filterType);
    if (gathered.length > 0) setQueue((prev) => [...prev, ...gathered]);
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

  async function runSearch(queryOverride = null, requestId = null) {
    const q = String(queryOverride ?? searchQuery).trim();
    const activeRequestId = requestId ?? ++searchRequestRef.current;
    if (q.length < 2) {
      if (activeRequestId === searchRequestRef.current) {
        setSearchResults([]);
        setSearchLoading(false);
      }
      return;
    }
    setSearchLoading(true);
    try {
      const [movies, shows] = await Promise.all([
        api.search(auth.token, q, "movie"),
        api.search(auth.token, q, "tv"),
      ]);
      if (activeRequestId !== searchRequestRef.current) return;
      const seen = new Set();
      setSearchResults([...(movies.results || []), ...(shows.results || [])].filter((item) => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).slice(0, 30));
    } catch {
      if (activeRequestId === searchRequestRef.current) setSearchResults([]);
    } finally {
      if (activeRequestId === searchRequestRef.current) setSearchLoading(false);
    }
  }

  useEffect(() => {
    // Kullanıcı yazmayı kısa süre bıraktığında otomatik ara. Yeni sorgu geldiği anda
    // önceki isteği mantıksal olarak geçersiz kılıyoruz; geç dönen eski sonuçlar ekrana sızmıyor.
    const requestId = ++searchRequestRef.current;
    if (!showSearch) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = setTimeout(() => runSearch(q, requestId), 350);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, auth.token]);

  async function applyAiResults(results, label = "AI seçimi") {
    const voted = await getVotedIds();
    const fresh = (results || []).filter((m) => !voted.has(m.id) && matchesType(m));
    setShownIds(new Set());
    setQueue(fresh);
    setStockReady(true);
    setAiLabel(label || "AI seçimi");
    setShowAiTools(false);
  }

  function clearAiResults() {
    setAiLabel(null);
    resetForFilter(filterType);
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
          <Text style={{ color: c.dim, marginTop: 10, fontSize: 12 }}>Öneri motorun sana özel kartları hazırlıyor...</Text>
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
            <Text style={{ color: c.dim, fontSize: 12, marginTop: 6 }}>Zevkin geliştikçe yeni öneriler burada belirecek.</Text>
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
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowSearch(true)}>
          <Search size={18} color="#fff" />
        </TouchableOpacity>
        <View style={styles.pillWrap}>
          <View style={styles.pillRow}>
            {[["All", "Tümü"], ["Movie", "Film"], ["TV Shows", "Dizi"]].map(([id, label]) => (
              <TouchableOpacity
                key={id}
                onPress={() => { setAiLabel(null); setFilterType(id); }}
                style={[styles.pill, filterType === id && styles.pillActive]}
              >
                <Text style={[styles.pillText, filterType === id && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowAiTools(true)}>
          <Sparkles size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {!!aiLabel && (
        <TouchableOpacity style={styles.aiResultBadge} onPress={clearAiResults}>
          <Sparkles size={12} color="#fff" />
          <Text style={styles.aiResultBadgeText} numberOfLines={1}>{aiLabel}</Text>
          <X size={12} color="#fff" />
        </TouchableOpacity>
      )}

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
      <Modal visible={showSearch} transparent animationType="fade" onRequestClose={() => setShowSearch(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSearch(false)} />
          <View style={styles.searchSheet}>
            <View style={styles.searchHeader}>
              <Text style={styles.modalTitle}>İçerik ara</Text>
              <TouchableOpacity onPress={() => setShowSearch(false)}><X size={18} color={c.text} /></TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Search size={16} color={c.dim} />
              <TextInput
                style={styles.searchInput}
                placeholder="Film veya dizi ara..."
                placeholderTextColor={c.dim}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={runSearch}
                returnKeyType="search"
                autoFocus
              />
              {searchLoading && <ActivityIndicator size="small" color={c.accent} />}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultRow} onPress={() => { setShowSearch(false); navigation.navigate("Detail", { movie: item }); }}>
                  {item.poster ? <Image source={{ uri: item.poster }} style={styles.searchResultPoster} /> : <View style={[styles.searchResultPoster, { backgroundColor: c.surface2 }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.searchResultMeta}>{item.type} {item.year ? `· ${item.year}` : ""}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={searchQuery.trim().length >= 2 && !searchLoading ? <Text style={styles.searchEmpty}>Sonuç bulunamadı.</Text> : null}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showAiTools} transparent animationType="fade" onRequestClose={() => setShowAiTools(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAiTools(false)} />
          <View style={styles.aiSheet}>
            <View style={styles.searchHeader}>
              <View>
                <Text style={styles.modalTitle}>Yapay Zeka Köşesi</Text>
                <Text style={styles.modalSub}>İçerik keşfinin içinde, tam olması gereken yerde.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiTools(false)}><X size={18} color={c.text} /></TouchableOpacity>
            </View>
            <AIZone
              navigation={navigation}
              defaultOpen
              hasResults={!!aiLabel}
              onResults={applyAiResults}
              onClear={clearAiResults}
            />
          </View>
        </View>
      </Modal>

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
    toolBtn: {
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
    aiResultBadge: { position: "absolute", top: 90, alignSelf: "center", maxWidth: "78%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(109,40,217,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, zIndex: 30 },
    aiResultBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800", flexShrink: 1 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    searchSheet: { height: "72%", backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, borderWidth: 1, borderColor: c.border },
    aiSheet: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 30, borderWidth: 1, borderColor: c.border },
    searchHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    modalTitle: { color: c.text, fontWeight: "900", fontSize: 17 },
    modalSub: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    searchBox: { minHeight: 44, borderRadius: 13, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 },
    searchInput: { flex: 1, color: c.text, fontSize: 13 },
    searchResultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    searchResultPoster: { width: 42, height: 62, borderRadius: 7 },
    searchResultTitle: { color: c.text, fontWeight: "800", fontSize: 12.5 },
    searchResultMeta: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    searchEmpty: { color: c.dim, textAlign: "center", fontSize: 11, marginTop: 24 },
  });
}
