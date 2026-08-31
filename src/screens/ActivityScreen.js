import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, Heart, PartyPopper, Plus, Sparkles, Users } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import TopBar from "../components/TopBar";
import SocialFeedCard from "../components/SocialFeedCard";
import SocialActivityGroup from "../components/SocialActivityGroup";
import SocialPostComposer from "../components/SocialPostComposer";
import NudgeCard from "../components/NudgeCard";
import BlendFriendPickerSheet from "../components/BlendFriendPickerSheet";
import StoryBar from "../components/StoryBar";
import LeaderboardCard from "../components/LeaderboardCard";

// ÖNEMLİ DÜZELTME: Havuz eskiden sadece 12 soruydu — gün numarası % 12 ile seçildiği için tam
// 12 günde bir baştan tekrarlıyordu ("başa sardı" şikayeti buradan geliyordu). 60'a çıkarıldı,
// aynı gün-bazlı seçim mantığıyla artık ~2 ayda bir tekrar ediyor.
const DAILY_QUESTIONS = [
  "Herkesin sevdiği ama senin sevmediğin film hangisi?",
  "Sonu seni en çok şaşırtan film veya dizi hangisi?",
  "Tekrar tekrar izleyebileceğin tek bir yapım seçsen hangisi olurdu?",
  "Bir arkadaşına gözün kapalı önereceğin dizi hangisi?",
  "Sence gereğinden az değer gören film hangisi?",
  "İlk 10 dakikasında seni yakalayan yapım hangisiydi?",
  "Bir karakterin hayatını yaşama şansın olsa kimi seçerdin?",
  "Sence devam filmi orijinalinden daha iyi olan yapım hangisi?",
  "Soundtrack'i yüzünden tekrar açtığın film hangisi?",
  "Bir gecede bitirdiğin en iyi dizi hangisi?",
  "Keşke hafızamdan silip ilk kez tekrar izlesem dediğin yapım hangisi?",
  "Seni en çok sinirlendiren final hangisiydi?",
  "Bir filmi izlemeden önce 'bu bana göre değil' deyip sonra bayıldığın yapım hangisiydi?",
  "Herkesin izlediğini söylediği ama senin hâlâ izlemediğin yapım hangisi?",
  "İzlerken ağladığın bir sahne hangi film veya diziye ait?",
  "En çok güldüğün sahne hangi yapımdaydı?",
  "Bittiğine hâlâ inanamadığın bir dizi finali hangisiydi?",
  "Sence erken bitirilmesi en büyük kayıp olan dizi hangisi?",
  "Fragmanı filmin/dizinin kendisinden daha iyiydi — hangisi için böyle düşünüyorsun?",
  "En sevdiğin kötü karakter (villain) hangisi?",
  "Kitaptan uyarlanan hangi film veya dizi, kitabından daha iyiydi?",
  "Bir sezonu diğerlerinden çok daha iyi olan dizi hangisi?",
  "Her sezon biraz daha kötüleşen bir dizi var mı, hangisi?",
  "En sevdiğin replik hangi film veya diziden?",
  "Afişine bayılıp izleyince hayal kırıklığına uğradığın yapım hangisiydi?",
  "Sence en haksız yere düşük puan almış film hangisi?",
  "Bir karakterin tarzını/kıyafetini kopyalamak istediğin yapım hangisi?",
  "İzlediğin en ürkütücü film hangisiydi?",
  "Uzun süre aklından çıkmayan bir final sahnesi hangisine ait?",
  "Bir filmi ya da diziyi sırf bir oyuncu için izlediğin oldu mu, kimdi?",
  "Senin için 'rahatlatıcı, her zaman dönülen' yapım hangisi?",
  "İlk izlediğinde pek anlamadığın ama yıllar sonra tekrar izleyince bayıldığın yapım hangisi?",
  "Bir filmin hangi sahnesinde, iyi anlamda, gerçekten şaşırdın?",
  "En sevdiğin açılış sahnesi/bölümü hangi yapıma ait?",
  "Remake'i orijinalinden daha iyi bulduğun bir yapım var mı, hangisi?",
  "Gerçek hayatta arkadaşın olmasını istediğin bir karakter kim?",
  "İçinde yaşamak isteyeceğin bir film/dizi evreni hangisi?",
  "Bir film ya da diziyi izlerken uyuyakaldığın oldu mu, hangisiydi?",
  "Küçükken izleyip şimdi 'buna nasıl izin verilmiş' dediğin bir yapım var mı?",
  "En sevdiğin dönemden (yıllardan) bir film hangisi?",
  "Bir oyuncunun en iyi performansını sence hangi film veya dizide izledin?",
  "Sence gereğinden çok övülen bir film veya dizi hangisi?",
  "Başkası önerdiği için izleyip sonunda sen de sevdiğin bir yapım oldu mu?",
  "Bittiğinde hemen başa sarıp tekrar izlediğin bir film/dizi var mı, hangisiydi?",
  "En sevdiğin arkadaş grubu/takım hangi dizide?",
  "Bir karakterin hikâye gelişimini (arkını) en çok hangi yapımda beğendin?",
  "Sence en iyi ikili (ship) hangi film veya dizide?",
  "Elinden telefonu bile bırakamadan izlediğin en son yapım neydi?",
  "En sevdiğin mini dizi (kısa, tek sezonluk) hangisi?",
  "Sence en güçlü bölüm-sonu merakı (cliffhanger) hangi dizide vardı?",
  "Hatırladığın en eski film/dizi izleme anın nedir?",
  "Bu hafta izlediğin en iyi şey neydi?",
  "Bir yapımı yanlış zamanda/modda izleyip tadını çıkaramadığın oldu mu, hangisiydi?",
  "Sence yetenekli ama hak ettiği ilgiyi görmeyen bir oyuncu kim?",
  "Bir yönetmenin en iyi işi sence hangisi?",
  "Farklı iki film/dizi evreninin kesişmesini istesen, hangi ikisi olurdu?",
  "Bir karakterle kendini en çok nerede özdeşleştirdin?",
  "Seni bir konuya bakışını değiştiren bir film veya dizi oldu mu, hangisi?",
  "İzlerken gerçekten 'burada olmak isterdim' dediğin bir mekân hangi yapımdaydı?",
  "Bir filmi/diziyi vizyona girdiğinde, sinemada izlemeyi çok isterdim dediğin hangisi?",
  "Bir dizi izlerken 'bu hafta bölüm ne zaman gelecek' diye sayılı gün beklediğin son yapım neydi?",
];

function getDailyQuestion() {
  const now = new Date();
  const dayKey = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  return DAILY_QUESTIONS[Math.abs(dayKey) % DAILY_QUESTIONS.length];
}

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expandActivityItems(items) {
  return (items || []).flatMap((item) => {
    if (item.kind !== "activity" || !Array.isArray(item.movies) || item.movies.length <= 1) {
      return [{ ...item, feedKey: String(item.id) }];
    }
    return item.movies.map((movie) => ({
      ...item,
      id: `${item.id}:${movie.id}`,
      feedKey: `${item.id}:${movie.id}`,
      activityCount: 1,
      movies: [movie],
    }));
  });
}

// Ardışık "activity" öğelerini (not/anket/kart taşımayan, otomatik üretilen beğendi/favorisi
// yaptı/liste oluşturdu aktiviteleri) tek bir "activity-group" öğesine topluyor —
// SocialActivityGroup bunları kompakt satırlar halinde tek bir kart içinde gösteriyor. Gerçek
// içerikli paylaşımlar (post) ve nudge kartları bir grubu böler, kendi ayrı öğeleri olarak kalır.
function groupActivities(items) {
  const result = [];
  let run = [];
  function flush() {
    if (!run.length) return;
    const first = run[0];
    const key = `group-${first.feedKey || first.id}`;
    result.push({ kind: "activity-group", id: key, feedKey: key, items: run });
    run = [];
  }
  for (const item of items) {
    if (item.kind === "activity") run.push(item);
    else { flush(); result.push(item); }
  }
  flush();
  return result;
}

export default function ActivityScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const listRef = useRef(null);
  useScrollToTop(listRef);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState("thought");
  const [composerContext, setComposerContext] = useState(null);
  const [dailyQuestion, setDailyQuestion] = useState(() => getDailyQuestion());
  const [blendPickerNudge, setBlendPickerNudge] = useState(null);
  const [stories, setStories] = useState({ myStories: [], friends: [] });
  const [leaderboard, setLeaderboard] = useState(null);
  const [myAvatar, setMyAvatar] = useState(null);

  // Story şeridi ve liderlik tablosu, ana feed'in refresh() akışından BAĞIMSIZ hafif bir
  // yeniden çekme fonksiyonuna sahip — bir story paylaşıldığında/silindiğinde/izlendiğinde
  // tüm feed'i yeniden yüklemeye (ve sıralamasını karıştırmaya) gerek yok.
  const refreshStories = useCallback(async () => {
    try {
      const data = await api.socialStories(auth.token);
      setStories({ myStories: data.myStories || [], friends: data.friends || [] });
    } catch {}
  }, [auth.token]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const fallbackQuestion = getDailyQuestion();
    const [feedResult, questionResult, storiesResult, leaderboardResult, meResult] = await Promise.allSettled([
      api.socialFeed(auth.token),
      api.dailyQuestion(localDateKey()),
      api.socialStories(auth.token),
      api.socialLeaderboard(auth.token),
      api.me(auth.token),
    ]);
    if (feedResult.status === "fulfilled") setFeed(groupActivities(expandActivityItems(feedResult.value.results)));
    else setFeed([]);
    setDailyQuestion(
      questionResult.status === "fulfilled" && questionResult.value?.question
        ? questionResult.value.question
        : fallbackQuestion
    );
    if (storiesResult.status === "fulfilled") {
      setStories({ myStories: storiesResult.value.myStories || [], friends: storiesResult.value.friends || [] });
    }
    if (leaderboardResult.status === "fulfilled") setLeaderboard(leaderboardResult.value);
    if (meResult.status === "fulfilled") setMyAvatar(meResult.value.avatarUrl || null);
    setLoading(false);
  }, [auth.token]);

  // ÖNEMLİ: Eskiden ekran her odaklandığında (başka bir sayfadan geri dönüşte, hatta sekmeler
  // arası geçişte) feed'i sessizce yeniden çekiyorduk — sıralama (bump/görülme/nudge) her
  // seferinde değişebildiği için kullanıcı kaldığı yerden değil, karışmış/kaymış bir listeyle
  // karşılaşıyordu. Artık SADECE ilk girişte (mount), kullanıcı en üstten çekip yenilediğinde
  // (refresh()) veya oturum kapatılıp açıldığında (bu ekran o zaman zaten yeniden mount olur)
  // yeniliyoruz — basit bir geri dönüşte liste olduğu gibi kalıyor.
  useEffect(() => { load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  // Bir kart ekranda GERÇEKTEN görününce (indirildiği an değil) backend'e bildiriyoruz, ki
  // sıralama sonraki yüklemede onu hafifçe geriye itebilsin — bkz. social-routes.js'teki
  // seen_by_viewer/SEEN_PENALTY_MS. Her kart için ayrı istek atmak yerine biriktirip (4sn'de bir,
  // ekrandan çıkarken de) TOPLU gönderiyoruz; nudge kartları bu takibin dışında çünkü onların
  // kendi ayrı bastırma mekanizması (nudge_dismissals) zaten var.
  const seenPending = useRef(new Set());
  const seenSent = useRef(new Set());
  const flushSeen = useCallback(() => {
    const ids = [...seenPending.current].filter((id) => !seenSent.current.has(id));
    if (!ids.length) return;
    seenPending.current.clear();
    ids.forEach((id) => seenSent.current.add(id));
    api.markFeedSeen(auth.token, ids).catch(() => {
      ids.forEach((id) => seenSent.current.delete(id));
    });
  }, [auth.token]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    for (const v of viewableItems) {
      const it = v.item;
      if (!it || it.kind === "nudge") continue;
      // Bir grup görününce, backend'in "görüldü" cezasını (bkz. social-routes.js SEEN_PENALTY_MS)
      // grubun sentetik anahtarına değil, İÇİNDEKİ HER aktivitenin gerçek anahtarına uygulaması
      // gerekiyor — yoksa kompakt satırlar hiç "görülmüş" sayılmaz, akışta hep en üstte kalırlar.
      if (it.kind === "activity-group") {
        it.items.forEach((sub) => { if (sub.feedKey) seenPending.current.add(sub.feedKey); });
      } else {
        const key = it.feedKey || it.id;
        if (key) seenPending.current.add(key);
      }
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 500 }).current;

  useEffect(() => {
    const timer = setInterval(flushSeen, 4000);
    return () => {
      clearInterval(timer);
      flushSeen();
    };
  }, [flushSeen]);

  useEffect(() => {
    const unsub = navigation.addListener("blur", flushSeen);
    return unsub;
  }, [navigation, flushSeen]);

  function openComposer(type, context = null) {
    setComposerType(type);
    setComposerContext(context);
    setComposerOpen(true);
  }

  function handleFeedChanged(event) {
    if (event?.type !== "deleted") return;
    setFeed((items) => items.filter((item) => Number(item.post?.id) !== Number(event.postId)));
  }

  // Sunucu, bir nudge'ı akışa dahil ettiği anda kendi tarafında zaten kısa süreliğine
  // bastırıyor (bkz. backend nudge_dismissals) — burada sadece bu ekrandan anında kaldırmak
  // için yerel state'i güncelliyoruz, ayrı bir ağ isteği gerekmiyor.
  function dismissNudge(nudgeId) {
    setFeed((items) => items.filter((item) => item.id !== nudgeId));
  }

  const header = (
    <View>
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.topActionTouch} onPress={() => navigation.navigate("GroupParty")} activeOpacity={0.88}>
          <LinearGradient colors={["#FF3D81", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topActionCard}>
            <View style={styles.topActionIcon}><PartyPopper size={19} color="#fff" /></View>
            <View><Text style={styles.topActionEyebrow}>BİRLİKTE SEÇ</Text><Text style={styles.topActionTitle}>MatchParty</Text></View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topActionTouch} onPress={() => navigation.navigate("TasteMate")} activeOpacity={0.88}>
          <LinearGradient colors={["#8B5CF6", "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topActionCard}>
            <View style={styles.topActionIcon}><Users size={18} color="#fff" /></View>
            <View><Text style={styles.topActionEyebrow}>KEŞFET</Text><Text style={styles.topActionTitle}>TasteMatch</Text></View>
            <Sparkles size={12} color="#FFE66D" style={styles.topActionSparkle} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <StoryBar
        myAvatar={myAvatar}
        myStories={stories.myStories}
        friends={stories.friends}
        navigation={navigation}
        onChanged={refreshStories}
      />

      <LeaderboardCard data={leaderboard} />

      <TouchableOpacity style={styles.dailyCard} onPress={() => openComposer("thought", dailyQuestion)} activeOpacity={0.86}>
        <View style={styles.dailyIcon}><Flame size={18} color="#F97316" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dailyEyebrow}>GÜNÜN SORUSU</Text>
          <Text style={styles.dailyQuestion}>{dailyQuestion}</Text>
          <Text style={styles.dailyCta}>Yazı veya film/diziyle cevapla →</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.feedTitleRow}>
        <View>
          <Text style={styles.feedEyebrow}>SOSYAL AKIŞ</Text>
          <Text style={styles.feedTitle}>Arkadaşların ne konuşuyor?</Text>
        </View>
        <Heart size={18} color={c.accent2} />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <TopBar
        centerLabel="Aktivite"
        leftAction={{
          icon: <Plus size={20} color={c.text} />,
          onPress: () => openComposer("thought"),
          accessibilityLabel: "Paylaşım oluştur",
        }}
      />
      {loading && feed.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={styles.loadingText}>Akışın hazırlanıyor...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feed}
          keyExtractor={(item) => item.feedKey || String(item.id)}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} colors={[c.accent]} />}
          ListHeaderComponent={header}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) =>
            item.kind === "nudge" ? (
              <NudgeCard
                item={item}
                navigation={navigation}
                onOpenPicker={setBlendPickerNudge}
                onDismiss={() => dismissNudge(item.id)}
              />
            ) : item.kind === "activity-group" ? (
              <SocialActivityGroup items={item.items} navigation={navigation} />
            ) : (
              <SocialFeedCard item={item} navigation={navigation} onChanged={handleFeedChanged} />
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Akışın henüz sakin</Text>
              <Text style={styles.emptyText}>Arkadaşların paylaşım yaptıkça, içerik beğendikçe ve listeler oluşturdukça burada göreceksin. İlk Taste Post’u sen başlatabilirsin.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => openComposer("thought")}>
                <Text style={styles.emptyBtnText}>İlk paylaşımı yap</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <SocialPostComposer
        visible={composerOpen}
        presentation="island"
        initialType={composerType}
        initialContext={composerContext}
        onClose={() => { setComposerOpen(false); setComposerContext(null); }}
        onCreated={() => load(true)}
      />

      {blendPickerNudge && (
        <BlendFriendPickerSheet
          movie={blendPickerNudge.movie}
          highlightFriends={blendPickerNudge.friends}
          navigation={navigation}
          onClose={() => setBlendPickerNudge(null)}
        />
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { color: c.dim, fontSize: 12, marginTop: 9 },
    content: { paddingHorizontal: 14, paddingBottom: 28 },
    popularSection: { marginTop: 14, marginBottom: 14 },
    sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
    feedEyebrow: { color: c.accent, fontWeight: "900", fontSize: 9.5, letterSpacing: 0.8 },
    sectionTitle: { color: c.text, fontWeight: "900", fontSize: 17, marginTop: 2 },
    sectionCount: { color: c.dim, fontSize: 10.5 },
    popularRow: { gap: 9, paddingRight: 10 },
    popularItem: { width: 92 },
    popularPoster: { width: 92, height: 136, borderRadius: 12, backgroundColor: c.surface2 },
    popularTitle: { color: c.text, fontSize: 10.5, fontWeight: "700", marginTop: 5 },
    popularSkeleton: { height: 140, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    topActions: { flexDirection: "row", gap: 9, marginBottom: 12 },
    topActionTouch: { flex: 1, borderRadius: 16, shadowColor: "#8B5CF6", shadowOpacity: 0.2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    topActionCard: { height: 68, borderRadius: 16, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 9, overflow: "hidden" },
    topActionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", alignItems: "center", justifyContent: "center" },
    topActionEyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.9 },
    topActionTitle: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 2 },
    topActionSparkle: { position: "absolute", top: 8, right: 9 },
    dailyCard: { flexDirection: "row", gap: 11, alignItems: "flex-start", backgroundColor: c.surface, borderWidth: 1, borderColor: "#F97316", borderRadius: 18, padding: 13, marginBottom: 12 },
    dailyIcon: { width: 38, height: 38, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    dailyEyebrow: { color: "#F97316", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.7 },
    dailyQuestion: { color: c.text, fontSize: 13, fontWeight: "850", lineHeight: 18, marginTop: 3 },
    dailyCta: { color: c.accent, fontSize: 10.5, fontWeight: "800", marginTop: 7 },
    feedTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 10 },
    feedTitle: { color: c.text, fontWeight: "900", fontSize: 17, marginTop: 2 },
    emptyCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 20, alignItems: "center", marginBottom: 20 },
    emptyTitle: { color: c.text, fontWeight: "900", fontSize: 15 },
    emptyText: { color: c.dim, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 6 },
    emptyBtn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
    emptyBtnText: { color: c.bg, fontWeight: "900", fontSize: 11.5 },
  });
}
