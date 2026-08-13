import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, Platform, KeyboardAvoidingView, Modal, ActivityIndicator, Alert, Animated, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import {
  ChevronLeft, Send, Film, MessageCircle, Camera, Image as ImageIcon, X, Timer,
  Infinity as InfinityIcon, Download, Check, Reply, Trash2, Pencil, CheckSquare, Sparkles, BarChart2,
  CalendarClock, Plus, ChevronDown,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { useUnread } from "../context/UnreadContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import { decodeMovieShare } from "../utils/movieShare";
import { decodeListShare } from "../utils/listShare";
import { decodePhotoMessage } from "../utils/photoShare";
import { decodePoll, decodePlan, encodePoll, formatPlanTime } from "../utils/richMessage";
import { encodePhotoMessage } from "../utils/photoShare";
import PollCreatorModal from "../components/PollCreatorModal";
import PlanCreatorModal from "../components/PlanCreatorModal";
import {
  initChatDb, getLocalMessages, saveMessages, updateLocalMessage, replaceLocalMessage,
  deleteLocalMessages, getLastSyncedMessageId,
} from "../utils/chatDb";
import { getPrefetchedMessages, setPrefetchedMessages } from "../utils/chatMessagesPrefetch";
import DismissableSheet from "../components/DismissableSheet";
import TypingBubble from "../components/TypingBubble";
import Confetti from "../components/Confetti";
import ChatMessageRow from "../components/ChatMessageRow";
import { dayLabel, timeLabel } from "../utils/chatTimeLabels";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🙏"];

// Bir mesajın (film/liste/anket/plan/fotoğraf/silinmiş) kısa, tek satırlık bir önizlemesi —
// hem "X yanıtlanıyor" çubuğunda hem de bir mesaj başka birine ALINTI olarak eklendiğinde
// (ChatMessageRow'daki yanıt önizlemesi) AYNI mantıkla kullanılıyor.
function messageSnippet(msg) {
  if (!msg) return null;
  if (msg.deleted_for_everyone) return "Bu mesaj silindi";
  const photo = decodePhotoMessage(msg.body);
  if (photo) return "📷 Fotoğraf";
  const shared = decodeMovieShare(msg.body);
  if (shared) return `🎬 ${shared.title}`;
  const listShared = decodeListShare(msg.body);
  if (listShared) return `📋 ${listShared.name}`;
  const poll = decodePoll(msg.body);
  if (poll) return `🗳️ ${poll.question}`;
  const plan = decodePlan(msg.body);
  if (plan) return `📅 ${formatPlanTime(plan.scheduledAt)}`;
  return msg.body;
}

// ÖNEMLİ (mesajın iki kez gitmesini önlüyor): Her mesaj gönderimi için, cihazda üretilen ve
// TÜM tekrar denemeler boyunca AYNI kalan bir kimlik. Sunucu bu kimliği daha önce gördüyse
// (bağlantı koptuğu için "gönderemedim" sanıp otomatik tekrar denerken de aynısını gönderiyoruz)
// yeni bir kayıt oluşturmuyor, var olanı geri döndürüyor — WhatsApp/Telegram'ın kullandığı
// "idempotent gönderim" yöntemi. Kriptografik güvenlik gerekmiyor, sadece bu cihazda pratikte
// çakışmayacak kadar benzersiz olması yeterli — bu yüzden ekstra bir paket kurmaya gerek yok.
function generateClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function ChatConversationScreen({ route, navigation }) {
  const { chatId, friendId, friendName, friendAvatar } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const { subscribe, send } = useWS();
  const { refresh: refreshUnread } = useUnread();
  const insets = useSafeAreaInsets();

  // ÖNEMLİ (klavye boşluğu düzeltmesi): Android'de KeyboardAvoidingView'in "height" davranışı,
  // giriş kutusunun KENDİ sabit alt boşluğuyla (Android sistem çubuğu için eklediğimiz
  // insets.bottom) aynı anda uygulanınca çift boşluğa yol açıyordu — klavye açıkken bir boşluk
  // oluşuyor, klavye kapanınca da bazen düzgün sıfırlanmıyordu (bilinen bir Android/RN sorunu).
  // Android'de bunu KeyboardAvoidingView'e bırakmak yerine, klavye olaylarını kendimiz dinleyip
  // tam kontrolü elimize alıyoruz — klavye açıkken input'u TAM klavyenin üstüne, kapalıyken TAM
  // sistem çubuğunun üstüne (insets.bottom) oturtuyoruz, ara boşluk kalmıyor.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  // ÖNEMLİ (performans): makeStyles her render'da YENİ bir StyleSheet objesi üretiyordu — bu,
  // ChatMessageRow'a prop olarak geçtiğimizde React.memo'yu (styles "değişti" sanıp) her seferinde
  // kırardı. useSafeAreaInsets()'in her render'da YENİ bir obje döndürebileceğini varsayıp,
  // bağımlılık dizisinde "insets" objesinin kendisi yerine İLKEL alanlarını kullanıyoruz —
  // böylece sadece GERÇEKTEN değişen bir değer olduğunda yeniden hesaplanıyor.
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.top, insets.bottom, insets.left, insets.right]);
  const listRef = useRef(null);
  const draftInputRef = useRef(null); // gönderince .clear() ile native görünümü de kesin sıfırlamak için
  const rowOffsets = useRef({}); // mesaj id -> ölçülmüş dikey konum (alıntıya tıklayınca gitmek için)
  const swipeRefs = useRef({});

  // CH3 — bu arkadaşla bekleyen/aktif bir MatchParty oturumu varsa header'daki "Party" rozetine
  // küçük bir nabız ekliyoruz, eskiden davet gönderilmiş olsa bile rozet tamamen durağandı.
  const [partyActive, setPartyActive] = useState(false);
  const refreshPartyStatus = useCallback(() => {
    api.partyStatusWithFriend(auth.token, friendId).then((data) => setPartyActive(!!data.active)).catch(() => {});
  }, [auth.token, friendId]);
  useEffect(() => { refreshPartyStatus(); }, [refreshPartyStatus]);
  const partyPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!partyActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(partyPulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
        Animated.timing(partyPulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [partyActive, partyPulse]);
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (["party_invite", "party_accepted", "party_declined", "party_session_ended"].includes(msg.type)) refreshPartyStatus();
    });
    return unsub;
  }, [subscribe, refreshPartyStatus]);

  // ÖNEMLİ (sıfır bekleme deneyimi): Sohbet listesi ekranı zaten arka planda bu sohbetin
  // mesajlarını önceden hafızaya çekmiş olabilir — öyleyse state'i BOŞ diziyle değil, doğrudan o
  // veriyle başlatıyoruz. Bu, useState'in "lazy initializer" özelliği sayesinde İLK RENDER'DA
  // gerçekleşiyor — hiçbir async adım/gecikme yok, sohbete girer girmez mesajlar orada oluyor.
  const [messages, setMessages] = useState(() => getPrefetchedMessages(chatId) || []);
  const [draft, setDraft] = useState("");
  // ÖNEMLİ (mesaj kutusunun temizlenmeme sorununu önlüyor): React'in state güncellemelerini
  // gruplaması (batching) yüzünden, çok hızlı yazıp hemen ardından gönder'e basınca, "gönder"in
  // setDraft("") çağrısı ile son tuş vuruşunun setDraft(text) çağrısı YARIŞA girip yanlış sırada
  // işlenebiliyordu — sonuç: mesaj gönderiliyor ama kutuda "artık" (son yazılan) metin kalıyor.
  // Bu ref, HER değişiklikte SENKRON (React'in gruplama gecikmesine tabi olmadan) güncelleniyor
  // — sendMessage, "hangi metni gönderiyorum" kararını state yerine BUNDAN okuyor, bu da
  // yarışı ortadan kaldırıyor.
  const draftRef = useRef("");
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null); // karşı tarafın "yazıyor" göstergesini otomatik kapatmak için (güvenlik ağı)
  const stopTypingTimeoutRef = useRef(null); // benim yazmayı bıraktığımı sunucuya bildirmek için (debounce)
  const wasTypingRef = useRef(false); // gereksiz tekrar "typing:true" göndermemek için
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [showPhotoChooser, setShowPhotoChooser] = useState(false);
  const [showExtrasChooser, setShowExtrasChooser] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showPlanCreator, setShowPlanCreator] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // uzun basılan mesaj — tepki+aksiyon menüsü için
  const [showReactionBurst, setShowReactionBurst] = useState(false); // CH2
  const [reactionBurstKey, setReactionBurstKey] = useState(0);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // yanıtlanan mesaj
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [highlightedId, setHighlightedId] = useState(null); // alıntıya tıklayınca kısaca vurgulanan mesaj

  const messagesById = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  // ÖNEMLİ: Liste artık "inverted" — bu modda "en alt" (en yeni mesaj), scrollToEnd() DEĞİL,
  // offset:0'a kaydırmakla elde ediliyor (dizi ters çevrildiği için 0. eleman zaten en yeni
  // mesaj ve ekranın en altına oturuyor). Fonksiyon adını değiştirmedim ki her yerdeki çağrı
  // noktasını tek tek bulup güncellemek zorunda kalmayalım — davranışı burada düzeltmek yeterli.
  const scrollToEnd = useCallback((animated = false) => {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated }));
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated }), 120);
  }, []);

  // ÖNEMLİ (odakta istemsiz kaydırma düzeltmesi + "yeni mesajlar" baloncuğu için): Bu üçü,
  // sohbet içinde nerede olduğumuzu takip ediyor — sadece İLK girişte en alta kaydırmak,
  // sonraki her odaklanmada (ör. bir filme/ankete tıklayıp geri dönünce) kullanıcının kaldığı
  // yeri KORUMAK, ve o an en altta değilken yeni bir mesaj gelirse zorla kaydırmak yerine küçük
  // bir "yeni mesajlar" göstergesi çıkarmak için.
  const hasEnteredOnceRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });
    return () => parent?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  // ÖNEMLİ (SQLite yerel önbellek — WhatsApp/Instagram tarzı anında açılma): Önce telefondaki
  // yerel veritabanından mesajları ANINDA gösteriyoruz (ağ isteği beklemeden) — sohbet, önceki
  // yazışmalar hazırmış gibi anında açılıyor. Sonra arka planda, sunucudan SADECE en son bilinen
  // mesajdan sonrasını (fark/delta) çekip, hem ekrana hem yerel depoya ekliyoruz. Yerel veri hiç
  // yoksa (ilk kurulum, ya da uygulama yeniden kurulmuşsa) "after" boş kalıyor, tam geçmiş çekiliyor.
  const loadMessages = useCallback(async () => {
    const isFirstEntry = !hasEnteredOnceRef.current;
    try {
      const local = await getLocalMessages(chatId);
      if (local.length > 0) {
        setMessages(local);
        if (isFirstEntry) scrollToEnd(false); // SADECE ilk girişte — sonraki odaklanmalarda konumu bozma
      }
    } catch { /* yerel depo henüz hazır değilse sorun değil, sunucudan tam çekilecek */ }

    try {
      const lastId = await getLastSyncedMessageId(chatId);
      const data = await api.messages(auth.token, chatId, lastId);
      const fresh = data.results || [];
      if (fresh.length > 0) {
        // Sunucudan çekilen bu fark (delta) grubunu yerel depoya yazıyoruz — saveMessages tam
        // olarak bunun için var (bkz. chatDb.js): sınırlı, sunucu kaynaklı bir grup. Tek tek
        // mutasyonlarda kullanılan O(n) tam-liste yeniden yazma sorunuyla karıştırılmamalı.
        saveMessages(chatId, fresh).catch(() => {});
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          fresh.forEach((m) => byId.set(m.id, m));
          return Array.from(byId.values()).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
        // İlk girişte HER ZAMAN en alta kaydır. Sonraki odaklanmalarda ise, ancak kullanıcı zaten
        // en alttaysa kaydır — yukarıdaysa zorla kaydırmak yerine "yeni mesajlar" baloncuğunu göster.
        if (isFirstEntry || isAtBottomRef.current) {
          scrollToEnd(lastId != null);
        } else if (lastId != null) {
          setHasNewMessagesBelow(true);
        }
      }
    } catch { /* sessizce geç — en azından yerel veri zaten gösterilmiş oldu */ }

    hasEnteredOnceRef.current = true;
    api.markChatRead(auth.token, chatId).then(refreshUnread).catch(() => {});
  }, [chatId]);

  useEffect(() => { initChatDb().catch(() => {}); }, []);

  // ÖNEMLİ: Sohbetten çıkıp geri dönünce (ya da uygulama yeniden açılınca) SQLite'tan yüklenen
  // "başarısız" mesajların zamanlayıcısı kaybolmuş oluyor (bir önceki ekran örneği yok oldu).
  // Bu, henüz aktif bir zamanlayıcısı olmayan her "failed" mesaj için otomatik tekrar denemeyi
  // yeniden başlatıyor — kullanıcı hiçbir şey yapmasa bile mesaj göndermeye devam ediliyor.
  useEffect(() => {
    messages.forEach((m) => {
      // Kalıcı 4xx hatası veya otomatik deneme sınırına ulaşmış mesajlar uygulama yeniden
      // açıldığında tekrar sonsuz retry döngüsüne girmesin. Kullanıcı isterse balona dokunup
      // manuel olarak yeniden deneyebilir.
      if (m._status === "failed" && !m._autoRetryStopped && !retryTimeoutsRef.current.has(m.id)) {
        retrySend(m, m._retryCount || 0);
      }
    });
  }, [messages]);

  // ÖNEMLİ DÜZELTME (donmaların ve mesaj çiftlenmesinin asıl kaynağı): Burada eskiden, mesaj
  // listesi HERHANGİ bir sebeple değiştiğinde (tek bir mesaj gönderilse/gelse/düzenlense bile)
  // TÜM sohbet geçmişini SQLite'a yeniden yazan tek bir "merkezi" efekt vardı. Uzun bir sohbette
  // bu, her ufak değişiklikte YÜZLERCE satırlık bir INSERT döngüsü demekti — hem arayüzü
  // dondurmaya (yazarken bile takılmalara) yetecek kadar pahalıydı, hem de bu yavaş toplu yazma
  // işlemi, ARADA gerçekleşen küçük/hızlı bir silme işlemiyle (ör. iyimser mesajın geçici kaydını
  // silme) YARIŞA girip onu "hayalet" olarak geri diriltebiliyordu (bkz. replaceLocalMessage'daki
  // not). Artık her mutasyon noktası KENDİ değişikliğini (tek satır, updateLocalMessage/
  // replaceLocalMessage ile) doğrudan yazıyor — burada sadece ucuz, senkron hafıza-içi ön yükleme
  // önbelleğini güncel tutuyoruz.
  useEffect(() => {
    if (messages.length > 0) setPrefetchedMessages(chatId, messages);
  }, [messages, chatId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // ÖNEMLİ (kayıp mesaj düzeltmesi): Yeni mesajlar normalde WebSocket üzerinden CANLI geliyor —
  // ama uygulama arka plandayken bu bağlantı kopuyor. Arka planda gelen bir mesaj bildirim
  // olarak doğru ulaşıyordu, ama uygulamanın hafızasındaki mesaj listesi hiç yenilenmiyordu —
  // özellikle bildirime tıklayıp ZATEN AÇIK olan bir sohbet ekranına dönüldüğünde (ekran yeniden
  // kurulmuyor, sadece odağa geliyor, mount useEffect'i tekrar çalışmıyor). Artık ekran her
  // odaklandığında (WS bağlı olsun olmasın) mesajları tazeden çekiyoruz — bu, hiçbir mesajın
  // "kaybolmamasını" garanti ediyor.
  useEffect(() => {
    const unsubFocus = navigation.addListener("focus", loadMessages);
    return unsubFocus;
  }, [navigation, loadMessages]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === "message" && msg.chat_id === chatId) {
        // ÖNEMLİ (çiftlenme koruması): "focus" ile tetiklenen loadMessages() bir sunucu senkronu
        // sırasında bu mesajı ZATEN çekmiş olabilir (ör. bildirime dokunup ekrana dönerken WS
        // olayıyla neredeyse aynı anda). Aynı ID zaten listede varsa tekrar eklemiyoruz.
        setMessages((prev) => (prev.some((m) => m.id === msg.message.id) ? prev : [...prev, msg.message]));
        updateLocalMessage(chatId, msg.message).catch(() => {});
        setFriendIsTyping(false); // mesaj geldiyse zaten yazmayı bitirmiştir
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        // Kullanıcı zaten en alttaysa sorunsuz kaydır (WhatsApp'ın da yaptığı gibi) — ama
        // yukarıda eski mesajlara bakıyorsa zorla en alta atmak yerine "yeni mesajlar"
        // baloncuğunu gösteriyoruz, kullanıcı isterse kendisi gider.
        if (isAtBottomRef.current) {
          scrollToEnd(true);
        } else {
          setHasNewMessagesBelow(true);
        }
        api.markChatRead(auth.token, chatId).then(refreshUnread).catch(() => {});
      } else if (msg.type === "typing" && msg.chat_id === chatId) {
        setFriendIsTyping(!!msg.isTyping);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (msg.isTyping) {
          // Güvenlik ağı: karşı taraf "yazmayı bitirdim" sinyalini göndermeden uygulamayı
          // kapatır/bağlantısı koparsa, gösterge sonsuza kadar takılı kalmasın diye 6 saniye
          // sonra otomatik kapatıyoruz.
          typingTimeoutRef.current = setTimeout(() => setFriendIsTyping(false), 6000);
        }
      } else if (msg.type === "messages_read" && msg.chat_id === chatId) {
        // Birden fazla mesaj birden "okundu" işaretlenebiliyor — bu TEK, sınırlı/nadir olay için
        // toplu (bulk) yazma burada makul, tek tek her satırı ayrıca işlemeye gerek yok.
        setMessages((prev) => {
          const next = prev.map((m) => (m.sender_id === auth.id ? { ...m, read: true } : m));
          saveMessages(chatId, next).catch(() => {});
          return next;
        });
      } else if (msg.type === "message_unsent" && msg.chat_id === chatId) {
        setMessages((prev) => prev.map((m) => {
          if (m.id !== msg.message_id) return m;
          const updated = { ...m, body: "", deleted_for_everyone: true };
          updateLocalMessage(chatId, updated).catch(() => {});
          return updated;
        }));
      } else if (msg.type === "message_edited" && msg.chat_id === chatId) {
        setMessages((prev) => prev.map((m) => (m.id === msg.message.id ? msg.message : m)));
        updateLocalMessage(chatId, msg.message).catch(() => {});
      } else if (msg.type === "message_reacted" && msg.chat_id === chatId) {
        setMessages((prev) => prev.map((m) => (m.id === msg.message.id ? msg.message : m)));
        updateLocalMessage(chatId, msg.message).catch(() => {});
      }
    });
    return unsub;
  }, [subscribe, chatId, scrollToEnd]);

  // Yazarken karşı tarafa "yazıyor..." bildirimi gönderiyor — her tuş vuruşunda değil (bu,
  // gereksiz yere sunucuyu/bağlantıyı yorar), sadece yazmaya YENİ başlarken bir kere "true"
  // gönderiyor, sonra 2.5 saniye durursa (ya da mesajı gönderir/temizlerse) "false" gönderiyor.
  function handleDraftChange(text) {
    setDraft(text);
    draftRef.current = text;
    const hasText = text.trim().length > 0;
    if (hasText && !wasTypingRef.current) {
      wasTypingRef.current = true;
      send({ type: "typing", chatId, isTyping: true });
    } else if (!hasText && wasTypingRef.current) {
      wasTypingRef.current = false;
      send({ type: "typing", chatId, isTyping: false });
    }
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    if (hasText) {
      stopTypingTimeoutRef.current = setTimeout(() => {
        wasTypingRef.current = false;
        send({ type: "typing", chatId, isTyping: false });
      }, 2500);
    }
  }

  // ÖNEMLİ (otomatik tekrar deneme): Başarısız bir mesaj artık sadece "dokununca tekrar dene"
  // demiyor — kendiliğinden, giderek artan aralıklarla (3sn, 6sn, 12sn, 24sn, sonrasında hep
  // 30sn) sürekli tekrar deniyor, ta ki gerçekten gidene kadar. Aralığı KADEMELİ artırıyoruz ki
  // bağlantı uzun süre kesikse sunucuyu/pili boşuna yormayalım. Kullanıcı istediği an mesaja
  // dokunup ANINDA (beklemeden) bir deneme daha tetikleyebiliyor — bu, sadece bekleyen otomatik
  // zamanlayıcıyı iptal edip hemen bir tane daha başlatıyor.
  const retryTimeoutsRef = useRef(new Map()); // tempId -> setTimeout referansı
  const RETRY_DELAYS = [3000, 6000, 12000, 24000, 30000];
  const MAX_AUTO_RETRIES = 5;

  function isRetryableSendError(error) {
    if (error?.isTimeout) return true;
    // fetch'in hiç HTTP cevabı alamadığı network hatalarında status yoktur.
    if (error?.status == null) return true;
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  useEffect(() => {
    return () => { retryTimeoutsRef.current.forEach((t) => clearTimeout(t)); retryTimeoutsRef.current.clear(); };
  }, []);

  async function attemptSend(tempId, body, replyId, clientId, retryCount = 0) {
    try {
      const msg = await api.sendMessage(auth.token, chatId, body, replyId, clientId);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      // ÖNEMLİ: geçici (negatif ID'li) kaydı silme + gerçek mesajı yazma TEK bir atomik
      // transaction'da (bkz. chatDb.js'teki not) — bu, mesajların çiftlenmesine yol açan
      // yarışı ortadan kaldırıyor.
      replaceLocalMessage(chatId, tempId, msg).catch(() => {});
      const t = retryTimeoutsRef.current.get(tempId);
      if (t) { clearTimeout(t); retryTimeoutsRef.current.delete(tempId); }
    } catch (e) {
      const shouldRetry = isRetryableSendError(e) && retryCount < MAX_AUTO_RETRIES;
      // 400/401/403/404 gibi kalıcı HTTP hataları otomatik tekrar edilmez. Network/timeout,
      // 408/429 ve 5xx ise sınırlı sayıda kademeli olarak denenir.
      setMessages((prev) => prev.map((m) => {
        if (m.id !== tempId) return m;
        const updated = {
          ...m,
          _status: "failed",
          _retryCount: retryCount,
          _clientId: clientId,
          _autoRetryStopped: !shouldRetry,
        };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
      if (!shouldRetry) {
        retryTimeoutsRef.current.delete(tempId);
        return;
      }
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      const t = setTimeout(() => {
        setMessages((prevMsgs) => {
          const stillThere = prevMsgs.find((m) => m.id === tempId && m._status === "failed" && !m._autoRetryStopped);
          if (stillThere) attemptSend(tempId, body, replyId, clientId, retryCount + 1);
          return prevMsgs;
        });
      }, delay);
      retryTimeoutsRef.current.set(tempId, t);
    }
  }

  async function sendMessage() {
    // ÖNEMLİ: draft state'i yerine draftRef.current'tan okuyoruz — hızlı yazarken React'in
    // state güncellemesini gruplamasından (batching) kaynaklanan yarışı önlemek için (yukarıdaki
    // draftRef tanımına bakabilirsin). Aynı sebeple, göndermeden HEMEN önce ref'i de senkron
    // olarak temizliyoruz — böylece bu fonksiyon aynı anda iki kez tetiklense bile (ör. hızlı
    // çift dokunma), ikinci çağrı "gönderilecek bir şey yok" deyip kendiliğinden çıkıyor.
    const body = draftRef.current.trim();
    if (!body) return;
    draftRef.current = "";
    // Mesaj gönderilince (kullanıcı yazmayı manuel silmese bile) karşı tarafa "yazmayı
    // bitirdim" bildirmemiz lazım — yoksa mesaj gidip "yazıyor..." göstergesi asılı kalabilir.
    if (wasTypingRef.current) {
      wasTypingRef.current = false;
      send({ type: "typing", chatId, isTyping: false });
    }
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    if (editingMessage) {
      setDraft("");
      draftInputRef.current?.clear();
      try {
        const updated = await api.editMessage(auth.token, editingMessage.id, body);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        updateLocalMessage(chatId, updated).catch(() => {});
      } catch (e) { Alert.alert("Olmadı", e.message || "Mesaj düzenlenemedi."); }
      setEditingMessage(null);
      return;
    }
    const replyId = replyingTo?.id || null;
    setDraft("");
    // ÖNEMLİ (giriş kutusunun bazen mesajı gönderdikten sonra da dolu görünmesi düzeltmesi):
    // "value" prop'unu boşaltmak (setDraft("")) React tarafında doğru — ama multiline bir
    // TextInput'ta, özellikle Android'de otomatik düzeltme/tahmin önerisiyle YARIŞAN hızlı
    // ardışık tuş vuruşlarında native görünüm bazen bu prop değişikliğini kaçırıp eski metni
    // ekranda bırakıyor (bilinen bir RN sorunu). .clear() imperatif çağrısı, native görünümü
    // JS state'inden bağımsız olarak da sıfırlayıp bunu KESİN hale getiriyor.
    draftInputRef.current?.clear();
    setReplyingTo(null);

    // ÖNEMLİ (gönderim durumu göstergesi): Zayıf bağlantıda mesaj hiç gitmeyebiliyordu ama
    // kullanıcı bunu hiç fark edemiyordu — arayüzde bir değişiklik olmuyordu. Artık mesajı ANINDA
    // (sunucuyu beklemeden) ekrana, geçici bir ID ve "gönderiliyor" durumuyla ekliyoruz. Sunucu
    // onaylayınca gerçek mesajla değiştiriyoruz; başarısız olursa otomatik olarak (giderek artan
    // aralıklarla) tekrar deniyor, gidene kadar durmuyor.
    const tempId = -Date.now();
    const clientId = generateClientId(); // TÜM tekrar denemeler boyunca aynı kalacak
    const optimisticMsg = {
      id: tempId, chat_id: chatId, sender_id: auth.id, body, reply_to_id: replyId,
      created_at: new Date().toISOString(), read: false, _status: "sending", _clientId: clientId,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    updateLocalMessage(chatId, optimisticMsg).catch(() => {});
    scrollToEnd(true);
    attemptSend(tempId, body, replyId, clientId, 0);
  }

  // Başarısız (gönderilemeyen) bir mesaja dokununca, bekleyen otomatik zamanlayıcıyı iptal edip
  // ANINDA bir deneme daha tetikliyor — kullanıcı beklemek istemezse elinde bu seçenek olsun diye.
  function retryFailedMessage(item) {
    const t = retryTimeoutsRef.current.get(item.id);
    if (t) { clearTimeout(t); retryTimeoutsRef.current.delete(item.id); }
    setMessages((prev) => prev.map((m) => (m.id === item.id ? { ...m, _status: "sending", _autoRetryStopped: false } : m)));
    // ÖNEMLİ: item._clientId zaten var olan (ilk denemede üretilen) kimlik — burada YENİ bir
    // tane üretmiyoruz, aksi halde sunucu bunu FARKLI bir mesaj sanır.
    retrySend(item, item._retryCount || 0);
  }

  async function votePoll(item, optionIndex) {
    try {
      const updated = await api.votePoll(auth.token, item.id, optionIndex);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      updateLocalMessage(chatId, updated).catch(() => {});
    } catch { /* sessizce geç */ }
  }

  async function acceptPlan(item) {
    try {
      const updated = await api.acceptPlan(auth.token, item.id);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      updateLocalMessage(chatId, updated).catch(() => {});
    } catch (e) { Alert.alert("Olmadı", e.message || "Plan kabul edilemedi."); }
  }

  async function sendPoll(question, options) {
    try {
      const body = encodePoll({ question, options });
      const msg = await api.sendMessage(auth.token, chatId, body, null);
      setMessages((prev) => [...prev, msg]);
      updateLocalMessage(chatId, msg).catch(() => {});
      scrollToEnd(true);
    } catch { /* sessizce geç */ }
  }

  async function sendPlan(scheduledAt, note) {
    try {
      const msg = await api.createPlan(auth.token, chatId, scheduledAt, note);
      setMessages((prev) => [...prev, msg]);
      updateLocalMessage(chatId, msg).catch(() => {});
      scrollToEnd(true);
    } catch (e) {
      Alert.alert("Olmadı", e.message || "Plan gönderilemedi.");
    }
  }

  function startEdit(item) {
    setMenuFor(null);
    setReplyingTo(null);
    setEditingMessage(item);
    setDraft(item.body);
  }
  function cancelEdit() {
    setEditingMessage(null);
    setDraft("");
  }

  function startReply(item) {
    setMenuFor(null);
    setEditingMessage(null);
    setReplyingTo(item);
    swipeRefs.current[item.id]?.close();
  }

  async function deleteForMe(item) {
    setMenuFor(null);
    setMessages((prev) => prev.filter((m) => m.id !== item.id));
    deleteLocalMessages(chatId, [item.id]).catch(() => {});
    try { await api.deleteMessage(auth.token, item.id); } catch { loadMessages(); }
  }

  async function unsendForEveryone(item) {
    setMenuFor(null);
    try {
      await api.unsendMessage(auth.token, item.id);
      setMessages((prev) => prev.map((m) => {
        if (m.id !== item.id) return m;
        const updated = { ...m, body: "", deleted_for_everyone: true };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
    } catch (e) { Alert.alert("Olmadı", e.message || "Mesaj silinemedi."); }
  }

  async function react(item, emoji) {
    setMenuFor(null);
    const key = String(auth.id);
    const wasReacting = item.reactions?.[key] === emoji;
    // CH2 — sadece EKLERKEN (kaldırırken değil) küçük bir haptic + konfeti sıçraması.
    if (!wasReacting) {
      hapticLight();
      setReactionBurstKey((k) => k + 1);
      setShowReactionBurst(true);
      setTimeout(() => setShowReactionBurst(false), 700);
    }
    // iyimser güncelleme
    setMessages((prev) => prev.map((m) => {
      if (m.id !== item.id) return m;
      const reactions = { ...(m.reactions || {}) };
      if (reactions[key] === emoji) delete reactions[key]; else reactions[key] = emoji;
      const updated = { ...m, reactions };
      updateLocalMessage(chatId, updated).catch(() => {});
      return updated;
    }));
    try { await api.reactToMessage(auth.token, item.id, emoji); } catch { loadMessages(); }
  }

  function enterSelection(item) {
    setMenuFor(null);
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }
  function toggleSelected(item) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(item.id) ? n.delete(item.id) : n.add(item.id);
      return n;
    });
  }
  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }
  async function bulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Alert.alert("Mesajları Sil", `${ids.length} mesajı benden silmek istediğine emin misin?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil", style: "destructive", onPress: async () => {
          setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
          deleteLocalMessages(chatId, ids).catch(() => {});
          exitSelection();
          try { await api.bulkDeleteMessages(auth.token, ids); } catch { loadMessages(); }
        },
      },
    ]);
  }

  async function pickPhoto(fromCamera) {
    setShowPhotoChooser(false);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("İzin gerekli", "Devam etmek için izin vermelisin."); return; }
      const options = { quality: 0.5, base64: true };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      setPendingPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    } catch (e) {
      Alert.alert("Olmadı", "Fotoğraf açılamadı: " + (e?.message || "bilinmeyen hata"));
    }
  }

  // ÖNEMLİ (fotoğrafların "bazen gitmemesi" sorununun asıl düzeltmesi): Eskiden fotoğraf
  // göndermenin metin mesajlarındaki gibi bir iyimser balonu/otomatik tekrar deneme mekanizması
  // YOKTU — tek bir deneme başarısız olursa (zayıf bağlantı, zaman aşımı vb.) hata SESSİZCE
  // yutuluyor, kullanıcıya hiçbir şey söylenmiyor, fotoğraf kayboluyordu. Artık metin
  // mesajlarındaki AYNI mekanizma (iyimser balon + kademeli tekrar deneme + kalıcı "başarısız"
  // durumu) fotoğraflar için de geçerli.
  async function attemptSendPhoto(tempId, dataUri, once, clientId, retryCount = 0) {
    try {
      const msg = await api.sendChatPhoto(auth.token, chatId, dataUri, once, clientId);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
      replaceLocalMessage(chatId, tempId, msg).catch(() => {});
      const t = retryTimeoutsRef.current.get(tempId);
      if (t) { clearTimeout(t); retryTimeoutsRef.current.delete(tempId); }
    } catch (e) {
      const shouldRetry = isRetryableSendError(e) && retryCount < MAX_AUTO_RETRIES;
      setMessages((prev) => prev.map((m) => {
        if (m.id !== tempId) return m;
        const updated = {
          ...m,
          _status: "failed",
          _retryCount: retryCount,
          _clientId: clientId,
          _autoRetryStopped: !shouldRetry,
        };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
      if (!shouldRetry) {
        retryTimeoutsRef.current.delete(tempId);
        return;
      }
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      const t = setTimeout(() => {
        setMessages((prevMsgs) => {
          const stillThere = prevMsgs.find((m) => m.id === tempId && m._status === "failed" && !m._autoRetryStopped);
          if (stillThere) attemptSendPhoto(tempId, dataUri, once, clientId, retryCount + 1);
          return prevMsgs;
        });
      }, delay);
      retryTimeoutsRef.current.set(tempId, t);
    }
  }

  function sendPhoto(once) {
    if (!pendingPhoto) return;
    const dataUri = `data:image/jpeg;base64,${pendingPhoto.base64}`;
    setPendingPhoto(null); // WhatsApp'taki gibi: gönder'e basınca önizleme kapanır, balon sohbette "gönderiliyor" durumuyla belirir
    const tempId = -Date.now();
    const clientId = generateClientId();
    const optimisticMsg = {
      id: tempId, chat_id: chatId, sender_id: auth.id, body: encodePhotoMessage(dataUri, once),
      reply_to_id: null, created_at: new Date().toISOString(), read: false, _status: "sending", _clientId: clientId,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    updateLocalMessage(chatId, optimisticMsg).catch(() => {});
    scrollToEnd(true);
    attemptSendPhoto(tempId, dataUri, once, clientId, 0);
  }

  // Başarısız bir mesaj (metin YA DA fotoğraf) için doğru tekrar deneme fonksiyonuna yönlendirir.
  function retrySend(item, retryCount) {
    const clientId = item._clientId || generateClientId();
    const photo = decodePhotoMessage(item.body);
    if (photo) attemptSendPhoto(item.id, photo.image, photo.once, clientId, retryCount);
    else attemptSend(item.id, item.body, item.reply_to_id || null, clientId, retryCount);
  }

  async function openOnceView(item) {
    const decoded = decodePhotoMessage(item.body);
    if (!decoded || decoded.consumed) return;
    setViewerImage({ uri: decoded.image, downloadable: false });
    try {
      await api.consumePhoto(auth.token, item.id);
      setMessages((prev) => prev.map((m) => {
        if (m.id !== item.id) return m;
        const updated = { ...m, body: "__PHOTO_MSG__" + JSON.stringify({ consumed: true }) };
        updateLocalMessage(chatId, updated).catch(() => {});
        return updated;
      }));
    } catch { /* sessizce geç */ }
  }

  async function downloadImage() {
    if (!viewerImage?.uri || downloading) return;
    setDownloading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert("İzin gerekli", "Fotoğrafı kaydetmek için galeri izni vermelisin."); setDownloading(false); return; }
      const fileUri = FileSystem.cacheDirectory + `falanfilan-${Date.now()}.jpg`;
      const base64Data = viewerImage.uri.split(",")[1];
      await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(fileUri);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch {
      Alert.alert("Olmadı", "Fotoğraf kaydedilemedi, tekrar dener misin?");
    }
    setDownloading(false);
  }

  function startParty() {
    navigation.navigate("MatchParty", { friend: { id: friendId, name: friendName, avatarUrl: friendAvatar } });
  }

  const flatData = useMemo(() => {
    // Gün ayırıcılarını mesaj listesinin arasına serpiştiriyoruz.
    const out = [];
    let lastDay = null;
    messages.forEach((m) => {
      const label = dayLabel(m.created_at);
      if (label !== lastDay) {
        out.push({ _type: "separator", id: `sep-${m.id}`, label });
        lastDay = label;
      }
      out.push({ _type: "message", ...m });
    });
    // ÖNEMLİ: Liste artık "inverted" (WhatsApp mantığı) — bu yüzden diziyi YENİDEN ESKİYE doğru
    // TERS ÇEVİRİYORUZ. inverted=true, dizinin 0. elemanını ekranın EN ALTINA yerleştirir; yeni
    // bir mesaj gelince onu dizinin BAŞINA eklemek yeterli, kullanıcı zaten en alttaysa (offset:0)
    // hiçbir manuel kaydırmaya gerek kalmadan mesaj anında en altta beliriyor.
    return out.reverse();
  }, [messages]);

  // Alıntılanmış bir mesaja tıklayınca, orijinal mesaja kaydırıp kısaca vurguluyoruz.
  // ÖNEMLİ: scrollToIndex, değişken yükseklikli (fotoğraf/metin/film kartı karışık) listelerde
  // güvenilmez ve sıkışabiliyor — bunun yerine her satırın kendi onLayout'unda ÖLÇTÜĞÜMÜZ gerçek
  // konuma (rowOffsets) göre scrollToOffset kullanıyoruz, çok daha sağlam.
  // ÖNEMLİ DÜZELTME: Hedef mesaj FlatList'in henüz render ETMEDİĞİ (ekrandan uzak, yukarılarda
  // kalan) bir mesajsa, rowOffsets'te hiç kaydı olmuyordu ve fonksiyon sessizce hiçbir şey
  // yapmadan çıkıyordu — "alıntıya tıklayınca gitmiyor" şikayetinin sebebi buydu. Artık önce
  // FlatList'in kendi scrollToIndex'iyle KABA bir tahminle o civara sıçrıyoruz (bu, hedefin
  // render edilip onLayout ile GERÇEK konumunun ölçülmesini tetikliyor), sonra kısa bir
  // gecikmeyle KESİN konuma ikinci bir düzeltme yapıyoruz.
  // ÖNEMLİ (kesin düzeltme): Eskiden tek bir "kaba tahmin + 350ms sonra kesin kaydırma" denemesi
  // yapıyorduk. Asıl hata muhtemelen onScrollToIndexFailed'deki tahminde — FlatList henüz
  // yeterince satır render etmediyse "averageItemLength" SIFIR dönebiliyor, bu da hesaplanan
  // konumu 0'a düşürüyor; ters çevrilmiş (inverted) bir listede 0 konumu TAM OLARAK "en yeni/en
  // alt mesaj" demek — kullanıcının gördüğü "hep en alta gidiyor" hatası büyük ihtimalle buydu.
  // Artık tek seferlik bir tahmine güvenmek yerine, hedefin GERÇEK konumu ölçülene kadar (en
  // fazla ~3 saniye, 200ms aralıklarla) tekrar tekrar kontrol edip son anda kesin kaydırma
  // yapıyoruz — bu, tek bir yanlış tahminin tüm sonucu belirlemesini engelliyor.
  // ÖNEMLİ DÜZELTME: scrollToIndex eskiden SADECE ilk denemede (attempt===0) çağrılıyordu —
  // mesaj ekrandan çok uzaktaysa (ör. sohbetin başlarında, şu an görünenden yüzlerce mesaj
  // önce), TEK seferlik bir sıçrama yetmiyordu ve fonksiyon geri kalan denemelerde sadece pasif
  // bekliyordu, hiçbir şey yapmadan pes ediyordu. Artık SQLite sayesinde TÜM mesaj geçmişi
  // zaten telefonda (flatData içinde) olduğu için — asıl eksik olan "oraya nasıl ulaşırım"
  // kısmıydı. Şimdi HER denemede scrollToIndex'i tekrar çağırıyoruz — FlatList her seferinde
  // biraz daha yaklaşıyor, hedefin onLayout'u tetiklenene kadar bu ısrarla devam ediyor.
  function scrollToMessage(messageId, attempt = 0) {
    const offset = rowOffsets.current[messageId];
    if (offset != null) {
      listRef.current?.scrollToOffset({ offset: Math.max(0, offset - 90), animated: true });
      setHighlightedId(messageId);
      setTimeout(() => setHighlightedId((cur) => (cur === messageId ? null : cur)), 1400);
      return;
    }
    if (attempt > 25) return; // ~5 saniye ısrarla denendi, muhtemelen bu sohbette yok
    const index = flatData.findIndex((it) => String(it.id) === String(messageId));
    if (index === -1) return; // bu sohbette hiç yok (silinmiş olabilir) — yapacak bir şey yok
    try {
      listRef.current?.scrollToIndex({ index, animated: attempt === 0, viewPosition: 0.4 });
    } catch { /* onScrollToIndexFailed zaten bunu yakalıyor */ }
    setTimeout(() => scrollToMessage(messageId, attempt + 1), 200);
  }

  // ÖNEMLİ (performans köprüsü — ChatMessageRow.js'teki React.memo'nun işe yaraması için):
  // Bu ekrandaki fonksiyonlar (retryFailedMessage, votePoll, vb.) her render'da YENİDEN
  // tanımlanıyor — state'e bağlı taze closure'lar. Onları doğrudan prop olarak geçirmek,
  // satırla İLGİSİZ her render'da TÜM satırların "callback değişti" sanıp yeniden render
  // olmasına yol açardı. "latestRef" her render'da en güncel versiyonlarla dolduruluyor,
  // "rowActions" objesi ise SADECE BİR KERE (useRef ile) oluşturuluyor ve metodları hep
  // latestRef.current üzerinden en güncele yönleniyor — hem her zaman taze state'i görüyor
  // hem de referans kimliği hiç değişmiyor.
  const latestRef = useRef({});
  latestRef.current = {
    messages, toggleSelected, retryFailedMessage, votePoll, acceptPlan, openOnceView,
    setViewerImage, scrollToMessage, startReply, setMenuFor, navigation,
  };
  const rowActions = useRef({
    toggleSelected: (id) => latestRef.current.toggleSelected({ id }),
    retryFailedMessage: (id) => {
      const item = latestRef.current.messages.find((m) => m.id === id);
      if (item) latestRef.current.retryFailedMessage(item);
    },
    votePoll: (id, optionIndex) => {
      const item = latestRef.current.messages.find((m) => m.id === id);
      if (item) latestRef.current.votePoll(item, optionIndex);
    },
    acceptPlan: (id) => {
      const item = latestRef.current.messages.find((m) => m.id === id);
      if (item) latestRef.current.acceptPlan(item);
    },
    openOnceView: (id) => {
      const item = latestRef.current.messages.find((m) => m.id === id);
      if (item) latestRef.current.openOnceView(item);
    },
    openViewer: (uri, downloadable) => latestRef.current.setViewerImage({ uri, downloadable }),
    scrollToMessage: (id) => latestRef.current.scrollToMessage(id),
    startReply: (id) => {
      const item = latestRef.current.messages.find((m) => m.id === id);
      if (item) latestRef.current.startReply(item);
    },
    openMenu: (id) => {
      const item = latestRef.current.messages.find((m) => m.id === id);
      if (item) latestRef.current.setMenuFor(item);
    },
    navigateDetail: (movie) => latestRef.current.navigation.navigate("Detail", { movie }),
    navigateWatchlist: (watchlistId, name) => latestRef.current.navigation.navigate("WatchlistDetail", { watchlistId, name }),
    measureLayout: (id, y) => { rowOffsets.current[id] = y; },
    setSwipeRef: (id, ref) => { swipeRefs.current[id] = ref; },
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {selectionMode ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={exitSelection} style={{ padding: 2 }}>
            <X size={20} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.name, { flex: 1 }]}>{selectedIds.size} seçildi</Text>
          <TouchableOpacity onPress={bulkDelete} style={{ padding: 2 }} disabled={selectedIds.size === 0}>
            <Trash2 size={19} color={selectedIds.size > 0 ? c.danger : c.dim} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
            <ChevronLeft size={20} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerCenter} onPress={() => navigation.navigate("OtherProfile", { userId: friendId })}>
            <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{friendName}</Text>
              {friendIsTyping && <Text style={styles.typingIndicator}>yazıyor...</Text>}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Blend", { friendId, friendName, friendAvatar })}>
            <LinearGradient colors={["#0EA5E9", "#6366F1", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerPill}>
              <Sparkles size={12} color="#fff" />
              <Text style={styles.headerPillText}>Blend</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={startParty} style={{ position: "relative" }}>
            <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerPill}>
              <Film size={12} color="#fff" />
              <Text style={styles.headerPillText}>Party</Text>
            </LinearGradient>
            {/* CH3 — bu arkadaşla bekleyen/aktif bir oturum varken nabız atan bir nokta. */}
            {partyActive && <Animated.View style={[styles.partyPulseDot, { opacity: partyPulse }]} />}
          </TouchableOpacity>
        </View>
      )}


      {/* ÖNEMLİ DÜZELTME: "behavior" burada Android için hâlâ "height" idi — bu, Android'in
          zaten varsayılan olarak (windowSoftInputMode: resize) kendi native yeniden-boyutlandırmasıyla
          ÇAKIŞIYORDU: ikisi de aynı anda alan açmaya çalışınca çift boşluk/klavye kapanınca geç
          sıfırlanma oluyordu — üstteki yorumun anlattığı "Android'de kendi kontrolümüzü alıyoruz"
          niyeti koddaki bu satırla tam örtüşmüyordu. Android'de artık "undefined" (no-op)
          veriyoruz, tüm yeniden boyutlandırmayı native'e + keyboardHeight'a bağlı manuel
          paddingBottom'a bırakıyoruz. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          inverted
          data={flatData}
          keyExtractor={(item) => (item._type === "separator" ? item.id : String(item.id))}
          // ÖNEMLİ (donma/takılma düzeltmesi): Uzun sohbet geçmişlerinde FlatList varsayılan
          // ayarlarla gerekenden çok daha fazla satırı önceden render etmeye çalışıyordu — bu,
          // özellikle yazarken (her tuş vuruşu civarında JS iş parçacığı zaten meşgulken) fark
          // edilir bir gecikmeye/takılmaya yol açıyordu. Bu değerler, ekranda görünenin biraz
          // fazlasını render edip gerisini tembel bırakarak JS iş parçacığını rahatlatıyor.
          initialNumToRender={20}
          maxToRenderPerBatch={16}
          windowSize={9}
          updateCellsBatchingPeriod={50}
          // ÖNEMLİ: Reaksiyon rozeti (emoji), balonun altına -10px taşarak yerleşiyor — liste
          // "inverted" olduğu için, buradaki "paddingTop" görsel olarak listenin EN ALTINDA
          // (giriş kutusuna en yakın, en yeni mesajın olduğu yerde) çıkıyor. En son mesaja emoji
          // bırakınca rozetin kırpılmaması için orada normalden fazladan boşluk bırakıyoruz.
          contentContainerStyle={{ padding: 14, paddingTop: 36, flexGrow: 1, justifyContent: "flex-start" }}
          // ÖNEMLİ: Liste "inverted" olduğu için ListHeaderComponent, görsel olarak listenin EN
          // ALTINDA (en yeni mesajın bile altında, input kutusuna en yakın yerde) render ediliyor
          // — tam olarak "yazıyor..." göstergesinin olması gereken yer.
          ListHeaderComponent={friendIsTyping ? <TypingBubble bubbleColor={c.surface2} dotColor={c.dim} /> : null}
          // ÖNEMLİ: Liste "inverted" olduğu için offset:0 = görsel olarak EN ALT (en yeni mesaj).
          // Küçük bir eşik (80px) veriyoruz ki "tam olarak sıfır" olmasa da "neredeyse en altta"
          // sayılsın — WS'ten gelen yeni bir mesajda zorla mı kaydıralım, yoksa "yeni mesajlar"
          // baloncuğunu mu gösterelim, buna göre karar veriyoruz.
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            isAtBottomRef.current = y < 80;
            if (y < 80 && hasNewMessagesBelow) setHasNewMessagesBelow(false);
          }}
          scrollEventThrottle={100}
          // ÖNEMLİ: Bu ikisi de eskiden KOŞULSUZ en alta kaydırıyordu — içerik boyutu her
          // değiştiğinde (ör. eski mesajlara bakarken arka planda bir delta senkronu tamamlanınca)
          // kullanıcıyı konumundan koparıyordu. Artık sadece kullanıcı zaten en alttaysa (ya da
          // ilk girişte) kaydırıyor.
          onContentSizeChange={() => { if (isAtBottomRef.current || !hasEnteredOnceRef.current) scrollToEnd(false); }}
          onLayout={() => { if (isAtBottomRef.current || !hasEnteredOnceRef.current) scrollToEnd(false); }}
          onScrollToIndexFailed={(info) => {
            // ÖNEMLİ: "averageItemLength" bazen SIFIR (ya da çok küçük) dönüyor — FlatList henüz
            // yeterince satır ölçmediyse. Bu durumda hesaplanan konum da 0'a yakın çıkıyor, ters
            // çevrilmiş listede bu "en yeni/en alt mesaj" demek — hedefin nerede olduğuna
            // bakmaksızın hep en alta sıçramamıza yol açıyordu. Makul bir minimum (80px, ortalama
            // bir metin balonu yüksekliği) varsayıyoruz, gerçek ölçüm 0/çok küçük gelirse.
            const avgLen = info.averageItemLength > 20 ? info.averageItemLength : 80;
            const offset = avgLen * info.index;
            listRef.current?.scrollToOffset({ offset, animated: false });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.4 });
            }, 100);
          }}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            if (item._type === "separator") {
              return (
                <View style={styles.daySeparatorRow}>
                  <View style={styles.daySeparatorPill}><Text style={styles.daySeparatorText}>{item.label}</Text></View>
                </View>
              );
            }

            const isMine = item.sender_id === auth.id;
            // ÖNEMLİ: flatData artık tersten (yeniden eskiye) sıralı — bu yüzden kronolojik
            // olarak "bir SONRAKİ mesaj" artık index-1'de, "bir ÖNCEKİ mesaj" ise index+1'de.
            const nextItem = flatData[index - 1];
            const prevItem = flatData[index + 1];
            const isLastOfMine = isMine && (!nextItem || nextItem._type === "separator" || nextItem.sender_id !== auth.id);
            // Art arda AYNI kişiden gelen mesajlar birbirine daha yakın dursun (WhatsApp gibi) —
            // sadece kişi değiştiğinde ya da gün ayırıcısından hemen sonra daha geniş boşluk olsun.
            const isGroupedWithPrevious = prevItem && prevItem._type === "message" && prevItem.sender_id === item.sender_id;
            // ÖNEMLİ: Reaksiyon rozeti (emoji), balonun altına -10px taşarak yerleşiyor —
            // normal satır aralığı (özellikle art arda mesajlarda 2px gibi çok dar bir boşluk)
            // buna yer açmıyordu, komşu mesajın altında/mesaj kutusunun arkasında kalıp
            // kayboluyordu. Bu satırın KENDİSİ ya da ondan hemen SONRAKİ (kronolojik olarak
            // daha yeni, ekranda bitişiğinde duran) mesajın bir reaksiyonu varsa, hangi yönde
            // taştığından bağımsız olarak güvenli olsun diye ekstra boşluk ekliyoruz.
            const itemHasReaction = item.reactions && Object.keys(item.reactions).length > 0;
            const nextHasReaction = nextItem && nextItem.reactions && Object.keys(nextItem.reactions).length > 0;
            const rowSpacing = (isGroupedWithPrevious ? 2 : 12) + (itemHasReaction || nextHasReaction ? 14 : 0);
            const reactions = item.reactions || {};
            // ÖNEMLİ (performans): tek bir STRING'e indirgeniyor — ChatMessageRow'a obje yerine
            // ilkel bir değer geçiyoruz ki React.memo'nun varsayılan sığ karşılaştırması "bu satır
            // gerçekten değişti mi" sorusunu doğru cevaplayabilsin (bkz. ChatMessageRow.js).
            const reactionsKey = Object.keys(reactions).length > 0 ? [...new Set(Object.values(reactions))].join(" ") : null;
            const replySnippet = item.reply_to_id ? messageSnippet(messagesById.get(item.reply_to_id)) : null;

            return (
              <ChatMessageRow
                id={item.id}
                body={item.body}
                isMine={isMine}
                myId={auth.id}
                createdAt={item.created_at}
                editedAt={item.edited_at}
                deletedForEveryone={item.deleted_for_everyone}
                status={item._status}
                reactionsKey={reactionsKey}
                showSeenTick={isLastOfMine && item.read}
                replyToId={item.reply_to_id}
                replySnippet={replySnippet}
                rowSpacing={rowSpacing}
                isSelected={selectedIds.has(item.id)}
                isHighlighted={item.id === highlightedId}
                selectionMode={selectionMode}
                friendId={friendId}
                friendAvatar={friendAvatar}
                c={c}
                styles={styles}
                actions={rowActions}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}><MessageCircle size={24} color={c.accent} /></View>
              <Text style={styles.emptyText}>Henüz mesaj yok, ilk mesajı sen yaz.</Text>
            </View>
          }
        />

        {/* "Yeni mesajlar" baloncuğu — eski mesajlara bakarken karşı taraftan yeni bir mesaj
            gelirse (ya da odağa dönünce fark senkronu yeni mesaj bulursa), kullanıcıyı konumundan
            koparmadan küçük bir gösterge çıkarıyoruz. Tıklayınca en güncel mesaja gidiyor. */}
        {hasNewMessagesBelow && (
          <TouchableOpacity
            style={styles.newMessagesBubble}
            onPress={() => { setHasNewMessagesBelow(false); scrollToEnd(true); }}
          >
            <Text style={styles.newMessagesBubbleText}>Yeni mesajlar</Text>
            <ChevronDown size={14} color={c.bg} />
          </TouchableOpacity>
        )}

        {replyingTo && (
          <View style={styles.editingBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyingToLabel}>{replyingTo.sender_id === auth.id ? "Kendine" : friendName} yanıtlanıyor</Text>
              <Text style={styles.editingBarText} numberOfLines={1}>
                {messageSnippet(replyingTo)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}><X size={16} color={c.dim} /></TouchableOpacity>
          </View>
        )}
        {editingMessage && (
          <View style={styles.editingBar}>
            <Text style={styles.editingBarText}>Mesajı düzenliyorsun</Text>
            <TouchableOpacity onPress={cancelEdit}><X size={16} color={c.dim} /></TouchableOpacity>
          </View>
        )}
        <View style={[styles.inputRow, Platform.OS === "android" && keyboardHeight > 0 && { paddingBottom: 14 }]}>
          <TouchableOpacity style={styles.photoBtn} onPress={() => { Keyboard.dismiss(); setShowPhotoChooser(true); }} disabled={!!editingMessage}>
            <Camera size={19} color={editingMessage ? c.dim : c.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={() => { Keyboard.dismiss(); setShowExtrasChooser(true); }} disabled={!!editingMessage}>
            <Plus size={19} color={editingMessage ? c.dim : c.text} />
          </TouchableOpacity>
          <TextInput
            ref={draftInputRef}
            style={styles.input}
            placeholder="Mesaj yaz"
            placeholderTextColor={c.dim}
            value={draft}
            onChangeText={handleDraftChange}
            onSubmitEditing={sendMessage}
            onFocus={() => scrollToEnd(true)}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Send size={16} color={c.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* CH2 — bir reaksiyon eklendiğinde ekranın alt yarısında küçük, kısa bir konfeti
          sıçraması (reaksiyon sayfasının kapandığı tam o an tetikleniyor). */}
      {showReactionBurst && (
        <View style={styles.reactionBurstWrap} pointerEvents="none">
          <Confetti key={reactionBurstKey} count={12} spread={160} fast />
        </View>
      )}

      {/* Mesaja uzun basınca: hızlı tepki satırı + aksiyon listesi. ÖNEMLİ: bu bilinçli olarak
          native <Modal> DEĞİL — kendi başına bir UIViewController olarak sunulan bir Modal,
          tam kapanmadan hemen ardından kamera/galerinin KENDİ native penceresini açmaya
          çalışınca iOS ikisini çakıştırıp sonsuza kadar donduruyordu. Düz, ekran içi bir
          katman (position: absolute) bu çakışma ihtimalini tamamen ortadan kaldırıyor. */}
      {menuFor && (
        <View style={styles.chooserOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setMenuFor(null)} />
          <DismissableSheet onClose={() => setMenuFor(null)} style={styles.chooserSheet} handleOnly>
            <View style={styles.reactionRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} style={styles.reactionOption} onPress={() => react(menuFor, emoji)}>
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.chooserRow} onPress={() => startReply(menuFor)}>
              <View style={styles.chooserIconWrap}><Reply size={16} color={c.text} /></View>
              <Text style={styles.chooserText}>Yanıtla</Text>
            </TouchableOpacity>
            {menuFor.sender_id === auth.id && !decodePhotoMessage(menuFor.body) && !decodeMovieShare(menuFor.body) && (
              <TouchableOpacity style={styles.chooserRow} onPress={() => startEdit(menuFor)}>
                <View style={styles.chooserIconWrap}><Pencil size={16} color={c.text} /></View>
                <Text style={styles.chooserText}>Düzenle</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.chooserRow} onPress={() => enterSelection(menuFor)}>
              <View style={styles.chooserIconWrap}><CheckSquare size={16} color={c.text} /></View>
              <Text style={styles.chooserText}>Seç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooserRow} onPress={() => deleteForMe(menuFor)}>
              <View style={styles.chooserIconWrap}><X size={16} color={c.text} /></View>
              <Text style={styles.chooserText}>Benden Sil</Text>
            </TouchableOpacity>
            {menuFor.sender_id === auth.id && (
              <TouchableOpacity style={styles.chooserRow} onPress={() => unsendForEveryone(menuFor)}>
                <View style={styles.chooserIconWrap}><Trash2 size={16} color={c.danger} /></View>
                <Text style={[styles.chooserText, { color: c.danger }]}>Herkesten Sil</Text>
              </TouchableOpacity>
            )}
          </DismissableSheet>
        </View>
      )}

      {showPhotoChooser && (
        <View style={styles.chooserOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowPhotoChooser(false)} />
          <DismissableSheet onClose={() => setShowPhotoChooser(false)} style={styles.chooserSheet} handleOnly>
            <TouchableOpacity style={styles.chooserRow} onPress={() => pickPhoto(true)}>
              <View style={styles.chooserIconWrap}><Camera size={18} color={c.text} /></View>
              <Text style={styles.chooserText}>Kamerayla Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooserRow} onPress={() => pickPhoto(false)}>
              <View style={styles.chooserIconWrap}><ImageIcon size={18} color={c.text} /></View>
              <Text style={styles.chooserText}>Galeriden Seç</Text>
            </TouchableOpacity>
          </DismissableSheet>
        </View>
      )}

      {showExtrasChooser && (
        <View style={styles.chooserOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowExtrasChooser(false)} />
          <DismissableSheet onClose={() => setShowExtrasChooser(false)} style={styles.chooserSheet} handleOnly>
            <TouchableOpacity style={styles.chooserRow} onPress={() => { setShowExtrasChooser(false); setShowPollCreator(true); }}>
              <View style={styles.chooserIconWrap}><BarChart2 size={18} color={c.text} /></View>
              <Text style={styles.chooserText}>Mini Anket Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooserRow} onPress={() => { setShowExtrasChooser(false); setShowPlanCreator(true); }}>
              <View style={styles.chooserIconWrap}><CalendarClock size={18} color={c.text} /></View>
              <Text style={styles.chooserText}>İzleme Planı Öner</Text>
            </TouchableOpacity>
          </DismissableSheet>
        </View>
      )}

      <PollCreatorModal visible={showPollCreator} onClose={() => setShowPollCreator(false)} onSubmit={sendPoll} />
      <PlanCreatorModal visible={showPlanCreator} onClose={() => setShowPlanCreator(false)} onSubmit={sendPlan} />

      {/* Fotoğraf seçildikten sonra: tek seferlik mi kalıcı mı gönderileceğini soruyoruz. */}
      <Modal visible={!!pendingPhoto} animationType="slide" transparent onRequestClose={() => setPendingPhoto(null)}>
        <TouchableWithoutFeedback onPress={() => setPendingPhoto(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <DismissableSheet onClose={() => setPendingPhoto(null)} style={styles.modalSheet} handleOnly>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Fotoğrafı Gönder</Text>
                  <TouchableOpacity onPress={() => setPendingPhoto(null)}><X size={20} color={c.text} /></TouchableOpacity>
                </View>
                {pendingPhoto && <Image source={{ uri: pendingPhoto.uri }} style={styles.previewImage} />}
                {/* ÖNEMLİ: Artık gönder'e basınca bu panel ANINDA kapanıyor (bkz. sendPhoto) —
                    fotoğraf, sohbette "gönderiliyor" durumuyla iyimser bir balon olarak beliriyor,
                    burada ayrıca bir yükleniyor göstergesi beklemeye gerek yok. */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <TouchableOpacity style={styles.choiceBtn} onPress={() => sendPhoto(true)}>
                    <Timer size={16} color={c.text} />
                    <Text style={styles.choiceBtnTitle}>Tek Seferlik</Text>
                    <Text style={styles.choiceBtnSubtitle}>Görülünce silinir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.choiceBtn, { backgroundColor: c.accent, borderColor: c.accent }]} onPress={() => sendPhoto(false)}>
                    <InfinityIcon size={16} color={c.bg} />
                    <Text style={[styles.choiceBtnTitle, { color: c.bg }]}>Kalıcı</Text>
                    <Text style={[styles.choiceBtnSubtitle, { color: c.bg, opacity: 0.8 }]}>Sohbette kalır</Text>
                  </TouchableOpacity>
                </View>
              </DismissableSheet>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Fotoğraf/kalıcı görsel tam ekran görüntüleyici */}
      <Modal visible={!!viewerImage} animationType="fade" transparent onRequestClose={() => setViewerImage(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setViewerImage(null)} />
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerImage(null)}>
            <X size={22} color="#fff" />
          </TouchableOpacity>
          {viewerImage && (
            <DismissableSheet onClose={() => setViewerImage(null)} style={{ width: "100%", alignItems: "center" }} showGrabber={false}>
              <Image source={{ uri: viewerImage.uri }} style={styles.viewerImage} resizeMode="contain" pointerEvents="none" />
              {viewerImage?.downloadable && (
                <TouchableOpacity style={styles.downloadBtn} onPress={downloadImage} disabled={downloading}>
                  {downloading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : downloaded ? (
                    <><Check size={16} color="#fff" /><Text style={styles.downloadBtnText}>Kaydedildi</Text></>
                  ) : (
                    <><Download size={16} color="#fff" /><Text style={styles.downloadBtnText}>İndir</Text></>
                  )}
                </TouchableOpacity>
              )}
            </DismissableSheet>
          )}
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
    avatar: { width: 30, height: 30, borderRadius: 999 },
    name: { fontSize: 14, fontWeight: "700", color: c.text, flexShrink: 1 },
    typingIndicator: { fontSize: 11, color: c.accent, fontWeight: "600", marginTop: 1 },
    headerPill: {
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
      flexDirection: "row", alignItems: "center", gap: 4,
    },
    headerPillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    partyPulseDot: {
      position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: 999,
      backgroundColor: "#4ADE80", borderWidth: 1.5, borderColor: c.bg,
    },
    bubble: {
      maxWidth: "100%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 2,
    },
    bubbleGloss: { position: "absolute", top: 0, left: 0, right: 0, height: "55%" },
    bubbleMine: { alignSelf: "flex-end", backgroundColor: c.accent, borderBottomRightRadius: 4 },
    bubbleTheirs: { alignSelf: "flex-start", backgroundColor: c.surface2, borderBottomLeftRadius: 4 },
    // CH1 — sadece düz metin balonunda kullanılan hafif çerçeve (paylaşılan bubbleTheirs'a
    // eklenmiyor, çünkü o film/anket/plan kartlarında da kullanılıyor).
    bubbleTheirsBorder: { borderWidth: 1, borderColor: c.border },
    // ÖNEMLİ: fontSize'ı buradan kaldırdık — bu stil, film/anket/plan kartları gibi KENDİ punto
    // boyutu olan birçok yerde de "renk" vermek için kullanılıyordu; buraya sabit bir fontSize
    // koymak, o kartların kendi (zaten ayarlı) boyutlarını ezip hepsini 13.5'e sabitliyordu.
    // Artık sadece renk taşıyor, punto her yerin kendi stiline kalıyor.
    bubbleTextMine: { color: c.bg },
    bubbleTextTheirs: { color: c.text },
    // Düz metin mesajları (film/anket/plan kartı OLMAYAN, sıradan yazışma) için ayrı, küçültülmüş punto.
    messageBodyText: { fontSize: 12 },
    seenText: { fontSize: 10, color: c.dim },
    // ÖNEMLİ: Artık sadece "balona dokun" değil, ayrı, gerçek bir buton — daha kolay fark
    // ediliyor, e.stopPropagation() ile balonun kendi onPress'ini (seçim modu vs.) tetiklemeden
    // sadece tekrar deneme işlevini çalıştırıyor.
    retryBtn: {
      flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end",
      marginTop: 5, paddingVertical: 3,
    },
    failedText: { fontSize: 10, color: c.danger, fontWeight: "700" },
    // Giriş kutusunun hemen üstünde, sağda duran, dokununca en güncel mesaja götüren gösterge.
    newMessagesBubble: {
      position: "absolute", right: 16, bottom: 78, flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
      shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
    },
    newMessagesBubbleText: { fontSize: 12, fontWeight: "800", color: c.bg },
    timeTextInBubble: { fontSize: 9.5 },
    editedTag: { fontSize: 9, marginTop: 2, fontStyle: "italic" },
    editingBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surface2,
      borderTopWidth: 1, borderTopColor: c.border,
    },
    editingBarText: { fontSize: 11, color: c.dim, fontWeight: "600" },
    replyingToLabel: { fontSize: 10, color: c.accent, fontWeight: "700", marginBottom: 1 },
    replyPreviewInBubble: { borderLeftWidth: 2, paddingLeft: 7, marginBottom: 5, opacity: 0.9 },
    replyPreviewText: { fontSize: 11.5 },
    // ÖNEMLİ (Android düzeltmesi): Her mesaj satırı yanıtlama kaydırması için Swipeable'a
    // sarmalanıyor — bu bileşen Android'de, görsel (poster) içeren satırların yüksekliğini
    // bazen doğru ölçmüyor, satırın (ve içindeki görselin) ekranın neredeyse tamamı kadar
    // dikeyde uzamasına yol açıyordu. Sadece düz metin balonları etkilenmiyordu çünkü onlarda
    // sabit boyutlu bir görsel yok. "alignSelf: flex-start" hem balonun kendisine hem postere
    // eklenince, ikisi de üst kapsayıcının belirsiz/yanlış yükseklik hesabından bağımsız,
    // sadece kendi İÇERİĞİNE göre boyutlanmaya zorlanıyor — iOS'ta zaten görünmeyen bu davranış
    // Android'de artık engelleniyor.
    // ÖNEMLİ (kalıcı düzeltme): Önceki hali "alignSelf: flex-start" ile deneniyordu ama gerçek
    // Android cihazlarda hâlâ dikeyde şişme + kaydırma kilitlenmesi oluyordu — metin alanının
    // "flex: 1" (esnek) olması, Android'in Yoga motorunda bazen belirsiz bir yükseklik hesabına
    // yol açabiliyordu. Poll balonunda (bkz. pollOptionPoster) bu sorun HİÇ yaşanmıyordu çünkü
    // orada her şey SABİT boyutlu — aynı yaklaşımı burada da uyguluyoruz: poster poll'daki AYNI
    // boyut (92x132), metin alanı da flex değil, SABİT bir genişlik. Belirsizlik kalmayınca
    // Android'in yanlış yükseklik hesaplaması ihtimali de ortadan kalkıyor.
    movieBubble: { maxWidth: "100%", flexDirection: "row", gap: 10, padding: 12, borderRadius: 14, alignItems: "flex-start", alignSelf: "flex-start" },
    movieBubblePoster: { width: 92, height: 132, borderRadius: 10 },
    // Poster + IMDb puan rozeti aynı yerde çakışmasın diye poster artık ayrı bir "wrap" içinde —
    // rozet buna göre mutlak konumlanıyor (bkz. movieBubbleRatingBadge).
    movieBubblePosterWrap: { width: 92, height: 132 },
    movieBubbleRatingBadge: {
      position: "absolute", bottom: 6, right: 6, flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999,
    },
    movieBubbleRatingText: { fontSize: 9.5, fontWeight: "800", color: "#fff" },
    movieBubbleInfo: { width: 170 },
    // Eskiden düz, soluk bir "🎬 Film/dizi önerisi" metniydi — artık renkli, gradyanlı bir rozet
    // (Blend/Party başlık rozetleriyle aynı dil), kart tekdüze durmasın diye.
    movieBubblePill: {
      flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    },
    movieBubblePillText: { fontSize: 9, fontWeight: "800", color: "#fff" },
    movieBubbleTitle: { fontSize: 13, fontWeight: "700", marginTop: 5 },
    movieBubbleMeta: { fontSize: 10, opacity: 0.8, marginTop: 4 },
    // Tür/yıl bilgisinin altındaki boşluğu dolduran platform logoları (Netflix/Prime vb.).
    movieBubblePlatformsRow: { flexDirection: "row", gap: 4, marginTop: 7, flexWrap: "wrap" },
    movieBubblePlatformLogo: { width: 16, height: 16, borderRadius: 4, backgroundColor: "#fff" },
    // Saat artık metin akışının bir parçası değil — poster/gövde ne kadar uzun olursa olsun
    // baloncuğun TAM sağ alt köşesine sabit kalıyor (film/liste/anket/plan kartlarının hepsinde ortak).
    movieBubbleTimeCorner: { position: "absolute", bottom: 8, right: 10 },
    // Anket/plan kartları eskiden TEK bir düz renkli blok olarak boyanıyordu (sıkıcı şikayetinin
    // asıl kaynağı) — artık renkli bir gradyan başlık şeridi + altında normal balon rengi taşıyan
    // bir gövde olarak İKİ katmanlı. "overflow: hidden" sayesinde şeridin köşeleri ayrıca
    // yuvarlatılmasa da dış borderRadius'u takip ediyor.
    pollBubble: { borderRadius: 18, overflow: "hidden" },
    pollHeaderStrip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
    pollQuestion: { flex: 1, fontSize: 14, fontWeight: "800", color: "#fff" },
    // paddingBottom fazladan — köşeye sabitlenen saat (movieBubbleTimeCorner) içerikle çakışmasın.
    pollBody: { padding: 16, paddingBottom: 28 },
    // Filmler artık YAN YANA — her biri kendi sütununda (poster, başlık, çubuk, yüzde, checkbox
    // alt alta). Sığmazsa yatay kaydırılabilir.
    pollOptionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    pollOptionCol: { width: 92, alignItems: "center" },
    pollOptionPoster: { width: 92, height: 132, borderRadius: 10 },
    // En çok oy alan seçenek altın bir çerçeve + taç rozetiyle öne çıkıyor — bir anketin sonucu
    // artık tek bakışta belli oluyor, sadece yüzdelere bakmak gerekmiyor.
    pollOptionPosterLeading: { borderWidth: 2, borderColor: "#FFD700" },
    pollLeaderBadge: {
      position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999,
      backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3,
    },
    pollOptionBarTrack: { width: "100%", height: 8, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden", marginTop: 6 },
    pollOptionBarFill: { height: "100%", borderRadius: 5 },
    // ÖNEMLİ DÜZELTME: Sabit "height: 30" kullanılıyordu — Android'de gerçek font satır
    // yüksekliği bazı cihazlarda "lineHeight: 15 x 2 satır = 30" sınırını hafifçe aşabiliyor,
    // bu da ikinci satırın kırpılmasına/kaybolmasına yol açıyordu. "minHeight" kullanmak, metnin
    // gerektiğinde büyümesine izin veriyor — kırpılma riski tamamen ortadan kalkıyor, kısa
    // başlıklarda da hizalama bozulmuyor (minimum aynı alanı kaplıyorlar).
    pollOptionTitle: { fontSize: 12, fontWeight: "700", marginTop: 7, textAlign: "center", lineHeight: 16, minHeight: 34 },
    pollOptionPct: { fontSize: 10.5, fontWeight: "700", marginTop: 3, opacity: 0.85 },
    pollVoteRow: { alignItems: "center", marginTop: 8, flexDirection: "row", gap: 6 },
    pollCheckbox: {
      width: 24, height: 24, borderRadius: 6, borderWidth: 2,
      alignItems: "center", justifyContent: "center",
    },
    pollVoterAvatar: { width: 20, height: 20, borderRadius: 999, borderWidth: 1.5, borderColor: "#fff" },
    planBubble: { borderRadius: 18, overflow: "hidden" },
    planHeaderStrip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    planHeaderStripText: { fontSize: 12.5, fontWeight: "800", color: "#fff" },
    // paddingBottom fazladan — köşeye sabitlenen saat (movieBubbleTimeCorner) içerikle çakışmasın.
    planBody: { padding: 16, paddingTop: 12, paddingBottom: 26 },
    planNote: { fontSize: 15, fontWeight: "700", marginBottom: 12, lineHeight: 21 },
    planSubNote: { fontSize: 12.5, opacity: 0.85, marginTop: -8, marginBottom: 12 },
    planStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    planStatusText: { fontSize: 13, fontWeight: "700" },
    planAcceptBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderRadius: 12, paddingVertical: 12,
    },
    planAcceptBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    photoLockedBubble: {
      maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 13, paddingVertical: 11, borderRadius: 16,
    },
    photoBubbleImage: { width: 180, height: 220, borderRadius: 14, backgroundColor: c.surface2 },
    photoTimeBadge: {
      position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
    },
    photoTimeBadgeText: { color: "#fff", fontSize: 9.5 },
    photoStatusOverlay: {
      ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 4,
    },
    photoStatusOverlayText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    reactionBurstWrap: { position: "absolute", left: 0, right: 0, bottom: 0, top: "45%" },
    reactionBadge: {
      position: "absolute", bottom: -10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
    },
    reactionBadgeText: { fontSize: 11 },
    selectCircle: {
      width: 22, height: 22, borderRadius: 999, borderWidth: 1.5, borderColor: c.border,
      alignItems: "center", justifyContent: "center", backgroundColor: c.surface,
    },
    replySwipeAction: { width: 60, alignItems: "center", justifyContent: "center" },
    daySeparatorRow: { alignItems: "center", marginVertical: 10 },
    daySeparatorPill: { backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
    daySeparatorText: { fontSize: 11, fontWeight: "600", color: c.dim },
    highlightedRow: { backgroundColor: `${c.accent}22`, marginVertical: -6, paddingVertical: 6, marginHorizontal: -6, paddingHorizontal: 6 },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center" },
    emptyBox: { alignItems: "center", paddingVertical: 30 },
    emptyIconWrap: { width: 52, height: 52, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    inputRow: {
      flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10,
      // ÖNEMLİ DÜZELTME: Android'de burada sabit bir "14" kullanılıyordu — cihazın GERÇEK
      // alt navigasyon çubuğu yüksekliğini (jestli navigasyon mu, 3 butonlu mu, cihaza göre
      // değişiyor) hiç hesaba katmıyordu, bu yüzden sohbet ilk açıldığında input kutusu
      // navigasyon çubuğunun ARKASINDA kalabiliyordu — klavyeyi bir kez açıp kapatmak
      // sadece tesadüfen yeniden bir ölçüm tetiklediği için "düzeliyormuş" gibi görünüyordu.
      // Artık react-native-safe-area-context'in ÖLÇTÜĞÜ gerçek alt boşluğu kullanıyoruz.
      paddingBottom: Platform.OS === "ios" ? 26 : Math.max(14, insets.bottom + 10),
      borderTopWidth: 1, borderTopColor: c.border, alignItems: "flex-end", backgroundColor: c.bg,
    },
    photoBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    input: {
      flex: 1, backgroundColor: c.surface2, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
      color: c.text, fontSize: 13, maxHeight: 110,
    },
    sendBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    chooserOverlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
      backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end",
    },
    // ÖNEMLİ: Sabit "paddingBottom: 30" kullanılıyordu — Android'in sistem çubuğunu hesaba
    // katmıyordu, menünün alt kısmı (özellikle ikinci satırdaki seçenek) çubuğun arkasında
    // kalabiliyordu. Artık cihazın gerçek güvenli alan boşluğuna göre ayarlanıyor.
    chooserSheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 20 + insets.bottom },
    reactionRow: {
      flexDirection: "row", justifyContent: "space-between", backgroundColor: c.surface2,
      borderRadius: 999, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 14,
    },
    reactionOption: { padding: 4 },
    chooserRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
    chooserIconWrap: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    chooserText: { fontSize: 14, fontWeight: "600", color: c.text },
    modalSheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 20 + insets.bottom },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    modalTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    previewImage: { width: "100%", aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: c.surface2 },
    choiceBtn: {
      flex: 1, alignItems: "center", gap: 4, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, paddingVertical: 16,
    },
    choiceBtnTitle: { fontSize: 13, fontWeight: "800", color: c.text, marginTop: 2 },
    choiceBtnSubtitle: { fontSize: 10, color: c.dim },
    viewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
    viewerCloseBtn: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
    viewerImage: { width: "100%", height: "80%" },
    downloadBtn: {
      position: "absolute", bottom: 50, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
    },
    downloadBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  });
}
