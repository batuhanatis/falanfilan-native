import { t as translateUI, getLocale, getLanguage } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView, Animated, Easing, AccessibilityInfo } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONTS } from "../theme/fonts";
import { ChevronLeft, Swords, Users, EyeOff, Quote, RotateCcw, ArrowRight, Check, X, Sparkles, Share2, Trophy, LockKeyhole, Wand2, Puzzle } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { playApi } from "../api/play";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import ShareCardModal from "../components/ShareCardModal";
import ShareFan, { shareOptions } from "../components/salon/ShareFan";

// Oyun linkleri: open.pellix.app/u/oyun/<oyun> — önizlemede oyunun kartı, dokununca uygulamada oyun açılıyor.
const playUrl = (slug) => `https://open.pellix.app/u/oyun/${slug}`;
import PlayResultShareCard from "../components/PlayResultShareCard";
import { accusativeTR } from "../utils/turkishSuffix";

// DailyPosterPuzzleScreen'deki sonuç anahtarıyla AYNI — bugünün bulmacası çözüldü mü?
function todaysPuzzleResultKey() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `pellix_daily_poster_result_v2_${date}`;
}

// Salon dili: her oyun lobideki bir salon. Renkli gradyanlar yerine koyu yüzey, altın vurgu,
// Big Shoulders başlık ve DM Mono künye; oyunları renk değil salon numarası ve simge ayırıyor.
const ON_GOLD = "#1a150c";

const GAME_META = {
  taste_battle: {
    title: "Taste Battle",
    subtitle: "İki içerikten hangisini seçersin?",
    icon: Swords,
    hall: "SALON 1",
    tag: "HIZLI SEÇİM",
  },
  friend_quiz: {
    title: "Arkadaşını Tanıyor musun?",
    subtitle: "Arkadaşının ne izlediğini ne kadar biliyorsun?",
    icon: Users,
    hall: "SALON 2",
    tag: "SOSYAL",
  },
  blind_pick: {
    title: "Blind Pick",
    subtitle: "İsim ve poster yok. Sadece ipuçları.",
    icon: EyeOff,
    hall: "SALON 3",
    tag: "GİZEM",
  },
  who_said_it: {
    title: "Who Said It?",
    subtitle: "İkonik anın hangi karaktere ait olduğunu tahmin et.",
    icon: Quote,
    hall: "SALON 4",
    tag: "SİNEMA QUIZ",
  },
  character_quiz: {
    title: "Hangi Karaktersin?",
    subtitle: "Kısa bir testle hangi film/dizi karakterine benzediğini keşfet.",
    icon: Wand2,
    hall: "SALON 5",
    tag: "KİŞİLİK TESTİ",
  },
};

export default function PellixPlayScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [features, setFeatures] = useState(null);
  // Sosyal akıştaki bir oyun sonuç kartına dokunulunca (bkz. SocialSharedCard) doğrudan o
  // oyuna düşülsün diye — hub'da durup tekrar seçmeye gerek kalmıyor.
  const [activeGame, setActiveGame] = useState(route?.params?.initialGame || null);

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

  // Poster Puzzle ayrı bir ekran (DailyPosterPuzzle) ve eskiden bu listede HİÇ yoktu — oyunlara
  // Keşfet'teki sabit girişten gelen kişi günün bulmacasını burada bulamıyordu.
  const [puzzleResult, setPuzzleResult] = useState(undefined);
  useEffect(() => {
    const load = () => AsyncStorage.getItem(todaysPuzzleResultKey())
      .then((v) => setPuzzleResult(v ? JSON.parse(v) : null))
      .catch(() => setPuzzleResult(null));
    load();
    return navigation.addListener("focus", load);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => activeGame ? setActiveGame(null) : navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={21} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{activeGame ? GAME_META[activeGame]?.title : translateUI("pellix play")}</Text>
          <Text style={styles.headerSub}>{activeGame ? translateUI(GAME_META[activeGame]?.subtitle) : translateUI("Oynayarak keşfet")}</Text>
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
      ) : activeGame === "who_said_it" ? (
        <WhoSaidIt token={auth.token} styles={styles} c={c} onDisabled={() => { setActiveGame(null); refreshFeatures(); }} />
      ) : activeGame === "character_quiz" ? (
        <CharacterQuiz token={auth.token} styles={styles} c={c} onDisabled={() => { setActiveGame(null); refreshFeatures(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.hubContent} showsVerticalScrollIndicator={false}>
          <MarqueeHero styles={styles} c={c} />

          <Text style={styles.sectionLabel}>{translateUI("GÜNÜN OYUNU")}</Text>
          <PlayCard
            styles={styles}
            c={c}
            highlight
            icon={Puzzle}
            eyebrow={translateUI("ÖZEL GÖSTERİM")}
            title={translateUI("Poster Puzzle")}
            badge={puzzleResult ? translateUI("✓ BUGÜN ÇÖZÜLDÜ") : translateUI("HERKESE AYNI POSTER")}
            sub={puzzleResult
              ? (puzzleResult.correct ? translateUI("Bugünkü posteri bildin. Sonucunu paylaş, arkadaşların kaçta bulacak?") : translateUI("Bugün olmadı. Yarın yeni bir poster geliyor."))
              : translateUI("Bulanık posterden filmi bul. Günde tek poster, 3 hata hakkı.")}
            onPress={() => navigation.navigate("DailyPosterPuzzle")}
          />

          <Text style={styles.sectionLabel}>{translateUI("MİNİ OYUNLAR")}</Text>
          {enabledKeys.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>{translateUI("Şu anda açık bir mini oyun yok.")}</Text></View>
          ) : enabledKeys.map((key) => {
            const meta = GAME_META[key];
            return (
              <PlayCard
                key={key}
                styles={styles}
                c={c}
                icon={meta.icon}
                eyebrow={`${translateUI(meta.hall)} · ${translateUI(meta.tag)}`}
                title={translateUI(meta.title)}
                sub={translateUI(meta.subtitle)}
                onPress={() => setActiveGame(key)}
              />
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
  const [selections, setSelections] = useState([]);
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setDone(false);
    setIndex(0);
    setSelections([]);
    setShowShare(false);
    try {
      const data = await playApi.tasteBattle(token);
      setPairs(data.pairs || []);
    } catch (e) {
      if (e.disabled) onDisabled();
      setPairs([]);
    } finally {
      setLoading(false);
    }
  }, [token, onDisabled]);

  useEffect(() => { load(); }, [load]);

  function choose(winner, loser) {
    playApi.chooseTasteBattle(token, winner.id, loser.id).catch((e) => { if (e.disabled) onDisabled(); });
    const nextSelections = [...selections, winner];
    setSelections(nextSelections);
    if (index >= pairs.length - 1) setDone(true);
    else setIndex((v) => v + 1);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;
  if (done) {
    const result = buildTasteResult(selections);
    return (
      <>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={styles.resultHero}>
            <LinearGradient colors={["rgba(201,164,76,0.16)", "rgba(201,164,76,0)"]} style={styles.resultSpot} pointerEvents="none" />
            <View style={styles.resultIcon}><Swords size={26} color={c.accent} /></View>
            <Text style={styles.resultEyebrow}>{translateUI("TASTE BATTLE SONUCUN")}</Text>
            <Text style={styles.resultTitle}>{translateUI(result.topGenre || "Karışık")}</Text>
            <Text style={styles.resultSummary}>{translateUI(result.summary)}</Text>
          </View>

          <View style={styles.resultStatsRow}>
            <ResultStat value={String(selections.length)} label={translateUI("SEÇİM")} styles={styles} />
            <ResultStat value={`%${result.moviePercent}`} label={translateUI("FİLM")} styles={styles} />
            <ResultStat value={`%${100 - result.moviePercent}`} label={translateUI("DİZİ")} styles={styles} />
          </View>

          {result.posters.length > 0 && (
            <View style={styles.resultPanel}>
              <Text style={styles.resultPanelTitle}>{translateUI("Bu turdaki favori seçimlerin")}</Text>
              <View style={styles.resultPosterRow}>
                {result.posters.slice(0, 4).map((poster, i) => <Image key={`${poster}-${i}`} source={{ uri: poster }} style={styles.resultPoster} />)}
              </View>
            </View>
          )}

          <ShareFan
            style={styles.shareResultBtn}
            accessibilityLabel={translateUI("Sonucu paylaş")}
            options={shareOptions({ message: translateUI("Taste Battle sonucum: {0}. Seninki ne? 🎮", { 0: translateUI(result.topGenre || "Karışık") }), url: playUrl("taste-battle"), copy: false, card: () => setShowShare(true) })}
          >
            <Share2 size={17} color={ON_GOLD} />
            <Text style={styles.shareResultText}>{translateUI("Sonucu Paylaş")}</Text>
          </ShareFan>
          <TouchableOpacity style={styles.ghostBtn} onPress={load}>
            <RotateCcw size={16} color={c.text} />
            <Text style={styles.ghostBtnText}>{translateUI("Tekrar Oyna")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`Taste Battle sonucum: ${result.topGenre || "Karışık"}. Seninki ne? 🎮`}
            shareUrl={playUrl("taste-battle")}
          >
            <PlayResultShareCard
              mode="taste"
              topGenre={result.topGenre}
              moviePercent={result.moviePercent}
              selectionCount={selections.length}
              posters={result.posters}
            />
          </ShareCardModal>
        )}
      </>
    );
  }

  const pair = pairs[index];
  if (!pair) return <GameDone styles={styles} title={translateUI("Eşleşme bulunamadı")} text={translateUI("Biraz sonra tekrar dene.")} onAgain={load} />;

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <GameHero meta={GAME_META.taste_battle} styles={styles} icon={Swords} title={translateUI("Hızlı düşün, içinden geleni seç")} subtitle={translateUI("Doğru cevap yok. Her seçim önerilerini biraz daha netleştiriyor.")} />
      <Text style={styles.progressText}>{index + 1}{translateUI(" / ")}{pairs.length}</Text>
      <Text style={styles.questionTitle}>{translateUI("Hangisini seçersin?")}</Text>
      <View style={styles.battleRow}>
        <MovieChoice movie={pair.left} styles={styles} onPress={() => choose(pair.left, pair.right)} accent={c.accent} />
        <View style={styles.vsBadge}><Text style={styles.vsText}>{translateUI("VS")}</Text></View>
        <MovieChoice movie={pair.right} styles={styles} onPress={() => choose(pair.right, pair.left)} accent={c.accent} />
      </View>
    </ScrollView>
  );
}

function FriendQuiz({ token, styles, c, onDisabled }) {
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [data, setData] = useState(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    setStarted(false);
    setData(null);
    setSelectedFriend(null);
    setShowShare(false);
    try {
      const result = await playApi.friendQuizFriends(token);
      setFriends(result.friends || []);
    } catch (e) {
      if (e.disabled) onDisabled();
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [token, onDisabled]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  async function start(friend) {
    if (!friend?.ready) return;
    setSelectedFriend(friend);
    setStarted(true);
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setData(null);
    setLoading(true);
    try {
      setData(await playApi.friendQuiz(token, friend.id));
    } catch (e) {
      if (e.disabled) onDisabled();
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function answer(movie) {
    if (feedback || !data?.questions?.length) return;
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

  if (!started) {
    return (
      <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
        <GameHero meta={GAME_META.friend_quiz} styles={styles} icon={Users} title={translateUI("Kimi ne kadar iyi tanıyorsun?")} subtitle={translateUI("Önce arkadaşını seç, sonra onun neleri beğendiğini tahmin et.")} />
        <Text style={styles.friendPickerTitle}>{translateUI("Arkadaşını seç")}</Text>
        <Text style={styles.friendPickerSub}>{translateUI("En az 10 beğenisi olan arkadaşlarınla hemen oynayabilirsin.")}</Text>

        {friends.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>{translateUI("Henüz oynayabileceğin bir arkadaş görünmüyor.")}</Text></View>
        ) : friends.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={[styles.friendPickerRow, !friend.ready && styles.friendPickerRowDisabled]}
            onPress={() => start(friend)}
            activeOpacity={friend.ready ? 0.82 : 1}
          >
            <RetryImage source={{ uri: avatarOr(friend.avatarUrl, friend.id) }} style={styles.friendPickerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.friendPickerName}>{friend.name}</Text>
              <Text style={[styles.friendPickerStatus, friend.ready && { color: c.accent }]}>
                {friend.ready ? translateUI("{0} soruluk tur hazır", {0: friend.questionCount}) : translateUI("{0}/10 beğeni · biraz daha gerekiyor", {0: friend.likeCount || 0})}
              </Text>
            </View>
            {friend.ready ? <ArrowRight size={18} color={c.accent} /> : <LockKeyhole size={16} color={c.dim} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  if (!data?.friend || !data.questions?.length) {
    return <GameDone styles={styles} title={translateUI("Şimdilik oynanamıyor")} text={data?.unavailableReason || translateUI("{0} için yeterli veri oluşunca açılacak.", {0: selectedFriend?.name || "Bu arkadaş"})} onAgain={loadFriends} />;
  }

  if (index >= data.questions.length) {
    const percent = Math.round((score / data.questions.length) * 100);
    return (
      <>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={styles.resultHero}>
            <LinearGradient colors={["rgba(201,164,76,0.16)", "rgba(201,164,76,0)"]} style={styles.resultSpot} pointerEvents="none" />
            <RetryImage source={{ uri: avatarOr(data.friend.avatarUrl, data.friend.id) }} style={styles.resultFriendAvatar} />
            <Text style={styles.resultEyebrow}>{translateUI("ARKADAŞINI TANIYOR MUSUN?")}</Text>
            <Text style={styles.resultBigPercent}>{translateUI("%")}{percent}</Text>
            <Text style={styles.resultFriendName}>{data.friend.name}</Text>
            <Text style={styles.resultSummary}>{translateUI(friendResultCopy(percent))}</Text>
          </View>

          <View style={styles.resultPanel}>
            <View style={styles.scoreInline}><Trophy size={19} color={c.accent} /><Text style={styles.scoreInlineText}>{score}{translateUI("/")}{data.questions.length}{translateUI(" doğru cevap")}</Text></View>
            <Text style={styles.doneText}>{translateUI("Bu skoru paylaş; bakalım arkadaşın itiraz edecek mi.")}</Text>
          </View>

          <ShareFan
            style={styles.shareResultBtn}
            accessibilityLabel={translateUI("Sonucu paylaş")}
            options={shareOptions({ message: getLanguage() === "en" ? translateUI("{0}'i ne kadar iyi tanıyorum? Skorum %{1} 😄 Sen de dene.", { 0: data.friend.name, 1: percent }) : `${accusativeTR(data.friend.name) || data.friend.name} ne kadar iyi tanıyorum? Skorum %${percent} 😄 Sen de dene.`, url: playUrl("arkadasini-taniyor-musun"), copy: false, card: () => setShowShare(true) })}
          >
            <Share2 size={17} color={ON_GOLD} />
            <Text style={styles.shareResultText}>{translateUI("Sonucu Paylaş")}</Text>
          </ShareFan>
          <TouchableOpacity style={styles.ghostBtn} onPress={loadFriends}>
            <Users size={16} color={c.text} />
            <Text style={styles.ghostBtnText}>{translateUI("Başka Arkadaş Seç")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`${data.friend.name}'i ne kadar iyi tanıyorum? Skorum %${percent} 😄 Sen de dene.`}
            shareUrl={playUrl("arkadasini-taniyor-musun")}
            socialCard={{
              kind: "friend_quiz",
              friend: { id: data.friend.id, name: data.friend.name, avatarUrl: data.friend.avatarUrl },
              score,
              total: data.questions.length,
              percent,
            }}
          >
            <PlayResultShareCard mode="friend" friend={data.friend} score={score} total={data.questions.length} />
          </ShareCardModal>
        )}
      </>
    );
  }

  const q = data.questions[index];
  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <View style={styles.friendHeader}>
        <RetryImage source={{ uri: avatarOr(data.friend.avatarUrl, data.friend.id) }} style={styles.friendAvatar} />
        <View style={{ flex: 1 }}><Text style={styles.friendName}>{data.friend.name}</Text><Text style={styles.friendSub}>{translateUI("Hangisini beğenmiş?")}</Text></View>
        <Users size={20} color={c.accent} />
      </View>
      <Text style={styles.progressText}>{index + 1}{translateUI(" / ")}{data.questions.length}{translateUI(" · Skor ")}{score}</Text>
      <View style={styles.battleRow}>
        {[q.left, q.right].map((movie) => {
          const isCorrect = feedback && movie.id === q.correctMovieId;
          const isWrongChosen = feedback && feedback.chosenId === movie.id && !isCorrect;
          return <MovieChoice key={movie.id} movie={movie} styles={styles} onPress={() => answer(movie)} state={isCorrect ? "correct" : isWrongChosen ? "wrong" : null} accent={c.accent} />;
        })}
      </View>
      {feedback && (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: feedback.correct ? c.accent2 : c.danger }]} onPress={next}>
          {feedback.correct ? <Check size={17} color={ON_GOLD} /> : <X size={17} color={ON_GOLD} />}
          <Text style={styles.primaryBtnText}>{feedback.correct ? translateUI("Bildin! Devam") : translateUI("Olmadı, devam et")}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function WhoSaidIt({ token, styles, c, onDisabled }) {
  const [kind, setKind] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [round, setRound] = useState(null);
  const [started, setStarted] = useState(false);
  const [stats, setStats] = useState(null);
  const [showShare, setShowShare] = useState(false);

  const startRound = useCallback(async (mode = "classic") => {
    const nextKind = mode === "daily" ? "all" : kind;
    const nextDifficulty = mode === "daily" ? "all" : difficulty;
    setLoading(true);
    setStarted(true);
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setAnswering(false);
    setShowShare(false);
    try {
      const data = await playApi.whoSaidIt(token, { mode, kind: nextKind, difficulty: nextDifficulty });
      setQuestions(data.questions || []);
      setRound({ mode: data.mode || mode, kind: data.kind || nextKind, difficulty: data.difficulty || nextDifficulty, dateKey: data.dateKey || null });
      setStats(data.stats || null);
    } catch (e) {
      if (e.disabled) onDisabled();
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [token, kind, difficulty, onDisabled]);

  function backToSetup() {
    setStarted(false);
    setQuestions([]);
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setRound(null);
  }

  async function answer(chosen) {
    if (feedback || answering) return;
    const q = questions[index];
    if (!q) return;
    setAnswering(true);
    try {
      const result = await playApi.answerWhoSaidIt(token, q.id, chosen, { mode: round?.mode || "classic" });
      if (result.correct) setScore((v) => v + 1);
      setFeedback({ ...result, chosen });
    } catch (e) {
      if (e.disabled) onDisabled();
    } finally {
      setAnswering(false);
    }
  }

  function next() {
    if (index >= questions.length - 1) setIndex(questions.length);
    else {
      setIndex((v) => v + 1);
      setFeedback(null);
    }
  }

  const pill = (active) => ({
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: active ? c.accent : c.border,
    backgroundColor: active ? "rgba(201,164,76,0.13)" : c.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  });
  const pillText = (active) => ({ color: active ? c.accent : c.dim, fontWeight: "800", fontSize: 12 });

  if (!started) {
    return (
      <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
        <GameHero meta={GAME_META.who_said_it} styles={styles} icon={Quote} title={translateUI("Sahneyi hatırla, karakteri bul")} subtitle={translateUI("Film ve dizi hafızanı kolaydan zora test et.")} />

        <PlayCard
          styles={styles}
          c={c}
          highlight
          icon={Quote}
          eyebrow={translateUI("ÖZEL GÖSTERİM · 5 SORU")}
          title={translateUI("Günün Challenge'ı")}
          sub={translateUI("Her gün herkes için aynı 5 soru. Bugünkü skoru kap.")}
          onPress={() => startRound("daily")}
        />

        <View style={{ marginTop: 24, gap: 8 }}>
          <Text style={styles.blockTitle}>{translateUI("Klasik Tur")}</Text>
          <Text style={{ color: c.dim, fontSize: 12.5, lineHeight: 18 }}>{translateUI("10 soruluk turunu içerik türüne ve zorluğa göre ayarla.")}</Text>
        </View>

        <Text style={styles.filterLabel}>{translateUI("İÇERİK")}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[["all", "Tümü"], ["movie", "Film"], ["tv", "Dizi"]].map(([value, label]) => (
            <TouchableOpacity key={value} style={pill(kind === value)} onPress={() => setKind(value)}>
              <Text style={pillText(kind === value)}>{translateUI(label)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>{translateUI("ZORLUK")}</Text>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {[["all", "Tümü"], ["easy", "Kolay"], ["medium", "Orta"], ["hard", "Zor"]].map(([value, label]) => (
            <TouchableOpacity key={value} style={pill(difficulty === value)} onPress={() => setDifficulty(value)}>
              <Text style={pillText(difficulty === value)}>{translateUI(label)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 22 }]} onPress={() => startRound("classic")}>
          <Text style={styles.primaryBtnText}>{translateUI("10 Soruluk Turu Başlat")}</Text>
          <ArrowRight size={17} color={ON_GOLD} />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

  if (index >= questions.length) {
    const isDaily = round?.mode === "daily";
    return (
      <View style={styles.centerPad}>
        <View style={styles.compactResultCircle}>
          <Text style={styles.compactResultScore}>{score}{translateUI("/")}{questions.length}</Text>
        </View>
        <Text style={[styles.doneTitle, { marginTop: 18 }]}>{translateUI("Tur tamamlandı")}</Text>
        <Text style={styles.doneText}>{isDaily ? translateUI("Bugünün challenge'ını tamamladın.") : translateUI("Bu turdaki sinema hafızanı test ettin.")}</Text>
        {stats?.promptVariants ? <Text style={{ color: c.dim, fontSize: 11, marginTop: 4 }}>{stats.promptVariants}{translateUI("+ soru varyasyonu içinden oynadın.")}</Text> : null}
        <ShareFan
          style={styles.shareResultBtn}
          accessibilityLabel={translateUI("Sonucu paylaş")}
          options={shareOptions({ message: translateUI("Sahneyi Hatırla, Karakteri Bul'da {0}/{1} yaptım 🎬 Sen de dene.", { 0: score, 1: questions.length }), url: playUrl("replik"), copy: false, card: () => setShowShare(true) })}
        >
          <Share2 size={17} color={ON_GOLD} />
          <Text style={styles.shareResultText}>{translateUI("Sonucu Paylaş")}</Text>
        </ShareFan>
        <TouchableOpacity style={styles.retryBtn} onPress={() => startRound(round?.mode || "classic")}>
          <RotateCcw size={16} color={ON_GOLD} /><Text style={styles.retryText}>{translateUI("Tekrar Oyna")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={backToSetup} style={{ marginTop: 14, padding: 10 }}>
          <Text style={{ color: c.dim, fontSize: 12.5, fontWeight: "800" }}>{translateUI("Mod / Filtre Değiştir")}</Text>
        </TouchableOpacity>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`Sahneyi Hatırla, Karakteri Bul'da ${score}/${questions.length} yaptım 🎬 Sen de dene.`}
            shareUrl={playUrl("replik")}
            socialCard={{
              kind: "who_said_it",
              score,
              total: questions.length,
              isDaily,
            }}
          >
            <PlayResultShareCard mode="quote" score={score} total={questions.length} isDaily={isDaily} />
          </ShareCardModal>
        )}
      </View>
    );
  }

  const q = questions[index];
  if (!q) return <GameDone styles={styles} title={translateUI("Soru bulunamadı")} text={translateUI("Biraz sonra tekrar dene.")} onAgain={backToSetup} />;

  const difficultyLabel = { easy: "Kolay", medium: "Orta", hard: "Zor" }[q.difficulty] || "";
  const kindLabel = q.kind === "tv" ? "Dizi" : "Film";

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <View style={styles.quizMetaRow}>
        <Text style={styles.progressText}>{index + 1}{translateUI(" / ")}{questions.length}{translateUI(" · Skor ")}{score}</Text>
        <Text style={{ color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.6 }}>{round?.mode === "daily" ? translateUI("Günlük") : kindLabel + " · " + difficultyLabel}</Text>
      </View>

      <View style={styles.quoteCard}>
        <LinearGradient colors={["rgba(201,164,76,0.16)", "rgba(201,164,76,0)"]} style={styles.resultSpot} pointerEvents="none" />
        <Quote size={30} color={c.accent} />
        <Text style={styles.quotePrompt}>{translateUI("“")}{q.prompt}{translateUI("”")}</Text>
        <Text style={styles.quoteSub}>{translateUI("Bu ikonik an kime ait?")}</Text>
      </View>

      <View style={{ gap: 10, marginTop: 18 }}>
        {q.options.map((option) => {
          const isCorrect = feedback && option === feedback.answer;
          const isWrong = feedback && option === feedback.chosen && !feedback.correct;
          return (
            <TouchableOpacity
              key={translateUI(option)}
              disabled={!!feedback || answering}
              onPress={() => answer(option)}
              activeOpacity={0.82}
              style={[
                styles.quizOption,
                isCorrect && styles.quizOptionCorrect,
                isWrong && styles.quizOptionWrong,
                { opacity: answering ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.quizOptionText}>{translateUI(option)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback && (
        <View style={{ marginTop: 18, gap: 10 }}>
          <Text style={{ color: feedback.correct ? c.accent2 : c.danger, fontSize: 14, fontWeight: "900", textAlign: "center" }}>
            {feedback.correct ? translateUI("Doğru!") : "Doğru cevap: " + feedback.answer}
          </Text>
          <Text style={{ color: c.dim, fontSize: 12, textAlign: "center" }}>{feedback.movie}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>{index >= questions.length - 1 ? translateUI("Sonucu Gör") : translateUI("Sonraki")}</Text>
            <ArrowRight size={17} color={ON_GOLD} />
          </TouchableOpacity>
        </View>
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
  }, [token, onDisabled]);
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
  if (index >= items.length) return <GameDone styles={styles} title={translateUI("Blind tur tamamlandı")} text={translateUI("{0} içerik gördün.", {0: items.length})} onAgain={load} />;
  const item = items[index];
  if (!item) return <GameDone styles={styles} title={translateUI("İçerik bulunamadı")} text={translateUI("Biraz sonra tekrar dene.")} onAgain={load} />;
  const clue = item.clue || {};

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <GameHero meta={GAME_META.blind_pick} styles={styles} icon={EyeOff} title={translateUI("Posteri unut, içgüdüne güven")} subtitle={translateUI("İpuçlarından karar ver; sonra ne seçtiğini gör.")} />
      <Text style={styles.progressText}>{index + 1}{translateUI(" / ")}{items.length}</Text>
      {!revealed ? (
        <>
          <View style={styles.blindCard}>
            <LinearGradient colors={["rgba(201,164,76,0.16)", "rgba(201,164,76,0)"]} style={styles.resultSpot} pointerEvents="none" />
            <EyeOff size={34} color={c.accent} />
            <Text style={styles.blindTitle}>{translateUI("Bu ne olabilir?")}</Text>
            <View style={styles.clueChip}><Text style={styles.clueChipText}>{clue.year || translateUI("?")}{translateUI(" · ")}{clue.type === "tv" ? translateUI("Dizi") : translateUI("Film")}</Text></View>
            <View style={styles.clueChip}><Text style={styles.clueChipText}>{(clue.genres || []).join(" · ") || translateUI("Tür gizli")}</Text></View>
            <View style={styles.clueChip}><Text style={styles.clueChipText}>{translateUI("IMDb ")}{clue.imdb || translateUI("?")}{clue.runtime ? translateUI(" · {0} dk", {0: clue.runtime}) : ""}</Text></View>
          </View>
          <View style={styles.choiceButtons}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => decide(false)}><Text style={styles.secondaryBtnText}>{translateUI("Geç")}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnFlex} onPress={() => decide(true)}><Text style={styles.primaryBtnText}>{translateUI("İzlerim")}</Text></TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.revealCard, { borderColor: "rgba(201,164,76,0.35)" }]}>
            {!!item.reveal?.poster && <Image source={{ uri: item.reveal.poster }} style={styles.revealPoster} />}
            <Text style={styles.revealTitle}>{item.reveal?.title}</Text>
            <Text style={styles.revealMeta}>{item.reveal?.year}{translateUI(" · ")}{item.reveal?.type === "tv" ? translateUI("Dizi") : translateUI("Film")}{translateUI(" · IMDb ")}{item.reveal?.imdb}</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={next}><Text style={styles.primaryBtnText}>{translateUI("Sonraki")}</Text><ArrowRight size={17} color={ON_GOLD} /></TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function CharacterQuiz({ token, styles, c, onDisabled }) {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState(null);
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setIndex(0);
    setAnswers([]);
    setResult(null);
    setShowShare(false);
    try {
      const data = await playApi.characterQuiz(token);
      setQuestions(data.questions || []);
    } catch (e) {
      if (e.disabled) onDisabled();
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [token, onDisabled]);

  useEffect(() => { load(); }, [load]);

  async function choose(option) {
    if (resolving) return;
    const q = questions[index];
    if (!q) return;
    const nextAnswers = [...answers, { questionId: q.id, optionId: option.id }];
    setAnswers(nextAnswers);
    if (index >= questions.length - 1) {
      setResolving(true);
      try {
        setResult(await playApi.characterQuizResult(token, nextAnswers));
      } catch (e) {
        if (e.disabled) onDisabled();
      } finally {
        setResolving(false);
      }
    } else {
      setIndex((v) => v + 1);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

  if (resolving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent} />
        <Text style={{ color: c.dim, fontSize: 12, marginTop: 12 }}>{translateUI("Karakterin belirleniyor...")}</Text>
      </View>
    );
  }

  if (result?.character) {
    const character = result.character;
    return (
      <>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={styles.resultHero}>
            <LinearGradient colors={["rgba(201,164,76,0.16)", "rgba(201,164,76,0)"]} style={styles.resultSpot} pointerEvents="none" />
            {character.actorPhoto ? (
              <View style={{ marginTop: 4 }}>
                <RetryImage source={{ uri: character.actorPhoto }} style={styles.resultFriendAvatar} />
                <View style={styles.charEmojiBadge}><Text style={{ fontSize: 14 }}>{character.emoji}</Text></View>
              </View>
            ) : (
              <Text style={{ fontSize: 46 }}>{character.emoji}</Text>
            )}
            <Text style={styles.resultEyebrow}>{translateUI("HANGİ KARAKTERSİN?")}</Text>
            <Text style={styles.resultTitle}>{character.name}</Text>
            <Text style={styles.resultMeta}>{character.title}</Text>
            {!!character.actor && (
              <Text style={[styles.resultMeta, { opacity: 0.75 }]}>{character.actor}{translateUI(" canlandırdı")}</Text>
            )}
            <Text style={styles.resultSummary}>{character.blurb}</Text>
          </View>

          <View style={styles.resultPanel}>
            <View style={styles.scoreInline}><Sparkles size={18} color={c.accent} /><Text style={styles.scoreInlineText}>{translateUI("%")}{result.matchPercent}{translateUI(" uyum")}</Text></View>
            <Text style={[styles.doneText, { fontStyle: "italic" }]}>{translateUI("\"")}{character.quote}{translateUI("\"")}</Text>
          </View>

          <ShareFan
            style={styles.shareResultBtn}
            accessibilityLabel={translateUI("Sonucu paylaş")}
            options={shareOptions({ message: translateUI("Hangi Karaktersin testinde {0} çıktım (%{1} uyum) 🎭 Sen de dene.", { 0: character.name, 1: result.matchPercent }), url: playUrl("karakter"), copy: false, card: () => setShowShare(true) })}
          >
            <Share2 size={17} color={ON_GOLD} />
            <Text style={styles.shareResultText}>{translateUI("Sonucu Paylaş")}</Text>
          </ShareFan>
          <TouchableOpacity style={styles.ghostBtn} onPress={load}>
            <RotateCcw size={16} color={c.text} />
            <Text style={styles.ghostBtnText}>{translateUI("Tekrar Oyna")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`Hangi Karaktersin testinde ${character.name} çıktım (%${result.matchPercent} uyum) 🎭 Sen de dene.`}
            shareUrl={playUrl("karakter")}
            socialCard={{ kind: "character_quiz", character, matchPercent: result.matchPercent }}
          >
            <PlayResultShareCard mode="character" character={character} matchPercent={result.matchPercent} />
          </ShareCardModal>
        )}
      </>
    );
  }

  const q = questions[index];
  if (!q) return <GameDone styles={styles} title={translateUI("Soru bulunamadı")} text={translateUI("Biraz sonra tekrar dene.")} onAgain={load} />;

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <GameHero meta={GAME_META.character_quiz} styles={styles} icon={Wand2} title={translateUI("Kısa bir testle keşfet")} subtitle={translateUI("Doğru cevap yok, içinden geleni seç.")} />
      <Text style={styles.progressText}>{index + 1}{translateUI(" / ")}{questions.length}</Text>
      <Text style={[styles.questionTitle, { fontSize: 17, lineHeight: 23 }]}>{q.prompt}</Text>
      <View style={{ gap: 10 }}>
        {q.options.map((option) => (
          <TouchableOpacity key={option.id} onPress={() => choose(option)} activeOpacity={0.82} style={styles.quizOption}>
            <Text style={styles.quizOptionText}>{translateUI(option.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// Lobi tabelası: üst ve alt kenarda sırayla yanıp sönen ampuller (sinema girişlerindeki gibi).
// "Hareketi azalt" açıksa ampuller sabit yanıyor.
const BULBS = 15;
function MarqueeHero({ styles, c }) {
  const chase = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().catch(() => false).then((reduce) => {
      if (!alive || reduce) return;
      loop = Animated.loop(Animated.timing(chase, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
      loop.start();
    });
    return () => { alive = false; loop?.stop(); };
  }, [chase]);
  const even = chase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.3, 1] });
  const odd = chase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] });
  const row = (key) => (
    <View style={styles.bulbRow} pointerEvents="none" key={key}>
      {Array.from({ length: BULBS }, (_, i) => (
        <Animated.View key={i} style={[styles.bulb, { backgroundColor: c.accent, opacity: i % 2 ? odd : even }]} />
      ))}
    </View>
  );
  return (
    <View style={styles.hubHero}>
      {row("top")}
      <View style={styles.hubHeroBody}>
        <Text style={styles.hubEyebrow}>{translateUI("PELLIX PLAY")}</Text>
        <Text style={styles.hubHeroTitle}>{translateUI("Bugün ne oynayalım?")}</Text>
        <Text style={styles.hubHeroSub}>{translateUI("Kısa turlar, hızlı kararlar ve arkadaşlarınla paylaşabileceğin sonuçlar.")}</Text>
      </View>
      {row("bottom")}
    </View>
  );
}

// Lobideki salon kapısı: simge altın halkada, künye DM Mono, ad Big Shoulders. Öne çıkan
// (günlük) oyunlarda çerçeve altın ve sağ üstte küçük bir rozet.
function PlayCard({ styles, c, icon: Icon, eyebrow, title, sub, badge, highlight, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={[styles.playCard, highlight && styles.playCardHighlight]} accessibilityRole="button" accessibilityLabel={title}>
      <View style={styles.playIcon}><Icon size={21} color={c.accent} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.playEyebrow} numberOfLines={1}>{eyebrow}</Text>
        <Text style={styles.playTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.playSub}>{sub}</Text>}
        {!!badge && <View style={styles.playBadge}><Text style={styles.playBadgeText}>{badge}</Text></View>}
      </View>
      <ArrowRight size={18} color={c.accent} />
    </TouchableOpacity>
  );
}

function GameHero({ meta, styles, icon: Icon, title, subtitle }) {
  const { c } = useAppTheme();
  return (
    <View style={styles.gameHero}>
      <View style={styles.gameHeroIcon}><Icon size={22} color={c.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.gameHeroTag}>{translateUI(meta.hall)}{" · "}{translateUI(meta.tag)}</Text>
        <Text style={styles.gameHeroTitle}>{translateUI(title)}</Text>
        <Text style={styles.gameHeroSub}>{translateUI(subtitle)}</Text>
      </View>
    </View>
  );
}

function ResultStat({ value, label, styles }) {
  return (
    <View style={styles.resultStatBox}>
      <Text style={styles.resultStatValue}>{value}</Text>
      <Text style={styles.resultStatLabel}>{translateUI(label)}</Text>
    </View>
  );
}

function movieGenres(movie) {
  const raw = Array.isArray(movie?.genres) ? movie.genres : movie?.genre ? [movie.genre] : [];
  return raw
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function isTv(movie) {
  const type = String(movie?.type || "").toLocaleLowerCase("tr-TR");
  return type === "tv" || type.includes("dizi") || type.includes("show");
}

function tasteCopy(topGenre) {
  const g = String(topGenre || "").toLocaleLowerCase("tr-TR");
  if (g.includes("bilim") || g.includes("sci")) return "Zihin büken dünyalar ve büyük fikirler seni çekiyor.";
  if (g.includes("gerilim") || g.includes("thrill")) return "Gerilim yükseldikçe seçimin netleşiyor.";
  if (g.includes("aksiyon") || g.includes("action")) return "Tempo, enerji ve güçlü anlar tarafındasın.";
  if (g.includes("dram")) return "Karakter ve hikâye derinliği senin için önde.";
  if (g.includes("komedi") || g.includes("comedy")) return "İyi hissettiren ve akıcı seçimlere gidiyorsun.";
  if (g.includes("korku") || g.includes("horror")) return "Karanlık ve tekinsiz hikâyeler seni kaçırmıyor.";
  if (g.includes("suç") || g.includes("crime")) return "Gri karakterler ve suç dünyası radarında.";
  return "Bu turda tek bir kalıba sığmayan, karışık bir seçki çizdin.";
}

function buildTasteResult(selections) {
  const genreCounts = new Map();
  selections.forEach((movie) => {
    movieGenres(movie).forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
  });
  const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Karışık";
  const tvCount = selections.filter(isTv).length;
  const moviePercent = selections.length ? Math.round(((selections.length - tvCount) / selections.length) * 100) : 0;
  return {
    topGenre,
    moviePercent,
    summary: tasteCopy(topGenre),
    posters: selections.map((movie) => movie?.poster).filter(Boolean),
  };
}

function friendResultCopy(percent) {
  if (percent >= 90) return "Neleri sevdiğini ezbere biliyorsun. Bu skor kolay kolay gelmez.";
  if (percent >= 70) return "Aynı frekanstasınız. Tercihlerinin çoğunu doğru okudun.";
  if (percent >= 50) return "Fena değil. Birkaç film gecesi daha işi çözer.";
  return "Sürprizlerle dolu bir arkadaşlık. Birlikte birkaç film gecesi daha lazım.";
}

function MovieChoice({ movie, styles, onPress, state, accent }) {
  return (
    <TouchableOpacity
      style={[
        styles.movieChoice,
        !state && accent ? { borderColor: `${accent}66` } : null,
        state === "correct" && styles.correctChoice,
        state === "wrong" && styles.wrongChoice,
      ]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      {!!movie.poster && <Image source={{ uri: movie.poster }} style={styles.choicePoster} />}
      <Text style={styles.choiceTitle} numberOfLines={2}>{movie.title}</Text>
      <Text style={styles.choiceMeta}>{movie.year || ""}{movie.imdb ? translateUI(" · IMDb {0}", {0: movie.imdb}) : ""}</Text>
    </TouchableOpacity>
  );
}

function GameDone({ styles, title, text, onAgain }) {
  return (
    <View style={styles.centerPad}>
      <Text style={styles.doneTitle}>{translateUI(title)}</Text>
      <Text style={styles.doneText}>{translateUI(text)}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onAgain}><RotateCcw size={16} color={ON_GOLD} /><Text style={styles.retryText}>{translateUI("Tekrar Oyna")}</Text></TouchableOpacity>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: c.border },
    backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontFamily: "Baloo2_800ExtraBold", fontSize: 18, color: c.text },
    headerSub: { fontSize: 10.5, color: c.dim, marginTop: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    centerPad: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
    hubContent: { padding: 18, paddingBottom: 40 },

    // Lobi tabelası
    hubHero: { borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: "rgba(201,164,76,0.32)", paddingVertical: 10, marginBottom: 24, overflow: "hidden" },
    bulbRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
    bulb: { width: 6, height: 6, borderRadius: 3 },
    hubHeroBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
    hubEyebrow: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.6 },
    hubHeroTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 36, lineHeight: 39, marginTop: 6 },
    hubHeroSub: { color: c.dim, fontSize: 12.5, lineHeight: 18, marginTop: 6, maxWidth: 310 },
    sectionLabel: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.4, marginBottom: 10, marginLeft: 2 },

    // Salon kapıları (oyun kartları)
    playCard: { flexDirection: "row", alignItems: "center", gap: 13, minHeight: 92, paddingHorizontal: 15, paddingVertical: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
    playCardHighlight: { borderColor: c.accent, backgroundColor: c.surface2 },
    playIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    playEyebrow: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1 },
    playTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 22, lineHeight: 25, marginTop: 2 },
    playSub: { color: c.dim, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
    playBadge: { alignSelf: "flex-start", marginTop: 7, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    playBadgeText: { color: ON_GOLD, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 0.6 },
    emptyCard: { padding: 20, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    emptyText: { color: c.dim, textAlign: "center", fontSize: 12 },

    // Oyun içi
    gameContent: { padding: 18, paddingBottom: 40 },
    gameHero: { minHeight: 104, borderRadius: 16, padding: 15, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    gameHeroIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    gameHeroTag: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1 },
    gameHeroTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 21, lineHeight: 24, marginTop: 3 },
    gameHeroSub: { color: c.dim, fontSize: 11, lineHeight: 15.5, marginTop: 3 },
    progressText: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.8, textAlign: "center", marginBottom: 10 },
    questionTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26, lineHeight: 30, textAlign: "center", marginBottom: 18 },
    battleRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    movieChoice: { flex: 1, backgroundColor: c.surface, borderWidth: 1.2, borderColor: c.border, borderRadius: 14, padding: 8, overflow: "hidden" },
    correctChoice: { borderColor: c.accent2, borderWidth: 2 },
    wrongChoice: { borderColor: c.danger, borderWidth: 2 },
    choicePoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 9, backgroundColor: c.surface2 },
    choiceTitle: { color: c.text, fontWeight: "800", fontSize: 13, marginTop: 8 },
    choiceMeta: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    vsBadge: { position: "absolute", zIndex: 2, left: "50%", top: 115, marginLeft: -19, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.bg, backgroundColor: c.accent },
    vsText: { color: ON_GOLD, fontFamily: FONTS.marquee, fontSize: 15 },
    friendPickerTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24, marginTop: 4 },
    friendPickerSub: { color: c.dim, fontSize: 11.5, lineHeight: 17, marginTop: 4, marginBottom: 14 },
    friendPickerRow: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 70, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: "rgba(201,164,76,0.30)", marginBottom: 9 },
    friendPickerRowDisabled: { opacity: 0.52, borderColor: c.border },
    friendPickerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.surface2 },
    friendPickerName: { color: c.text, fontSize: 13.5, fontWeight: "900" },
    friendPickerStatus: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    friendHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, borderRadius: 14, padding: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    friendAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2, borderWidth: 1.5, borderColor: c.accent },
    friendName: { color: c.text, fontFamily: FONTS.marquee, fontSize: 19 },
    friendSub: { color: c.dim, fontSize: 11, marginTop: 1 },
    primaryBtn: { marginTop: 16, minHeight: 48, borderRadius: 13, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, paddingHorizontal: 16 },
    primaryBtnFlex: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    primaryBtnText: { color: ON_GOLD, fontSize: 13.5, fontWeight: "900" },
    secondaryBtn: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    secondaryBtnText: { color: c.text, fontSize: 13, fontWeight: "800" },
    choiceButtons: { flexDirection: "row", gap: 10, marginTop: 14 },
    blindCard: { minHeight: 276, borderRadius: 18, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: "rgba(201,164,76,0.30)", overflow: "hidden" },
    blindTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 30, marginTop: 12, marginBottom: 16 },
    clueChip: { backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginTop: 7, borderWidth: 1, borderColor: c.border },
    clueChipText: { color: c.text, fontFamily: FONTS.monoMedium, fontSize: 11.5, letterSpacing: 0.4, textAlign: "center" },
    revealCard: { alignItems: "center", padding: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16 },
    revealPoster: { width: 160, aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: c.surface2 },
    revealTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26, marginTop: 14, textAlign: "center" },
    revealMeta: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.5, marginTop: 5 },
    blockTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24 },
    filterLabel: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, marginTop: 18, marginBottom: 8 },
    quizMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
    quoteCard: { minHeight: 250, borderRadius: 18, gap: 13, alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    quotePrompt: { color: c.text, fontSize: 19, lineHeight: 27, fontWeight: "800", fontStyle: "italic", textAlign: "center" },
    quoteSub: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.8, textAlign: "center" },
    quizOption: { minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 15, alignItems: "center", justifyContent: "center" },
    quizOptionCorrect: { borderColor: c.accent2, backgroundColor: "rgba(95,179,163,0.14)" },
    quizOptionWrong: { borderColor: c.danger, backgroundColor: "rgba(217,99,111,0.14)" },
    quizOptionText: { color: c.text, fontWeight: "800", fontSize: 14, textAlign: "center" },
    compactResultCircle: { width: 124, height: 124, borderRadius: 62, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent },
    compactResultScore: { color: c.accent, fontFamily: FONTS.marquee, fontSize: 40 },

    // Sonuçlar: koyu kart, üstte soluk bir altın spot
    resultContent: { padding: 18, paddingBottom: 44 },
    resultHero: { borderRadius: 20, minHeight: 280, alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: "rgba(201,164,76,0.32)" },
    resultSpot: { position: "absolute", left: 0, right: 0, top: 0, height: 170 },
    resultIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    resultEyebrow: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.4, marginTop: 14, textAlign: "center" },
    resultTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 40, lineHeight: 43, textAlign: "center", marginTop: 6 },
    resultMeta: { color: c.dim, fontSize: 11.5, fontWeight: "700", marginTop: 2, textAlign: "center" },
    resultSummary: { color: c.text, opacity: 0.86, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 9, maxWidth: 290 },
    resultBigPercent: { color: c.accent, fontFamily: FONTS.marquee, fontSize: 76, lineHeight: 80, marginTop: 6 },
    resultFriendName: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24, marginTop: 2 },
    resultFriendAvatar: { width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: c.accent },
    charEmojiBadge: { position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.accent },
    resultStatsRow: { flexDirection: "row", gap: 9, marginTop: 14 },
    resultStatBox: { flex: 1, minHeight: 76, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    resultStatValue: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26 },
    resultStatLabel: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1, marginTop: 2 },
    resultPanel: { marginTop: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 16 },
    resultPanelTitle: { color: c.text, fontSize: 12.5, fontWeight: "900", marginBottom: 12 },
    resultPosterRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
    resultPoster: { width: 61, height: 91, borderRadius: 7, backgroundColor: c.surface2 },
    shareResultBtn: { minHeight: 48, borderRadius: 13, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.accent },
    shareResultText: { color: ON_GOLD, fontSize: 13.5, fontWeight: "900" },
    ghostBtn: { minHeight: 46, borderRadius: 13, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    ghostBtnText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    scoreInline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    scoreInlineText: { color: c.text, fontSize: 14, fontWeight: "900" },
    doneTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 30, textAlign: "center" },
    doneText: { color: c.dim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 8 },
    retryBtn: { marginTop: 20, backgroundColor: c.accent, borderRadius: 13, minHeight: 46, paddingHorizontal: 18, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
    retryText: { color: ON_GOLD, fontSize: 13, fontWeight: "900" },
  });
}
