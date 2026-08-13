import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Pencil, Sparkles, Lock, Crown } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import IslandModal from "./IslandModal";
import Slider from "./Slider";

const BRAND_GRADIENT = ["#8e2de2", "#4a00e0", "#00c9ff"];
const PROFILE_BG_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// ÖNEMLİ: "Zevkine Özel Arka Plan" (AI profil teması) eskiden Ayarlar'daydı — kullanıcı bunun
// "profili düzenleme" akışının bir parçası olarak daha mantıklı olduğunu, oraya taşınmasını
// istedi. Ayarlar'daki "Premium Üye" durum kartı YERİNDE kalıyor, sadece bu tema bölümü taşındı.
export default function EditProfileModal({ profile, isPremium, navigation, onClose, onSaved }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [name, setName] = useState(profile.name || "");
  const [username, setUsername] = useState(profile.username || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showLockedInfo, setShowLockedInfo] = useState(false);

  function goPremium() {
    onClose();
    navigation.navigate("Premium");
  }

  const [bgUrl, setBgUrl] = useState(profile.profileBackgroundUrl || null);
  const [bgGeneratedAt, setBgGeneratedAt] = useState(profile.profileBackgroundGeneratedAt || null);
  const [bgIntensity, setBgIntensity] = useState(profile.profileBackgroundIntensity ?? 50);
  const [bgGenerating, setBgGenerating] = useState(false);
  const [bgResetting, setBgResetting] = useState(false);

  const bgNextAvailableAt = bgGeneratedAt
    ? new Date(new Date(bgGeneratedAt).getTime() + PROFILE_BG_COOLDOWN_MS)
    : null;
  const canGenerateBackground = !bgNextAvailableAt || bgNextAvailableAt <= new Date();

  async function generateBackground() {
    if (bgGenerating || bgResetting || !canGenerateBackground) return;
    setBgGenerating(true);
    try {
      const res = await api.generateProfileBackground(auth.token);
      setBgUrl(res.url);
      setBgGeneratedAt(res.generatedAt);
      onSaved({ profileBackgroundUrl: res.url, profileBackgroundGeneratedAt: res.generatedAt });
    } catch (e) {
      setError(e.message || "Arka plan üretilemedi, tekrar dener misin?");
    }
    setBgGenerating(false);
  }

  async function resetBackground() {
    if (bgGenerating || bgResetting) return;
    setBgResetting(true);
    try {
      await api.resetProfileBackground(auth.token);
      setBgUrl(null);
      onSaved({ profileBackgroundUrl: null });
    } catch {
      setError("Varsayılana dönülemedi, tekrar dener misin?");
    }
    setBgResetting(false);
  }

  async function commitBackgroundIntensity(next) {
    onSaved({ profileBackgroundIntensity: next });
    try { await api.updateProfileBackgroundIntensity(auth.token, next); } catch { /* sessizce geç */ }
  }

  async function save() {
    if (!name.trim()) { setError("İsim boş olamaz."); return; }
    setSaving(true);
    setError("");
    try {
      const uname = username.trim().toLowerCase();
      const res = await api.updateMe(auth.token, { name: name.trim(), username: uname, bio, privacy: profile.privacy || "everyone" });
      onSaved({ name: name.trim(), username: res.username || uname, bio });
      onClose();
    } catch (e) {
      setError(e.message || "Kaydedilemedi, tekrar dener misin?");
    }
    setSaving(false);
  }

  return (
    <IslandModal visible onClose={onClose} title="Profili Düzenle" icon={Pencil} gradientColors={BRAND_GRADIENT}>
      <Text style={styles.fieldLabel}>AD</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={c.dim} maxLength={40} />

      <Text style={styles.fieldLabel}>KULLANICI ADI</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholderTextColor={c.dim}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
      />

      <Text style={styles.fieldLabel}>BİYOGRAFİ</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        placeholderTextColor={c.dim}
        placeholder="Kendinden bahset..."
        multiline
        maxLength={160}
      />

      {!isPremium && (
        // Premium olmayan kullanıcılar özelliği hiç görmüyordu — artık kilitli haliyle burada,
        // tıklayınca "Premium'a özel" mesajı + geçiş butonu açılıyor (nudge).
        <TouchableOpacity
          style={styles.bgSection}
          activeOpacity={0.85}
          onPress={() => setShowLockedInfo(true)}
        >
          <View style={styles.bgHeaderRow}>
            <View style={[styles.bgIconWrap, { backgroundColor: c.surface2 }]}>
              <Lock size={13} color={c.dim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bgTitle}>Zevkine Özel Arka Plan</Text>
              <Text style={styles.bgSubtitle}>
                {showLockedInfo
                  ? "Bu özellik Premium'a özel — beğendiğin türlere ve favori yapımlarına göre AI ile sana özel bir profil teması üretiliyor."
                  : "Kilitli — açmak için dokun."}
              </Text>
            </View>
          </View>

          {showLockedInfo && (
            <TouchableOpacity activeOpacity={0.88} onPress={goPremium} style={{ marginTop: 12 }}>
              <LinearGradient colors={["#F59E0B", "#EA580C", "#DC2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bgBtn}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Crown size={13} color="#fff" />
                  <Text style={styles.bgBtnText}>Premium'a Geç</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}

      {isPremium && (
        <View style={styles.bgSection}>
          <View style={styles.bgHeaderRow}>
            <View style={styles.bgIconWrap}><Sparkles size={14} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bgTitle}>Zevkine Özel Arka Plan</Text>
              <Text style={styles.bgSubtitle}>
                {!bgUrl
                  ? "Beğendiğin türlere ve favori yapımlarına göre AI ile senin için bir profil teması oluşturalım."
                  : canGenerateBackground
                  ? "Zevkin değiştiyse yenileyebilirsin."
                  : `Bir sonraki yenileme: ${bgNextAvailableAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}`}
              </Text>
            </View>
          </View>

          <View style={styles.bgBtnRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={generateBackground}
              disabled={!canGenerateBackground || bgGenerating || bgResetting}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={BRAND_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.bgBtn, (!canGenerateBackground || bgGenerating || bgResetting) && { opacity: 0.5 }]}
              >
                {bgGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.bgBtnText}>{bgUrl ? "Yenile" : "Oluştur"}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            {!!bgUrl && (
              <TouchableOpacity
                style={[styles.bgSecondaryBtn, (bgGenerating || bgResetting) && { opacity: 0.5 }]}
                onPress={resetBackground}
                disabled={bgGenerating || bgResetting}
              >
                {bgResetting ? (
                  <ActivityIndicator size="small" color={c.text} />
                ) : (
                  <Text style={styles.bgSecondaryBtnText}>Varsayılana Dön</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {!!bgUrl && (
            <View style={styles.intensityBlock}>
              <View style={styles.intensityLabelRow}>
                <Text style={styles.fieldLabel}>ARKA PLAN BELİRGİNLİĞİ</Text>
                <Text style={styles.intensityValue}>%{bgIntensity}</Text>
              </View>
              <Slider value={bgIntensity} onChange={setBgIntensity} onSlidingComplete={commitBackgroundIntensity} />
            </View>
          )}
        </View>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity activeOpacity={0.88} onPress={save} disabled={saving}>
        <LinearGradient colors={BRAND_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </IslandModal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    fieldLabel: { fontSize: 10, fontWeight: "700", color: c.dim, marginTop: 14, marginBottom: 6 },
    input: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 13,
    },
    bioInput: { minHeight: 70, textAlignVertical: "top" },
    errorText: { color: c.danger, fontSize: 11, marginTop: 10 },
    saveBtn: { marginTop: 20, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

    bgSection: {
      marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border,
    },
    bgHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    bgIconWrap: {
      width: 30, height: 30, borderRadius: 999, backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center",
    },
    bgTitle: { fontSize: 12.5, fontWeight: "800", color: c.text },
    bgSubtitle: { fontSize: 10.5, color: c.dim, marginTop: 2, lineHeight: 14 },
    bgBtnRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    bgBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center" },
    bgBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
    bgSecondaryBtn: {
      paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center",
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
    },
    bgSecondaryBtnText: { color: c.text, fontWeight: "700", fontSize: 11.5 },
    intensityBlock: { marginTop: 4 },
    intensityLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    intensityValue: { fontSize: 11, fontWeight: "700", color: c.text, fontVariant: ["tabular-nums"] },
  });
}
