import { t as translateUI } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swords, Crown, AlertCircle, History } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { duelApi } from "../api/duels";
import ScreenHeader from "../components/ScreenHeader";
import RetryImage from "../components/RetryImage";
import { SALON } from "../components/salon/SalonKit";
import { Tabela, Kocan, fmt } from "../components/duel/DuelRecord";
import { FONTS } from "../theme/fonts";
import { avatarOr } from "../utils/avatar";
import { hapticSuccess, hapticWarning, hapticSelection } from "../utils/haptics";

// Düello geçmişi. Parametresiz: bütün düellolar ve rakiplerin; friend ile: o kişiyle aranızdaki
// karne (Tabela) ve aranızdaki düellolar. Buradan çağrılan düello, QuizDuel ekranında açılıyor.
const PAGE = 20;

export default function QuizDuelHistoryScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.bottom]);
  const friend = route?.params?.friend || null;

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState("");
  // auth avatarı tutmuyor; tabelada kendi fotoğrafın için ayrıca (BlendScreen'deki gibi).
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);
  useEffect(() => {
    if (!friend || !auth?.token) return;
    api.me(auth.token).then((m) => setMyAvatarUrl(m.avatarUrl || null)).catch(() => {});
  }, [friend?.id, auth?.token]);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await duelApi.history(auth.token, { friendId: friend?.id, limit: PAGE }));
    } catch {
      setFailed(true);
    }
  }, [auth?.token, friend?.id]);
  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    if (!data?.nextBefore || more) return;
    setMore(true);
    try {
      const next = await duelApi.history(auth.token, { friendId: friend?.id, limit: PAGE, before: data.nextBefore });
      setData((prev) => ({ ...prev, duels: [...prev.duels, ...next.duels], nextBefore: next.nextBefore }));
    } catch {}
    setMore(false);
  }

  async function call() {
    if (!friend || calling) return;
    setCallError(""); setCalling(true);
    try {
      const res = await duelApi.invite(auth.token, friend.id);
      hapticSuccess();
      navigation.navigate("QuizDuel", { duelId: res.duel.id });
    } catch (e) {
      hapticWarning();
      setCallError(e.code === "DUEL_LIMIT" ? "limit" : e.message);
    }
    setCalling(false);
  }

  function share(d) {
    const message = translateUI("Pellix'te düello yaptık: {0} - {1}. Sıra sende.", { 0: d.myScore, 1: d.oppScore });
    Share.share({ message: `${message} ${d.shareUrl}`, url: d.shareUrl }).catch(() => {});
  }

  const openRival = (opponent) => { hapticSelection(); navigation.push("QuizDuelHistory", { friend: opponent }); };

  const header = (
    <ScreenHeader
      title={friend ? translateUI("Karne") : translateUI("Düello geçmişi")}
      subtitle={friend ? translateUI("{0} ile", { 0: friend.name }) : translateUI("Bütün rakiplerin")}
      onBack={() => navigation.goBack()}
    />
  );
  if (!data && !failed) return <View style={styles.root}>{header}<View style={[styles.root, styles.center]}><ActivityIndicator color={c.accent} /></View></View>;
  if (failed) {
    return (
      <View style={styles.root}>{header}
        <View style={[styles.root, styles.center, { padding: 28 }]}>
          <AlertCircle size={22} color={c.dim} />
          <Text style={styles.emptyText}>{translateUI("Düello geçmişi alınamadı.")}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={load}><Text style={styles.secondaryText}>{translateUI("Tekrar dene")}</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  const record = friend ? data.rivals.find((r) => r.opponent.id === friend.id) || null : null;
  const meP = { id: auth?.id, avatarUrl: myAvatarUrl };
  const empty = data.duels.length === 0;

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {friend ? (
          <>
            <Tabela me={meP} opp={record?.opponent || friend} record={record} />
            <TouchableOpacity style={[styles.primaryBtn, calling && { opacity: 0.6 }]} onPress={call} disabled={calling} accessibilityLabel={translateUI("{0} ile düello", { 0: friend.name })}>
              {calling ? <ActivityIndicator color={SALON.onGold} /> : <><Swords size={16} color={SALON.onGold} /><Text style={styles.primaryText}>{record?.streak?.outcome === "loss" ? translateUI("Rövanş iste") : translateUI("Düelloya çağır")}</Text></>}
            </TouchableOpacity>
            {callError === "limit" ? (
              <TouchableOpacity style={styles.note} onPress={() => navigation.navigate("Premium", { reason: "duel_limit" })} activeOpacity={0.85}>
                <Crown size={18} color={c.accent} />
                <Text style={styles.noteText}>{translateUI("Bugünkü 3 düello hakkını kullandın. Premium ile sınırsız düello yapabilirsin.")}</Text>
              </TouchableOpacity>
            ) : !!callError && (
              <View style={styles.errorBox}><AlertCircle size={14} color={c.danger} /><Text style={styles.errorText}>{translateUI(callError)}</Text></View>
            )}
          </>
        ) : (
          <View style={styles.summary}>
            <SummaryCell styles={styles} value={fmt(data.total.played)} label={translateUI("DÜELLO")} />
            <SummaryCell styles={styles} value={fmt(data.total.wins)} label={translateUI("GALİBİYET")} gold />
            <SummaryCell styles={styles} value={fmt(data.total.losses)} label={translateUI("MAĞLUBİYET")} />
            <SummaryCell styles={styles} value={fmt(data.total.draws)} label={translateUI("BERABERE")} />
          </View>
        )}

        {!friend && data.rivals.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{translateUI("RAKİPLERİN")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {data.rivals.map((r) => (
                <TouchableOpacity key={r.opponent.id} style={styles.rival} onPress={() => openRival(r.opponent)} activeOpacity={0.85} accessibilityLabel={translateUI("{0} ile karnen", { 0: r.opponent.name })}>
                  <RetryImage source={{ uri: avatarOr(r.opponent.avatarUrl, r.opponent.id) }} style={styles.rivalAvatar} />
                  <Text style={styles.rivalName} numberOfLines={1}>{r.opponent.name}</Text>
                  <Text style={[styles.rivalScore, r.wins > r.losses && { color: c.accent }]}>{`${r.wins} – ${r.losses}`}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionLabel}>{friend ? translateUI("ARANIZDAKİ DÜELLOLAR") : translateUI("BÜTÜN DÜELLOLAR")}</Text>
        {empty ? (
          <View style={styles.emptyCard}>
            <History size={20} color={c.dim} />
            <Text style={styles.emptyText}>{friend ? translateUI("{0} ile henüz düello yapmadınız. İlk düello burada görünecek.", { 0: friend.name }) : translateUI("Bitirdiğin düellolar burada görünecek.")}</Text>
          </View>
        ) : data.duels.map((d) => (
          <Kocan
            key={d.id}
            duel={d}
            c={c}
            showOpponent={!friend}
            onPress={friend ? undefined : () => openRival(d.opponent)}
            onShare={friend ? () => share(d) : undefined}
          />
        ))}
        {!!data.nextBefore && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={loadMore} disabled={more}>
            {more ? <ActivityIndicator color={c.accent} /> : <Text style={styles.secondaryText}>{translateUI("Daha eski düellolar")}</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCell({ styles, value, label, gold }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, gold && styles.summaryGold]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c, insets) {
  const safeBottom = Math.max(36, insets.bottom + 24);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center", gap: 10 },
    content: { padding: 16, paddingBottom: safeBottom },
    summary: { flexDirection: "row", gap: 8 },
    summaryCell: { flex: 1, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 12, alignItems: "center" },
    summaryValue: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26 },
    summaryGold: { color: c.accent },
    summaryLabel: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 1, marginTop: 2 },
    sectionLabel: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 22, marginBottom: 9 },
    rival: { width: 96, alignItems: "center", backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingVertical: 12, paddingHorizontal: 8 },
    rivalAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2 },
    rivalName: { color: c.text, fontSize: 12, fontWeight: "800", marginTop: 7, maxWidth: 80 },
    rivalScore: { color: c.text, fontFamily: FONTS.marquee, fontSize: 20, marginTop: 2 },
    primaryBtn: { minHeight: 48, marginTop: 12, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    primaryText: { color: SALON.onGold, fontSize: 13, fontWeight: "900" },
    secondaryBtn: { alignSelf: "stretch", minHeight: 46, marginTop: 6, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    secondaryText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    note: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SALON.goldTint, borderWidth: 1, borderColor: SALON.goldLine, borderRadius: 14, padding: 12 },
    noteText: { flex: 1, color: c.text, fontSize: 12, lineHeight: 17 },
    errorBox: { marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: `${c.danger}12`, borderWidth: 1, borderColor: `${c.danger}35`, borderRadius: 12, padding: 10 },
    errorText: { flex: 1, color: c.danger, fontSize: 11, lineHeight: 15 },
    emptyCard: { alignItems: "center", gap: 8, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 22 },
    emptyText: { color: c.dim, fontSize: 12, lineHeight: 18, textAlign: "center" },
  });
}
