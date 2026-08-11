import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, TouchableWithoutFeedback } from "react-native";
import { X, Phone, KeyRound, User } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { api, API_BASE } from "../api/client";
import DismissableSheet from "./DismissableSheet";

// Üç adımlı akış: telefon gir -> kod gir -> (SADECE yeni hesapsa) isim/kullanıcı adı gir.
// Telefon zaten kayıtlıysa kod doğrulanır doğrulanmaz direkt giriş yapılıyor, 3. adıma hiç gerek kalmıyor.
export default function PhoneAuthModal({ onClose, onAuthed }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [step, setStep] = useState("phone"); // "phone" | "code" | "profile"
  const [phone, setPhone] = useState("+90");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    if (phone.trim().length < 8) { setError("Geçerli bir telefon numarası gir."); return; }
    setError("");
    setLoading(true);
    try {
      await api.phoneSendCode(phone.trim());
      setStep("code");
    } catch (e) {
      setError(e.message || "Kod gönderilemedi, tekrar dener misin?");
    }
    setLoading(false);
  }

  async function verifyCode() {
    if (code.trim().length !== 6) { setError("6 haneli kodu eksiksiz gir."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await api.phoneVerify(phone.trim(), code.trim());
      if (data.isNewUser) {
        setTicket(data.ticket);
        setStep("profile");
      } else {
        onAuthed(data);
      }
    } catch (e) {
      setError(e.message || "Kod geçersiz olabilir, tekrar dener misin?");
    }
    setLoading(false);
  }

  async function completeSignup() {
    if (!name.trim()) { setError("İsim gerekli."); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) { setError("Kullanıcı adı 3-20 karakter olmalı, sadece harf/rakam/alt çizgi içerebilir."); return; }
    if (!termsAccepted) { setError("Devam etmek için Gizlilik Politikası ve Kullanım Şartlarını kabul etmelisin."); return; }
    setError("");
    setLoading(true);
    try {
      const data = await api.phoneCompleteSignup(ticket, name.trim(), username.trim(), true);
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
            <Text style={styles.title}>Telefon Numarasıyla Devam Et</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>

          {step === "phone" && (
            <>
              <Text style={styles.subtitle}>Telefon numarana bir doğrulama kodu göndereceğiz.</Text>
              <View style={styles.inputRow}>
                <Phone size={15} color={c.dim} />
                <TextInput
                  style={styles.input}
                  placeholder="+905551234567"
                  placeholderTextColor={c.dim}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
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
              <Text style={styles.subtitle}>{phone} numarasına bir kod gönderdik.</Text>
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
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity style={styles.button} onPress={verifyCode} disabled={loading}>
                {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>Doğrula</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={sendCode} disabled={loading} style={{ marginTop: 12 }}>
                <Text style={styles.resendText}>Kodu tekrar gönder</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "profile" && (
            <>
              <Text style={styles.subtitle}>Neredeyse bitti — hesabını tamamlamak için birkaç bilgi daha.</Text>
              <View style={styles.inputRow}>
                <User size={15} color={c.dim} />
                <TextInput style={styles.input} placeholder="İsim" placeholderTextColor={c.dim} value={name} onChangeText={setName} />
              </View>
              <View style={styles.inputRow}>
                <User size={15} color={c.dim} />
                <TextInput style={styles.input} placeholder="Kullanıcı adı" placeholderTextColor={c.dim} value={username} onChangeText={setUsername} autoCapitalize="none" />
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
              <TouchableOpacity style={styles.button} onPress={completeSignup} disabled={loading}>
                {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>Hesabı Oluştur</Text>}
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
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    title: { fontSize: 16, fontWeight: "800", color: c.text, flex: 1, marginRight: 10 },
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
    consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4, marginBottom: 12 },
    checkbox: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: c.border,
      alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
    },
    consentText: { flex: 1, fontSize: 12, color: c.dim, lineHeight: 18 },
    consentLink: { color: c.accent, fontWeight: "600", textDecorationLine: "underline" },
  });
}
