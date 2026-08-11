import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from "react-native";
import { ChevronLeft, Ban } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";

export default function BlockedUsersScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.blockedUsers(auth.token).then((data) => setBlocked(data.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);

  function unblock(user) {
    Alert.alert("Engeli Kaldır", `${user.name} kişisinin engelini kaldırmak istediğine emin misin?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kaldır", onPress: async () => {
          setBlocked((prev) => prev.filter((u) => u.id !== user.id));
          try { await api.unblockUser(auth.token, user.id); } catch { load(); }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Engellenen Kullanıcılar</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={c.accent} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={blocked}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <RetryImage source={{ uri: avatarOr(item.avatar_url, item.id) }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.username && <Text style={styles.username}>@{item.username}</Text>}
              </View>
              <TouchableOpacity style={styles.unblockBtn} onPress={() => unblock(item)}>
                <Text style={styles.unblockBtnText}>Engeli Kaldır</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}><Ban size={24} color={c.accent} /></View>
              <Text style={styles.emptyText}>Henüz kimseyi engellemedin.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    row: {
      flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginBottom: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14,
    },
    avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13, fontWeight: "700", color: c.text },
    username: { fontSize: 11, color: c.dim, marginTop: 1 },
    unblockBtn: { backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    unblockBtnText: { fontSize: 11, fontWeight: "700", color: c.text },
    emptyBox: { alignItems: "center", paddingVertical: 50 },
    emptyIconWrap: { width: 52, height: 52, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    emptyText: { color: c.dim, fontSize: 12 },
  });
}
