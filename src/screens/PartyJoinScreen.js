import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link2, Users, Check, AlertCircle } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { partyLinkApi } from "../api/partyLinks";
import ScreenHeader from "../components/ScreenHeader";
import RetryImage from "../components/RetryImage";
import { avatarOr } from "../utils/avatar";
import { hapticSuccess } from "../utils/haptics";

export default function PartyJoinScreen({ navigation, route }) {
  const inviteToken = route?.params?.token;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!inviteToken) {
      setError("Geçersiz Party linki.");
      setLoading(false);
      return undefined;
    }
    partyLinkApi.preview(auth.token, inviteToken)
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch((e) => { if (!cancelled) setError(e.message || "Party linki açılamadı."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.token, inviteToken]);

  async function join() {
    if (!inviteToken || joining) return;
    setJoining(true);
    setError("");
    try {
      const joined = await partyLinkApi.join(auth.token, inviteToken);
      const sessionId = joined.sessionId || preview?.sessionId;
      if (!sessionId) throw new Error("Party oturumu bulunamadı.");

      // Link join endpoint'i mevcut MatchParty güvenli kabul akışına bir 'invited' üyelik bırakır.
      // Queue üretimi ve diğer üyelere party_accepted sinyali mevcut endpoint'te kalır.
      if (!joined.creator && joined.status !== "joined") {
        await api.respondParty(auth.token, sessionId, true);
      }
      hapticSuccess();
      navigation.replace("MatchParty", { sessionId });
    } catch (e) {
      setError(e.message || "Party'ye katılınamadı.");
    }
    setJoining(false);
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Party Daveti" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
      ) : error && !preview ? (
        <View style={styles.centerContent}>
          <View style={styles.errorIcon}><AlertCircle size={25} color={c.danger} /></View>
          <Text style={styles.title}>Bu link açılamadı</Text>
          <Text style={styles.sub}>{error}</Text>
        </View>
      ) : (
        <View style={styles.centerContent}>
          <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} style={styles.heroIcon}>
            <Link2 size={30} color="#fff" />
          </LinearGradient>
          <Text style={styles.eyebrow}>MATCHPARTY DAVETİ</Text>
          <Text style={styles.title}>{preview?.creator?.name || "Bir arkadaşın"} seni Party'ye çağırıyor</Text>
          <Text style={styles.sub}>Aynı içerikleri kaydırın, hepinizin beğendiği yapımları birlikte bulun.</Text>

          <View style={styles.creatorCard}>
            <RetryImage source={{ uri: avatarOr(preview?.creator?.avatarUrl, preview?.creator?.id) }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.creatorName}>{preview?.creator?.name || "Party sahibi"}</Text>
              <Text style={styles.creatorMeta}>{preview?.uses || 0}/{preview?.maxUses || 6} kişi linki kullandı</Text>
            </View>
            <Users size={17} color={c.dim} />
          </View>

          {preview?.expired ? (
            <View style={styles.expiredBox}><AlertCircle size={15} color={c.danger} /><Text style={styles.expiredText}>Bu Party linkinin süresi dolmuş.</Text></View>
          ) : (
            <TouchableOpacity style={styles.joinBtn} onPress={join} disabled={joining} activeOpacity={0.86}>
              {joining ? <ActivityIndicator color="#14121a" /> : <><Check size={17} color="#14121a" strokeWidth={2.8} /><Text style={styles.joinText}>{preview?.alreadyMine ? "Kendi Party'me Dön" : "Party'ye Katıl"}</Text></>}
            </TouchableOpacity>
          )}
          {!!error && !!preview && <Text style={styles.inlineError}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg }, center: { flex: 1, alignItems: "center", justifyContent: "center" },
    centerContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    heroIcon: { width: 76, height: 76, borderRadius: 25, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    errorIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    eyebrow: { color: c.accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginBottom: 5 },
    title: { color: c.text, fontSize: 22, fontWeight: "900", textAlign: "center", maxWidth: 330 },
    sub: { color: c.dim, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7, maxWidth: 330 },
    creatorCard: { width: "100%", maxWidth: 360, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 13 },
    avatar: { width: 46, height: 46, borderRadius: 999, backgroundColor: c.surface2 },
    creatorName: { color: c.text, fontSize: 13.5, fontWeight: "800" }, creatorMeta: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    joinBtn: { width: "100%", maxWidth: 360, minHeight: 48, borderRadius: 15, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
    joinText: { color: "#14121a", fontSize: 13, fontWeight: "900" },
    expiredBox: { width: "100%", maxWidth: 360, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, padding: 13, borderRadius: 14, backgroundColor: `${c.danger}15`, borderWidth: 1, borderColor: `${c.danger}45` },
    expiredText: { color: c.danger, fontSize: 11.5, fontWeight: "700" }, inlineError: { color: c.danger, fontSize: 11, textAlign: "center", marginTop: 10 },
  });
}
