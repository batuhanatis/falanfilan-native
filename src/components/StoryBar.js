import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Plus, UserPlus } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import RetryImage from "./RetryImage";
import StoryComposer from "./StoryComposer";
import StoryViewer from "./StoryViewer";
import { avatarOr } from "../utils/avatar";

const RING_GRADIENT = ["#FF3D81", "#8B5CF6", "#6fc4b3"];

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <View style={styles.item}>
          <View style={styles.ringWrap}>
            <TouchableOpacity onPress={() => (hasMine ? openViewerForMine() : setComposerOpen(true))} activeOpacity={0.85}>
              <View style={styles.ring}>
                <RetryImage source={{ uri: avatarOr(myAvatar) }} style={styles.avatar} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBadge} onPress={() => setComposerOpen(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Plus size={12} color={c.bg} strokeWidth={3} />
            </TouchableOpacity>
          </View>
          <Text style={styles.label} numberOfLines={1}>Sen</Text>
        </View>

        {orderedFriends.map((f, i) => (
          <TouchableOpacity key={f.user.id} style={styles.item} onPress={() => openViewerForFriend(i)} activeOpacity={0.85}>
            {f.stillUnseen ? (
              <LinearGradient colors={RING_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                <RetryImage source={{ uri: avatarOr(f.user.avatar_url) }} style={styles.avatar} />
              </LinearGradient>
            ) : (
              <View style={[styles.ring, styles.ringSeen]}>
                <RetryImage source={{ uri: avatarOr(f.user.avatar_url) }} style={styles.avatar} />
              </View>
            )}
            {f.stillUnseen ? (
              <Text style={styles.caption} numberOfLines={1}>{f.stories[f.stories.length - 1]?.movie?.title || f.user.name}</Text>
            ) : (
              <Text style={styles.label} numberOfLines={1}>{f.user.name}</Text>
            )}
          </TouchableOpacity>
        ))}

        {noActiveStories && suggestions === null && (
          <View style={styles.suggestLoading}><ActivityIndicator size="small" color={c.dim} /></View>
        )}

        {noActiveStories && suggestions?.map((s) => {
          const requested = requestedIds.has(s.id);
          return (
            <TouchableOpacity
              key={s.id}
              style={styles.item}
              onPress={() => navigation.navigate("OtherProfile", { userId: s.id })}
              activeOpacity={0.85}
            >
              <View style={styles.ringWrap}>
                <View style={[styles.ring, styles.ringSeen]}>
                  <RetryImage source={{ uri: avatarOr(s.avatar_url) }} style={styles.avatar} />
                </View>
                <TouchableOpacity
                  style={[styles.addBadge, requested && styles.addBadgeDone]}
                  onPress={() => addSuggested(s.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  disabled={requested}
                >
                  {requested ? <Check size={11} color={c.bg} strokeWidth={3} /> : <UserPlus size={11} color={c.bg} strokeWidth={2.5} />}
                </TouchableOpacity>
              </View>
              <Text style={styles.label} numberOfLines={1}>{s.name}</Text>
            </TouchableOpacity>
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

function makeStyles(c) {
  return StyleSheet.create({
    wrap: { marginBottom: 14 },
    row: { gap: 14, paddingRight: 6 },
    item: { width: 62, alignItems: "center" },
    ringWrap: { width: 60, height: 60 },
    ring: { width: 60, height: 60, borderRadius: 999, padding: 2.5, alignItems: "center", justifyContent: "center", backgroundColor: c.border },
    ringSeen: { backgroundColor: c.border },
    avatar: { width: "100%", height: "100%", borderRadius: 999, backgroundColor: c.surface2, borderWidth: 2.5, borderColor: c.bg },
    addBadge: { position: "absolute", bottom: -2, right: -2, width: 19, height: 19, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg },
    addBadgeDone: { backgroundColor: c.dim },
    label: { fontSize: 10, color: c.dim, marginTop: 5, maxWidth: 62, textAlign: "center" },
    caption: { fontSize: 10, color: c.accent, fontWeight: "700", marginTop: 5, maxWidth: 62, textAlign: "center" },
    suggestLoading: { width: 62, height: 60, alignItems: "center", justifyContent: "center" },
  });
}
