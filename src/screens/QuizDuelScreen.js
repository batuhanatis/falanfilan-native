import { t as translateUI } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing, Alert, AppState, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swords, Users, Trophy, RotateCcw, Share2, AlertCircle, Check, X, Ticket, Clapperboard, Crown } from "lucide-react-native";
import { GoldWash, SALON } from "../components/salon/SalonKit";
import { FONTS } from "../theme/fonts";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import { duelApi, DUEL_LIVE_PHASES, DUEL_OPEN_PHASES } from "../api/duels";
import ScreenHeader from "../components/ScreenHeader";
import RetryImage from "../components/RetryImage";
import ShareCardModal from "../components/ShareCardModal";
import DuelShareCard, { DUEL_CARD_HEIGHT } from "../components/DuelShareCard";
import { avatarOr } from "../utils/avatar";
import { getStoreLink } from "../utils/appLinks";
import { hapticLight, hapticSuccess, hapticWarning, hapticSelection } from "../utils/haptics";

// Dizi Düellosu: iki arkadaş aynı anda, aynı soruları cevaplıyor. Süreleri ve puanı sunucu
// tutuyor (quiz-duels.js); bu ekran gelen "duel_state" anlık görüntüsünü çiziyor, varlığını
// "duel_ping" ile bildiriyor. Oyun sırasında ekrandan çıkan ya da bağlantısı kopan kaybediyor.
const PING_MS = 2500;
const LEVEL_LABEL = { 1: "KOLAY", 2: "ORTA", 3: "ZOR" };
const LETTERS = ["A", "B", "C", "D"];
const PHASE_TOTAL = { invited: 60000, joining: 20000, picking: 10000, ready: 30000, question: 15000, reveal: 3000 };

export default function QuizDuelScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const ws = useWS();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.bottom]);
  const me = auth?.id;

  const [duel, setDuel] = useState(null);
  const [loading, setLoading] = useState(!!route?.params?.duelId);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState("");
  const [myChoices, setMyChoices] = useState({});
  const [reveals, setReveals] = useState({});
  const [shareOpen, setShareOpen] = useState(false);
  const offsetRef = useRef(0);
  const duelRef = useRef(null);
  const leftRef = useRef(false);

  const applyState = useCallback((d) => {
    if (!d) return;
    if (typeof d.serverNow === "number") offsetRef.current = d.serverNow - Date.now();
    setDuel((prev) => {
      if (prev && prev.id !== d.id) { setMyChoices({}); setReveals({}); }
      return d;
    });
    if (d.phase === "reveal" && d.reveal && d.question) {
      setReveals((prev) => ({ ...prev, [d.question.index]: d.reveal }));
    }
  }, []);
  useEffect(() => { duelRef.current = duel; }, [duel]);

  const hello = useCallback((id) => { if (id) ws?.send({ type: "duel_hello", duelId: id }); }, [ws]);

  // Bildirimden, davet kartından ya da rövanştan gelen düello numarası.
  const paramId = route?.params?.duelId;
  useEffect(() => {
    if (!paramId || !auth?.token) return;
    let alive = true;
    leftRef.current = false;
    setLoading(true); setGone(false); setError("");
    duelApi.get(auth.token, paramId)
      .then((data) => { if (alive) { applyState(data.duel); hello(data.duel?.id); } })
      .catch(() => { if (alive) setGone(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [paramId, auth?.token]);

  // Canlı akış.
  useEffect(() => {
    if (!ws?.subscribe) return;
    return ws.subscribe((msg) => {
      const cur = duelRef.current;
      if (msg.type === "duel_state" && msg.duel && (!cur || msg.duel.id === cur.id)) applyState(msg.duel);
      else if (msg.type === "duel_gone" && cur && msg.duelId === cur.id && DUEL_OPEN_PHASES.includes(cur.phase)) setGone(true);
      else if (msg.type === "ws_ready" && cur && DUEL_OPEN_PHASES.includes(cur.phase)) hello(cur.id);
    });
  }, [ws, applyState, hello]);

  // Varlık bildirimi: oyun sürdükçe birkaç saniyede bir.
  const open = !!duel && DUEL_OPEN_PHASES.includes(duel.phase);
  useEffect(() => {
    if (!open) return;
    const id = duel.id;
    const t = setInterval(() => ws?.send({ type: "duel_ping", duelId: id }), PING_MS);
    return () => clearInterval(t);
  }, [open, duel?.id, ws]);

  // Uygulama arka plana geçince düellodan çıkılmış sayılıyor (davet bekleyen davet eden hariç).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const cur = duelRef.current;
      if (!cur || !DUEL_OPEN_PHASES.includes(cur.phase)) return;
      if (state === "background" && cur.phase !== "invited") ws?.send({ type: "duel_leave", duelId: cur.id });
      if (state === "active") hello(cur.id);
    });
    return () => sub.remove();
  }, [ws, hello]);

  // Geri: oyun sırasındaysa onay iste; başlamadan önceyse düelloyu sessizce kapat.
  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      const cur = duelRef.current;
      if (!cur || leftRef.current) return;
      if (DUEL_LIVE_PHASES.includes(cur.phase)) {
        e.preventDefault();
        Alert.alert(translateUI("Düellodan çıkılsın mı?"), translateUI("Şimdi çıkarsan düello rakibine yazılır."), [
          { text: translateUI("Devam et"), style: "cancel" },
          { text: translateUI("Çık"), style: "destructive", onPress: () => { leftRef.current = true; ws?.send({ type: "duel_leave", duelId: cur.id }); navigation.dispatch(e.data.action); } },
        ]);
        return;
      }
      if (DUEL_OPEN_PHASES.includes(cur.phase) && !(cur.phase === "invited" && cur.inviteeId === me)) {
        leftRef.current = true;
        ws?.send({ type: "duel_leave", duelId: cur.id });
      }
    });
  }, [navigation, ws, me]);

  async function startWith(friend) {
    setError("");
    try {
      const data = await duelApi.invite(auth.token, friend.id);
      hapticSuccess();
      leftRef.current = false;
      applyState(data.duel);
      hello(data.duel.id);
    } catch (e) {
      hapticWarning();
      if (e.code === "DUEL_LIMIT") setError("limit");
      else setError(e.message);
    }
  }

  async function acceptIncoming() {
    try {
      const data = await duelApi.accept(auth.token, duel.id);
      hapticSuccess();
      applyState(data.duel);
      hello(data.duel.id);
    } catch (e) {
      hapticWarning();
      if (e.code === "DUEL_LIMIT") setError("limit");
      else setGone(true);
    }
  }
  async function declineIncoming() {
    await duelApi.decline(auth.token, duel.id).catch(() => {});
    leftRef.current = true;
    navigation.goBack();
  }

  async function rematch() {
    setError("");
    try {
      const data = await duelApi.rematch(auth.token, duel.id);
      hapticSuccess();
      leftRef.current = false;
      setMyChoices({}); setReveals({});
      applyState(data.duel);
      hello(data.duel.id);
    } catch (e) {
      hapticWarning();
      if (e.code === "DUEL_LIMIT") setError("limit");
      else setError(e.message);
    }
  }

  function pick(titleId) {
    hapticSelection();
    ws?.send({ type: "duel_pick", duelId: duel.id, titleId });
  }
  function ready() {
    hapticLight();
    ws?.send({ type: "duel_ready", duelId: duel.id });
  }
  function backOut() {
    leftRef.current = true;
    ws?.send({ type: "duel_cancel", duelId: duel.id });
    navigation.goBack();
  }
  function answer(choice) {
    const idx = duel.question?.index;
    if (idx == null || myChoices[idx] != null) return;
    hapticLight();
    setMyChoices((prev) => ({ ...prev, [idx]: choice }));
    ws?.send({ type: "duel_answer", duelId: duel.id, index: idx, choice });
  }
  function backToLobby() {
    leftRef.current = true;
    setDuel(null); setMyChoices({}); setReveals({}); setGone(false); setError("");
    navigation.setParams({ duelId: undefined, invite: undefined });
  }

  const opp = duel?.players?.find((p) => p.id !== me);
  const mine = duel?.players?.find((p) => p.id === me);
  const header = <ScreenHeader title={translateUI("Dizi Düellosu")} subtitle={opp?.name ? translateUI("{0} ile", { 0: opp.name }) : translateUI("Canlı bilgi yarışması")} onBack={() => navigation.goBack()} />;

  if (loading) return <View style={[styles.root, styles.center]}><ActivityIndicator color={c.accent} /></View>;

  if (gone) {
    return (
      <View style={styles.root}>{header}
        <EndNote styles={styles} c={c} icon={Clapperboard} title={translateUI("Bu düello kapandı")} text={translateUI("Davetin süresi dolmuş ya da düello bitmiş olabilir.")} onPrimary={backToLobby} primary={translateUI("Yeni düello")} />
      </View>
    );
  }

  if (!duel) return <View style={styles.root}>{header}<Lobby styles={styles} c={c} token={auth.token} onStart={startWith} error={error} onPremium={() => navigation.navigate("Premium", { reason: "duel_limit" })} /></View>;

  const iAmInvitee = duel.inviteeId === me;
  let body;
  if (duel.phase === "invited" && iAmInvitee) {
    body = <IncomingInvite styles={styles} c={c} duel={duel} opp={opp} offsetRef={offsetRef} onAccept={acceptIncoming} onDecline={declineIncoming} limit={error === "limit"} onPremium={() => navigation.navigate("Premium", { reason: "duel_limit" })} />;
  } else if (duel.phase === "invited" || duel.phase === "joining") {
    body = <Waiting styles={styles} c={c} duel={duel} opp={opp} offsetRef={offsetRef} iAmInvitee={iAmInvitee} onCancel={backOut} />;
  } else if (duel.phase === "picking") {
    body = <Picking styles={styles} c={c} duel={duel} me={me} opp={opp} offsetRef={offsetRef} onPick={pick} />;
  } else if (duel.phase === "ready") {
    body = <Curtain styles={styles} c={c} duel={duel} me={me} opp={opp} offsetRef={offsetRef} onReady={ready} onBackOut={backOut} />;
  } else if (duel.phase === "question" || duel.phase === "reveal") {
    body = <Question styles={styles} c={c} duel={duel} me={me} mine={mine} opp={opp} offsetRef={offsetRef} myChoice={myChoices[duel.question?.index]} onAnswer={answer} />;
  } else if (duel.phase === "finished") {
    body = <Result styles={styles} c={c} duel={duel} me={me} mine={mine} opp={opp} reveals={reveals} onRematch={rematch} onShare={() => setShareOpen(true)} onLobby={backToLobby} limit={error === "limit"} onPremium={() => navigation.navigate("Premium", { reason: "duel_limit" })} />;
  } else {
    body = <EndNote styles={styles} c={c} icon={Clapperboard} title={translateUI("Düello başlamadan bitti")} text={cancelText(duel, me, opp)} onPrimary={backToLobby} primary={translateUI("Yeni düello")} />;
  }

  return (
    <View style={styles.root}>
      {header}
      {body}
      {shareOpen && duel.phase === "finished" && (
        <ShareCardModal
          onClose={() => setShareOpen(false)}
          shareMessage={translateUI("Pellix'te dizi düellosu yaptık: {0} - {1}. Sıra sende.", { 0: mine?.score ?? 0, 1: opp?.score ?? 0 })}
          shareUrl={getStoreLink("quiz_duel")}
          previewHeight={DUEL_CARD_HEIGHT}
          instagramStory={{ link: getStoreLink("quiz_duel") }}
        >
          <DuelShareCard duel={duel} me={me} />
        </ShareCardModal>
      )}
    </View>
  );
}

// ---------- süre ----------

function useRemaining(deadline, offsetRef) {
  const calc = () => (deadline ? Math.max(0, deadline - (Date.now() + offsetRef.current)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!deadline) return;
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

// Fitil: süre çubuğu yanan bir fitil gibi soldan sağa kısalıyor, ucunda bir kıvılcım; son
// üçte birde kırmızıya dönüyor. Süreyi sunucunun son tarihinden hesaplıyor.
function Fitil({ deadline, total, offsetRef, c }) {
  const anim = useRef(new Animated.Value(1)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const left = Math.max(0, deadline - (Date.now() + offsetRef.current));
    anim.setValue(Math.min(1, left / total));
    const a = Animated.timing(anim, { toValue: 0, duration: left, easing: Easing.linear, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [deadline, total]);
  const danger = anim.interpolate({ inputRange: [0, 0.3, 0.31, 1], outputRange: [1, 1, 0, 0] });
  const sparkX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, width - 10)] });
  return (
    <View style={{ height: 14, justifyContent: "center" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="progressbar">
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surface2, overflow: "hidden" }}>
        <Animated.View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", backgroundColor: c.accent, transformOrigin: "left", transform: [{ scaleX: anim }] }} />
        <Animated.View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", backgroundColor: c.danger, opacity: danger, transformOrigin: "left", transform: [{ scaleX: anim }] }} />
      </View>
      {width > 0 && (
        <Animated.View style={{ position: "absolute", left: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffe7a8", shadowColor: c.accent, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4, transform: [{ translateX: sparkX }] }} />
      )}
    </View>
  );
}

function Seconds({ deadline, offsetRef, styles }) {
  const left = useRemaining(deadline, offsetRef);
  return <Text style={styles.seconds}>{Math.ceil(left / 1000)}</Text>;
}

// ---------- lobi ----------

function Lobby({ styles, c, token, onStart, error, onPremium }) {
  const [meta, setMeta] = useState(null);
  const [friends, setFriends] = useState(null);
  const [busyId, setBusyId] = useState(null);
  useEffect(() => {
    duelApi.meta(token).then(setMeta).catch(() => setMeta({ titles: 0 }));
    api.friends(token).then((d) => setFriends(d.friends || [])).catch(() => setFriends([]));
  }, [token]);
  if (!meta || !friends) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;
  const ready = (meta.titles || 0) >= 3;
  const out = !meta.premium && meta.remaining === 0;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <GoldWash height={170} />
        <View style={styles.heroIcon}><Swords size={22} color={c.accent} /></View>
        <Text style={styles.eyebrow}>{translateUI("CANLI · ARKADAŞLARINLA")}</Text>
        <Text style={styles.heroTitle}>{translateUI("Kim daha iyi biliyor?")}</Text>
        <Text style={styles.heroSub}>{translateUI("İkiniz birer dizi seçiyorsunuz, aynı soruları aynı anda cevaplıyorsunuz. Doğru ve hızlı olan kazanır.")}</Text>
        <View style={styles.ruleRow}>
          <Rule styles={styles} value="2" label={translateUI("TUR")} />
          <Rule styles={styles} value="8" label={translateUI("SORU")} />
          <Rule styles={styles} value="15" label={translateUI("SANİYE")} />
        </View>
      </View>

      {!ready ? (
        <View style={styles.note}><Clapperboard size={18} color={c.accent} /><Text style={styles.noteText}>{translateUI("Soru bankası hazırlanıyor. İlk diziler eklendiğinde düello burada açılacak.")}</Text></View>
      ) : (out || error === "limit") ? (
        <TouchableOpacity style={styles.note} onPress={onPremium} activeOpacity={0.85}>
          <Crown size={18} color={c.accent} />
          <Text style={styles.noteText}>{translateUI("Bugünkü 3 düello hakkını kullandın. Premium ile sınırsız düello yapabilirsin.")}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.quota}>{meta.premium ? translateUI("PREMIUM · SINIRSIZ DÜELLO") : translateUI("BUGÜN {0} DÜELLO HAKKIN VAR", { 0: meta.remaining })}</Text>
      )}
      {!!error && error !== "limit" && <View style={styles.errorBox}><AlertCircle size={14} color={c.danger} /><Text style={styles.errorText}>{translateUI(error)}</Text></View>}

      <Text style={styles.sectionLabel}>{translateUI("RAKİBİNİ SEÇ")}</Text>
      {friends.length === 0 ? (
        <View style={styles.emptyCard}><Users size={20} color={c.dim} /><Text style={styles.emptyText}>{translateUI("Düello için önce bir arkadaş ekle.")}</Text></View>
      ) : friends.map((f) => (
        <View key={f.id} style={styles.friendRow}>
          <RetryImage source={{ uri: avatarOr(f.avatar_url || f.avatarUrl, f.id) }} style={styles.avatar} />
          <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{f.name}</Text>
          <TouchableOpacity
            style={[styles.callBtn, (!ready || out || !!busyId) && { opacity: 0.4 }]}
            disabled={!ready || out || !!busyId}
            onPress={async () => { setBusyId(f.id); await onStart(f); setBusyId(null); }}
            accessibilityLabel={translateUI("{0} ile düello", { 0: f.name })}
          >
            {busyId === f.id ? <ActivityIndicator size="small" color={SALON.onGold} /> : <Text style={styles.callText}>{translateUI("Çağır")}</Text>}
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function Rule({ styles, value, label }) {
  return <View style={styles.rule}><Text style={styles.ruleValue}>{value}</Text><Text style={styles.ruleLabel}>{label}</Text></View>;
}

// ---------- davet ----------

function IncomingInvite({ styles, c, duel, opp, offsetRef, onAccept, onDecline, limit, onPremium }) {
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.stage}>
      <Avatar player={opp} styles={styles} size={76} />
      <Text style={styles.stageTitle}>{translateUI("{0} seni düelloya çağırıyor", { 0: opp?.name || translateUI("Arkadaşın") })}</Text>
      <Text style={styles.stageText}>{translateUI("Kabul edersen birer dizi seçip aynı soruları aynı anda cevaplayacaksınız.")}</Text>
      <View style={styles.fitilWrap}><Fitil deadline={duel.deadline} total={PHASE_TOTAL.invited} offsetRef={offsetRef} c={c} /></View>
      {limit ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={onPremium}><Crown size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("Hakların bitti · Premium")}</Text></TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.primaryBtn} disabled={busy} onPress={async () => { setBusy(true); await onAccept(); setBusy(false); }}>
          {busy ? <ActivityIndicator color={SALON.onGold} /> : <><Swords size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("Kabul et")}</Text></>}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.secondaryBtn} onPress={onDecline}><Text style={styles.secondaryText}>{translateUI("Reddet")}</Text></TouchableOpacity>
    </View>
  );
}

function Waiting({ styles, c, duel, opp, offsetRef, iAmInvitee, onCancel }) {
  const joining = duel.phase === "joining";
  return (
    <View style={styles.stage}>
      <Avatar player={opp} styles={styles} size={76} />
      <Text style={styles.stageTitle}>
        {joining
          ? translateUI("Rakibin geliyor")
          : translateUI("{0} bekleniyor", { 0: opp?.name || translateUI("Arkadaşın") })}
      </Text>
      <Text style={styles.stageText}>
        {joining
          ? translateUI("İkiniz de ekrana gelince seçim başlıyor.")
          : translateUI("Davet 60 saniye açık. Kabul ederse önce o bir dizi seçecek.")}
      </Text>
      <View style={styles.fitilWrap}><Fitil deadline={duel.deadline} total={PHASE_TOTAL[duel.phase]} offsetRef={offsetRef} c={c} /></View>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}><Text style={styles.secondaryText}>{iAmInvitee ? translateUI("Vazgeç") : translateUI("Daveti geri çek")}</Text></TouchableOpacity>
    </View>
  );
}

// ---------- başlık seçimi: bilet koçanları ----------

function Picking({ styles, c, duel, me, opp, offsetRef, onPick }) {
  const myTurn = duel.turnUserId === me;
  const pickedBy = Object.fromEntries((duel.picks || []).map((p) => [p.titleId, p.userId]));
  const nameOf = (id) => (id === me ? translateUI("Sen") : opp?.name || translateUI("Rakibin"));
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.turnRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{translateUI("{0}. SEÇİM", { 0: (duel.picks?.length || 0) + 1 })}</Text>
          <Text style={styles.turnTitle}>{myTurn ? translateUI("Sıra sende, bir dizi seç") : translateUI("{0} seçiyor", { 0: opp?.name || translateUI("Rakibin") })}</Text>
        </View>
        <Seconds deadline={duel.deadline} offsetRef={offsetRef} styles={styles} />
      </View>
      <Fitil deadline={duel.deadline} total={PHASE_TOTAL.picking} offsetRef={offsetRef} c={c} />
      <Text style={styles.pickHint}>{translateUI("Her tur seçilen dizinin sorularından. Süre dolarsa rastgele seçilir.")}</Text>
      {(duel.candidates || []).map((t) => {
        const by = pickedBy[t.titleId];
        const disabled = !myTurn || !!by;
        return (
          <TouchableOpacity key={t.titleId} style={[styles.ticket, by && styles.ticketPicked, !myTurn && !by && { opacity: 0.7 }]} disabled={disabled} onPress={() => onPick(t.titleId)} activeOpacity={0.85} accessibilityLabel={t.title}>
            {t.poster ? <Image source={{ uri: t.poster }} style={styles.ticketPoster} /> : <View style={[styles.ticketPoster, styles.center]}><Ticket size={18} color={c.dim} /></View>}
            <View style={styles.ticketPerf} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.ticketTitle} numberOfLines={2}>{t.title}</Text>
              <Text style={[styles.ticketTag, !t.shared && { color: c.dim }]}>{t.shared ? translateUI("ORTAK BEĞENİ") : translateUI("Ortak beğeni değil")}</Text>
            </View>
            {!!by && <Stamp styles={styles} text={translateUI("{0} SEÇTİ", { 0: nameOf(by) })} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// Damga: seçilen bilete basılan mühür; basılırken büyükten oturuyor.
function Stamp({ styles, text }) {
  const s = useRef(new Animated.Value(1.6)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(s, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 220 }),
      Animated.timing(o, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[styles.stamp, { opacity: o, transform: [{ rotate: "-8deg" }, { scale: s }] }]}><Text style={styles.stampText} numberOfLines={1}>{text}</Text></Animated.View>;
}

// ---------- spoiler uyarısı: perde ----------

function Curtain({ styles, c, duel, me, opp, offsetRef, onReady, onBackOut }) {
  const iReady = (duel.ready || []).includes(me);
  const oppReady = opp && (duel.ready || []).includes(opp.id);
  const titles = (duel.picks || []).map((p) => duel.candidates?.find((x) => x.titleId === p.titleId)).filter(Boolean);
  const drop = useRef(new Animated.Value(-40)).current;
  useEffect(() => { Animated.spring(drop, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 160 }).start(); }, []);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.curtain, { transform: [{ translateY: drop }] }]}>
        <View style={styles.drapes}><View style={styles.drapeL} /><View style={styles.drapeR} /></View>
        <GoldWash height={150} />
        <Text style={[styles.eyebrow, { textAlign: "center" }]}>{translateUI("PERDE AÇILMADAN")}</Text>
        <Text style={[styles.heroTitle, { textAlign: "center" }]}>{translateUI("Spoiler uyarısı")}</Text>
        <Text style={[styles.heroSub, { textAlign: "center" }]}>{translateUI("Sorular bu iki dizinin tüm sezonlarından gelebilir, finaller dahil. Bitirmediğin bir yer varsa küçük sürprizlere hazır ol.")}</Text>
        <View style={styles.curtainTickets}>
          {titles.map((t, i) => (
            <View key={t.titleId} style={styles.miniTicket}>
              <Text style={styles.miniTicketRound}>{translateUI("{0}. TUR", { 0: i + 1 })}</Text>
              <Text style={styles.miniTicketTitle} numberOfLines={2}>{t.title}</Text>
            </View>
          ))}
        </View>
        <View style={styles.fitilWrap}><Fitil deadline={duel.deadline} total={PHASE_TOTAL.ready} offsetRef={offsetRef} c={c} /></View>
        <Text style={styles.readyLine}>{oppReady ? translateUI("{0} hazır", { 0: opp?.name || translateUI("Rakibin") }) : translateUI("{0} uyarıyı okuyor", { 0: opp?.name || translateUI("Rakibin") })}</Text>
        <TouchableOpacity style={[styles.primaryBtn, iReady && { opacity: 0.55 }]} disabled={iReady} onPress={onReady}>
          {iReady ? <><Check size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("Hazırsın")}</Text></> : <Text style={styles.primaryText}>{translateUI("Hazırım")}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBackOut}><Text style={styles.secondaryText}>{translateUI("Vazgeç")}</Text></TouchableOpacity>
        <Text style={styles.footNote}>{translateUI("Vazgeçersen puan yazılmaz.")}</Text>
      </Animated.View>
    </ScrollView>
  );
}

// ---------- soru ----------

function Question({ styles, c, duel, me, mine, opp, offsetRef, myChoice, onAnswer }) {
  const q = duel.question;
  const reveal = duel.phase === "reveal" ? duel.reveal : null;
  const oppAnswered = opp && (duel.answered || []).includes(opp.id);
  const chosen = reveal ? reveal.choices?.[me] ?? myChoice : myChoice;
  const oppChoice = reveal ? reveal.choices?.[opp?.id] : null;
  const gained = reveal ? reveal.points?.[me] || 0 : 0;
  const tag = q.suddenDeath ? translateUI("ANİ ÖLÜM") : `${translateUI("{0}. TUR", { 0: q.round })} · ${translateUI(LEVEL_LABEL[q.level] || "")}`;
  useEffect(() => {
    if (!reveal) return;
    if (chosen === reveal.correct) hapticSuccess(); else hapticWarning();
  }, [!!reveal]);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.scoreBar}>
        <ScoreSide player={mine} styles={styles} label={translateUI("Sen")} />
        <View style={{ alignItems: "center" }}>
          <Text style={styles.qNumber}>{q.suddenDeath ? translateUI("ANİ ÖLÜM") : `${q.number} / ${duel.totalQuestions}`}</Text>
          {duel.phase === "question" ? <Seconds deadline={duel.deadline} offsetRef={offsetRef} styles={styles} /> : <Text style={styles.seconds}>{" "}</Text>}
        </View>
        <ScoreSide player={opp} styles={styles} right light={duel.phase === "question" && oppAnswered} />
      </View>
      {duel.phase === "question" ? <Fitil deadline={duel.deadline} total={PHASE_TOTAL.question} offsetRef={offsetRef} c={c} /> : <View style={{ height: 14 }} />}
      <Text style={styles.qTag} numberOfLines={1}>{tag} · {q.title}</Text>
      <Text style={styles.qText}>{q.text}</Text>
      {q.options.map((o, i) => {
        const isMine = chosen === i;
        const isRight = reveal && reveal.correct === i;
        const isWrongMine = reveal && isMine && !isRight;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.option, isMine && !reveal && styles.optionMine, isRight && styles.optionRight, isWrongMine && styles.optionWrong, chosen != null && !isMine && !isRight && { opacity: 0.55 }]}
            disabled={chosen != null || duel.phase !== "question"}
            onPress={() => onAnswer(i)}
            activeOpacity={0.85}
            accessibilityLabel={o}
            accessibilityState={{ selected: isMine }}
          >
            <View style={[styles.letter, isMine && !reveal && { backgroundColor: c.accent }, isRight && { backgroundColor: c.accent2 }, isWrongMine && { backgroundColor: c.danger }]}>
              {isRight ? <Check size={13} color="#fff" /> : isWrongMine ? <X size={13} color="#fff" /> : <Text style={[styles.letterText, isMine && { color: SALON.onGold }]}>{LETTERS[i]}</Text>}
            </View>
            <Text style={styles.optionText}>{o}</Text>
            {reveal && oppChoice === i && <RetryImage source={{ uri: avatarOr(opp?.avatarUrl, opp?.id) }} style={styles.oppMark} />}
          </TouchableOpacity>
        );
      })}
      <View accessibilityLiveRegion="polite">
        {reveal ? (
          <Text style={[styles.status, { color: gained ? c.accent : c.dim }]}>{gained ? translateUI("+{0} puan", { 0: gained }) : chosen == null ? translateUI("Süre doldu") : translateUI("Bu soru olmadı")}</Text>
        ) : chosen != null ? (
          <Text style={styles.status}>{oppAnswered ? translateUI("İkiniz de cevapladınız") : translateUI("Cevabın alındı. {0} düşünüyor.", { 0: opp?.name || translateUI("Rakibin") })}</Text>
        ) : oppAnswered ? (
          <Text style={styles.status}>{translateUI("{0} cevapladı", { 0: opp?.name || translateUI("Rakibin") })}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

// Işık: rakip cevapladığında avatarın yanındaki küçük salon ampulü yanıyor.
function ScoreSide({ player, styles, label, right, light }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(glow, { toValue: light ? 1 : 0, useNativeDriver: true, damping: 10, stiffness: 240 }).start(); }, [light]);
  return (
    <View style={[styles.side, right && { flexDirection: "row-reverse" }]}>
      <View>
        <Avatar player={player} styles={styles} size={40} />
        {right && <Animated.View style={[styles.bulb, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]} />}
      </View>
      <View style={{ alignItems: right ? "flex-end" : "flex-start", flexShrink: 1 }}>
        <Text style={styles.sideName} numberOfLines={1}>{label || player?.name}</Text>
        <Text style={styles.sideScore}>{player?.score ?? 0}</Text>
      </View>
    </View>
  );
}

function Avatar({ player, styles, size }) {
  return <RetryImage source={{ uri: avatarOr(player?.avatarUrl, player?.id) }} style={[styles.avatar, { width: size, height: size }]} />;
}

// ---------- sonuç ----------

function Result({ styles, c, duel, me, mine, opp, reveals, onRematch, onShare, onLobby, limit, onPremium }) {
  const r = duel.result || {};
  const won = r.winnerId === me;
  const draw = r.winnerId == null;
  const title = draw ? translateUI("Berabere") : won ? translateUI("Kazandın") : translateUI("{0} kazandı", { 0: opp?.name || translateUI("Rakibin") });
  const indexes = Object.keys(reveals).map(Number).sort((a, b) => a - b);
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(rise, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 140 }).start(); if (won) hapticSuccess(); }, []);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.resultHero, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
        <GoldWash height={190} />
        {won ? <Trophy size={30} color={c.accent} /> : <Swords size={28} color={c.accent} />}
        <Text style={styles.resultTitle}>{title}</Text>
        <Text style={styles.resultScore}>{mine?.score ?? 0}<Text style={{ color: c.dim }}>{"  -  "}</Text>{opp?.score ?? 0}</Text>
        <Text style={styles.resultSub}>{finishText(r, me, opp)}</Text>
      </Animated.View>
      {indexes.length > 0 && (
        <View style={styles.tally}>
          <TallyRow styles={styles} c={c} name={translateUI("Sen")} id={me} reveals={reveals} indexes={indexes} />
          <TallyRow styles={styles} c={c} name={opp?.name || translateUI("Rakibin")} id={opp?.id} reveals={reveals} indexes={indexes} />
        </View>
      )}
      <TouchableOpacity style={styles.primaryBtn} onPress={onShare}><Share2 size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("Sonucu paylaş")}</Text></TouchableOpacity>
      {limit ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onPremium}><Crown size={15} color={c.text} /><Text style={styles.secondaryText}>{translateUI("Hakların bitti · Premium")}</Text></TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onRematch}><RotateCcw size={15} color={c.text} /><Text style={styles.secondaryText}>{translateUI("Rövanş iste")}</Text></TouchableOpacity>
      )}
      <TouchableOpacity style={styles.textBtn} onPress={onLobby}><Text style={styles.textBtnText}>{translateUI("Başka bir arkadaşla oyna")}</Text></TouchableOpacity>
    </ScrollView>
  );
}

function TallyRow({ styles, c, name, id, reveals, indexes }) {
  return (
    <View style={styles.tallyRow}>
      <Text style={styles.tallyName} numberOfLines={1}>{name}</Text>
      <View style={styles.tallyDots}>
        {indexes.map((i) => {
          const rv = reveals[i];
          const ok = rv?.choices?.[id] === rv?.correct;
          return <View key={i} style={[styles.tallyDot, { backgroundColor: ok ? c.accent : c.surface2 }]} />;
        })}
      </View>
    </View>
  );
}

function EndNote({ styles, c, icon: Icon, title, text, primary, onPrimary }) {
  return (
    <View style={styles.stage}>
      <View style={styles.bigIcon}><Icon size={26} color={c.accent} /></View>
      <Text style={styles.stageTitle}>{title}</Text>
      <Text style={styles.stageText}>{text}</Text>
      {!!primary && <TouchableOpacity style={styles.primaryBtn} onPress={onPrimary}><Text style={styles.primaryText}>{primary}</Text></TouchableOpacity>}
    </View>
  );
}

function finishText(r, me, opp) {
  const name = opp?.name || translateUI("Rakibin");
  switch (r.reason) {
    case "disconnect": return r.winnerId === me ? translateUI("{0} oyundan düştü, düello sana yazıldı.", { 0: name }) : translateUI("Bağlantın koptuğu için düello rakibine yazıldı.");
    case "left": return r.winnerId === me ? translateUI("{0} düellodan çıktı.", { 0: name }) : translateUI("Düellodan çıktığın için rakibin kazandı.");
    case "sudden_death": return translateUI("Eşitlik ani ölüm sorusuyla bozuldu.");
    case "draw": return translateUI("Ani ölüm soruları da eşitliği bozamadı.");
    default: return translateUI("Doğru cevaplar ve hız puanıyla.");
  }
}

function cancelText(duel, me, opp) {
  const name = opp?.name || translateUI("Rakibin");
  const reason = duel.result?.reason;
  switch (reason) {
    case "invite_expired": return translateUI("Davet 60 saniye içinde yanıtlanmadı.");
    case "declined": return duel.inviterId === me ? translateUI("{0} daveti reddetti.", { 0: name }) : translateUI("Daveti reddettin.");
    case "inviter_cancelled":
    case "inviter_left": return translateUI("Davet geri çekildi.");
    case "invitee_limit": return translateUI("{0} bugünkü düello haklarını kullanmış.", { 0: name });
    case "join_timeout": return translateUI("Rakibin düelloya gelmedi.");
    case "ready_timeout": return translateUI("Süre doldu, düello başlamadı.");
    case "no_questions": return translateUI("Bu diziler için soru hazırlanamadı. Başka dizilerle yeniden dene.");
    default: return translateUI("Bir oyuncu ayrıldığı için düello başlamadı. Puan yazılmadı.");
  }
}

function makeStyles(c, insets) {
  const safeBottom = Math.max(36, insets.bottom + 24);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center" },
    content: { padding: 16, paddingBottom: safeBottom },
    hero: { borderRadius: 18, padding: 20, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    heroIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    eyebrow: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3 },
    heroTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 32, lineHeight: 35, marginTop: 4 },
    heroSub: { color: c.dim, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    ruleRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    rule: { flex: 1, backgroundColor: c.bg, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 10, alignItems: "center" },
    ruleValue: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24 },
    ruleLabel: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1 },
    note: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SALON.goldTint, borderWidth: 1, borderColor: SALON.goldLine, borderRadius: 14, padding: 12 },
    noteText: { flex: 1, color: c.text, fontSize: 12, lineHeight: 17 },
    quota: { marginTop: 14, color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.1, textAlign: "center" },
    errorBox: { marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: `${c.danger}12`, borderWidth: 1, borderColor: `${c.danger}35`, borderRadius: 12, padding: 10 },
    errorText: { flex: 1, color: c.danger, fontSize: 11, lineHeight: 15 },
    sectionLabel: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 22, marginBottom: 9 },
    friendRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 11, marginBottom: 8 },
    avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: c.surface2 },
    rowTitle: { color: c.text, fontSize: 13.5, fontWeight: "800" },
    callBtn: { minWidth: 72, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    callText: { color: SALON.onGold, fontSize: 12, fontWeight: "900" },
    emptyCard: { alignItems: "center", gap: 8, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 22 },
    emptyText: { color: c.dim, fontSize: 12, lineHeight: 18, textAlign: "center" },

    stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: safeBottom },
    stageTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 28, lineHeight: 31, textAlign: "center", marginTop: 16 },
    stageText: { color: c.dim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 6 },
    fitilWrap: { alignSelf: "stretch", marginTop: 22, marginBottom: 4 },
    bigIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    primaryBtn: { alignSelf: "stretch", minHeight: 48, marginTop: 14, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    primaryText: { color: SALON.onGold, fontSize: 13, fontWeight: "900" },
    secondaryBtn: { alignSelf: "stretch", minHeight: 46, marginTop: 10, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    secondaryText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    textBtn: { alignSelf: "center", padding: 14 },
    textBtnText: { color: c.dim, fontSize: 12, fontWeight: "700" },
    footNote: { color: c.dim, fontSize: 10.5, textAlign: "center", marginTop: 10 },

    turnRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    turnTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24, marginTop: 2 },
    seconds: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26, minWidth: 34, textAlign: "center" },
    pickHint: { color: c.dim, fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 12 },
    ticket: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 9, overflow: "hidden" },
    ticketPicked: { borderColor: SALON.goldLine, backgroundColor: c.surface2 },
    ticketPoster: { width: 46, height: 68, borderRadius: 8, backgroundColor: c.surface2 },
    ticketPerf: { width: 0, height: 60, borderLeftWidth: 1.5, borderStyle: "dashed", borderColor: c.border },
    ticketTitle: { color: c.text, fontSize: 14, fontWeight: "800" },
    ticketTag: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1, marginTop: 5 },
    stamp: { position: "absolute", right: 12, top: 18, borderWidth: 2, borderColor: c.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${c.bg}cc` },
    stampText: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1 },

    curtain: { borderRadius: 20, padding: 22, paddingTop: 30, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    drapes: { position: "absolute", top: 0, left: 0, right: 0, height: 18, flexDirection: "row", justifyContent: "space-between" },
    drapeL: { width: "38%", height: 18, backgroundColor: "#6e2024", borderBottomRightRadius: 18 },
    drapeR: { width: "38%", height: 18, backgroundColor: "#6e2024", borderBottomLeftRadius: 18 },
    curtainTickets: { flexDirection: "row", gap: 8, marginTop: 18 },
    miniTicket: { flex: 1, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: SALON.goldLine, padding: 10, backgroundColor: c.bg },
    miniTicketRound: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1 },
    miniTicketTitle: { color: c.text, fontSize: 13, fontWeight: "800", marginTop: 4 },
    readyLine: { color: c.dim, fontSize: 11.5, textAlign: "center", marginTop: 6 },

    scoreBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    side: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    sideName: { color: c.dim, fontSize: 10.5, fontWeight: "700" },
    sideScore: { color: c.text, fontFamily: FONTS.marquee, fontSize: 22 },
    bulb: { position: "absolute", right: -2, top: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#ffe7a8", borderWidth: 2, borderColor: c.bg, shadowColor: c.accent, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    qNumber: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1 },
    qTag: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1, marginTop: 10 },
    qText: { color: c.text, fontSize: 19, fontWeight: "800", lineHeight: 26, marginTop: 8, marginBottom: 16 },
    option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9 },
    optionMine: { borderColor: c.accent, backgroundColor: SALON.goldTint },
    optionRight: { borderColor: c.accent2, backgroundColor: `${c.accent2}1f` },
    optionWrong: { borderColor: c.danger, backgroundColor: `${c.danger}14` },
    letter: { width: 28, height: 28, borderRadius: 8, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    letterText: { color: c.text, fontFamily: FONTS.monoMedium, fontSize: 12 },
    optionText: { flex: 1, color: c.text, fontSize: 14, fontWeight: "700", lineHeight: 19 },
    oppMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.bg },
    status: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 8, fontWeight: "700" },

    resultHero: { borderRadius: 18, padding: 26, alignItems: "center", overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    resultTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 36, lineHeight: 39, marginTop: 8, textAlign: "center" },
    resultScore: { color: c.accent, fontFamily: FONTS.marquee, fontSize: 56, lineHeight: 62, marginTop: 4 },
    resultSub: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 4, lineHeight: 17 },
    tally: { marginTop: 12, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 },
    tallyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    tallyName: { width: 82, color: c.text, fontSize: 12, fontWeight: "700" },
    tallyDots: { flex: 1, flexDirection: "row", gap: 5, flexWrap: "wrap" },
    tallyDot: { width: 18, height: 18, borderRadius: 5 },
  });
}
