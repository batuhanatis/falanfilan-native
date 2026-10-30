import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Modal, Animated, Alert, TouchableWithoutFeedback, RefreshControl, ScrollView, Platform, Easing } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  MessageCircle, Heart, ListPlus, Star, Activity, X, Trash2, RefreshCw, Film, Tv, Camera, BarChart3, CalendarClock, List,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useUnread } from "../context/UnreadContext";
import { usePrefetch } from "../context/PrefetchContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import DismissableSheet from "../components/DismissableSheet";
import { decodeMovieShare } from "../utils/movieShare";
import { decodePhotoMessage } from "../utils/photoShare";
import { decodePoll, decodePlan } from "../utils/richMessage";
import { decodeListShare } from "../utils/listShare";
import { decodeActivityShare } from "../utils/activityShare";
import { decodeStoryReply } from "../utils/storyReplyShare";
import TopBar from "../components/TopBar";
import ChatListSkeleton from "../components/skeletons/ChatListSkeleton";
import { timeLabel } from "../utils/chatTimeLabels";
import { FONTS } from "../theme/fonts";
import LiveRoomsList from "../components/LiveRoomsList";
import LiveDot from "../components/salon/LiveDot";

// Aynı arkadaş art arda birden fazla şeyi beğenirse (ör. bir "beğeni oturumu") bunları tek tek
// göstermek yerine "X'in Y film beğendi" diye TEK bir satırda topluyoruz. Sadece BİRBİRİNE
// BİTİŞİK (ardışık), AYNI kullanıcıdan gelen "like" tipi aktiviteler gruplanıyor.
function groupActivity(items) {
  const groups = [];
  // Backend güncel durumda user+movie başına tek like döndürüyor; yine de eski
  // prefetch/cache veya geçiş dönemindeki bir response duplicate taşıyabilirse UI'da
  // aynı içeriği ikinci kez göstermeyelim. Sıralı ilk (yani en yeni) kayıt kalır.
  const seenLikeMovies = new Set();
  for (const item of items) {
    if (item.type === "like" && item.movie?.id != null) {
      const likeKey = `${item.user?.id}:${item.movie.id}`;
      if (seenLikeMovies.has(likeKey)) continue;
      seenLikeMovies.add(likeKey);
    }
    const prev = groups[groups.length - 1];
    if (item.type === "like" && prev && prev.type === "like" && prev.user.id === item.user.id) {
      if (item.movie) prev.movies.push(item.movie);
    } else {
      groups.push({
        key: `${item.type}-${item.id}`,
        type: item.type,
        user: item.user,
        payload: item.payload,
        created_at: item.created_at,
        movies: item.movie ? [item.movie] : [],
      });
    }
  }
  return groups;
}

// CH5 — sohbet listesindeki son-mesaj önizlemesi eskiden içerik türünden bağımsız, hep aynı
// düz gri metindi. Artık her tür (film/liste/anket/plan), o türün ChatConversationScreen'deki
// kart tasarımıyla AYNI renk ailesinden küçük bir noktayla işaretleniyor — listeyi tararken ne
// beklediğin, mesajı açmadan belli oluyor.
// Tür artık renkli bir nokta yerine küçük bir ikonla gösteriliyor; renkler iki temada da okunan
// orta tonlardan oluşan tek bir aile.
function messagePreviewInfo(lastMessage) {
  const shared = decodeMovieShare(lastMessage);
  if (shared) {
    const label = shared.type === "Dizi" ? "Dizi Önerisi" : "Film Önerisi";
    return { text: shared.title ? `${label}: ${shared.title}` : label, Icon: shared.type === "Dizi" ? Tv : Film, color: "#c9a44c" };
  }
  if (decodePhotoMessage(lastMessage)) return { text: "Fotoğraf", Icon: Camera, color: "#9a8f80" };
  if (decodePoll(lastMessage)) return { text: "Mini Anket", Icon: BarChart3, color: "#6f9fb0" };
  if (decodePlan(lastMessage)) return { text: "İzleme Planı", Icon: CalendarClock, color: "#7fa27a" };
  if (decodeListShare(lastMessage)) return { text: "Liste paylaşıldı", Icon: List, color: "#b8a27c" };
  if (decodeActivityShare(lastMessage)) return { text: "Aktivite paylaşıldı", Icon: Activity, color: "#c2604f" };
  if (decodeStoryReply(lastMessage)) return { text: "Story'ye yanıt", Icon: MessageCircle, color: "#c9a44c" };
  return { text: lastMessage || "Henüz mesaj yok", Icon: null, color: null };
}

const WEEKDAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
function lastAtLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return timeLabel(iso);
  if (days === 1) return "Dün";
  if (days < 7) return WEEKDAYS[d.getDay()];
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

const nowLabel = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Numaratör: sohbet listesinin tepesinde bir fiş yuvası var. Listeyi aşağı çekince yuvadan saati
// basılı bir fiş çıkıyor; yenileme bitince fiş koparılıp yana savruluyor. Android'de liste
// aşağı esnemediği için fiş yenileme başlayınca kendiliğinden iniyor.
const TICKET_H = 112;
const TICKET_DROP = Platform.OS === "ios" ? 44 : 100;
const TICKET_ARM = 56;

function activityText(g) {
  if (g.type === "like") {
    return g.movies.length > 1
      ? `${g.user.name} ${g.movies.length} içerik beğendi`
      : `${g.user.name} bir içeriği beğendi`;
  }
  if (g.type === "favorite_set") return `${g.user.name} favorisini güncelledi`;
  if (g.type === "list_created") return `${g.user.name} "${g.payload?.list_name || "yeni"}" adında bir liste oluşturdu`;
  return `${g.user.name} bir şey yaptı`;
}

export default function ChatListScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  // Sohbet listesi (okunmamış sayıları dahil) artık paylaşılan UnreadContext'ten geliyor —
  // hem burada hem alt sekme çubuğunda AYNI veri, tek bir yerden çekiliyor.
  const { chats, refresh: refreshUnread } = useUnread();
  const styles = makeStyles(c);

  const [sub, setSub] = useState("chats"); // "chats" | "live" | "activity"
  // "Canlı" sekmesi: açık canlı sohbet odaları. Sekme başlığındaki sayı için ekran her
  // odaklandığında, sekme açıkken de 15 saniyede bir tazeleniyor.
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [groupModal, setGroupModal] = useState(null); // gruplanmış beğeniler için açılan popup

  // Uygulama açılır açılmaz arka planda çekilmiş arkadaş/aktivite verisi varsa (bkz.
  // PrefetchContext), ilk yüklemede onu kullanıyoruz — SADECE bir kez; "focus" ile tetiklenen
  // sonraki yenilemeler her zaman güncel veriyi ağdan çekiyor.
  const prefetch = usePrefetch();
  const usedFriendsPrefetch = useRef(false);
  const usedActivityPrefetch = useRef(false);

  const loadFriends = useCallback(async () => {
    if (!usedFriendsPrefetch.current && prefetch.friends) {
      usedFriendsPrefetch.current = true;
      setFriends(prefetch.friends);
      setLoading(false);
      return;
    }
    usedFriendsPrefetch.current = true;
    setLoading(true);
    try {
      const friendsData = await api.friends(auth.token);
      setFriends(friendsData.friends || []);
    } catch { /* sessizce geç */ }
    setLoading(false);
  }, [auth.token, prefetch.friends]);

  const loadActivity = useCallback(() => {
    if (!usedActivityPrefetch.current && prefetch.activity) {
      usedActivityPrefetch.current = true;
      setActivity(prefetch.activity);
      setActivityLoading(false);
      return Promise.resolve();
    }
    usedActivityPrefetch.current = true;
    // ÖNEMLİ: Promise'i döndürüyoruz — "aşağı çekince yenile" gibi çağıran yerler gerçekten
    // veri gelene kadar bekleyebilsin diye.
    return api.activityFeed(auth.token).then((data) => setActivity(data.results || [])).catch(() => {}).finally(() => setActivityLoading(false));
  }, [auth.token, prefetch.activity]);

  // ÖNEMLİ DÜZELTME: Bu, daha önce loadActivity'den YUKARIDA tanımlıydı ama dependency array'i
  // loadActivity'ye referans veriyordu — const'ların temporal dead zone'u yüzünden bu, HER
  // render'da "Cannot access 'loadActivity' before initialization" fırlatıp ekranı çökertiyordu.
  // Aşağı çekince yenileme (pull-to-refresh) — iki sekme de kendi verisini tazeliyor, hangi
  // sekmedeysek onu çekiyoruz.
  const pull = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const tear = useRef(new Animated.Value(0)).current;
  const busyRef = useRef(false);
  const pulledRef = useRef(0);
  const [ticketTime, setTicketTime] = useState(nowLabel);
  const [ticketLabel, setTicketLabel] = useState("Biraz daha çek");

  const onPullRefresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setTicketTime(nowLabel());
    setTicketLabel("Yenileniyor…");
    setRefreshing(true);
    Animated.spring(drop, { toValue: TICKET_DROP, friction: 7, tension: 90, useNativeDriver: false }).start();
    try {
      // Fişin okunabilmesi için en az kısa bir an görünür kalsın.
      await Promise.all([
        sub === "chats" ? refreshUnread() : loadActivity(),
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]);
    } finally {
      setRefreshing(false);
      Animated.timing(tear, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(() => {
        drop.setValue(0);
        tear.setValue(0);
        setTicketLabel("Biraz daha çek");
        busyRef.current = false;
      });
    }
  }, [sub, refreshUnread, loadActivity, drop, tear]);

  const onListScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const pulled = y < 0 ? Math.min(140, -y) : 0;
    if (pulled === pulledRef.current) return;
    if (!pulledRef.current && pulled && !busyRef.current) setTicketTime(nowLabel());
    pulledRef.current = pulled;
    pull.setValue(pulled);
    if (!busyRef.current) setTicketLabel(pulled >= TICKET_ARM ? "Bırak, yenilensin" : "Biraz daha çek");
  }, [pull]);

  const ticketY = Animated.add(pull, drop).interpolate({ inputRange: [0, 140], outputRange: [-TICKET_H, -TICKET_H + 140], extrapolate: "clamp" });
  const tearX = tear.interpolate({ inputRange: [0, 1], outputRange: [0, 260] });
  const tearRotate = tear.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "26deg"] });
  const tearOpacity = tear.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });

  const loadLive = useCallback(() => (
    api.liveRooms(auth.token).then(setLiveData).catch(() => {}).finally(() => setLiveLoading(false))
  ), [auth.token]);
  const refreshLive = useCallback(async () => {
    setLiveRefreshing(true);
    await loadLive();
    setLiveRefreshing(false);
  }, [loadLive]);
  useEffect(() => {
    loadLive();
    const unsub = navigation.addListener("focus", loadLive);
    return unsub;
  }, [navigation, loadLive]);
  useEffect(() => {
    if (sub !== "live") return undefined;
    const id = setInterval(() => { if (navigation.isFocused()) loadLive(); }, 15000);
    return () => clearInterval(id);
  }, [sub, navigation, loadLive]);
  const liveCount = liveData?.live?.length || 0;

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => {
    const unsubFocus = navigation.addListener("focus", () => { loadFriends(); refreshUnread(); });
    return unsubFocus;
  }, [navigation, loadFriends, loadActivity, refreshUnread]);

  async function openWithFriend(friend) {
    const { chat_id } = await api.chatWith(auth.token, friend.id);
    navigation.navigate("ChatConversation", { chatId: chat_id, friendId: friend.id, friendName: friend.name, friendAvatar: friend.avatar_url });
  }

  function openGroup(g) {
    if (g.movies.length > 1) setGroupModal(g);
    else if (g.movies.length === 1) navigation.navigate("Detail", { movie: g.movies[0] });
  }

  // Gruplanmış beğeniler popup'ından bir filme gidip GERİ döndüğünde, düz aktivite sayfasına
  // değil, az önce açık olan popup'a geri dönsün diye — hangi grubun açık olduğunu burada
  // saklayıp ekran tekrar odaklanınca (focus) geri açıyoruz.
  const pendingReopenGroup = useRef(null);
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      if (pendingReopenGroup.current) {
        setGroupModal(pendingReopenGroup.current);
        pendingReopenGroup.current = null;
      }
    });
    return unsub;
  }, [navigation]);

  function openMovieFromGroup(movie) {
    pendingReopenGroup.current = groupModal;
    setGroupModal(null);
    navigation.navigate("Detail", { movie });
  }

  const chattedFriendIds = new Set(chats.map((ch) => ch.friend_id));
  const friendsWithoutChat = friends.filter((f) => !chattedFriendIds.has(f.id));
  const groupedActivity = groupActivity(activity);

  async function handleDeleteChat(item) {
    Alert.alert(
      "Sohbeti Sil",
      `${item.friend_name} ile olan sohbeti listenden kaldırmak istediğine emin misin? Mesajlar karşı tarafta kalmaya devam eder, yeni bir mesaj gelirse sohbet tekrar burada görünür.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil", style: "destructive", onPress: async () => {
            try { await api.deleteChat(auth.token, item.chat_id); refreshUnread(); } catch { /* sessizce geç */ }
          },
        },
      ]
    );
  }

  function renderChatRightActions(item, progress, dragX) {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.5], extrapolate: "clamp" });
    return (
      <TouchableOpacity style={styles.deleteAction} onPress={() => handleDeleteChat(item)}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Trash2 size={18} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar />
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Sohbetler</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={sub === "live" ? refreshLive : onPullRefresh}
          accessibilityRole="button"
          accessibilityLabel="Yenile"
        >
          <RefreshCw size={17} color={c.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.tabsRow} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.tabBtn, sub === "chats" && styles.tabBtnActive]}
          onPress={() => setSub("chats")}
          accessibilityRole="tab"
          accessibilityState={{ selected: sub === "chats" }}
        >
          <Text style={[styles.tabLabel, sub === "chats" && styles.tabLabelActive]}>Sohbetler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, sub === "live" && styles.tabBtnActive]}
          onPress={() => { setSub("live"); loadLive(); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: sub === "live" }}
          accessibilityLabel={liveCount ? `Canlı, ${liveCount} açık oda` : "Canlı"}
        >
          <View style={styles.tabInner}>
            <Text style={[styles.tabLabel, sub === "live" && styles.tabLabelActive]}>Canlı</Text>
            {liveCount > 0 && (
              <View style={styles.liveCount}>
                <LiveDot color={c.danger} size={6} />
                <Text style={styles.liveCountText}>{liveCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
      {sub === "chats" && <View style={styles.slot}><View style={styles.slotLip} /></View>}
      <View style={{ flex: 1 }}>

      {sub === "live" ? (
        <LiveRoomsList
          data={liveData}
          loading={liveLoading}
          refreshing={liveRefreshing}
          onRefresh={refreshLive}
          onOpen={(room) => navigation.navigate("LiveRoom", { code: room.code })}
        />
      ) : sub === "chats" ? (
        // ÖNEMLİ: Burada "loading" state'i KULLANMIYORUZ — o, ilgisiz bir veri olan arkadaş
        // listesinin (/api/friends) çekimine bağlıydı, sohbetler sekmesinin kendi verisiyle
        // (chats) hiç alakası yoktu. "chats", UnreadContext üzerinden zaten SQLite'tan anında
        // geliyor ve arka planda sessizce tazeleniyor — bu yüzden burada hiçbir yükleme
        // ekranına gerek yok, doğrudan elimizdeki veriyi gösteriyoruz.
        (
          <FlatList
            contentContainerStyle={{ paddingTop: 6, paddingBottom: 24 }}
            data={chats}
            keyExtractor={(item) => String(item.chat_id)}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onPullRefresh}
                tintColor="transparent"
                colors={[c.accent]}
                progressBackgroundColor={c.surface}
              />
            )}
            renderItem={({ item }) => {
              const preview = messagePreviewInfo(item.last_message);
              const unread = item.unread_count > 0;
              const when = lastAtLabel(item.last_at);
              return (
                <Swipeable renderRightActions={(progress, dragX) => renderChatRightActions(item, progress, dragX)} overshootRight={false}>
                  <TouchableOpacity
                    style={styles.row}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate("ChatConversation", { chatId: item.chat_id, friendId: item.friend_id, friendName: item.friend_name, friendAvatar: item.friend_avatar })}
                    accessibilityLabel={`${item.friend_name}, ${preview.text}${when ? `, ${when}` : ""}${unread ? `, ${item.unread_count} okunmamış` : ""}`}
                  >
                    <RetryImage source={{ uri: avatarOr(item.friend_avatar, item.friend_id) }} style={styles.avatar} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>{item.friend_name}</Text>
                      <View style={styles.lastMessageRow}>
                        {!!preview.Icon && <preview.Icon size={14} color={preview.color} />}
                        <Text style={[styles.lastMessage, unread && { color: c.text, fontWeight: "600" }]} numberOfLines={1}>
                          {preview.text}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rowSide}>
                      {!!when && <Text style={[styles.time, unread && { color: c.accent }]}>{when}</Text>}
                      {unread && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            }}
            ListFooterComponent={
              friendsWithoutChat.length > 0 ? (
                <View style={styles.newChat}>
                  <Text style={styles.sectionLabel}>YENİ SOHBET BAŞLAT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
                    {friendsWithoutChat.map((f) => (
                      <TouchableOpacity key={f.id} style={styles.person} activeOpacity={0.75} onPress={() => openWithFriend(f)} accessibilityLabel={`${f.name} ile sohbet başlat`}>
                        <RetryImage source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.personAvatar} />
                        <Text style={styles.personName} numberOfLines={1}>{f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null
            }
            ListEmptyComponent={
              friendsWithoutChat.length === 0 ? (
                <View style={styles.emptyBox}>
                  <View style={styles.emptyIconWrap}><MessageCircle size={26} color={c.accent} /></View>
                  <Text style={styles.emptyTitle}>Henüz kimseyle sohbet etmiyorsun</Text>
                  <Text style={styles.emptyText}>Üstteki arkadaş ekleme butonuyla bir arkadaş bulup ilk mesajı sen at.</Text>
                </View>
              ) : null
            }
          />
        )
      ) : activityLoading ? (
        <ChatListSkeleton />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={groupedActivity}
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={c.accent} colors={[c.accent]} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={item.movies.length > 0 ? 0.75 : 1}
              onPress={() => openGroup(item)}
            >
              {/* Satırın geri kalanı hâlâ aktiviteye (filme) götürüyor — sadece avatar kendi
                  dokunma hedefi, kullanıcının profiline gidiyor. */}
              <TouchableOpacity onPress={() => navigation.navigate("OtherProfile", { userId: item.user.id })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <RetryImage source={{ uri: avatarOr(item.user.avatar_url, item.user.id) }} style={styles.avatar} />
              </TouchableOpacity>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{activityText(item)}</Text>
                {item.movies.length === 1 && <Text style={styles.lastMessage} numberOfLines={1}>{item.movies[0].title}</Text>}
                {item.movies.length > 1 && <Text style={styles.lastMessage}>Görmek için dokun</Text>}
              </View>
              <View style={styles.activityIconWrap}>
                {item.type === "like" && <Heart size={13} color={c.accent2} fill={c.accent2} />}
                {item.type === "list_created" && <ListPlus size={13} color={c.accent} />}
                {item.type === "favorite_set" && <Star size={13} color={c.accent} fill={c.accent} />}
              </View>
              {item.movies.length === 1 && item.movies[0].poster && <Image source={{ uri: item.movies[0].poster }} style={styles.activityPoster} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}><Activity size={26} color={c.accent} /></View>
              <Text style={styles.emptyTitle}>Henüz bir aktivite yok</Text>
              <Text style={styles.emptyText}>Arkadaşların bir şey beğendiğinde ya da liste oluşturduğunda burada göreceksin.</Text>
            </View>
          }
        />
      )}
        <View pointerEvents="none" style={styles.ticketClip}>
          <Animated.View style={[styles.ticket, { opacity: tearOpacity, transform: [{ translateY: ticketY }, { translateX: tearX }, { rotate: tearRotate }] }]}>
            <Text style={styles.ticketSmall}>PELLIX · SOHBET</Text>
            <Text style={styles.ticketTime}>{ticketTime}</Text>
            <Text style={styles.ticketLabel}>{ticketLabel}</Text>
            <View style={styles.ticketPerf} />
          </Animated.View>
        </View>
      </View>

      <Modal visible={!!groupModal} animationType="slide" transparent onRequestClose={() => setGroupModal(null)}>
        <TouchableWithoutFeedback onPress={() => setGroupModal(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <DismissableSheet onClose={() => setGroupModal(null)} style={styles.modalSheet} handleOnly>
                <View style={styles.modalHeader}>
                  <Text style={styles.title} numberOfLines={1}>{groupModal ? activityText(groupModal) : ""}</Text>
                  <TouchableOpacity onPress={() => setGroupModal(null)}><X size={20} color={c.text} /></TouchableOpacity>
                </View>
                <FlatList
                  data={groupModal?.movies || []}
                  numColumns={3}
                  keyExtractor={(m, i) => `${m.id}-${i}`}
                  columnWrapperStyle={{ gap: 8 }}
                  contentContainerStyle={{ gap: 8 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => openMovieFromGroup(item)}>
                      {item.poster ? <Image source={{ uri: item.poster }} style={styles.modalPoster} /> : <View style={[styles.modalPoster, { backgroundColor: c.surface2 }]} />}
                    </TouchableOpacity>
                  )}
                />
              </DismissableSheet>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    tabRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    tabsRow: { flexDirection: "row", marginHorizontal: 16, gap: 22, borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 8 },
    tabBtn: { minHeight: 40, justifyContent: "flex-end", paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
    tabBtnActive: { borderBottomColor: c.accent },
    tabInner: { flexDirection: "row", alignItems: "center", gap: 7 },
    tabLabel: { color: c.dim, fontSize: 20, fontFamily: FONTS.marqueeBold },
    tabLabelActive: { color: c.text },
    liveCount: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 1 },
    liveCountText: { color: c.danger, fontSize: 11, fontFamily: FONTS.monoMedium },
    card: {
      flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
    },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
    screenTitle: { color: c.text, fontSize: 36, fontFamily: FONTS.marquee },
    refreshBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    slot: { marginHorizontal: 16, height: 10, borderRadius: 5, backgroundColor: "#0a0908", borderBottomWidth: 1, borderBottomColor: c.border, zIndex: 3 },
    slotLip: { position: "absolute", top: -4, alignSelf: "center", width: 100, height: 3, borderRadius: 2, backgroundColor: c.accent, opacity: 0.55 },
    ticketClip: { position: "absolute", top: -5, left: 0, right: 0, height: 150, overflow: "hidden", alignItems: "center" },
    ticket: {
      width: 132, height: TICKET_H, backgroundColor: "#efe4cc", borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
      alignItems: "center", paddingTop: 12,
      shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 5,
    },
    ticketSmall: { fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1, color: "#2a2118", opacity: 0.7 },
    ticketTime: { fontFamily: FONTS.monoMedium, fontSize: 30, color: "#2a2118", marginTop: 4 },
    ticketLabel: { fontSize: 11.5, fontWeight: "700", color: "#2a2118", marginTop: 2 },
    ticketPerf: { position: "absolute", left: 0, right: 0, bottom: 18, borderTopWidth: 2, borderStyle: "dashed", borderColor: "rgba(42,33,24,0.4)" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: c.bg },
    rowSide: { alignItems: "flex-end", gap: 6, minWidth: 34 },
    time: { fontFamily: FONTS.mono, fontSize: 11, color: c.dim },
    avatar: { width: 50, height: 50, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 15, fontWeight: "600", color: c.text },
    lastMessageRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    lastMessage: { fontSize: 13, color: c.dim, flexShrink: 1 },
    unreadBadge: {
      minWidth: 20, height: 20, borderRadius: 999, backgroundColor: c.danger,
      alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
    },
    unreadBadgeText: { color: "#fff", fontSize: 11, fontFamily: FONTS.monoMedium },
    deleteAction: {
      backgroundColor: c.danger, justifyContent: "center", alignItems: "center", width: 72,
    },
    newChat: { paddingHorizontal: 16, paddingTop: 18 },
    peopleRow: { gap: 16, paddingTop: 12, paddingRight: 16 },
    person: { width: 60, alignItems: "center", gap: 6 },
    personAvatar: { width: 54, height: 54, borderRadius: 999, backgroundColor: c.surface2 },
    personName: { fontSize: 12, color: c.text, maxWidth: 60 },
    sectionLabel: { fontSize: 10.5, fontFamily: FONTS.monoMedium, color: c.dim, letterSpacing: 1 },
    emptyBox: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 30 },
    emptyIconWrap: { width: 56, height: 56, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    emptyTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 18 },
    activityIconWrap: { width: 28, height: 28, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    activityPoster: { width: 34, height: 48, borderRadius: 6, marginLeft: 4 },
    title: { fontSize: 15, fontWeight: "800", color: c.text, flex: 1, marginRight: 10 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "75%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    modalPoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
  });
}
