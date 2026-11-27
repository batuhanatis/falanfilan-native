import { t as translateUI, getLocale } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Check, X, Share2, Swords, AlertCircle, Trophy } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { duelApi } from "../api/duels";
import ScreenHeader from "../components/ScreenHeader";
import RetryImage from "../components/RetryImage";
import { GoldWash, SALON } from "../components/salon/SalonKit";
import { GoldenBanner, pointsLine } from "../components/duel/DuelExtras";
import { FONTS } from "../theme/fonts";
import { avatarOr } from "../utils/avatar";
import ShareFan, { shareOptions } from "../components/salon/ShareFan";
import ShareCardModal from "../components/ShareCardModal";
import DailyDuelShareCard, { DAILY_CARD_HEIGHT, dailyStanding } from "../components/DailyDuelShareCard";
import { hapticSuccess, hapticWarning, hapticLight } from "../utils/haptics";

// Günün Düellosu: o gün herkese aynı 8 soru (8 farklı yapım, kolaydan zora, son soru altın).
// Günde bir kez; süre ve puan sunucuda (soru istenince saat başlar, yeniden açmak sıfırlamaz).
// Sonunda bugün oynayan arkadaşlar arasındaki sıra ve paylaşılabilir skor.
const LEVEL_LABEL = { 1: "KOLAY", 2: "ORTA", 3: "ZOR" };
const LETTERS = ["A", "B", "C", "D"];
const REVEAL_MS = 1600;
// Paylaşım linki: WhatsApp/iMessage'da "Günün Düellosu" önizlemesiyle gidiyor, dokununca uygulamada
// bu ekran açılıyor (RootNavigator "u/oyun/gunun-duellosu"). Story'de Bağlantı çıkartmasına bu yapıştırılıyor.
const DAILY_URL = "https://open.pellix.app/u/oyun/gunun-duellosu";

export default function QuizDailyScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.bottom]);
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState(false);
  const [play, setPlay] = useState(null); // { question, deadline, offset, score }
  const [reveal, setReveal] = useState(null); // { choice, correctIndex, points, golden }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const answeredRef = useRef(false);

  const load = useCallback(async () => {
    setFailed(false);
    try { setInfo(await duelApi.daily(auth.token)); } catch { setFailed(true); }
  }, [auth?.token]);
  useEffect(() => { load(); }, [load]);

  async function nextQuestion() {
    setError(""); setBusy(true);
    try {
      const r = await duelApi.dailyNext(auth.token);
      answeredRef.current = false;
      setReveal(null);
      setPlay({ question: r.question, deadline: r.deadline, offset: r.serverNow - Date.now(), score: r.score });
    } catch (e) {
      if (e.code === "DAILY_DONE") { setPlay(null); await load(); }
      else setError(e.message);
    }
    setBusy(false);
  }

  async function answer(choice) {
    if (!play || answeredRef.current) return;
    answeredRef.current = true;
    if (choice != null) hapticLight();
    setReveal({ choice, pending: true });
    try {
      const r = await duelApi.dailyAnswer(auth.token, play.question.index, choice);
      if (r.correct) hapticSuccess(); else hapticWarning();
      setReveal({ choice, correctIndex: r.correctIndex, points: r.points, golden: r.golden });
      setPlay((p) => ({ ...p, score: r.score }));
      setTimeout(() => { if (r.done) { setPlay(null); setReveal(null); load(); } else nextQuestion(); }, REVEAL_MS);
    } catch (e) {
      setError(e.message);
      setTimeout(() => { setPlay(null); setReveal(null); load(); }, REVEAL_MS);
    }
  }

  const header = <ScreenHeader title={translateUI("Günün Düellosu")} subtitle={info?.day ? formatDay(info.day) : translateUI("Herkese aynı 8 soru")} onBack={() => navigation.goBack()} />;
  if (!info && !failed) return <View style={styles.root}>{header}<View style={[styles.root, styles.center]}><ActivityIndicator color={c.accent} /></View></View>;
  if (failed) {
    return (
      <View style={styles.root}>{header}
        <View style={[styles.root, styles.center, { padding: 28 }]}>
          <AlertCircle size={22} color={c.dim} />
          <Text style={styles.dim}>{translateUI("Günün düellosu alınamadı.")}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={load}><Text style={styles.secondaryText}>{translateUI("Tekrar dene")}</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  if (play) {
    return (
      <View style={styles.root}>{header}
        <DailyQuestion styles={styles} c={c} play={play} reveal={reveal} onAnswer={answer} />
        {!!error && <Text style={[styles.dim, { color: c.danger, textAlign: "center", padding: 12 }]}>{translateUI(error)}</Text>}
      </View>
    );
  }

  const run = info.run;
  const finished = !!run?.finished;
  const shareMsg = finished ? translateUI("Pellix Günün Düellosu: {0} puan, 8 sorudan {1} doğru. Sen kaç yaparsın?", { 0: run.score, 1: run.correct }) : "";
  const meOnBoard = info.friends.find((f) => f.me);
  return (
    <View style={styles.root}>{header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <GoldWash height={170} />
          <View style={styles.heroIcon}>{finished ? <Trophy size={22} color={c.accent} /> : <CalendarDays size={22} color={c.accent} />}</View>
          <Text style={styles.eyebrow}>{translateUI("GÜNÜN DÜELLOSU · {0}", { 0: formatDay(info.day).toLocaleUpperCase(getLocale()) })}</Text>
          {finished ? (
            <>
              <Text style={styles.bigScore}>{run.score}</Text>
              <Text style={styles.heroSub}>{translateUI("Bugünkü puanın · 8 sorudan {0} doğru", { 0: run.correct })}</Text>
              {!!standingText(info) && <Text style={styles.percent}>{standingText(info)}</Text>}
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>{translateUI("Bugünün 8 sorusu")}</Text>
              <Text style={styles.heroSub}>{translateUI("Herkese aynı sorular: 8 farklı yapımdan, kolaydan zora. Son soru altın soru, puanı 2 kat. Günde bir kez oynanır.")}</Text>
              <View style={styles.ruleRow}>
                <Rule styles={styles} value="8" label={translateUI("SORU")} />
                <Rule styles={styles} value="15" label={translateUI("SANİYE")} />
                <Rule styles={styles} value="2x" label={translateUI("ALTIN SORU")} />
              </View>
            </>
          )}
        </View>

        {finished ? (
          <>
            <ShareFan
              style={styles.primaryBtn}
              accessibilityLabel={translateUI("Skorunu paylaş")}
              options={shareOptions({ message: shareMsg, url: DAILY_URL, copy: false, card: () => setShowShare(true) })}
            >
              <Share2 size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("Skorunu paylaş")}</Text>
            </ShareFan>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("QuizDuel")}><Swords size={15} color={c.text} /><Text style={styles.secondaryText}>{translateUI("Bir arkadaşını düelloya çağır")}</Text></TouchableOpacity>
            <Text style={styles.foot}>{translateUI("Yarın yeni 8 soru gelecek.")}</Text>
          </>
        ) : !info.available ? (
          <Text style={styles.dim}>{translateUI("Bugünün soruları hazırlanıyor.")}</Text>
        ) : (
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={nextQuestion}>
            {busy ? <ActivityIndicator color={SALON.onGold} /> : <Text style={styles.primaryText}>{run && run.index > 0 ? translateUI("Kaldığın yerden devam et") : translateUI("Başla")}</Text>}
          </TouchableOpacity>
        )}
        {!!error && <Text style={[styles.dim, { color: c.danger, textAlign: "center", marginTop: 8 }]}>{translateUI(error)}</Text>}

        <Text style={styles.section}>{translateUI("BUGÜN OYNAYAN ARKADAŞLARIN")}</Text>
        {info.friends.length === 0 ? (
          <Text style={styles.dim}>{finished ? translateUI("Arkadaşlarından bugün oynayan yok. İlk sen oynadın; skorunu paylaş.") : translateUI("Arkadaşlarından bugün oynayan yok. İlk sen oyna.")}</Text>
        ) : info.friends.map((f) => (
          <View key={f.user?.id ?? f.rank} style={[styles.boardRow, f.me && styles.boardMe]}>
            <Text style={[styles.rank, f.rank === 1 && { color: c.accent }]}>{f.rank}</Text>
            <RetryImage source={{ uri: avatarOr(f.user?.avatarUrl, f.user?.id) }} style={styles.avatar} />
            <Text style={styles.boardName} numberOfLines={1}>{f.me ? translateUI("Sen") : f.user?.name}</Text>
            <Text style={styles.boardMeta}>{translateUI("{0}/8", { 0: f.correct })}</Text>
            <Text style={styles.boardScore}>{f.score}</Text>
          </View>
        ))}
      </ScrollView>
      {showShare && finished && (
        <ShareCardModal
          onClose={() => setShowShare(false)}
          shareMessage={shareMsg}
          shareUrl={DAILY_URL}
          previewHeight={DAILY_CARD_HEIGHT}
          instagramStory={{ link: DAILY_URL }}
        >
          <DailyDuelShareCard
            dayLabel={formatDay(info.day)}
            score={run.score}
            correct={run.correct}
            total={info.total || 8}
            marks={run.marks || []}
            percentile={info.percentile}
            standing={info.standing}
            friendRank={meOnBoard?.rank ?? null}
            friendCount={info.friends.length}
          />
        </ShareCardModal>
      )}
    </View>
  );
}

function formatDay(day) {
  try {
    const [y, m, d] = String(day).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(getLocale(), { day: "numeric", month: "long" });
  } catch { return String(day); }
}

function Rule({ styles, value, label }) {
  return <View style={styles.rule}><Text style={styles.ruleValue}>{value}</Text><Text style={styles.ruleLabel}>{label}</Text></View>;
}

// Soru: süre çubuğu sunucunun saatine göre; süre dolunca boş cevap gönderilir.
function DailyQuestion({ styles, c, play, reveal, onAnswer }) {
  const q = play.question;
  const anim = useRef(new Animated.Value(1)).current;
  const [left, setLeft] = useState(15);
  useEffect(() => {
    const remain = Math.max(0, play.deadline - (Date.now() + play.offset));
    anim.setValue(Math.min(1, remain / 15000));
    const a = Animated.timing(anim, { toValue: 0, duration: remain, easing: Easing.linear, useNativeDriver: true });
    a.start();
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((play.deadline - (Date.now() + play.offset)) / 1000))), 250);
    const end = setTimeout(() => onAnswer(null), remain + 150);
    return () => { a.stop(); clearInterval(tick); clearTimeout(end); };
  }, [q.index]);
  const chosen = reveal?.choice;
  const done = reveal && !reveal.pending;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.qHead}>
        <Text style={styles.qNumber}>{`${q.number} / ${q.total}`}</Text>
        <Text style={styles.seconds}>{reveal ? " " : left}</Text>
        <Text style={styles.qScore}>{translateUI("{0} puan", { 0: play.score })}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { transformOrigin: "left", transform: [{ scaleX: anim }] }]} />
      </View>
      <Text style={styles.qTag} numberOfLines={1}>{translateUI(LEVEL_LABEL[q.level] || "")} · {q.title}</Text>
      {!!q.golden && <GoldenBanner c={c} />}
      <Text style={styles.qText}>{q.text}</Text>
      {q.options.map((o, i) => {
        const isMine = chosen === i;
        const isRight = done && reveal.correctIndex === i;
        const isWrongMine = done && isMine && !isRight;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.option, isMine && !done && styles.optionMine, isRight && styles.optionRight, isWrongMine && styles.optionWrong, reveal && !isMine && !isRight && { opacity: 0.55 }]}
            disabled={!!reveal}
            onPress={() => onAnswer(i)}
            activeOpacity={0.85}
            accessibilityLabel={o}
          >
            <View style={[styles.letter, isMine && !done && { backgroundColor: c.accent }, isRight && { backgroundColor: c.accent2 }, isWrongMine && { backgroundColor: c.danger }]}>
              {isRight ? <Check size={13} color="#fff" /> : isWrongMine ? <X size={13} color="#fff" /> : <Text style={[styles.letterText, isMine && { color: SALON.onGold }]}>{LETTERS[i]}</Text>}
            </View>
            <Text style={styles.optionText}>{o}</Text>
          </TouchableOpacity>
        );
      })}
      <View accessibilityLiveRegion="polite">
        {done && (
          <Text style={[styles.status, { color: reveal.points ? c.accent : c.dim }]}>
            {reveal.points ? pointsLine(reveal.points, { golden: reveal.golden }) : chosen == null ? translateUI("Süre doldu") : translateUI("Bu soru olmadı")}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

// Paylaşım kartıyla aynı kural (DailyDuelShareCard): az kişi oynadıysa ya da ilk üçteyse sıra
// ("40 kişi arasında 2. sıradasın"), kalabalıkta üst yarıdaysa yüzdelik dilim ("ilk %12").
function standingText(info) {
  const s = dailyStanding(info.percentile, info.standing);
  if (!s) return null;
  if (s.kind === "top") return translateUI("Bugün oynayanların ilk %{0} dilimindesin", { 0: s.top });
  return translateUI("Bugün oynayan {1} kişi arasında {0}. sıradasın", { 0: s.rank, 1: s.players });
}

function makeStyles(c, insets) {
  const safeBottom = Math.max(36, insets.bottom + 24);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center", gap: 10 },
    content: { padding: 16, paddingBottom: safeBottom },
    hero: { borderRadius: 18, padding: 20, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    heroIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    eyebrow: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3 },
    heroTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 32, lineHeight: 35, marginTop: 4 },
    heroSub: { color: c.dim, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    bigScore: { color: c.accent, fontFamily: FONTS.marquee, fontSize: 64, lineHeight: 68, marginTop: 4 },
    percent: { color: c.text, fontSize: 13, fontWeight: "800", marginTop: 8 },
    ruleRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    rule: { flex: 1, backgroundColor: c.bg, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 10, alignItems: "center" },
    ruleValue: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24 },
    ruleLabel: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1 },
    primaryBtn: { minHeight: 48, marginTop: 14, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    primaryText: { color: SALON.onGold, fontSize: 13, fontWeight: "900" },
    secondaryBtn: { minHeight: 46, marginTop: 10, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 16 },
    secondaryText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    foot: { color: c.dim, fontSize: 11, textAlign: "center", marginTop: 10 },
    dim: { color: c.dim, fontSize: 12, lineHeight: 17 },
    section: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 22, marginBottom: 9 },
    boardRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 7 },
    boardMe: { borderColor: SALON.goldLine, backgroundColor: SALON.goldTint },
    rank: { width: 22, color: c.dim, fontFamily: FONTS.marquee, fontSize: 18, textAlign: "center" },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface2 },
    boardName: { flex: 1, color: c.text, fontSize: 13, fontWeight: "800" },
    boardMeta: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10 },
    boardScore: { minWidth: 48, textAlign: "right", color: c.text, fontFamily: FONTS.marquee, fontSize: 20 },
    qHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    qNumber: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1, width: 80 },
    seconds: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26, minWidth: 34, textAlign: "center" },
    qScore: { color: c.text, fontFamily: FONTS.marquee, fontSize: 18, width: 80, textAlign: "right" },
    track: { height: 4, borderRadius: 2, backgroundColor: c.surface2, overflow: "hidden" },
    fill: { position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", backgroundColor: c.accent },
    qTag: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1, marginTop: 14 },
    qText: { color: c.text, fontSize: 19, fontWeight: "800", lineHeight: 26, marginTop: 8, marginBottom: 16 },
    option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9 },
    optionMine: { borderColor: c.accent, backgroundColor: SALON.goldTint },
    optionRight: { borderColor: c.accent2, backgroundColor: `${c.accent2}1f` },
    optionWrong: { borderColor: c.danger, backgroundColor: `${c.danger}14` },
    letter: { width: 28, height: 28, borderRadius: 8, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    letterText: { color: c.text, fontFamily: FONTS.monoMedium, fontSize: 12 },
    optionText: { flex: 1, color: c.text, fontSize: 14, fontWeight: "700", lineHeight: 19 },
    status: { color: c.dim, fontSize: 12.5, textAlign: "center", marginTop: 8, fontWeight: "800" },
  });
}
