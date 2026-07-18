import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

function notificationText(n) {
  const p = n.payload || {};
  switch (n.type) {
    case "friend_request": return `${p.from?.name} arkadaşlık isteği gönderdi`;
    case "friend_accepted": return `${p.by?.name} arkadaşlık isteğini kabul etti`;
    case "party_invite": return `${p.from?.name} MatchParty daveti gönderdi`;
    case "party_accepted": return `${p.by?.name} MatchParty davetini kabul etti — başlıyor!`;
    case "party_declined": return `${p.by?.name} MatchParty davetini reddetti`;
    case "party_match": return `MatchParty'de bir eşleşme buldun: ${p.movie?.title} 🎉`;
    default: return "Yeni bildirim";
  }
}

export default function NotificationsModal({ visible, onClose, notifications, onRespondPartyInvite, onOpenParty }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [busyIds, setBusyIds] = useState(new Set());

  async function handleRespond(n, accept) {
    const sessionId = n.payload?.session_id;
    if (!sessionId) return;
    setBusyIds((prev) => new Set([...prev, n.id]));
    await onRespondPartyInvite(sessionId, accept, n.payload?.from);
  }

  function handleTap(n) {
    const p = n.payload || {};
    if (n.type === "party_accepted" && p.session_id) onOpenParty(p.session_id, p.by);
    else if (n.type === "party_match" && p.session_id) onOpenParty(p.session_id, null);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Bildirimler</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const isPartyInvite = item.type === "party_invite" && !busyIds.has(item.id);
              const clickable = item.type === "party_accepted" || item.type === "party_match";
              return (
                <TouchableOpacity
                  style={[styles.row, !item.read && { backgroundColor: c.surface2 }]}
                  onPress={clickable ? () => handleTap(item) : undefined}
                  activeOpacity={clickable ? 0.7 : 1}
                >
                  <Text style={styles.text}>{notificationText(item)}</Text>
                  {isPartyInvite && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(item, true)}>
                        <Text style={styles.acceptText}>Kabul Et</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(item, false)}>
                        <Text style={styles.declineText}>Reddet</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {busyIds.has(item.id) && item.type === "party_invite" && <ActivityIndicator size="small" color={c.accent} style={{ marginTop: 6 }} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Henüz bildirim yok.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "75%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { fontSize: 16, fontWeight: "800", color: c.text },
    row: { padding: 12, borderRadius: 10, marginBottom: 4 },
    text: { fontSize: 13, color: c.text },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 20 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    acceptBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
    acceptText: { color: c.bg, fontWeight: "700", fontSize: 12 },
    declineBtn: { flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
    declineText: { color: c.text, fontWeight: "700", fontSize: 12 },
  });
}
