from pathlib import Path


def patch(path, transforms):
    p=Path(path); s=p.read_text()
    for old,new,label in transforms:
        c=s.count(old)
        if c!=1: raise SystemExit(f'{path} {label}: expected 1 found {c}')
        s=s.replace(old,new,1)
    p.write_text(s)

# Root route so push/in-app nudge can open the task screen.
patch('src/navigation/RootNavigator.js', [
('import DiaryScreen from "../screens/DiaryScreen";','import DiaryScreen from "../screens/DiaryScreen";\nimport RateTasteScreen from "../screens/RateTasteScreen";','rate import'),
('<Stack.Screen name="Diary" component={DiaryScreen} options={{ presentation: "card" }} />','<Stack.Screen name="Diary" component={DiaryScreen} options={{ presentation: "card" }} />\n        <Stack.Screen name="RateTaste" component={RateTasteScreen} options={{ presentation: "card" }} />','rate route'),
])

# Discover: keep left swipe = skip, clarify right swipe = fast preference.
patch('src/screens/DiscoverScreen.js', [
('<Text style={styles.stampLikeText}>SEVDİM</Text>','<Text style={styles.stampLikeText}>ZEVKİME GÖRE</Text>','discover stamp'),
('Bu turda {sessionLikes} şey beğendin','Bu turda {sessionLikes} içeriği zevkine göre işaretledin','discover summary'),
('Pellix {sessionLikes} yeni sinyal öğrendi.','Pellix {sessionLikes} yeni zevk sinyali öğrendi.','discover milestone'),
])

# Detail: fast preference wording. Negative already says Bana göre değil.
patch('src/screens/DetailScreen.js', [
('<Text style={styles.actionText}>Beğendim</Text>','<Text style={styles.actionText}>Zevkime göre</Text>','detail like wording'),
])

# Home soft nudge: only appears after enough unrated fast taste signals.
patch('src/screens/HomeScreenV2.js', [
('import { api } from "../api/client";','import { api } from "../api/client";\nimport { diaryApi } from "../api/diary";','home diary import'),
('  const [questData, setQuestData] = useState(null);','  const [questData, setQuestData] = useState(null);\n  const [diaryStats, setDiaryStats] = useState(null);','home diary state'),
('''    api.quests(auth.token).then(setQuestData).catch(() => setQuestData(null));
    loadTrending();''','''    api.quests(auth.token).then(setQuestData).catch(() => setQuestData(null));
    diaryApi.stats(auth.token).then(setDiaryStats).catch(() => setDiaryStats(null));
    loadTrending();''','home stats load'),
('''        <View style={styles.todayHeaderRow}>''','''        {Number(diaryStats?.tasteCandidatesUnrated || 0) >= 5 && (
          <TouchableOpacity style={styles.ratingNudgeCard} activeOpacity={0.86} onPress={() => navigation.navigate("RateTaste")}>
            <View style={styles.ratingNudgeIcon}><Star size={17} color="#FFD76A" fill="rgba(255,215,106,0.16)" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.ratingNudgeEyebrow}>ZEVK PROFİLİNİ DERİNLEŞTİR</Text>
              <Text style={styles.ratingNudgeTitle}>İzlediklerini puanlamak ister misin?</Text>
              <Text style={styles.ratingNudgeText}>{diaryStats.tasteCandidatesUnrated} zevk sinyalinden izlediklerini seç; puan vermek opsiyonel.</Text>
            </View>
            <ChevronRight size={17} color={c.dim} />
          </TouchableOpacity>
        )}

        <View style={styles.todayHeaderRow}>''','home nudge render'),
('''    quickRow: { gap: 8, paddingTop: 12, paddingBottom: 2 },''','''    quickRow: { gap: 8, paddingTop: 12, paddingBottom: 2 },
    ratingNudgeCard: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,215,106,0.22)", backgroundColor: "rgba(255,215,106,0.07)", padding: 12 },
    ratingNudgeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,215,106,0.10)" },
    ratingNudgeEyebrow: { color: "#FFD76A", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.65 },
    ratingNudgeTitle: { color: c.text, fontSize: 12.5, fontWeight: "850", marginTop: 2 },
    ratingNudgeText: { color: c.dim, fontSize: 10, lineHeight: 14, marginTop: 2 },''','home nudge styles'),
])

# Profile: rename the fast signal and provide a persistent deepening CTA.
patch('src/screens/ProfileScreen.js', [
('import { api } from "../api/client";','import { api } from "../api/client";\nimport { diaryApi } from "../api/diary";','profile diary import'),
('  const [achievements, setAchievements] = useState(null);','  const [achievements, setAchievements] = useState(null);\n  const [diaryStats, setDiaryStats] = useState(null);','profile diary state'),
('''    api.achievements(auth.token).then(setAchievements).catch(() => {});''','''    api.achievements(auth.token).then(setAchievements).catch(() => {});
    diaryApi.stats(auth.token).then(setDiaryStats).catch(() => setDiaryStats(null));''','profile stats load'),
('<Text style={styles.statLabel}>Beğeni</Text>','<Text style={styles.statLabel}>Zevk</Text>','profile stat label'),
('<Text style={[styles.contentTabText, sub === "likes" && styles.contentTabTextActive]}>Beğeniler</Text>','<Text style={[styles.contentTabText, sub === "likes" && styles.contentTabTextActive]}>Zevkim</Text>','profile tab label'),
('onPress={() => navigation.navigate("AllLikes", { userId: auth.id, title: "Beğenilerim" })}','onPress={() => navigation.navigate("AllLikes", { userId: auth.id, title: "Zevkime göre" })}','all likes title'),
(') : <Text style={styles.emptyText}>Henüz bir beğeni yok.</Text>',') : <Text style={styles.emptyText}>Henüz bir zevk sinyalin yok.</Text>','profile empty'),
('''          <View style={styles.typeSplitRow}>
            <Text style={styles.typeSplitLabel}>Film %{tasteDNA.filmPercent}</Text>
            <View style={styles.typeSplitTrack}>
              <View style={[styles.typeSplitFilm, { width: `${tasteDNA.filmPercent}%` }]} />
            </View>
            <Text style={styles.typeSplitLabel}>Dizi %{tasteDNA.showPercent}</Text>
          </View>
        </View>''','''          <View style={styles.typeSplitRow}>
            <Text style={styles.typeSplitLabel}>Film %{tasteDNA.filmPercent}</Text>
            <View style={styles.typeSplitTrack}>
              <View style={[styles.typeSplitFilm, { width: `${tasteDNA.filmPercent}%` }]} />
            </View>
            <Text style={styles.typeSplitLabel}>Dizi %{tasteDNA.showPercent}</Text>
          </View>
          {Number(diaryStats?.tasteCandidatesUnrated || 0) > 0 && (
            <TouchableOpacity style={styles.deepenTasteBtn} onPress={() => navigation.navigate("RateTaste")} activeOpacity={0.84}>
              <Star size={14} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.deepenTasteTitle}>İzlediklerini puanla</Text>
                <Text style={styles.deepenTasteMeta}>{diaryStats.tasteCandidatesUnrated} zevk sinyali daha derinleştirilebilir{diaryStats.ratedTotal ? ` · ${diaryStats.ratedTotal} puanın var` : ""}</Text>
              </View>
              <ChevronRight size={15} color={c.dim} />
            </TouchableOpacity>
          )}
        </View>''','profile deep CTA'),
('''    retentionRow:''','''    deepenTasteBtn: { marginTop: 13, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    deepenTasteTitle: { color: c.text, fontSize: 11.5, fontWeight: "850" },
    deepenTasteMeta: { color: c.dim, fontSize: 9.5, marginTop: 2 },
    retentionRow:''','profile deep styles'),
])

# Notifications list understands the new gated rating push.
patch('src/screens/NotificationsScreen.js', [
('case "friend_battle_result": return `Friend Battle sonucunuz hazır: %${p.percent || 0} zevk senkronu 🔥`;','case "friend_battle_result": return `Friend Battle sonucunuz hazır: %${p.percent || 0} zevk senkronu 🔥`;\n    case "rating_nudge": return "Zevkime göre işaretlediklerinden izlediklerini puanlamak ister misin?";','notification text'),
('case "friend_battle_result": return { person: p.by, icon: TrophyIconFallback, color: "#7C3AED" };','case "friend_battle_result": return { person: p.by, icon: TrophyIconFallback, color: "#7C3AED" };\n    case "rating_nudge": return { person: null, icon: Sparkles, color: "#8B5CF6" };','notification meta'),
('''    else if (SHARED_ITEM_TYPES.includes(n.type)) navigation.navigate("SharedItem", { kind: p.targetKind, id: p.targetId });''','''    else if (SHARED_ITEM_TYPES.includes(n.type)) navigation.navigate("SharedItem", { kind: p.targetKind, id: p.targetId });
    else if (n.type === "rating_nudge") navigation.navigate("RateTaste");''','notification tap'),
('''const clickable = item.type === "party_accepted" || item.type === "party_match" || FRIEND_BATTLE_TYPES.includes(item.type) || SHARED_ITEM_TYPES.includes(item.type);''','''const clickable = item.type === "party_accepted" || item.type === "party_match" || item.type === "rating_nudge" || FRIEND_BATTLE_TYPES.includes(item.type) || SHARED_ITEM_TYPES.includes(item.type);''','notification clickable'),
])

# Language cleanup in Profile comments is not functional; user-facing semantics above are canonical.
print('taste/rating UX patch applied')
