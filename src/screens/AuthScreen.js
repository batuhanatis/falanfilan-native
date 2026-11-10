import { t as translateUI } from "../i18n/core";
import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { ChevronLeft, Check } from "lucide-react-native";
import GoogleLogo from "../components/GoogleLogo";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api, API_BASE } from "../api/client";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import CompleteProfileModal from "../components/CompleteProfileModal";
import { appleAuthWithCode } from "../utils/appleAuth";
import { peekPendingLink } from "../utils/deferredLink";
import { FONTS } from "../theme/fonts";
import { Spotlight } from "../components/salon/OneSheet";
import { useCurtainWipe } from "../components/salon/CurtainWipe";
import Fuaye from "./onboarding/Fuaye";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
});

// Hesap açılmadan önceki akış (Salon):
//  · Fuaye — ilk kurulumda üç sahnelik fragman: uygulama ne yapar, sonra "Bilet al" / "Zaten üyeyim".
//  · Gişe — kayıt: Apple/Google tek dokunuş; e-postayla yalnızca isim, e-posta, şifre. Kullanıcı
//    adı isimden önerilir (istersen değiştirirsin), davet kodu "Davet kodum var" altında.
//  · Giriş — tekrar gelenler için. Bu cihazda daha önce oturum açıldıysa Fuaye atlanıp buradan
//    başlanıyor.
// Ekranlar arasında perde geçişi var. Kayıt sözleşmesi (isim, kullanıcı adı, e-posta, şifre,
// şartların kabulü, davet kodu) sunucuda aynı.
const HAS_ACCOUNT_KEY = "pellix_has_account_v1";
const GOLD = "#c9a44c";
const TR_MAP = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };

function usernameBase(name) {
  const base = String(name || "").split("").map((ch) => TR_MAP[ch] || ch).join("")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 14);
  return base.length >= 3 ? base : "pellix";
}

export default function AuthScreen() {
  const { c } = useAppTheme();
  const { handleAuthed } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);
  const curtain = useCurtainWipe();
  const [view, setView] = useState(null); // "fuaye" | "signup" | "login"
  const [hasInvite, setHasInvite] = useState(false);
  const [name, setName] = useState("");
  const suffix = useRef(String(10 + Math.floor(Math.random() * 89))).current;
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [editUsername, setEditUsername] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
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
  const [pendingSignup, setPendingSignup] = useState(null); // { ticket, email, suggestedName, completeFn }

  useEffect(() => {
    AsyncStorage.getItem(HAS_ACCOUNT_KEY).then((v) => setView(v ? "login" : "fuaye")).catch(() => setView("fuaye"));
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
    // Linkle gelen kişi: ertelenmiş link birkaç saniye içinde çözülüyor (App.js), birkaç kez bak.
    const checks = [0, 2500, 7000].map((ms) => setTimeout(() => {
      peekPendingLink().then((target) => { if (target) setHasInvite(true); }).catch(() => {});
    }, ms));
    return () => checks.forEach(clearTimeout);
  }, []);

  // Kullanıcı adı isimden önerilir; kişi kendisi değiştirdiyse dokunulmaz.
  useEffect(() => {
    if (!usernameTouched) setUsername(`${usernameBase(name)}_${suffix}`);
  }, [name, usernameTouched, suffix]);

  function go(next) {
    setError("");
    curtain.run(() => setView(next));
  }

  function finishAuth(data) {
    AsyncStorage.setItem(HAS_ACCOUNT_KEY, "1").catch(() => {});
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
      const idToken = result?.data?.idToken || result?.idToken;
      if (!idToken) throw new Error("Google'dan kimlik jetonu alınamadı.");
      await finishGoogleAuth(idToken);
    } catch (e) {
      if (e.code === statusCodes?.SIGN_IN_CANCELLED) {
        // kullanıcı vazgeçti
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
        setEditUsername(true);
        setError("Kullanıcı adı 3-20 karakter olmalı, sadece harf/rakam/alt çizgi içerebilir.");
        return;
      }
      if (!termsAccepted) { setError("Devam etmek için Gizlilik Politikası ve Kullanım Şartlarını kabul etmelisin."); return; }
    }
    setLoading(true);
    try {
      const data = view === "signup"
        ? await api.signup({ name: name.trim(), username: username.trim(), email: email.trim(), password, termsAccepted: true, referredByUsername: referredByUsername.trim() })
        : await api.login({ email: email.trim(), password });
      await finishAuth(data);
    } catch (e) {
      const msg = e.message || "Sunucuya ulaşılamadı.";
      if (/kullanıcı adı/i.test(msg)) setEditUsername(true);
      setError(msg);
    }
    setLoading(false);
  }

  if (!view) return <View style={{ flex: 1, backgroundColor: "#100e10" }} />;

  if (view === "fuaye") {
    return (
      <View style={{ flex: 1 }}>
        <Fuaye hasInvite={hasInvite} onSignup={() => go("signup")} onLogin={() => go("login")} />
        {curtain.overlay}
      </View>
    );
  }

  const signup = view === "signup";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#100e10" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Spotlight id="giseSpot" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => go("fuaye")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={translateUI("Geri")}>
            <ChevronLeft size={22} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.wordmark}>PELLIX</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Bilet: üstte başlık, delikli çizgi, altta form */}
        <View style={styles.ticket}>
          <View style={styles.ticketHead}>
            <Text style={styles.eyebrow}>{signup ? translateUI("GİŞE · ÜCRETSİZ") : translateUI("TEKRAR HOŞ GELDİN")}</Text>
            <Text style={styles.title}>{signup ? translateUI("Biletini kes") : translateUI("Kaldığın yerden")}</Text>
            <Text style={styles.subtitle}>
              {signup ? translateUI("Bir dakika: sonra perde senin beğenilerine göre açılıyor.") : translateUI("Önerilerin, listelerin ve arkadaşların seni bekliyor.")}
            </Text>
          </View>
          <View style={styles.perforation}>
            <View style={[styles.notch, { left: -12 }]} />
            <View style={styles.dashes} />
            <View style={[styles.notch, { right: -12 }]} />
          </View>

          <View style={styles.ticketBody}>
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={999}
                style={styles.appleBtn}
                onPress={handleAppleSignIn}
              />
            )}
            {appleLoading && <ActivityIndicator color={c.text} style={{ marginBottom: 10 }} />}

            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={googleLoading}>
              {googleLoading ? <ActivityIndicator color="#1f1f1f" /> : (
                <>
                  <GoogleLogo size={18} />
                  <Text style={styles.googleBtnText}>{translateUI("Google ile Devam Et")}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{translateUI("ya da e-postayla")}</Text>
              <View style={styles.dividerLine} />
            </View>

            {signup && (
              <TextInput style={styles.input} placeholder={translateUI("Adın")} placeholderTextColor={c.dim} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
            )}
            <TextInput style={styles.input} placeholder={translateUI("E-posta")} placeholderTextColor={c.dim} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            <TextInput style={styles.input} placeholder={translateUI("Şifre")} placeholderTextColor={c.dim} value={password} onChangeText={setPassword} secureTextEntry textContentType={signup ? "newPassword" : "password"} />

            {signup && (
              <>
                {editUsername ? (
                  <View style={styles.inlineField}>
                    <Text style={styles.at}>@</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={username}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                      onChangeText={(v) => { setUsernameTouched(true); setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "")); }}
                      accessibilityLabel={translateUI("Kullanıcı adı")}
                    />
                  </View>
                ) : (
                  <Pressable style={styles.metaRow} onPress={() => setEditUsername(true)} accessibilityRole="button">
                    <Text style={styles.metaLabel}>{translateUI("KULLANICI ADIN")}</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>@{username}</Text>
                    <Text style={styles.metaAction}>{translateUI("Değiştir")}</Text>
                  </Pressable>
                )}
                {showInvite ? (
                  <View style={styles.inlineField}>
                    <Text style={styles.at}>@</Text>
                    <TextInput
                      style={styles.inlineInput}
                      placeholder={translateUI("Davet eden kişinin kullanıcı adı")}
                      placeholderTextColor={c.dim}
                      value={referredByUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={(v) => setReferredByUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    />
                  </View>
                ) : (
                  <Pressable style={styles.metaRow} onPress={() => setShowInvite(true)} accessibilityRole="button">
                    <Text style={styles.metaLabel}>{translateUI("DAVET KODUM VAR")}</Text>
                    <Text style={[styles.metaValue, { color: c.dim }]} numberOfLines={1}>{translateUI("ikinize 7 gün Premium")}</Text>
                    <Text style={styles.metaAction}>{translateUI("Ekle")}</Text>
                  </Pressable>
                )}

                {/* Onay kutusu e-postayla kayıtta; Google/Apple ile yeni hesapta CompleteProfileModal soruyor. */}
                <TouchableOpacity style={styles.consentRow} onPress={() => setTermsAccepted((v) => !v)} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }}>
                  <View style={[styles.checkbox, termsAccepted && { backgroundColor: GOLD, borderColor: GOLD }]}>
                    {termsAccepted && <Check size={13} color="#1a150c" strokeWidth={3} />}
                  </View>
                  <Text style={styles.consentText}>
                    <Text onPress={() => Linking.openURL(`${API_BASE}/privacy`)} style={styles.consentLink}>{translateUI("Gizlilik Politikası")}</Text>
                    {" "}{translateUI("ve")}{" "}
                    <Text onPress={() => Linking.openURL(`${API_BASE}/terms`)} style={styles.consentLink}>{translateUI("Kullanım Şartları")}</Text>
                    {translateUI("'")}{translateUI("nı okudum, kabul ediyorum. ")}</Text>
                </TouchableOpacity>
              </>
            )}

            {!signup && (
              <TouchableOpacity onPress={() => setShowForgotPassword(true)} style={{ alignSelf: "flex-end", marginBottom: 4 }}>
                <Text style={styles.forgotText}>{translateUI("Şifremi unuttum")}</Text>
              </TouchableOpacity>
            )}

            {!!error && <Text style={styles.error}>{translateUI(error)}</Text>}

            <TouchableOpacity style={styles.button} onPress={submit} disabled={loading} accessibilityRole="button">
              {loading ? <ActivityIndicator color="#1a150c" /> : (
                <Text style={styles.buttonText}>{signup ? translateUI("Bileti kes") : translateUI("Giriş yap")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={() => go(signup ? "login" : "signup")} style={{ paddingVertical: 14 }}>
          <Text style={styles.switchText}>
            {signup ? translateUI("Zaten hesabın var mı? Giriş yap") : translateUI("Hesabın yok mu? Bilet al")}
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
      {curtain.overlay}
    </KeyboardAvoidingView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    scroll: { flexGrow: 1, paddingHorizontal: 20 },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    wordmark: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 20, letterSpacing: 6 },
    ticket: { backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: "rgba(201,164,76,0.38)" },
    ticketHead: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
    eyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.8 },
    title: { color: c.text, fontFamily: FONTS.marquee, fontSize: 40, lineHeight: 42, marginTop: 6 },
    subtitle: { color: c.dim, fontSize: 13, lineHeight: 19, marginTop: 6 },
    perforation: { height: 24, justifyContent: "center" },
    notch: { position: "absolute", top: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: "#100e10", borderWidth: 1, borderColor: "rgba(201,164,76,0.38)" },
    dashes: { marginHorizontal: 18, borderTopWidth: 1, borderStyle: "dashed", borderColor: "rgba(201,164,76,0.4)" },
    ticketBody: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
    appleBtn: { width: "100%", height: 48, marginBottom: 10 },
    googleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      backgroundColor: "#fff", borderRadius: 999, paddingVertical: 13, marginBottom: 12,
    },
    googleBtnText: { color: "#1f1f1f", fontWeight: "600", fontSize: 14.5 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { fontSize: 11, color: c.dim, fontFamily: FONTS.monoMedium, letterSpacing: 0.4 },
    input: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 13, color: c.text, fontSize: 15, marginBottom: 10,
    },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border },
    metaLabel: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2 },
    metaValue: { flex: 1, color: c.text, fontSize: 13.5, fontWeight: "700", textAlign: "right" },
    metaAction: { color: GOLD, fontSize: 12.5, fontWeight: "800" },
    inlineField: { flexDirection: "row", alignItems: "center", backgroundColor: c.bg, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)", borderRadius: 12, paddingHorizontal: 12, marginTop: 6, marginBottom: 4 },
    at: { color: GOLD, fontSize: 15, fontWeight: "800", marginRight: 2 },
    inlineInput: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 12 },
    consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 14, marginBottom: 2 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: c.border, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
    consentText: { flex: 1, fontSize: 12, color: c.dim, lineHeight: 18 },
    consentLink: { color: GOLD, fontWeight: "600", textDecorationLine: "underline" },
    forgotText: { color: GOLD, fontSize: 12.5, fontWeight: "600" },
    error: { color: c.danger, fontSize: 12.5, marginTop: 10, textAlign: "center" },
    button: { backgroundColor: GOLD, borderRadius: 999, paddingVertical: 15, marginTop: 16, alignItems: "center" },
    buttonText: { color: "#1a150c", fontWeight: "800", fontSize: 15 },
    switchText: { color: c.dim, fontSize: 13, textAlign: "center" },
  });
}
