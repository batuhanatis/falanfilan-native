import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Animated, PanResponder, Dimensions, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Heart, X, Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { GENRE_FILTERS } from "../theme/theme";
import ChipRow from "../components/ChipRow";
import SwipeableCard from "../components/SwipeableCard";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = 110;
const MIN_IMDB_OPTIONS = [6.0, 6.5, 7.0, 7.5, 8.0];

export default function MatchPartyScreen({ route, navigation }) {
  const { friend, sessionId: initialSessionId } = route.params || {};
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const styles = makeStyles(c);

  const [stage, setStage] = useState(initialSessionId ? "loading" : "setup");
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const [typePref, setTypePref] = useState("Hepsi");
  const [genrePref, setGenrePref] = useState(null);
  const [minImdb, setMinImdb] = useState(6.5);

  const [queue, setQueue] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [matches, setMatches] = useState([]);
  const [flash, setFlash] = useState(null);
  const [members, setMembers] = useState(friend ? [{ id: friend.id, name: friend.name, avatarUrl: friend.avatarUrl, progress: 0 }] : []);
  const [declinedBy, setDeclinedBy] = useState(null);

  const cardRef = useRef(null);

  async function loadSession(id) {
    try {
      const data = await api.getParty(auth.token, id);
      setQueue(data.movies || []);
      if (data.members) setMembers(data.members.filter((m) => m.id !== auth.id));
      setCursor(data.myProgress || 0);
      setStage("active");
    } catch { navigation.goBack(); }
  }

  useEffect(() => { if (initialSessionId) loadSession(initialSessionId); }, [initialSessionId]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.session_id !== sessionId) return;
      if (msg.type === "party_accepted" && (stage === "waiting" || stage === "active")) {
        loadSession(sessionId);
      } else if (msg.type === "party_declined" && stage === "waiting") {
        setDeclinedBy(msg.by?.name || "Arkadaşın");
        setStage("declined");
      } else if (msg.type === "party_match") {
        setMatches((m) => (m.some((x) => x.id === msg.movie.id) ? m : [...m, msg.movie]));
        setFlash(msg.movie);
        setTimeout(() => setFlash(null), 1200);
      }
    });
    return unsub;
  }, [subscribe, sessionId, stage]);

  async function startInvite() {
    if (!friend) return;
    try {
      const data = await api.createParty(auth.token, { to_user_ids: [friend.id], filters: { type: typePref, genre: genrePref || "Hepsi", minImdb } });
      setSessionId(data.id);
      setStage("waiting");
    } catch { /* sessizce geç */ }
  }

  function advance() { setCursor((i) => i + 1); }

  async function decide(userLiked) {
    const movie = queue[cursor];
    if (!movie) return;
    advance();
    try {
      const data = await api.swipeParty(auth.token, sessionId, movie.id, userLiked);
      if (data.match) {
        setMatches((m) => (m.some((x) => x.id === movie.id) ? m : [...m, movie]));
        setFlash(movie);
        setTimeout(() => setFlash(null), 1200);
      }
    } catch { /* sessizce geç */ }
  }

  function handleSwipe(direction) { decide(direction === "right"); }

  async function endSession() {
    try { await api.endParty(auth.token, sessionId); } catch {}
    setStage("summary");
  }

  const current = queue[cursor];
  const displayName = members[0]?.name || friend?.name || "Arkadaşın";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>MatchParty</Text>
          <Text style={styles.headerSubtitle}>{displayName} ile birlikte izlemelik seçin</Text>
        </View>
      </View>

      {stage === "loading" && (
        <View style={styles.center}><ActivityIndicator size="large" color={c.accent} /></View>
      )}

      {stage === "setup" && (
        <ScrollView style={{ padding: 18 }}>
          <Text style={styles.label}>TÜR</Text>
          <ChipRow items={["Film", "Dizi"]} active={typePref === "Hepsi" ? null : typePref}
            onSelect={(v) => setTypePref(v === typePref ? "Hepsi" : v)} />
          <Text style={styles.label}>KATEGORİ</Text>
          <ChipRow items={GENRE_FILTERS} active={genrePref} onSelect={(v) => setGenrePref(v === genrePref ? null : v)} />
          <Text style={styles.label}>MİNİMUM IMDB PUANI: {minImdb.toFixed(1)}</Text>
          <ChipRow items={MIN_IMDB_OPTIONS.map(String)} active={String(minImdb)} onSelect={(v) => setMinImdb(parseFloat(v))} />
          <TouchableOpacity style={styles.primaryBtn} onPress={startInvite}>
            <Text style={styles.primaryBtnText}>{displayName}'e Davet Gönder</Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>Davet gerçek zamanlı iletilir, karşı taraf bildirimler alanında görüp kabul/reddedebilir.</Text>
        </ScrollView>
      )}

      {stage === "waiting" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={styles.waitTitle}>Davet gönderildi</Text>
          <Text style={styles.waitSubtitle}>{displayName} kabul etmesi bekleniyor… Kabul edince otomatik başlayacak.</Text>
        </View>
      )}

      {stage === "declined" && (
        <View style={styles.center}>
          <X size={30} color={c.danger} />
          <Text style={styles.waitTitle}>{declinedBy} daveti reddetti</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === "active" && (
        <View style={{ flex: 1, padding: 16 }}>
          <View style={styles.progressRow}>
            {members.map((m) => (
              <View key={m.id} style={styles.memberPill}>
                <Image source={{ uri: avatarOr(m.avatarUrl, m.id) }} style={styles.memberAvatar} />
                <Text style={styles.memberProgress}>{m.progress || 0}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.matchesLabel}>Herkes sağa kaydırırsa eşleşme listesine eklenir · {matches.length} ortak eşleşme</Text>

          <View style={{ flex: 1, position: "relative" }}>
            {!current ? (
              <View style={styles.center}>
                <Text style={styles.waitTitle}>Bu oturum için içerik kalmadı</Text>
              </View>
            ) : (
              <SwipeableCard
                key={current.id}
                ref={cardRef}
                style={styles.card}
                onSwipeLeft={() => handleSwipe("left")}
                onSwipeRight={() => handleSwipe("right")}
              >
                {current.poster ? <Image source={{ uri: current.poster }} style={StyleSheet.absoluteFillObject} /> : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c.surface2 }]} />}
                <LinearGradient colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0)"]} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                <View style={styles.cardInfo} pointerEvents="none">
                  <Text style={styles.cardTitle} numberOfLines={1}>{current.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Star size={11} color={c.accent} fill={c.accent} />
                    <Text style={styles.cardMeta}>{current.imdb} · {current.year} · {current.genre}</Text>
                  </View>
                </View>
                {flash && (
                  <View style={styles.flashOverlay}>
                    <Text style={{ fontSize: 34 }}>🎉</Text>
                    <Text style={styles.flashTitle}>MATCH!</Text>
                    <Text style={styles.flashSubtitle}>{flash.title}</Text>
                  </View>
                )}
              </SwipeableCard>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionCircle, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]} onPress={() => cardRef.current?.swipeLeft()} disabled={!current}>
              <X size={22} color={c.danger} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionCircle, { backgroundColor: c.accent2 }]} onPress={() => cardRef.current?.swipeRight()} disabled={!current}>
              <Heart size={22} color="#fff" fill="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.endBtn} onPress={endSession}>
            <Text style={styles.endBtnText}>Oturumu Bitir</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === "summary" && (
        <ScrollView style={{ padding: 18 }}>
          <Text style={styles.summaryTitle}>Ortak Eşleşmeleriniz</Text>
          <Text style={styles.summarySubtitle}>{displayName} ile {matches.length} içerikte anlaştınız</Text>
          {matches.length === 0 ? (
            <Text style={styles.hintText}>Bu oturumda ortak bir eşleşme olmadı.</Text>
          ) : (
            matches.map((m) => (
              <TouchableOpacity key={m.id} style={styles.matchRow} onPress={() => navigation.navigate("Detail", { movie: m })}>
                {m.poster ? <Image source={{ uri: m.poster }} style={styles.matchPoster} /> : <View style={[styles.matchPoster, { backgroundColor: c.surface2 }]} />}
                <View>
                  <Text style={styles.matchTitle}>{m.title}</Text>
                  <Text style={styles.matchMeta}>{m.year} · ⭐ {m.imdb}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Kapat</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    headerSubtitle: { fontSize: 11, color: c.dim, marginTop: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    label: { fontSize: 11, fontWeight: "700", color: c.dim, marginBottom: 8, marginTop: 14 },
    primaryBtn: { marginTop: 22, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    primaryBtnText: { color: "#14121a", fontWeight: "800", fontSize: 13 },
    hintText: { fontSize: 11, color: c.dim, marginTop: 10, textAlign: "center" },
    waitTitle: { fontSize: 14, fontWeight: "700", color: c.text, marginTop: 14 },
    waitSubtitle: { fontSize: 12, color: c.dim, marginTop: 6, textAlign: "center" },
    secondaryBtn: { marginTop: 16, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
    secondaryBtnText: { color: c.text, fontWeight: "700", fontSize: 12 },
    progressRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 8 },
    memberPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    memberAvatar: { width: 16, height: 16, borderRadius: 999 },
    memberProgress: { fontSize: 10, color: c.dim },
    matchesLabel: { fontSize: 11, color: c.dim, textAlign: "center", marginBottom: 10 },
    card: { flex: 1, borderRadius: 22, overflow: "hidden", backgroundColor: c.surface2 },
    cardInfo: { position: "absolute", left: 16, right: 16, bottom: 14 },
    cardTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
    cardMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
    flashOverlay: {
      position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center", borderRadius: 22,
    },
    flashTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
    flashSubtitle: { color: "#fff", fontSize: 12, opacity: 0.85 },
    actionsRow: { flexDirection: "row", justifyContent: "center", gap: 26, marginTop: 16 },
    actionCircle: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    endBtn: { marginTop: 14, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
    endBtnText: { color: c.dim, fontWeight: "700", fontSize: 12 },
    summaryTitle: { fontSize: 20, fontWeight: "700", color: c.text, textAlign: "center" },
    summarySubtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 4, marginBottom: 16 },
    matchRow: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 10 },
    matchPoster: { width: 46, height: 64, borderRadius: 8 },
    matchTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    matchMeta: { fontSize: 11, color: c.dim, marginTop: 2 },
  });
}
