import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Easing, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { X, ListVideo, Send, Gamepad2, Pin } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { diaryApi } from "../api/diary";
import { platformName, platformLogo } from "../utils/platform";
import { emitLocalEvent } from "../utils/localEvents";
import SwipeableCard from "../components/SwipeableCard";
import ListPickerModal from "../components/ListPickerModal";
import SendToFriendModal from "../components/SendToFriendModal";
import SocialProofRow from "../components/SocialProofRow";
import { FONTS, upperTR } from "../theme/fonts";

const STOCK_TARGET = 10;

// DailyPosterPuzzleScreen'deki sonuç anahtarıyla AYNI — bugünün bulmacası çözüldü mü?
function todaysPuzzleResultKey() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `pellix_daily_poster_result_v2_${date}`;
}
const TASTE_MILESTONE = 5;
// Kartın yerleşimi (styles.card ile aynı sayılar) — beğenilen kartın sol üstteki duvara uçacağı
// noktayı hesaplamak için.
const CARD_TOP_OFFSET = 69;
const CARD_BOTTOM = 111;
const WALL_CENTER_X = 14 + 22;

export default function DiscoverScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const prefetchedDiscoverRef = useRef(usePrefetch().discoverQueue);
  const styles = makeStyles(c, insets);
  const topInset = Math.max(insets.top, 12) + 6;

  const [filterType, setFilterType] = useState("All");
  const [queue, setQueue] = useState([]);
  const [baseBackdrop, setBaseBackdrop] = useState(null);
  const [incomingBackdrop, setIncomingBackdrop] = useState(null);
  const backdropUriRef = useRef(null);
  const backdropGenerationRef = useRef(0);
  const backdropProgress = useRef(new Animated.Value(0)).current;
  const [shownIds, setShownIds] = useState(new Set());
  const [stockReady, setStockReady] = useState(false);
  const filterGenerationRef = useRef(0);
  const activeFilterRef = useRef("All");
  const growingRef = useRef(new Set());
  const cardRef = useRef(null);
  const [pickerMovie, setPickerMovie] = useState(null);
  const [sendMovie, setSendMovie] = useState(null);
  // Keşfet bir afiş masası: sağa atılan afiş sol üstteki "duvar"a asılıyor. Duvar bu turda
  // asılan afişleri sayıyor ve son ikisini küçük olarak gösteriyor.
  const [wallPosters, setWallPosters] = useState([]);
  const wallBump = useRef(new Animated.Value(1)).current;
  const [stageHeight, setStageHeight] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const [sessionLikes, setSessionLikes] = useState(0);
  const [sessionSkips, setSessionSkips] = useState(0);
  const [sessionGenreCounts, setSessionGenreCounts] = useState({});
  const [socialStats, setSocialStats] = useState({});
  const votedIdsPromiseRef = useRef(null);
  const watchedIdsPromiseRef = useRef(null);
  const watchedIdsRef = useRef(new Set());
  // Pellix Play'in sabit girişi (sağ üst). Bugünün Poster Puzzle'ı henüz çözülmediyse üzerinde
  // bir nokta yanıyor — ana sayfadan kaldırılınca oyunların görünür bir girişi kalmamıştı.
  const [puzzlePending, setPuzzlePending] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    AsyncStorage.getItem(todaysPuzzleResultKey())
      .then((v) => { if (active) setPuzzlePending(!v); })
      .catch(() => {});
    return () => { active = false; };
  }, []));

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

  const getWatchedIds = useCallback((force = false) => {
    if (force) watchedIdsPromiseRef.current = null;
    if (!watchedIdsPromiseRef.current) {
      watchedIdsPromiseRef.current = diaryApi.watchedIds(auth.token)
        .then((data) => {
          const ids = new Set((data.movieIds || []).map(Number).filter(Number.isFinite));
          watchedIdsRef.current = ids;
          return ids;
        })
        .catch(() => watchedIdsRef.current);
    }
    return watchedIdsPromiseRef.current;
  }, [auth.token]);

  function matchesType(m) {
    return filterType === "All" || (filterType === "Movie" ? m.type === "Film" : m.type === "Dizi");
  }

  const growQueue = useCallback(async (existingQueue, existingShown, existingFilter, generation = filterGenerationRef.current) => {
    const growKey = `${generation}:${existingFilter}`;
    if (growingRef.current.has(growKey)) return [];
    growingRef.current.add(growKey);
    try {
      const [votedIds, watchedIds] = await Promise.all([getVotedIds(), getWatchedIds()]);
      const usedIds = new Set([...existingQueue.map((m) => m.id), ...existingShown, ...votedIds, ...watchedIds]);
      const apiType = existingFilter === "Movie" ? "movie" : existingFilter === "TV Shows" ? "tv" : null;
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
  }, [auth.token, getWatchedIds]);

  const resetForFilter = useCallback(async (nextFilter) => {
    const generation = ++filterGenerationRef.current;
    activeFilterRef.current = nextFilter;
    setStockReady(false);
    setShownIds(new Set());
    setQueue([]);
    setSessionLikes(0);
    setSessionSkips(0);
    setSessionGenreCounts({});
    setWallPosters([]);
    if (nextFilter === "All" && prefetchedDiscoverRef.current && prefetchedDiscoverRef.current.length > 0) {
      const preloaded = prefetchedDiscoverRef.current;
      prefetchedDiscoverRef.current = null;
      const [votedIds, watchedIds] = await Promise.all([getVotedIds(), getWatchedIds()]);
      if (generation !== filterGenerationRef.current || activeFilterRef.current !== nextFilter) return;
      const fresh = preloaded.filter((m) => !votedIds.has(m.id) && !watchedIds.has(Number(m.id)));
      setQueue(fresh);
      setStockReady(true);
      return;
    }
    prefetchedDiscoverRef.current = null;
    const gathered = await growQueue([], new Set(), nextFilter, generation);
    if (generation !== filterGenerationRef.current || activeFilterRef.current !== nextFilter) return;
    setQueue(gathered.filter((m) => nextFilter === "All" || (nextFilter === "Movie" ? m.type === "Film" : m.type === "Dizi")));
    setStockReady(true);
  }, [growQueue, getWatchedIds]);

  useEffect(() => { resetForFilter(filterType); }, [filterType]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    getWatchedIds(true).then((ids) => {
      if (cancelled) return;
      setQueue((prev) => prev.filter((movie) => !ids.has(Number(movie.id))));
    });
    return () => { cancelled = true; };
  }, [getWatchedIds]));

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
      const nextLikeCount = sessionLikes + 1;
      setSessionLikes(nextLikeCount);

      const genre = top.genre;
      const nextGenreCounts = { ...sessionGenreCounts };
      if (genre) nextGenreCounts[genre] = (nextGenreCounts[genre] || 0) + 1;
      setSessionGenreCounts(nextGenreCounts);

      if (top.poster) setWallPosters((prev) => [...prev.slice(-1), top.poster]);
      wallBump.setValue(1.18);
      Animated.spring(wallBump, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();

      if (nextLikeCount % TASTE_MILESTONE === 0) {
        const topGenre = Object.entries(nextGenreCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        emitLocalEvent({
          type: "toast",
          title: "Seni daha iyi tanıyoruz",
          message: topGenre ? `${topGenre} şu an öne çıkıyor.` : `${nextLikeCount} yeni sinyal öğrendik.`,
        });
      }
    } else {
      setSessionSkips((v) => v + 1);
    }

    api.recordInteraction(auth.token, top.id, direction === "right" ? "like" : "skip").catch(() => {});
    replenishIfLow(rest, newShown);
  }

  const current = queue[0];
  const next = queue[1];
  const socialQueueKey = queue.slice(0, STOCK_TARGET).map((item) => item.id).join(",");

  useEffect(() => {
    const ids = socialQueueKey.split(",").map(Number).filter(Boolean);
    const missingIds = ids.filter((id) => !Object.prototype.hasOwnProperty.call(socialStats, id));
    if (missingIds.length === 0) return;
    let cancelled = false;
    api.socialStats(auth.token, missingIds).then((data) => {
      if (!cancelled) setSocialStats((prev) => ({ ...prev, ...(data.results || {}) }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [socialQueueKey, auth.token]);

  useEffect(() => {
    const poster = current?.poster;
    if (!poster || poster === backdropUriRef.current) return;
    if (!backdropUriRef.current) {
      backdropUriRef.current = poster;
      setBaseBackdrop(poster);
      return;
    }

    const generation = ++backdropGenerationRef.current;
    backdropProgress.stopAnimation();
    backdropProgress.setValue(0);
    setIncomingBackdrop(poster);

    const frame = requestAnimationFrame(() => {
      Animated.timing(backdropProgress, {
        toValue: 1,
        duration: 560,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || generation !== backdropGenerationRef.current) return;
        backdropUriRef.current = poster;
        setBaseBackdrop(poster);
        setIncomingBackdrop(null);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [current?.poster, backdropProgress]);

  return (
    <View style={styles.container} onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}>
      <View pointerEvents="none" style={styles.backdrop}>
        {!!baseBackdrop && (
          <Animated.Image
            key={`base-${baseBackdrop}`}
            source={{ uri: baseBackdrop }}
            style={[
              styles.backdropImage,
              {
                opacity: incomingBackdrop
                  ? backdropProgress.interpolate({ inputRange: [0, 1], outputRange: [0.62, 0] })
                  : 0.62,
              },
            ]}
            blurRadius={48}
            resizeMode="cover"
          />
        )}
        {!!incomingBackdrop && (
          <Animated.Image
            key={`incoming-${incomingBackdrop}`}
            source={{ uri: incomingBackdrop }}
            style={[styles.backdropImage, { opacity: backdropProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.62] }) }]}
            blurRadius={48}
            resizeMode="cover"
          />
        )}
        <LinearGradient
          colors={["rgba(13,13,16,0.42)", "rgba(13,13,16,0.18)", "rgba(13,13,16,0.68)"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      {!stockReady ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={{ color: c.dim, marginTop: 10, fontSize: 12 }}>Kartların karılıyor...</Text>
        </View>
      ) : !current ? (
        <View style={styles.center}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>Bu turu bitirdin</Text>
          {sessionLikes + sessionSkips > 0 ? (
            <Text style={{ color: c.dim, fontSize: 12.5, marginTop: 6, textAlign: "center", maxWidth: 260 }}>
              Bu turda duvarına {sessionLikes} afiş astın
              {(() => {
                const top = Object.entries(sessionGenreCounts).sort((a, b) => b[1] - a[1])[0];
                return top ? `, en çok ${top[0]} seçtin` : "";
              })()}.
            </Text>
          ) : (
            <Text style={{ color: c.dim, fontSize: 12, marginTop: 6 }}>Daha sonra tekrar bak, ya da baştan başla.</Text>
          )}
          <TouchableOpacity style={styles.restartBtn} onPress={() => resetForFilter(filterType)}>
            <Text style={styles.restartBtnText}>Baştan Göster</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.stage}>
          {Array.from({ length: Math.min(3, Math.max(0, queue.length - 2)) }, (_, k) => (
            <View key={`edge-${k}`} style={[styles.deckEdge, { left: 21 + 8 * (k + 1), right: 21 + 8 * (k + 1), bottom: CARD_BOTTOM - 4 * (k + 1), opacity: 0.85 - k * 0.22 }]} />
          ))}
          {next && (
            <View style={[styles.card, styles.cardBehind]}>
              <View style={styles.posterBox}>
                {next.poster ? <Image source={{ uri: next.poster }} style={StyleSheet.absoluteFillObject} /> : null}
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{next.title}</Text>
              </View>
            </View>
          )}
          <SwipeableCard
            key={current.id}
            ref={cardRef}
            style={styles.card}
            onSwipeLeft={() => handleSwipe("left")}
            onSwipeRight={() => handleSwipe("right")}
            rightExitTarget={() => {
              if (!stageHeight) return null;
              const cardCenterY = (topInset + CARD_TOP_OFFSET + stageHeight - CARD_BOTTOM) / 2;
              return { x: WALL_CENTER_X - windowWidth / 2, y: topInset + 22 - cardCenterY };
            }}
          >
            {(pan) => {
              const likeOpacity = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 1], extrapolate: "clamp" });
              const skipOpacity = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1, 0], extrapolate: "clamp" });
              const likeScale = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0.8, 1.08], extrapolate: "clamp" });
              const skipScale = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1.08, 0.8], extrapolate: "clamp" });
              const meta = [current.imdb ? `IMDb ${current.imdb}` : null, current.year, current.type ? upperTR(current.type) : null].filter(Boolean).join(" · ");
              return (
                <>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={styles.posterBox}
                    onPress={() => navigation.navigate("Detail", { movie: current })}
                  >
                    {current.poster ? <Image source={{ uri: current.poster }} style={StyleSheet.absoluteFillObject} /> : null}
                    <View style={styles.cardActionsCol}>
                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => setPickerMovie(current)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Listeye ekle">
                        <ListVideo size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => setSendMovie(current)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Arkadaşına gönder">
                        <Send size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Animated.View style={[styles.hintPin, { opacity: likeOpacity, transform: [{ scale: likeScale }] }]}>
                      <Pin size={14} color="#1a140b" />
                      <Text style={styles.hintPinText}>AS</Text>
                    </Animated.View>
                    <Animated.View style={[styles.hintSkip, { opacity: skipOpacity, transform: [{ scale: skipScale }] }]}>
                      <Text style={styles.hintSkipText}>GEÇ</Text>
                    </Animated.View>
                  </TouchableOpacity>

                  <View style={styles.cardInfo} pointerEvents="none">
                    <Text style={styles.cardTitle} numberOfLines={1}>{current.title}</Text>
                    {!!meta && <Text style={styles.cardMeta} numberOfLines={1}>{meta}</Text>}
                    <View style={styles.cardFooter}>
                      {Array.isArray(current.platforms) && current.platforms.length > 0 && (
                        <View style={styles.platformsRow}>
                          {current.platforms.slice(0, 4).map((p, i) => {
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
                      <View style={{ flexShrink: 1 }}>
                        <SocialProofRow stats={socialStats[current.id]} compact />
                      </View>
                    </View>
                  </View>
                </>
              );
            }}
          </SwipeableCard>
        </View>
      )}

      <View style={styles.topBar}>
        <Animated.View style={{ transform: [{ scale: wallBump }] }}>
          <TouchableOpacity
            style={styles.wall}
            onPress={() => navigation.navigate("AllLikes", { userId: auth.id, title: "Beğendiklerim" })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Duvarın: bu turda ${sessionLikes} afiş astın`}
          >
            <View style={styles.wallStack}>
              {wallPosters.length === 0 ? (
                <Pin size={16} color="rgba(255,255,255,0.7)" />
              ) : wallPosters.map((uri, i) => (
                <Image key={`${uri}-${i}`} source={{ uri }} style={[styles.wallPoster, { transform: [{ rotate: i === wallPosters.length - 1 ? "6deg" : "-12deg" }, { translateX: i === wallPosters.length - 1 ? 3 : -4 }] }]} />
              ))}
              {wallPosters.length > 0 && <View style={styles.wallPin} />}
            </View>
            <Text style={styles.wallCount}>{sessionLikes}</Text>
          </TouchableOpacity>
        </Animated.View>
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
        <TouchableOpacity
          style={styles.playBtnWrap}
          onPress={() => navigation.navigate("PellixPlay")}
          activeOpacity={0.85}
          accessibilityLabel="Pellix Play oyunları"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <View style={styles.playBtn}>
            <Gamepad2 size={18} color="#d4a94a" />
          </View>
          {puzzlePending && <View style={styles.playDot} />}
          <Text style={styles.playLabel}>Oyunlar</Text>
        </TouchableOpacity>
      </View>

      {stockReady && current && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionCircle, styles.actionSkip]} onPress={() => cardRef.current?.swipeLeft()} accessibilityRole="button" accessibilityLabel="Geç">
            <X size={24} color="#f2ede2" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCircle, { backgroundColor: c.accent }]} onPress={() => cardRef.current?.swipeRight()} accessibilityRole="button" accessibilityLabel="Duvarıma as">
            <Pin size={23} color="#1a140b" />
          </TouchableOpacity>
        </View>
      )}
      {pickerMovie && <ListPickerModal movie={pickerMovie} onClose={() => setPickerMovie(null)} />}
      {sendMovie && <SendToFriendModal movie={sendMovie} onClose={() => setSendMovie(null)} />}
    </View>
  );
}

function makeStyles(c, insets) {
  const topInset = Math.max(insets.top, 12) + 6;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backdrop: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: c.bg },
    backdropImage: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.16 }] },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    restartBtn: {
      marginTop: 20, backgroundColor: c.accent, borderRadius: 999,
      paddingHorizontal: 24, paddingVertical: 12,
    },
    restartBtnText: { color: c.bg, fontWeight: "800", fontSize: 13.5 },
    stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 21, paddingTop: topInset + 69, paddingBottom: 111 },
    card: {
      position: "absolute", top: topInset + CARD_TOP_OFFSET, bottom: CARD_BOTTOM, left: 21, right: 21,
      borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 8,
      shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6,
    },
    cardBehind: { transform: [{ translateY: 8 }, { scale: 0.95 }] },
    deckEdge: {
      position: "absolute", height: 40, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    },
    posterBox: { flex: 1, borderRadius: 13, overflow: "hidden", backgroundColor: c.surface2 },
    cardActionsCol: { position: "absolute", right: 10, bottom: 10, gap: 10, zIndex: 15 },
    cardActionBtn: {
      width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
    },
    hintPin: {
      position: "absolute", top: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: c.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    },
    hintPinText: { color: "#1a140b", fontSize: 13, fontWeight: "800" },
    hintSkip: {
      position: "absolute", top: 14, left: 14, backgroundColor: "#f2ede2",
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    },
    hintSkipText: { color: "#14121a", fontSize: 13, fontWeight: "800" },
    cardInfo: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 4 },
    cardTitle: { color: c.text, fontSize: 28, fontFamily: FONTS.marquee },
    cardMeta: { color: c.dim, fontSize: 11, fontFamily: FONTS.mono, marginTop: 2, letterSpacing: 0.3 },
    cardFooter: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, minHeight: 22 },
    platformsRow: { flexDirection: "row", gap: 5 },
    platformLogo: { width: 22, height: 22, borderRadius: 6, backgroundColor: "#fff" },
    platformFallback: { backgroundColor: c.surface2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    platformFallbackText: { fontSize: 9, color: c.text },
    topBar: { position: "absolute", top: topInset, left: 14, right: 14, flexDirection: "row", alignItems: "center" },
    pillWrap: { flex: 1, alignItems: "center" },
    playBtnWrap: { width: 46, alignItems: "center", marginRight: -4 },
    playBtn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
    playDot: { position: "absolute", top: 0, right: 3, width: 10, height: 10, borderRadius: 999, backgroundColor: c.danger, borderWidth: 1.5, borderColor: "#14121a" },
    wall: {
      height: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 5, paddingRight: 12, borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    },
    wallStack: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    wallPoster: { position: "absolute", width: 21, height: 31, borderRadius: 2, backgroundColor: "#2a2520" },
    wallPin: { position: "absolute", top: -1, width: 9, height: 9, borderRadius: 999, backgroundColor: c.danger, borderWidth: 1, borderColor: "rgba(0,0,0,0.4)" },
    wallCount: { color: "#fff", fontSize: 14, fontFamily: FONTS.monoMedium },
    playLabel: { color: "#fff", fontSize: 9, fontWeight: "800", marginTop: 3, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
    pillRow: {
      flexDirection: "row", gap: 3,
      backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: 3,
    },
    pill: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },
    pillActive: { backgroundColor: "#fff" },
    pillText: { fontSize: 13, fontWeight: "600", color: "#fff" },
    pillTextActive: { color: "#14121a" },
    actionsRow: { position: "absolute", bottom: Math.max(14, insets.bottom + 8), left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 26 },
    actionCircle: { width: 58, height: 58, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    actionSkip: { backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
  });
}
