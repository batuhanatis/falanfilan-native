import { t as translateUI, getLanguage } from "../i18n/core";
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronLeft, Heart, X, Users } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { emitLocalEvent } from "../utils/localEvents";
import { hapticSuccess } from "../utils/haptics";
import { dativeTR, alsoTR } from "../utils/turkishSuffix";
import SwipeableCard from "../components/SwipeableCard";
import KnotHeart from "../components/salon/KnotHeart";
import SeatTicket, { TicketStamp } from "../components/salon/SeatTicket";
import { FONTS } from "../theme/fonts";

export default function TasteMateScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [loading, setLoading] = useState(true);
  const [mates, setMates] = useState([]);
  // Ücretsiz kullanıcının bugünkü kalan TasteMate hakkı (null = bilinmiyor); Premium'da sınırsız.
  const [allowance, setAllowance] = useState({ remaining: null, premium: false });
  const applyAllowance = (data) => setAllowance({ remaining: data?.remainingSwipes ?? null, premium: !!data?.isPremium });
  const [limitReached, setLimitReached] = useState(false);
  const [index, setIndex] = useState(0);
  const cardRef = useRef(null);
  const [mutualMatch, setMutualMatch] = useState(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);
  useEffect(() => {
    api.me(auth.token).then((me) => setMyAvatarUrl(me.avatarUrl || null)).catch(() => {});
  }, [auth.token]);
  const prefetched = useRef(usePrefetch().tasteMates).current;

  useEffect(() => {
    if (prefetched) {
      setMates(prefetched.results || []);
      applyAllowance(prefetched);
      setLoading(false);
      return;
    }
    api.tastemates(auth.token)
      .then((data) => { setMates(data.results || []); applyAllowance(data); })
      .catch(() => setMates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      if (!limitReached) return;
      api.tastemates(auth.token)
        .then((data) => {
          setMates(data.results || []);
          applyAllowance(data);
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
      .then((data) => { setMates(data.results || []); applyAllowance(data); setIndex(0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleSwipe(direction) {
    const swiped = mates[index];
    if (!swiped) return;

    try {
      const data = await api.tastemateSwipeV2(auth.token, swiped.id, direction);
      setAllowance((a) => (a.premium || a.remaining == null ? a : { ...a, remaining: Math.max(0, a.remaining - 1) }));
      if (direction === "right") {
        if (data.mutualMatch) {
          hapticSuccess();
          setMutualMatch({ with: data.with || { id: swiped.id, name: swiped.name, avatarUrl: swiped.avatarUrl } });
        } else {
          const to = getLanguage() === "en" ? null : dativeTR(swiped.name);
          emitLocalEvent({ type: "toast", title: translateUI("İstek gönderildi ✅"), message: to ? `${to} arkadaşlık isteği gönderildi` : translateUI("Arkadaşlık isteği gönderildi: {0}", { 0: swiped.name }) });
        }
      }
      advance();
    } catch (e) {
      if (e.limitReached) {
        setLimitReached(true);
        setAllowance((a) => ({ ...a, remaining: 0 }));
        return;
      }
      emitLocalEvent({
        type: "toast",
        title: translateUI("İşlem tamamlanamadı"),
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
        <Text style={styles.emptyTitle}>{translateUI("Henüz bir eşleşme yok")}</Text>
        <Text style={styles.emptySubtitle}>{translateUI("Daha fazla içerik beğendikçe sana uyan kullanıcılar burada görünmeye başlayacak.")}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 54 }}>
      <TasteMateBackButton navigation={navigation} styles={styles} />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{translateUI("TasteMate")}</Text>
        {(allowance.premium || allowance.remaining != null) && (
          <View style={styles.hak} accessibilityLabel={allowance.premium ? translateUI("Sınırsız TasteMate") : translateUI("Bugün {0} TasteMate hakkın kaldı", { 0: allowance.remaining })}>
            <View style={[styles.hakNotch, { left: -5, backgroundColor: c.bg }]} />
            <Text style={styles.hakText}>{allowance.premium ? translateUI("SINIRSIZ") : translateUI("BUGÜN {0} HAK", { 0: allowance.remaining })}</Text>
            <View style={[styles.hakNotch, { right: -5, backgroundColor: c.bg }]} />
          </View>
        )}
      </View>
      <Text style={styles.header}>{translateUI("Beğendiğin içeriklere göre sana en çok uyan kullanıcılar")}</Text>

      <View style={styles.stage}>
        {!current ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>{translateUI("Hepsine baktın")}</Text>
            {limitReached ? (
              <>
                <Text style={styles.emptySubtitle}>{translateUI("Bugünkü ücretsiz TasteMate hakkın doldu. Premium ile sınırsız kaydırabilirsin.")}</Text>
                {!!resetLabel && <Text style={styles.resetLabel}>{resetLabel}</Text>}
                <TouchableOpacity onPress={() => navigation.navigate("Premium", { autoPurchase: true, reason: "tastemate_limit" })} style={styles.premiumBtn}>
                  <Text style={styles.premiumBtnText}>{translateUI("Premium'a Geç")}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={restart} style={styles.restartBtn}>
                <Text style={styles.restartText}>{translateUI("Baştan Göster")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* arkadaki biletler: deste gibi hafifçe görünüyor, henüz "hesaplanmamış" */}
            {[2, 1].map((k) => mates[index + k] && (
              <View key={mates[index + k].id} style={[styles.card, k === 1 ? styles.cardBehind1 : styles.cardBehind2]} pointerEvents="none">
                <SeatTicket mate={mates[index + k]} pending notchColor={c.bg} />
              </View>
            ))}
            <SwipeableCard
              key={current.id}
              ref={cardRef}
              style={styles.card}
              onSwipeLeft={() => handleSwipe("left")}
              onSwipeRight={() => handleSwipe("right")}
            >
              {(pan) => (
                <SeatTicket
                  mate={current}
                  notchColor={c.bg}
                  interactive
                  onOpenProfile={() => navigation.navigate("OtherProfile", { userId: current.id })}
                  stamps={(
                    <>
                      <TicketStamp label={translateUI("TANIŞ")} color="#e2c171" side="left" opacity={pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 0.95], extrapolate: "clamp" })} />
                      <TicketStamp label={translateUI("GEÇ")} color="#d9636f" side="right" opacity={pan.x.interpolate({ inputRange: [-110, -20], outputRange: [0.95, 0], extrapolate: "clamp" })} />
                    </>
                  )}
                />
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
          {/* Düğüm: iki avatardan çıkan noktalar kalp örüyor. Kişi eşleşmesi, ortada afiş yok. */}
          <KnotHeart
            leftAvatar={{ uri: avatarOr(myAvatarUrl, auth.id) }}
            rightAvatar={{ uri: avatarOr(mutualMatch.with?.avatarUrl, mutualMatch.with?.id) }}
          />
          <Text style={styles.mutualTitle}>{translateUI("Karşılıklı eşleştiniz")}</Text>
          <Text style={styles.mutualSubtitle}>{getLanguage() === "en" ? `${mutualMatch.with?.name || ""}${translateUI(" de seni beğenmiş — artık arkadaşsınız.")}` : `${alsoTR(mutualMatch.with?.name)} seni beğenmiş — artık arkadaşsınız.`}</Text>
          <Text style={styles.mutualNextHint}>{translateUI("İlk ortak kararınızı hemen verin: birlikte ne izleyeceksiniz?")}</Text>
          <View style={styles.mutualBtnRow}>
            <TouchableOpacity
              style={styles.mutualSecondaryBtn}
              onPress={() => { const m = mutualMatch; setMutualMatch(null); navigation.navigate("OtherProfile", { userId: m.with?.id }); }}
            >
              <Text style={styles.mutualSecondaryBtnText}>{translateUI("Profiline Git")}</Text>
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
              <Text style={styles.mutualPrimaryBtnText}>{translateUI("Birlikte Seç")}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.mutualContinueBtn} onPress={() => setMutualMatch(null)}>
            <Text style={styles.mutualContinueText}>{translateUI("Şimdilik devam et")}</Text>
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
      accessibilityLabel={translateUI("Geri dön")}
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

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    backButton: { position: "absolute", top: 48, left: 14, zIndex: 50, width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
    titleRow: { height: 40, alignItems: "center", justifyContent: "center" },
    title: { fontFamily: FONTS.marquee, fontSize: 25, color: c.text, letterSpacing: 0.5 },
    hak: { position: "absolute", right: 16, top: 5, height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#3a332b", backgroundColor: "#0d0b0a", justifyContent: "center", overflow: "hidden" },
    hakNotch: { position: "absolute", top: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: "#3a332b" },
    hakText: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.5, color: "#e2c171" },
    header: { fontSize: 11.5, lineHeight: 15, color: c.dim, textAlign: "center", marginTop: 4, marginBottom: 12, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    emptySubtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 8, lineHeight: 18 },
    restartBtn: { marginTop: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
    restartText: { color: c.text, fontSize: 12, fontWeight: "700" },
    premiumBtn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
    premiumBtnText: { color: c.bg, fontSize: 12, fontWeight: "800" },
    resetLabel: { fontSize: 11, color: c.dim, marginTop: 8, fontWeight: "600" },
    mutualOverlay: {
      ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: "rgba(10,9,14,0.94)",
      alignItems: "center", justifyContent: "center", paddingVertical: 28,
    },
    mutualTitle: { fontFamily: FONTS.marquee, fontSize: 36, lineHeight: 38, color: "#f2ede2", marginTop: 4, textAlign: "center" },
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
    card: { position: "absolute", top: 0, bottom: 20, left: 16, right: 16 },
    cardBehind1: { opacity: 0.55, transform: [{ translateY: 10 }, { scale: 0.955 }] },
    cardBehind2: { opacity: 0.28, transform: [{ translateY: 20 }, { scale: 0.91 }] },
    actionsRow: { flexDirection: "row", justifyContent: "center", gap: 26, paddingTop: 14, paddingBottom: 10 },
    actionCircle: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  });
}
