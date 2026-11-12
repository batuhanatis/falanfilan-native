import { t as translateUI } from "../i18n/core";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { MonoLabel, relativeTime, totalReactions } from "./social/feedKit";
import { ActivityLine } from "./social/PostObjects";
import { ApplauseSheet } from "./social/PostChrome";

// Otomatik üretilen etkinlikler (beğendi / favorisi / yeni liste) kutusuz satırlar halinde.
// Kullanıcının yazdığı bir şey taşımadıkları için büyük nesne almıyorlar; yine de alkışlanabilirler
// (sağdaki "ALKIŞ" yazısı, basılı tutunca alkışlayanlar). Ardışık etkinlikleri tek gruba toplama
// mantığı ActivityScreen'deki groupActivities()'te.
function ActivityRow({ item, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const movie = item.movies?.[0] || null;
  const [myReaction, setMyReaction] = useState(item.myReaction || null);
  const [reactionCounts, setReactionCounts] = useState(item.reactionCounts || {});
  const [listOpen, setListOpen] = useState(false);
  const total = totalReactions(reactionCounts);

  function open() {
    if (movie) navigation.navigate("Detail", { movie });
    else if (item.activityType === "list_created" && item.payload?.list_id) {
      navigation.navigate("WatchlistDetail", { watchlistId: item.payload.list_id, name: item.payload.list_name });
    }
  }

  function openProfile(id = item.user?.id) {
    if (!id) return;
    if (Number(id) === Number(auth.id)) navigation.navigate("MainTabs", { screen: "Profile" });
    else navigation.navigate("OtherProfile", { userId: id });
  }

  async function toggleApplause() {
    if (!item.activityId) return;
    try {
      const data = await api.socialReact(auth.token, "activity", item.activityId, myReaction || "fire");
      setMyReaction(data.myReaction || null);
      setReactionCounts(data.reactionCounts || {});
    } catch {}
  }

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <ActivityLine c={c} item={item} time={relativeTime(item.created_at)} onOpenProfile={() => openProfile()} onOpen={open} />
      </View>
      {!!item.activityId && (
        <Pressable
          onPress={toggleApplause}
          onLongPress={() => setListOpen(true)}
          delayLongPress={380}
          hitSlop={8}
          style={styles.clap}
          accessibilityRole="button"
          accessibilityState={{ selected: !!myReaction }}
          accessibilityLabel={myReaction ? translateUI("Alkışladın") : translateUI("Alkışla")}
        >
          <MonoLabel color={myReaction ? c.accent : c.dim}>{total > 0 ? translateUI("{0} ALKIŞ", { 0: total }) : translateUI("ALKIŞLA")}</MonoLabel>
        </Pressable>
      )}
      {!!item.activityId && (
        <ApplauseSheet c={c} visible={listOpen} kind="activity" targetId={item.activityId} onClose={() => setListOpen(false)} onOpenProfile={(id) => openProfile(id)} />
      )}
    </View>
  );
}

export default function SocialActivityGroup({ items, navigation }) {
  const { c } = useAppTheme();
  return (
    <View style={[styles.group, { borderBottomColor: c.border }]}>
      <MonoLabel color={c.dim} style={styles.label}>{translateUI("ETKİNLİKLER")}</MonoLabel>
      {items.map((item) => (
        <ActivityRow key={item.feedKey || item.id} item={item} navigation={navigation} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  clap: { minHeight: 44, justifyContent: "center", paddingLeft: 4 },
});
