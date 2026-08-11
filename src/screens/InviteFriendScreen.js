import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Share, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Copy, Share2, Users, PartyPopper, Gift, Check } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import { getStoreLink } from "../utils/appLinks";

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
  const inviteMessage = `${auth.name} seni pellix'e davet ediyor! 🎬\n\nArkadaşlarınla birlikte kaydırıp saniyeler içinde ne izleyeceğinize karar verin.\n\nKayıt olurken "Davet Kodu" alanına şunu yaz: ${auth.username}${storeLink ? `\n\n${storeLink}` : ""}`;

  async function copyCode() {
    await Clipboard.setStringAsync(auth.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareInvite() {
    try {
      await Share.share({ message: inviteMessage });
    } catch { /* kullanıcı paylaşımı iptal etmiş olabilir, sorun değil */ }
  }

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Arkadaşını Davet Et</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <PartyPopper size={30} color="#fff" />
          <Text style={styles.heroTitle}>Arkadaşını getir, ödül kazan</Text>
          <Text style={styles.heroSubtitle}>
            Davet ettiğin arkadaşınla MatchParty'de bir filmde eşleştiğinizde +5 ekstra AI önerisi hakkı kazanırsın.
          </Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>DAVET KODUN</Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeText}>{auth.username}</Text>
          <TouchableOpacity onPress={copyCode} style={styles.copyBtn}>
            {copied ? <Check size={16} color={c.accent} /> : <Copy size={16} color={c.text} />}
          </TouchableOpacity>
        </View>
        <Text style={styles.codeHint}>
          Arkadaşın kayıt olurken "Davet Kodu" alanına bu kullanıcı adını yazmalı.
        </Text>

        <TouchableOpacity style={styles.shareBtn} onPress={shareInvite}>
          <Share2 size={16} color={c.bg} />
          <Text style={styles.shareBtnText}>Davet Linkini Paylaş</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Users size={16} color={c.dim} />
            <Text style={styles.statValue}>{referrals?.totalInvited ?? 0}</Text>
            <Text style={styles.statLabel}>Davet Edilen</Text>
          </View>
          <View style={styles.statBox}>
            <Gift size={16} color={c.accent} />
            <Text style={[styles.statValue, { color: c.accent }]}>{referrals?.totalCompleted ?? 0}</Text>
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
                      {r.completed ? "Eşleştiniz, ödül kazanıldı 🎉" : "Henüz MatchParty'de eşleşmediniz"}
                    </Text>
                  </View>
                  {r.completed && <Check size={16} color={c.accent} />}
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
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    heroCard: { borderRadius: 22, padding: 24, alignItems: "center" },
    heroTitle: { fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 10, textAlign: "center" },
    heroSubtitle: { fontSize: 12.5, color: "rgba(255,255,255,0.92)", marginTop: 8, textAlign: "center", lineHeight: 18 },
    sectionLabel: { fontSize: 11, fontWeight: "800", color: c.dim, letterSpacing: 1, marginTop: 26, marginBottom: 10 },
    codeCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.accent, borderStyle: "dashed",
      borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18,
    },
    codeText: { fontSize: 20, fontWeight: "800", color: c.text, letterSpacing: 1 },
    copyBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    codeHint: { fontSize: 11.5, color: c.dim, marginTop: 8, lineHeight: 16 },
    shareBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, marginTop: 18,
    },
    shareBtnText: { color: c.bg, fontWeight: "800", fontSize: 14 },
    statsRow: { flexDirection: "row", gap: 12, marginTop: 22 },
    statBox: {
      flex: 1, alignItems: "center", gap: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, paddingVertical: 16,
    },
    statValue: { fontSize: 20, fontWeight: "800", color: c.text },
    statLabel: { fontSize: 10.5, color: c.dim, fontWeight: "700" },
    list: { gap: 8 },
    listRow: {
      flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, padding: 12,
    },
    listAvatar: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    listName: { fontSize: 13, fontWeight: "700", color: c.text },
    listMeta: { fontSize: 11, color: c.dim, marginTop: 2 },
  });
}
