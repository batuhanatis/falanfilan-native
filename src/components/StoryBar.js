import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Plus } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../context/ThemeContext";
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
  const styles = makeStyles(c);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewer, setViewer] = useState(null); // { groups, startIndex }

  const hasMine = myStories && myStories.length > 0;

  function openViewerForFriend(index) {
    const groups = friends.map((f) => ({ user: f.user, stories: f.stories, isOwn: false }));
    setViewer({ groups, startIndex: index });
  }

  function openViewerForMine() {
    setViewer({ groups: [{ user: { avatar_url: myAvatar, name: "Sen" }, stories: myStories, isOwn: true }], startIndex: 0 });
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <View style={styles.item}>
          <TouchableOpacity
            style={styles.ringTouch}
            onPress={() => (hasMine ? openViewerForMine() : setComposerOpen(true))}
            activeOpacity={0.85}
          >
            <View style={styles.ring}>
              <RetryImage source={{ uri: avatarOr(myAvatar) }} style={styles.avatar} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBadge} onPress={() => setComposerOpen(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Plus size={12} color={c.bg} strokeWidth={3} />
          </TouchableOpacity>
          <Text style={styles.label} numberOfLines={1}>Sen</Text>
        </View>

        {friends.map((f, i) => (
          <TouchableOpacity key={f.user.id} style={styles.item} onPress={() => openViewerForFriend(i)} activeOpacity={0.85}>
            {f.hasUnseen ? (
              <LinearGradient colors={RING_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                <RetryImage source={{ uri: avatarOr(f.user.avatar_url) }} style={styles.avatar} />
              </LinearGradient>
            ) : (
              <View style={[styles.ring, styles.ringSeen]}>
                <RetryImage source={{ uri: avatarOr(f.user.avatar_url) }} style={styles.avatar} />
              </View>
            )}
            {f.hasUnseen ? (
              <Text style={styles.caption} numberOfLines={1}>{f.stories[f.stories.length - 1]?.movie?.title || f.user.name}</Text>
            ) : (
              <Text style={styles.label} numberOfLines={1}>{f.user.name}</Text>
            )}
          </TouchableOpacity>
        ))}
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
    ringTouch: { position: "relative" },
    ring: { width: 60, height: 60, borderRadius: 999, padding: 2.5, alignItems: "center", justifyContent: "center", backgroundColor: c.border },
    ringSeen: { backgroundColor: c.border },
    avatar: { width: "100%", height: "100%", borderRadius: 999, backgroundColor: c.surface2, borderWidth: 2.5, borderColor: c.bg },
    addBadge: { position: "absolute", bottom: 0, right: 0, width: 19, height: 19, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg },
    label: { fontSize: 10, color: c.dim, marginTop: 5, maxWidth: 62, textAlign: "center" },
    caption: { fontSize: 10, color: c.accent, fontWeight: "700", marginTop: 5, maxWidth: 62, textAlign: "center" },
  });
}
