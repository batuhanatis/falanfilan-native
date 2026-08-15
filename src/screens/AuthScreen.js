import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import GoogleLogo from "../components/GoogleLogo";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api, API_BASE } from "../api/client";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import CompleteProfileModal from "../components/CompleteProfileModal";
import { appleAuthWithCode } from "../utils/appleAuth";

// ÖNEMLİ (kökten düzeltme): expo-auth-session, Google ile girişte HER ZAMAN tarayıcı üzerinden
// (accounts.google.com'u açıp geri yönlendirerek) çalışıyordu. Google'ın güncel OAuth
// politikası, bu tür akışlarda artık "https://" olmayan (bizim "pellix://" gibi) özel şema
// yönlendirmelerini KABUL ETMİYOR — hangi istemci tipini (Android/Web) versek de aynı
// "invalid_request" hatasını veriyordu; sorun istemci tipi değil, akışın kendisiydi. Expo'nun
// kendi dokümantasyonu da Google için kendi native SDK'sının kullanılmasını öneriyor. Bu yüzden
// tamamen @react-native-google-signin/google-signin'e geçtik — bu, tarayıcı yönlendirmesi hiç
// kullanmıyor (Android'de Credential Manager/Play Services, iOS'ta Google'ın native SDK'sı),
// redirect_uri diye bir kavram yok, bu sınıf hatanın tamamen önüne geçiyor.
GoogleSignin.configure({
  // Backend (server.js), gelen ID token'ın "aud" (hedef kitle) alanını GOOGLE_CLIENT_IDS'e göre
  // doğruluyor — bu yüzden webClientId burada da, backend'de de AYNI olmalı.
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  // iOS'ta, Firebase'in GoogleService-Info.plist'te otomatik oluşturduğu istemci kimliği —
  // Android'deki paket-adı+SHA-1 doğrulamasının iOS karşılığı, native SDK'nın kendi güvenlik
  // kontrolü için gerekli.
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
});

export default function AuthScreen() {
  const { c } = useAppTheme();
  const { handleAuthed } = useAuth();
  const [view, setView] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [referredByUsername, setReferredByUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  // Google/Apple ile YENİ hesap açılırken (isNewUser=true), profili tamamlama popup'ını
  // açmak için gereken bilgileri burada tutuyoruz.
  const [pendingSignup, setPendingSignup] = useState(null); // { ticket, email, suggestedName, completeFn }

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  function finishAuth(data) {
    return handleAuthed({
      token: data.token,
      id: data.user.id,
      name: data.user.name,
      username: data.user.username,
      email: data.user.email,
      likeCount: data.user.likeCount || 0,
      onboardingCompleted: !!data.user.onboardingCompleted,
      tutorialSeen: !!data.user.tutorialSeen,
      tasteSurveySeen: !!data.user.tasteSurveySeen,
    });
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      // Kütüphanenin farklı sürümleri arasında yanıt şekli birazcık değişebiliyor
      // (bazısı doğrudan idToken, bazısı result.data.idToken) — ikisini de deniyoruz.
      const idToken = result?.data?.idToken || result?.idToken;
      if (!idToken) throw new Error("Google'dan kimlik jetonu alınamadı.");
      await finishGoogleAuth(idToken);
    } catch (e) {
      if (e.code === statusCodes?.SIGN_IN_CANCELLED) {
        // kullanıcı kendi iptal etti, hata gösterme
      } else if (e.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("Google Play Services bu cihazda kullanılamıyor.");
      } else {
        setError(e.message || "Google ile giriş başarısız oldu, tekrar dener misin?");
      }
    }
    setGoogleLoading(false);
  }

  async function finishGoogleAuth(idToken) {
    try {
      const data = await api.googleAuth(idToken);
      if (data.isNewUser) {
        setPendingSignup({ ticket: data.ticket, email: data.email, suggestedName: data.suggestedName, completeFn: api.googleCompleteSignup });
      } else {
        await finishAuth(data);
      }
    } catch (e) {
      setError(e.message || "Google ile giriş başarısız oldu.");
    }
  }

  async function handleAppleSignIn() {
    setError("");
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ""} ${credential.fullName.familyName || ""}`.trim()
        : null;
      const data = await appleAuthWithCode(credential.identityToken, fullName, credential.authorizationCode);
      if (data.isNewUser) {
        setPendingSignup({ ticket: data.ticket, email: data.email, suggestedName: data.suggestedName, completeFn: api.appleCompleteSignup });
      } else {
        await finishAuth(data);
      }
    } catch (e) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        setError("Apple ile giriş başarısız oldu, tekrar dener misin?");
      }
    }
    setAppleLoading(false);
  }

  async function submit() {
    setError("");
    if (!email.trim() || !password) { setError("E-posta ve şifre gerekli."); return; }
    if (view === "signup") {
      if (!name.trim()) { setError("İsim gerekli."); return; }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        setError("Kullanıcı adı 3-20 karakter olmalı, sadece harf/rakam/alt çizgi içerebilir.");
        return;
      }
      if (!termsAccepted) { setError("Devam etmek için Gizlilik Politikası ve Kullanım Şartlarını kabul etmelisin."); return; }
    }
    setLoading(true);
    try {
      const data = view === "signup"
        ? await api.signup({ name, username, email, password, termsAccepted: true, referredByUsername })
        : await api.login({ email, password });
      await finishAuth(data);
    } catch (e) {
      setError(e.message || "Sunucuya ulaşılamadı.");
    }
    setLoading(false);
  }

  const styles = makeStyles(c);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* AU1 — eskiden uygulamanın en düz ekranıydı, hiçbir gradyan/kişilik yoktu. İki soluk
          "glow" lekesi (marka altını + Blend'in mor-mavi ailesi) formun okunabilirliğini
          bozmadan girişe hafif bir kişilik katıyor. */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={["rgba(201,164,76,0.22)", "rgba(201,164,76,0)"]}
          style={styles.glowTop}
        />
        <LinearGradient
          colors={["rgba(99,102,241,0.16)", "rgba(99,102,241,0)"]}
          style={styles.glowBottom}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          pell<Text style={{ color: c.accent }}>i</Text>x
        </Text>
        <Text style={styles.title}>{view === "login" ? "Tekrar hoş geldin" : "Hesabını oluştur"}</Text>
        <Text style={styles.subtitle}>
          {view === "login" ? "Film zevkine göre önerilerine devam et" : "Zevkine göre önerilerin bir dakikada hazır"}
        </Text>

        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.appleBtn}
            onPress={handleAppleSignIn}
          />
        )}
        {appleLoading && <ActivityIndicator color={c.text} style={{ marginBottom: 10 }} />}

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1f1f1f" />
          ) : (
            <>
              <GoogleLogo size={18} />
              <Text style={styles.googleBtnText}>Google ile Devam Et</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ya da e-posta ile</Text>
          <View style={styles.dividerLine} />
        </View>

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
            <TextInput
              style={styles.input}
              placeholder="Davet kodu (opsiyonel — bir arkadaşının kullanıcı adı)"
              placeholderTextColor={c.dim}
              value={referredByUsername}
              autoCapitalize="none"
              onChangeText={(v) => setReferredByUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            />
          </>
        )}
        <TextInput style={styles.input} placeholder="E-posta" placeholderTextColor={c.dim} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Şifre" placeholderTextColor={c.dim} value={password} onChangeText={setPassword} secureTextEntry />

        {view === "login" && (
          <TouchableOpacity onPress={() => setShowForgotPassword(true)} style={{ alignSelf: "flex-end", marginBottom: 8 }}>
            <Text style={styles.forgotText}>Şifremi unuttum</Text>
          </TouchableOpacity>
        )}

        {/* Onay kutucuğu SADECE kayıt formunda ve en altta, "Hesap oluştur" butonunun hemen
            üstünde — e-posta ile kayıt burada gerçekleşiyor. Google/Apple ile yeni hesap
            açılırken aynı onay, CompleteProfileModal içinde ayrıca soruluyor. */}
        {view === "signup" && (
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
        )}

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
      {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}
      {pendingSignup && (
        <CompleteProfileModal
          ticket={pendingSignup.ticket}
          email={pendingSignup.email}
          suggestedName={pendingSignup.suggestedName}
          completeFn={pendingSignup.completeFn}
          onClose={() => setPendingSignup(null)}
          onAuthed={async (data) => { setPendingSignup(null); await finishAuth(data); }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    scroll: { flexGrow: 1, justifyContent: "center", padding: 28 },
    glowTop: {
      position: "absolute", top: -120, left: -80, width: 320, height: 320, borderRadius: 999,
    },
    glowBottom: {
      position: "absolute", bottom: -140, right: -100, width: 340, height: 340, borderRadius: 999,
    },
    logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 32, color: c.text, textAlign: "center", marginBottom: 30, letterSpacing: 0.3 },
    title: { fontSize: 22, fontWeight: "700", color: c.text, textAlign: "center" },
    subtitle: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 6, marginBottom: 24 },
    appleBtn: { width: "100%", height: 46, marginBottom: 10 },
    googleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      backgroundColor: "#fff", borderWidth: 1, borderColor: "#747775", borderRadius: 12,
      paddingVertical: 13, marginBottom: 10,
    },
    googleBtnText: { color: "#1f1f1f", fontWeight: "600", fontSize: 14 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { fontSize: 11, color: c.dim },
    input: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 14, marginBottom: 10,
    },
    error: { color: c.danger, fontSize: 12, marginTop: 4, marginBottom: 6, textAlign: "center" },
    forgotText: { color: c.accent, fontSize: 12, fontWeight: "600" },
    consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 2, marginBottom: 6 },
    checkbox: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: c.border,
      alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
    },
    consentText: { flex: 1, fontSize: 12, color: c.dim, lineHeight: 18 },
    consentLink: { color: c.accent, fontWeight: "600", textDecorationLine: "underline" },
    button: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, marginTop: 14, alignItems: "center" },
    buttonText: { color: c.bg, fontWeight: "800", fontSize: 14 },
    switchText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 16 },
  });
}
