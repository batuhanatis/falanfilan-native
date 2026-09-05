import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Animated, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { UserPlus, Bell } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";

export default function TopBar({ centerLabel, leftAction = null }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const navigation = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const styles = makeStyles(c);

  const refresh = useCallback(() => {
    api.notifications(auth.token).then((data) => setUnreadCount((data.results || []).filter((n) => !n.read).length)).catch(() => {});
    api.friends(auth.token).then((data) => setPendingRequests((data.requests || []).length)).catch(() => {});
  }, [auth.token]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if ([
        "friend_request", "friend_accepted",
        "party_invite", "party_accepted", "party_declined", "party_match",
        "friend_battle_invite", "friend_battle_turn", "friend_battle_result",
      ].includes(msg.type)) refresh();
    });
    return unsub;
  }, [subscribe, refresh]);

  return (
    <View style={styles.bar}>
      <View style={styles.barSide}>
        {leftAction ? (
          <TouchableOpacity style={styles.iconBtn} onPress={leftAction.onPress} accessibilityRole="button" accessibilityLabel={leftAction.accessibilityLabel}>
            {leftAction.icon}
          </TouchableOpacity>
        ) : (
          <Text style={styles.logo}>pell<Text style={{ color: c.accent }}>i</Text>x</Text>
        )}
      </View>

      <View style={styles.barCenter}>
        {!!centerLabel && <Text style={styles.centerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{centerLabel}</Text>}
      </View>

      <View style={[styles.barSide, styles.barSideRight]}>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("FriendSearch")}>
            <UserPlus size={16} color={c.text} />
            <BadgeCount count={pendingRequests} styles={styles} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Notifications")}>
            <Bell size={16} color={c.text} />
            <BadgeCount count={unreadCount} styles={styles} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function BadgeCount({ count, styles }) {
  const scale = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const prevPositive = useRef(count > 0);
  useEffect(() => {
    const isPositive = count > 0;
    if (isPositive && !prevPositive.current) {
      scale.setValue(0);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 16 }).start();
    } else {
      scale.setValue(isPositive ? 1 : 0);
    }
    prevPositive.current = isPositive;
  }, [count > 0]);

  if (count <= 0) return null;
  return (
    <Animated.View style={[styles.badge, count > 9 ? styles.badgeWide : null, { transform: [{ scale }] }]}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </Animated.View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 54, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg },
    barSide: { flex: 1, flexDirection: "row", alignItems: "center" },
    barSideRight: { justifyContent: "flex-end" },
    barCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
    logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 22, color: c.text, letterSpacing: 0.2 },
    centerLabel: { fontFamily: "Baloo2_800ExtraBold", fontSize: 22, color: c.text, letterSpacing: 0.2, textAlign: "center" },
    actions: { flexDirection: "row", gap: 10 },
    iconBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    badge: { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 999, backgroundColor: c.danger, borderWidth: 1.5, borderColor: c.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
    badgeWide: { minWidth: 18, paddingHorizontal: 3 },
    badgeText: { fontSize: 9, fontWeight: "800", color: "#fff", includeFontPadding: false },
  });
}
