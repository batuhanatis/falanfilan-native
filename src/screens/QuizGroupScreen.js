import { t as translateUI } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, Alert, AppState, Image, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, Trophy, RotateCcw, Share2, AlertCircle, Check, X, Ticket, Clapperboard, Crown, UserPlus, Armchair } from "lucide-react-native";
import { GoldWash, SALON } from "../components/salon/SalonKit";
import { FONTS } from "../theme/fonts";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import { duelApi, groupApi, GROUP_LIVE_PHASES, GROUP_OPEN_PHASES } from "../api/duels";
import ScreenHeader from "../components/ScreenHeader";
import RetryImage from "../components/RetryImage";
import { GoldenBanner, JokerTray, TauntBar, TauntBubble, pointsLine, JOKER_META } from "../components/duel/DuelExtras";
import { Fitil, useRemaining } from "../components/duel/Fitil";
import { avatarOr } from "../utils/avatar";
import { getStoreLink } from "../utils/appLinks";
import { hapticLight, hapticSuccess, hapticWarning, hapticSelection } from "../utils/haptics";

// Grup düellosu: 3-6 arkadaş aynı salonda. Kurucu arkadaşlarını çağırır, gelenler koltuklarına
// oturur; kurucu başlatınca herkes aynı anda bir yapım seçer, sonra 8 soru kolaydan zora.
// Süreleri ve puanı sunucu tutuyor (quiz-groups.js); bu ekran "group_state" anlık görüntüsünü
// çiziyor, varlığını "group_ping" ile bildiriyor. Oyunda ekrandan çıkan "düştü" sayılıyor,
// geri gelince kaldığı sorudan devam ediyor.
const PING_MS = 2500;
const LEVEL_LABEL = { 1: "KOLAY", 2: "ORTA", 3: "ZOR" };
const LETTERS = ["A", "B", "C", "D"];
const PHASE_TOTAL = { lobby: 180000, picking: 40000, curtain: 6000, question: 15000, reveal: 3500 };
const MAX_FRIENDS = 5;
const firstName = (n) => String(n || "").split(" ")[0];

export default function QuizGroupScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const ws = useWS();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.bottom]);
  const me = auth?.id;

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(!!route?.params?.groupId);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState("");
  const [myChoices, setMyChoices] = useState({});
  const [incomingTaunt, setIncomingTaunt] = useState(null);
  const [myTaunt, setMyTaunt] = useState(null);
  const [busy, setBusy] = useState(false);
  const offsetRef = useRef(0);
  const groupRef = useRef(null);
  const leftRef = useRef(false);

  const applyState = useCallback((g) => {
    if (!g) return;
    if (typeof g.serverNow === "number") offsetRef.current = g.serverNow - Date.now();
    setGroup((prev) => {
      if (prev && prev.id !== g.id) { setMyChoices({}); setIncomingTaunt(null); setMyTaunt(null); }
      return g;
    });
  }, []);
  useEffect(() => { groupRef.current = group; }, [group]);
  const hello = useCallback((id) => { if (id) ws?.send({ type: "group_hello", groupId: id }); }, [ws]);

  const paramId = route?.params?.groupId;
  useEffect(() => {
    if (!paramId || !auth?.token) return;
    // Bu ekranda kurulan ya da katılınan oda: zaten elimizde, yeniden yükleme yok.
    if (groupRef.current?.id === Number(paramId)) return;
    let alive = true;
    leftRef.current = false;
    setLoading(true); setGone(false); setError("");
    groupApi.get(auth.token, paramId)
      .then((data) => { if (alive) { applyState(data.group); hello(data.group?.id); } })
      .catch(() => { if (alive) setGone(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [paramId, auth?.token]);

  useEffect(() => {
    if (!ws?.subscribe) return;
    return ws.subscribe((msg) => {
      const cur = groupRef.current;
      if (msg.type === "group_state" && msg.group && cur && msg.group.id === cur.id) applyState(msg.group);
      else if (msg.type === "group_gone" && cur && msg.groupId === cur.id && GROUP_OPEN_PHASES.includes(cur.phase)) setGone(true);
      else if (msg.type === "ws_ready" && cur && GROUP_OPEN_PHASES.includes(cur.phase)) hello(cur.id);
      else if (msg.type === "group_taunt" && cur && msg.groupId === cur.id) { setIncomingTaunt({ key: msg.key, from: msg.from, at: Date.now() }); hapticLight(); }
    });
  }, [ws, applyState, hello]);

  const open = !!group && GROUP_OPEN_PHASES.includes(group.phase);
  useEffect(() => {
    if (!open) return;
    const id = group.id;
    const t = setInterval(() => ws?.send({ type: "group_ping", groupId: id }), PING_MS);
    return () => clearInterval(t);
  }, [open, group?.id, ws]);

  // Arka plandan dönünce yeniden selam: oyundaysan kaldığın sorudan devam edersin.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const cur = groupRef.current;
      if (state === "active" && cur && GROUP_OPEN_PHASES.includes(cur.phase)) hello(cur.id);
    });
    return () => sub.remove();
  }, [hello]);

  const myStatus = group?.players?.find((p) => p.id === me)?.status;
  // Geri: oyundaysa onay iste. Salonda kurucu çıkarsa salon kapanır; katılmış oyuncu salondan kalkar.
  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      const cur = groupRef.current;
      if (!cur || leftRef.current) return;
      const mine = cur.players?.find((p) => p.id === me);
      if (GROUP_LIVE_PHASES.includes(cur.phase) && mine?.status === "joined") {
        e.preventDefault();
        Alert.alert(translateUI("Oyundan çıkılsın mı?"), translateUI("Çıkarsan oyun sensiz devam eder, sıralamada en sona yazılırsın."), [
          { text: translateUI("Devam et"), style: "cancel" },
          { text: translateUI("Çık"), style: "destructive", onPress: () => { leftRef.current = true; ws?.send({ type: "group_leave", groupId: cur.id }); navigation.dispatch(e.data.action); } },
        ]);
        return;
      }
      if (cur.phase === "lobby" && cur.hostId === me) {
        e.preventDefault();
        Alert.alert(translateUI("Salon kapansın mı?"), translateUI("Grubu sen kurdun. Çıkarsan salon kapanır ve davetler geri çekilir."), [
          { text: translateUI("Kal"), style: "cancel" },
          { text: translateUI("Kapat"), style: "destructive", onPress: () => { leftRef.current = true; ws?.send({ type: "group_leave", groupId: cur.id }); navigation.dispatch(e.data.action); } },
        ]);
        return;
      }
      if (cur.phase === "lobby" && mine?.status === "joined") ws?.send({ type: "group_leave", groupId: cur.id });
    });
  }, [navigation, ws, me]);

  function failWith(e) {
    hapticWarning();
    setError(e.code === "DUEL_LIMIT" ? "limit" : e.message || translateUI("İşlem tamamlanamadı."));
  }
  async function create(ids) {
    setError(""); setBusy(true);
    try {
      const data = await groupApi.create(auth.token, ids);
      hapticSuccess();
      leftRef.current = false;
      applyState(data.group);
      hello(data.group.id);
      navigation.setParams({ groupId: data.group.id });
    } catch (e) { failWith(e); }
    setBusy(false);
  }
  async function join(id = group?.id) {
    setError(""); setBusy(true);
    try {
      const data = await groupApi.accept(auth.token, id);
      hapticSuccess();
      leftRef.current = false;
      applyState(data.group);
      hello(data.group.id);
      if (id !== paramId) navigation.setParams({ groupId: id });
    } catch (e) {
      if (e.code === "GROUP_GONE") setGone(true); else failWith(e);
    }
    setBusy(false);
  }
  async function decline() {
    await groupApi.decline(auth.token, group.id).catch(() => {});
    leftRef.current = true;
    navigation.goBack();
  }
  async function inviteMore(friendId) {
    try { applyState((await groupApi.invite(auth.token, group.id, [friendId])).group); hapticSuccess(); } catch (e) { failWith(e); }
  }
  async function again() {
    setError(""); setBusy(true);
    try {
      const data = await groupApi.again(auth.token, group.id);
      hapticSuccess();
      leftRef.current = false;
      applyState(data.group);
      hello(data.group.id);
      navigation.setParams({ groupId: data.group.id });
    } catch (e) { failWith(e); }
    setBusy(false);
  }
  const start = () => { hapticLight(); ws?.send({ type: "group_start", groupId: group.id }); };
  const pick = (titleId) => { hapticSelection(); ws?.send({ type: "group_pick", groupId: group.id, titleId }); };
  function answer(choice) {
    const idx = group.question?.index;
    if (idx == null || myChoices[idx] != null) return;
    hapticLight();
    setMyChoices((prev) => ({ ...prev, [idx]: choice }));
    ws?.send({ type: "group_answer", groupId: group.id, index: idx, choice });
  }
  function applyJoker(type) {
    const idx = group?.question?.index;
    if (idx != null) ws?.send({ type: "group_joker", groupId: group.id, index: idx, joker: type });
  }
  function sendTaunt(key) {
    if (!group) return;
    ws?.send({ type: "group_taunt", groupId: group.id, key });
    setMyTaunt({ key, at: Date.now() });
  }
  function share() {
    const r = group?.result;
    const mine = r?.ranking?.find((x) => x.userId === me);
    const msg = mine
      ? translateUI("Pellix'te {0} kişilik grup düellosunda {1}. oldum, {2} puan. Sıra sizde.", { 0: r.ranking.length, 1: mine.place, 2: mine.score })
      : translateUI("Pellix'te grup düellosu oynadık. Sıra sizde.");
    Share.share({ message: `${msg} ${getStoreLink("quiz_group")}` }).catch(() => {});
  }
  const toDuels = () => { leftRef.current = true; navigation.goBack(); };

  const header = <ScreenHeader title={translateUI("Grup düellosu")} subtitle={group ? translateUI("{0} kişi", { 0: (group.players || []).filter((p) => p.status === "joined").length }) : translateUI("3-6 kişi, aynı sorular")} onBack={() => navigation.goBack()} />;
  if (loading) return <View style={[styles.root, styles.center]}><ActivityIndicator color={c.accent} /></View>;
  if (gone) {
    return <View style={styles.root}>{header}<EndNote styles={styles} c={c} icon={Clapperboard} title={translateUI("Bu salon kapandı")} text={translateUI("Davetin süresi dolmuş ya da oyun başlamış olabilir.")} primary={translateUI("Düello sayfasına dön")} onPrimary={toDuels} /></View>;
  }
  if (!group) {
    return <View style={styles.root}>{header}<CreateGroup styles={styles} c={c} token={auth.token} busy={busy} error={error} onCreate={create} onPremium={() => navigation.navigate("Premium", { reason: "duel_limit" })} /></View>;
  }

  const players = group.players || [];
  let body;
  if (group.phase === "lobby") {
    body = <Salon styles={styles} c={c} token={auth.token} group={group} me={me} offsetRef={offsetRef} busy={busy} error={error} onJoin={() => join()} onDecline={decline} onStart={start} onInvite={inviteMore} onPremium={() => navigation.navigate("Premium", { reason: "duel_limit" })} />;
  } else if (myStatus !== "joined" && myStatus !== "left" && group.phase !== "finished") {
    body = <EndNote styles={styles} c={c} icon={Clapperboard} title={translateUI("Oyun başladı")} text={translateUI("Bu grup sen katılmadan başladı. Bir sonrakinde salona erken gel.")} primary={translateUI("Düello sayfasına dön")} onPrimary={toDuels} />;
  } else if (group.phase === "picking") {
    body = <GroupPicking styles={styles} c={c} group={group} me={me} offsetRef={offsetRef} onPick={pick} />;
  } else if (group.phase === "curtain") {
    body = <GroupCurtain styles={styles} c={c} group={group} offsetRef={offsetRef} />;
  } else if (group.phase === "question" || group.phase === "reveal") {
    body = myStatus === "left"
      ? <EndNote styles={styles} c={c} icon={Clapperboard} title={translateUI("Oyundan çıktın")} text={translateUI("Oyun sensiz devam ediyor.")} primary={translateUI("Düello sayfasına dön")} onPrimary={toDuels} />
      : <GroupQuestion styles={styles} c={c} group={group} me={me} offsetRef={offsetRef} myChoice={myChoices[group.question?.index]} onAnswer={answer} onJoker={applyJoker} onTaunt={sendTaunt} />;
  } else if (group.phase === "finished") {
    body = <GroupResult styles={styles} c={c} group={group} me={me} busy={busy} error={error} onAgain={again} onJoinAgain={() => join(group.again?.id)} onShare={share} onLobby={toDuels} onTaunt={sendTaunt} onPremium={() => navigation.navigate("Premium", { reason: "duel_limit" })} />;
  } else {
    body = <EndNote styles={styles} c={c} icon={Clapperboard} title={translateUI("Oyun başlamadan bitti")} text={cancelText(group, me)} primary={translateUI("Düello sayfasına dön")} onPrimary={toDuels} />;
  }
  const tauntFrom = incomingTaunt ? players.find((p) => p.id === incomingTaunt.from) : null;
  return (
    <View style={styles.root}>
      {header}
      <View style={{ flex: 1 }}>
        {body}
        <TauntBubble taunt={incomingTaunt} side="right" name={firstName(tauntFrom?.name).toLocaleUpperCase("tr-TR")} />
        <TauntBubble taunt={myTaunt} side="left" name={translateUI("SEN")} />
      </View>
    </View>
  );
}

// ---------- grup kur ----------

function CreateGroup({ styles, c, token, busy, error, onCreate, onPremium }) {
  const [friends, setFriends] = useState(null);
  const [meta, setMeta] = useState(null);
  const [picked, setPicked] = useState([]);
  useEffect(() => {
    api.friends(token).then((d) => setFriends(d.friends || [])).catch(() => setFriends([]));
    duelApi.meta(token).then(setMeta).catch(() => setMeta({}));
  }, [token]);
  if (!friends || !meta) return <View style={[styles.root, styles.center]}><ActivityIndicator color={c.accent} /></View>;
  const out = meta.premium === false && meta.remaining === 0;
  const toggle = (id) => {
    hapticSelection();
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_FRIENDS ? cur : [...cur, id]));
  };
  const enough = picked.length >= 2;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <GoldWash height={170} />
          <View style={styles.heroIcon}><Users size={22} color={c.accent} /></View>
          <Text style={styles.eyebrow}>{translateUI("CANLI · 3-6 KİŞİ")}</Text>
          <Text style={styles.heroTitle}>{translateUI("Salonu doldur")}</Text>
          <Text style={styles.heroSub}>{translateUI("Arkadaşlarını çağır, gelenler koltuklarına otursun. Başlatınca herkes bir yapım seçer; 8 soru, kolaydan zora. Son soru altın, jokerler ve laf atma burada da var.")}</Text>
        </View>
        {(out || error === "limit") ? (
          <TouchableOpacity style={styles.note} onPress={onPremium} activeOpacity={0.85}>
            <Crown size={18} color={c.accent} />
            <Text style={styles.noteText}>{translateUI("Bugünkü 3 düello hakkını kullandın. Premium ile sınırsız düello yapabilirsin.")}</Text>
          </TouchableOpacity>
        ) : !!error && <View style={styles.errorBox}><AlertCircle size={14} color={c.danger} /><Text style={styles.errorText}>{translateUI(error)}</Text></View>}
        <Text style={styles.sectionLabel}>{translateUI("KİMLER GELSİN? · {0}/{1}", { 0: picked.length, 1: MAX_FRIENDS })}</Text>
        {friends.length < 2 ? (
          <View style={styles.emptyCard}><Users size={20} color={c.dim} /><Text style={styles.emptyText}>{translateUI("Grup düellosu için en az iki arkadaşın olmalı.")}</Text></View>
        ) : friends.map((f) => {
          const on = picked.includes(f.id);
          const full = !on && picked.length >= MAX_FRIENDS;
          return (
            <TouchableOpacity key={f.id} style={[styles.friendRow, on && styles.friendRowOn, full && { opacity: 0.45 }]} onPress={() => toggle(f.id)} disabled={full} activeOpacity={0.85} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: full }} accessibilityLabel={f.name}>
              <RetryImage source={{ uri: avatarOr(f.avatar_url || f.avatarUrl, f.id) }} style={styles.avatar} />
              <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{f.name}</Text>
              <View style={[styles.checkbox, on && styles.checkboxOn]}>{on && <Check size={13} color={SALON.onGold} strokeWidth={3} />}</View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.dock}>
        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 0 }, (!enough || busy || out) && { opacity: 0.45 }]} disabled={!enough || busy || out} onPress={() => onCreate(picked)} accessibilityRole="button">
          {busy ? <ActivityIndicator color={SALON.onGold} /> : <Text style={styles.primaryText}>{enough ? translateUI("Salonu aç · {0} kişi", { 0: picked.length + 1 }) : translateUI("En az iki arkadaş seç")}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------- bekleme salonu: koltuklar ----------

function Salon({ styles, c, token, group, me, offsetRef, busy, error, onJoin, onDecline, onStart, onInvite, onPremium }) {
  const isHost = group.hostId === me;
  const players = group.players || [];
  const mine = players.find((p) => p.id === me);
  const joined = players.filter((p) => p.status === "joined");
  const seated = players.filter((p) => p.status === "joined" || p.status === "invited");
  const host = players.find((p) => p.id === group.hostId);
  const left = useRemaining(group.deadline, offsetRef);
  const mm = Math.floor(left / 60000);
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const [adding, setAdding] = useState(false);
  const [friends, setFriends] = useState(null);
  useEffect(() => {
    if (!adding || friends) return;
    api.friends(token).then((d) => setFriends(d.friends || [])).catch(() => setFriends([]));
  }, [adding]);
  // Koltuklar: önce gelenler, sonra bekleyenler, sonra gelmeyenler; boş koltuklar en sonda.
  const order = { joined: 0, invited: 1, declined: 2, left: 2 };
  const seats = [...players].sort((a, b) => (a.id === group.hostId ? -1 : b.id === group.hostId ? 1 : order[a.status] - order[b.status]));
  const empty = Math.max(0, (group.maxPlayers || 6) - seats.length);
  const canStart = isHost && joined.length >= (group.minPlayers || 2);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.salonHead}>
        <Text style={styles.eyebrow}>{translateUI("BEKLEME SALONU")}</Text>
        <Text style={styles.turnTitle}>{isHost ? translateUI("Arkadaşların geliyor") : translateUI("{0} seni çağırdı", { 0: host?.name || translateUI("Bir arkadaşın") })}</Text>
        <Text style={styles.salonTimer}>{translateUI("Salon {0}:{1} sonra kapanır", { 0: mm, 1: ss })}</Text>
      </View>
      <View style={styles.screenLine}><Text style={styles.screenLineText}>{translateUI("PERDE")}</Text></View>
      <View style={styles.seats}>
        {seats.map((p) => <Seat key={p.id} p={p} me={me} hostId={group.hostId} styles={styles} c={c} />)}
        {Array.from({ length: empty }).map((_, i) => (
          <TouchableOpacity key={`e${i}`} style={styles.seatCell} disabled={!isHost} onPress={() => { hapticSelection(); setAdding(true); }} accessibilityLabel={isHost ? translateUI("Arkadaş ekle") : translateUI("Boş koltuk")}>
            <View style={[styles.seatBack, styles.seatEmpty]}>{isHost ? <UserPlus size={16} color={c.dim} /> : <Armchair size={16} color={c.border} />}</View>
            <Text style={styles.seatName} numberOfLines={1}>{isHost ? translateUI("Ekle") : " "}</Text>
            <Text style={styles.seatState}>{" "}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error === "limit" ? (
        <TouchableOpacity style={styles.note} onPress={onPremium} activeOpacity={0.85}>
          <Crown size={18} color={c.accent} />
          <Text style={styles.noteText}>{translateUI("Bugünkü 3 düello hakkını kullandın. Premium ile sınırsız düello yapabilirsin.")}</Text>
        </TouchableOpacity>
      ) : !!error && <View style={styles.errorBox}><AlertCircle size={14} color={c.danger} /><Text style={styles.errorText}>{translateUI(error)}</Text></View>}

      {isHost ? (
        <>
          <TouchableOpacity style={[styles.primaryBtn, !canStart && { opacity: 0.45 }]} disabled={!canStart} onPress={onStart} accessibilityRole="button">
            <Text style={styles.primaryText}>{canStart ? translateUI("Başlat · {0} kişi", { 0: joined.length }) : translateUI("En az bir arkadaşının gelmesi bekleniyor")}</Text>
          </TouchableOpacity>
          <Text style={styles.footNote}>{translateUI("Herkes gelmeden de başlatabilirsin; gelmeyenler bu oyuna katılmaz.")}</Text>
          {seated.length < (group.maxPlayers || 6) && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { hapticSelection(); setAdding((v) => !v); }}>
              <UserPlus size={15} color={c.text} /><Text style={styles.secondaryText}>{translateUI("Arkadaş ekle")}</Text>
            </TouchableOpacity>
          )}
          {adding && (
            !friends ? <ActivityIndicator color={c.accent} style={{ marginTop: 12 }} /> : (
              <View style={{ marginTop: 10 }}>
                {friends.filter((f) => !players.some((p) => p.id === f.id && (p.status === "joined" || p.status === "invited"))).map((f) => (
                  <View key={f.id} style={styles.friendRow}>
                    <RetryImage source={{ uri: avatarOr(f.avatar_url || f.avatarUrl, f.id) }} style={styles.avatarSm} />
                    <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{f.name}</Text>
                    <TouchableOpacity style={[styles.callBtn, seated.length >= (group.maxPlayers || 6) && { opacity: 0.4 }]} disabled={seated.length >= (group.maxPlayers || 6)} onPress={() => onInvite(f.id)} accessibilityLabel={translateUI("{0} gruba çağır", { 0: f.name })}>
                      <Text style={styles.callText}>{translateUI("Çağır")}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )
          )}
        </>
      ) : mine?.status === "joined" ? (
        <View style={styles.waitBox}>
          <ActivityIndicator color={c.accent} size="small" />
          <Text style={styles.waitText}>{translateUI("Koltuğundasın. {0} başlatınca oyun açılacak.", { 0: host?.name || translateUI("Grubu kuran") })}</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.5 }]} disabled={busy} onPress={onJoin} accessibilityRole="button">
            {busy ? <ActivityIndicator color={SALON.onGold} /> : <Text style={styles.primaryText}>{translateUI("Koltuğuma otur")}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onDecline}><Text style={styles.secondaryText}>{translateUI("Bu sefer gelmeyeyim")}</Text></TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// Koltuk: gelen oturunca koltuk açılıp avatar yerine oturuyor; ekrandaysa koltuk ışığı yanıyor.
function Seat({ p, me, hostId, styles, c }) {
  const sit = useRef(new Animated.Value(p.status === "joined" ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(sit, { toValue: p.status === "joined" ? 1 : 0, useNativeDriver: true, damping: 11, stiffness: 200 }).start();
    if (p.status === "joined" && p.id !== me) hapticLight();
  }, [p.status]);
  const state = p.status === "joined" ? (p.id === hostId ? translateUI("kurucu") : translateUI("geldi"))
    : p.status === "invited" ? translateUI("bekleniyor") : translateUI("gelmedi");
  const scale = sit.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  return (
    <View style={styles.seatCell} accessibilityLabel={`${p.name}: ${state}`}>
      <Animated.View style={[styles.seatBack, p.status === "joined" ? styles.seatTaken : p.status === "invited" ? styles.seatWaiting : styles.seatGone, { transform: [{ scale }] }]}>
        <RetryImage source={{ uri: avatarOr(p.avatarUrl, p.id) }} style={[styles.seatAvatar, p.status !== "joined" && { opacity: p.status === "invited" ? 0.45 : 0.2 }]} />
        {p.id === hostId && <View style={styles.seatCrown}><Crown size={10} color={SALON.onGold} /></View>}
        {p.status === "joined" && p.present && <View style={styles.seatLight} />}
      </Animated.View>
      <View style={[styles.seatCushion, p.status === "joined" && { backgroundColor: "#6e2024" }]} />
      <Text style={styles.seatName} numberOfLines={1}>{p.id === me ? translateUI("Sen") : firstName(p.name)}</Text>
      <Text style={[styles.seatState, p.status === "joined" && { color: c.accent }]}>{state}</Text>
    </View>
  );
}

// ---------- eş zamanlı seçim ----------

function GroupPicking({ styles, c, group, me, offsetRef, onPick }) {
  const joined = (group.players || []).filter((p) => p.status === "joined");
  const byId = Object.fromEntries((group.players || []).map((p) => [p.id, p]));
  const myPick = (group.picks || []).find((p) => p.userId === me);
  const pickersOf = (titleId) => (group.picks || []).filter((p) => p.titleId === titleId).map((p) => byId[p.userId]).filter(Boolean);
  const n = joined.length;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{translateUI("HERKES BİR YAPIM SEÇİYOR")}</Text>
      <Text style={styles.turnTitle}>{myPick ? translateUI("Seçimin alındı") : translateUI("Bir yapım seç")}</Text>
      <View style={styles.fitilWrap}><Fitil deadline={group.deadline} total={PHASE_TOTAL.picking} offsetRef={offsetRef} c={c} /></View>
      <View style={styles.pickers}>
        {joined.map((p) => (
          <View key={p.id} style={styles.picker}>
            <RetryImage source={{ uri: avatarOr(p.avatarUrl, p.id) }} style={[styles.pickerAvatar, !p.picked && { opacity: 0.45 }]} />
            {p.picked && <View style={styles.pickerCheck}><Check size={9} color={SALON.onGold} strokeWidth={3.5} /></View>}
            <Text style={styles.pickerName} numberOfLines={1}>{p.id === me ? translateUI("Sen") : firstName(p.name)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.pickHint}>{translateUI("Sorular seçilen yapımlardan gelir, kolaydan zora. Aynı yapımı birden çok kişi seçebilir. Süre dolunca seçmeyenin yapımı olmaz.")}</Text>
      {(group.candidates || []).map((t) => {
        const pickers = pickersOf(t.titleId);
        const mineHere = myPick?.titleId === t.titleId;
        const liked = t.likedBy >= n && n > 1 ? translateUI("HEPİNİZ BEĞENDİNİZ") : t.likedBy > 0 ? translateUI("{0} KİŞİ BEĞENDİ", { 0: t.likedBy }) : null;
        return (
          <TouchableOpacity key={t.titleId} style={[styles.ticket, mineHere && styles.ticketPicked, !!myPick && !mineHere && { opacity: 0.6 }]} disabled={!!myPick} onPress={() => onPick(t.titleId)} activeOpacity={0.85} accessibilityLabel={t.title} accessibilityState={{ selected: mineHere, disabled: !!myPick }}>
            {t.poster ? <Image source={{ uri: t.poster }} style={styles.ticketPoster} /> : <View style={[styles.ticketPoster, styles.center]}><Ticket size={18} color={c.dim} /></View>}
            <View style={styles.ticketPerf} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.ticketKind}>{translateUI(t.series ? "FİLM SERİSİ" : t.type === "Film" ? "FİLM" : "DİZİ")}{liked ? ` · ${liked}` : ""}</Text>
              <Text style={styles.ticketTitle} numberOfLines={2}>{t.title}</Text>
              {pickers.length > 0 && (
                <View style={styles.ticketPickers}>
                  {pickers.slice(0, 5).map((p, i) => <RetryImage key={p.id} source={{ uri: avatarOr(p.avatarUrl, p.id) }} style={[styles.stackAvatar, { marginLeft: i ? -7 : 0 }]} />)}
                  <Text style={styles.ticketPickedBy} numberOfLines={1}>{pickers.length === 1 ? translateUI("{0} seçti", { 0: pickers[0].id === me ? translateUI("Sen") : firstName(pickers[0].name) }) : translateUI("{0} kişi seçti", { 0: pickers.length })}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ---------- perde ----------

function GroupCurtain({ styles, c, group, offsetRef }) {
  const drop = useRef(new Animated.Value(-40)).current;
  useEffect(() => { Animated.spring(drop, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 160 }).start(); }, []);
  const titles = group.titles || [];
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.curtain, { transform: [{ translateY: drop }] }]}>
        <View style={styles.drapes}><View style={styles.drapeL} /><View style={styles.drapeR} /></View>
        <GoldWash height={150} />
        <Text style={[styles.eyebrow, { textAlign: "center" }]}>{translateUI("PERDE AÇILIYOR")}</Text>
        <Text style={[styles.heroTitle, { textAlign: "center" }]}>{translateUI("{0} yapım, 8 soru", { 0: titles.length })}</Text>
        <Text style={[styles.heroSub, { textAlign: "center" }]}>{translateUI("Sorular bu yapımların tamamından gelebilir, finaller ve son sahneler dahil. İzlemediğin bir yer varsa küçük sürprizlere hazır ol.")}</Text>
        <View style={styles.curtainTickets}>
          {titles.map((t) => (
            <View key={t.titleId} style={styles.miniTicket}>
              <Text style={styles.miniTicketTitle} numberOfLines={2}>{t.title}</Text>
            </View>
          ))}
        </View>
        <View style={styles.fitilWrap}><Fitil deadline={group.deadline} total={PHASE_TOTAL.curtain} offsetRef={offsetRef} c={c} /></View>
        <Text style={styles.readyLine}>{translateUI("İlk soru birazdan")}</Text>
      </Animated.View>
    </ScrollView>
  );
}

// ---------- soru ----------

function GroupQuestion({ styles, c, group, me, offsetRef, myChoice, onAnswer, onJoker, onTaunt }) {
  const q = group.question;
  const players = (group.players || []).filter((p) => p.status === "joined" || p.status === "left");
  const others = players.filter((p) => p.id !== me);
  const myJoker = group.jokers?.[me] || null;
  const hidden = group.myHidden || [];
  const reveal = group.phase === "reveal" ? group.reveal : null;
  const answered = group.answered || [];
  const chosen = reveal ? reveal.choices?.[me] ?? myChoice : myChoice;
  const gained = reveal ? reveal.points?.[me] || 0 : 0;
  const waiting = others.filter((p) => p.status === "joined" && !p.dropped && !answered.includes(p.id)).length;
  const jokerNotes = others.map((p) => ({ p, j: group.jokers?.[p.id] })).filter(({ j }) => j && j.index === q.index);
  useEffect(() => {
    if (!reveal) return;
    if (chosen === reveal.correct) hapticSuccess(); else hapticWarning();
  }, [!!reveal]);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Standings styles={styles} c={c} players={players} me={me} answered={group.phase === "question" ? answered : []} />
      <View style={styles.qHead}>
        <Text style={styles.qNumber}>{`${q.number} / ${group.totalQuestions}`}</Text>
        {group.phase === "question" ? <Seconds deadline={group.deadline} offsetRef={offsetRef} styles={styles} /> : <Text style={styles.seconds}>{" "}</Text>}
      </View>
      {group.phase === "question" ? <Fitil deadline={group.deadline} total={PHASE_TOTAL.question} offsetRef={offsetRef} c={c} /> : <View style={{ height: 14 }} />}
      <Text style={styles.qTag} numberOfLines={1}>{translateUI(LEVEL_LABEL[q.level] || "")} · {q.title}</Text>
      {!!q.golden && <GoldenBanner c={c} />}
      {jokerNotes.length > 0 && (
        <Text style={styles.oppJoker}>{jokerNotes.map(({ p, j }) => `${firstName(p.name)}: ${translateUI(JOKER_META[j.type]?.label || "")}`).join(" · ")}</Text>
      )}
      <Text style={styles.qText}>{q.text}</Text>
      {q.options.map((o, i) => {
        const isMine = chosen === i;
        const isRight = reveal && reveal.correct === i;
        const isWrongMine = reveal && isMine && !isRight;
        const isHidden = hidden.includes(i) && !isRight;
        const pickers = reveal ? others.filter((p) => reveal.choices?.[p.id] === i) : [];
        return (
          <TouchableOpacity
            key={i}
            style={[styles.option, isMine && !reveal && styles.optionMine, isRight && styles.optionRight, isWrongMine && styles.optionWrong, chosen != null && !isMine && !isRight && { opacity: 0.55 }, isHidden && styles.optionHidden]}
            disabled={chosen != null || group.phase !== "question" || isHidden}
            onPress={() => onAnswer(i)}
            activeOpacity={0.85}
            accessibilityLabel={o}
            accessibilityState={{ selected: isMine }}
          >
            <View style={[styles.letter, isMine && !reveal && { backgroundColor: c.accent }, isRight && { backgroundColor: c.accent2 }, isWrongMine && { backgroundColor: c.danger }]}>
              {isRight ? <Check size={13} color="#fff" /> : isWrongMine ? <X size={13} color="#fff" /> : <Text style={[styles.letterText, isMine && { color: SALON.onGold }]}>{LETTERS[i]}</Text>}
            </View>
            <Text style={[styles.optionText, isHidden && styles.optionHiddenText]}>{o}</Text>
            {pickers.length > 0 && (
              <View style={styles.optionStack}>
                {pickers.slice(0, 3).map((p, k) => <RetryImage key={p.id} source={{ uri: avatarOr(p.avatarUrl, p.id) }} style={[styles.stackAvatar, { marginLeft: k ? -8 : 0 }]} />)}
                {pickers.length > 3 && <Text style={styles.stackMore}>+{pickers.length - 3}</Text>}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {group.phase === "question" && (chosen == null || (myJoker && myJoker.index === q.index)) && (
        <JokerTray c={c} mine={myJoker} index={q.index} canUse={chosen == null} onUse={onJoker} />
      )}
      <View accessibilityLiveRegion="polite">
        {reveal ? (
          <Text style={[styles.status, { color: gained ? c.accent : c.dim }]}>{gained ? pointsLine(gained, { golden: q.golden, joker: myJoker?.index === q.index ? myJoker.type : null }) : chosen == null ? translateUI("Süre doldu") : translateUI("Bu soru olmadı")}</Text>
        ) : chosen != null ? (
          <Text style={styles.status}>{waiting > 0 ? translateUI("Cevabın alındı. {0} kişi düşünüyor.", { 0: waiting }) : translateUI("Herkes cevapladı")}</Text>
        ) : null}
      </View>
      {(chosen != null || !!reveal) && <TauntBar c={c} onSend={onTaunt} />}
    </ScrollView>
  );
}

// Sıralama şeridi: puana göre dizilir, cevaplayanın ışığı yanar, düşen soluk görünür.
function Standings({ styles, c, players, me, answered }) {
  const sorted = [...players].sort((a, b) => (a.status === "left") - (b.status === "left") || b.score - a.score);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.standings}>
      {sorted.map((p, i) => (
        <View key={p.id} style={[styles.chip, p.id === me && styles.chipMe, (p.dropped || p.status === "left") && { opacity: 0.45 }]} accessibilityLabel={`${i + 1}. ${p.name}: ${p.score}`}>
          <Text style={[styles.chipRank, i === 0 && { color: c.accent }]}>{i + 1}</Text>
          <View>
            <RetryImage source={{ uri: avatarOr(p.avatarUrl, p.id) }} style={styles.chipAvatar} />
            {answered.includes(p.id) && <View style={styles.chipBulb} />}
          </View>
          <View style={{ maxWidth: 70 }}>
            <Text style={styles.chipName} numberOfLines={1}>{p.id === me ? translateUI("Sen") : firstName(p.name)}</Text>
            <Text style={styles.chipScore}>{p.status === "left" ? translateUI("çıktı") : p.dropped ? translateUI("düştü") : p.score}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Seconds({ deadline, offsetRef, styles }) {
  const left = useRemaining(deadline, offsetRef);
  return <Text style={styles.seconds}>{Math.ceil(left / 1000)}</Text>;
}

// ---------- sonuç: kürsü ----------

function GroupResult({ styles, c, group, me, busy, error, onAgain, onJoinAgain, onShare, onLobby, onTaunt, onPremium }) {
  const r = group.result || {};
  const ranking = r.ranking || [];
  const byId = Object.fromEntries((group.players || []).map((p) => [p.id, p]));
  const mine = ranking.find((x) => x.userId === me);
  const winner = byId[r.winnerId];
  const isHost = group.hostId === me;
  const title = r.winnerId === me ? translateUI("Kazandın")
    : r.winnerId == null ? translateUI("Birincilik paylaşıldı")
    : translateUI("{0} kazandı", { 0: firstName(winner?.name) || translateUI("Bir arkadaşın") });
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(rise, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120 }).start(); if (r.winnerId === me) hapticSuccess(); }, []);
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean).filter((x) => !x.left);
  const heights = { 1: 92, 2: 66, 3: 48 };
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.resultHero}>
        <GoldWash height={190} />
        {r.winnerId === me ? <Trophy size={30} color={c.accent} /> : <Users size={28} color={c.accent} />}
        <Text style={styles.resultTitle}>{title}</Text>
        {!!mine && <Text style={styles.resultSub}>{mine.left ? translateUI("Oyundan çıktın.") : translateUI("{0}. oldun · {1} puan · {2}/8 doğru", { 0: mine.place, 1: mine.score, 2: mine.correct })}</Text>}
        {r.reason === "others_left" && <Text style={styles.resultSub}>{translateUI("Diğer oyuncular çıktığı için oyun erken bitti.")}</Text>}
        <View style={styles.podium}>
          {podium.map((x) => {
            const p = byId[x.userId];
            const h = heights[x.place] || 40;
            return (
              <Animated.View key={x.userId} style={[styles.podiumCol, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [h, 0] }) }] }]}>
                <RetryImage source={{ uri: avatarOr(p?.avatarUrl, x.userId) }} style={[styles.podiumAvatar, x.place === 1 && styles.podiumAvatarFirst]} />
                <Text style={styles.podiumName} numberOfLines={1}>{x.userId === me ? translateUI("Sen") : firstName(p?.name)}</Text>
                <Text style={styles.podiumScore}>{x.score}</Text>
                <View style={[styles.podiumStep, { height: h }, x.place === 1 && { backgroundColor: c.accent }]}>
                  <Text style={[styles.podiumPlace, x.place === 1 && { color: SALON.onGold }]}>{x.place}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </View>
      <TauntBar c={c} onSend={onTaunt} />
      <View style={styles.rankList}>
        {ranking.map((x) => {
          const p = byId[x.userId];
          return (
            <View key={x.userId} style={[styles.rankRow, x.userId === me && styles.rankMe]}>
              <Text style={[styles.rankPlace, x.place === 1 && !x.left && { color: c.accent }]}>{x.left ? "-" : x.place}</Text>
              <RetryImage source={{ uri: avatarOr(p?.avatarUrl, x.userId) }} style={styles.rankAvatar} />
              <Text style={styles.rankName} numberOfLines={1}>{x.userId === me ? translateUI("Sen") : p?.name}</Text>
              <Text style={styles.rankMeta}>{x.left ? translateUI("çıktı") : translateUI("{0}/8", { 0: x.correct })}</Text>
              <Text style={styles.rankScore}>{x.score}</Text>
            </View>
          );
        })}
      </View>
      {error === "limit" ? (
        <TouchableOpacity style={styles.note} onPress={onPremium} activeOpacity={0.85}>
          <Crown size={18} color={c.accent} />
          <Text style={styles.noteText}>{translateUI("Bugünkü 3 düello hakkını kullandın. Premium ile sınırsız düello yapabilirsin.")}</Text>
        </TouchableOpacity>
      ) : !!error && <View style={styles.errorBox}><AlertCircle size={14} color={c.danger} /><Text style={styles.errorText}>{translateUI(error)}</Text></View>}
      {isHost ? (
        <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.5 }]} disabled={busy} onPress={onAgain}>
          {busy ? <ActivityIndicator color={SALON.onGold} /> : <><RotateCcw size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("Aynı grupla tekrar oyna")}</Text></>}
        </TouchableOpacity>
      ) : group.again ? (
        <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.5 }]} disabled={busy} onPress={onJoinAgain}>
          {busy ? <ActivityIndicator color={SALON.onGold} /> : <><RotateCcw size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("{0} yeni oyun kurdu · Katıl", { 0: firstName(byId[group.hostId]?.name) })}</Text></>}
        </TouchableOpacity>
      ) : (
        <Text style={styles.footNote}>{translateUI("Grubu kuran yeni oyun başlatırsa burada katılabilirsin.")}</Text>
      )}
      <TouchableOpacity style={styles.secondaryBtn} onPress={onShare}><Share2 size={15} color={c.text} /><Text style={styles.secondaryText}>{translateUI("Sonucu paylaş")}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.textBtn} onPress={onLobby}><Text style={styles.textBtnText}>{translateUI("Düello sayfasına dön")}</Text></TouchableOpacity>
    </ScrollView>
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

function cancelText(group, me) {
  switch (group.result?.reason) {
    case "lobby_expired": return translateUI("Salon 3 dakika içinde başlatılmadı.");
    case "host_left": return group.hostId === me ? translateUI("Salonu kapattın.") : translateUI("Grubu kuran salonu kapattı.");
    case "all_declined": return translateUI("Çağrılan arkadaşların bu sefer gelemedi.");
    case "no_titles":
    case "no_questions": return translateUI("Bu yapımlar için soru hazırlanamadı. Yeniden dene.");
    case "others_left": return translateUI("Diğer oyuncular çıktığı için oyun başlamadı.");
    default: return translateUI("Oyun başlamadan kapandı. Puan yazılmadı.");
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
    note: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SALON.goldTint, borderWidth: 1, borderColor: SALON.goldLine, borderRadius: 14, padding: 12 },
    noteText: { flex: 1, color: c.text, fontSize: 12, lineHeight: 17 },
    errorBox: { marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: `${c.danger}12`, borderWidth: 1, borderColor: `${c.danger}35`, borderRadius: 12, padding: 10 },
    errorText: { flex: 1, color: c.danger, fontSize: 11, lineHeight: 15 },
    sectionLabel: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 22, marginBottom: 9 },
    friendRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 11, marginBottom: 8 },
    friendRowOn: { borderColor: SALON.goldLine, backgroundColor: SALON.goldTint },
    avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: c.surface2 },
    avatarSm: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    rowTitle: { color: c.text, fontSize: 13.5, fontWeight: "800" },
    checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: c.accent, alignItems: "center", justifyContent: "center" },
    checkboxOn: { backgroundColor: c.accent },
    emptyCard: { alignItems: "center", gap: 8, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 22 },
    emptyText: { color: c.dim, fontSize: 12, lineHeight: 18, textAlign: "center" },
    dock: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(16, insets.bottom + 8), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border },
    callBtn: { minWidth: 72, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    callText: { color: SALON.onGold, fontSize: 12, fontWeight: "900" },

    salonHead: { marginBottom: 6 },
    salonTimer: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 6 },
    screenLine: { marginTop: 14, marginBottom: 16, marginHorizontal: 24, height: 22, borderTopLeftRadius: 60, borderTopRightRadius: 60, borderTopWidth: 2, borderColor: SALON.goldLine, alignItems: "center", justifyContent: "flex-end" },
    screenLineText: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 2 },
    seats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
    seatCell: { width: "31%", alignItems: "center" },
    seatBack: { width: 70, height: 64, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    seatTaken: { borderColor: c.accent, backgroundColor: SALON.goldTint },
    seatWaiting: { borderColor: c.border, borderStyle: "dashed", backgroundColor: c.surface },
    seatGone: { borderColor: c.border, backgroundColor: c.bg, opacity: 0.6 },
    seatEmpty: { borderColor: c.border, borderStyle: "dashed", backgroundColor: "transparent" },
    seatAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.surface2 },
    seatCrown: { position: "absolute", top: -7, width: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    seatLight: { position: "absolute", right: 7, top: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: "#ffe7a8", shadowColor: c.accent, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
    seatCushion: { width: 78, height: 7, borderRadius: 4, backgroundColor: c.surface2, marginTop: 3 },
    seatName: { color: c.text, fontSize: 12, fontWeight: "800", marginTop: 6, maxWidth: "100%" },
    seatState: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 0.6, marginTop: 1 },
    waitBox: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14 },
    waitText: { flex: 1, color: c.text, fontSize: 12.5, lineHeight: 18 },

    stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: safeBottom },
    stageTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 28, lineHeight: 31, textAlign: "center", marginTop: 16 },
    stageText: { color: c.dim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 6 },
    bigIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    fitilWrap: { alignSelf: "stretch", marginTop: 14, marginBottom: 4 },
    primaryBtn: { alignSelf: "stretch", minHeight: 48, marginTop: 14, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12 },
    primaryText: { color: SALON.onGold, fontSize: 13, fontWeight: "900" },
    secondaryBtn: { alignSelf: "stretch", minHeight: 46, marginTop: 10, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    secondaryText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    textBtn: { alignSelf: "center", padding: 14 },
    textBtnText: { color: c.dim, fontSize: 12, fontWeight: "700" },
    footNote: { color: c.dim, fontSize: 10.5, lineHeight: 15, textAlign: "center", marginTop: 10 },

    turnTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24, marginTop: 2 },
    pickers: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
    picker: { alignItems: "center", width: 48 },
    pickerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2 },
    pickerCheck: { position: "absolute", top: -2, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.bg },
    pickerName: { color: c.dim, fontSize: 10, fontWeight: "700", marginTop: 3, maxWidth: 48 },
    pickHint: { color: c.dim, fontSize: 11, lineHeight: 16, marginTop: 10, marginBottom: 12 },
    ticket: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 9, overflow: "hidden" },
    ticketPicked: { borderColor: c.accent, backgroundColor: SALON.goldTint },
    ticketPoster: { width: 46, height: 68, borderRadius: 8, backgroundColor: c.surface2 },
    ticketPerf: { width: 0, height: 60, borderLeftWidth: 1.5, borderStyle: "dashed", borderColor: c.border },
    ticketKind: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1, marginBottom: 3 },
    ticketTitle: { color: c.text, fontSize: 14, fontWeight: "800" },
    ticketPickers: { flexDirection: "row", alignItems: "center", marginTop: 6 },
    ticketPickedBy: { color: c.accent, fontSize: 10.5, fontWeight: "800", marginLeft: 6, flexShrink: 1 },
    stackAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: c.bg, backgroundColor: c.surface2 },
    stackMore: { color: c.dim, fontSize: 10, fontWeight: "800", marginLeft: 3 },

    curtain: { borderRadius: 20, padding: 22, paddingTop: 30, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    drapes: { position: "absolute", top: 0, left: 0, right: 0, height: 18, flexDirection: "row", justifyContent: "space-between" },
    drapeL: { width: "38%", height: 18, backgroundColor: "#6e2024", borderBottomRightRadius: 18 },
    drapeR: { width: "38%", height: 18, backgroundColor: "#6e2024", borderBottomLeftRadius: 18 },
    curtainTickets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
    miniTicket: { flexGrow: 1, flexBasis: "45%", borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: SALON.goldLine, padding: 10, backgroundColor: c.bg },
    miniTicketTitle: { color: c.text, fontSize: 13, fontWeight: "800" },
    readyLine: { color: c.dim, fontSize: 11.5, textAlign: "center", marginTop: 6 },

    standings: { gap: 8, paddingBottom: 4 },
    chip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 5, paddingLeft: 8, paddingRight: 12 },
    chipMe: { borderColor: SALON.goldLine, backgroundColor: SALON.goldTint },
    chipRank: { color: c.dim, fontFamily: FONTS.marquee, fontSize: 15, minWidth: 10, textAlign: "center" },
    chipAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface2 },
    chipBulb: { position: "absolute", right: -2, top: -2, width: 11, height: 11, borderRadius: 6, backgroundColor: "#ffe7a8", borderWidth: 2, borderColor: c.bg },
    chipName: { color: c.dim, fontSize: 10, fontWeight: "700" },
    chipScore: { color: c.text, fontFamily: FONTS.marquee, fontSize: 16, lineHeight: 18 },
    qHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
    seconds: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26, minWidth: 34, textAlign: "right" },
    qNumber: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1 },
    qTag: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1, marginTop: 10 },
    qText: { color: c.text, fontSize: 19, fontWeight: "800", lineHeight: 26, marginTop: 8, marginBottom: 16 },
    option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9 },
    optionMine: { borderColor: c.accent, backgroundColor: SALON.goldTint },
    optionRight: { borderColor: c.accent2, backgroundColor: `${c.accent2}1f` },
    optionWrong: { borderColor: c.danger, backgroundColor: `${c.danger}14` },
    optionHidden: { opacity: 0.22 },
    optionHiddenText: { textDecorationLine: "line-through" },
    optionStack: { flexDirection: "row", alignItems: "center" },
    letter: { width: 28, height: 28, borderRadius: 8, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    letterText: { color: c.text, fontFamily: FONTS.monoMedium, fontSize: 12 },
    optionText: { flex: 1, color: c.text, fontSize: 14, fontWeight: "700", lineHeight: 19 },
    oppJoker: { color: c.accent, fontSize: 11.5, fontWeight: "700", marginTop: 8 },
    status: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 8, fontWeight: "700" },

    resultHero: { borderRadius: 18, padding: 22, paddingBottom: 0, alignItems: "center", overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: SALON.goldLine },
    resultTitle: { color: c.text, fontFamily: FONTS.marquee, fontSize: 34, lineHeight: 37, marginTop: 8, textAlign: "center" },
    resultSub: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 4, lineHeight: 17 },
    podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8, marginTop: 18, alignSelf: "stretch" },
    podiumCol: { flex: 1, maxWidth: 104, alignItems: "center" },
    podiumAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface2, borderWidth: 2, borderColor: c.border },
    podiumAvatarFirst: { width: 52, height: 52, borderRadius: 26, borderColor: c.accent },
    podiumName: { color: c.text, fontSize: 11.5, fontWeight: "800", marginTop: 5, maxWidth: "100%" },
    podiumScore: { color: c.accent, fontFamily: FONTS.marquee, fontSize: 18, marginBottom: 5 },
    podiumStep: { alignSelf: "stretch", borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: c.surface2, alignItems: "center", paddingTop: 6 },
    podiumPlace: { color: c.text, fontFamily: FONTS.marquee, fontSize: 24 },
    rankList: { marginTop: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 8 },
    rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
    rankMe: { backgroundColor: SALON.goldTint },
    rankPlace: { width: 20, color: c.dim, fontFamily: FONTS.marquee, fontSize: 18, textAlign: "center" },
    rankAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surface2 },
    rankName: { flex: 1, color: c.text, fontSize: 13, fontWeight: "800" },
    rankMeta: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10 },
    rankScore: { minWidth: 52, textAlign: "right", color: c.text, fontFamily: FONTS.marquee, fontSize: 19 },
  });
}
