import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView } from "react-native";
import { ChevronLeft, Swords, Users, EyeOff, RotateCcw, ArrowRight, Check, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { playApi } from "../api/play";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";

const GAME_META = {
  taste_battle: { title: "Taste Battle", subtitle: "İki içerikten hangisini seçersin?", icon: Swords },
  friend_quiz: { title: "Arkadaşını Tanıyor musun?", subtitle: "Arkadaşının zevkini ne kadar biliyorsun?", icon: Users },
  blind_pick: { title: "Blind Pick", subtitle: "İsim ve poster yok. Sadece ipuçları.", icon: EyeOff },
};

export default function PellixPlayScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [features, setFeatures] = useState(null);
  const [activeGame, setActiveGame] = useState(null);

  const refreshFeatures = useCallback(async () => {
    try {
      const data = await playApi.features(auth.token);
      setFeatures(data.features || {});
      if (activeGame && !data.features?.[activeGame]) setActiveGame(null);
    } catch {
      setFeatures({});
    }
  }, [auth.token, activeGame]);

  useEffect(() => { refreshFeatures(); }, [auth.token]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", refreshFeatures);
    return unsub;
  }, [navigation, refreshFeatures]);

  const enabledKeys = features ? Object.keys(GAME_META).filter((k) => features[k]) : [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => activeGame ? setActiveGame(null) : navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={21} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{activeGame ? GAME_META[activeGame]?.title : "Pellix Play"}</Text>
          <Text style={styles.headerSub}>{activeGame ? GAME_META[activeGame]?.subtitle : "Zevkini oynayarak keşfet"}</Text>
        </View>
      </View>

      {!features ? (
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
      ) : activeGame === "taste_battle" ? (
        <TasteBattle token={auth.token} styles={styles} c={c} onDisabled={() => { setActiveGame(null); refreshFeatures(); }} />
      ) : activeGame === "friend_quiz" ? (
        <FriendQuiz token={auth.token} styles={styles} c={c} onDisabled={() => { setActiveGame(null); refreshFeatures(); }} />
      ) : activeGame === "blind_pick" ? (
        <BlindPick token={auth.token} styles={styles} c={c} onDisabled={() => { setActiveGame(null); refreshFeatures(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.hubContent}>
          <Text style={styles.heroTitle}>Bugün ne oynayalım?</Text>
          <Text style={styles.heroSub}>Kısa turlar, hızlı kararlar. Oynadıkça zevk profilin hakkında daha fazla sinyal oluşur.</Text>
          {enabledKeys.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>Şu anda açık bir mini oyun yok.</Text></View>
          ) : enabledKeys.map((key) => {
            const meta = GAME_META[key];
            const Icon = meta.icon;
            return (
              <TouchableOpacity key={key} style={styles.gameCard} onPress={() => setActiveGame(key)} activeOpacity={0.82}>
                <View style={styles.gameIcon}><Icon size={22} color={c.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameTitle}>{meta.title}</Text>
                  <Text style={styles.gameSub}>{meta.subtitle}</Text>
                </View>
                <ArrowRight size={18} color={c.dim} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function TasteBattle({ token, styles, c, onDisabled }) {
  const [pairs, setPairs] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setDone(false); setIndex(0);
    try {
      const data = await playApi.tasteBattle(token);
      setPairs(data.pairs || []);
    } catch (e) {
      if (e.disabled) onDisabled();
      setPairs([]);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function choose(winner, loser) {
    playApi.chooseTasteBattle(token, winner.id, loser.id).catch((e) => { if (e.disabled) onDisabled(); });
    if (index >= pairs.length - 1) setDone(true); else setIndex((v) => v + 1);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;
  if (done) return <GameDone styles={styles} title="Tur tamamlandı" text={`${pairs.length} hızlı seçim yaptın.`} onAgain={load} />;
  const pair = pairs[index];
  if (!pair) return <GameDone styles={styles} title="Eşleşme bulunamadı" text="Biraz sonra tekrar dene." onAgain={load} />;

  return (
    <ScrollView contentContainerStyle={styles.gameContent}>
      <Text style={styles.progressText}>{index + 1} / {pairs.length}</Text>
      <Text style={styles.questionTitle}>Hangisini seçersin?</Text>
      <View style={styles.battleRow}>
        <MovieChoice movie={pair.left} styles={styles} onPress={() => choose(pair.left, pair.right)} />
        <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
        <MovieChoice movie={pair.right} styles={styles} onPress={() => choose(pair.right, pair.left)} />
      </View>
    </ScrollView>
  );
}

function FriendQuiz({ token, styles, c, onDisabled }) {
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setIndex(0); setScore(0); setFeedback(null);
    try { setData(await playApi.friendQuiz(token)); }
    catch (e) { if (e.disabled) onDisabled(); setData(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function answer(movie) {
    if (feedback) return;
    const q = data.questions[index];
    const correct = movie.id === q.correctMovieId;
    if (correct) setScore((s) => s + 1);
    setFeedback({ correct, chosenId: movie.id });
    playApi.answerFriendQuiz(token, data.friend.id, movie.id, q.correctMovieId).catch((e) => { if (e.disabled) onDisabled(); });
  }

  function next() {
    if (index >= data.questions.length - 1) setIndex(data.questions.length);
    else { setIndex((v) => v + 1); setFeedback(null); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;
  if (!data?.friend || !data.questions?.length) return <GameDone styles={styles} title="Şimdilik oynanamıyor" text={data?.unavailableReason || "Arkadaşlarından yeterli veri oluşunca açılacak."} onAgain={load} />;
  if (index >= data.questions.length) return <GameDone styles={styles} title={`${score}/${data.questions.length}`} text={`${data.friend.name}'i ne kadar iyi tanıdığını gördün.`} onAgain={load} />;

  const q = data.questions[index];
  return (
    <ScrollView contentContainerStyle={styles.gameContent}>
      <View style={styles.friendHeader}>
        <RetryImage source={{ uri: avatarOr(data.friend.avatarUrl, data.friend.id) }} style={styles.friendAvatar} />
        <View><Text style={styles.friendName}>{data.friend.name}</Text><Text style={styles.friendSub}>Hangisini tercih ederdi?</Text></View>
      </View>
      <Text style={styles.progressText}>{index + 1} / {data.questions.length} · Skor {score}</Text>
      <View style={styles.battleRow}>
        {[q.left, q.right].map((movie) => {
          const isCorrect = feedback && movie.id === q.correctMovieId;
          const isWrongChosen = feedback && feedback.chosenId === movie.id && !isCorrect;
          return <MovieChoice key={movie.id} movie={movie} styles={styles} onPress={() => answer(movie)} state={isCorrect ? "correct" : isWrongChosen ? "wrong" : null} />;
        })}
      </View>
      {feedback && (
        <TouchableOpacity style={styles.primaryBtn} onPress={next}>
          {feedback.correct ? <Check size={17} color={c.bg} /> : <X size={17} color={c.bg} />}
          <Text style={styles.primaryBtnText}>{feedback.correct ? "Bildin! Devam" : "Olmadı, devam et"}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function BlindPick({ token, styles, c, onDisabled }) {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setIndex(0); setRevealed(false);
    try { const d = await playApi.blindPick(token); setItems(d.results || []); }
    catch (e) { if (e.disabled) onDisabled(); setItems([]); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  function decide(interested) {
    const item = items[index];
    playApi.answerBlindPick(token, item.id, interested).catch((e) => { if (e.disabled) onDisabled(); });
    setRevealed(true);
  }
  function next() {
    if (index >= items.length - 1) setIndex(items.length); else { setIndex((v) => v + 1); setRevealed(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;
  if (index >= items.length) return <GameDone styles={styles} title="Blind tur tamamlandı" text={`${items.length} içerik gördün.`} onAgain={load} />;
  const item = items[index];
  if (!item) return <GameDone styles={styles} title="İçerik bulunamadı" text="Biraz sonra tekrar dene." onAgain={load} />;
  const clue = item.clue || {};

  return (
    <ScrollView contentContainerStyle={styles.gameContent}>
      <Text style={styles.progressText}>{index + 1} / {items.length}</Text>
      {!revealed ? (
        <>
          <View style={styles.blindCard}>
            <EyeOff size={34} color={c.accent} />
            <Text style={styles.blindTitle}>Bu ne olabilir?</Text>
            <Text style={styles.clueText}>{clue.year || "?"} · {clue.type === "tv" ? "Dizi" : "Film"}</Text>
            <Text style={styles.clueText}>{(clue.genres || []).join(" · ") || "Tür gizli"}</Text>
            <Text style={styles.clueText}>IMDb {clue.imdb || "?"}{clue.runtime ? ` · ${clue.runtime} dk` : ""}</Text>
          </View>
          <View style={styles.choiceButtons}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => decide(false)}><Text style={styles.secondaryBtnText}>Geç</Text></TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnFlex} onPress={() => decide(true)}><Text style={styles.primaryBtnText}>İzlerim</Text></TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.revealCard}>
            {!!item.reveal?.poster && <Image source={{ uri: item.reveal.poster }} style={styles.revealPoster} />}
            <Text style={styles.revealTitle}>{item.reveal?.title}</Text>
            <Text style={styles.revealMeta}>{item.reveal?.year} · {item.reveal?.type === "tv" ? "Dizi" : "Film"} · IMDb {item.reveal?.imdb}</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={next}><Text style={styles.primaryBtnText}>Sonraki</Text><ArrowRight size={17} color={c.bg} /></TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function MovieChoice({ movie, styles, onPress, state }) {
  return (
    <TouchableOpacity style={[styles.movieChoice, state === "correct" && styles.correctChoice, state === "wrong" && styles.wrongChoice]} onPress={onPress} activeOpacity={0.84}>
      {!!movie.poster && <Image source={{ uri: movie.poster }} style={styles.choicePoster} />}
      <Text style={styles.choiceTitle} numberOfLines={2}>{movie.title}</Text>
      <Text style={styles.choiceMeta}>{movie.year || ""}{movie.imdb ? ` · IMDb ${movie.imdb}` : ""}</Text>
    </TouchableOpacity>
  );
}

function GameDone({ styles, title, text, onAgain }) {
  return (
    <View style={styles.centerPad}>
      <Text style={styles.doneTitle}>{title}</Text>
      <Text style={styles.doneText}>{text}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onAgain}><RotateCcw size={16} color="#0d0d10" /><Text style={styles.retryText}>Tekrar Oyna</Text></TouchableOpacity>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: c.border },
    backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 16, fontWeight: "900", color: c.text },
    headerSub: { fontSize: 10.5, color: c.dim, marginTop: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    centerPad: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
    hubContent: { padding: 18, paddingBottom: 40 },
    heroTitle: { fontSize: 24, fontWeight: "900", color: c.text, marginTop: 8 },
    heroSub: { fontSize: 12.5, lineHeight: 18, color: c.dim, marginTop: 6, marginBottom: 20 },
    gameCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
    gameIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: `${c.accent}1f`, alignItems: "center", justifyContent: "center" },
    gameTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    gameSub: { fontSize: 11, color: c.dim, marginTop: 3 },
    emptyCard: { padding: 20, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    emptyText: { color: c.dim, textAlign: "center", fontSize: 12 },
    gameContent: { padding: 18, paddingBottom: 40 },
    progressText: { color: c.dim, fontSize: 11, fontWeight: "700", textAlign: "center", marginBottom: 10 },
    questionTitle: { color: c.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 18 },
    battleRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    movieChoice: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 8, overflow: "hidden" },
    correctChoice: { borderColor: "#22c55e", borderWidth: 2 },
    wrongChoice: { borderColor: "#ef4444", borderWidth: 2 },
    choicePoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 11, backgroundColor: c.surface2 },
    choiceTitle: { color: c.text, fontWeight: "800", fontSize: 13, marginTop: 8 },
    choiceMeta: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    vsBadge: { position: "absolute", zIndex: 2, left: "50%", top: 115, marginLeft: -18, width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.bg },
    vsText: { color: c.bg, fontWeight: "900", fontSize: 11 },
    friendHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 12 },
    friendAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.surface2 },
    friendName: { color: c.text, fontSize: 14, fontWeight: "800" },
    friendSub: { color: c.dim, fontSize: 11, marginTop: 2 },
    primaryBtn: { marginTop: 16, minHeight: 46, borderRadius: 13, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, paddingHorizontal: 16 },
    primaryBtnFlex: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    primaryBtnText: { color: c.bg, fontSize: 13, fontWeight: "900" },
    secondaryBtn: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    secondaryBtnText: { color: c.text, fontSize: 13, fontWeight: "800" },
    choiceButtons: { flexDirection: "row", gap: 10, marginTop: 14 },
    blindCard: { minHeight: 270, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", padding: 24 },
    blindTitle: { color: c.text, fontSize: 20, fontWeight: "900", marginTop: 14, marginBottom: 18 },
    clueText: { color: c.dim, fontSize: 13, marginTop: 7, textAlign: "center" },
    revealCard: { alignItems: "center", padding: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18 },
    revealPoster: { width: 160, aspectRatio: 2 / 3, borderRadius: 14, backgroundColor: c.surface2 },
    revealTitle: { color: c.text, fontSize: 18, fontWeight: "900", marginTop: 14, textAlign: "center" },
    revealMeta: { color: c.dim, fontSize: 11.5, marginTop: 5 },
    doneTitle: { color: c.text, fontSize: 24, fontWeight: "900", textAlign: "center" },
    doneText: { color: c.dim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 8 },
    retryBtn: { marginTop: 20, backgroundColor: c.accent, borderRadius: 13, minHeight: 44, paddingHorizontal: 18, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
    retryText: { color: c.bg, fontSize: 12.5, fontWeight: "900" },
  });
}
