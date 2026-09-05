import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X, Star, ListVideo, Send } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { platformName, platformLogo } from "../utils/platform";
import { emitLocalEvent } from "../utils/localEvents";
import SwipeableCard from "../components/SwipeableCard";
import ListPickerModal from "../components/ListPickerModal";
import SendToFriendModal from "../components/SendToFriendModal";
import Confetti from "../components/Confetti";
import SocialProofRow from "../components/SocialProofRow";

const STOCK_TARGET = 10;
const TASTE_MILESTONE = 5;

export default function DiscoverScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const prefetchedDiscoverRef = useRef(usePrefetch().discoverQueue);
  const styles = makeStyles(c, insets);

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
  const [likeBurstKey, setLikeBurstKey] = useState(0);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const [sessionLikes, setSessionLikes] = useState(0);
  const [sessionSkips, setSessionSkips] = useState(0);
  const [sessionGenreCounts, setSessionGenreCounts] = useState({});
  const [socialStats, setSocialStats] = useState({});
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
    if (nextFilter === "All" && prefetchedDiscoverRef.current && prefetchedDiscoverRef.current.length > 0) {
      const preloaded = prefetchedDiscoverRef.current;
      prefetchedDiscoverRef.current = null;
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

      if (nextLikeCount % TASTE_MILESTONE === 0) {
        setLikeBurstKey((k) => k + 1);
        setShowLikeBurst(true);
        setTimeout(() => setShowLikeBurst(false), 900);
        const topGenre = Object.entries(nextGenreCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        emitLocalEvent({
          type: "toast",
          title: "Zevkin netleşiyor ✨",
          message: topGenre ? `${topGenre} tercihin şu anda öne çıkıyor.` : `${nextLikeCount} yeni zevk sinyali öğrendik.`,
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
    <View style={styles.container}>
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
              Bu turda {sessionLikes} içeriği zevkine göre işaretledin
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
          {showLikeBurst && <Confetti key={likeBurstKey} count={16} spread={280} fast />}
          {next && (
            <View style={[styles.card, styles.cardBehind]}>
              <Image source={{ uri: next.poster }} style={StyleSheet.absoluteFillObject} />
            </View>
          )}
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
              const likeScale = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0.7, 1.15], extrapolate: "clamp" });
              const skipScale = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1.15, 0.7], extrapolate: "clamp" });
              return (
                <>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={StyleSheet.absoluteFillObject}
                    onPress={() => navigation.navigate("Detail", { movie: current })}
                  >
                    <Image source={{ uri: current.poster }} style={StyleSheet.absoluteFillObject} />
                  </TouchableOpacity>
                  <LinearGradient colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0)"]} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

                  <View style={styles.cardActionsCol}>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => setPickerMovie(current)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <ListVideo size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => setSendMovie(current)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Send size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <Animated.View style={[styles.stampLike, { opacity: likeOpacity, transform: [{ rotate: "-12deg" }, { scale: likeScale }] }]}>
                    <Text style={styles.stampLikeText}>ZEVKİME GÖRE</Text>
                  </Animated.View>
                  <Animated.View style={[styles.stampSkip, { opacity: skipOpacity, transform: [{ rotate: "12deg" }, { scale: skipScale }] }]}>
                    <Text style={styles.stampSkipText}>GEÇ</Text>
                  </Animated.View>

                  <View style={styles.cardInfo} pointerEvents="none">
                    <View style={styles.socialProofWrap}>
                      <SocialProofRow stats={socialStats[current.id]} overlay compact />
                    </View>
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
        <View style={{ width: 38 }} />
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
      position: "absolute", top: topInset + 69, bottom: 111, left: 21, right: 21,
      borderRadius: 22, overflow: "hidden", backgroundColor: "rgba(13,13,16,0.55)",
    },
    cardBehind: { transform: [{ scale: 0.96 }] },
    cardActionsCol: { position: "absolute", right: 14, bottom: 14, gap: 10, zIndex: 15 },
    cardActionBtn: {
      width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
    },
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
    socialProofWrap: { marginBottom: 9, paddingRight: 54 },
    cardTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
    cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    cardMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
    platformsRow: { flexDirection: "row", gap: 5, marginTop: 8, flexWrap: "wrap" },
    platformLogo: { width: 22, height: 22, borderRadius: 6, backgroundColor: "#fff" },
    platformFallback: { backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    platformFallbackText: { fontSize: 9, color: "#fff" },
    topBar: { position: "absolute", top: topInset, left: 14, right: 14, flexDirection: "row", alignItems: "center" },
    pillWrap: { flex: 1, alignItems: "center" },
    pillRow: {
      flexDirection: "row", gap: 3,
      backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: 3,
    },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    pillActive: { backgroundColor: "#fff" },
    pillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    pillTextActive: { color: "#14121a" },
    actionsRow: { position: "absolute", bottom: Math.max(14, insets.bottom + 8), left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 26 },
    actionCircle: { width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  });
}
