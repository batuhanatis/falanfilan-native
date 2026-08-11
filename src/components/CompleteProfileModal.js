import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, TouchableWithoutFeedback } from "react-native";
import { X, Mail, User } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { API_BASE } from "../api/client";
import DismissableSheet from "./DismissableSheet";

// Google/Apple ile YENİ hesap açılırken kullanılır — e-posta zaten sağlayıcıdan geldiği için
// salt okunur gösterilir, isim önceden dolu ama düzenlenebilir, kullanıcı adı ise HER ZAMAN
// manuel giriliyor (otomatik/rastgele üretilmiyor).
export default function CompleteProfileModal({ ticket, email, suggestedName, completeFn, onClose, onAuthed }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [name, setName] = useState(suggestedName || "");
  const [username, setUsername] = useState("");
  const [referredByUsername, setReferredByUsername] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) { setError("İsim gerekli."); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) { setError("Kullanıcı adı 3-20 karakter olmalı, sadece harf/rakam/alt çizgi içerebilir."); return; }
    if (!termsAccepted) { setError("Devam etmek için Gizlilik Politikası ve Kullanım Şartlarını kabul etmelisin."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await completeFn(ticket, name.trim(), username.trim(), true, referredByUsername.trim());
      onAuthed(data);
    } catch (e) {
      setError(e.message || "Hesap oluşturulamadı, tekrar dener misin?");
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
            <Text style={styles.title}>Hesabını Tamamla</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Neredeyse bitti — birkaç bilgi daha.</Text>

          {!!email && (
            <View style={styles.emailBox}>
              <Mail size={14} color={c.dim} />
              <Text style={styles.emailText}>{email}</Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <User size={15} color={c.dim} />
            <TextInput style={styles.input} placeholder="İsim" placeholderTextColor={c.dim} value={name} onChangeText={setName} />
          </View>
          <View style={styles.inputRow}>
            <User size={15} color={c.dim} />
            <TextInput
              style={styles.input}
              placeholder="Kullanıcı adı"
              placeholderTextColor={c.dim}
              value={username}
              autoCapitalize="none"
              onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            />
          </View>
          <View style={styles.inputRow}>
            <User size={15} color={c.dim} />
            <TextInput
              style={styles.input}
              placeholder="Davet kodu (opsiyonel)"
              placeholderTextColor={c.dim}
              value={referredByUsername}
              autoCapitalize="none"
              onChangeText={(v) => setReferredByUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            />
          </View>

          <TouchableOpacity style={styles.consentRow} onPress={() => setTermsAccepted((v) => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, termsAccepted && { backgroundColor: c.accent, borderColor: c.accent }]}>
              {termsAccepted && <Text style={{ color: c.bg, fontSize: 11, fontWeight: "800" }}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              <Text onPress={() => Linking.openURL(`${API_BASE}/privacy`)} style={styles.consentLink}>Gizlilik Politikası</Text>
              {" "}ve{" "}
              <Text onPress={() => Linking.openURL(`${API_BASE}/terms`)} style={styles.consentLink}>Kullanım Şartları</Text>
              {"'"}nı okudum, kabul ediyorum.
            </Text>
          </TouchableOpacity>

          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>Hesabı Oluştur</Text>}
          </TouchableOpacity>
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
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    title: { fontSize: 16, fontWeight: "800", color: c.text, flex: 1, marginRight: 10 },
    subtitle: { fontSize: 12, color: c.dim, marginBottom: 16 },
    emailBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
    },
    emailText: { color: c.dim, fontSize: 13 },
    inputRow: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10,
    },
    input: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 12 },
    consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 6, marginBottom: 6 },
    checkbox: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: c.border,
      alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
    },
    consentText: { flex: 1, fontSize: 12, color: c.dim, lineHeight: 18 },
    consentLink: { color: c.accent, fontWeight: "600", textDecorationLine: "underline" },
    error: { color: c.danger, fontSize: 12, marginTop: 6, marginBottom: 4, textAlign: "center" },
    button: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 10 },
    buttonText: { color: c.bg, fontWeight: "800", fontSize: 14 },
  });
}
