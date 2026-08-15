import React, { useEffect, useState } from "react";
import { Alert, Linking, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Crown, EyeOff, FileText, Lock, Mail, Moon, Palette, Shield, Sun, Trophy, UserRound, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api, API_BASE } from "../api/client";

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";
const SUPPORT_EMAIL = "destek@pellix.app";
const TIER_COLORS = { bronze: "#B08D57", silver: "#9CA3AF", gold: "#F5C518" };
const TIER_LABELS = { bronze: "🥉 Bronz", silver: "🥈 Gümüş", gold: "🥇 Altın" };

export default function SettingsScreen({ navigation, route }) {
  const { c, mode, setMode } = useAppTheme();
  const { auth, logout, handleAuthed } = useAuth();
  const styles = makeStyles(c);
  const [openSection, setOpenSection] = useState(route?.params?.initialSection || null);
  const [privacy, setPrivacy] = useState("everyone");
  const [tastemateVisible, setTastemateVisible] = useState(true);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwState, setPwState] = useState({ saving: false, error: "", success: false });
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteState, setDeleteState] = useState({ deleting: false, error: "" });

  useEffect(() => {
    if (route?.params?.initialSection) setOpenSection(route.params.initialSection);
  }, [route?.params?.initialSection]);

  useEffect(() => {
    api.me(auth.token).then((me) => {
      setPrivacy(me.privacy || "everyone");
      setTastemateVisible(me.tastemateVisible !== false);
      setDislikeCount(me.dislikeCount || 0);
    }).catch(() => {});
    api.premiumStatus(auth.token).then(setPremiumStatus).catch(() => {});
    api.achievements(auth.token).then(setAchievements).catch(() => {});
  }, [auth.token]);

  async function savePrivacy(next) {
    const previous = privacy;
    setPrivacy(next);
    try {
      const me = await api.me(auth.token);
      await api.updateMe(auth.token, { name: me.name, username: me.username, bio: me.bio, privacy: next });
    } catch { setPrivacy(previous); Alert.alert("Hata", "Kaydedilemedi, tekrar dene."); }
  }

  async function toggleTasteMate() {
    const next = !tastemateVisible;
    setTastemateVisible(next);
    try { await api.setTastemateVisibility(auth.token, next); }
    catch { setTastemateVisible(!next); }
  }

  async function changePassword() {
    setPwState({ saving: false, error: "", success: false });
    if (newPw.length < 6) { setPwState({ saving: false, error: "Yeni şifre en az 6 karakter olmalı.", success: false }); return; }
    setPwState({ saving: true, error: "", success: false });
    try {
      const result = await api.updatePassword(auth.token, { currentPassword: currentPw, newPassword: newPw });
      if (result?.token) await handleAuthed({ ...auth, token: result.token });
      setCurrentPw(""); setNewPw(""); setPwState({ saving: false, error: "", success: true });
    } catch (e) { setPwState({ saving: false, error: e.message || "Şifre değiştirilemedi.", success: false }); }
  }

  async function deleteAccount() {
    if (deleteConfirm.trim().toUpperCase() !== "SİL") { setDeleteState({ deleting: false, error: 'Onaylamak için "SİL" yaz.' }); return; }
    setDeleteState({ deleting: true, error: "" });
    try { await api.deleteAccount(auth.token); await logout(); }
    catch { setDeleteState({ deleting: false, error: "Hesap silinemedi." }); }
  }

  const groupProps = { openSection, setOpenSection, styles, c };
  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ChevronLeft size={20} color={c.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.intro}>Bir kategoriye dokunarak ayarlarını görüntüleyebilirsin.</Text>

        <Group id="account" title="Hesap" subtitle="Üyelik, e-posta ve davetler" Icon={UserRound} {...groupProps}>
          {premiumStatus?.isPremium && <ActionCard title="Premium Üye" subtitle="Aboneliğini ve yenileme tarihini yönet." Icon={Crown} onPress={() => navigation.navigate("Premium")} styles={styles} c={c} accent />}
          <View style={styles.card}><View style={styles.row}><Mail size={15} color={c.dim} /><Text style={styles.rowText}>{auth.email}</Text></View></View>
          <ActionCard title="Arkadaşını Davet Et" subtitle="Davet kodunu paylaş, eşleşince ödül kazan." onPress={() => navigation.navigate("InviteFriend")} styles={styles} c={c} />
        </Group>

        <Group id="privacy" title="Gizlilik & Sosyal" subtitle="Profil, TasteMate ve engeller" Icon={Shield} {...groupProps}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profilimi kimler görebilir</Text>
            <Text style={styles.cardSubtitle}>Beğenilerin ve profilin bu ayara göre gösterilir.</Text>
            {[["everyone", "Herkes"], ["friends", "Sadece arkadaşlarım"], ["onlyme", "Sadece ben"]].map(([value, label]) => (
              <TouchableOpacity key={value} style={styles.optionRow} onPress={() => savePrivacy(value)}><Text style={styles.optionText}>{label}</Text>{privacy === value && <Check size={16} color={c.accent} />}</TouchableOpacity>
            ))}
          </View>
          <View style={styles.card}><View style={styles.switchRow}><View style={{ flex: 1, paddingRight: 10 }}><Text style={styles.cardTitle}>TasteMate'te Görünür Ol</Text><Text style={styles.cardSubtitle}>Kapatırsan yeni insanlarla eşleşme havuzunda görünmezsin.</Text></View><Switch value={tastemateVisible} onValueChange={toggleTasteMate} trackColor={{ true: c.accent }} /></View></View>
          <ActionCard title="Engellenen Kullanıcılar" subtitle="Engellediğin kişileri gör ve yönet." onPress={() => navigation.navigate("BlockedUsers")} styles={styles} c={c} />
        </Group>

        <Group id="content" title="İçerik & Görünüm" subtitle="Beğenmediklerin ve uygulama teması" Icon={Palette} {...groupProps}>
          <ActionCard title="Beğenmediklerim" subtitle={dislikeCount ? `${dislikeCount} içeriği görüntüle ve yönet.` : "Beğenmediğin içerikleri burada görebilirsin."} Icon={EyeOff} onPress={() => navigation.navigate("AllLikes", { kind: "dislikes", title: "Beğenmediklerim" })} styles={styles} c={c} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tema</Text>
            {[["light", "Aydınlık", Sun], ["dark", "Karanlık", Moon]].map(([value, label, ThemeIcon]) => (
              <TouchableOpacity key={value} style={styles.optionRow} onPress={() => setMode(value)}><View style={styles.row}><ThemeIcon size={14} color={c.dim} /><Text style={styles.optionText}>{label}</Text></View>{mode === value && <Check size={16} color={c.accent} />}</TouchableOpacity>
            ))}
          </View>
        </Group>

        <Group
          id="badges"
          title="Rozetler"
          subtitle={achievements ? `${achievements.unlockedCount}/${achievements.totalCount} rozet açıldı` : "Başarılarını ve ilerlemeni görüntüle"}
          Icon={Trophy}
          {...groupProps}
        >
          {!achievements ? (
            <Text style={styles.badgeLoading}>Rozetler yükleniyor…</Text>
          ) : (
            <View style={styles.badgeGrid}>
              {achievements.badges.map((badge) => {
                const tierColor = badge.unlocked ? TIER_COLORS[badge.tier] : c.border;
                return (
                  <TouchableOpacity
                    key={badge.id}
                    style={[styles.badgeCard, { borderColor: tierColor }, !badge.unlocked && styles.badgeCardLocked]}
                    onPress={() => setSelectedBadge(badge)}
                    activeOpacity={0.8}
                  >
                    {!badge.unlocked && <View style={styles.badgeLockIcon}><Lock size={9} color={c.dim} /></View>}
                    <Text style={[styles.badgeIcon, !badge.unlocked && { opacity: 0.2 }]}>{badge.icon}</Text>
                    <Text style={[styles.badgeName, !badge.unlocked && { color: c.dim }]} numberOfLines={1}>
                      {badge.unlocked ? badge.name : "???"}
                    </Text>
                    <Text style={styles.badgeDesc} numberOfLines={2}>
                      {badge.unlocked ? badge.desc : `${badge.progress.current}/${badge.progress.target}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Group>

        <Group id="security" title="Güvenlik" subtitle="Şifre, oturum ve hesap yönetimi" Icon={Lock} {...groupProps}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Şifre Değiştir</Text>
            <Text style={styles.fieldLabel}>MEVCUT ŞİFRE</Text><TextInput style={styles.input} secureTextEntry value={currentPw} onChangeText={setCurrentPw} />
            <Text style={styles.fieldLabel}>YENİ ŞİFRE</Text><TextInput style={styles.input} secureTextEntry value={newPw} onChangeText={setNewPw} />
            {!!pwState.error && <Text style={styles.error}>{pwState.error}</Text>}{pwState.success && <Text style={styles.success}>Şifren güncellendi.</Text>}
            <TouchableOpacity style={styles.secondaryBtn} onPress={changePassword} disabled={pwState.saving}><Text style={styles.secondaryText}>{pwState.saving ? "Kaydediliyor..." : "Şifreyi Güncelle"}</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}><Text style={styles.secondaryText}>Çıkış Yap</Text></TouchableOpacity>
          <View style={[styles.card, { borderColor: c.danger }]}>
            <Text style={[styles.cardTitle, { color: c.danger }]}>Hesabı Sil</Text><Text style={styles.cardSubtitle}>Bu işlem geri alınamaz. Tüm verilerin kalıcı olarak silinir.</Text>
            <TextInput style={styles.input} placeholder='Onaylamak için "SİL" yaz' placeholderTextColor={c.dim} value={deleteConfirm} onChangeText={setDeleteConfirm} autoCapitalize="characters" />
            {!!deleteState.error && <Text style={styles.error}>{deleteState.error}</Text>}
            <TouchableOpacity style={styles.deleteBtn} onPress={deleteAccount} disabled={deleteState.deleting}><Text style={styles.deleteText}>{deleteState.deleting ? "Siliniyor..." : "Hesabımı Kalıcı Olarak Sil"}</Text></TouchableOpacity>
          </View>
        </Group>

        <Group id="support" title="Destek & Yasal" subtitle="Destek, gizlilik ve kullanım şartları" Icon={FileText} {...groupProps}>
          <View style={styles.card}>
            <LinkRow icon={Mail} label={`Destek — ${SUPPORT_EMAIL}`} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} styles={styles} c={c} />
            <LinkRow icon={Shield} label="Gizlilik Politikası" onPress={() => Linking.openURL(`${API_BASE}/privacy`)} styles={styles} c={c} border />
            <LinkRow icon={FileText} label="Kullanım Şartları" onPress={() => Linking.openURL(`${API_BASE}/terms`)} styles={styles} c={c} border />
          </View>
        </Group>
        <Text style={styles.version}>pellix · Sürüm {APP_VERSION}</Text>
      </View>
    </ScrollView>
    <Modal visible={!!selectedBadge} transparent animationType="fade" onRequestClose={() => setSelectedBadge(null)}>
      <TouchableOpacity style={styles.badgeModalBackdrop} activeOpacity={1} onPress={() => setSelectedBadge(null)}>
        {selectedBadge && (
          <View style={styles.badgeModalCard} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.badgeModalClose} onPress={() => setSelectedBadge(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color={c.dim} />
            </TouchableOpacity>
            <Text style={[styles.badgeModalIcon, !selectedBadge.unlocked && { opacity: 0.3 }]}>{selectedBadge.icon}</Text>
            <Text style={styles.badgeModalName}>{selectedBadge.unlocked ? selectedBadge.name : "??? Rozeti"}</Text>
            {selectedBadge.unlocked && (
              <View style={[styles.tierChip, { backgroundColor: `${TIER_COLORS[selectedBadge.tier]}22` }]}>
                <Text style={[styles.tierChipText, { color: TIER_COLORS[selectedBadge.tier] }]}>{TIER_LABELS[selectedBadge.tier]}</Text>
              </View>
            )}
            <Text style={styles.badgeModalDesc}>
              {selectedBadge.unlocked ? selectedBadge.desc : "Bu rozeti henüz açmadın. Nasıl açılacağı, kilidini açtığında ortaya çıkacak."}
            </Text>
            <View style={styles.badgeModalProgressTrack}>
              <View style={[styles.badgeModalProgressFill, {
                width: `${Math.min(selectedBadge.progress.current / selectedBadge.progress.target, 1) * 100}%`,
                backgroundColor: selectedBadge.unlocked ? "#4ADE80" : c.accent,
              }]} />
            </View>
            <Text style={styles.badgeModalProgressLabel}>{selectedBadge.progress.current}/{selectedBadge.progress.target}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Modal>
    </>
  );
}

function Group({ id, title, subtitle, Icon, openSection, setOpenSection, styles, c, children }) {
  const open = openSection === id;
  return <View style={[styles.group, open && { borderColor: c.accent }]}><TouchableOpacity style={styles.groupHeader} onPress={() => setOpenSection(open ? null : id)} accessibilityState={{ expanded: open }}><View style={styles.groupIcon}><Icon size={17} color={open ? c.accent : c.dim} /></View><View style={{ flex: 1 }}><Text style={styles.groupTitle}>{title}</Text><Text style={styles.groupSubtitle}>{subtitle}</Text></View><ChevronDown size={18} color={c.dim} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} /></TouchableOpacity>{open && <View style={styles.groupBody}>{children}</View>}</View>;
}
function ActionCard({ title, subtitle, Icon, onPress, styles, c, accent }) { return <TouchableOpacity style={styles.card} onPress={onPress}><View style={styles.row}>{Icon && <View style={[styles.actionIcon, accent && { backgroundColor: "#16A34A" }]}><Icon size={16} color={accent ? "#fff" : c.dim} /></View>}<View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSubtitle}>{subtitle}</Text></View><ChevronRight size={16} color={c.dim} /></View></TouchableOpacity>; }
function LinkRow({ icon: Icon, label, onPress, styles, c, border }) { return <TouchableOpacity style={[styles.linkRow, border && styles.linkBorder]} onPress={onPress}><Icon size={15} color={c.dim} /><Text style={styles.rowText}>{label}</Text><ChevronRight size={14} color={c.dim} /></TouchableOpacity>; }

function makeStyles(c) { return StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border }, headerTitle: { fontSize: 14, fontWeight: "700", color: c.text }, content: { padding: 18 }, intro: { color: c.dim, fontSize: 11, marginBottom: 12 },
  group: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, marginBottom: 10, overflow: "hidden" }, groupHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }, groupIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }, groupTitle: { color: c.text, fontSize: 14, fontWeight: "800" }, groupSubtitle: { color: c.dim, fontSize: 10.5, marginTop: 2 }, groupBody: { padding: 12, borderTopWidth: 1, borderTopColor: c.border },
  card: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 13, marginBottom: 10 }, row: { flexDirection: "row", alignItems: "center", gap: 9 }, rowText: { flex: 1, color: c.text, fontSize: 12, fontWeight: "600" }, cardTitle: { color: c.text, fontSize: 13, fontWeight: "700", marginBottom: 3 }, cardSubtitle: { color: c.dim, fontSize: 11, lineHeight: 16 }, actionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  optionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }, optionText: { color: c.text, fontSize: 13 }, switchRow: { flexDirection: "row", alignItems: "center" }, fieldLabel: { fontSize: 10, fontWeight: "700", color: c.dim, marginTop: 8, marginBottom: 4 }, input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 13 }, error: { color: c.danger, fontSize: 11, marginTop: 6 }, success: { color: c.accent2, fontSize: 11, marginTop: 6 },
  badgeLoading: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 18 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeCard: { width: "31%", minHeight: 104, backgroundColor: c.surface2, borderWidth: 1.5, borderRadius: 14, padding: 9, alignItems: "center", justifyContent: "center", position: "relative" },
  badgeCardLocked: { opacity: 0.72 },
  badgeLockIcon: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 999, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  badgeIcon: { fontSize: 26 },
  badgeName: { fontSize: 10, fontWeight: "800", color: c.text, marginTop: 6, textAlign: "center" },
  badgeDesc: { fontSize: 9, color: c.dim, marginTop: 3, textAlign: "center", lineHeight: 12 },
  badgeModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 30 },
  badgeModalCard: { width: "100%", maxWidth: 300, backgroundColor: c.surface, borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: c.border },
  badgeModalClose: { position: "absolute", top: 12, right: 12, padding: 4 },
  badgeModalIcon: { fontSize: 44, marginBottom: 10 },
  badgeModalName: { fontSize: 17, fontWeight: "800", color: c.text, textAlign: "center" },
  tierChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  tierChipText: { fontSize: 10.5, fontWeight: "800" },
  badgeModalDesc: { fontSize: 12, color: c.dim, marginTop: 10, textAlign: "center", lineHeight: 17 },
  badgeModalProgressTrack: { width: "100%", height: 6, borderRadius: 999, backgroundColor: c.surface2, marginTop: 16, overflow: "hidden" },
  badgeModalProgressFill: { height: "100%", borderRadius: 999 },
  badgeModalProgressLabel: { fontSize: 10.5, color: c.dim, marginTop: 6, fontWeight: "700" },
  secondaryBtn: { marginTop: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 10, alignItems: "center" }, secondaryText: { color: c.text, fontWeight: "700", fontSize: 12 }, logoutBtn: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 10 }, deleteBtn: { marginTop: 10, backgroundColor: c.danger, borderRadius: 10, paddingVertical: 12, alignItems: "center" }, deleteText: { color: "#fff", fontWeight: "800", fontSize: 12 }, linkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 }, linkBorder: { borderTopWidth: 1, borderTopColor: c.border }, version: { textAlign: "center", color: c.dim, fontSize: 11, marginTop: 12 },
}); }
