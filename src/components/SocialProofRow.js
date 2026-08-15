import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Heart } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

export default function SocialProofRow({ stats, overlay = false, compact = false }) {
  const { c } = useAppTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const friends = Array.isArray(stats?.friendLikes) ? stats.friendLikes.slice(0, 3) : [];
  const friendCount = Number(stats?.friendCount || (stats?.friendName ? 1 : friends.length) || 0);
  const totalLikes = Number(stats?.likes || 0);
  const firstName = friends[0]?.name || stats?.friendName || "Bir arkadaşın";

  if (totalLikes <= 0 && friendCount <= 0) return null;

  let label;
  if (friendCount > 1) label = `${firstName} ve ${friendCount - 1} arkadaşın daha beğendi`;
  else if (friendCount === 1) label = `${firstName} bunu beğendi`;
  else label = `Pellix'te ${totalLikes.toLocaleString("tr-TR")} kişi beğendi`;

  return (
    <View style={[styles.row, overlay && styles.rowOverlay, compact && styles.rowCompact]}>
      {friends.length > 0 ? (
        <View style={styles.avatars}>
          {friends.map((friend, index) => (
            <RetryImage
              key={friend.id || `${friend.name}-${index}`}
              source={{ uri: avatarOr(friend.avatar_url, friend.id) }}
              style={[
                styles.avatar,
                compact && styles.avatarCompact,
                index > 0 && styles.avatarOverlap,
                { zIndex: friends.length - index },
              ]}
            />
          ))}
        </View>
      ) : (
        <Heart
          size={compact ? 11 : 13}
          color={overlay ? "#fff" : c.accent2}
          fill={overlay ? "#fff" : c.accent2}
        />
      )}
      <Text
        style={[styles.label, overlay && styles.labelOverlay, compact && styles.labelCompact]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      minHeight: 34,
      maxWidth: "100%",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowOverlay: {
      backgroundColor: "rgba(0,0,0,0.48)",
      borderColor: "rgba(255,255,255,0.18)",
    },
    rowCompact: { minHeight: 30, paddingHorizontal: 8, paddingVertical: 5, gap: 6 },
    avatars: { flexDirection: "row", alignItems: "center", paddingRight: 1 },
    avatar: {
      width: 23,
      height: 23,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.surface,
      backgroundColor: c.surface2,
    },
    avatarCompact: { width: 20, height: 20 },
    avatarOverlap: { marginLeft: -7 },
    label: { flexShrink: 1, color: c.text, fontSize: 11.5, fontWeight: "700" },
    labelOverlay: { color: "#fff", textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 3 },
    labelCompact: { fontSize: 10.5 },
  });
}
