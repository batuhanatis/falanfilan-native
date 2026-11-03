import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { api, saveAuth } from "../api";
import { C, FONTS, SAFE_X, SAFE_Y } from "../theme";
import QrCode from "../components/QrCode";
import FocusButton from "../components/FocusButton";

// TV'de kumandayla şifre yazdırmıyoruz: ekranda kod ve QR çıkıyor, telefon onaylıyor.
// Kod 10 dakika geçerli; süresi dolunca kendiliğinden yenisi alınıyor.
export default function PairScreen({ onPaired }) {
  const [pair, setPair] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      setPair(await api.startPairing("Android TV"));
    } catch (e) {
      setError(e.message || "Bağlanılamadı.");
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => { start(); }, [start]);

  useEffect(() => {
    if (!pair) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const s = await api.pairingStatus(pair.pairId);
        if (stopped) return;
        if (s.status === "approved") {
          const auth = { token: s.token, user: s.user };
          await saveAuth(auth);
          onPaired(auth);
        } else if (s.status === "expired") {
          start();
        }
      } catch (e) {
        if (!stopped && e.status === 404) start();
      }
    };
    const id = setInterval(tick, 3000);
    return () => { stopped = true; clearInterval(id); };
  }, [pair, start, onPaired]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = pair ? Math.max(0, Math.round((new Date(pair.expiresAt).getTime() - now) / 1000)) : 0;
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <View style={styles.root}>
      <View style={styles.textCol}>
        <Text style={styles.logo}>pellix</Text>
        <Text style={styles.title}>TV'ye hoş geldin</Text>
        <Text style={styles.lead}>Önerilerin burada da seni bekliyor. Seçtiğin içerik, izleyeceğin uygulamada açılır.</Text>

        <View style={styles.steps}>
          <Text style={styles.step}><Text style={styles.stepNo}>1  </Text>Telefonunun kamerasıyla QR kodu okut.</Text>
          <Text style={styles.step}><Text style={styles.stepNo}>2  </Text>Açılan Pellix ekranında "Onayla"ya bas.</Text>
        </View>

        {error ? (
          <View style={{ marginTop: 22, alignItems: "flex-start" }}>
            <Text style={styles.error}>{error}</Text>
            <FocusButton label="Tekrar dene" onPress={start} primary hasTVPreferredFocus style={{ marginTop: 12 }} />
          </View>
        ) : pair ? (
          <View style={{ marginTop: 22 }}>
            <Text style={styles.codeLabel}>KOD</Text>
            <Text style={styles.code}>{`${pair.code.slice(0, 3)} ${pair.code.slice(3)}`}</Text>
            <Text style={styles.expire}>{left > 0 ? `${mmss} sonra yeni kod gelir` : "Yeni kod alınıyor…"}</Text>
          </View>
        ) : (
          <ActivityIndicator color={C.accent} style={{ marginTop: 30, alignSelf: "flex-start" }} />
        )}
      </View>

      <View style={styles.qrCol}>
        {pair && !error ? (
          <>
            <QrCode value={pair.link} size={230} />
            <Text style={styles.qrHint}>KAMERAYLA OKUT</Text>
          </>
        ) : <View style={styles.qrPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: SAFE_X * 1.5, paddingVertical: SAFE_Y, backgroundColor: C.bg },
  textCol: { flex: 1, paddingRight: 48 },
  logo: { fontFamily: FONTS.logo, fontSize: 30, color: C.text, marginBottom: 10 },
  title: { fontFamily: FONTS.marquee, fontSize: 52, lineHeight: 54, color: C.text },
  lead: { color: C.dim, fontSize: 17, lineHeight: 24, marginTop: 8, maxWidth: 460 },
  steps: { marginTop: 22, gap: 8 },
  step: { color: C.text, fontSize: 17 },
  stepNo: { fontFamily: FONTS.monoMedium, color: C.accent },
  codeLabel: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 2 },
  code: { fontFamily: FONTS.monoMedium, color: C.text, fontSize: 56, letterSpacing: 8, marginTop: 2 },
  expire: { fontFamily: FONTS.mono, color: C.dim, fontSize: 13, marginTop: 4 },
  error: { color: C.danger, fontSize: 16 },
  qrCol: { alignItems: "center" },
  qrHint: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 2, marginTop: 12 },
  qrPlaceholder: { width: 230, height: 230, borderRadius: 10, backgroundColor: C.surface },
});
