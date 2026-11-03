import { t as translateUI } from "../i18n/core";
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Tv, Check } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticSuccess, hapticWarning } from "../utils/haptics";
import { FONTS } from "../theme/fonts";

const normalize = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

// TV eşleştirme onayı: TV ekranındaki QR open.pellix.app/tv/<kod> açıyor, buradan "Onayla"ya
// basınca o TV bu hesapla açılıyor. Kod linkte yoksa elle yazılabiliyor.
export default function TvPairScreen({ route, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [code, setCode] = useState(normalize(route.params?.code));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const leave = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MainTabs"));

  async function approve() {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.approveTvPair(auth.token, code);
      hapticSuccess();
      setDone(true);
    } catch (e) {
      hapticWarning();
      setError(translateUI(e.message || "Onaylanamadı, tekrar dene."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) + 4, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <TouchableOpacity style={styles.back} onPress={leave} accessibilityRole="button" accessibilityLabel={translateUI("Geri")}>
        <ChevronLeft size={22} color={c.text} />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.icon}>{done ? <Check size={30} color={c.accent} /> : <Tv size={30} color={c.accent} />}</View>
        <Text style={styles.title}>{done ? translateUI("TV'de açıldı") : translateUI("TV'ye bağlan")}</Text>
        <Text style={styles.text}>
          {done
            ? translateUI("Önerilerin artık TV'de. Seçtiğin içerik, izleyeceğin uygulamada açılır.")
            : translateUI("Bu TV'de Pellix hesabınla oturum açılacak. Aşağıdaki kod TV ekranındakiyle aynı mı?")}
        </Text>

        {!done && (
          <TextInput
            style={styles.code}
            value={code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code}
            onChangeText={(v) => { setCode(normalize(v)); setError(null); }}
            placeholder={translateUI("KOD")}
            placeholderTextColor={c.dim}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            accessibilityLabel={translateUI("TV kodu")}
          />
        )}
        {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      </View>

      {done ? (
        <TouchableOpacity style={styles.primary} onPress={leave} accessibilityRole="button">
          <Text style={styles.primaryText}>{translateUI("Tamam")}</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.primary, (code.length !== 6 || busy) && { opacity: 0.5 }]}
            onPress={approve}
            disabled={code.length !== 6 || busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#1a140b" /> : <Text style={styles.primaryText}>{translateUI("Onayla")}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={leave} accessibilityRole="button">
            <Text style={styles.secondaryText}>{translateUI("Vazgeç")}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 20 },
    back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -10 },
    body: { flex: 1, alignItems: "center", justifyContent: "center" },
    icon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    title: { fontFamily: FONTS.marquee, fontSize: 40, color: c.text, textAlign: "center" },
    text: { color: c.dim, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8, maxWidth: 320 },
    code: {
      marginTop: 26, minWidth: 220, height: 64, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
      color: c.text, fontFamily: FONTS.monoMedium, fontSize: 30, letterSpacing: 6, textAlign: "center",
    },
    error: { color: c.danger, fontSize: 13.5, marginTop: 12, textAlign: "center", maxWidth: 320 },
    primary: { height: 52, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    primaryText: { color: "#1a140b", fontSize: 16, fontWeight: "800" },
    secondary: { height: 48, alignItems: "center", justifyContent: "center", marginTop: 6 },
    secondaryText: { color: c.dim, fontSize: 15, fontWeight: "600" },
  });
}
