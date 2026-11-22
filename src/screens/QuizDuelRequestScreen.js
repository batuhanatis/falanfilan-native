import { t as translateUI } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, Check, Send, BellRing } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { duelApi } from "../api/duels";
import ScreenHeader from "../components/ScreenHeader";
import { SALON } from "../components/salon/SalonKit";
import { RequestRow } from "../components/duel/TitleRequest";
import { hapticSuccess, hapticWarning } from "../utils/haptics";

// Yapım öner: düello soru havuzunda olmayan yapımlar için istek. Üstte beğendiklerinden havuzda
// olmayanlar (tek dokunuşla "Eklensin"), altında listede olmayan bir yapımı yazma alanı ve şu an
// soru havuzunda olan yapımlar. İstekler yöneticiye e-postayla gider; soru havuzu eklenince isteyen
// kullanıcıya bildirim gelir.
export default function QuizDuelRequestScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.bottom]);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { kind: "sent" | "available" | "duplicate" | "error", title, message }

  const load = useCallback(async () => {
    setFailed(false);
    try { setData(await duelApi.requests(auth.token)); } catch { setFailed(true); }
  }, [auth?.token]);
  useEffect(() => { load(); }, [load]);

  const request = (movieId) => duelApi.requestTitle(auth.token, { movieId });

  async function sendText() {
    const title = text.trim();
    if (title.length < 2 || sending) return;
    setSending(true); setResult(null);
    try {
      const res = await duelApi.requestTitle(auth.token, { title, note: note.trim() || undefined });
      if (res.available) setResult({ kind: "available", title: res.title });
      else { hapticSuccess(); setResult({ kind: res.duplicate ? "duplicate" : "sent", title: res.title }); setText(""); setNote(""); }
    } catch (e) {
      hapticWarning();
      setResult({ kind: "error", message: e.message });
    }
    setSending(false);
  }

  const header = <ScreenHeader title={translateUI("Yapım öner")} subtitle={translateUI("Düello soru havuzu")} onBack={() => navigation.goBack()} />;
  if (!data && !failed) return <View style={styles.root}>{header}<View style={[styles.root, styles.center]}><ActivityIndicator color={c.accent} /></View></View>;
  if (failed) {
    return (
      <View style={styles.root}>{header}
        <View style={[styles.root, styles.center, { padding: 28 }]}>
          <AlertCircle size={22} color={c.dim} />
          <Text style={styles.dimText}>{translateUI("Öneriler alınamadı.")}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={load}><Text style={styles.secondaryText}>{translateUI("Tekrar dene")}</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  const pending = (data.requests || []).filter((r) => !r.readyAt);
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <BellRing size={18} color={c.accent} />
          <Text style={styles.introText}>{translateUI("Düellolar soru havuzundaki yapımlarla oynanıyor. Eksik gördüğün yapımın eklenmesini iste; soru havuzu hazır olunca sana bildirim gelir.")}</Text>
        </View>

        <Text style={styles.section}>{translateUI("BEĞENDİKLERİNDEN HAVUZDA OLMAYANLAR")}</Text>
        {data.liked.length === 0 ? (
          <Text style={styles.dimText}>{translateUI("Beğendiğin yapımların hepsi zaten soru havuzunda.")}</Text>
        ) : data.liked.map((m) => (
          <RequestRow
            key={m.movieId}
            item={m}
            c={c}
            onRequest={() => request(m.movieId)}
            onOpen={() => navigation.navigate("Detail", { movie: { id: m.movieId } })}
            meta={m.requestCount > 0 ? translateUI("{0} kişi istedi", { 0: m.requestCount }) : null}
          />
        ))}

        <Text style={styles.section}>{translateUI("LİSTEDE YOK MU?")}</Text>
        <View style={styles.form}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={translateUI("Film ya da dizinin adı")}
            placeholderTextColor={c.dim}
            style={styles.input}
            maxLength={80}
            returnKeyType="send"
            onSubmitEditing={sendText}
            accessibilityLabel={translateUI("Film ya da dizinin adı")}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={translateUI("Not (isteğe bağlı)")}
            placeholderTextColor={c.dim}
            style={[styles.input, { marginTop: 8 }]}
            maxLength={300}
            accessibilityLabel={translateUI("Not (isteğe bağlı)")}
          />
          <TouchableOpacity style={[styles.primaryBtn, (text.trim().length < 2 || sending) && { opacity: 0.5 }]} disabled={text.trim().length < 2 || sending} onPress={sendText}>
            {sending ? <ActivityIndicator color={SALON.onGold} /> : <><Send size={15} color={SALON.onGold} /><Text style={styles.primaryText}>{translateUI("İsteği gönder")}</Text></>}
          </TouchableOpacity>
          {!!result && (
            <View style={[styles.result, result.kind === "error" && { borderColor: `${c.danger}55` }]} accessibilityLiveRegion="polite">
              {result.kind === "error" ? <AlertCircle size={15} color={c.danger} /> : <Check size={15} color={c.accent} />}
              <Text style={[styles.resultText, result.kind === "error" && { color: c.danger }]}>
                {result.kind === "available" ? translateUI("{0} zaten soru havuzunda, düelloda seçebilirsin.", { 0: result.title })
                  : result.kind === "duplicate" ? translateUI("{0} için isteğin zaten alındı.", { 0: result.title })
                  : result.kind === "sent" ? translateUI("İsteğin alındı. {0} eklenince sana bildirim göndereceğiz.", { 0: result.title })
                  : translateUI(result.message || "Öneri gönderilemedi.")}
              </Text>
            </View>
          )}
        </View>

        {pending.length > 0 && (
          <>
            <Text style={styles.section}>{translateUI("BEKLEYEN İSTEKLERİN")}</Text>
            <View style={styles.chips}>
              {pending.map((r) => <View key={r.id} style={styles.chip}><Text style={styles.chipText} numberOfLines={1}>{r.title}</Text></View>)}
            </View>
          </>
        )}

        <Text style={styles.section}>{translateUI("SORU HAVUZUNDAKİ YAPIMLAR · {0}", { 0: data.bank.length })}</Text>
        <View style={styles.chips}>
          {data.bank.map((t) => <View key={t.titleId} style={[styles.chip, styles.chipBank]}><Text style={styles.chipText} numberOfLines={1}>{t.title}</Text></View>)}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c, insets) {
  const safeBottom = Math.max(36, insets.bottom + 24);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center", gap: 10 },
    content: { padding: 16, paddingBottom: safeBottom },
    intro: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: SALON.goldTint, borderWidth: 1, borderColor: SALON.goldLine, borderRadius: 14, padding: 12 },
    introText: { flex: 1, color: c.text, fontSize: 12, lineHeight: 17 },
    section: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 22, marginBottom: 9 },
    dimText: { color: c.dim, fontSize: 12, lineHeight: 17 },
    form: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 12 },
    input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, color: c.text, paddingHorizontal: 12, fontSize: 13.5 },
    primaryBtn: { minHeight: 44, marginTop: 10, borderRadius: 12, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    primaryText: { color: SALON.onGold, fontSize: 13, fontWeight: "900" },
    secondaryBtn: { minHeight: 44, borderRadius: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    secondaryText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    result: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10, borderWidth: 1, borderColor: SALON.goldLine, borderRadius: 12, padding: 10 },
    resultText: { flex: 1, color: c.text, fontSize: 12, lineHeight: 17 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { maxWidth: "100%", borderRadius: 999, borderWidth: 1, borderColor: SALON.goldLine, backgroundColor: SALON.goldTint, paddingHorizontal: 10, paddingVertical: 6 },
    chipBank: { borderColor: c.border, backgroundColor: c.surface },
    chipText: { color: c.text, fontSize: 11.5, fontWeight: "700" },
  });
}
