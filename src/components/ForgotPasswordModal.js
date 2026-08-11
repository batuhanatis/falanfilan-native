import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { X, Mail, KeyRound, CheckCircle2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";

// İki adımlı, KOD tabanlı şifre sıfırlama — link/deep-link kullanmıyor, Expo Go'da
// hiçbir yönlendirme sorunu yaşamadan çalışıyor. E-postaya gelen 6 haneli kodu burada giriyorsun.
export default function ForgotPasswordModal({ onClose }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [step, setStep] = useState("email"); // "email" | "code" | "done"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    if (!email.trim()) { setError("E-posta gerekli."); return; }
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setStep("code");
    } catch (e) {
      setError(e.message || "Bir şeyler ters gitti, tekrar dener misin?");
    }
    setLoading(false);
  }

  async function resetPassword() {
    if (!code.trim() || code.trim().length !== 6) { setError("6 haneli kodu eksiksiz gir."); return; }
    if (newPassword.length < 6) { setError("Yeni şifre en az 6 karakter olmalı."); return; }
    setError("");
    setLoading(true);
    try {
      await api.resetPassword(email.trim(), code.trim(), newPassword);
      setStep("done");
    } catch (e) {
      setError(e.message || "Kod geçersiz olabilir, tekrar dener misin?");
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
            <Text style={styles.title}>Şifremi Unuttum</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>

          {step === "email" && (
            <>
              <Text style={styles.subtitle}>Hesabına kayıtlı e-postayı gir, sana 6 haneli bir sıfırlama kodu gönderelim.</Text>
              <View style={styles.inputRow}>
                <Mail size={15} color={c.dim} />
                <TextInput
                  style={styles.input}
                  placeholder="E-posta"
                  placeholderTextColor={c.dim}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity style={styles.button} onPress={sendCode} disabled={loading}>
                {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>Kod Gönder</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === "code" && (
            <>
              <Text style={styles.subtitle}>{email} adresine bir kod gönderdik. Kodu ve yeni şifreni gir.</Text>
              <View style={styles.inputRow}>
                <KeyRound size={15} color={c.dim} />
                <TextInput
                  style={styles.input}
                  placeholder="6 haneli kod"
                  placeholderTextColor={c.dim}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              <View style={styles.inputRow}>
                <KeyRound size={15} color={c.dim} />
                <TextInput
                  style={styles.input}
                  placeholder="Yeni şifre"
                  placeholderTextColor={c.dim}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity style={styles.button} onPress={resetPassword} disabled={loading}>
                {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>Şifreyi Sıfırla</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={sendCode} disabled={loading} style={{ marginTop: 12 }}>
                <Text style={styles.resendText}>Kodu tekrar gönder</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "done" && (
            <View style={{ alignItems: "center", paddingVertical: 10 }}>
              <CheckCircle2 size={40} color={c.accent2} style={{ marginBottom: 12 }} />
              <Text style={styles.doneTitle}>Şifren güncellendi</Text>
              <Text style={styles.subtitle}>Artık yeni şifrenle giriş yapabilirsin.</Text>
              <TouchableOpacity style={styles.button} onPress={onClose}>
                <Text style={styles.buttonText}>Girişe Dön</Text>
              </TouchableOpacity>
            </View>
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
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    title: { fontSize: 16, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12, color: c.dim, marginBottom: 16, lineHeight: 18 },
    inputRow: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10,
    },
    input: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 12 },
    error: { color: c.danger, fontSize: 12, marginBottom: 8, textAlign: "center" },
    button: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
    buttonText: { color: c.bg, fontWeight: "800", fontSize: 14 },
    resendText: { color: c.dim, fontSize: 12, textAlign: "center", textDecorationLine: "underline" },
    doneTitle: { fontSize: 16, fontWeight: "800", color: c.text, marginBottom: 4 },
  });
}
