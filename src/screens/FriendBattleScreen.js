import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Share } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Swords, Users, Trophy, Clock3, Check, ChevronRight, Share2, RotateCcw } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { friendBattleApi } from "../api/friendBattle";
import ScreenHeader from "../components/ScreenHeader";
import RetryImage from "../components/RetryImage";
import { avatarOr } from "../utils/avatar";
import { hapticSuccess, hapticLight } from "../utils/haptics";

export default function FriendBattleScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [battles, setBattles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [creatingId, setCreatingId] = useState(null);
  const [battle, setBattle] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const initialBattleId = route?.params?.battleId;

  const loadLobby = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const [battleData, friendData] = await Promise.all([
        friendBattleApi.inbox(auth.token),
        api.friends(auth.token).catch(() => ({ friends: [] })),
      ]);
      setBattles(battleData.battles || []);
      setFriends(friendData.friends || []);
    } catch (e) {
      if (e.unavailable) setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  const openBattle = useCallback(async (battleId) => {
    if (!battleId) return;
    setLoading(true);
    try {
      const data = await friendBattleApi.detail(auth.token, battleId);
      setBattle(data);
      setAnswers(data.myAnswers || []);
      setIndex(Math.min(data.myAnswers?.length || 0, Math.max(0, (data.questions || []).length - 1)));
    } catch (e) {
      if (e.unavailable) setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    if (initialBattleId) openBattle(initialBattleId);
    else loadLobby();
  }, [initialBattleId, openBattle, loadLobby]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      if (battle?.id) openBattle(battle.id);
      else if (!initialBattleId) loadLobby();
    });
    return unsub;
  }, [navigation, battle?.id, initialBattleId, openBattle, loadLobby]);

  async function create(friend) {
    if (!friend?.id || creatingId) return;
    setCreatingId(friend.id);
    try {
      const data = await friendBattleApi.create(auth.token, friend.id);
      hapticSuccess();
      await openBattle(data.battleId);
    } catch (e) {
      if (e.unavailable) setUnavailable(true);
    }
    setCreatingId(null);
  }

  async function choose(movieId) {
    if (!battle?.questions?.length || submitting) return;
    hapticLight();
    const next = [...answers];
    next[index] = movieId;
    setAnswers(next);
    if (index < battle.questions.length - 1) {
      setIndex((v) => v + 1);
      return;
    }
    setSubmitting(true);
    try {
      const result = await friendBattleApi.submit(auth.token, battle.id, next);
      hapticSuccess();
      setBattle((prev) => ({ ...prev, ...result }));
    } finally {
      setSubmitting(false);
    }
  }

  function backToLobby() {
    setBattle(null);
    setAnswers([]);
    setIndex(0);
    loadLobby();
  }

  if (loading) {
    return <View style={[styles.root, styles.center]}><ActivityIndicator color="#FB7185" /></View>;
  }

  if (unavailable) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Friend Battle" onBack={() => navigation.goBack()} />
        <View style={styles.centerContent}>
          <View style={styles.bigIcon}><Swords size={28} color="#FB7185" /></View>
          <Text style={styles.emptyTitle}>Friend Battle hazırlanıyor</Text>
          <Text style={styles.emptyText}>Bu özellik backend yayını tamamlandığında burada açılacak.</Text>
        </View>
      </View>
    );
  }

  if (battle) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Friend Battle" onBack={backToLobby} subtitle={battle.opponent?.name ? `${battle.opponent.name} ile` : undefined} />
        {battle.status === "completed" && battle.result ? (
          <BattleResult battle={battle} styles={styles} c={c} onAgain={backToLobby} />
        ) : battle.mySubmitted ? (
          <Waiting battle={battle} styles={styles} onBack={backToLobby} />
        ) : (
          <BattlePlay battle={battle} index={index} answers={answers} styles={styles} c={c} onChoose={choose} submitting={submitting} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Friend Battle" subtitle="Aynı sorular, ayrı zamanlar" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}><Swords size={25} color="#fff" /></View>
          <Text style={styles.heroEyebrow}>ASENKRON MEYDAN OKUMA</Text>
          <Text style={styles.heroTitle}>Aynı 8 seçimi yapın.</Text>
          <Text style={styles.heroSub}>Aynı anda online olmanız gerekmiyor. İkiniz de tamamlayınca zevk senkronunuz ortaya çıkıyor.</Text>
        </LinearGradient>

        {battles.length > 0 && <>
          <Text style={styles.sectionLabel}>MEYDAN OKUMALAR</Text>
          {battles.map((item) => (
            <TouchableOpacity key={item.id} style={styles.battleRow} onPress={() => openBattle(item.id)} activeOpacity={0.82}>
              <RetryImage source={{ uri: avatarOr(item.opponent?.avatarUrl, item.opponent?.id) }} style={styles.avatar} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.opponent?.name || "Arkadaşın"}</Text>
                <Text style={styles.rowSub}>{statusText(item)}</Text>
              </View>
              {item.status === "completed" && item.result ? <Text style={styles.scorePill}>%{item.result.percent}</Text> : <ChevronRight size={17} color={c.dim} />}
            </TouchableOpacity>
          ))}
        </>}

        <Text style={styles.sectionLabel}>YENİ BATTLE BAŞLAT</Text>
        {friends.length === 0 ? (
          <View style={styles.emptyCard}><Users size={20} color={c.dim} /><Text style={styles.emptyText}>Battle başlatmak için önce bir arkadaş ekle.</Text></View>
        ) : friends.map((friend) => (
          <TouchableOpacity key={friend.id} style={styles.friendRow} onPress={() => create(friend)} activeOpacity={0.82} disabled={!!creatingId}>
            <RetryImage source={{ uri: avatarOr(friend.avatar_url || friend.avatarUrl, friend.id) }} style={styles.avatar} />
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{friend.name}</Text><Text style={styles.rowSub}>8 seçimlik meydan okuma gönder</Text></View>
            {creatingId === friend.id ? <ActivityIndicator size="small" color="#FB7185" /> : <View style={styles.challengeBtn}><Swords size={14} color="#fff" /></View>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function BattlePlay({ battle, index, styles, onChoose, submitting }) {
  const q = battle.questions?.[index];
  if (!q) return null;
  return (
    <ScrollView contentContainerStyle={styles.playContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.progress}>{index + 1} / {battle.questions.length}</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((index + 1) / battle.questions.length) * 100}%` }]} /></View>
      <Text style={styles.question}>Hangisini seçersin?</Text>
      <Text style={styles.questionSub}>İlk içinden geleni seç. Arkadaşın aynı soruları kendi zamanında görecek.</Text>
      <View style={styles.choiceRow}>
        <Choice movie={q.left} styles={styles} onPress={() => onChoose(q.left.id)} disabled={submitting} />
        <View style={styles.vs}><Text style={styles.vsText}>VS</Text></View>
        <Choice movie={q.right} styles={styles} onPress={() => onChoose(q.right.id)} disabled={submitting} />
      </View>
      {submitting && <ActivityIndicator style={{ marginTop: 20 }} color="#FB7185" />}
    </ScrollView>
  );
}

function Choice({ movie, styles, onPress, disabled }) {
  return (
    <TouchableOpacity style={styles.choice} onPress={onPress} activeOpacity={0.86} disabled={disabled}>
      <Image source={{ uri: movie.poster }} style={styles.choicePoster} />
      <Text style={styles.choiceTitle} numberOfLines={2}>{movie.title}</Text>
      <Text style={styles.choiceMeta}>{movie.year} · {movie.type}</Text>
    </TouchableOpacity>
  );
}

function Waiting({ battle, styles, onBack }) {
  return (
    <View style={styles.centerContent}>
      <View style={styles.bigIcon}><Clock3 size={28} color="#FB7185" /></View>
      <Text style={styles.emptyTitle}>Sen tamamladın ✓</Text>
      <Text style={styles.emptyText}>{battle.opponent?.name || "Arkadaşın"} turunu bitirince ortak skorunuz burada açılacak.</Text>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}><Text style={styles.secondaryBtnText}>Meydan Okumalara Dön</Text></TouchableOpacity>
    </View>
  );
}

function BattleResult({ battle, styles, onAgain }) {
  const result = battle.result;
  const message = result.percent >= 80 ? "Aynı rafın insanısınız 🔥" : result.percent >= 60 ? "Zevkiniz oldukça yakın ✨" : result.percent >= 40 ? "Bazı filmlerde buluşuyorsunuz 🎬" : "Film gecesi pazarlığı zor geçecek 😄";
  async function share() {
    await Share.share({ message: `${battle.opponent?.name || "Arkadaşımla"} Friend Battle sonucumuz: %${result.percent} zevk senkronu 🎮 Pellix` });
  }
  return (
    <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} style={styles.resultHero}>
        <Trophy size={30} color="#fff" />
        <Text style={styles.resultPercent}>%{result.percent}</Text>
        <Text style={styles.resultTitle}>Zevk senkronu</Text>
        <Text style={styles.resultSub}>{message}</Text>
      </LinearGradient>
      <View style={styles.resultStats}>
        <View style={styles.stat}><Text style={styles.statValue}>{result.agreements}</Text><Text style={styles.statLabel}>AYNI SEÇİM</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{result.total}</Text><Text style={styles.statLabel}>TOPLAM</Text></View>
      </View>
      <TouchableOpacity style={styles.shareBtn} onPress={share}><Share2 size={16} color="#fff" /><Text style={styles.shareText}>Sonucu Paylaş</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onAgain}><RotateCcw size={15} color="#fff" /><Text style={styles.secondaryBtnText}>Başka Battle Başlat</Text></TouchableOpacity>
    </ScrollView>
  );
}

function statusText(item) {
  if (item.status === "completed") return "Sonuç hazır";
  if (item.mySubmitted) return `${item.opponent?.name || "Arkadaşın"} bekleniyor`;
  if (item.theirSubmitted) return "Sıra sende · arkadaşın tamamladı";
  return item.createdByMe ? "Meydan okuman gönderildi" : "Sana meydan okudu";
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg }, center: { alignItems: "center", justifyContent: "center" },
    content: { padding: 16, paddingBottom: 34 }, hero: { borderRadius: 24, padding: 20, overflow: "hidden" },
    heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 18 },
    heroEyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
    heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 5 }, heroSub: { color: "rgba(255,255,255,0.82)", fontSize: 12, lineHeight: 18, marginTop: 7 },
    sectionLabel: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 22, marginBottom: 9 },
    battleRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 11, marginBottom: 8 },
    friendRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 11, marginBottom: 8 },
    avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: c.surface2 }, rowTitle: { color: c.text, fontSize: 13.5, fontWeight: "800" }, rowSub: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    scorePill: { color: "#fff", fontSize: 11, fontWeight: "900", backgroundColor: "#DB2777", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
    challengeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: "#DB2777", alignItems: "center", justifyContent: "center" },
    emptyCard: { alignItems: "center", gap: 8, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 22 },
    centerContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }, bigIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    emptyTitle: { color: c.text, fontSize: 18, fontWeight: "900", textAlign: "center" }, emptyText: { color: c.dim, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 },
    playContent: { padding: 18, paddingBottom: 36 }, progress: { color: "#FB7185", fontSize: 11, fontWeight: "900", textAlign: "center" }, progressTrack: { height: 5, backgroundColor: c.surface2, borderRadius: 999, marginTop: 8, overflow: "hidden" }, progressFill: { height: 5, backgroundColor: "#FB7185", borderRadius: 999 },
    question: { color: c.text, fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 28 }, questionSub: { color: c.dim, fontSize: 11.5, textAlign: "center", lineHeight: 17, marginTop: 5 },
    choiceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 }, choice: { flex: 1, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, overflow: "hidden", paddingBottom: 10 }, choicePoster: { width: "100%", aspectRatio: 2 / 3, backgroundColor: c.surface2 }, choiceTitle: { color: c.text, fontSize: 12.5, fontWeight: "800", paddingHorizontal: 9, marginTop: 8 }, choiceMeta: { color: c.dim, fontSize: 9.5, paddingHorizontal: 9, marginTop: 2 },
    vs: { position: "absolute", zIndex: 5, left: "50%", marginLeft: -19, width: 38, height: 38, borderRadius: 999, backgroundColor: "#DB2777", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.bg }, vsText: { color: "#fff", fontSize: 10, fontWeight: "900" },
    resultContent: { padding: 18, paddingBottom: 36 }, resultHero: { borderRadius: 24, padding: 26, alignItems: "center" }, resultPercent: { color: "#fff", fontSize: 52, fontWeight: "900", marginTop: 8 }, resultTitle: { color: "#fff", fontSize: 16, fontWeight: "900" }, resultSub: { color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 5, textAlign: "center" },
    resultStats: { flexDirection: "row", gap: 10, marginTop: 12 }, stat: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, alignItems: "center" }, statValue: { color: c.text, fontSize: 22, fontWeight: "900" }, statLabel: { color: c.dim, fontSize: 8.5, fontWeight: "900", marginTop: 3, letterSpacing: 0.7 },
    shareBtn: { minHeight: 46, marginTop: 14, borderRadius: 14, backgroundColor: "#DB2777", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, shareText: { color: "#fff", fontSize: 12.5, fontWeight: "900" },
    secondaryBtn: { minHeight: 44, marginTop: 10, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14 }, secondaryBtnText: { color: c.text, fontSize: 12, fontWeight: "800" },
  });
}
