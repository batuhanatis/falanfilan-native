import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const MEDALS = ["🥇", "🥈", "🥉"];

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "Sıfırlanıyor";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  if (days > 0) return `${days}G ${hours}S KALDI`;
  const minutes = totalMinutes % 60;
  return `${hours}S ${minutes}D KALDI`;
}

// Haftalık görev ilerlemesinden (bkz. backend QUEST_POINTS) türetilen, arkadaş grubuna özel
// liderlik tablosu. Kendi sıran ilk 3'te değilse, listenin altında ayrı bir vurgulu satırla
// gösteriliyor — bir üstündeki kişiye kaç puan kaldığı ile birlikte, motive edici bir eksiklik.
export default function LeaderboardCard({ data }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  if (!data || !Array.isArray(data.entries) || data.entries.length < 2) return null;

  const entries = data.entries;
  const top = entries.slice(0, 3);
  const meIndex = entries.findIndex((e) => Number(e.user.id) === Number(auth.id));
  const me = meIndex >= 0 ? entries[meIndex] : null;
  const meInTop = meIndex >= 0 && meIndex < 3;
  const ahead = meIndex > 0 ? entries[meIndex - 1] : null;
  const maxScore = top[0]?.score || 1;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>🏆 Bu Hafta</Text>
        <Text style={styles.sub}>{formatCountdown(data.msUntilReset)}</Text>
      </View>

      {top.map((entry, i) => (
        <View key={entry.user.id} style={[styles.row, meInTop && meIndex === i && styles.rowMe]}>
          <Text style={styles.medal}>{MEDALS[i]}</Text>
          <View style={styles.avatar} />
          <Text style={styles.name} numberOfLines={1}>{Number(entry.user.id) === Number(auth.id) ? "Sen" : entry.user.name}</Text>
          <Text style={styles.pts}>{entry.score} p</Text>
        </View>
      ))}

      {!meInTop && me && (
        <View style={styles.meBox}>
          <Text style={styles.rank}>{me.rank}</Text>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.meText}><Text style={styles.meTextBold}>Sen</Text> · {me.score} p</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.min(100, Math.round((me.score / maxScore) * 100))}%` }]} />
            </View>
          </View>
          {!!ahead && <Text style={styles.deficit}>{ahead.user.name.split(" ")[0]}'e −{Math.max(1, ahead.score - me.score)}</Text>}
        </View>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 14, marginBottom: 14 },
    head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
    title: { color: c.text, fontWeight: "900", fontSize: 15 },
    sub: { color: c.dim, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderRadius: 10 },
    rowMe: { backgroundColor: c.surface2, paddingHorizontal: 6, marginHorizontal: -6 },
    medal: { width: 20, fontSize: 15, textAlign: "center" },
    avatar: { width: 30, height: 30, borderRadius: 999, backgroundColor: c.surface2 },
    name: { flex: 1, color: c.text, fontWeight: "700", fontSize: 12.5 },
    pts: { color: c.accent, fontWeight: "700", fontSize: 11.5 },
    meBox: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, padding: 9, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.accent },
    rank: { width: 20, textAlign: "center", color: c.dim, fontWeight: "800", fontSize: 13 },
    meText: { color: c.dim, fontSize: 11 },
    meTextBold: { color: c.text, fontWeight: "800" },
    bar: { height: 5, borderRadius: 999, backgroundColor: c.surface, marginTop: 5, overflow: "hidden" },
    barFill: { height: "100%", backgroundColor: c.accent, borderRadius: 999 },
    deficit: { color: c.dim, fontSize: 10, fontWeight: "700" },
  });
}
