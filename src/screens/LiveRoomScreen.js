import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { ChevronLeft, Send, Share2, User, Trash2, VolumeX, LogOut, Copy, ChevronRight } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api, generateMessageClientId } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { timeLabel } from "../utils/chatTimeLabels";
import { hapticLight, hapticSelection } from "../utils/haptics";
import { FONTS, upperTR } from "../theme/fonts";
import RetryImage from "../components/RetryImage";
import ShareFan, { shareOptions } from "../components/salon/ShareFan";
import LiveDot from "../components/salon/LiveDot";
import SendToFriendModal from "../components/SendToFriendModal";

// Canlı sohbet odası: bir bölüm yayındayken herkesin aynı odada konuştuğu, admin panelinden açılıp
// kapatılan geçici sohbet. Mesajlar REST ile gidiyor, canlı akış /ws üzerinden: ekran açılınca
// "room_join" ile odaya katılıyor, her yeniden bağlanmada (ws_ready) tekrar katılıp kaçırdıklarını
// "after" ile çekiyor. Satırlar balon değil, akan bir sohbet listesi (çok kişili oda okunaklı olsun).
//
// Gönderim birebir sohbetteki gibi bekletmesiz: mesaj yazıldığı an listeye geçici satır olarak
// ekleniyor, istek arkadan sırayla gidiyor; sunucudan (REST ya da WS) gelen gerçek mesaj aynı
// clientId ile geçici satırın yerine oturuyor. Yavaş mod (429) istenen süre kadar bekleyip tekrar
// deniyor, kullanıcıya hata göstermiyor.

const MAX_LEN = 300;
const DEFAULT_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏", "👍", "😡"];
const MUTE_OPTIONS = [
  { label: "10 dakika", minutes: 10 },
  { label: "1 saat", minutes: 60 },
  { label: "Oda kapanana kadar", minutes: null },
];

function roomLabel(room) {
  if (!room) return "";
  return room.episodeLabel ? `${room.title} · ${room.episodeLabel}` : room.title;
}

function whenLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function restrictionText(r) {
  if (!r) return null;
  if (r.message) return r.message;
  if (r.kind === "kick") return "Bu odadan çıkarıldın.";
  if (r.kind === "mute") {
    if (!r.until) return "Moderatör seni bu oda boyunca susturdu.";
    const time = new Date(r.until).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    return `Moderatör seni susturdu, ${time}'e kadar yazamazsın.`;
  }
  return "Bu odada mesaj yazman engellendi.";
}

// Tepkiyi ekranda hemen uygulamak için: aynı emoji kaldırır, başka emoji değiştirir.
function withReaction(m, emoji) {
  let reactions = (m.reactions || []).map((r) => ({ ...r }));
  const bump = (e, d) => {
    const r = reactions.find((x) => x.emoji === e);
    if (r) r.count += d; else if (d > 0) reactions.push({ emoji: e, count: 1 });
  };
  let mine = emoji;
  if (m.myReaction === emoji) { bump(emoji, -1); mine = null; } else {
    if (m.myReaction) bump(m.myReaction, -1);
    bump(emoji, 1);
  }
  reactions = reactions.filter((r) => r.count > 0);
  return { ...m, reactions, myReaction: mine };
}

const rowKey = (m) => (m.clientId ? `${m.user.id}:${m.clientId}` : String(m.id));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function LiveRoomScreen({ route, navigation }) {
  const code = route.params?.code;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const ws = useWS();
  // WSContext her render'da yeni fonksiyonlar veriyor; odaya katılma etkisinin bunlar yüzünden
  // tekrar çalışıp odadan çıkıp girmemesi için en güncelini ref'te tutuyoruz.
  const wsRef = useRef(ws);
  wsRef.current = ws;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [room, setRoom] = useState(null);
  const [movie, setMovie] = useState(null);
  const [isModerator, setIsModerator] = useState(false);
  const [restriction, setRestriction] = useState(null); // { kind: ban|mute|kick, until, message }
  const [kicked, setKicked] = useState(false);
  const [reactionSet, setReactionSet] = useState(DEFAULT_REACTIONS);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState(null); // { text, tone: "error" | "info" }
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [myAvatar, setMyAvatar] = useState(null);
  const [sheet, setSheet] = useState(null); // uzun basılan mesaj
  const [sheetStep, setSheetStep] = useState(null); // null | "mute" | "kick"

  const roomIdRef = useRef(null);
  const lastIdRef = useRef(0);
  const noticeTimer = useRef(null);
  const sendQueue = useRef(Promise.resolve());

  const showNotice = useCallback((msg, tone = "error") => {
    setNotice(msg ? { text: msg, tone } : null);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    api.me(auth.token).then((me) => setMyAvatar(me.avatarUrl || null)).catch(() => {});
  }, [auth.token]);

  const applyRestriction = useCallback((r) => {
    const next = r && r.kind ? r : null;
    setRestriction(next);
    if (next?.kind === "kick") setKicked(true);
  }, []);

  // Süreli susturma bitince yazma alanı kendiliğinden geri açılıyor.
  useEffect(() => {
    if (restriction?.kind !== "mute" || !restriction.until) return undefined;
    const ms = new Date(restriction.until).getTime() - Date.now();
    const id = setTimeout(() => setRestriction(null), Math.max(0, ms) + 500);
    return () => clearTimeout(id);
  }, [restriction]);

  // Gelen mesajları ekliyor; sunucudan dönen kendi mesajım, aynı clientId'li geçici satırın yerine geçiyor.
  const mergeMessages = useCallback((incoming, { prepend = false } = {}) => {
    if (!incoming?.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      let next = prev;
      const fresh = [];
      incoming.forEach((m) => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        const tempIndex = m.clientId ? next.findIndex((x) => x.pending !== undefined && x.clientId === m.clientId && Number(x.user.id) === Number(m.user.id)) : -1;
        if (tempIndex >= 0) {
          next = next === prev ? [...prev] : next;
          next[tempIndex] = m;
        } else {
          fresh.push(m);
        }
      });
      if (!fresh.length) return next;
      next = prepend ? [...fresh, ...next] : [...next, ...fresh];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
    const maxId = incoming.reduce((acc, m) => (typeof m.id === "number" ? Math.max(acc, m.id) : acc), 0);
    if (maxId > lastIdRef.current) lastIdRef.current = maxId;
  }, []);

  const load = useCallback(async () => {
    if (!code) return;
    try {
      const [infoResult, listResult] = await Promise.allSettled([
        api.liveRoom(auth.token, code),
        api.liveRoomMessages(auth.token, code),
      ]);
      if (infoResult.status === "rejected") throw infoResult.reason;
      const info = infoResult.value;
      const r = info.restriction || (info.banned ? { kind: "ban" } : null);
      setRoom(info.room);
      setMovie(info.movie || null);
      setIsModerator(!!info.isModerator);
      if (Array.isArray(info.reactions) && info.reactions.length) setReactionSet(info.reactions);
      applyRestriction(r);
      setParticipants(info.room?.participants || 0);
      roomIdRef.current = info.room?.id || null;
      if (listResult.status === "fulfilled") {
        const list = listResult.value.messages || [];
        setMessages((prev) => prev.filter((m) => m.pending !== undefined));
        lastIdRef.current = 0;
        mergeMessages(list);
        setHasOlder(list.length >= 60);
      } else if (r?.kind !== "kick") {
        throw listResult.reason;
      }
      setLoadError(null);
    } catch (e) {
      setLoadError(e.status === 404 ? "Bu sohbet odası bulunamadı." : e.message || "Oda açılamadı.");
    } finally {
      setLoading(false);
    }
  }, [auth.token, code, mergeMessages, applyRestriction]);

  useEffect(() => { load(); }, [load]);

  const catchUpRef = useRef(null);
  const catchUp = useCallback(async () => {
    if (!code || !lastIdRef.current) return;
    try {
      const data = await api.liveRoomMessages(auth.token, code, { after: lastIdRef.current });
      mergeMessages(data.messages || []);
    } catch { /* bir sonraki bağlantıda tekrar denenir */ }
  }, [auth.token, code, mergeMessages]);
  catchUpRef.current = catchUp;

  // Canlı bağlantı: odaya katıl, yayınları dinle, çıkarken odadan ayrıl.
  useEffect(() => {
    if (!code || kicked) return undefined;
    const send = (payload) => wsRef.current?.send(payload);
    send({ type: "room_join", code });
    const unsub = wsRef.current.subscribe((msg) => {
      if (msg.type === "ws_ready") {
        send({ type: "room_join", code });
        catchUpRef.current?.();
        return;
      }
      if (msg.type === "room_kicked" && (msg.code === code || msg.roomId === roomIdRef.current)) { setKicked(true); return; }
      if (msg.roomId == null || (roomIdRef.current && msg.roomId !== roomIdRef.current)) return;
      if (msg.type === "room_joined" || msg.type === "room_presence") setParticipants(msg.count || 0);
      else if (msg.type === "room_message") mergeMessages([msg.message]);
      else if (msg.type === "room_message_deleted") setMessages((prev) => prev.filter((m) => m.id !== msg.messageId));
      else if (msg.type === "room_status") setRoom((prev) => (prev ? { ...prev, status: msg.status } : prev));
      else if (msg.type === "room_banned") setRestriction((prev) => prev || { kind: "ban" });
      else if (msg.type === "room_restricted") applyRestriction(msg.kind ? { kind: msg.kind, until: msg.until } : null);
      else if (msg.type === "room_reaction") {
        const mineChanged = Number(msg.userId) === Number(auth.id);
        setMessages((prev) => prev.map((m) => (m.id === msg.messageId
          ? { ...m, reactions: msg.reactions, ...(mineChanged ? { myReaction: msg.emoji } : null) }
          : m)));
      }
    });
    return () => {
      unsub();
      send({ type: "room_leave" });
    };
  }, [code, kicked, mergeMessages, applyRestriction, auth.id]);

  async function loadOlder() {
    const firstReal = messages.find((m) => typeof m.id === "number");
    if (loadingOlder || !hasOlder || !firstReal) return;
    setLoadingOlder(true);
    try {
      const data = await api.liveRoomMessages(auth.token, code, { before: firstReal.id });
      const older = data.messages || [];
      mergeMessages(older, { prepend: true });
      setHasOlder(older.length >= 60);
    } catch { /* sessiz: kullanıcı tekrar kaydırınca yeniden denenir */ }
    setLoadingOlder(false);
  }

  const patchTemp = useCallback((clientId, patch) => {
    setMessages((prev) => prev.map((m) => (m.pending !== undefined && m.clientId === clientId ? { ...m, ...patch } : m)));
  }, []);
  const dropTemp = useCallback((clientId) => {
    setMessages((prev) => prev.filter((m) => !(m.pending !== undefined && m.clientId === clientId)));
  }, []);

  const deliver = useCallback(async (temp) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const data = await api.sendLiveRoomMessage(auth.token, code, temp.body, temp.clientId);
        const real = { ...data.message, clientId: data.message.clientId || temp.clientId };
        mergeMessages([real]);
        // WS yayını gerçek mesajı daha önce eklediyse geçici satır kalmasın.
        setMessages((prev) => (prev.some((m) => m.id === real.id)
          ? prev.filter((m) => !(m.pending !== undefined && m.clientId === temp.clientId))
          : prev));
        return;
      } catch (e) {
        if (e.status === 429) { await wait(e.data?.retryAfterMs || 1000); continue; }
        if (e.status === 403) {
          dropTemp(temp.clientId);
          applyRestriction(e.data?.restriction || { kind: "ban", message: e.message });
          showNotice(e.message);
          return;
        }
        if (e.status === 409) { dropTemp(temp.clientId); showNotice(e.message); load(); return; }
        break;
      }
    }
    patchTemp(temp.clientId, { pending: false, failed: true });
  }, [auth.token, code, mergeMessages, dropTemp, patchTemp, applyRestriction, showNotice, load]);

  function enqueue(temp) {
    sendQueue.current = sendQueue.current.then(() => deliver(temp)).catch(() => {});
  }

  function sendMessage() {
    const body = text.replace(/\s+/g, " ").trim();
    if (!body || restriction || room?.status !== "live") return;
    const clientId = generateMessageClientId();
    const temp = {
      id: `tmp-${clientId}`,
      clientId,
      pending: true,
      failed: false,
      body,
      createdAt: new Date().toISOString(),
      reactions: [],
      myReaction: null,
      user: { id: auth.id, name: auth.name, avatarUrl: myAvatar, isModerator },
    };
    setText("");
    hapticLight();
    setMessages((prev) => [...prev, temp]);
    enqueue(temp);
  }

  function retry(m) {
    patchTemp(m.clientId, { pending: true, failed: false });
    enqueue(m);
  }

  async function react(message, emoji) {
    if (typeof message.id !== "number" || restriction || room?.status !== "live") return;
    hapticSelection();
    const before = message;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? withReaction(m, emoji) : m)));
    try {
      const data = await api.reactToLiveRoomMessage(auth.token, code, message.id, emoji);
      setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions, myReaction: data.myReaction } : m)));
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === before.id ? { ...m, reactions: before.reactions, myReaction: before.myReaction } : m)));
      if (e.status === 403) applyRestriction(e.data?.restriction || restriction);
      showNotice(e.message || "Tepki bırakılamadı.");
    }
  }

  function openSheet(message) {
    if (message.pending !== undefined) return;
    hapticSelection();
    setSheetStep(null);
    setSheet(message);
  }
  const closeSheet = () => { setSheet(null); setSheetStep(null); };

  async function deleteMessage(message) {
    closeSheet();
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    try {
      await api.deleteLiveRoomMessage(auth.token, code, message.id);
    } catch (e) {
      mergeMessages([message]);
      showNotice(e.message);
    }
  }

  async function restrict(user, kind, minutes) {
    closeSheet();
    try {
      await api.restrictInLiveRoom(auth.token, code, user.id, { kind, minutes });
      if (kind === "kick") {
        setMessages((prev) => prev.filter((m) => Number(m.user.id) !== Number(user.id)));
        showNotice(`${user.name} odadan atıldı.`, "info");
      } else {
        const span = minutes ? (minutes >= 60 ? `${minutes / 60} saat` : `${minutes} dakika`) : "bu oda boyunca";
        showNotice(`${user.name} ${span} susturuldu.`, "info");
      }
    } catch (e) { showNotice(e.message); }
  }

  // Paylaş düğmesi Yelpaze: Arkadaşına (uygulama içi sohbete link), WhatsApp, Kopyala, Diğer.
  const shareFanOptions = room ? shareOptions({
    message: `${roomLabel(room)} canlı sohbet odası: ${room.link}`,
    url: room.link,
    sendToFriend: () => setSendOpen(true),
  }) : [];

  const status = room?.status;
  const canInteract = status === "live" && !restriction;
  const listData = useMemo(() => [...messages].reverse(), [messages]);

  // Satırlar memo'lu; dokunuşlar en güncel işleyicilere ref üzerinden gidiyor.
  const handlers = useRef({});
  handlers.current = { react, openSheet, retry };

  const renderItem = useCallback(({ item }) => {
    const own = Number(item.user.id) === Number(auth.id);
    const pending = item.pending === true;
    const failed = item.failed === true;
    return (
      <TouchableOpacity
        style={styles.msgRow}
        activeOpacity={0.7}
        onPress={failed ? () => handlers.current.retry(item) : undefined}
        onLongPress={() => handlers.current.openSheet(item)}
        delayLongPress={300}
        accessibilityLabel={`${own ? "Sen" : item.user.name}: ${item.body}`}
        accessibilityHint={failed ? "Tekrar göndermek için dokun" : "Tepki ve seçenekler için basılı tut"}
      >
        <RetryImage source={{ uri: avatarOr(item.user.avatarUrl, item.user.id) }} style={styles.avatar} />
        <View style={styles.msgBody}>
          <View style={styles.msgHead}>
            <Text style={[styles.msgName, own && { color: c.accent }]} numberOfLines={1}>{own ? "Sen" : item.user.name}</Text>
            {item.user.isModerator && <Text style={styles.modBadge}>MODERATÖR</Text>}
            <Text style={[styles.msgTime, failed && { color: c.danger }]}>
              {failed ? "GÖNDERİLEMEDİ" : pending ? "·  ·  ·" : timeLabel(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.msgText, failed && { opacity: 0.6 }]}>{item.body}</Text>
          {failed && <Text style={styles.failedHint}>Tekrar göndermek için dokun</Text>}
          {item.reactions?.length > 0 && (
            <View style={styles.reactRow}>
              {item.reactions.map((r) => {
                const mine = item.myReaction === r.emoji;
                return (
                  <TouchableOpacity
                    key={r.emoji}
                    style={[styles.reactChip, mine && styles.reactChipMine]}
                    onPress={() => handlers.current.react(item, r.emoji)}
                    disabled={!canInteract}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.emoji} ${r.count}${mine ? ", senin tepkin" : ""}`}
                    hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                  >
                    <Text style={styles.reactEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactCount, mine && { color: c.accent }]}>{r.count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [auth.id, styles, c.accent, c.danger, canInteract]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (kicked || loadError || !room) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Geri">
          <ChevronLeft size={22} color={c.text} />
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{kicked ? "Bu odadan çıkarıldın" : loadError || "Bu sohbet odası bulunamadı."}</Text>
          <Text style={styles.emptyText}>
            {kicked ? "Bir moderatör seni bu odadan çıkardı. Bu odaya tekrar giremezsin." : "Link hatalı ya da oda silinmiş olabilir."}
          </Text>
        </View>
      </View>
    );
  }

  const when = whenLabel(room.startsAt);
  const sheetOwn = sheet && Number(sheet.user.id) === Number(auth.id);
  const sheetCanModerate = sheet && isModerator && !sheetOwn && !sheet.user.isModerator;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Geri">
          <ChevronLeft size={22} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerMain}
          activeOpacity={movie ? 0.8 : 1}
          onPress={() => movie && navigation.navigate("Detail", { movie })}
          accessibilityRole={movie ? "button" : undefined}
          accessibilityLabel={movie ? `${room.title} detayını aç` : room.title}
        >
          {!!room.poster && <Image source={{ uri: room.poster }} style={styles.poster} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>{room.title}</Text>
            <View style={styles.metaRow}>
              {status === "live" && <LiveDot color={c.danger} />}
              <Text style={[styles.meta, status === "live" && { color: c.danger }]} numberOfLines={1}>
                {status === "live"
                  ? `CANLI · ${participants} KİŞİ`
                  : status === "scheduled" ? "PLANLANDI" : "KAPANDI"}
                {room.episodeLabel ? `  ·  ${upperTR(room.episodeLabel)}` : ""}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <ShareFan style={styles.iconBtn} options={shareFanOptions} accessibilityLabel="Odanın linkini paylaş">
          <Share2 size={18} color={c.text} />
        </ShareFan>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={listData}
        inverted
        keyExtractor={rowKey}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={loadingOlder ? <ActivityIndicator color={c.dim} style={{ marginVertical: 12 }} /> : null}
        ListEmptyComponent={(
          <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
            <Text style={styles.emptyTitle}>
              {status === "live" ? "Oda açık, ilk mesajı sen yaz." : status === "scheduled" ? "Oda yayın saatinde açılacak." : "Bu odada mesaj kalmadı."}
            </Text>
            <Text style={styles.emptyText}>
              {status === "scheduled"
                ? (when ? `${when} itibarıyla burada birlikte izleyip konuşacağız.` : "Açıldığında burada birlikte izleyip konuşacağız.")
                : "Bölümü izlerken aklından geçeni yaz. Spoiler'a dikkat, herkes aynı yerde olmayabilir."}
            </Text>
          </View>
        )}
      />

      {!!notice && <Text style={[styles.notice, notice.tone === "info" && { color: c.dim }]} accessibilityLiveRegion="polite">{notice.text}</Text>}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {status === "live" && !restriction ? (
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
              placeholder="Odaya yaz"
              placeholderTextColor={c.dim}
              multiline
              maxLength={MAX_LEN}
              accessibilityLabel="Mesaj"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && { opacity: 0.45 }]}
              onPress={sendMessage}
              disabled={!text.trim()}
              accessibilityRole="button"
              accessibilityLabel="Gönder"
            >
              <Send size={18} color="#1a140b" />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.closedNote}>
            {restriction
              ? restrictionText(restriction)
              : status === "scheduled"
                ? (when ? `Oda ${when}'de açılıyor.` : "Oda yayın saatinde açılıyor.")
                : "Bu oda kapandı. Mesajları okuyabilirsin."}
          </Text>
        )}
      </View>

      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={closeSheet} statusBarTranslucent>
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet} accessibilityLabel="Kapat" />
        {!!sheet && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetName} numberOfLines={1}>{sheetOwn ? "Senin mesajın" : sheet.user.name}</Text>
            <Text style={styles.sheetPreview} numberOfLines={2}>{sheet.body}</Text>

            {canInteract && sheetStep === null && (
              <View style={styles.emojiRow} accessibilityRole="toolbar">
                {reactionSet.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiBtn, sheet.myReaction === e && styles.emojiBtnMine]}
                    onPress={() => { const m = sheet; closeSheet(); react(m, e); }}
                    accessibilityRole="button"
                    accessibilityLabel={sheet.myReaction === e ? `${e} tepkini kaldır` : `${e} tepkisi bırak`}
                  >
                    <Text style={styles.emojiBig}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {sheetStep === null && (
              <View>
                {!sheetOwn && (
                  <SheetRow icon={User} label="Profili gör" c={c} styles={styles}
                    onPress={() => { const u = sheet.user; closeSheet(); navigation.navigate("OtherProfile", { userId: u.id }); }} />
                )}
                <SheetRow icon={Copy} label="Metni kopyala" c={c} styles={styles}
                  onPress={() => { Clipboard.setStringAsync(sheet.body).catch(() => {}); closeSheet(); showNotice("Mesaj kopyalandı.", "info"); }} />
                {(sheetOwn || isModerator) && (
                  <SheetRow icon={Trash2} label="Mesajı sil" danger c={c} styles={styles} onPress={() => deleteMessage(sheet)} />
                )}
                {sheetCanModerate && (
                  <>
                    <SheetRow icon={VolumeX} label="Sustur" more c={c} styles={styles} onPress={() => setSheetStep("mute")} />
                    <SheetRow icon={LogOut} label="Odadan at" danger more c={c} styles={styles} onPress={() => setSheetStep("kick")} />
                  </>
                )}
              </View>
            )}

            {sheetStep === "mute" && (
              <View>
                <Text style={styles.sheetQuestion}>{sheet.user.name} ne kadar yazamasın? Okumaya devam eder.</Text>
                {MUTE_OPTIONS.map((o) => (
                  <SheetRow key={o.label} label={o.label} c={c} styles={styles} onPress={() => restrict(sheet.user, "mute", o.minutes)} />
                ))}
                <SheetRow label="Geri" muted c={c} styles={styles} onPress={() => setSheetStep(null)} />
              </View>
            )}

            {sheetStep === "kick" && (
              <View>
                <Text style={styles.sheetQuestion}>
                  {sheet.user.name} odadan atılsın mı? Bu odaya tekrar giremez, yazamaz; mesajları da kaldırılır.
                </Text>
                <SheetRow icon={LogOut} label="Odadan at" danger c={c} styles={styles} onPress={() => restrict(sheet.user, "kick")} />
                <SheetRow label="Geri" muted c={c} styles={styles} onPress={() => setSheetStep(null)} />
              </View>
            )}
          </View>
        )}
      </Modal>

      {sendOpen && room && (
        <SendToFriendModal
          text={{
            title: room.title,
            meta: room.episodeLabel ? `${room.episodeLabel} · canlı sohbet odası` : "Canlı sohbet odası",
            poster: room.poster,
            body: `${roomLabel(room)} canlı sohbet odasına gel: ${room.link}`,
          }}
          onClose={() => setSendOpen(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function SheetRow({ icon: Icon, label, onPress, danger, muted, more, c, styles }) {
  const color = danger ? c.danger : muted ? c.dim : c.text;
  return (
    <TouchableOpacity style={styles.sheetRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {Icon ? <Icon size={18} color={color} /> : <View style={{ width: 18 }} />}
      <Text style={[styles.sheetRowText, { color }]}>{label}</Text>
      {more && <ChevronRight size={16} color={c.dim} />}
    </TouchableOpacity>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
    header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    headerMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
    poster: { width: 34, height: 51, borderRadius: 4, backgroundColor: c.surface2 },
    title: { color: c.text, fontSize: 24, fontFamily: FONTS.marquee },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
    meta: { color: c.dim, fontSize: 10.5, fontFamily: FONTS.monoMedium, letterSpacing: 0.8, flexShrink: 1 },
    listContent: { paddingVertical: 10 },
    msgRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 7 },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface2, marginTop: 2 },
    msgBody: { flex: 1, minWidth: 0 },
    msgHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    msgName: { color: c.text, fontSize: 13, fontWeight: "700", flexShrink: 1 },
    modBadge: { color: c.accent, fontSize: 9.5, fontFamily: FONTS.monoMedium, letterSpacing: 0.8 },
    msgTime: { color: c.dim, fontSize: 10.5, fontFamily: FONTS.mono, marginLeft: "auto" },
    msgText: { color: c.text, fontSize: 14.5, lineHeight: 20, marginTop: 2 },
    failedHint: { color: c.danger, fontSize: 11.5, marginTop: 2 },
    reactRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    reactChip: {
      flexDirection: "row", alignItems: "center", gap: 4, minHeight: 28, paddingHorizontal: 8, borderRadius: 999,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    reactChipMine: { borderColor: c.accent },
    reactEmoji: { fontSize: 14 },
    reactCount: { color: c.dim, fontSize: 11.5, fontFamily: FONTS.monoMedium },
    empty: { paddingHorizontal: 32, paddingVertical: 40, alignItems: "center" },
    emptyTitle: { color: c.text, fontSize: 22, fontFamily: FONTS.marquee, textAlign: "center" },
    emptyText: { color: c.dim, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
    notice: { color: c.danger, fontSize: 12.5, textAlign: "center", paddingHorizontal: 16, paddingBottom: 6 },
    footer: { borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 12, paddingTop: 10, backgroundColor: c.bg },
    composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    input: {
      flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
      color: c.text, fontSize: 15, paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 12 : 8, paddingBottom: Platform.OS === "ios" ? 12 : 8,
    },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    closedNote: { color: c.dim, fontSize: 13, textAlign: "center", paddingVertical: 12, paddingHorizontal: 12 },
    sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,6,10,0.55)" },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8,
    },
    sheetHandle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 10 },
    sheetName: { color: c.text, fontSize: 20, fontFamily: FONTS.marquee },
    sheetPreview: { color: c.dim, fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: 10 },
    sheetQuestion: { color: c.text, fontSize: 13.5, lineHeight: 19, marginBottom: 4 },
    emojiRow: { flexDirection: "row", gap: 2, paddingVertical: 8, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: c.border },
    emojiBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    emojiBtnMine: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.accent },
    emojiBig: { fontSize: 24 },
    sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
    sheetRowText: { flex: 1, fontSize: 15, fontWeight: "600" },
  });
}
