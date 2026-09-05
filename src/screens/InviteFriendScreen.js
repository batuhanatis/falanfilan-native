import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Share } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Copy, Share2, Users, PartyPopper, Gift, Check, ArrowRight } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import { getStoreLink } from "../utils/appLinks";
import ScreenHeader from "../components/ScreenHeader";

export default function InviteFriendScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [referrals, setReferrals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.myReferrals(auth.token).then(setReferrals).catch(() => {}).finally(() => setLoading(false));
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);

  const storeLink = getStoreLink();
  const inviteMessage = `${auth.name} seni pellix'e davet ediyor! 🎬\n\nArkadaşlarınla birlikte kaydırıp saniyeler içinde ne izleyeceğinize karar verin. Kayıt olup MatchParty'de eşleştiğinizde SEN de +3 ekstra AI önerisi hakkı kazanırsın 🎁\n\nKayıt olurken "Davet Kodu" alanına şunu yaz: ${auth.username}${storeLink ? `\n\n${storeLink}` : ""}`;

  async function copyCode() {
    await Clipboard.setStringAsync(auth.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareInvite() {
    try {
      await Share.share({ message: inviteMessage });
    } catch { /* kullanıcı paylaşımı iptal etmiş olabilir */ }
  }

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const completed = referrals?.totalCompleted ?? 0;
  const invited = referrals?.totalInvited ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        title="Arkadaşını Davet Et"
        subtitle={invited > 0 ? `${completed}/${invited} davet tamamlandı` : "Birlikte keşfedin"}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 34 }}>
        <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroIconWrap}><PartyPopper size={25} color="#fff" /></View>
          <Text style={styles.heroEyebrow}>PELLIX'İ BİRLİKTE KULLANIN</Text>
          <Text style={styles.heroTitle}>Arkadaşını getir, ilk MatchParty'nizi başlatın</Text>
          <Text style={styles.heroSubtitle}>İlk ortak eşleşmenizde ikiniz de ekstra AI hakkı kazanırsınız.</Text>
          <View style={styles.rewardPillRow}>
            <View style={styles.rewardPill}>
              <Text style={styles.rewardPillEmoji}>🎁</Text>
              <Text style={styles.rewardPillText}>Sana +5 AI</Text>
            </View>
            <View style={styles.rewardPill}>
              <Text style={styles.rewardPillEmoji}>🎉</Text>
              <Text style={styles.rewardPillText}>Ona +3 AI</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>3 adımda tamamla</Text>
          {[
            ["Davet kodunu paylaş", "Arkadaşın Pellix'e senin kodunla katılsın."],
            ["Bir MatchParty başlatın", "Birlikte kartları kaydırıp ortak seçiminizi bulun."],
            ["Eşleşin ve ödülü alın", "İlk ortak eşleşmede haklar otomatik tanımlansın."],
          ].map(([title, text], i) => (
            <View key={title} style={styles.stepRow}>
              <View style={styles.stepNumWrap}><Text style={styles.stepNum}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepText}>{text}</Text>
              </View>
              <ArrowRight size={13} color={c.dim} />
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>DAVET KODUN</Text>
        <TouchableOpacity style={styles.codeCard} onPress={copyCode} activeOpacity={0.82}>
          <View>
            <Text style={styles.codeText}>{auth.username}</Text>
            <Text style={styles.codeTapHint}>{copied ? "Panoya kopyalandı ✓" : "Kopyalamak için dokun"}</Text>
          </View>
          <View style={[styles.copyBtn, copied && styles.copyBtnDone]}>
            {copied ? <Check size={16} color={c.bg} /> : <Copy size={16} color={c.text} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={shareInvite} activeOpacity={0.88}>
          <Share2 size={17} color={c.bg} />
          <Text style={styles.shareBtnText}>Davet Linkini Paylaş</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Users size={16} color={c.dim} />
            <Text style={styles.statValue}>{invited}</Text>
            <Text style={styles.statLabel}>Davet Edilen</Text>
          </View>
          <View style={styles.statBox}>
            <Gift size={16} color={c.accent} />
            <Text style={[styles.statValue, { color: c.accent }]}>{completed}</Text>
            <Text style={styles.statLabel}>Tamamlanan</Text>
          </View>
        </View>

        {referrals?.results?.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>DAVETLERİN</Text>
            <View style={styles.list}>
              {referrals.results.map((r, i) => (
                <View key={i} style={styles.listRow}>
                  <RetryImage source={{ uri: avatarOr(r.avatar_url, r.username) }} style={styles.listAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{r.name}</Text>
                    <Text style={styles.listMeta}>
                      {r.completed ? "İlk eşleşme tamamlandı 🎉" : "Bir MatchParty eşleşmesi bekliyor"}
                    </Text>
                  </View>
                  <View style={[styles.statusDot, r.completed && styles.statusDotDone]}>
                    {r.completed && <Check size={10} color={c.bg} />}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    heroCard: { borderRadius: 22, padding: 22, alignItems: "center", overflow: "hidden" },
    heroIconWrap: { width: 50, height: 50, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
    heroEyebrow: { fontSize: 9, fontWeight: "900", color: "rgba(255,255,255,0.72)", letterSpacing: 1, marginTop: 12 },
    heroTitle: { fontSize: 18, fontWeight: "900", color: "#fff", marginTop: 5, textAlign: "center", lineHeight: 24 },
    heroSubtitle: { fontSize: 11.5, color: "rgba(255,255,255,0.84)", marginTop: 7, textAlign: "center", lineHeight: 17, maxWidth: 280 },
    rewardPillRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    rewardPill: {
      flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    },
    rewardPillEmoji: { fontSize: 13 },
    rewardPillText: { fontSize: 11.5, fontWeight: "800", color: "#fff" },
    stepsCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      padding: 14, marginTop: 14, gap: 4,
    },
    stepsTitle: { fontSize: 12.5, fontWeight: "800", color: c.text, marginBottom: 4 },
    stepRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
    stepNumWrap: {
      width: 24, height: 24, borderRadius: 999, backgroundColor: c.surface2,
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    stepNum: { fontSize: 11, fontWeight: "900", color: c.accent },
    stepTitle: { fontSize: 11.5, fontWeight: "800", color: c.text },
    stepText: { fontSize: 10.5, color: c.dim, lineHeight: 15, marginTop: 1 },
    sectionLabel: { fontSize: 10.5, fontWeight: "900", color: c.dim, letterSpacing: 0.9, marginTop: 24, marginBottom: 9 },
    codeCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.accent, borderStyle: "dashed",
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    },
    codeText: { fontSize: 19, fontWeight: "900", color: c.text, letterSpacing: 0.8 },
    codeTapHint: { fontSize: 9.5, color: c.dim, marginTop: 2 },
    copyBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    copyBtnDone: { backgroundColor: c.accent },
    shareBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, marginTop: 14,
    },
    shareBtnText: { color: c.bg, fontWeight: "900", fontSize: 14 },
    statsRow: { flexDirection: "row", gap: 12, marginTop: 20 },
    statBox: {
      flex: 1, alignItems: "center", gap: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, paddingVertical: 15,
    },
    statValue: { fontSize: 20, fontWeight: "900", color: c.text },
    statLabel: { fontSize: 10.5, color: c.dim, fontWeight: "700" },
    list: { gap: 8 },
    listRow: {
      flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, padding: 12,
    },
    listAvatar: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.surface2 },
    listName: { fontSize: 13, fontWeight: "800", color: c.text },
    listMeta: { fontSize: 10.5, color: c.dim, marginTop: 2 },
    statusDot: { width: 20, height: 20, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    statusDotDone: { backgroundColor: c.accent, borderColor: c.accent },
  });
}
