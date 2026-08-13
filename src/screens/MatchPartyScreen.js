import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Animated, PanResponder, Dimensions, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Heart, X, Star, Sparkles, BookmarkPlus, Check, Trophy } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { emitLocalEvent } from "../utils/localEvents";
import RetryImage from "../components/RetryImage";
import { recommendationReason } from "../utils/recommend";
import { GENRE_FILTERS } from "../theme/theme";
import { YEAR_OPTIONS } from "../utils/filterYears";
import ChipRow from "../components/ChipRow";
import FilterFields from "../components/FilterFields";
import { useCommonPlatforms } from "../hooks/useCommonPlatforms";
import SwipeableCard from "../components/SwipeableCard";
import ShareCardModal from "../components/ShareCardModal";
import MatchShareCard from "../components/MatchShareCard";
import MatchCelebration from "../components/MatchCelebration";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = 110;
const MIN_IMDB_OPTIONS = [6.0, 6.5, 7.0, 7.5, 8.0];
const STOCK_TARGET = 10; // Discover'daki gibi: kuyrukta her zaman en az bu kadar film kalsın

// MP2 — bekleme ekranındaki canlı animasyon: iki avatar birbirine hafifçe yaklaşıp uzaklaşarak
// "bağlantı kurulmaya çalışılıyor" hissi veriyor, düz bir spinnerden daha canlı.
function WaitingAvatars({ myAvatar, myId, friendAvatar, friendId, c }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const gap = pulse.interpolate({ inputRange: [0, 1], outputRange: [10, -4] });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
      <Animated.View style={{ transform: [{ translateX: gap }] }}>
        <RetryImage source={{ uri: avatarOr(myAvatar, myId) }} style={waitingStyles.avatar} />
      </Animated.View>
      <Animated.View style={[waitingStyles.dot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
      <Animated.View style={{ transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [-10, 4] }) }] }}>
        <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={waitingStyles.avatar} />
      </Animated.View>
    </View>
  );
}
const waitingStyles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "#c9a44c", marginHorizontal: 10 },
});

export default function MatchPartyScreen({ route, navigation }) {
  const { friend, sessionId: initialSessionId } = route.params || {};
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const styles = makeStyles(c);
  const commonPlatforms = useCommonPlatforms();

  const [stage, setStage] = useState(initialSessionId ? "loading" : "setup");
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  // Paylaşım kartında güncel profil fotoğrafımın görünmesi için — aynı düzeltme BlendScreen'de de yapıldı.
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);
  useEffect(() => {
    api.me(auth.token).then((me) => setMyAvatarUrl(me.avatarUrl || null)).catch(() => {});
  }, [auth.token]);
  const [typePref, setTypePref] = useState("Hepsi");
  const [genrePref, setGenrePref] = useState(null);
  const [minImdb, setMinImdb] = useState(6.5);
  const [yearLabels, setYearLabels] = useState(new Set());
  const [platformPrefs, setPlatformPrefs] = useState(new Set());

  const [queue, setQueue] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [matches, setMatches] = useState([]);
  const [showShareCard, setShowShareCard] = useState(false);
  // Oturumdaki HER eşleşmede (ilk ya da sonraki fark etmeksizin) tam ekran, kaydırmayı durduran
  // bir kutlama gösteriyoruz — MatchCelebration, kullanıcı "Devam Et"/"Oturumu Bitir" demeden kapanmaz.
  const [celebration, setCelebration] = useState(null); // { movie } | null
  const [members, setMembers] = useState(friend ? [{ id: friend.id, name: friend.name, avatarUrl: friend.avatarUrl, progress: 0 }] : []);
  const [declinedBy, setDeclinedBy] = useState(null);
  const extendingRef = useRef(false); // aynı anda birden fazla extend isteği gitmesin
  const [likedMovies, setLikedMovies] = useState([]);
  // Devam eden bir oturumdan (aktif kaydırma ya da davet bekleniyorken) uygulama içinde başka bir
  // yere geçmeye çalışınca (header geri tuşu, Android donanım geri tuşu, sekme değişimi) oturum
  // sessizce arkada kalıp bir daha bulunamıyordu — artık "beforeRemove" ile bu geçişi yakalayıp
  // kullanıcıya sorduk: ya oturumu bitirip çıksın ya da MatchParty'e devam etsin.
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [endingToLeave, setEndingToLeave] = useState(false);
  const pendingLeaveAction = useRef(null);
  const [creatingWatchlist, setCreatingWatchlist] = useState(false);
  const [watchlistCreated, setWatchlistCreated] = useState(false);

  useEffect(() => {
    api.userProfile(auth.token, auth.id).then((data) => setLikedMovies(data.likedMovies || [])).catch(() => {});
  }, []);
  const likedIds = new Set(likedMovies.map((m) => m.id));
  const likedMoviesById = new Map(likedMovies.map((m) => [m.id, m]));

  function toggleYear(label) {
    setYearLabels((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  }
  function togglePlatform(name) {
    setPlatformPrefs((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function shuffleGenre() {
    setGenrePref(GENRE_FILTERS[Math.floor(Math.random() * GENRE_FILTERS.length)]);
  }

  const cardRef = useRef(null);

  async function loadSession(id) {
    try {
      const data = await api.getParty(auth.token, id);
      setQueue(data.movies || []);
      if (data.members) setMembers(data.members.filter((m) => m.id !== auth.id));
      setCursor(data.myProgress || 0);
      // ÖNEMLİ DÜZELTME: eskiden oturum ne durumda olursa olsun doğrudan "active" yapılıyordu.
      // Bu, grup daveti oluşturduktan hemen sonra (henüz kimse kabul etmemişken) bu ekrana
      // gelindiğinde yanlışlıkla "aktif" gösteriyordu. Artık gerçek durumu yansıtıyor.
      if (data.status === "waiting") setStage("waiting");
      else if (data.status === "ended") {
        const matchesData = await api.partyMatches(auth.token, id).catch(() => ({ results: [] }));
        setMatches(matchesData.results || []);
        setStage("summary");
      } else {
        setStage("active");
      }
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
        setMatches((m) => {
          if (m.some((x) => x.id === msg.movie.id)) return m;
          const next = [...m, msg.movie];
          // MP5 — aynı oturumda art arda eşleşmelerde kutlama hep birebir aynı olmasın diye
          // kaçıncı eşleşme olduğunu da taşıyoruz (bkz. MatchCelebration'daki milestone mantığı).
          setCelebration({ movie: msg.movie, matchNumber: next.length });
          return next;
        });
      } else if (msg.type === "party_partner_swiped") {
        // Canlı ilerleme güncellemesi — "arkadaşın kaçıncı içerikte" bilgisini anlık gösterebilmek için.
        setMembers((prev) => prev.map((mem) => (mem.id === msg.user_id ? { ...mem, progress: msg.progress } : mem)));
      } else if (msg.type === "party_session_ended") {
        // Oturumu SEN değil, diğer üye bitirdi — sen hâlâ kaydırıyor olsan bile ekranın anında
        // final özet ekranına geçiyor, backend'in gönderdiği kesin eşleşme listesiyle.
        setMatches(msg.matches || []);
        setStage("summary");
      }
    });
    return unsub;
  }, [subscribe, sessionId, stage]);

  // Oturum aktifken ya da (henüz kabul edilmemiş) davet bekleniyorken ekrandan çıkılmaya
  // çalışılırsa (geri tuşu, kaydırma jesti, Android donanım geri tuşu — hepsi "beforeRemove"
  // olarak gelir) geçişi durdurup kullanıcıya soruyoruz. Kurulum (setup) ya da zaten bitmiş
  // (özet/reddedildi) ekranlardan çıkış serbest.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (stage !== "active" && stage !== "waiting") return;
      e.preventDefault();
      pendingLeaveAction.current = e.data.action;
      setLeaveConfirm(true);
    });
    return unsub;
  }, [navigation, stage]);

  function cancelLeave() {
    pendingLeaveAction.current = null;
    setLeaveConfirm(false);
  }

  async function confirmEndAndLeave() {
    setEndingToLeave(true);
    try { await api.endParty(auth.token, sessionId); } catch { /* sessizce geç */ }
    setEndingToLeave(false);
    setLeaveConfirm(false);
    const action = pendingLeaveAction.current;
    pendingLeaveAction.current = null;
    if (action) navigation.dispatch(action);
  }

  async function startInvite() {
    if (!friend) return;
    try {
      const years = YEAR_OPTIONS.filter(([label]) => yearLabels.has(label)).map(([, key]) => key);
      const data = await api.createParty(auth.token, {
        to_user_ids: [friend.id],
        filters: { type: typePref, genre: genrePref || "Hepsi", minImdb, years, platforms: [...platformPrefs] },
      });
      setSessionId(data.id);
      setStage("waiting");
    } catch { /* sessizce geç */ }
  }

  function advance() { setCursor((i) => i + 1); }

  async function maybeExtendQueue(nextCursor) {
    // Discover'daki gibi: kalan film sayısı STOCK_TARGET'ın altına düşünce arkadan yeni film ekle,
    // kullanıcı hiç "kuyruk bitti" ekranına düşmesin.
    if (extendingRef.current) return;
    if (queue.length - nextCursor >= STOCK_TARGET) return;
    extendingRef.current = true;
    try {
      const data = await api.extendParty(auth.token, sessionId);
      if (data.added?.length > 0) setQueue((prev) => [...prev, ...data.added]);
    } catch { /* sessizce geç, bir sonraki kaydırmada tekrar denenir */ }
    extendingRef.current = false;
  }

  async function decide(userLiked) {
    const movie = queue[cursor];
    if (!movie) return;
    advance();
    maybeExtendQueue(cursor + 1);
    try {
      // ÖNEMLİ: Backend, eşleşme olduğunda "party_match" WS olayını TÜM üyelere (kaydıran dahil)
      // gönderiyor — bu yüzden burada, API yanıtındaki "data.match" bilgisine göre AYRICA bir
      // kutlama tetiklemiyoruz, aksi halde kaydıran kişi için eşleşme iki kez (hem anlık API
      // yanıtından hem WS yankısından) tetiklenirdi. WS handler'ı (yukarıda) tek, güvenilir kaynak.
      await api.swipeParty(auth.token, sessionId, movie.id, userLiked);
    } catch { /* sessizce geç */ }
  }

  function handleSwipe(direction) { decide(direction === "right"); }

  async function endSession() {
    try { await api.endParty(auth.token, sessionId); } catch {}
    setStage("summary");
  }

  // Özet ekranındaki "Listeye Kaydet" butonu — tek dokunuşla, tüm ortak eşleşmeleri içeren
  // yeni bir izleme listesi oluşturuyor, ayrıca liste adı sormuyoruz (NewListModal'daki gibi) çünkü
  // buradaki amaç hız: "otomatik" bir liste.
  async function createWatchlistFromMatches() {
    if (matches.length === 0 || creatingWatchlist || watchlistCreated) return;
    setCreatingWatchlist(true);
    try {
      const listName = `${displayName} ile MatchParty`;
      const list = await api.createWatchlist(auth.token, listName);
      await Promise.all(matches.map((m) => api.addToWatchlist(auth.token, list.id, m.id).catch(() => {})));
      setWatchlistCreated(true);
      emitLocalEvent({ type: "toast", title: "✅ Liste oluşturuldu", message: `"${listName}" listesine ${matches.length} içerik eklendi` });
    } catch {
      emitLocalEvent({ type: "toast", title: "Bir şeyler ters gitti", message: "Liste oluşturulamadı, tekrar dene" });
    }
    setCreatingWatchlist(false);
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
          {/* GroupPartyScreen'in grup daveti İLE AYNI paylaşılan filtre bileşeni (bkz.
              FilterFields.js) — burada da modal olmadan doğrudan sayfanın akışına gömülü. */}
          <FilterFields
            typeValue={typePref}
            onTypeChange={setTypePref}
            genreValue={genrePref}
            onGenreChange={setGenrePref}
            yearSet={yearLabels}
            onToggleYear={toggleYear}
            platformSet={platformPrefs}
            onTogglePlatform={togglePlatform}
            platforms={commonPlatforms}
            onShuffleGenre={shuffleGenre}
          />
          <Text style={styles.label}>MİNİMUM IMDB PUANI: {minImdb.toFixed(1)}</Text>
          <ChipRow items={MIN_IMDB_OPTIONS.map(String)} active={String(minImdb)} onSelect={(v) => setMinImdb(parseFloat(v))} />
          <TouchableOpacity style={styles.primaryBtn} onPress={startInvite}>
            <Text style={styles.primaryBtnText}>{displayName}'e Davet Gönder</Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>Davet gerçek zamanlı iletilir, karşı taraf bildirimler alanında görüp kabul/reddedebilir.</Text>
        </ScrollView>
      )}

      {stage === "waiting" && (
        // MP2 — düz bir spinner yerine, birbirine yaklaşıp uzaklaşan iki avatarla "bekleniyor"
        // hissini biraz daha canlı anlatıyoruz.
        <View style={styles.center}>
          <WaitingAvatars myAvatar={myAvatarUrl} myId={auth.id} friendAvatar={friend?.avatarUrl} friendId={friend?.id} c={c} />
          <Text style={styles.waitTitle}>Davet gönderildi</Text>
          <Text style={styles.waitSubtitle}>{displayName} kabul etmesi bekleniyor… Kabul edince otomatik başlayacak.</Text>
        </View>
      )}

      {stage === "declined" && (
        // MP3 — eskiden bir X ikonu + tek satırla bitiyordu; artık daha yumuşak bir ton +
        // doğrudan başka bir arkadaşla tekrar denemeyi öneren bir CTA var.
        <View style={styles.center}>
          <RetryImage source={{ uri: avatarOr(friend?.avatarUrl, friend?.id) }} style={styles.declinedAvatar} />
          <Text style={styles.waitTitle}>{declinedBy} şu an uygun değil</Text>
          <Text style={styles.waitSubtitle}>Belki başka zaman — istersen başka bir arkadaşınla dene.</Text>
          <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => navigation.replace("GroupParty")}>
            <Text style={styles.primaryBtnSmallText}>Başka Arkadaşınla Dene</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === "active" && (
        <View style={{ flex: 1, padding: 16 }}>
          {/* ÖNEMLİ (canlı, karşılaştırmalı ilerleme göstergesi): Eskiden sadece ham bir sayı
              gösteriliyordu ve bu sayı CANLI güncellenmiyordu (sadece oturuma girişte bir kez
              çekiliyordu) — "arkadaşım kaçıncı içerikte" sorusuna gerçek bir cevap vermiyordu.
              Artık backend'in zaten gönderdiği ama hiç dinlenmeyen "party_partner_swiped" olayını
              kullanarak canlı güncelliyoruz, ve ham sayı yerine BENİM ile HERKESİN ilerlemesini
              aynı ölçekte gösteren bir çubuk çiziyoruz — kim önde/geride net görünüyor.
              Ölçek (maxProgress), o an en önde olanın ilerlemesi — sabit/tahmini bir "toplam"
              olmadığı için en anlamlı kıyaslama bu.
          */}
          {(() => {
            // MP4 — çift ilerleme çubuğu artık açıkça bir "yarış": kim önde küçük bir kupa
            // ikonuyla işaretleniyor (sadece gerçek bir öndelik varken, 0-0 beraberlikte değil).
            const allProgress = [cursor, ...members.map((m) => m.progress || 0)];
            const maxProgress = Math.max(...allProgress, 1);
            const leadValue = Math.max(...allProgress);
            const isTie = allProgress.filter((v) => v === leadValue).length > 1;
            const iAmLeading = !isTie && leadValue > 0 && cursor === leadValue;
            return (
              <View style={styles.progressBlock}>
                <View style={styles.progressBarRow}>
                  {iAmLeading && <Trophy size={11} color="#FFD700" />}
                  <Text style={styles.progressLabel} numberOfLines={1}>Sen</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, (cursor / maxProgress) * 100)}%`, backgroundColor: c.accent }]} />
                  </View>
                  <Text style={styles.progressCount}>{cursor}</Text>
                </View>
                {members.map((m) => {
                  const memberLeading = !isTie && leadValue > 0 && (m.progress || 0) === leadValue;
                  return (
                    <View key={m.id} style={styles.progressBarRow}>
                      {memberLeading && <Trophy size={11} color="#FFD700" />}
                      <RetryImage source={{ uri: avatarOr(m.avatarUrl, m.id) }} style={styles.progressAvatar} />
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, ((m.progress || 0) / maxProgress) * 100)}%`, backgroundColor: c.accent2 }]} />
                      </View>
                      <Text style={styles.progressCount}>{m.progress || 0}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}
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
                {(() => {
                  const reason = recommendationReason(current, likedIds, likedMoviesById);
                  return reason ? (
                    <View style={styles.reasonBadge} pointerEvents="none">
                      <Sparkles size={9} color={c.accent2} />
                      <Text style={styles.reasonText} numberOfLines={1}>{reason}</Text>
                    </View>
                  ) : null;
                })()}
                <View style={styles.cardInfo} pointerEvents="none">
                  <Text style={styles.cardTitle} numberOfLines={1}>{current.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Star size={11} color={c.accent} fill={c.accent} />
                    <Text style={styles.cardMeta}>{current.imdb} · {current.year} · {current.genre}</Text>
                  </View>
                </View>
              </SwipeableCard>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionCircle, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}
              onPress={() => cardRef.current?.swipeLeft()}
              disabled={!current || !!celebration}
            >
              <X size={22} color={c.danger} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionCircle, { backgroundColor: c.accent2 }]}
              onPress={() => cardRef.current?.swipeRight()}
              disabled={!current || !!celebration}
            >
              <Heart size={22} color="#fff" fill="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.endBtn, { marginBottom: insets.bottom }]} onPress={endSession}>
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
            <>
              {/* MP6 — en güzel görsel (paylaşım kartı) artık bir buton arkasında saklı değil,
                  doğrudan burada, küçültülmüş bir önizleme olarak görünüyor. Buton artık sadece
                  gerçek dışa aktarma/paylaşma eylemini tetikliyor. */}
              <View style={styles.sharePreviewWrap} pointerEvents="none">
                <View style={styles.sharePreviewScale}>
                  <MatchShareCard
                    myAvatar={myAvatarUrl}
                    myId={auth.id}
                    myName={auth.name}
                    friendAvatar={members[0]?.avatarUrl || friend?.avatarUrl}
                    friendId={members[0]?.id || friend?.id}
                    friendName={displayName}
                    matchCount={matches.length}
                    topMovie={matches[0]}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.shareResultBtn} onPress={() => setShowShareCard(true)}>
                <Sparkles size={13} color="#fff" />
                <Text style={styles.shareResultBtnText}>Eşleşmeyi Paylaş</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.watchlistBtn, watchlistCreated && { opacity: 0.6 }]}
                onPress={createWatchlistFromMatches}
                disabled={creatingWatchlist || watchlistCreated}
              >
                {creatingWatchlist ? (
                  <ActivityIndicator size="small" color={c.text} />
                ) : watchlistCreated ? (
                  <>
                    <Check size={13} color={c.text} />
                    <Text style={styles.watchlistBtnText}>Listeye Eklendi</Text>
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={13} color={c.text} />
                    <Text style={styles.watchlistBtnText}>Listeye Kaydet</Text>
                  </>
                )}
              </TouchableOpacity>
              {matches.map((m) => (
                <TouchableOpacity key={m.id} style={styles.matchRow} onPress={() => navigation.navigate("Detail", { movie: m })}>
                  {m.poster ? <Image source={{ uri: m.poster }} style={styles.matchPoster} /> : <View style={[styles.matchPoster, { backgroundColor: c.surface2 }]} />}
                  <View>
                    <Text style={styles.matchTitle}>{m.title}</Text>
                    <Text style={styles.matchMeta}>{m.year} · ⭐ {m.imdb}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Kapat</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {showShareCard && matches.length > 0 && (
        <ShareCardModal onClose={() => setShowShareCard(false)}>
          <MatchShareCard
            myAvatar={myAvatarUrl}
            myId={auth.id}
            myName={auth.name}
            friendAvatar={members[0]?.avatarUrl || friend?.avatarUrl}
            friendId={members[0]?.id || friend?.id}
            friendName={displayName}
            matchCount={matches.length}
            topMovie={matches[0]}
          />
        </ShareCardModal>
      )}

      {/* Her eşleşmede, tüm ekranı kaplayan, kaydırmayı durduran tam kutlama — en üst seviyede
          (header dahil her şeyin üstünde) render ediliyor, kullanıcı bir seçim yapana kadar kapanmaz. */}
      {celebration && (
        <MatchCelebration
          movie={celebration.movie}
          matchNumber={celebration.matchNumber}
          myAvatar={myAvatarUrl}
          myId={auth.id}
          partnerAvatar={members[0]?.avatarUrl || friend?.avatarUrl}
          partnerId={members[0]?.id || friend?.id}
          partnerName={displayName}
          onContinue={() => setCelebration(null)}
          onEndSession={() => { setCelebration(null); endSession(); }}
        />
      )}

      {/* Oturum aktifken/davet beklenirken ekrandan çıkılmaya çalışılınca (bkz. "beforeRemove"
          dinleyicisi) — kullanıcı ya oturumu bitirip çıkar ya da MatchParty'e devam eder,
          hiçbir seçim yapmadan bu popup kapanmaz. */}
      {leaveConfirm && (
        <View style={styles.leaveOverlay}>
          <View style={styles.leaveCard}>
            <Text style={styles.leaveTitle}>MatchParty'den çıkmak üzeresin</Text>
            <Text style={styles.leaveSubtitle}>Şimdi çıkarsan bu oturuma geri dönemezsin. Devam mı etmek istersin, yoksa oturumu bitirip mi çıkmak istersin?</Text>
            <View style={styles.leaveBtnRow}>
              <TouchableOpacity style={styles.leaveStayBtn} onPress={cancelLeave} disabled={endingToLeave}>
                <Text style={styles.leaveStayBtnText}>MatchParty'e Devam Et</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.leaveEndBtn} onPress={confirmEndAndLeave} disabled={endingToLeave}>
                {endingToLeave ? <ActivityIndicator size="small" color={c.dim} /> : <Text style={styles.leaveEndBtnText}>Oturumu Bitir ve Çık</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    declinedAvatar: { width: 72, height: 72, borderRadius: 999, opacity: 0.85 },
    primaryBtnSmall: { marginTop: 18, backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
    primaryBtnSmallText: { color: c.bg, fontWeight: "800", fontSize: 12.5 },
    progressBlock: { gap: 6, marginBottom: 10 },
    progressBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressLabel: { fontSize: 10.5, fontWeight: "700", color: c.dim, width: 34 },
    progressAvatar: { width: 18, height: 18, borderRadius: 999 },
    progressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: c.surface2, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 999 },
    progressCount: { fontSize: 10.5, fontWeight: "700", color: c.dim, width: 20, textAlign: "right" },
    matchesLabel: { fontSize: 11, color: c.dim, textAlign: "center", marginBottom: 10 },
    card: { flex: 1, borderRadius: 22, overflow: "hidden", backgroundColor: c.surface2 },
    cardInfo: { position: "absolute", left: 16, right: 16, bottom: 14 },
    reasonBadge: {
      position: "absolute", top: 12, right: 12, maxWidth: "60%",
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    },
    reasonText: { fontSize: 9, fontWeight: "700", color: "#fff" },
    cardTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
    cardMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
    actionsRow: { flexDirection: "row", justifyContent: "center", gap: 26, marginTop: 16 },
    actionCircle: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    endBtn: { marginTop: 14, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
    endBtnText: { color: c.dim, fontWeight: "700", fontSize: 12 },
    summaryTitle: { fontSize: 20, fontWeight: "700", color: c.text, textAlign: "center" },
    summarySubtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 4, marginBottom: 16 },
    sharePreviewWrap: { alignItems: "center", marginBottom: 12 },
    // Kart 320×550 sabit boyutta tasarlanmış (dışa aktarılan görsel) — burada sadece küçültülmüş
    // bir önizleme olarak gösteriliyor; transform:scale layout boyutunu değiştirmediği için
    // negatif dikey margin ile fazladan boşluğu topluyoruz.
    sharePreviewScale: { transform: [{ scale: 0.72 }], marginVertical: -77 },
    shareResultBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: "#DB2777", borderRadius: 14, paddingVertical: 13, marginBottom: 16,
    },
    shareResultBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    watchlistBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 13, marginBottom: 16,
    },
    watchlistBtnText: { color: c.text, fontWeight: "800", fontSize: 13 },
    leaveOverlay: {
      ...StyleSheet.absoluteFillObject, zIndex: 60, backgroundColor: "rgba(10,9,14,0.85)",
      alignItems: "center", justifyContent: "center", padding: 24,
    },
    leaveCard: { width: "100%", maxWidth: 340, backgroundColor: c.surface, borderRadius: 18, padding: 20 },
    leaveTitle: { fontSize: 15, fontWeight: "800", color: c.text, textAlign: "center" },
    leaveSubtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 6, marginBottom: 18 },
    leaveBtnRow: { gap: 10 },
    leaveStayBtn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
    leaveStayBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
    leaveEndBtn: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
    leaveEndBtnText: { color: c.dim, fontWeight: "700", fontSize: 13 },
    matchRow: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 10 },
    matchPoster: { width: 46, height: 64, borderRadius: 8 },
    matchTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    matchMeta: { fontSize: 11, color: c.dim, marginTop: 2 },
  });
}
