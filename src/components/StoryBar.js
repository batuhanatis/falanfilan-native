import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { Check, Plus, UserPlus } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { FONTS } from "../theme/fonts";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import RetryImage from "./RetryImage";
import StoryComposer from "./StoryComposer";
import StoryViewer from "./StoryViewer";
import { avatarOr } from "../utils/avatar";

// Şerit bir sinema salonundaki koltuk sırası gibi: story'si olan arkadaş koltuğunda oturuyor ve
// izlenmemiş story'si varsa yüzüne perdenin ışığı vuruyor (titreyen sıcak bir hale). İzlenmiş
// olanların ışığı sönük. Koltuklar fiziksel nesne olduğu için iki temada da aynı kadife renginde.
const VELVET = { back: "#7a2428", seat: "#651d21", arm: "#3a2a22", leg: "#2a2018" };

function Chair() {
  return (
    <Svg width={60} height={58} viewBox="0 0 60 58" style={seatStyles.chair}>
      <Path d="M10 6 Q10 0 16 0 H44 Q50 0 50 6 V40 H10 Z" fill={VELVET.back} />
      <Path d="M12 6 Q12 2 17 2 H43 Q48 2 48 6 V10 H12 Z" fill="#ffffff" opacity={0.07} />
      <Rect x={2} y={26} width={8} height={26} rx={3} fill={VELVET.arm} />
      <Rect x={50} y={26} width={8} height={26} rx={3} fill={VELVET.arm} />
      <Rect x={8} y={38} width={44} height={14} rx={4} fill={VELVET.seat} />
      <Rect x={14} y={52} width={4} height={6} fill={VELVET.leg} />
      <Rect x={42} y={52} width={4} height={6} fill={VELVET.leg} />
    </Svg>
  );
}

// Perdeden yansıyan ışık: düzensiz aralıklarla hafifçe titreyen sıcak bir hale.
function ScreenGlow({ id, phase = 0 }) {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    let loop = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      const step = (toValue, duration) => Animated.timing(opacity, { toValue, duration, useNativeDriver: true });
      loop = Animated.loop(Animated.sequence([
        Animated.delay(phase),
        step(0.32, 240), step(0.62, 170), step(0.42, 520), step(0.7, 280), step(0.5, 640),
      ]));
      loop.start();
    }).catch(() => {});
    return () => { cancelled = true; loop?.stop(); };
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[seatStyles.glow, { opacity }]}>
      <Svg width={84} height={84}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffe3a3" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#ffe3a3" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={42} cy={42} r={42} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Seat({ avatarUri, glowId, glowPhase, lit, label, labelAccent, onPress, accessibilityLabel, badge, styles }) {
  return (
    <TouchableOpacity style={seatStyles.seat} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Chair />
      {lit && <ScreenGlow id={glowId} phase={glowPhase} />}
      <View style={seatStyles.head}>
        <RetryImage source={{ uri: avatarUri }} style={[styles.avatar, !lit && styles.avatarDim]} />
        {badge}
      </View>
      <Text style={[styles.label, labelAccent && styles.caption]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// Arkadaşların "şu an bunu izliyorum" story'lerini gösteren yatay şerit — StoryComposer
// (paylaşma) ve StoryViewer'ı (izleme) kendi içinde açıp kapatıyor, ActivityScreen sadece
// veriyi (myStories/friends) ve bir değişiklik olduğunda yenilemesi için onChanged'i veriyor.
export default function StoryBar({ myAvatar, myStories, friends, navigation, onChanged }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewer, setViewer] = useState(null); // { groups, startIndex }
  const [suggestions, setSuggestions] = useState(null); // null = henüz çekilmedi
  const [requestedIds, setRequestedIds] = useState(() => new Set());
  // İzlenen story'yi sunucudan yeniden çekmeyi BEKLEMEDEN (ağ gecikmesi/yarış durumu olmadan)
  // anında gri gösterip sona atabilmek için — StoryViewer bir story'yi işaretlediği anda
  // bunu da güncelliyor, backend'e giden "görüldü" isteğinin süresine bağlı kalmıyoruz.
  const [locallySeen, setLocallySeen] = useState(() => new Set());

  const hasMine = myStories && myStories.length > 0;

  // Ham "friends" prop'u sunucudan geldiği haliyle (hasUnseen sunucunun bildiği son duruma göre)
  // — burada yerel override'ı da hesaba katıp yeniden sıralıyoruz: izlenmemiş olanlar öne,
  // aralarında en yeni story'si olan öne. Array.prototype.sort kararlı (stable) olduğu için
  // eşit durumdaki öğeler orijinal sırasını koruyor.
  const orderedFriends = useMemo(() => {
    const withStatus = friends.map((f) => ({
      ...f,
      stillUnseen: f.stories.some((s) => !s.seen && !locallySeen.has(s.id)),
    }));
    return withStatus.sort((a, b) => (a.stillUnseen === b.stillUnseen ? 0 : a.stillUnseen ? -1 : 1));
  }, [friends, locallySeen]);
  const noActiveStories = friends.length === 0;

  function markSeenLocally(storyId) {
    setLocallySeen((prev) => (prev.has(storyId) ? prev : new Set(prev).add(storyId)));
  }

  // Kimsenin aktif story'si yoksa o şerit boş kalıyordu — Instagram'daki gibi, aynı yatay
  // alanda "tanıyor olabileceklerin" önerileri gösteriyoruz. Sadece gerçekten gerektiğinde
  // (şerit boşken) çekiyoruz, her ActivityScreen açılışında değil.
  useEffect(() => {
    if (!noActiveStories || suggestions !== null) return;
    let cancelled = false;
    api.friendSuggestions(auth.token)
      .then((data) => { if (!cancelled) setSuggestions(data.results || []); })
      .catch(() => { if (!cancelled) setSuggestions([]); });
    return () => { cancelled = true; };
  }, [noActiveStories, suggestions, auth.token]);

  async function addSuggested(userId) {
    if (requestedIds.has(userId)) return;
    setRequestedIds((prev) => new Set(prev).add(userId));
    try {
      await api.friendRequest(auth.token, userId);
    } catch {
      setRequestedIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  }

  function openViewerForFriend(index) {
    const groups = orderedFriends.map((f) => ({ user: f.user, stories: f.stories, isOwn: false }));
    setViewer({ groups, startIndex: index });
  }

  function openViewerForMine() {
    setViewer({ groups: [{ user: { avatar_url: myAvatar, name: "Sen" }, stories: myStories, isOwn: true }], startIndex: 0 });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.rowLabel}>{noActiveStories ? "TANIYOR OLABİLECEKLERİN" : "ŞU AN İZLİYOR"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Seat
          styles={styles}
          avatarUri={avatarOr(myAvatar)}
          glowId="glow-me"
          lit={hasMine}
          label="Sen"
          onPress={() => (hasMine ? openViewerForMine() : setComposerOpen(true))}
          accessibilityLabel={hasMine ? "Story'ni gör" : "Ne izlediğini paylaş"}
          badge={(
            <TouchableOpacity style={styles.addBadge} onPress={() => setComposerOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Story ekle">
              <Plus size={12} color={c.bg} strokeWidth={3} />
            </TouchableOpacity>
          )}
        />

        {orderedFriends.map((f, i) => (
          <Seat
            key={f.user.id}
            styles={styles}
            avatarUri={avatarOr(f.user.avatar_url)}
            glowId={`glow-${f.user.id}`}
            glowPhase={(i % 4) * 230}
            lit={f.stillUnseen}
            label={f.stillUnseen ? (f.stories[f.stories.length - 1]?.movie?.title || f.user.name) : f.user.name}
            labelAccent={f.stillUnseen}
            onPress={() => openViewerForFriend(i)}
            accessibilityLabel={`${f.user.name}${f.stillUnseen ? ", yeni story" : ""}`}
          />
        ))}

        {noActiveStories && suggestions === null && (
          <View style={styles.suggestLoading}><ActivityIndicator size="small" color={c.dim} /></View>
        )}

        {noActiveStories && suggestions?.map((sg) => {
          const requested = requestedIds.has(sg.id);
          return (
            <Seat
              key={sg.id}
              styles={styles}
              avatarUri={avatarOr(sg.avatar_url)}
              lit={false}
              label={sg.name}
              onPress={() => navigation.navigate("OtherProfile", { userId: sg.id })}
              accessibilityLabel={`${sg.name}, profili aç`}
              badge={(
                <TouchableOpacity
                  style={[styles.addBadge, requested && styles.addBadgeDone]}
                  onPress={() => addSuggested(sg.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={requested}
                  accessibilityLabel={requested ? "İstek gönderildi" : "Arkadaş ekle"}
                >
                  {requested ? <Check size={11} color={c.bg} strokeWidth={3} /> : <UserPlus size={11} color={c.bg} strokeWidth={2.5} />}
                </TouchableOpacity>
              )}
            />
          );
        })}
      </ScrollView>

      <StoryComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={onChanged}
      />

      {viewer && (
        <StoryViewer
          groups={viewer.groups}
          startGroupIndex={viewer.startIndex}
          navigation={navigation}
          onStorySeen={markSeenLocally}
          onClose={() => { setViewer(null); onChanged?.(); }}
        />
      )}
    </View>
  );
}

const seatStyles = StyleSheet.create({
  seat: { width: 70, height: 112, alignItems: "center" },
  chair: { position: "absolute", left: 5, top: 30 },
  glow: { position: "absolute", top: -14, left: -7 },
  head: { marginTop: 6, width: 46, height: 46 },
});

function makeStyles(c) {
  return StyleSheet.create({
    wrap: { marginBottom: 6 },
    rowLabel: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1, color: c.dim, marginBottom: 6, marginLeft: 2 },
    row: { gap: 2, paddingRight: 6 },
    avatar: { width: 46, height: 46, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 2, borderColor: "#1c1a24" },
    avatarDim: { opacity: 0.82 },
    addBadge: { position: "absolute", bottom: -2, right: -4, width: 20, height: 20, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg },
    addBadgeDone: { backgroundColor: c.dim },
    label: { position: "absolute", bottom: 0, fontSize: 11, color: c.dim, maxWidth: 68, textAlign: "center" },
    caption: { color: c.accent, fontWeight: "700" },
    suggestLoading: { width: 70, height: 100, alignItems: "center", justifyContent: "center" },
  });
}
