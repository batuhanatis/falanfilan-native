import fs from "fs";

// API client
const apiPath = "src/api/play.js";
let api = fs.readFileSync(apiPath, "utf8");
api = api.replace(
  '  whoSaidIt: (token) => playRequest("/api/play/who-said-it", token),\n  answerWhoSaidIt: (token, questionId, chosen) => playRequest("/api/play/who-said-it/answer", token, { method: "POST", body: { questionId, chosen } }),',
  `  whoSaidIt: (token, { mode = "classic", kind = "all", difficulty = "all" } = {}) => {\n    const qs = new URLSearchParams({ mode, kind, difficulty }).toString();\n    return playRequest(\`/api/play/who-said-it?\${qs}\`, token);\n  },\n  answerWhoSaidIt: (token, questionId, chosen, context = {}) => playRequest("/api/play/who-said-it/answer", token, { method: "POST", body: { questionId, chosen, ...context } }),`
);
if (!api.includes("new URLSearchParams({ mode, kind, difficulty })")) throw new Error("play.js Who Said It API patch başarısız");
fs.writeFileSync(apiPath, api);

// Screen
const screenPath = "src/screens/PellixPlayScreen.js";
let s = fs.readFileSync(screenPath, "utf8");

const newComponent = `function WhoSaidIt({ token, styles, c, onDisabled }) {
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

  const startRound = useCallback(async (mode = "classic") => {
    const nextKind = mode === "daily" ? "all" : kind;
    const nextDifficulty = mode === "daily" ? "all" : difficulty;
    setLoading(true);
    setStarted(true);
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setAnswering(false);
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
    backgroundColor: active ? "rgba(240,180,41,0.12)" : c.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  });
  const pillText = (active) => ({ color: active ? c.accent : c.dim, fontWeight: "800", fontSize: 12 });

  if (!started) {
    return (
      <ScrollView contentContainerStyle={styles.gameContent}>
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => startRound("daily")}
          style={{ borderRadius: 18, borderWidth: 1, borderColor: c.accent, backgroundColor: "rgba(240,180,41,0.10)", padding: 18, gap: 8 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.gameIcon}><Quote size={21} color={c.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: "900" }}>Günün Challenge'ı</Text>
              <Text style={{ color: c.dim, fontSize: 12.5, marginTop: 3 }}>Her gün herkes için aynı 5 soru. Tekrar oynarsan set değişmez.</Text>
            </View>
            <ArrowRight size={18} color={c.accent} />
          </View>
        </TouchableOpacity>

        <View style={{ marginTop: 24, gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "900" }}>Klasik Tur</Text>
          <Text style={{ color: c.dim, fontSize: 12.5, lineHeight: 18 }}>10 soruluk turunu içerik türüne ve zorluğa göre ayarla.</Text>
        </View>

        <Text style={{ color: c.dim, fontSize: 11, fontWeight: "800", marginTop: 18, marginBottom: 8, letterSpacing: 0.5 }}>İÇERİK</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[["all", "Tümü"], ["movie", "Film"], ["tv", "Dizi"]].map(([value, label]) => (
            <TouchableOpacity key={value} style={pill(kind === value)} onPress={() => setKind(value)}>
              <Text style={pillText(kind === value)}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: c.dim, fontSize: 11, fontWeight: "800", marginTop: 18, marginBottom: 8, letterSpacing: 0.5 }}>ZORLUK</Text>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {[["all", "Tümü"], ["easy", "Kolay"], ["medium", "Orta"], ["hard", "Zor"]].map(([value, label]) => (
            <TouchableOpacity key={value} style={pill(difficulty === value)} onPress={() => setDifficulty(value)}>
              <Text style={pillText(difficulty === value)}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 22 }]} onPress={() => startRound("classic")}>
          <Text style={styles.primaryBtnText}>10 Soruluk Turu Başlat</Text>
          <ArrowRight size={17} color={c.bg} />
        </TouchableOpacity>

        <Text style={{ color: c.dim, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 16 }}>
          Geniş havuzdaki replikler telifli diyalogları birebir arşivlemek yerine ikonik sahnelerin anlamını özgün ipuçlarıyla sorar.
        </Text>
      </ScrollView>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

  if (index >= questions.length) {
    return (
      <View style={styles.centerPad}>
        <Text style={styles.doneTitle}>{score}/{questions.length}</Text>
        <Text style={styles.doneText}>{round?.mode === "daily" ? "Bugünün challenge'ını tamamladın." : "Bu turdaki replik ipuçlarını tamamladın."}</Text>
        {stats?.promptVariants ? <Text style={{ color: c.dim, fontSize: 11, marginTop: 4 }}>{stats.promptVariants}+ soru varyasyonu içinden oynadın.</Text> : null}
        <TouchableOpacity style={styles.retryBtn} onPress={() => startRound(round?.mode || "classic")}>
          <RotateCcw size={16} color="#0d0d10" /><Text style={styles.retryText}>Tekrar Oyna</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={backToSetup} style={{ marginTop: 14, padding: 10 }}>
          <Text style={{ color: c.dim, fontSize: 12.5, fontWeight: "800" }}>Mod / Filtre Değiştir</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const q = questions[index];
  if (!q) return <GameDone styles={styles} title="Soru bulunamadı" text="Biraz sonra tekrar dene." onAgain={backToSetup} />;

  const difficultyLabel = { easy: "Kolay", medium: "Orta", hard: "Zor" }[q.difficulty] || "";
  const kindLabel = q.kind === "tv" ? "Dizi" : "Film";

  return (
    <ScrollView contentContainerStyle={styles.gameContent}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={styles.progressText}>{index + 1} / {questions.length} · Skor {score}</Text>
        <Text style={{ color: c.dim, fontSize: 11, fontWeight: "800" }}>{round?.mode === "daily" ? "Günlük" : `${kindLabel} · ${difficultyLabel}`}</Text>
      </View>

      <View style={[styles.blindCard, { gap: 12 }]}>
        <Quote size={32} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 20, lineHeight: 28, fontWeight: "800", textAlign: "center" }}>“{q.prompt}”</Text>
        <Text style={{ color: c.dim, fontSize: 12.5, textAlign: "center" }}>Bu ikonik an kime ait?</Text>
      </View>

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
              style={{
                minHeight: 52,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : c.border,
                backgroundColor: isCorrect ? "rgba(34,197,94,0.12)" : isWrong ? "rgba(239,68,68,0.12)" : c.surface,
                paddingHorizontal: 15,
                alignItems: "center",
                justifyContent: "center",
                opacity: answering ? 0.7 : 1,
              }}
            >
              <Text style={{ color: c.text, fontWeight: "800", fontSize: 14, textAlign: "center" }}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback && (
        <View style={{ marginTop: 18, gap: 10 }}>
          <Text style={{ color: feedback.correct ? "#22c55e" : "#ef4444", fontSize: 14, fontWeight: "900", textAlign: "center" }}>
            {feedback.correct ? "Doğru!" : `Doğru cevap: ${feedback.answer}`}
          </Text>
          <Text style={{ color: c.dim, fontSize: 12, textAlign: "center" }}>{feedback.movie}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>{index >= questions.length - 1 ? "Sonucu Gör" : "Sonraki"}</Text>
            <ArrowRight size={17} color={c.bg} />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

`;

const whoRe = /function WhoSaidIt\([\s\S]*?(?=function BlindPick\()/;
if (!whoRe.test(s)) throw new Error("WhoSaidIt component bulunamadı");
s = s.replace(whoRe, newComponent);
fs.writeFileSync(screenPath, s);
