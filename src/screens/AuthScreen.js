import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function AuthScreen() {
  const { c } = useAppTheme();
  const { handleAuthed } = useAuth();
  const [view, setView] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!email.trim() || !password) { setError("E-posta ve şifre gerekli."); return; }
    if (view === "signup") {
      if (!name.trim()) { setError("İsim gerekli."); return; }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        setError("Kullanıcı adı 3-20 karakter olmalı, sadece harf/rakam/alt çizgi içerebilir.");
        return;
      }
    }
    setLoading(true);
    try {
      const data = view === "signup"
        ? await api.signup({ name, username, email, password })
        : await api.login({ email, password });
      await handleAuthed({
        token: data.token,
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        likeCount: data.user.likeCount || 0,
        onboardingCompleted: !!data.user.onboardingCompleted,
      });
    } catch (e) {
      setError(e.message || "Sunucuya ulaşılamadı.");
    }
    setLoading(false);
  }

  const styles = makeStyles(c);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          Falan<Text style={{ color: c.accent }}>Filan</Text>
        </Text>
        <Text style={styles.title}>{view === "login" ? "Tekrar hoş geldin" : "Hesabını oluştur"}</Text>
        <Text style={styles.subtitle}>
          {view === "login" ? "Film zevkine göre önerilerine devam et" : "Zevkine göre önerilerin bir dakikada hazır"}
        </Text>

        {view === "signup" && (
          <>
            <TextInput style={styles.input} placeholder="İsim" placeholderTextColor={c.dim} value={name} onChangeText={setName} />
            <TextInput
              style={styles.input}
              placeholder="kullaniciadi"
              placeholderTextColor={c.dim}
              value={username}
              autoCapitalize="none"
              onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            />
          </>
        )}
        <TextInput style={styles.input} placeholder="E-posta" placeholderTextColor={c.dim} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Şifre" placeholderTextColor={c.dim} value={password} onChangeText={setPassword} secureTextEntry />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Bekleniyor..." : view === "login" ? "Giriş yap" : "Hesap oluştur"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setView(view === "login" ? "signup" : "login"); setError(""); }}>
          <Text style={styles.switchText}>
            {view === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    scroll: { flexGrow: 1, justifyContent: "center", padding: 28 },
    logo: { fontSize: 22, fontWeight: "700", color: c.text, textAlign: "center", marginBottom: 30 },
    title: { fontSize: 22, fontWeight: "700", color: c.text, textAlign: "center" },
    subtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 6, marginBottom: 24 },
    input: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 14, marginBottom: 10,
    },
    error: { color: c.danger, fontSize: 12, marginTop: 4, marginBottom: 6, textAlign: "center" },
    button: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, marginTop: 14, alignItems: "center" },
    buttonText: { color: c.bg, fontWeight: "800", fontSize: 14 },
    switchText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 16 },
  });
}
