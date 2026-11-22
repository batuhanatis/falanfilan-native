import { t as translateUI } from "../../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Easing, View, Image } from "react-native";
import { Plus, Check, Ticket } from "lucide-react-native";
import { SALON } from "../salon/SalonKit";
import { FONTS } from "../../theme/fonts";
import { hapticSuccess, hapticWarning } from "../../utils/haptics";

// İstek damgası: "Eklensin" düğmesi gönderilince yerinde "İstendi" damgasına dönüşür (küçük bir
// basma hareketiyle oturur). Durum düğmenin kendisinde; ayrı bir bildirim gerekmiyor.
export function RequestButton({ requested, onRequest, c, label }) {
  const [state, setState] = useState(requested ? "done" : "idle");
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (requested) setState("done"); }, [requested]);
  async function go() {
    if (state !== "idle") return;
    setState("busy");
    try {
      await onRequest();
      hapticSuccess();
      setState("done");
      press.setValue(1.25);
      Animated.timing(press, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    } catch {
      hapticWarning();
      setState("idle");
    }
  }
  const done = state === "done";
  return (
    <TouchableOpacity
      onPress={go}
      disabled={state !== "idle"}
      style={[s.btn, done ? { borderColor: SALON.goldLine, backgroundColor: SALON.goldTint } : { borderColor: c.accent, backgroundColor: c.accent }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: state !== "idle", selected: done }}
      accessibilityLabel={done ? translateUI("İstendi") : label || translateUI("Eklensin")}
      hitSlop={6}
    >
      {state === "busy" ? <ActivityIndicator size="small" color={SALON.onGold} /> : (
        <Animated.View style={[s.inner, { transform: [{ scale: press }] }]}>
          {done ? <Check size={13} color={c.accent} /> : <Plus size={13} color={SALON.onGold} />}
          <Text style={[s.text, { color: done ? c.accent : SALON.onGold }]}>{done ? translateUI("İstendi") : translateUI("Eklensin")}</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

// Afişli yapım satırı + istek düğmesi (uyarı penceresi ve Yapım öner ekranı ortak).
export function RequestRow({ item, c, onRequest, onOpen, meta }) {
  return (
    <View style={[s.row, { backgroundColor: c.bg, borderColor: c.border }]}>
      <TouchableOpacity style={s.rowMain} onPress={onOpen} disabled={!onOpen} activeOpacity={0.85} accessibilityLabel={translateUI("{0} sayfasını aç", { 0: item.title })}>
        {item.poster ? <Image source={{ uri: item.poster }} style={[s.poster, { backgroundColor: c.surface2 }]} /> : <View style={[s.poster, s.posterEmpty, { backgroundColor: c.surface2 }]}><Ticket size={14} color={c.dim} /></View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.kind, { color: c.dim }]}>{translateUI(item.type === "Film" ? "FİLM" : "DİZİ")}{item.year ? ` · ${item.year}` : ""}</Text>
          <Text style={[s.title, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
          {!!meta && <Text style={[s.meta, { color: c.dim }]} numberOfLines={1}>{meta}</Text>}
        </View>
      </TouchableOpacity>
      <RequestButton requested={item.requested} onRequest={onRequest} c={c} label={translateUI("{0} eklensin", { 0: item.title })} />
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minWidth: 92, height: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  inner: { flexDirection: "row", alignItems: "center", gap: 5 },
  text: { fontSize: 11.5, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 9, paddingRight: 10, marginBottom: 8 },
  rowMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  poster: { width: 36, height: 54, borderRadius: 7 },
  posterEmpty: { alignItems: "center", justifyContent: "center" },
  kind: { fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1, marginBottom: 3 },
  title: { fontSize: 13.5, fontWeight: "800" },
  meta: { fontSize: 10.5, marginTop: 2 },
});
