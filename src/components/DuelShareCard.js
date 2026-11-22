import { t as translateUI } from "../i18n/core";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONTS, upperTR } from "../theme/fonts";
import RetryImage from "./RetryImage";
import { avatarOr } from "../utils/avatar";

// Dizi Düellosu sonuç kartı (9:16, Story). Günün Seansı ailesi: koyu zemin, üstte altın spot,
// Big Shoulders skor, DM Mono künye, oynanan diziler bilet koçanı olarak. Paylaşılan görsel
// olduğu için renkler temadan bağımsız. 360x640 çiziliyor, 3x yakalanınca 1080x1920.
export const DUEL_CARD_WIDTH = 360;
export const DUEL_CARD_HEIGHT = 640;

const CREAM = "#f3ead8";
const DIM = "#8c8579";
const GOLD = "#c9a44c";

export default function DuelShareCard({ duel, me }) {
  const players = duel.players || [];
  const mine = players.find((p) => p.id === me) || players[0];
  const opp = players.find((p) => p.id !== me) || players[1];
  const winner = players.find((p) => p.id === duel.result?.winnerId);
  const headline = winner ? translateUI("{0} kazandı", { 0: winner.name }) : translateUI("Berabere");
  // İki oyuncu aynı yapımı seçtiyse bir kez yazılır.
  const titles = [...new Set((duel.picks || []).map((p) => duel.candidates?.find((c) => c.titleId === p.titleId)?.title).filter(Boolean))];
  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.28)", "rgba(201,164,76,0)"]} style={styles.spot} />
      <Text style={styles.kicker}>{translateUI("PELLIX · DÜELLO")}</Text>
      <Text style={styles.headline} numberOfLines={2}>{upperTR(headline)}</Text>

      <View style={styles.faceoff}>
        <Player p={mine} win={winner?.id === mine?.id} />
        <Text style={styles.vs}>{translateUI("VS")}</Text>
        <Player p={opp} win={winner?.id === opp?.id} />
      </View>
      <Text style={styles.score}>{mine?.score ?? 0}<Text style={{ color: DIM }}>{"  -  "}</Text>{opp?.score ?? 0}</Text>

      <View style={styles.tickets}>
        {titles.map((t, i) => (
          <View key={i} style={styles.ticket}>
            <Text style={styles.ticketRound}>{translateUI("{0}. TUR", { 0: i + 1 })}</Text>
            <Text style={styles.ticketTitle} numberOfLines={2}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.foot}>
        <Text style={styles.footBig}>{translateUI("Sıra sende.")}</Text>
        <Text style={styles.footSmall}>{translateUI("pellix · Pellix Play")}</Text>
      </View>
    </View>
  );
}

function Player({ p, win }) {
  return (
    <View style={styles.player}>
      <RetryImage source={{ uri: avatarOr(p?.avatarUrl, p?.id) }} style={[styles.avatar, win && { borderColor: GOLD }]} />
      <Text style={styles.name} numberOfLines={1}>{p?.name || ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: DUEL_CARD_WIDTH, height: DUEL_CARD_HEIGHT, backgroundColor: "#100e10", paddingHorizontal: 28, paddingTop: 54, overflow: "hidden" },
  spot: { position: "absolute", left: 0, right: 0, top: 0, height: 320 },
  kicker: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 2.2, textAlign: "center" },
  headline: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 46, lineHeight: 48, textAlign: "center", marginTop: 14 },
  faceoff: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 34 },
  player: { alignItems: "center", width: 110 },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: "rgba(243,234,216,0.16)", backgroundColor: "#242230" },
  name: { color: CREAM, fontSize: 14, fontWeight: "800", marginTop: 8, maxWidth: 110 },
  vs: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 12, letterSpacing: 2 },
  score: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 64, lineHeight: 70, textAlign: "center", marginTop: 14 },
  tickets: { flexDirection: "row", gap: 10, marginTop: 22 },
  ticket: { flex: 1, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(201,164,76,0.5)", borderRadius: 12, padding: 12, minHeight: 74 },
  ticketRound: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.4 },
  ticketTitle: { color: CREAM, fontSize: 14, fontWeight: "800", marginTop: 6, lineHeight: 18 },
  foot: { position: "absolute", left: 0, right: 0, bottom: 46, alignItems: "center" },
  footBig: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 30 },
  footSmall: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.6, marginTop: 4 },
});
