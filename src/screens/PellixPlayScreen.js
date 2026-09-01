import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Swords, Users, EyeOff, Quote, RotateCcw, ArrowRight, Check, X, Sparkles, Share2, Trophy, LockKeyhole, Wand2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { playApi } from "../api/play";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import ShareCardModal from "../components/ShareCardModal";
import PlayResultShareCard from "../components/PlayResultShareCard";

const GAME_META = {
  taste_battle: {
    title: "Taste Battle",
    subtitle: "İki içerikten hangisini seçersin?",
    icon: Swords,
    colors: ["#7C3AED", "#2563EB"],
    accent: "#A78BFA",
    tag: "HIZLI SEÇİM",
  },
  friend_quiz: {
    title: "Arkadaşını Tanıyor musun?",
    subtitle: "Arkadaşının zevkini ne kadar biliyorsun?",
    icon: Users,
    colors: ["#EC4899", "#F97316"],
    accent: "#FB7185",
    tag: "SOSYAL",
  },
  blind_pick: {
    title: "Blind Pick",
    subtitle: "İsim ve poster yok. Sadece ipuçları.",
    icon: EyeOff,
    colors: ["#111827", "#475569"],
    accent: "#F59E0B",
    tag: "GİZEM",
  },
  who_said_it: {
    title: "Who Said It?",
    subtitle: "İkonik anın hangi karaktere ait olduğunu tahmin et.",
    icon: Quote,
    colors: ["#7F1D1D", "#6D28D9"],
    accent: "#C084FC",
    tag: "SİNEMA QUIZ",
  },
  character_quiz: {
    title: "Hangi Karaktersin?",
    subtitle: "Kısa bir testle hangi film/dizi karakterine benzediğini keşfet.",
    icon: Wand2,
    colors: ["#9333EA", "#DB2777"],
    accent: "#F0ABFC",
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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => activeGame ? setActiveGame(null) : navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={21} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{activeGame ? GAME_META[activeGame]?.title : "pellix play"}</Text>
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
      ) : activeGame === "who_said_it" ? (
        <WhoSaidIt token={auth.token} styles={styles} c={c} onDisabled={() => { setActiveGame(null); refreshFeatures(); }} />
      ) : activeGame === "character_quiz" ? (
        <CharacterQuiz token={auth.token} styles={styles} c={c} onDisabled={() => { setActiveGame(null); refreshFeatures(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.hubContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={["#6D28D9", "#2563EB", "#0891B2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hubHero}>
            <View style={styles.hubGlowOne} />
            <View style={styles.hubGlowTwo} />
            <Sparkles size={23} color="rgba(255,255,255,0.30)" style={{ position: "absolute", right: 22, top: 20 }} />
            <Text style={styles.hubEyebrow}>PELLIX PLAY</Text>
            <Text style={styles.hubHeroTitle}>Bugün ne oynayalım?</Text>
            <Text style={styles.hubHeroSub}>Kısa turlar, hızlı kararlar ve arkadaşlarınla paylaşabileceğin sonuçlar.</Text>
          </LinearGradient>

          <Text style={styles.sectionLabel}>MİNİ OYUNLAR</Text>
          {enabledKeys.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>Şu anda açık bir mini oyun yok.</Text></View>
          ) : enabledKeys.map((key) => {
            const meta = GAME_META[key];
            const Icon = meta.icon;
            return (
              <TouchableOpacity key={key} onPress={() => setActiveGame(key)} activeOpacity={0.86} style={styles.gameCardTouch}>
                <LinearGradient colors={meta.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameCard}>
                  <View style={styles.gameCardGlow} />
                  <View style={styles.gameIcon}><Icon size={22} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.gameTitleRow}>
                      <Text style={styles.gameTitle}>{meta.title}</Text>
                      <View style={styles.gameTag}><Text style={styles.gameTagText}>{meta.tag}</Text></View>
                    </View>
                    <Text style={styles.gameSub}>{meta.subtitle}</Text>
                  </View>
                  <View style={styles.gameArrow}><ArrowRight size={18} color="#fff" /></View>
                </LinearGradient>
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#8B5CF6" /></View>;
  if (done) {
    const result = buildTasteResult(selections);
    return (
      <>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={GAME_META.taste_battle.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultHero}>
            <Sparkles size={24} color="rgba(255,255,255,0.26)" style={{ position: "absolute", top: 20, right: 22 }} />
            <View style={styles.resultIcon}><Swords size={28} color="#fff" /></View>
            <Text style={styles.resultEyebrow}>TASTE BATTLE SONUCUN</Text>
            <Text style={styles.resultTitle}>{result.topGenre || "Karışık Zevk"}</Text>
            <Text style={styles.resultSummary}>{result.summary}</Text>
          </LinearGradient>

          <View style={styles.resultStatsRow}>
            <ResultStat value={String(selections.length)} label="SEÇİM" styles={styles} />
            <ResultStat value={`%${result.moviePercent}`} label="FİLM" styles={styles} />
            <ResultStat value={`%${100 - result.moviePercent}`} label="DİZİ" styles={styles} />
          </View>

          {result.posters.length > 0 && (
            <View style={styles.resultPanel}>
              <Text style={styles.resultPanelTitle}>Bu turdaki favori seçimlerin</Text>
              <View style={styles.resultPosterRow}>
                {result.posters.slice(0, 4).map((poster, i) => <Image key={`${poster}-${i}`} source={{ uri: poster }} style={styles.resultPoster} />)}
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.shareResultBtn, { backgroundColor: "#7C3AED" }]} onPress={() => setShowShare(true)}>
            <Share2 size={17} color="#fff" />
            <Text style={styles.shareResultText}>Sonuç Kartını Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={load}>
            <RotateCcw size={16} color={c.text} />
            <Text style={styles.ghostBtnText}>Tekrar Oyna</Text>
          </TouchableOpacity>
        </ScrollView>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`Taste Battle sonucum: ${result.topGenre || "Karışık Zevk"}. Seninki ne? 🎮`}
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
  if (!pair) return <GameDone styles={styles} title="Eşleşme bulunamadı" text="Biraz sonra tekrar dene." onAgain={load} />;

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <GameHero meta={GAME_META.taste_battle} styles={styles} icon={Swords} title="Hızlı düşün, içinden geleni seç" subtitle="Doğru cevap yok. Her seçim zevk profilini biraz daha netleştiriyor." />
      <Text style={styles.progressText}>{index + 1} / {pairs.length}</Text>
      <Text style={styles.questionTitle}>Hangisini seçersin?</Text>
      <View style={styles.battleRow}>
        <MovieChoice movie={pair.left} styles={styles} onPress={() => choose(pair.left, pair.right)} accent="#8B5CF6" />
        <View style={[styles.vsBadge, { backgroundColor: "#8B5CF6" }]}><Text style={styles.vsText}>VS</Text></View>
        <MovieChoice movie={pair.right} styles={styles} onPress={() => choose(pair.right, pair.left)} accent="#8B5CF6" />
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FB7185" /></View>;

  if (!started) {
    return (
      <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
        <GameHero meta={GAME_META.friend_quiz} styles={styles} icon={Users} title="Kimi ne kadar iyi tanıyorsun?" subtitle="Önce arkadaşını seç, sonra onun film ve dizi zevkini tahmin et." />
        <Text style={styles.friendPickerTitle}>Arkadaşını seç</Text>
        <Text style={styles.friendPickerSub}>En az 10 beğenisi olan arkadaşlarınla hemen oynayabilirsin.</Text>

        {friends.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>Henüz oynayabileceğin bir arkadaş görünmüyor.</Text></View>
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
              <Text style={[styles.friendPickerStatus, friend.ready && { color: "#FB7185" }]}>
                {friend.ready ? `${friend.questionCount} soruluk tur hazır` : `${friend.likeCount || 0}/10 beğeni · biraz daha gerekiyor`}
              </Text>
            </View>
            {friend.ready ? <ArrowRight size={18} color="#FB7185" /> : <LockKeyhole size={16} color={c.dim} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  if (!data?.friend || !data.questions?.length) {
    return <GameDone styles={styles} title="Şimdilik oynanamıyor" text={data?.unavailableReason || `${selectedFriend?.name || "Bu arkadaş"} için yeterli veri oluşunca açılacak.`} onAgain={loadFriends} />;
  }

  if (index >= data.questions.length) {
    const percent = Math.round((score / data.questions.length) * 100);
    return (
      <>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={GAME_META.friend_quiz.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultHero}>
            <RetryImage source={{ uri: avatarOr(data.friend.avatarUrl, data.friend.id) }} style={styles.resultFriendAvatar} />
            <Text style={styles.resultEyebrow}>ARKADAŞINI TANIYOR MUSUN?</Text>
            <Text style={styles.resultBigPercent}>%{percent}</Text>
            <Text style={styles.resultFriendName}>{data.friend.name}</Text>
            <Text style={styles.resultSummary}>{friendResultCopy(percent)}</Text>
          </LinearGradient>

          <View style={styles.resultPanel}>
            <View style={styles.scoreInline}><Trophy size={19} color="#F59E0B" /><Text style={styles.scoreInlineText}>{score}/{data.questions.length} doğru cevap</Text></View>
            <Text style={styles.doneText}>Bu skoru paylaş; bakalım arkadaşın itiraz edecek mi.</Text>
          </View>

          <TouchableOpacity style={[styles.shareResultBtn, { backgroundColor: "#EC4899" }]} onPress={() => setShowShare(true)}>
            <Share2 size={17} color="#fff" />
            <Text style={styles.shareResultText}>Sonuç Kartını Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={loadFriends}>
            <Users size={16} color={c.text} />
            <Text style={styles.ghostBtnText}>Başka Arkadaş Seç</Text>
          </TouchableOpacity>
        </ScrollView>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`${data.friend.name}'i ne kadar iyi tanıyorum? Skorum %${percent} 😄 Sen de dene.`}
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
      <LinearGradient colors={GAME_META.friend_quiz.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.friendHeaderGradient}>
        <RetryImage source={{ uri: avatarOr(data.friend.avatarUrl, data.friend.id) }} style={styles.friendAvatar} />
        <View style={{ flex: 1 }}><Text style={styles.friendName}>{data.friend.name}</Text><Text style={styles.friendSub}>Hangisini beğenmiş?</Text></View>
        <Users size={20} color="rgba(255,255,255,0.80)" />
      </LinearGradient>
      <Text style={styles.progressText}>{index + 1} / {data.questions.length} · Skor {score}</Text>
      <View style={styles.battleRow}>
        {[q.left, q.right].map((movie) => {
          const isCorrect = feedback && movie.id === q.correctMovieId;
          const isWrongChosen = feedback && feedback.chosenId === movie.id && !isCorrect;
          return <MovieChoice key={movie.id} movie={movie} styles={styles} onPress={() => answer(movie)} state={isCorrect ? "correct" : isWrongChosen ? "wrong" : null} accent="#FB7185" />;
        })}
      </View>
      {feedback && (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: feedback.correct ? "#22C55E" : "#EC4899" }]} onPress={next}>
          {feedback.correct ? <Check size={17} color="#fff" /> : <X size={17} color="#fff" />}
          <Text style={[styles.primaryBtnText, { color: "#fff" }]}>{feedback.correct ? "Bildin! Devam" : "Olmadı, devam et"}</Text>
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
    borderColor: active ? "#C084FC" : c.border,
    backgroundColor: active ? "rgba(192,132,252,0.13)" : c.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  });
  const pillText = (active) => ({ color: active ? "#C084FC" : c.dim, fontWeight: "800", fontSize: 12 });

  if (!started) {
    return (
      <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
        <GameHero meta={GAME_META.who_said_it} styles={styles} icon={Quote} title="Sahneyi hatırla, karakteri bul" subtitle="Film ve dizi hafızanı kolaydan zora test et." />

        <TouchableOpacity activeOpacity={0.88} onPress={() => startRound("daily")} style={{ borderRadius: 18, overflow: "hidden" }}>
          <LinearGradient colors={["#F97316", "#DB2777"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dailyCard}>
            <View style={styles.gameIcon}><Quote size={21} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dailyTitle}>Günün Challenge'ı</Text>
              <Text style={styles.dailySub}>Her gün herkes için aynı 5 soru. Bugünkü skoru kap.</Text>
            </View>
            <ArrowRight size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ marginTop: 24, gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "900" }}>Klasik Tur</Text>
          <Text style={{ color: c.dim, fontSize: 12.5, lineHeight: 18 }}>10 soruluk turunu içerik türüne ve zorluğa göre ayarla.</Text>
        </View>

        <Text style={styles.filterLabel}>İÇERİK</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[["all", "Tümü"], ["movie", "Film"], ["tv", "Dizi"]].map(([value, label]) => (
            <TouchableOpacity key={value} style={pill(kind === value)} onPress={() => setKind(value)}>
              <Text style={pillText(kind === value)}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>ZORLUK</Text>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {[["all", "Tümü"], ["easy", "Kolay"], ["medium", "Orta"], ["hard", "Zor"]].map(([value, label]) => (
            <TouchableOpacity key={value} style={pill(difficulty === value)} onPress={() => setDifficulty(value)}>
              <Text style={pillText(difficulty === value)}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 22, backgroundColor: "#7C3AED" }]} onPress={() => startRound("classic")}>
          <Text style={[styles.primaryBtnText, { color: "#fff" }]}>10 Soruluk Turu Başlat</Text>
          <ArrowRight size={17} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#C084FC" /></View>;

  if (index >= questions.length) {
    const isDaily = round?.mode === "daily";
    return (
      <View style={styles.centerPad}>
        <LinearGradient colors={GAME_META.who_said_it.colors} style={styles.compactResultCircle}>
          <Text style={styles.compactResultScore}>{score}/{questions.length}</Text>
        </LinearGradient>
        <Text style={[styles.doneTitle, { marginTop: 18 }]}>Tur tamamlandı</Text>
        <Text style={styles.doneText}>{isDaily ? "Bugünün challenge'ını tamamladın." : "Bu turdaki sinema hafızanı test ettin."}</Text>
        {stats?.promptVariants ? <Text style={{ color: c.dim, fontSize: 11, marginTop: 4 }}>{stats.promptVariants}+ soru varyasyonu içinden oynadın.</Text> : null}
        <TouchableOpacity style={[styles.shareResultBtn, { backgroundColor: "#DB2777" }]} onPress={() => setShowShare(true)}>
          <Share2 size={17} color="#fff" />
          <Text style={styles.shareResultText}>Sonuç Kartını Paylaş</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: "#7C3AED" }]} onPress={() => startRound(round?.mode || "classic")}>
          <RotateCcw size={16} color="#fff" /><Text style={[styles.retryText, { color: "#fff" }]}>Tekrar Oyna</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={backToSetup} style={{ marginTop: 14, padding: 10 }}>
          <Text style={{ color: c.dim, fontSize: 12.5, fontWeight: "800" }}>Mod / Filtre Değiştir</Text>
        </TouchableOpacity>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`Sahneyi Hatırla, Karakteri Bul'da ${score}/${questions.length} yaptım 🎬 Sen de dene.`}
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
  if (!q) return <GameDone styles={styles} title="Soru bulunamadı" text="Biraz sonra tekrar dene." onAgain={backToSetup} />;

  const difficultyLabel = { easy: "Kolay", medium: "Orta", hard: "Zor" }[q.difficulty] || "";
  const kindLabel = q.kind === "tv" ? "Dizi" : "Film";

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <View style={styles.quizMetaRow}>
        <Text style={styles.progressText}>{index + 1} / {questions.length} · Skor {score}</Text>
        <Text style={{ color: "#C084FC", fontSize: 11, fontWeight: "800" }}>{round?.mode === "daily" ? "Günlük" : kindLabel + " · " + difficultyLabel}</Text>
      </View>

      <LinearGradient colors={GAME_META.who_said_it.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quoteGradient}>
        <Quote size={34} color="rgba(255,255,255,0.92)" />
        <Text style={styles.quotePrompt}>“{q.prompt}”</Text>
        <Text style={styles.quoteSub}>Bu ikonik an kime ait?</Text>
      </LinearGradient>

      <View style={{ gap: 10, marginTop: 18 }}>
        {q.options.map((option) => {
          const isCorrect = feedback && option === feedback.answer;
          const isWrong = feedback && option === feedback.chosen && !feedback.correct;
          return (
            <TouchableOpacity
              key={option}
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
              <Text style={styles.quizOptionText}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback && (
        <View style={{ marginTop: 18, gap: 10 }}>
          <Text style={{ color: feedback.correct ? "#22c55e" : "#ef4444", fontSize: 14, fontWeight: "900", textAlign: "center" }}>
            {feedback.correct ? "Doğru!" : "Doğru cevap: " + feedback.answer}
          </Text>
          <Text style={{ color: c.dim, fontSize: 12, textAlign: "center" }}>{feedback.movie}</Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: "#7C3AED" }]} onPress={next}>
            <Text style={[styles.primaryBtnText, { color: "#fff" }]}>{index >= questions.length - 1 ? "Sonucu Gör" : "Sonraki"}</Text>
            <ArrowRight size={17} color="#fff" />
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#F59E0B" /></View>;
  if (index >= items.length) return <GameDone styles={styles} title="Blind tur tamamlandı" text={`${items.length} içerik gördün.`} onAgain={load} />;
  const item = items[index];
  if (!item) return <GameDone styles={styles} title="İçerik bulunamadı" text="Biraz sonra tekrar dene." onAgain={load} />;
  const clue = item.clue || {};

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <GameHero meta={GAME_META.blind_pick} styles={styles} icon={EyeOff} title="Posteri unut, içgüdüne güven" subtitle="İpuçlarından karar ver; sonra ne seçtiğini gör." />
      <Text style={styles.progressText}>{index + 1} / {items.length}</Text>
      {!revealed ? (
        <>
          <LinearGradient colors={["#111827", "#1F2937", "#334155"]} style={styles.blindCardGradient}>
            <EyeOff size={36} color="#F59E0B" />
            <Text style={styles.blindTitle}>Bu ne olabilir?</Text>
            <View style={styles.clueChip}><Text style={styles.clueChipText}>{clue.year || "?"} · {clue.type === "tv" ? "Dizi" : "Film"}</Text></View>
            <View style={styles.clueChip}><Text style={styles.clueChipText}>{(clue.genres || []).join(" · ") || "Tür gizli"}</Text></View>
            <View style={styles.clueChip}><Text style={styles.clueChipText}>IMDb {clue.imdb || "?"}{clue.runtime ? ` · ${clue.runtime} dk` : ""}</Text></View>
          </LinearGradient>
          <View style={styles.choiceButtons}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => decide(false)}><Text style={styles.secondaryBtnText}>Geç</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtnFlex, { backgroundColor: "#F59E0B" }]} onPress={() => decide(true)}><Text style={styles.primaryBtnText}>İzlerim</Text></TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.revealCard, { borderColor: "rgba(245,158,11,0.35)" }]}>
            {!!item.reveal?.poster && <Image source={{ uri: item.reveal.poster }} style={styles.revealPoster} />}
            <Text style={styles.revealTitle}>{item.reveal?.title}</Text>
            <Text style={styles.revealMeta}>{item.reveal?.year} · {item.reveal?.type === "tv" ? "Dizi" : "Film"} · IMDb {item.reveal?.imdb}</Text>
          </View>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: "#F59E0B" }]} onPress={next}><Text style={styles.primaryBtnText}>Sonraki</Text><ArrowRight size={17} color={c.bg} /></TouchableOpacity>
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#DB2777" /></View>;

  if (resolving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#DB2777" />
        <Text style={{ color: c.dim, fontSize: 12, marginTop: 12 }}>Karakterin belirleniyor...</Text>
      </View>
    );
  }

  if (result?.character) {
    const character = result.character;
    return (
      <>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[character.color || "#9333EA", "#111827"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultHero}>
            <Sparkles size={24} color="rgba(255,255,255,0.24)" style={{ position: "absolute", top: 20, right: 22 }} />
            {character.actorPhoto ? (
              <View style={{ marginTop: 4 }}>
                <RetryImage source={{ uri: character.actorPhoto }} style={styles.resultFriendAvatar} />
                <View style={styles.charEmojiBadge}><Text style={{ fontSize: 14 }}>{character.emoji}</Text></View>
              </View>
            ) : (
              <Text style={{ fontSize: 46 }}>{character.emoji}</Text>
            )}
            <Text style={styles.resultEyebrow}>HANGİ KARAKTERSİN?</Text>
            <Text style={styles.resultTitle}>{character.name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "800", marginTop: 2 }}>{character.title}</Text>
            {!!character.actor && (
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 2 }}>{character.actor} canlandırdı</Text>
            )}
            <Text style={styles.resultSummary}>{character.blurb}</Text>
          </LinearGradient>

          <View style={styles.resultPanel}>
            <View style={styles.scoreInline}><Sparkles size={18} color="#DB2777" /><Text style={styles.scoreInlineText}>%{result.matchPercent} uyum</Text></View>
            <Text style={[styles.doneText, { fontStyle: "italic" }]}>"{character.quote}"</Text>
          </View>

          <TouchableOpacity style={[styles.shareResultBtn, { backgroundColor: "#9333EA" }]} onPress={() => setShowShare(true)}>
            <Share2 size={17} color="#fff" />
            <Text style={styles.shareResultText}>Sonuç Kartını Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={load}>
            <RotateCcw size={16} color={c.text} />
            <Text style={styles.ghostBtnText}>Tekrar Oyna</Text>
          </TouchableOpacity>
        </ScrollView>

        {showShare && (
          <ShareCardModal
            onClose={() => setShowShare(false)}
            shareMessage={`Hangi Karaktersin testinde ${character.name} çıktım (%${result.matchPercent} uyum) 🎭 Sen de dene.`}
            socialCard={{ kind: "character_quiz", character, matchPercent: result.matchPercent }}
          >
            <PlayResultShareCard mode="character" character={character} matchPercent={result.matchPercent} />
          </ShareCardModal>
        )}
      </>
    );
  }

  const q = questions[index];
  if (!q) return <GameDone styles={styles} title="Soru bulunamadı" text="Biraz sonra tekrar dene." onAgain={load} />;

  return (
    <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
      <GameHero meta={GAME_META.character_quiz} styles={styles} icon={Wand2} title="Kısa bir testle keşfet" subtitle="Doğru cevap yok, içinden geleni seç." />
      <Text style={styles.progressText}>{index + 1} / {questions.length}</Text>
      <Text style={[styles.questionTitle, { fontSize: 17, lineHeight: 23 }]}>{q.prompt}</Text>
      <View style={{ gap: 10 }}>
        {q.options.map((option) => (
          <TouchableOpacity key={option.id} onPress={() => choose(option)} activeOpacity={0.82} style={styles.quizOption}>
            <Text style={styles.quizOptionText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function GameHero({ meta, styles, icon: Icon, title, subtitle }) {
  return (
    <LinearGradient colors={meta.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameHero}>
      <View style={styles.gameHeroGlow} />
      <View style={styles.gameHeroIcon}><Icon size={23} color="#fff" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.gameHeroTag}>{meta.tag}</Text>
        <Text style={styles.gameHeroTitle}>{title}</Text>
        <Text style={styles.gameHeroSub}>{subtitle}</Text>
      </View>
    </LinearGradient>
  );
}

function ResultStat({ value, label, styles }) {
  return (
    <View style={styles.resultStatBox}>
      <Text style={styles.resultStatValue}>{value}</Text>
      <Text style={styles.resultStatLabel}>{label}</Text>
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
  return "Bu turda tek bir kalıba sığmayan, karışık bir zevk çizdin.";
}

function buildTasteResult(selections) {
  const genreCounts = new Map();
  selections.forEach((movie) => {
    movieGenres(movie).forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
  });
  const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Karışık Zevk";
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
  if (percent >= 90) return "Zevkini ezbere biliyorsun. Bu skor kolay kolay gelmez.";
  if (percent >= 70) return "Aynı frekanstasınız. Tercihlerinin çoğunu doğru okudun.";
  if (percent >= 50) return "Fena değil. Birkaç film gecesi daha işi çözer.";
  return "Sürprizlerle dolu bir arkadaşlık. Zevkini yeniden keşfetme zamanı.";
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
    headerTitle: { fontFamily: "Baloo2_800ExtraBold", fontSize: 18, color: c.text },
    headerSub: { fontSize: 10.5, color: c.dim, marginTop: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    centerPad: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
    hubContent: { padding: 18, paddingBottom: 40 },
    hubHero: { borderRadius: 24, padding: 22, minHeight: 178, justifyContent: "flex-end", overflow: "hidden", marginBottom: 24 },
    hubGlowOne: { position: "absolute", width: 190, height: 190, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", right: -70, top: -90 },
    hubGlowTwo: { position: "absolute", width: 130, height: 130, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", left: -50, bottom: -70 },
    hubEyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
    hubHeroTitle: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900", marginTop: 6 },
    hubHeroSub: { color: "rgba(255,255,255,0.82)", fontSize: 12.5, lineHeight: 18, marginTop: 7, maxWidth: 300 },
    sectionLabel: { color: c.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 },
    gameCardTouch: { borderRadius: 19, overflow: "hidden", marginBottom: 12 },
    gameCard: { minHeight: 94, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 14, overflow: "hidden" },
    gameCardGlow: { position: "absolute", width: 110, height: 110, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.09)", right: -35, top: -40 },
    gameIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "rgba(8,9,20,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
    gameTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
    gameTitle: { fontSize: 14, fontWeight: "900", color: "#fff" },
    gameTag: { backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2.5 },
    gameTagText: { color: "rgba(255,255,255,0.88)", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.5 },
    gameSub: { fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 4, lineHeight: 15 },
    gameArrow: { width: 32, height: 32, borderRadius: 999, backgroundColor: "rgba(8,9,20,0.18)", alignItems: "center", justifyContent: "center" },
    emptyCard: { padding: 20, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    emptyText: { color: c.dim, textAlign: "center", fontSize: 12 },
    gameContent: { padding: 18, paddingBottom: 40 },
    gameHero: { minHeight: 112, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, overflow: "hidden", marginBottom: 18 },
    gameHeroGlow: { position: "absolute", width: 120, height: 120, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", right: -35, top: -48 },
    gameHeroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(8,9,20,0.22)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
    gameHeroTag: { color: "rgba(255,255,255,0.70)", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.0 },
    gameHeroTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 3 },
    gameHeroSub: { color: "rgba(255,255,255,0.80)", fontSize: 10.5, lineHeight: 15, marginTop: 3 },
    progressText: { color: c.dim, fontSize: 11, fontWeight: "700", textAlign: "center", marginBottom: 10 },
    questionTitle: { color: c.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 18 },
    battleRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    movieChoice: { flex: 1, backgroundColor: c.surface, borderWidth: 1.2, borderColor: c.border, borderRadius: 18, padding: 8, overflow: "hidden" },
    correctChoice: { borderColor: "#22c55e", borderWidth: 2 },
    wrongChoice: { borderColor: "#ef4444", borderWidth: 2 },
    choicePoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: c.surface2 },
    choiceTitle: { color: c.text, fontWeight: "800", fontSize: 13, marginTop: 8 },
    choiceMeta: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    vsBadge: { position: "absolute", zIndex: 2, left: "50%", top: 115, marginLeft: -18, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.bg },
    vsText: { color: "#fff", fontWeight: "900", fontSize: 11 },
    friendPickerTitle: { color: c.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
    friendPickerSub: { color: c.dim, fontSize: 11.5, lineHeight: 17, marginTop: 5, marginBottom: 14 },
    friendPickerRow: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 70, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: "rgba(251,113,133,0.30)", marginBottom: 9 },
    friendPickerRowDisabled: { opacity: 0.52, borderColor: c.border },
    friendPickerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.surface2 },
    friendPickerName: { color: c.text, fontSize: 13.5, fontWeight: "900" },
    friendPickerStatus: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    friendHeaderGradient: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, borderRadius: 18, padding: 13, overflow: "hidden" },
    friendAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2, borderWidth: 2, borderColor: "rgba(255,255,255,0.45)" },
    friendName: { color: "#fff", fontSize: 14.5, fontWeight: "900" },
    friendSub: { color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 2 },
    primaryBtn: { marginTop: 16, minHeight: 46, borderRadius: 13, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, paddingHorizontal: 16 },
    primaryBtnFlex: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    primaryBtnText: { color: c.bg, fontSize: 13, fontWeight: "900" },
    secondaryBtn: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    secondaryBtnText: { color: c.text, fontSize: 13, fontWeight: "800" },
    choiceButtons: { flexDirection: "row", gap: 10, marginTop: 14 },
    blindCardGradient: { minHeight: 276, borderRadius: 22, alignItems: "center", justifyContent: "center", padding: 24, borderWidth: 1, borderColor: "rgba(245,158,11,0.28)" },
    blindTitle: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 14, marginBottom: 18 },
    clueChip: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
    clueChipText: { color: "rgba(255,255,255,0.83)", fontSize: 12.5, fontWeight: "700", textAlign: "center" },
    revealCard: { alignItems: "center", padding: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18 },
    revealPoster: { width: 160, aspectRatio: 2 / 3, borderRadius: 14, backgroundColor: c.surface2 },
    revealTitle: { color: c.text, fontSize: 18, fontWeight: "900", marginTop: 14, textAlign: "center" },
    revealMeta: { color: c.dim, fontSize: 11.5, marginTop: 5 },
    dailyCard: { minHeight: 86, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 11, padding: 14, overflow: "hidden" },
    dailyTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
    dailySub: { color: "rgba(255,255,255,0.78)", fontSize: 10.5, lineHeight: 14, marginTop: 3 },
    filterLabel: { color: c.dim, fontSize: 10.5, fontWeight: "900", marginTop: 18, marginBottom: 8, letterSpacing: 0.7 },
    quizMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
    quoteGradient: { minHeight: 260, borderRadius: 22, gap: 13, alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" },
    quotePrompt: { color: "#fff", fontSize: 19, lineHeight: 27, fontWeight: "900", textAlign: "center" },
    quoteSub: { color: "rgba(255,255,255,0.72)", fontSize: 12, textAlign: "center" },
    quizOption: { minHeight: 54, borderRadius: 15, borderWidth: 1, borderColor: "rgba(192,132,252,0.26)", backgroundColor: c.surface, paddingHorizontal: 15, alignItems: "center", justifyContent: "center" },
    quizOptionCorrect: { borderColor: "#22C55E", backgroundColor: "rgba(34,197,94,0.12)" },
    quizOptionWrong: { borderColor: "#EF4444", backgroundColor: "rgba(239,68,68,0.12)" },
    quizOptionText: { color: c.text, fontWeight: "800", fontSize: 14, textAlign: "center" },
    compactResultCircle: { width: 112, height: 112, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    compactResultScore: { color: "#fff", fontSize: 28, fontWeight: "900" },
    resultContent: { padding: 18, paddingBottom: 44 },
    resultHero: { borderRadius: 24, minHeight: 280, alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" },
    resultIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: "rgba(8,9,20,0.20)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
    resultEyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1, marginTop: 14 },
    resultTitle: { color: "#fff", fontSize: 30, lineHeight: 36, fontWeight: "900", textAlign: "center", marginTop: 8 },
    resultSummary: { color: "rgba(255,255,255,0.84)", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 9, maxWidth: 290 },
    resultBigPercent: { color: "#fff", fontSize: 62, lineHeight: 68, fontWeight: "900", marginTop: 10 },
    resultFriendName: { color: "#fff", fontSize: 19, fontWeight: "900", marginTop: 4 },
    resultFriendAvatar: { width: 74, height: 74, borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
    charEmojiBadge: { position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.65)" },
    resultStatsRow: { flexDirection: "row", gap: 9, marginTop: 14 },
    resultStatBox: { flex: 1, minHeight: 76, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    resultStatValue: { color: c.text, fontSize: 20, fontWeight: "900" },
    resultStatLabel: { color: c.dim, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 },
    resultPanel: { marginTop: 14, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 16 },
    resultPanelTitle: { color: c.text, fontSize: 12.5, fontWeight: "900", marginBottom: 12 },
    resultPosterRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
    resultPoster: { width: 61, height: 91, borderRadius: 9, backgroundColor: c.surface2 },
    shareResultBtn: { minHeight: 48, borderRadius: 14, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    shareResultText: { color: "#fff", fontSize: 13, fontWeight: "900" },
    ghostBtn: { minHeight: 46, borderRadius: 14, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    ghostBtnText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    scoreInline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    scoreInlineText: { color: c.text, fontSize: 14, fontWeight: "900" },
    doneTitle: { color: c.text, fontSize: 24, fontWeight: "900", textAlign: "center" },
    doneText: { color: c.dim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 8 },
    retryBtn: { marginTop: 20, backgroundColor: c.accent, borderRadius: 13, minHeight: 44, paddingHorizontal: 18, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
    retryText: { color: c.bg, fontSize: 12.5, fontWeight: "900" },
  });
}
