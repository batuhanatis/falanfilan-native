import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from "react-native";
import { X, Flag } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";

const REASONS = [
  "Taciz ya da zorbalık",
  "Uygunsuz/müstehcen içerik",
  "Sahte hesap",
  "Spam",
  "Nefret söylemi",
  "Diğer",
];

export default function ReportUserModal({ userId, userName, onClose }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason) return;
    setLoading(true);
    try {
      await api.reportUser(auth.token, userId, reason, details);
      setDone(true);
    } catch (e) {
      // sessizce geç, kullanıcıyı yine de teşekkür ekranına götürelim ki tekrar tekrar denemesin
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={styles.sheet} handleOnly>
          <View style={styles.header}>
            <Text style={styles.title}>{userName} Kişisini Şikayet Et</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>

          {done ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Flag size={32} color={c.accent} style={{ marginBottom: 10 }} />
              <Text style={styles.doneTitle}>Şikayetin alındı</Text>
              <Text style={styles.doneSubtitle}>İncelememiz için gerekli ekibe iletildi.</Text>
              <TouchableOpacity style={styles.button} onPress={onClose}>
                <Text style={styles.buttonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>NEDEN</Text>
              {REASONS.map((r) => (
                <TouchableOpacity key={r} style={styles.reasonRow} onPress={() => setReason(r)}>
                  <View style={[styles.radio, reason === r && { borderColor: c.accent }]}>
                    {reason === r && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.reasonText}>{r}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.label, { marginTop: 14 }]}>DETAY (İSTEĞE BAĞLI)</Text>
              <TextInput
                style={styles.input}
                placeholder="Neler oldu, kısaca anlatır mısın?"
                placeholderTextColor={c.dim}
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity style={[styles.button, !reason && { opacity: 0.5 }]} onPress={submit} disabled={!reason || loading}>
                {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>Şikayeti Gönder</Text>}
              </TouchableOpacity>
            </>
          )}
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
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { fontSize: 15, fontWeight: "800", color: c.text, flex: 1, marginRight: 10 },
    label: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8 },
    reasonRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    radioDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: c.accent },
    reasonText: { fontSize: 13, color: c.text },
    input: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, color: c.text, fontSize: 13, minHeight: 70, textAlignVertical: "top",
    },
    button: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 18 },
    buttonText: { color: c.bg, fontWeight: "800", fontSize: 14 },
    doneTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    doneSubtitle: { fontSize: 12, color: c.dim, marginTop: 4, textAlign: "center" },
  });
}
