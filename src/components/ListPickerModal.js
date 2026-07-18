import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { X, Check } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function ListPickerModal({ movie, onClose }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [lists, setLists] = useState([]);
  const [memberOf, setMemberOf] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.watchlists(auth.token);
        const listResults = data.results || [];
        setLists(listResults);
        const memberships = await Promise.all(
          listResults.map((l) =>
            api.watchlistItems(auth.token, l.id)
              .then((x) => (x.results || []).some((m) => m.id === movie.id) ? l.id : null)
              .catch(() => null)
          )
        );
        setMemberOf(new Set(memberships.filter(Boolean)));
      } catch { /* sessizce geç */ }
      setLoading(false);
    })();
  }, []);

  async function toggleList(listId) {
    const isMember = memberOf.has(listId);
    setMemberOf((prev) => { const n = new Set(prev); isMember ? n.delete(listId) : n.add(listId); return n; });
    try {
      if (isMember) await api.removeFromWatchlist(auth.token, listId, movie.id);
      else await api.addToWatchlist(auth.token, listId, movie.id);
    } catch { /* sessizce geç */ }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{movie.title} — bir listeye ekle</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={c.accent} style={{ marginVertical: 20 }} />
          ) : lists.length === 0 ? (
            <Text style={styles.emptyText}>Henüz bir listen yok. Profilinden "Yeni Liste" oluşturabilirsin.</Text>
          ) : (
            lists.map((l) => (
              <TouchableOpacity key={l.id} style={styles.row} onPress={() => toggleList(l.id)}>
                <Text style={styles.rowText}>{l.name}</Text>
                {memberOf.has(l.id) && <Check size={16} color={c.accent} />}
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 },
    title: { flex: 1, fontSize: 14, fontWeight: "800", color: c.text },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
    rowText: { fontSize: 13, color: c.text },
    emptyText: { color: c.dim, fontSize: 12, paddingVertical: 10 },
  });
}
