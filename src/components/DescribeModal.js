import { t as translateUI } from "../i18n/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { FONTS } from "../theme/fonts";
import { hapticMedium, hapticSelection, hapticSuccess, hapticWarning } from "../utils/haptics";
import DismissableSheet from "./DismissableSheet";
import ListPickerModal from "./ListPickerModal";
import MakinistBooth from "./describe/MakinistBooth";
import PerdeResults from "./describe/PerdeResults";
import {
  OBJ, MOODS, WITHS, TRY_INSTEAD, Perforation, StampMark, TicketStubs,
  composeQuery, stampLabels, normalizeAllowance, ticketsLeft,
} from "./describe/describeKit";

// "Anlat, Bulalım" — Makinist. Aşamalar: fiş (yaz + damgala) → makinist dairesi (istek gitti,
// ışık perdeye vuruyor) → perde (sonuçlar). Sonuç çıkmazsa fiş "EŞLEŞME YOK" damgasıyla geri
// döner (sunucu hakkı iade eder); günlük hak bittiyse dairenin kepengi iner.
// İstek hemen gider; animasyon işlevi bekletmez. AIZone ve eski HomeScreen aynı prop'larla açar.
export default function DescribeModal({ onClose, onResults, onClear, hasResults, navigation }) {
  const { c, mode } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, mode), [c, mode]);

  const [phase, setPhase] = useState("slip"); // slip | booth | screen | empty | closed
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [withKey, setWithKey] = useState(null);
  const [error, setError] = useState("");
  const [allowance, setAllowance] = useState(null);
  const [stage, setStage] = useState(2);
  const [results, setResults] = useState([]);
  const [matchedPerson, setMatchedPerson] = useState(null);
  const [refunded, setRefunded] = useState(false);
  const [sentText, setSentText] = useState("");
  const [sentStamps, setSentStamps] = useState([]);
  const [pickerMovie, setPickerMovie] = useState(null);
  const reqId = useRef(0);
  const ticketNo = useMemo(() => String(1000 + Math.floor(Math.random() * 9000)), []);
  const clock = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    let alive = true;
    api.premiumStatus(auth.token)
      .then((s) => {
        if (!alive || !s) return;
        const a = normalizeAllowance(s.isPremium ? { unlimited: true } : s.ai, s.bonusAiUses);
        setAllowance(a);
        if (a && !a.unlimited && ticketsLeft(a) === 0) setPhase((p) => (p === "slip" ? "closed" : p));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [auth.token]);

  const stamps = stampLabels(mood, withKey);
  const query = composeQuery(text, mood, withKey);
  const canSend = query.length > 0;

  async function run() {
    if (!canSend || phase === "booth") return;
    Keyboard.dismiss();
    const my = ++reqId.current;
    setError("");
    setStage(2);
    setSentText(text.trim() || stamps.map((s) => translateUI(s)).join(" · "));
    setSentStamps(stamps);
    setPhase("booth");
    hapticMedium();
    try {
      const data = await api.describe(auth.token, query);
      if (my !== reqId.current) return;
      if (data?.usage) setAllowance(normalizeAllowance(data.usage));
      const list = data?.results || [];
      setStage(3);
      // "Perdeye diziliyor" adımı bir an görünsün; istek zaten döndü.
      setTimeout(() => {
        if (my !== reqId.current) return;
        if (list.length === 0) {
          setRefunded(!!data?.refunded);
          setPhase("empty");
          hapticWarning();
        } else {
          setResults(list);
          setMatchedPerson(data?.matchedPerson || null);
          setPhase("screen");
          hapticSuccess();
        }
      }, 260);
    } catch (e) {
      if (my !== reqId.current) return;
      if (e.limitReached) {
        setAllowance({ unlimited: false, remaining: 0, bonus: 0 });
        setPhase("closed");
        return;
      }
      setError(e.message || "Öneri alınamadı, tekrar dener misin?");
      setPhase("slip");
    }
  }

  function cancel() {
    reqId.current += 1;
    setPhase("slip");
  }

  function toSlip(nextText) {
    if (typeof nextText === "string") {
      setText(nextText);
      setMood(null);
      setWithKey(null);
    }
    setError("");
    setPhase("slip");
  }

  function showOnHome() {
    onResults(results, translateUI("“{0}” için önerilerin", { 0: sentText }));
    onClose();
  }

  function openDetail(movie) {
    onClose();
    navigation.navigate("Detail", { movie });
  }

  function goPremium() {
    onClose();
    navigation.navigate("Premium", { reason: "ai_limit" });
  }

  function goDiscover() {
    onClose();
    navigation.navigate("Discover");
  }

  function clearAndClose() {
    onClear();
    onClose();
  }

  const requestClose = phase === "booth" ? cancel : onClose;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={requestClose}>
      <TouchableWithoutFeedback onPress={requestClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={requestClose} style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} handleOnly>
              <View style={styles.header}>
                <Text style={styles.title} accessibilityRole="header">{translateUI("Anlat, Bulalım")}</Text>
                <Pressable onPress={requestClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={translateUI("Kapat")} hitSlop={6}>
                  <X size={20} color={c.dim} />
                </Pressable>
              </View>

              {phase === "slip" && (
                <View style={{ flex: 1 }}>
                  <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={styles.sub}>{translateUI("Ne izlemek istediğini kendi cümlenle yaz, istersen damgala. Makinist kataloğu senin için tarasın.")}</Text>

                    <View style={{ marginTop: 18 }}>
                      <Perforation color={c.surface} />
                      <View style={styles.paper}>
                        <View style={styles.paperHead}>
                          <Text style={styles.paperLabel}>{translateUI("İSTEK FİŞİ")}</Text>
                          <Text style={styles.paperLabel}>{`NO ${ticketNo} · ${clock}`}</Text>
                        </View>
                        <View style={styles.paperRule} />
                        <TextInput
                          style={styles.paperInput}
                          value={text}
                          onChangeText={setText}
                          placeholder={translateUI("Yağmurlu bir pazar akşamı; sıcak, içimi ısıtacak bir şey…")}
                          placeholderTextColor="rgba(42,33,24,0.5)"
                          multiline
                          maxLength={300}
                          accessibilityLabel={translateUI("İsteğin")}
                          textAlignVertical="top"
                        />
                        <View style={styles.marks}>
                          {stamps.length ? stamps.map((s, i) => <StampMark key={s} label={s} rotate={i % 2 ? "4deg" : "-6deg"} />)
                            : <Text style={styles.noMark}>{translateUI("Damga yok")}</Text>}
                        </View>
                      </View>
                    </View>

                    <Text style={styles.hint}>{translateUI("Tür, ruh hâli, süre, kiminle izleyeceğin: ne kadar ayrıntı, o kadar isabet.")}</Text>

                    <Text style={styles.groupLabel}>{translateUI("RUH HÂLİ")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stampRow} keyboardShouldPersistTaps="handled">
                      {MOODS.map((m) => {
                        const on = mood === m.key;
                        return (
                          <Pressable key={m.key} onPress={() => { hapticSelection(); setMood(on ? null : m.key); }} style={[styles.stamp, on && styles.stampOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                            <Text style={[styles.stampText, on && styles.stampTextOn]}>{translateUI(m.label)}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <Text style={styles.groupLabel}>{translateUI("KİMİNLE")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stampRow} keyboardShouldPersistTaps="handled">
                      {WITHS.map((m) => {
                        const on = withKey === m.key;
                        return (
                          <Pressable key={m.key} onPress={() => { hapticSelection(); setWithKey(on ? null : m.key); }} style={[styles.stamp, on && styles.stampOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                            <Text style={[styles.stampText, on && styles.stampTextOn]}>{translateUI(m.label)}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{translateUI(error)}</Text>}
                  </ScrollView>

                  <View style={styles.footer}>
                    <TicketStubs allowance={allowance} c={c} />
                    <Pressable onPress={run} disabled={!canSend} style={[styles.cta, !canSend && styles.ctaOff]} accessibilityRole="button" accessibilityState={{ disabled: !canSend }}>
                      <Text style={styles.ctaText}>{translateUI("Bulalım")}</Text>
                    </Pressable>
                    {hasResults && (
                      <Pressable onPress={clearAndClose} style={styles.linkBtn} accessibilityRole="button">
                        <Text style={styles.linkText}>{translateUI("Aramayı temizle")}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {phase === "booth" && (
                <View style={{ flex: 1 }}>
                  <View style={{ marginTop: 14 }}>
                    <MakinistBooth stage={stage} ticketNo={ticketNo} stampText={sentStamps.map((s) => translateUI(s)).join(" · ")} c={c} />
                  </View>
                  <Text style={styles.quote} numberOfLines={3}>“{sentText}”</Text>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={cancel} style={styles.ghost} accessibilityRole="button">
                    <Text style={styles.ghostText}>{translateUI("Vazgeç")}</Text>
                  </Pressable>
                </View>
              )}

              {phase === "screen" && (
                <PerdeResults
                  results={results}
                  slipText={sentText}
                  stamps={sentStamps}
                  matchedPerson={matchedPerson}
                  allowance={allowance}
                  c={c}
                  onEdit={() => toSlip()}
                  onNew={() => toSlip("")}
                  onShowHome={showOnHome}
                  onOpen={openDetail}
                  onAddToList={setPickerMovie}
                />
              )}

              {phase === "empty" && (
                <View style={{ flex: 1 }}>
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={{ marginTop: 16 }}>
                      <Perforation color={c.surface} />
                      <View style={[styles.paper, { paddingBottom: 22 }]}>
                        <View style={styles.paperHead}>
                          <Text style={styles.paperLabel}>{translateUI("İSTEK FİŞİ")}</Text>
                          <Text style={styles.paperLabel}>{translateUI("NO {0} · GERİ DÖNDÜ", { 0: ticketNo })}</Text>
                        </View>
                        <View style={styles.paperRule} />
                        <Text style={styles.paperStatic}>{sentText}</Text>
                        <StampMark label="EŞLEŞME YOK" size={24} rotate="-9deg" style={styles.bigMark} />
                      </View>
                    </View>
                    <Text style={styles.h2}>{translateUI("Bu fişe uyan bir şey çıkmadı")}</Text>
                    <Text style={styles.body}>
                      {translateUI("Biraz gevşet: tür, ruh hâli ya da benzediği bir film yeterli.")}
                      {refunded ? ` ${translateUI("Bu fiş hakkından düşülmedi.")}` : ""}
                    </Text>
                    <Text style={styles.groupLabel}>{translateUI("ŞUNU DENE")}</Text>
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {TRY_INSTEAD.map((s) => (
                        <Pressable key={s} onPress={() => toSlip(translateUI(s))} style={styles.tryRow} accessibilityRole="button">
                          <Text style={styles.tryText}>{translateUI(s)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={styles.footer}>
                    <Pressable onPress={() => toSlip()} style={styles.cta} accessibilityRole="button">
                      <Text style={styles.ctaText}>{translateUI("Fişi düzelt")}</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {phase === "closed" && (
                <View style={{ flex: 1 }}>
                  <View style={styles.shutterBooth} accessible accessibilityLabel={translateUI("Makinist dairesi kapalı, yarın yeniden açılıyor")}>
                    <Text style={styles.shutterLabel}>{translateUI("MAKİNİST DAİRESİ")}</Text>
                    <View style={styles.shutter}>
                      {Array.from({ length: 8 }, (_, i) => <View key={i} style={styles.slat} />)}
                    </View>
                    <View style={styles.closedPlate}><Text style={styles.closedPlateText}>{translateUI("KAPALI")}</Text></View>
                    <Text style={styles.shutterFoot}>{translateUI("YARIN YENİDEN AÇILIYOR")}</Text>
                  </View>
                  <View style={{ marginTop: 16 }}>
                    <TicketStubs allowance={allowance || { unlimited: false, remaining: 0, bonus: 0 }} c={c} />
                  </View>
                  <Text style={styles.h2}>{translateUI("Bugünlük fişlerin bitti")}</Text>
                  <Text style={styles.body}>{translateUI("Yarın yeni fiş hakkın olacak. Premium’da fiş sınırı yok; Bu Akşamı Planla ve sınırsız TasteMate de açılıyor.")}</Text>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={goPremium} style={styles.cta} accessibilityRole="button">
                    <Text style={styles.ctaText}>{translateUI("Premium’a geç")}</Text>
                  </Pressable>
                  <Pressable onPress={goDiscover} style={[styles.ghost, { marginTop: 10 }]} accessibilityRole="button">
                    <Text style={styles.ghostText}>{translateUI("Bu arada Keşfet’te kaydır")}</Text>
                  </Pressable>
                </View>
              )}
            </DismissableSheet>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
      {pickerMovie && <ListPickerModal movie={pickerMovie} onClose={() => setPickerMovie(null)} />}
    </Modal>
  );
}

function makeStyles(c, mode) {
  // Açık temada pirinç altın küçük yazıda okunmuyor (2.9:1): damga yazısı metin renginde.
  const stampInk = mode === "light" ? c.text : c.accent;
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, height: "92%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
    title: { fontFamily: FONTS.marquee, fontSize: 30, lineHeight: 34, color: c.text },
    closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: -10 },
    sub: { marginTop: 2, fontSize: 13.5, lineHeight: 19, color: c.dim },
    paper: { backgroundColor: OBJ.paper, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 10, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
    paperHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    paperLabel: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.4, color: OBJ.paperDim },
    paperRule: { height: 1, borderTopWidth: 1, borderColor: OBJ.paperLine, borderStyle: "dashed" },
    paperInput: { minHeight: 110, maxHeight: 160, padding: 0, fontFamily: FONTS.mono, fontSize: 15, lineHeight: 22, color: OBJ.paperInk },
    paperStatic: { fontFamily: FONTS.mono, fontSize: 15, lineHeight: 22, color: OBJ.paperInk, paddingBottom: 26 },
    marks: { flexDirection: "row", flexWrap: "wrap", gap: 8, minHeight: 30, alignItems: "center" },
    noMark: { fontFamily: FONTS.mono, fontSize: 11, color: "rgba(42,33,24,0.5)" },
    bigMark: { position: "absolute", right: 16, bottom: 14, borderWidth: 3, paddingHorizontal: 12 },
    hint: { marginTop: 12, fontSize: 12.5, lineHeight: 17, color: c.dim },
    groupLabel: { marginTop: 16, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1, color: c.dim },
    stampRow: { gap: 8, paddingTop: 8, paddingRight: 8 },
    stamp: { minHeight: 44, paddingHorizontal: 14, borderRadius: 6, borderWidth: 2, borderColor: c.accent, justifyContent: "center" },
    stampOn: { backgroundColor: c.accent },
    stampText: { fontFamily: FONTS.marquee, fontSize: 17, letterSpacing: 1, color: stampInk },
    stampTextOn: { color: OBJ.onAccent },
    error: { marginTop: 12, fontSize: 12.5, color: c.danger },
    footer: { paddingTop: 12, gap: 12 },
    cta: { height: 54, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", shadowColor: OBJ.brass, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
    ctaOff: { opacity: 0.45 },
    ctaText: { fontFamily: FONTS.marquee, fontSize: 24, letterSpacing: 0.5, color: OBJ.onAccent },
    linkBtn: { alignSelf: "center", minHeight: 32, justifyContent: "center" },
    linkText: { fontSize: 12, color: c.dim, textDecorationLine: "underline" },
    quote: { marginTop: 14, fontFamily: FONTS.mono, fontSize: 12.5, lineHeight: 18, color: c.dim },
    ghost: { minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    ghostText: { fontSize: 14, fontWeight: "700", color: c.text },
    h2: { marginTop: 22, fontFamily: FONTS.marquee, fontSize: 26, lineHeight: 28, color: c.text },
    body: { marginTop: 6, fontSize: 14, lineHeight: 20, color: c.text, opacity: 0.88 },
    tryRow: { minHeight: 44, borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.border, paddingHorizontal: 14, justifyContent: "center" },
    tryText: { fontSize: 13.5, color: c.text },
    shutterBooth: { marginTop: 16, height: 250, borderRadius: 18, backgroundColor: OBJ.board, borderWidth: 1, borderColor: OBJ.boardBorder, alignItems: "center", justifyContent: "center", gap: 14 },
    shutterLabel: { position: "absolute", left: 16, top: 14, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.4, color: OBJ.boardDim },
    shutter: { width: 160, height: 96, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: OBJ.boardBorder },
    slat: { flex: 1, backgroundColor: OBJ.flapTop, borderBottomWidth: 1, borderBottomColor: OBJ.seam },
    closedPlate: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 3, backgroundColor: OBJ.brass },
    closedPlateText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 2, color: OBJ.onAccent },
    shutterFoot: { position: "absolute", bottom: 16, fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1, color: OBJ.boardDim },
  });
}
