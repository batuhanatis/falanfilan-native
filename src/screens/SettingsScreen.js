import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Linking, ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import { ChevronLeft, Check, ChevronRight, Mail, Shield, FileText, Sun, Moon, Crown } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api, API_BASE } from "../api/client";

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";
const SUPPORT_EMAIL = "destek@pellix.app";

export default function SettingsScreen({ navigation }) {
  const { c, mode, setMode } = useAppTheme();
  const { auth, logout } = useAuth();
  const styles = makeStyles(c);

  const [privacy, setPrivacy] = useState("everyone");
  const [tastemateVisible, setTastemateVisibleState] = useState(true);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [premiumStatus, setPremiumStatus] = useState(null);

  useEffect(() => {
    api.me(auth.token).then((me) => {
      setPrivacy(me.privacy || "everyone");
      setTastemateVisibleState(me.tastemateVisible !== false);
    }).catch(() => {});
    api.premiumStatus(auth.token).then(setPremiumStatus).catch(() => {});
  }, []);

  async function toggleTastemateVisible() {
    const next = !tastemateVisible;
    setTastemateVisibleState(next); // anında yansısın
    try { await api.setTastemateVisibility(auth.token, next); } catch { setTastemateVisibleState(!next); }
  }

  async function savePrivacy(next) {
    setPrivacy(next);
    try {
      const me = await api.me(auth.token);
      await api.updateMe(auth.token, { name: me.name, username: me.username, bio: me.bio, privacy: next });
    } catch { Alert.alert("Hata", "Kaydedilemedi, tekrar dene."); }
  }

  async function changePassword() {
    setPwError(""); setPwSuccess(false);
    if (!newPw || newPw.length < 6) { setPwError("Yeni şifre en az 6 karakter olmalı."); return; }
    setPwSaving(true);
    try {
      await api.updatePassword(auth.token, { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(""); setNewPw(""); setPwSuccess(true);
    } catch (e) { setPwError(e.message || "Şifre değiştirilemedi."); }
    setPwSaving(false);
  }

  async function deleteAccount() {
    if (deleteConfirm.trim().toUpperCase() !== "SİL") { setDeleteError('Onaylamak için kutuya "SİL" yaz.'); return; }
    setDeleting(true); setDeleteError("");
    try {
      await api.deleteAccount(auth.token);
      logout();
    } catch { setDeleteError("Hesap silinemedi."); setDeleting(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      <View style={{ padding: 18 }}>
        {/* Eskiden Profilim sayfasının üst satırında bir "Premium" rozeti/pill'i vardı — profil
            gereksiz kalabalıklaşmasın diye buraya, hesap durumunun asıl yaşaması gereken yere
            taşındı. */}
        {premiumStatus?.isPremium && (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Premium")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.premiumIconWrap}><Crown size={16} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Premium Üye</Text>
                <Text style={[styles.cardSubtitle, { marginBottom: 0 }]}>Aboneliğini yönet, yenileme tarihini gör.</Text>
              </View>
              <ChevronRight size={16} color={c.dim} />
            </View>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>GİZLİLİK</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profilimi kimler görebilir</Text>
          <Text style={styles.cardSubtitle}>Beğenilerin ve profilin bu ayara göre gösterilir.</Text>
          {[["everyone", "Herkes"], ["friends", "Sadece arkadaşlarım"], ["onlyme", "Sadece ben"]].map(([val, label]) => (
            <TouchableOpacity key={val} onPress={() => savePrivacy(val)} style={styles.privacyRow}>
              <Text style={styles.privacyLabel}>{label}</Text>
              {privacy === val && <Check size={16} color={c.accent} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>GÖRÜNÜM</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tema</Text>
          {[["light", "Aydınlık", Sun], ["dark", "Karanlık", Moon]].map(([val, label, Icon]) => (
            <TouchableOpacity key={val} onPress={() => setMode(val)} style={styles.privacyRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon size={14} color={c.dim} />
                <Text style={styles.privacyLabel}>{label}</Text>
              </View>
              {mode === val && <Check size={16} color={c.accent} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>YENİ İNSANLARLA EŞLEŞME</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.cardTitle}>TasteMate'te Görünür Ol</Text>
              <Text style={styles.cardSubtitle}>
                Kapatırsan, arkadaş olmadığın kullanıcıların "yeni insanlarla eşleş" havuzunda artık sana rastlamazlar.
              </Text>
            </View>
            <Switch value={tastemateVisible} onValueChange={toggleTastemateVisible} trackColor={{ true: c.accent }} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>GÜVENLİK</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Şifre Değiştir</Text>
          <Text style={styles.fieldLabel}>MEVCUT ŞİFRE</Text>
          <TextInput style={styles.input} secureTextEntry value={currentPw} onChangeText={setCurrentPw} placeholderTextColor={c.dim} />
          <Text style={styles.fieldLabel}>YENİ ŞİFRE</Text>
          <TextInput style={styles.input} secureTextEntry value={newPw} onChangeText={setNewPw} placeholderTextColor={c.dim} />
          {!!pwError && <Text style={styles.errorText}>{pwError}</Text>}
          {pwSuccess && <Text style={styles.successText}>Şifren güncellendi.</Text>}
          <TouchableOpacity style={styles.secondaryBtn} onPress={changePassword} disabled={pwSaving}>
            <Text style={styles.secondaryBtnText}>{pwSaving ? "Kaydediliyor..." : "Şifreyi Güncelle"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("InviteFriend")}>
          <Text style={styles.cardTitle}>Arkadaşını Davet Et</Text>
          <Text style={styles.cardSubtitle}>Davet kodunu paylaş, eşleşince ödül kazan.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("BlockedUsers")}>
          <Text style={styles.cardTitle}>Engellenen Kullanıcılar</Text>
          <Text style={styles.cardSubtitle}>Kimleri engellediğini gör, istersen engeli kaldır.</Text>
        </TouchableOpacity>

        {/* Destek/Gizlilik/Kullanım Şartları — eskiden bunlara sadece kayıt ekranından
            ulaşılabiliyordu, hesabı olan bir kullanıcının bunları tekrar görmesinin bir yolu
            yoktu. Abonelik içeren uygulamalarda App Store incelemesi bu linkleri Ayarlar'da da
            arıyor (Guideline 3.1.2). */}
        <Text style={styles.sectionLabel}>DESTEK & YASAL</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Mail size={15} color={c.dim} />
            <Text style={styles.linkRowText}>Destek — {SUPPORT_EMAIL}</Text>
            <ChevronRight size={14} color={c.dim} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkRow, styles.linkRowBorder]} onPress={() => Linking.openURL(`${API_BASE}/privacy`)}>
            <Shield size={15} color={c.dim} />
            <Text style={styles.linkRowText}>Gizlilik Politikası</Text>
            <ChevronRight size={14} color={c.dim} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkRow, styles.linkRowBorder]} onPress={() => Linking.openURL(`${API_BASE}/terms`)}>
            <FileText size={15} color={c.dim} />
            <Text style={styles.linkRowText}>Kullanım Şartları</Text>
            <ChevronRight size={14} color={c.dim} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: c.danger }]}>TEHLİKELİ BÖLGE</Text>
        <View style={[styles.card, { borderColor: c.danger }]}>
          <Text style={styles.cardTitle}>Hesabı Sil</Text>
          <Text style={styles.cardSubtitle}>Bu işlem geri alınamaz. Tüm beğenilerin, arkadaşlıkların, mesajların ve profilin kalıcı olarak silinir.</Text>
          <TextInput
            style={styles.input}
            placeholder='Onaylamak için "SİL" yaz'
            placeholderTextColor={c.dim}
            value={deleteConfirm}
            onChangeText={setDeleteConfirm}
            autoCapitalize="characters"
          />
          {!!deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteAccount} disabled={deleting}>
            <Text style={styles.deleteBtnText}>{deleting ? "Siliniyor..." : "Hesabımı Kalıcı Olarak Sil"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>pellix · Sürüm {APP_VERSION}</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    sectionLabel: { fontSize: 11, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8, marginTop: 6 },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 16, marginBottom: 14 },
    cardTitle: { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 4 },
    cardSubtitle: { fontSize: 11, color: c.dim, marginBottom: 10, lineHeight: 16 },
    privacyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
    privacyLabel: { fontSize: 13, color: c.text },
    switchRow: { flexDirection: "row", alignItems: "center" },
    premiumIconWrap: {
      width: 32, height: 32, borderRadius: 999, backgroundColor: "#16A34A",
      alignItems: "center", justifyContent: "center",
    },
    fieldLabel: { fontSize: 10, fontWeight: "700", color: c.dim, marginTop: 8, marginBottom: 4 },
    input: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 13,
    },
    errorText: { color: c.danger, fontSize: 11, marginTop: 6 },
    successText: { color: c.accent2, fontSize: 11, marginTop: 6 },
    secondaryBtn: { marginTop: 10, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
    secondaryBtnText: { color: c.text, fontWeight: "700", fontSize: 12 },
    logoutBtn: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 20 },
    logoutText: { color: c.text, fontWeight: "700", fontSize: 13 },
    deleteBtn: { marginTop: 10, backgroundColor: c.danger, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
    deleteBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
    linkRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
    linkRowText: { flex: 1, fontSize: 13, color: c.text, fontWeight: "600" },
    versionText: { textAlign: "center", fontSize: 11, color: c.dim, marginTop: 4, marginBottom: 30 },
  });
}
