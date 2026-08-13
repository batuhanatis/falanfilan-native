import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform } from "react-native";
import { PartyPopper, MessageCircle, CheckCircle2 } from "lucide-react-native";
import { useWS } from "../context/WSContext";
import { subscribeLocalEvents } from "../utils/localEvents";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../context/ThemeContext";
import { api } from "../api/client";
import { navigationRef } from "../navigation/RootNavigator";
import BadgeCelebrationOverlay from "./BadgeCelebrationOverlay";

const TOP_OFFSET = Platform.OS === "ios" ? 54 : 30;

// Uygulama AÇIKKEN gelen iki olayı, sistem push bildirimi yerine kendi uygulama-içi
// popup'larımızla gösteriyoruz — RootNavigator'ın içinde, navigasyon ağacının DIŞINDA
// (her ekranın üzerinde) tek bir kez render ediliyor:
//   - party_invite → Kabul Et/Reddet butonlu bir kart, kullanıcı yanıtlayana kadar ekranda kalır.
//   - message → kısa bir üst şerit, 1 saniye görünüp kendiliğinden kayboluyor.
// friend_request BİLEREK burada yok — o sadece TopBar'daki rozeti güncelliyor, ayrıca bir
// popup istenmedi.
export default function GlobalPopups() {
  const ws = useWS();
  const { auth } = useAuth();
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  const [invite, setInvite] = useState(null); // { sessionId, fromName, fromUser }
  const [responding, setResponding] = useState(false);
  const [banner, setBanner] = useState(null); // { senderName, preview }
  // Haftalık görev tamamlama kutlaması — mesaj şeridiyle AYNI "1 saniye görün, kendiliğinden
  // kaybol" mantığı, tıklanınca rozetler sayfasına götürüyor.
  const [celebration, setCelebration] = useState(null); // { kind: 'quest', title, desc }
  // PR2 — rozet kazanma artık bu küçük şeritle YETİNMİYOR, ayrı ve çok daha görkemli bir tam ekran
  // konfeti+kart anı alıyor (bkz. BadgeCelebrationOverlay) çünkü kalıcı bir başarı, geçip giden bir
  // mesaj bildirimiyle aynı ağırlıkta hissettirilmemeli.
  const [badgeCelebration, setBadgeCelebration] = useState(null); // { id, name, desc, icon }

  const inviteAnim = useRef(new Animated.Value(-220)).current;
  const bannerAnim = useRef(new Animated.Value(-120)).current;
  const bannerTimer = useRef(null);
  const celebrationAnim = useRef(new Animated.Value(-120)).current;
  const celebrationTimer = useRef(null);

  useEffect(() => {
    if (!ws?.subscribe) return;
    const unsub = ws.subscribe((msg) => {
      if (msg.type === "party_invite") {
        setInvite({ sessionId: msg.session_id, fromName: msg.from?.name || "Bir arkadaşın", fromUser: msg.from });
      } else if (msg.type === "message") {
        if (msg.from?.id === auth?.id) return; // kendi mesajının yansıması olmasın
        const body = msg.message?.body || "";
        let preview = body;
        if (body.startsWith("__PHOTO_MSG__")) preview = "📷 Fotoğraf gönderdi";
        else if (body.startsWith("__MOVIE_SHARE__")) preview = "🎬 Bir film/dizi paylaştı";
        else if (body.startsWith("__POLL__")) preview = "🗳️ Mini anket gönderdi";
        else if (body.startsWith("__PLAN__")) preview = "📅 İzleme planı önerdi";
        else if (body.startsWith("__LIST_SHARE__")) preview = "📋 Bir liste paylaştı";
        else preview = body.length > 60 ? body.slice(0, 60) + "…" : body;
        setBanner({ senderName: msg.from?.name || "Yeni mesaj", preview, chatId: msg.chat_id });
      } else if (msg.type === "badge_unlocked") {
        setBadgeCelebration(msg.badge);
      } else if (msg.type === "quest_completed") {
        setCelebration({ kind: "quest", title: "Görev tamamlandı! ✅", desc: msg.quest.title });
      } else if (msg.type === "watch_plan_due") {
        setBanner({ senderName: "İzleme Zamanı! 📅", preview: msg.note || "Planınızın zamanı geldi", chatId: msg.chat_id, tappable: true });
      }
    });
    return unsub;
  }, [ws, auth?.id]);

  // Cihaz içi (sunucudan bağımsız) olaylar — ör. "X, Y listesine eklendi" toast'ı, ya da bir
  // MatchParty davet bildirimine push üzerinden tıklanınca (App.js) tetiklenen davet kartı —
  // ikinci durumda WS'ten canlı gelen "party_invite" olayıyla AYNI kartı, aynı yolu kullanıyoruz.
  useEffect(() => {
    const unsub = subscribeLocalEvents((event) => {
      if (event.type === "toast") {
        setBanner({ senderName: event.title || "✅", preview: event.message, tappable: false });
      } else if (event.type === "party_invite") {
        setInvite({ sessionId: event.sessionId, fromName: event.fromUser?.name || "Bir arkadaşın", fromUser: event.fromUser });
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    Animated.spring(inviteAnim, { toValue: invite ? 0 : -220, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
  }, [invite]);

  useEffect(() => {
    if (!banner) return;
    Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: -120, duration: 220, useNativeDriver: true }).start(() => setBanner(null));
    }, 1000);
    return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); };
  }, [banner]);

  useEffect(() => {
    if (!celebration) return;
    Animated.spring(celebrationAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => {
      Animated.timing(celebrationAnim, { toValue: -120, duration: 220, useNativeDriver: true }).start(() => setCelebration(null));
    }, 1000);
    return () => { if (celebrationTimer.current) clearTimeout(celebrationTimer.current); };
  }, [celebration]);

  function closeBadgeCelebration() {
    setBadgeCelebration(null);
  }

  function openBadgeCelebration() {
    if (navigationRef.isReady()) {
      navigationRef.navigate("MainTabs", { screen: "Profile", params: { initialSub: "badges" } });
    }
    setBadgeCelebration(null);
  }

  function openCelebration() {
    if (!celebration || !navigationRef.isReady()) return;
    navigationRef.navigate("MainTabs", { screen: "Profile", params: { initialSub: "badges" } });
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    setCelebration(null);
  }

  async function respond(accept) {
    if (!invite || responding) return;
    setResponding(true);
    try {
      await api.respondParty(auth.token, invite.sessionId, accept);
      if (accept && navigationRef.isReady()) {
        navigationRef.navigate("MatchParty", { sessionId: invite.sessionId, friend: invite.fromUser });
      }
    } catch { /* sessizce geç */ }
    setResponding(false);
    setInvite(null);
  }

  return (
    <>
      {invite && (
        <Animated.View style={[styles.inviteCard, { transform: [{ translateY: inviteAnim }] }]}>
          <View style={styles.inviteRow}>
            <View style={styles.inviteIcon}><PartyPopper size={16} color="#fff" /></View>
            <Text style={styles.inviteText} numberOfLines={2}>{invite.fromName} seni MatchParty'e davet etti</Text>
          </View>
          <View style={styles.inviteActions}>
            <TouchableOpacity style={styles.declineBtn} onPress={() => respond(false)} disabled={responding}>
              <Text style={styles.declineText}>Reddet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(true)} disabled={responding}>
              <Text style={styles.acceptText}>Kabul Et</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      {banner && (
        <Animated.View style={[styles.banner, { transform: [{ translateY: bannerAnim }] }]} pointerEvents={banner.tappable ? "auto" : "none"}>
          {banner.tappable ? (
            <TouchableOpacity
              style={styles.bannerTouchable}
              activeOpacity={0.85}
              onPress={() => {
                if (navigationRef.isReady()) {
                  // App.js'teki push-bildirimi akışıyla AYNI düzeltme: Sohbetler sekmesi bu
                  // oturumda hiç ziyaret edilmediyse, ChatList'i temel olarak kurmadan doğrudan
                  // ChatConversation'a atlamak, geri tuşunun Ana Sayfa'ya düşmesine yol açıyordu.
                  // ÖNEMLİ DÜZELTME: Sabit 300ms yerine, navigasyon state'inin GERÇEKTEN
                  // değiştiğini dinleyip ikinci adımı ancak o zaman tetikliyoruz — cihaz
                  // hızından bağımsız, deterministik (bkz. App.js'teki aynı düzeltme).
                  navigationRef.navigate("MainTabs", { screen: "Chat", params: { screen: "ChatList" } });
                  const unsub = navigationRef.addListener("state", () => {
                    unsub();
                    navigationRef.navigate("MainTabs", { screen: "Chat", params: { screen: "ChatConversation", params: { chatId: banner.chatId } } });
                  });
                }
                setBanner(null);
              }}
            >
              <View style={styles.bannerIcon}><MessageCircle size={14} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerSender} numberOfLines={1}>{banner.senderName}</Text>
                <Text style={styles.bannerPreview} numberOfLines={1}>{banner.preview}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.bannerTouchable}>
              <View style={styles.bannerIcon}><MessageCircle size={14} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerSender} numberOfLines={1}>{banner.senderName}</Text>
                <Text style={styles.bannerPreview} numberOfLines={1}>{banner.preview}</Text>
              </View>
            </View>
          )}
        </Animated.View>
      )}
      {celebration && (
        <Animated.View style={[styles.celebration, { transform: [{ translateY: celebrationAnim }] }]}>
          <TouchableOpacity style={styles.celebrationTouchable} onPress={openCelebration} activeOpacity={0.85}>
            <View style={styles.celebrationIcon}>
              {celebration.kind === "badge" ? <Award size={16} color="#111" /> : <CheckCircle2 size={16} color="#111" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.celebrationTitle} numberOfLines={1}>{celebration.title}</Text>
              <Text style={styles.celebrationDesc} numberOfLines={1}>{celebration.desc}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
      {badgeCelebration && (
        <BadgeCelebrationOverlay
          badge={badgeCelebration}
          onClose={closeBadgeCelebration}
          onViewBadges={openBadgeCelebration}
        />
      )}
    </>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    inviteCard: {
      position: "absolute", top: TOP_OFFSET, left: 14, right: 14, zIndex: 100,
      backgroundColor: "#7C3AED", borderRadius: 18, padding: 14,
      shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 12,
    },
    inviteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    inviteIcon: { width: 30, height: 30, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
    inviteText: { flex: 1, color: "#fff", fontSize: 13, fontWeight: "700" },
    inviteActions: { flexDirection: "row", gap: 8, marginTop: 12 },
    declineBtn: { flex: 1, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 10, paddingVertical: 9, alignItems: "center" },
    declineText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
    acceptBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 10, paddingVertical: 9, alignItems: "center" },
    acceptText: { color: "#7C3AED", fontWeight: "800", fontSize: 12.5 },

    banner: {
      position: "absolute", top: TOP_OFFSET, left: 14, right: 14, zIndex: 100,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
    },
    bannerTouchable: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    bannerIcon: { width: 28, height: 28, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    bannerSender: { fontSize: 12.5, fontWeight: "800", color: c.text },
    bannerPreview: { fontSize: 11.5, color: c.dim, marginTop: 1 },

    celebration: {
      position: "absolute", top: TOP_OFFSET, left: 14, right: 14, zIndex: 100,
      backgroundColor: "#FFC93C", borderRadius: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 12,
    },
    celebrationTouchable: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    celebrationIcon: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
    celebrationTitle: { fontSize: 12.5, fontWeight: "800", color: "#111" },
    celebrationDesc: { fontSize: 11.5, color: "#111", opacity: 0.75, marginTop: 1 },
  });
}
