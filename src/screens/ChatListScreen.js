import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Modal, Animated, Alert, TouchableWithoutFeedback, RefreshControl } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { MessageCircle, Heart, ListPlus, Star, Activity, X, Trash2 } from "lucide-react-native";
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
function messagePreviewInfo(lastMessage) {
  const shared = decodeMovieShare(lastMessage);
  if (shared) return { text: shared.type === "Dizi" ? "Dizi Önerisi" : "Film Önerisi", dotColor: shared.type === "Dizi" ? "#0EA5E9" : "#8B5CF6" };
  if (decodePhotoMessage(lastMessage)) return { text: "📷 Fotoğraf", dotColor: null };
  if (decodePoll(lastMessage)) return { text: "Mini Anket", dotColor: "#F97316" };
  if (decodePlan(lastMessage)) return { text: "İzleme Planı", dotColor: "#06B6D4" };
  if (decodeListShare(lastMessage)) return { text: "Liste Paylaşıldı", dotColor: "#14B8A6" };
  if (decodeActivityShare(lastMessage)) return { text: "Aktivite Paylaşıldı", dotColor: "#EC4899" };
  if (decodeStoryReply(lastMessage)) return { text: "💬 Story'ye Yanıt", dotColor: "#F59E0B" };
  return { text: lastMessage || "Henüz mesaj yok", dotColor: null };
}

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

  const [sub, setSub] = useState("chats"); // "chats" | "activity"
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
  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (sub === "chats") await refreshUnread();
      else await loadActivity();
    } finally {
      setRefreshing(false);
    }
  }, [sub, refreshUnread, loadActivity]);

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
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "900" }}>Sohbetler</Text>
        <Text style={{ color: c.dim, fontSize: 10.5, marginTop: 2 }}>Arkadaş aktiviteleri artık Ana Sayfa’daki sosyal akışta.</Text>
      </View>

      {sub === "chats" ? (
        // ÖNEMLİ: Burada "loading" state'i KULLANMIYORUZ — o, ilgisiz bir veri olan arkadaş
        // listesinin (/api/friends) çekimine bağlıydı, sohbetler sekmesinin kendi verisiyle
        // (chats) hiç alakası yoktu. "chats", UnreadContext üzerinden zaten SQLite'tan anında
        // geliyor ve arka planda sessizce tazeleniyor — bu yüzden burada hiçbir yükleme
        // ekranına gerek yok, doğrudan elimizdeki veriyi gösteriyoruz.
        (
          <FlatList
            contentContainerStyle={{ padding: 16 }}
            data={chats}
            keyExtractor={(item) => String(item.chat_id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={c.accent} colors={[c.accent]} />}
            renderItem={({ item }) => (
              <Swipeable renderRightActions={(progress, dragX) => renderChatRightActions(item, progress, dragX)} overshootRight={false}>
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate("ChatConversation", { chatId: item.chat_id, friendId: item.friend_id, friendName: item.friend_name, friendAvatar: item.friend_avatar })}
                >
                  <RetryImage source={{ uri: avatarOr(item.friend_avatar, item.friend_id) }} style={styles.avatar} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name}>{item.friend_name}</Text>
                    {(() => {
                      const preview = messagePreviewInfo(item.last_message);
                      return (
                        <View style={styles.lastMessageRow}>
                          {!!preview.dotColor && <View style={[styles.lastMessageDot, { backgroundColor: preview.dotColor }]} />}
                          <Text style={[styles.lastMessage, item.unread_count > 0 && { color: c.text, fontWeight: "600" }]} numberOfLines={1}>
                            {preview.text}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                  {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Swipeable>
            )}
            ListFooterComponent={
              friendsWithoutChat.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>YENİ SOHBET BAŞLAT</Text>
                  {friendsWithoutChat.map((f) => (
                    <TouchableOpacity key={f.id} style={styles.card} activeOpacity={0.75} onPress={() => openWithFriend(f)}>
                      <RetryImage source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.avatar} />
                      <Text style={styles.name}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
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
        <ActivityIndicator style={{ marginTop: 30 }} color={c.accent} />
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
    tabBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border },
    tabText: { fontSize: 12, fontWeight: "700", color: c.text },
    card: {
      flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
    },
    avatar: { width: 46, height: 46, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13, fontWeight: "700", color: c.text },
    lastMessageRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
    lastMessageDot: { width: 6, height: 6, borderRadius: 999 },
    lastMessage: { fontSize: 12, color: c.dim, flexShrink: 1 },
    unreadBadge: {
      minWidth: 22, height: 22, borderRadius: 999, backgroundColor: c.danger,
      alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
    },
    unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
    deleteAction: {
      backgroundColor: c.danger, justifyContent: "center", alignItems: "center",
      width: 64, borderRadius: 16, marginTop: 8,
    },
    sectionLabel: { fontSize: 11, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginTop: 20, marginBottom: 4 },
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
