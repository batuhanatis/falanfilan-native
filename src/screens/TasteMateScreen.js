import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X, Users } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import SwipeableCard from "../components/SwipeableCard";
import RetryImage from "../components/RetryImage";

export default function TasteMateScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [mates, setMates] = useState([]);
  const [limitReached, setLimitReached] = useState(false);
  const [index, setIndex] = useState(0);
  const cardRef = useRef(null);
  // Uygulama açılır açılmaz arka planda çekilmiş bir sonuç varsa (bkz. PrefetchContext),
  // ağa hiç istek atmadan direkt onu kullan.
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

  // ÖNEMLİ: Kullanıcı günlük hakkı dolup Premium'a geçtikten sonra bu ekrana geri dönünce,
  // eskiden "limitReached" state'i hâlâ true kaldığı için uygulamayı kapatıp açması
  // gerekiyordu. Artık ekran her odaklandığında (ör. Premium'dan geri dönünce) tazeden bir
  // parti kullanıcı çekip devam ediyor — artık premium olduysa kaydırma limitsiz devam eder.
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

  // ÖNEMLİ DÜZELTME: "Baştan Göster" eskiden sadece index'i sıfırlıyordu — AYNI eski listeyi
  // (o oturumda zaten sağa kaydırıp arkadaşlık isteği gönderdiğin kişiler dahil) tekrar
  // gösteriyordu, sunucudan hiç taze veri çekmiyordu. Backend zaten arkadaşlık isteği
  // gönderdiğin (ya da zaten arkadaşın olan) kişileri otomatik hariç tutuyor — ama bu ancak
  // TAZE bir sorguyla işe yarıyor, elimizdeki eski diziyi tekrar göstermekle değil.
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
    if (direction === "right") {
      try { await api.friendRequest(auth.token, swiped.id); } catch { /* zaten istek gönderilmiş olabilir */ }
    }
    // Hakkı GERÇEK kaydırma anında düşürüyoruz — ekrana gelen toplu listeye göre değil.
    try {
      await api.tastemateSwipe(auth.token);
      advance();
    } catch (e) {
      if (e.limitReached) setLimitReached(true);
      else advance();
    }
  }

  const current = limitReached ? null : mates[index];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (mates.length === 0) {
    return (
      <View style={styles.center}>
        <Users size={32} color={c.dim} style={{ opacity: 0.6, marginBottom: 12 }} />
        <Text style={styles.emptyTitle}>Henüz bir eşleşme yok</Text>
        <Text style={styles.emptySubtitle}>Daha fazla içerik beğendikçe zevkine uyan kullanıcılar burada görünmeye başlayacak.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 54 }}>
      <Text style={styles.header}>Beğendiğin içeriklere göre zevk uyumu yüksek kullanıcılar</Text>

      <View style={styles.stage}>
        {!current ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Hepsine baktın</Text>
            {limitReached ? (
              <>
                <Text style={styles.emptySubtitle}>Bugünkü ücretsiz TasteMate hakkın doldu. Premium ile sınırsız kaydırabilirsin.</Text>
                <TouchableOpacity onPress={() => navigation.navigate("Premium", { autoPurchase: true })} style={styles.premiumBtn}>
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
            {/* key={current.id} — her yeni kişi için animasyon durumu sıfırdan, temiz başlar. */}
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
                    <Text style={styles.stampLikeText}>EKLE</Text>
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
    </View>
  );
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
          <View style={styles.matchRing}>
            <Text style={styles.matchRingText}>%{mate.matchPercent}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    header: { fontSize: 12, color: c.dim, textAlign: "center", marginBottom: 12, paddingHorizontal: 16 },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    emptySubtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 8, lineHeight: 18 },
    restartBtn: { marginTop: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
    restartText: { color: c.text, fontSize: 12, fontWeight: "700" },
    premiumBtn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
    premiumBtnText: { color: c.bg, fontSize: 12, fontWeight: "800" },
    stage: { flex: 1, paddingHorizontal: 16 },
    card: {
      position: "absolute", top: 0, bottom: 0, left: 16, right: 16,
      borderRadius: 22, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    cardBehind: { transform: [{ scale: 0.96 }] },
    photoArea: { height: "72%", position: "relative", backgroundColor: c.surface2 },
    matchRing: {
      width: 40, height: 40, borderRadius: 999, flexShrink: 0,
      backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.accent,
    },
    matchRingText: { color: c.text, fontSize: 10, fontWeight: "800" },
    stampLike: { position: "absolute", top: 20, left: 16, borderWidth: 3, borderColor: "#fff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, transform: [{ rotate: "-12deg" }] },
    stampLikeText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    stampSkip: { position: "absolute", top: 20, right: 16, borderWidth: 3, borderColor: "#fff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, transform: [{ rotate: "12deg" }] },
    stampSkipText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    infoArea: { flex: 1, padding: 14, justifyContent: "center" },
    mateName: { fontSize: 16, fontWeight: "700", color: c.text },
    mateUsername: { fontSize: 11, color: c.dim, marginTop: 1 },
    bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 },
    commonLabel: { fontSize: 9, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 6 },
    commonPoster: { width: 34, height: 48, borderRadius: 7 },
    actionsRow: { flexDirection: "row", justifyContent: "center", gap: 26, paddingTop: 14, paddingBottom: 10 },
    actionCircle: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  });
}
