import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Animated, AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Send, Share2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { timeLabel } from "../utils/chatTimeLabels";
import { hapticLight, hapticSelection } from "../utils/haptics";
import { FONTS, upperTR } from "../theme/fonts";
import RetryImage from "../components/RetryImage";
import ShareFan, { shareOptions } from "../components/salon/ShareFan";
import SendToFriendModal from "../components/SendToFriendModal";

// Canlı sohbet odası: bir bölüm yayındayken herkesin aynı odada konuştuğu, admin panelinden açılıp
// kapatılan geçici sohbet. Mesajlar REST ile gidiyor, canlı akış /ws üzerinden: ekran açılınca
// "room_join" ile odaya katılıyor, her yeniden bağlanmada (ws_ready) tekrar katılıp kaçırdıklarını
// "after" ile çekiyor. Satırlar balon değil, akan bir sohbet listesi (çok kişili oda okunaklı olsun).

const MAX_LEN = 300;

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

function LiveDot({ color }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
    }).catch(() => {});
    return () => loop?.stop();
  }, [opacity]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity }} />;
}

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
  const [banned, setBanned] = useState(false);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);

  const roomIdRef = useRef(null);
  const lastIdRef = useRef(0);
  const noticeTimer = useRef(null);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const mergeMessages = useCallback((incoming, { prepend = false } = {}) => {
    if (!incoming?.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      const next = prepend ? [...fresh, ...prev] : [...prev, ...fresh];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
    const maxId = incoming.reduce((acc, m) => Math.max(acc, m.id), 0);
    if (maxId > lastIdRef.current) lastIdRef.current = maxId;
  }, []);

  const load = useCallback(async () => {
    if (!code) return;
    try {
      const [info, list] = await Promise.all([api.liveRoom(auth.token, code), api.liveRoomMessages(auth.token, code)]);
      setRoom(info.room);
      setMovie(info.movie || null);
      setIsModerator(!!info.isModerator);
      setBanned(!!info.banned);
      setParticipants(info.room?.participants || 0);
      roomIdRef.current = info.room?.id || null;
      setMessages([]);
      lastIdRef.current = 0;
      mergeMessages(list.messages || []);
      setHasOlder((list.messages || []).length >= 60);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.status === 404 ? "Bu sohbet odası bulunamadı." : e.message || "Oda açılamadı.");
    } finally {
      setLoading(false);
    }
  }, [auth.token, code, mergeMessages]);

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
    if (!code) return undefined;
    const send = (payload) => wsRef.current?.send(payload);
    send({ type: "room_join", code });
    const unsub = wsRef.current.subscribe((msg) => {
      if (msg.type === "ws_ready") {
        send({ type: "room_join", code });
        catchUpRef.current?.();
        return;
      }
      if (msg.roomId == null || (roomIdRef.current && msg.roomId !== roomIdRef.current)) return;
      if (msg.type === "room_joined" || msg.type === "room_presence") setParticipants(msg.count || 0);
      else if (msg.type === "room_message") mergeMessages([msg.message]);
      else if (msg.type === "room_message_deleted") setMessages((prev) => prev.filter((m) => m.id !== msg.messageId));
      else if (msg.type === "room_status") setRoom((prev) => (prev ? { ...prev, status: msg.status } : prev));
      else if (msg.type === "room_banned") { setBanned(true); setText(""); }
    });
    return () => {
      unsub();
      send({ type: "room_leave" });
    };
  }, [code, mergeMessages]);

  async function loadOlder() {
    if (loadingOlder || !hasOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const data = await api.liveRoomMessages(auth.token, code, { before: messages[0].id });
      const older = data.messages || [];
      mergeMessages(older, { prepend: true });
      setHasOlder(older.length >= 60);
    } catch { /* sessiz: kullanıcı tekrar kaydırınca yeniden denenir */ }
    setLoadingOlder(false);
  }

  async function sendMessage() {
    const body = text.replace(/\s+/g, " ").trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const data = await api.sendLiveRoomMessage(auth.token, code, body);
      mergeMessages([data.message]);
      setText("");
      hapticLight();
    } catch (e) {
      if (e.status === 403) setBanned(true);
      if (e.status === 409) load();
      showNotice(e.message || "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  // Paylaş düğmesi Yelpaze: Arkadaşına (uygulama içi sohbete link), WhatsApp, Kopyala, Diğer.
  const shareFanOptions = room ? shareOptions({
    message: `${roomLabel(room)} canlı sohbet odası: ${room.link}`,
    url: room.link,
    sendToFriend: () => setSendOpen(true),
  }) : [];

  function openActions(message) {
    const own = Number(message.user.id) === Number(auth.id);
    const buttons = [];
    if (!own) buttons.push({ text: "Profili gör", onPress: () => navigation.navigate("OtherProfile", { userId: message.user.id }) });
    if (own || isModerator) {
      buttons.push({
        text: "Mesajı sil",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteLiveRoomMessage(auth.token, code, message.id);
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
          } catch (e) { showNotice(e.message); }
        },
      });
    }
    if (isModerator && !own && !message.user.isModerator) {
      buttons.push({
        text: "Odada yazmaktan men et",
        style: "destructive",
        onPress: () => Alert.alert(
          `${message.user.name} men edilsin mi?`,
          "Bu odada artık yazamaz, mesajları da kaldırılır.",
          [
            { text: "Vazgeç", style: "cancel" },
            {
              text: "Men et",
              style: "destructive",
              onPress: async () => {
                try {
                  await api.banFromLiveRoom(auth.token, code, message.user.id);
                  setMessages((prev) => prev.filter((m) => Number(m.user.id) !== Number(message.user.id)));
                  showNotice(`${message.user.name} bu odada artık yazamıyor.`);
                } catch (e) { showNotice(e.message); }
              },
            },
          ]
        ),
      });
    }
    if (!buttons.length) return;
    hapticSelection();
    Alert.alert(message.user.name, message.body.length > 80 ? `${message.body.slice(0, 80)}…` : message.body, [...buttons, { text: "Vazgeç", style: "cancel" }]);
  }

  const status = room?.status;
  const listData = useMemo(() => [...messages].reverse(), [messages]);

  const renderItem = useCallback(({ item }) => {
    const own = Number(item.user.id) === Number(auth.id);
    return (
      <TouchableOpacity style={styles.msgRow} activeOpacity={0.7} onLongPress={() => openActions(item)} delayLongPress={300}
        accessibilityLabel={`${item.user.name}: ${item.body}`} accessibilityHint="Seçenekler için basılı tut">
        <RetryImage source={{ uri: avatarOr(item.user.avatarUrl, item.user.id) }} style={styles.avatar} />
        <View style={styles.msgBody}>
          <View style={styles.msgHead}>
            <Text style={[styles.msgName, own && { color: c.accent }]} numberOfLines={1}>{own ? "Sen" : item.user.name}</Text>
            {item.user.isModerator && <Text style={styles.modBadge}>MODERATÖR</Text>}
            <Text style={styles.msgTime}>{timeLabel(item.createdAt)}</Text>
          </View>
          <Text style={styles.msgText}>{item.body}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [auth.id, styles, c.accent, isModerator, code]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (loadError || !room) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Geri">
          <ChevronLeft size={22} color={c.text} />
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{loadError || "Bu sohbet odası bulunamadı."}</Text>
          <Text style={styles.emptyText}>Link hatalı ya da oda silinmiş olabilir.</Text>
        </View>
      </View>
    );
  }

  const when = whenLabel(room.startsAt);

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
        keyExtractor={(m) => String(m.id)}
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

      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {status === "live" && !banned ? (
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
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}
              onPress={sendMessage}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Gönder"
            >
              {sending ? <ActivityIndicator size="small" color="#1a140b" /> : <Send size={18} color="#1a140b" />}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.closedNote}>
            {banned
              ? "Bu odada mesaj yazman engellendi."
              : status === "scheduled"
                ? (when ? `Oda ${when}'de açılıyor.` : "Oda yayın saatinde açılıyor.")
                : "Bu oda kapandı. Mesajları okuyabilirsin."}
          </Text>
        )}
      </View>
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
    closedNote: { color: c.dim, fontSize: 13, textAlign: "center", paddingVertical: 12 },
  });
}
