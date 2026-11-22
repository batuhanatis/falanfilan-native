import { t as translateUI, getLocale } from "../../i18n/core";
import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Animated, Easing, AccessibilityInfo, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Armchair, ChevronRight, Ticket } from "lucide-react-native";
import { SALON } from "../salon/SalonKit";
import { FONTS } from "../../theme/fonts";
import { RequestRow } from "./TitleRequest";

// Koltuk: ortak beğeni yetmediği için düello başlatılamayınca açılan pencere. Gereken ortak
// beğeni sayısı kadar koltuk var; ikinizin de beğendiği her yapım bir koltuğa oturuyor, boş
// koltuklar kesik çizgili bekliyor. Altında arkadaşının beğenip senin beğenmediğin düello
// yapımları: izlediysen beğenirsin, koltuk dolar, düello açılır.
// Ortak beğeniniz olup da soru havuzunda olmayan yapımlar ayrıca listelenir ("Eklensin" isteği;
// havuz gelince isteyene bildirim gider). Yoksa "ortak beğeniniz yok" sanılıp yanılınabiliyordu.
// data: sunucunun NO_SHARED_TITLES yanıtı { friend, sharedCount, needed, shared, suggestions, outsideBank }.
export default function SharedShortfall({ data, c, onClose, onOpenTitle, onRequest }) {
  const insets = useSafeAreaInsets();
  const s = styles(c);
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!data) return;
    rise.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled?.().then((reduce) => {
      if (reduce) { rise.setValue(1); return; }
      Animated.timing(rise, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    }).catch(() => rise.setValue(1));
  }, [data]);
  if (!data) return null;

  const name = data.friend?.name || translateUI("Arkadaşın");
  const needed = Math.max(1, Number(data.needed) || 2);
  const shared = data.shared || [];
  const seats = Array.from({ length: needed }, (_, i) => shared[i] || null);
  const have = Number(data.sharedCount) || 0;
  const suggestions = data.suggestions || [];
  const outside = data.outsideBank || { count: 0, titles: [] };
  const outsideCount = Number(outside.count) || 0;
  const total = have + outsideCount;
  let body;
  if (outsideCount > 0) {
    body = have > 0
      ? translateUI("{0} ile {1} ortak beğeniniz var ama yalnızca {2} tanesi düello soru havuzunda. Düello için soru havuzunda en az {3} ortak yapımınız olmalı.", { 0: name, 1: total, 2: have, 3: needed })
      : translateUI("{0} ile {1} ortak beğeniniz var ama hiçbiri henüz düello soru havuzunda değil. Düello için soru havuzunda en az {2} ortak yapımınız olmalı.", { 0: name, 1: total, 2: needed });
  } else {
    body = have > 0
      ? translateUI("Düellolar yalnızca ikinizin de beğendiği yapımlarla oynanır. Başlamak için en az {0} ortak beğeniniz olmalı, şu an {1} tane var.", { 0: needed, 1: have })
      : translateUI("Düellolar yalnızca ikinizin de beğendiği yapımlarla oynanır. Başlamak için en az {0} ortak beğeniniz olmalı, şu an hiç yok.", { 0: needed });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={translateUI("Kapat")} />
        <View style={[s.sheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]} accessibilityViewIsModal>
          <View style={s.grabber} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text style={s.eyebrow}>{outsideCount > 0 ? translateUI("SORU HAVUZUNDA ORTAK YAPIM GEREKİYOR") : translateUI("ORTAK BEĞENİ GEREKİYOR")}</Text>
            <Text style={s.title} accessibilityRole="header">{translateUI("{0} ile henüz düello yapamazsınız", { 0: name })}</Text>
            <Text style={s.body}>{body}</Text>

            <View style={s.seats} accessibilityLabel={translateUI("Ortak beğeni: {0} / {1}", { 0: have, 1: needed })}>
              {seats.map((t, i) => {
                const pop = rise.interpolate({ inputRange: [0, 1], outputRange: [0.85 + i * 0.02, 1] });
                return (
                  <Animated.View key={i} style={[s.seat, t ? s.seatFull : s.seatEmpty, { opacity: rise, transform: [{ scale: pop }] }]}>
                    {t ? <Ticket size={16} color={c.accent} /> : <Armchair size={16} color={c.dim} />}
                    <Text style={[s.seatText, !t && { color: c.dim }]} numberOfLines={2}>{t ? t.title : translateUI("Boş koltuk")}</Text>
                  </Animated.View>
                );
              })}
            </View>
            <Text style={s.count}>{outsideCount > 0 ? translateUI("SORU HAVUZUNDA {0} / {1}", { 0: have, 1: needed }) : translateUI("{0} / {1} ORTAK BEĞENİ", { 0: have, 1: needed })}</Text>

            {outsideCount > 0 && (
              <>
                <Text style={s.section}>{translateUI("SORU HAVUZUNDA OLMAYAN ORTAK BEĞENİLERİNİZ")}</Text>
                <Text style={s.hint}>{translateUI("Eklenmesini istediklerine dokun. Soru havuzu hazır olunca sana bildirim göndereceğiz.")}</Text>
                {(outside.titles || []).map((t) => (
                  <RequestRow key={t.movieId} item={t} c={c} onRequest={() => onRequest?.(t.movieId)} onOpen={() => onOpenTitle?.(t)} />
                ))}
                {outsideCount > (outside.titles || []).length && (
                  <Text style={s.more}>{translateUI("+{0} ortak beğeni daha", { 0: outsideCount - (outside.titles || []).length })}</Text>
                )}
              </>
            )}

            {suggestions.length > 0 ? (
              <>
                <Text style={s.section}>{translateUI("{0} BUNLARI BEĞENMİŞ", { 0: String(name).toLocaleUpperCase(getLocale()) })}</Text>
                <Text style={s.hint}>{translateUI("İzlediysen sen de beğen; ortak beğeni olur, düello açılır.")}</Text>
                {suggestions.map((t) => (
                  <TouchableOpacity
                    key={t.titleId}
                    style={s.row}
                    disabled={!t.movieId}
                    onPress={() => onOpenTitle?.(t)}
                    activeOpacity={0.85}
                    accessibilityLabel={translateUI("{0} sayfasını aç", { 0: t.title })}
                  >
                    {t.poster ? <Image source={{ uri: t.poster }} style={s.poster} /> : <View style={[s.poster, s.posterEmpty]}><Ticket size={14} color={c.dim} /></View>}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowKind}>{translateUI(t.type === "Film" ? "FİLM" : "DİZİ")}</Text>
                      <Text style={s.rowTitle} numberOfLines={1}>{t.title}</Text>
                    </View>
                    {!!t.movieId && <ChevronRight size={16} color={c.dim} />}
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <Text style={s.hint}>{translateUI("İzlediğin film ve dizileri beğendikçe ortak beğenileriniz artar. Arkadaşın da sevdiklerini beğenince düello açılır.")}</Text>
            )}
          </ScrollView>
          <TouchableOpacity style={s.button} onPress={onClose} accessibilityRole="button">
            <Text style={s.buttonText}>{translateUI("Anladım")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cache = new Map();
function styles(c) {
  const key = `${c.bg}|${c.surface}|${c.text}`;
  if (cache.has(key)) return cache.get(key);
  const s = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: { maxHeight: "88%", backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: SALON.goldLine, paddingHorizontal: 18, paddingTop: 10 },
    grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 14 },
    eyebrow: { color: c.accent, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3 },
    title: { color: c.text, fontFamily: FONTS.marquee, fontSize: 26, lineHeight: 29, marginTop: 4 },
    body: { color: c.dim, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
    seats: { flexDirection: "row", gap: 8, marginTop: 16 },
    seat: { flex: 1, minHeight: 64, borderRadius: 14, padding: 10, gap: 6, justifyContent: "center" },
    seatFull: { backgroundColor: SALON.goldTint, borderWidth: 1, borderColor: SALON.goldLine },
    seatEmpty: { backgroundColor: c.bg, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.border },
    seatText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    count: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1.1, textAlign: "center", marginTop: 8 },
    section: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 20 },
    hint: { color: c.dim, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 10 },
    more: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 0.8, textAlign: "center", marginTop: 2 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 9, marginBottom: 8 },
    poster: { width: 36, height: 54, borderRadius: 7, backgroundColor: c.surface2 },
    posterEmpty: { alignItems: "center", justifyContent: "center" },
    rowKind: { color: c.dim, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1, marginBottom: 3 },
    rowTitle: { color: c.text, fontSize: 13.5, fontWeight: "800" },
    button: { minHeight: 48, marginTop: 10, borderRadius: 14, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    buttonText: { color: SALON.onGold, fontSize: 13, fontWeight: "900" },
  });
  cache.set(key, s);
  return s;
}
