import { t as translateUI } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoldWash, SALON } from "../components/salon/SalonKit";
import { FONTS } from "../theme/fonts";
import { Swords, Users, Trophy, Clock3, ChevronRight, Share2, RotateCcw, AlertCircle } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { friendBattleApi } from "../api/friendBattle";
import ScreenHeader from "../components/ScreenHeader";
import ShareFan, { shareOptions } from "../components/salon/ShareFan";
import RetryImage from "../components/RetryImage";
import { avatarOr } from "../utils/avatar";
import { hapticSuccess, hapticLight } from "../utils/haptics";

export default function FriendBattleScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.top, insets.bottom, insets.left, insets.right]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [battles, setBattles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [creatingId, setCreatingId] = useState(null);
  const [battle, setBattle] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const initialBattleId = route?.params?.battleId;

  const loadLobby = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    setActionError("");
    try {
      const [battleData, friendData] = await Promise.all([
        friendBattleApi.inbox(auth.token),
        api.friends(auth.token).catch(() => ({ friends: [] })),
      ]);
      setBattles(battleData.battles || []);
      setFriends(friendData.friends || []);
    } catch (e) {
      if (e.unavailable) setUnavailable(true);
      else setActionError(e.message || "Meydan okumalar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  const openBattle = useCallback(async (battleId) => {
    if (!battleId) return;
    setLoading(true);
    setActionError("");
    try {
      const data = await friendBattleApi.detail(auth.token, battleId);
      setBattle(data);
      setAnswers(data.myAnswers || []);
      setIndex(Math.min(data.myAnswers?.length || 0, Math.max(0, (data.questions || []).length - 1)));
    } catch (e) {
      if (e.unavailable) setUnavailable(true);
      else setActionError(e.message || "Battle açılamadı.");
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
    setActionError("");
    try {
      const data = await friendBattleApi.create(auth.token, friend.id);
      hapticSuccess();
      await openBattle(data.battleId);
    } catch (e) {
      if (e.unavailable) setUnavailable(true);
      else setActionError(e.message || "Battle başlatılamadı.");
    }
    setCreatingId(null);
  }

  async function choose(movieId) {
    if (!battle?.questions?.length || submitting) return;
    hapticLight();
    setActionError("");
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
    } catch (e) {
      setActionError(e.message || "Cevapların gönderilemedi. Son seçimine tekrar dokunarak yeniden deneyebilirsin.");
    } finally {
      setSubmitting(false);
    }
  }

  function backToLobby() {
    setBattle(null);
    setAnswers([]);
    setIndex(0);
    setActionError("");
    loadLobby();
  }

  if (loading) {
    return <View style={[styles.root, styles.center]}><ActivityIndicator color={c.accent} /></View>;
  }

  if (unavailable) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={translateUI("Friend Battle")} onBack={() => navigation.goBack()} />
        <View style={styles.centerContent}>
          <View style={styles.bigIcon}><Swords size={28} color={c.accent} /></View>
          <Text style={styles.emptyTitle}>{translateUI("Friend Battle hazırlanıyor")}</Text>
          <Text style={styles.emptyText}>{translateUI("Bu özellik backend yayını tamamlandığında burada açılacak.")}</Text>
        </View>
      </View>
    );
  }

  if (battle) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={translateUI("Friend Battle")} onBack={backToLobby} subtitle={battle.opponent?.name ? translateUI("{0} ile", {0: battle.opponent.name}) : undefined} />
        {battle.status === "completed" && battle.result ? (
          <BattleResult battle={battle} styles={styles} onAgain={backToLobby} />
        ) : battle.mySubmitted ? (
          <Waiting battle={battle} styles={styles} onBack={backToLobby} />
        ) : (
          <BattlePlay battle={battle} index={index} styles={styles} onChoose={choose} submitting={submitting} error={actionError} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={translateUI("Friend Battle")} subtitle={translateUI("Aynı sorular, ayrı zamanlar")} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <GoldWash height={170} />
          <View style={styles.heroIcon}><Swords size={22} color={c.accent} /></View>
          <Text style={styles.heroEyebrow}>{translateUI("ASENKRON MEYDAN OKUMA")}</Text>
          <Text style={styles.heroTitle}>{translateUI("Aynı 8 seçimi yapın.")}</Text>
          <Text style={styles.heroSub}>{translateUI("Aynı anda online olmanız gerekmiyor. İkiniz de tamamlayınca beğeni uyumunuz ortaya çıkıyor.")}</Text>
        </View>

        {!!actionError && <View style={styles.errorBox}><AlertCircle size={14} color={c.danger} /><Text style={styles.errorText}>{actionError}</Text></View>}

        {battles.length > 0 && <>
          <Text style={styles.sectionLabel}>{translateUI("MEYDAN OKUMALAR")}</Text>
          {battles.map((item) => (
            <TouchableOpacity key={item.id} style={styles.battleRow} onPress={() => openBattle(item.id)} activeOpacity={0.82}>
              <RetryImage source={{ uri: avatarOr(item.opponent?.avatarUrl, item.opponent?.id) }} style={styles.avatar} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.opponent?.name || translateUI("Arkadaşın")}</Text>
                <Text style={styles.rowSub}>{statusText(item)}</Text>
              </View>
              {item.status === "completed" && item.result ? <Text style={styles.scorePill}>{translateUI("%")}{item.result.percent}</Text> : <ChevronRight size={17} color={c.dim} />}
            </TouchableOpacity>
          ))}
        </>}

        <Text style={styles.sectionLabel}>{translateUI("YENİ BATTLE BAŞLAT")}</Text>
        {friends.length === 0 ? (
          <View style={styles.emptyCard}><Users size={20} color={c.dim} /><Text style={styles.emptyText}>{translateUI("Battle başlatmak için önce bir arkadaş ekle.")}</Text></View>
        ) : friends.map((friend) => (
          <TouchableOpacity key={friend.id} style={styles.friendRow} onPress={() => create(friend)} activeOpacity={0.82} disabled={!!creatingId}>
            <RetryImage source={{ uri: avatarOr(friend.avatar_url || friend.avatarUrl, friend.id) }} style={styles.avatar} />
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{friend.name}</Text><Text style={styles.rowSub}>{translateUI("8 seçimlik meydan okuma gönder")}</Text></View>
            {creatingId === friend.id ? <ActivityIndicator size="small" color={c.accent} /> : <View style={styles.challengeBtn}><Swords size={14} color="#1a150c" /></View>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function BattlePlay({ battle, index, styles, onChoose, submitting, error }) {
  const q = battle.questions?.[index];
  if (!q) return null;
  return (
    <ScrollView contentContainerStyle={styles.playContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.progress}>{index + 1}{translateUI(" / ")}{battle.questions.length}</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((index + 1) / battle.questions.length) * 100}%` }]} /></View>
      <Text style={styles.question}>{translateUI("Hangisini seçersin?")}</Text>
      <Text style={styles.questionSub}>{translateUI("İlk içinden geleni seç. Arkadaşın aynı soruları kendi zamanında görecek.")}</Text>
      <View style={styles.choiceRow}>
        <Choice movie={q.left} styles={styles} onPress={() => onChoose(q.left.id)} disabled={submitting} />
        <View style={styles.vs}><Text style={styles.vsText}>{translateUI("VS")}</Text></View>
        <Choice movie={q.right} styles={styles} onPress={() => onChoose(q.right.id)} disabled={submitting} />
      </View>
      {submitting && <ActivityIndicator style={{ marginTop: 20 }} color={c.accent} />}
      {!!error && <Text style={styles.playError}>{translateUI(error)}</Text>}
    </ScrollView>
  );
}

function Choice({ movie, styles, onPress, disabled }) {
  return (
    <TouchableOpacity style={styles.choice} onPress={onPress} activeOpacity={0.86} disabled={disabled}>
      <Image source={{ uri: movie.poster }} style={styles.choicePoster} />
      <Text style={styles.choiceTitle} numberOfLines={2}>{movie.title}</Text>
      <Text style={styles.choiceMeta}>{movie.year}{translateUI(" · ")}{translateUI(movie.type)}</Text>
    </TouchableOpacity>
  );
}

function Waiting({ battle, styles, onBack }) {
  return (
    <View style={styles.centerContent}>
      <View style={styles.bigIcon}><Clock3 size={28} color={c.accent} /></View>
      <Text style={styles.emptyTitle}>{translateUI("Sen tamamladın ✓")}</Text>
      <Text style={styles.emptyText}>{battle.opponent?.name || translateUI("Arkadaşın")}{translateUI(" turunu bitirince ortak skorunuz burada açılacak.")}</Text>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}><Text style={styles.secondaryBtnText}>{translateUI("Meydan Okumalara Dön")}</Text></TouchableOpacity>
    </View>
  );
}

function BattleResult({ battle, styles, onAgain }) {
  const result = battle.result;
  const message = result.percent >= 80 ? "Aynı rafın insanısınız 🔥" : result.percent >= 60 ? "Beğenileriniz oldukça yakın" : result.percent >= 40 ? "Bazı filmlerde buluşuyorsunuz 🎬" : "Film gecesi pazarlığı zor geçecek 😄";
  const shareFanOptions = shareOptions({
    message: translateUI("{0} Friend Battle sonucumuz: %{1} beğeni uyumu. Pellix: {2}", { 0: battle.opponent?.name || translateUI("Arkadaşımla"), 1: result.percent, 2: "https://www.pellix.app" }),
    url: "https://www.pellix.app",
    copy: false,
  });
  return (
    <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
      <View style={styles.resultHero}>
        <GoldWash height={180} />
        <Trophy size={28} color={c.accent} />
        <Text style={styles.resultPercent}>{translateUI("%")}{result.percent}</Text>
        <Text style={styles.resultTitle}>{translateUI("BEĞENİ UYUMU")}</Text>
        <Text style={styles.resultSub}>{translateUI(message)}</Text>
      </View>
      <View style={styles.resultStats}>
        <View style={styles.stat}><Text style={styles.statValue}>{result.agreements}</Text><Text style={styles.statLabel}>{translateUI("AYNI SEÇİM")}</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{result.total}</Text><Text style={styles.statLabel}>{translateUI("TOPLAM")}</Text></View>
      </View>
      <ShareFan style={styles.shareBtn} options={shareFanOptions} accessibilityLabel={translateUI("Sonucu paylaş")}><Share2 size={16} color="#1a150c" /><Text style={styles.shareText}>{translateUI("Sonucu Paylaş")}</Text></ShareFan>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onAgain}><RotateCcw size={15} color={c.text} /><Text style={styles.secondaryBtnText}>{translateUI("Başka Battle Başlat")}</Text></TouchableOpacity>
    </ScrollView>
  );
}

function statusText(item) {
  if (item.status === "completed") return "Sonuç hazır";
  if (item.mySubmitted) return `${item.opponent?.name || "Arkadaşın"} bekleniyor`;
  if (item.theirSubmitted) return "Sıra sende · arkadaşın tamamladı";
  return item.createdByMe ? "Meydan okuman gönderildi" : "Sana meydan okudu";
}

function makeStyles(c, insets) {
  const safeBottom = Math.max(36, insets.bottom + 24);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center" },
    content: { padding: 16, paddingBottom: safeBottom },
    hero: { borderRadius: 18, padding: 20, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    heroIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    heroEyebrow: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3 },
    heroTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 32, marginTop: 4 },
    heroSub: { color: c.dim, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    errorBox: { marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: `${c.danger}12`, borderWidth: 1, borderColor: `${c.danger}35`, borderRadius: 12, padding: 10 },
    errorText: { flex: 1, color: c.danger, fontSize: 10.5, lineHeight: 15 },
    sectionLabel: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 22, marginBottom: 9 },
    battleRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 11, marginBottom: 8 },
    friendRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 11, marginBottom: 8 },
    avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: c.surface2 },
    rowTitle: { color: c.text, fontSize: 13.5, fontWeight: "800" },
    rowSub: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    scorePill: { color: "#1a150c", fontSize: 11, fontWeight: "900", backgroundColor: c.accent, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
    challengeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    emptyCard: { alignItems: "center", gap: 8, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 22 },
    centerContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingTop: 28, paddingBottom: safeBottom },
    bigIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    emptyTitle: { color: c.text, fontSize: 18, fontWeight: "900", textAlign: "center" },
    emptyText: { color: c.dim, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 },
    playContent: { padding: 18, paddingBottom: safeBottom },
    progress: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.8, textAlign: "center" },
    progressTrack: { height: 5, backgroundColor: c.surface2, borderRadius: 999, marginTop: 8, overflow: "hidden" },
    progressFill: { height: 5, backgroundColor: c.accent, borderRadius: 999 },
    question: { color: c.text, fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 28 },
    questionSub: { color: c.dim, fontSize: 11.5, textAlign: "center", lineHeight: 17, marginTop: 5 },
    choiceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 },
    choice: { flex: 1, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, overflow: "hidden", paddingBottom: 10 },
    choicePoster: { width: "100%", aspectRatio: 2 / 3, backgroundColor: c.surface2 },
    choiceTitle: { color: c.text, fontSize: 12.5, fontWeight: "800", paddingHorizontal: 9, marginTop: 8 },
    choiceMeta: { color: c.dim, fontSize: 9.5, paddingHorizontal: 9, marginTop: 2 },
    vs: { position: "absolute", zIndex: 5, left: "50%", marginLeft: -19, width: 38, height: 38, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.bg },
    vsText: { color: "#1a150c", fontFamily: FONTS.marquee, fontSize: 14 },
    playError: { color: c.danger, fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 14 },
    resultContent: { padding: 18, paddingBottom: safeBottom },
    resultHero: { borderRadius: 18, padding: 26, alignItems: "center", overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    resultPercent: { color: c.accent, fontFamily: FONTS.marquee, fontSize: 76, lineHeight: 80, marginTop: 6 },
    resultTitle: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.3 },
    resultSub: { color: c.text, opacity: 0.86, fontSize: 12.5, marginTop: 6, textAlign: "center" },
    resultStats: { flexDirection: "row", gap: 10, marginTop: 12 },
    stat: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, alignItems: "center" },
    statValue: { color: c.text, fontFamily: FONTS.marquee, fontSize: 28 },
    statLabel: { color: c.dim, fontSize: 8.5, fontWeight: "900", marginTop: 3, letterSpacing: 0.7 },
    shareBtn: { minHeight: 46, marginTop: 14, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    shareText: { color: "#1a150c", fontSize: 12.5, fontWeight: "900" },
    secondaryBtn: { minHeight: 44, marginTop: 10, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14 },
    secondaryBtnText: { color: c.text, fontSize: 12, fontWeight: "800" },
  });
}
