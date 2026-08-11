import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { UserPlus, Bell } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";

// ÖNEMLİ: Bildirimler artık ayrı bir SAYFA (NotificationsScreen) — burada SADECE zil rozeti
// (okunmamış var mı) için hafif bir sorgu tutuyoruz, tam listeyi/aksiyonları (kabul/reddet/sil)
// artık o ekran kendi başına yönetiyor.
export default function TopBar({ centerLabel }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const navigation = useNavigation();
  const [hasUnread, setHasUnread] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const styles = makeStyles(c);

  const refresh = useCallback(() => {
    api.notifications(auth.token).then((data) => setHasUnread((data.results || []).some((n) => !n.read))).catch(() => {});
    api.friends(auth.token).then((data) => setPendingRequests((data.requests || []).length)).catch(() => {});
  }, [auth.token]);

  // Arkadaş arama/Bildirimler artık ayrı SAYFALAR — geri dönünce rozetler eskiden olduğu gibi
  // bir callback ile DEĞİL, bu ekran tekrar odaklanınca (focus) otomatik tazeleniyor. Bu ayrıca
  // Ayarlar/Engellenenler gibi başka pushed ekranlardan dönüşte de aynı faydayı sağlıyor.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (["friend_request", "friend_accepted", "party_invite", "party_accepted", "party_declined", "party_match"].includes(msg.type)) refresh();
    });
    return unsub;
  }, [subscribe, refresh]);

  return (
    <View style={styles.bar}>
      <View style={styles.barSide}>
        <Text style={styles.logo}>
          pell<Text style={{ color: c.accent }}>i</Text>x
        </Text>
      </View>

      <View style={styles.barCenter}>
        {!!centerLabel && (
          <Text style={styles.centerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {centerLabel}
          </Text>
        )}
      </View>

      <View style={[styles.barSide, styles.barSideRight]}>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("FriendSearch")}>
            <UserPlus size={16} color={c.text} />
            {pendingRequests > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Notifications")}>
            <Bell size={16} color={c.text} />
            {hasUnread && <View style={styles.badge} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 18, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg,
    },
    // Sol/orta/sağ üç bölüm de EŞİT genişlikte (flex:1) — bu sayede ortadaki başlık, sol/sağ
    // içeriğin gerçek genişliği ne olursa olsun (piksel tahmini yapmadan) ekranın TAM ortasında
    // duruyor. Bu, sabit sol/sağ boşluk vermeye çalışmaktan çok daha güvenilir bir teknik.
    barSide: { flex: 1, flexDirection: "row", alignItems: "center" },
    barSideRight: { justifyContent: "flex-end" },
    barCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
    logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 22, color: c.text, letterSpacing: 0.2 },
    centerLabel: {
      fontFamily: "Baloo2_800ExtraBold", fontSize: 22, color: c.text, letterSpacing: 0.2,
      textAlign: "center",
    },
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
