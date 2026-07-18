import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Sun, Moon, UserPlus, Bell } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import FriendSearchModal from "./FriendSearchModal";
import NotificationsModal from "./NotificationsModal";

export default function TopBar() {
  const { c, mode, setMode } = useAppTheme();
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const navigation = useNavigation();
  const [showFriendSearch, setShowFriendSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const styles = makeStyles(c);

  const refresh = useCallback(() => {
    api.notifications(auth.token).then((data) => setNotifications(data.results || [])).catch(() => {});
  }, [auth.token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (["friend_request", "friend_accepted", "party_invite", "party_accepted", "party_declined", "party_match"].includes(msg.type)) refresh();
    });
    return unsub;
  }, [subscribe, refresh]);

  function openNotifications() {
    setShowNotifications(true);
    api.markAllRead(auth.token).then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }).catch(() => {});
  }

  async function respondPartyInvite(sessionId, accept, fromUser) {
    try {
      await api.respondParty(auth.token, sessionId, accept);
      setNotifications((prev) => prev.filter((n) => !(n.type === "party_invite" && n.payload?.session_id === sessionId)));
      if (accept) {
        setShowNotifications(false);
        navigation.navigate("MatchParty", { sessionId, friend: fromUser });
      }
    } catch { /* sessizce geç */ }
  }

  function openParty(sessionId, user) {
    setShowNotifications(false);
    navigation.navigate("MatchParty", { sessionId, friend: user });
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <View style={styles.bar}>
      <Text style={styles.logo}>
        Falan<Text style={{ color: c.accent }}>Filan</Text>
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setMode(mode === "dark" ? "light" : "dark")}>
          {mode === "dark" ? <Sun size={16} color={c.text} /> : <Moon size={16} color={c.text} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowFriendSearch(true)}>
          <UserPlus size={16} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={openNotifications}>
          <Bell size={16} color={c.text} />
          {hasUnread && <View style={styles.badge} />}
        </TouchableOpacity>
      </View>

      <FriendSearchModal visible={showFriendSearch} onClose={() => setShowFriendSearch(false)} />
      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onRespondPartyInvite={respondPartyInvite}
        onOpenParty={openParty}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 18, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg,
    },
    logo: { fontSize: 20, fontWeight: "700", color: c.text },
    actions: { flexDirection: "row", gap: 10 },
    iconBtn: {
      width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2,
      borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center",
    },
    badge: {
      position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 999,
      backgroundColor: c.danger, borderWidth: 1.5, borderColor: c.bg,
    },
  });
}
