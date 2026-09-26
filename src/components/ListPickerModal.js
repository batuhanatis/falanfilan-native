import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from "react-native";
import { X, Plus, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { emitLocalEvent } from "../utils/localEvents";
import DismissableSheet from "./DismissableSheet";

// ÖNEMLİ: Artık bir listeye DOKUNMAK anında ekliyor ve popup'ı kapatıyor — önceden "seç, sonra
// onayla" şeklinde çalışıyordu. Ekleme onayı, GlobalPopups'ta 1 saniyeliğine görünen bir toast
// ile veriliyor (bkz. emitLocalEvent), kullanıcı ekstra bir adım atmak zorunda kalmıyor.
export default function ListPickerModal({ movie, onClose }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api.watchlists(auth.token, movie.id)
      .then((data) => setLists(data.results || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Satır artık bir AÇ/KAPA: tikli (zaten ekli) bir listeye dokunmak onu listeden ÇIKARIYOR —
  // eskiden sadece "zaten ekli" uyarısı veriyordu, yani eklemeyi geri almanın tek yolu listenin
  // kendi detay ekranına gitmekti. Ekleme popup'ı kapatıyor (asıl niyet karşılandı), çıkarma ise
  // açık bırakıyor: çıkarmak genelde bir düzeltme, kullanıcı hemen başka bir listeye ekleyebilsin.
  async function toggleList(list) {
    if (busyId) return;
    setBusyId(list.id);
    if (list.alreadyAdded) {
      try {
        await api.removeFromWatchlist(auth.token, list.id, movie.id);
        setLists((prev) => prev.map((l) => (
          l.id === list.id ? { ...l, alreadyAdded: false, count: Math.max(0, Number(l.count) - 1) } : l
        )));
        emitLocalEvent({ type: "toast", title: "Listeden çıkarıldı", message: `${movie.title}, "${list.name}" listesinden çıkarıldı` });
      } catch {}
      setBusyId(null);
      return;
    }
    try {
      await api.addToWatchlist(auth.token, list.id, movie.id);
      emitLocalEvent({ type: "toast", title: "✅ Listeye eklendi", message: `${movie.title}, "${list.name}" listesine eklendi` });
      onClose();
    } catch {
      setBusyId(null); // başarısız olursa tekrar denenebilsin, popup açık kalsın
    }
  }

  async function createAndAdd() {
    const name = newListName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const list = await api.createWatchlist(auth.token, name);
      await api.addToWatchlist(auth.token, list.id, movie.id);
      emitLocalEvent({ type: "toast", title: "✅ Listeye eklendi", message: `${movie.title}, "${list.name}" listesine eklendi` });
      onClose();
    } catch {
      setCreating(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} handleOnly>
              <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>{movie.title} — bir listeye ekle</Text>
                <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
              </View>
              {loading ? (
                <ActivityIndicator color={c.accent} style={{ marginVertical: 20 }} />
              ) : lists.length === 0 ? (
                <Text style={styles.emptyText}>Henüz bir listen yok — aşağıdan ilkini oluşturabilirsin.</Text>
              ) : (
                lists.map((l) => (
                  <TouchableOpacity key={l.id} style={styles.row} onPress={() => toggleList(l)} disabled={!!busyId}>
                    <Text style={styles.rowText}>{l.name}</Text>
                    {busyId === l.id ? <ActivityIndicator size="small" color={c.accent} />
                      : l.alreadyAdded ? (
                        <View style={styles.checkBadge}>
                          <Check size={12} color={c.bg} strokeWidth={3} />
                        </View>
                      ) : <Text style={styles.rowCount}>{l.count}</Text>}
                  </TouchableOpacity>
                ))
              )}

              <View style={styles.newListRow}>
                <TextInput
                  style={styles.newListInput}
                  placeholder="Yeni liste adı"
                  placeholderTextColor={c.dim}
                  value={newListName}
                  onChangeText={setNewListName}
                  onSubmitEditing={createAndAdd}
                />
                <TouchableOpacity style={styles.newListBtn} onPress={createAndAdd} disabled={creating || !newListName.trim()}>
                  {creating ? <ActivityIndicator size="small" color={c.bg} /> : <Plus size={16} color={c.bg} />}
                </TouchableOpacity>
              </View>
            </DismissableSheet>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 },
    title: { flex: 1, fontSize: 14, fontWeight: "800", color: c.text },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
    rowText: { fontSize: 13, color: c.text, fontWeight: "600" },
    rowCount: { fontSize: 11.5, color: c.dim, fontWeight: "700" },
    checkBadge: { width: 20, height: 20, borderRadius: 999, backgroundColor: c.accent2, alignItems: "center", justifyContent: "center" },
    emptyText: { color: c.dim, fontSize: 12, paddingVertical: 10 },
    newListRow: { flexDirection: "row", gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border },
    newListInput: {
      flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 13,
    },
    newListBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  });
}
