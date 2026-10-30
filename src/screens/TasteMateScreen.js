import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Heart, X, Users, PartyPopper } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { emitLocalEvent } from "../utils/localEvents";
import { hapticSuccess } from "../utils/haptics";
import SwipeableCard from "../components/SwipeableCard";
import RetryImage from "../components/RetryImage";
import Confetti from "../components/Confetti";

function matchRingColor(pct, c) {
  if (pct >= 85) return "#FFD700";
  if (pct >= 60) return c.accent;
  if (pct >= 40) return c.accent2;
  return c.border;
}

function matchSummary(pct) {
  if (pct >= 90) return "Neredeyse aynı zevk";
  if (pct >= 80) return "Çok güçlü zevk uyumu";
  if (pct >= 65) return "Güçlü zevk uyumu";
  if (pct >= 50) return "Ortak noktanız bol";
  return "Keşfedilecek ortaklıklar var";
}

export default function TasteMateScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [mates, setMates] = useState([]);
  const [limitReached, setLimitReached] = useState(false);
  const [index, setIndex] = useState(0);
  const cardRef = useRef(null);
  const [mutualMatch, setMutualMatch] = useState(null);
  const prefetched = useRef(usePrefetch().tasteMates).current;

  useEffect(() => {
    if (prefetched) {
      setMates(prefetched.results || []);
      setLoading(false);
      return;
    }
    api.tastemates(auth.token)
      .then((data) => { setMates(data.results || []); })
      .catch(() => setMates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      if (!limitReached) return;
      api.tastemates(auth.token)
        .then((data) => {
          setMates(data.results || []);
          setIndex(0);
          setLimitReached(false);
        })
        .catch(() => {});
    });
    return unsub;
  }, [navigation, limitReached, auth.token]);

  function advance() {
    setIndex((i) => i + 1);
  }

  function restart() {
    setLoading(true);
    api.tastemates(auth.token)
      .then((data) => { setMates(data.results || []); setIndex(0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleSwipe(direction) {
    const swiped = mates[index];
    if (!swiped) return;

    try {
      const data = await api.tastemateSwipeV2(auth.token, swiped.id, direction);
      if (direction === "right") {
        if (data.mutualMatch) {
          hapticSuccess();
          setMutualMatch({ with: data.with || { id: swiped.id, name: swiped.name, avatarUrl: swiped.avatarUrl } });
        } else {
          emitLocalEvent({ type: "toast", title: "İstek gönderildi ✅", message: `${swiped.name}'e arkadaşlık isteği gönderildi` });
        }
      }
      advance();
    } catch (e) {
      if (e.limitReached) {
        setLimitReached(true);
        return;
      }
      emitLocalEvent({
        type: "toast",
        title: "İşlem tamamlanamadı",
        message: e?.message || "Bağlantını kontrol edip tekrar dener misin?",
      });
    }
  }

  const current = limitReached ? null : mates[index];
  const resetLabel = useMidnightCountdown(limitReached);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <TasteMateBackButton navigation={navigation} styles={styles} />
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (mates.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <TasteMateBackButton navigation={navigation} styles={styles} />
        <Users size={32} color={c.dim} style={{ opacity: 0.6, marginBottom: 12 }} />
        <Text style={styles.emptyTitle}>Henüz bir eşleşme yok</Text>
        <Text style={styles.emptySubtitle}>Daha fazla içerik beğendikçe zevkine uyan kullanıcılar burada görünmeye başlayacak.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 54 }}>
      <TasteMateBackButton navigation={navigation} styles={styles} />
      <Text style={styles.header}>Beğendiğin içeriklere göre zevk uyumu yüksek kullanıcılar</Text>

      <View style={styles.stage}>
        {!current ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Hepsine baktın</Text>
            {limitReached ? (
              <>
                <Text style={styles.emptySubtitle}>Bugünkü ücretsiz TasteMate hakkın doldu. Premium ile sınırsız kaydırabilirsin.</Text>
                {!!resetLabel && <Text style={styles.resetLabel}>{resetLabel}</Text>}
                <TouchableOpacity onPress={() => navigation.navigate("Premium", { autoPurchase: true, reason: "tastemate_limit" })} style={styles.premiumBtn}>
                  <Text style={styles.premiumBtnText}>Premium'a Geç</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={restart} style={styles.restartBtn}>
                <Text style={styles.restartText}>Baştan Göster</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {mates[index + 1] && (
              <View style={[styles.card, styles.cardBehind]}>
                <MateCardContent mate={mates[index + 1]} c={c} styles={styles} navigation={navigation} interactive={false} />
              </View>
            )}
            <SwipeableCard
              key={current.id}
              ref={cardRef}
              style={styles.card}
              onSwipeLeft={() => handleSwipe("left")}
              onSwipeRight={() => handleSwipe("right")}
            >
              {(pan) => (
                <>
                  <MateCardContent mate={current} c={c} styles={styles} navigation={navigation} interactive />
                  <Animated.View style={[styles.stampLike, { opacity: pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 1], extrapolate: "clamp" }) }]}>
                    <Text style={styles.stampLikeText}>TANIŞ</Text>
                  </Animated.View>
                  <Animated.View style={[styles.stampSkip, { opacity: pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1, 0], extrapolate: "clamp" }) }]}>
                    <Text style={styles.stampSkipText}>GEÇ</Text>
                  </Animated.View>
                </>
              )}
            </SwipeableCard>
          </>
        )}
      </View>

      {!!current && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionCircle, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]} onPress={() => cardRef.current?.swipeLeft()}>
            <X size={22} color={c.danger} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCircle, { backgroundColor: c.accent2 }]} onPress={() => cardRef.current?.swipeRight()}>
            <Heart size={22} color="#fff" fill="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {mutualMatch && (
        <View style={styles.mutualOverlay}>
          <Confetti />
          <RetryImage source={{ uri: avatarOr(mutualMatch.with?.avatarUrl, mutualMatch.with?.id) }} style={styles.mutualAvatar} />
          <View style={styles.mutualBadge}>
            <PartyPopper size={16} color="#fff" />
          </View>
          <Text style={styles.mutualTitle}>Karşılıklı Eşleştiniz! 🎉</Text>
          <Text style={styles.mutualSubtitle}>{mutualMatch.with?.name} de seni beğenmiş — artık arkadaşsınız.</Text>
          <Text style={styles.mutualNextHint}>İlk ortak kararınızı hemen verin: birlikte ne izleyeceksiniz?</Text>
          <View style={styles.mutualBtnRow}>
            <TouchableOpacity
              style={styles.mutualSecondaryBtn}
              onPress={() => { const m = mutualMatch; setMutualMatch(null); navigation.navigate("OtherProfile", { userId: m.with?.id }); }}
            >
              <Text style={styles.mutualSecondaryBtnText}>Profiline Git</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mutualPrimaryBtn}
              onPress={() => {
                const m = mutualMatch;
                setMutualMatch(null);
                navigation.navigate("MatchParty", {
                  friend: { id: m.with?.id, name: m.with?.name, avatarUrl: m.with?.avatarUrl },
                });
              }}
            >
              <PartyPopper size={15} color={c.bg} />
              <Text style={styles.mutualPrimaryBtnText}>Birlikte Seç</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.mutualContinueBtn} onPress={() => setMutualMatch(null)}>
            <Text style={styles.mutualContinueText}>Şimdilik devam et</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function TasteMateBackButton({ navigation, styles }) {
  return (
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MainTabs", { screen: "Activity" })}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel="Geri dön"
    >
      <ChevronLeft size={22} color="#fff" />
    </TouchableOpacity>
  );
}

function useMidnightCountdown(active) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!active) return;
    function tick() {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const diffMs = midnight - now;
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      setLabel(`${h} saat ${m} dakika sonra sıfırlanır`);
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [active]);
  return label;
}

function MateCardContent({ mate, c, styles, navigation, interactive }) {
  return (
    <>
      <View style={styles.photoArea}>
        <TouchableOpacity
          disabled={!interactive}
          onPress={() => navigation.navigate("OtherProfile", { userId: mate.id })}
          activeOpacity={0.9}
          style={StyleSheet.absoluteFillObject}
        >
          <RetryImage source={{ uri: avatarOr(mate.avatarUrl, mate.id) }} style={StyleSheet.absoluteFillObject} />
        </TouchableOpacity>
        <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0.55 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      </View>
      <View style={styles.infoArea}>
        <TouchableOpacity disabled={!interactive} onPress={() => navigation.navigate("OtherProfile", { userId: mate.id })}>
          <Text style={styles.mateName}>{mate.name}</Text>
          {!!mate.username && <Text style={styles.mateUsername}>@{mate.username}</Text>}
          <Text style={styles.mateInsight}>{matchSummary(mate.matchPercent)}</Text>
        </TouchableOpacity>
        <View style={styles.bottomRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {mate.common?.length > 0 && (
              <>
                <Text style={styles.commonLabel}>ORTAK BEĞENİLER</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {mate.common.slice(0, 3).map((m) => (
                    m.poster ? <Image key={m.id} source={{ uri: m.poster }} style={styles.commonPoster} />
                      : <View key={m.id} style={[styles.commonPoster, { backgroundColor: c.surface2 }]} />
                  ))}
                </View>
              </>
            )}
          </View>
          <View style={styles.matchBlock}>
            <View style={[styles.matchRing, { borderColor: matchRingColor(mate.matchPercent, c) }]}>
              <Text style={styles.matchRingText}>%{mate.matchPercent}</Text>
            </View>
            <Text style={styles.matchCaption}>uyum</Text>
          </View>
        </View>
      </View>
    </>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    backButton: { position: "absolute", top: 48, left: 14, zIndex: 50, width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
    header: { fontSize: 12, color: c.dim, textAlign: "center", marginBottom: 12, paddingHorizontal: 62, minHeight: 40, textAlignVertical: "center" },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    emptySubtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 8, lineHeight: 18 },
    restartBtn: { marginTop: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
    restartText: { color: c.text, fontSize: 12, fontWeight: "700" },
    premiumBtn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
    premiumBtnText: { color: c.bg, fontSize: 12, fontWeight: "800" },
    resetLabel: { fontSize: 11, color: c.dim, marginTop: 8, fontWeight: "600" },
    mutualOverlay: {
      ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: "rgba(10,9,14,0.94)",
      alignItems: "center", justifyContent: "center", padding: 28,
    },
    mutualAvatar: { width: 88, height: 88, borderRadius: 999, borderWidth: 3, borderColor: c.accent },
    mutualBadge: {
      width: 32, height: 32, borderRadius: 999, backgroundColor: c.accent2, alignItems: "center", justifyContent: "center",
      marginTop: -16, borderWidth: 3, borderColor: "#0a090e",
    },
    mutualTitle: { fontSize: 22, fontWeight: "900", color: "#fff", marginTop: 16 },
    mutualSubtitle: { fontSize: 12.5, color: "rgba(255,255,255,0.75)", marginTop: 8, textAlign: "center", maxWidth: 280 },
    mutualNextHint: { fontSize: 11.5, color: "rgba(255,255,255,0.56)", marginTop: 10, textAlign: "center", maxWidth: 280, lineHeight: 17 },
    mutualBtnRow: { flexDirection: "row", gap: 10, marginTop: 22, width: "100%", maxWidth: 320 },
    mutualSecondaryBtn: { flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
    mutualSecondaryBtnText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 13 },
    mutualPrimaryBtn: { flex: 1.2, flexDirection: "row", gap: 6, justifyContent: "center", backgroundColor: c.accent, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
    mutualPrimaryBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
    mutualContinueBtn: { paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
    mutualContinueText: { color: "rgba(255,255,255,0.52)", fontSize: 11.5, fontWeight: "700" },
    stage: { flex: 1, paddingHorizontal: 16 },
    card: {
      position: "absolute", top: 0, bottom: 0, left: 16, right: 16,
      borderRadius: 22, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    cardBehind: { transform: [{ scale: 0.96 }] },
    photoArea: { height: "72%", position: "relative", backgroundColor: c.surface2 },
    matchBlock: { alignItems: "center", flexShrink: 0 },
    matchRing: {
      width: 44, height: 44, borderRadius: 999,
      backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", borderWidth: 2,
    },
    matchRingText: { color: c.text, fontSize: 10.5, fontWeight: "900" },
    matchCaption: { fontSize: 8.5, color: c.dim, fontWeight: "700", marginTop: 2 },
    stampLike: { position: "absolute", top: 20, left: 16, borderWidth: 3, borderColor: "#fff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, transform: [{ rotate: "-12deg" }] },
    stampLikeText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    stampSkip: { position: "absolute", top: 20, right: 16, borderWidth: 3, borderColor: "#fff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, transform: [{ rotate: "12deg" }] },
    stampSkipText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    infoArea: { flex: 1, padding: 14, justifyContent: "center" },
    mateName: { fontSize: 16, fontWeight: "700", color: c.text },
    mateUsername: { fontSize: 11, color: c.dim, marginTop: 1 },
    mateInsight: { fontSize: 10.5, color: c.accent, fontWeight: "800", marginTop: 4 },
    bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 },
    commonLabel: { fontSize: 9, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 6 },
    commonPoster: { width: 34, height: 48, borderRadius: 7 },
    actionsRow: { flexDirection: "row", justifyContent: "center", gap: 26, paddingTop: 14, paddingBottom: 10 },
    actionCircle: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  });
}
