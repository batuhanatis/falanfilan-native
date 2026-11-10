import { t as translateUI } from "../../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Animated, Easing, AccessibilityInfo, Platform } from "react-native";
import { Search, X } from "lucide-react-native";
import { useAppTheme } from "../../context/ThemeContext";

// "Yarık": sekme satırının sağ ucundaki yuvarlak arama düğmesi.
// Dokununca düğme bir an büzülür, satır boyunca ince bir altın ışık çizgisi açılır (projektörün
// ışık yarığı gibi). Çizgi sonra dikeyde tam bir arama alanına genişler; düğme yerinde kalır ve
// altın bir ✕'e döner. Kapatınca tersi olur: alan çizgiye iner, çizgi düğmeye geri çekilir.
// (Hareket codeandchill "Scry"dan esinlendi; renkleri ve ışık çizgisi Salon'un.)
//
// Satırdaki öbür öğeler (sekmeler, filtre) `fade` değeriyle söner: kapalıyken 1, açıkken 0.
// Bileşen satırın tamamını kaplayan bir katman olarak çizilir (pointerEvents="box-none"),
// kapalıyken yalnızca düğme dokunulabilir.
export const SLIT_BUTTON = 38;
const DARK_ON_GOLD = "#1a150c";

export default function SearchSlit({ open, onOpen, onClose, value, onChangeText, placeholder, fade, onBlurEmpty, onSubmit }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const inputRef = useRef(null);
  const press = useRef(new Animated.Value(1)).current;
  const lineX = useRef(new Animated.Value(open ? 1 : 0)).current; // çizgi düğmeden sola uzanır
  const lineY = useRef(new Animated.Value(open ? 1 : 0)).current; // çizgi alana açılır
  const icon = useRef(new Animated.Value(open ? 1 : 0)).current;  // 0 büyüteç, 1 ✕
  const [mounted, setMounted] = useState(open);
  const reduce = useRef(false);
  const first = useRef(true);
  // Boş alan odağı kaybedince kendini kapatıyor, ama kısa bir gecikmeyle: odağı kaybettiren
  // şey düğmeye basmaksa (web'de dokunuştan önce blur geliyor) kapanmayı düğme yapsın, yoksa
  // alan kapanıp düğme "Ara"ya dönünce aynı dokunuş aramayı yeniden açıyordu.
  const blurTimer = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce.current = !!r; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; if (!open) return; }
    const d = (ms) => (reduce.current ? 0 : ms);
    let anim;
    let focusTimer;
    if (open) {
      setMounted(true);
      // Zaman çizelgesi (ms): 0-90 düğme büzülür · 70-300 çizgi sola uzanır, satır söner ·
      // 260+ çizgi alana açılır (yay). Animasyon işlevi beklemez: klavye 300'de açılıyor.
      anim = Animated.parallel([
        Animated.sequence([
          Animated.timing(press, { toValue: 0.84, duration: d(90), easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(press, { toValue: 1, friction: 5, tension: 170, useNativeDriver: true }),
        ]),
        Animated.timing(lineX, { toValue: 1, duration: d(230), delay: d(70), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: d(150), delay: d(40), useNativeDriver: true }),
        Animated.timing(icon, { toValue: 1, duration: d(280), delay: d(60), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(d(260)),
          Animated.spring(lineY, { toValue: 1, friction: 7, tension: 160, useNativeDriver: true }),
        ]),
      ]);
      anim.start();
      focusTimer = setTimeout(() => inputRef.current?.focus(), d(300));
    } else {
      anim = Animated.sequence([
        Animated.timing(lineY, { toValue: 0, duration: d(150), easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(lineX, { toValue: 0, duration: d(210), easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(icon, { toValue: 0, duration: d(230), easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: d(220), delay: d(70), useNativeDriver: true }),
        ]),
      ]);
      anim.start(({ finished }) => { if (finished) setMounted(false); });
    }
    return () => { clearTimeout(focusTimer); anim?.stop(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldStyle = {
    opacity: lineX.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
    transform: [
      { scaleX: lineX.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }) },
      { scaleY: lineY.interpolate({ inputRange: [0, 1], outputRange: [0.06, 1] }) },
    ],
  };
  // Çizgi evresinde altın, açılınca yüzey rengi
  const glowStyle = { opacity: lineY.interpolate({ inputRange: [0, 0.55], outputRange: [1, 0], extrapolate: "clamp" }) };
  const contentStyle = { opacity: lineY.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: "clamp" }) };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {mounted && (
        <Animated.View style={[styles.field, fieldStyle]} pointerEvents={open ? "auto" : "none"}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.glow, glowStyle]} pointerEvents="none" />
          <Animated.View style={[styles.inputWrap, contentStyle]}>
            <Search size={15} color={c.dim} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={c.dim}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={onSubmit}
              onBlur={() => {
                clearTimeout(blurTimer.current);
                blurTimer.current = setTimeout(() => {
                  if (!String(valueRef.current || "").trim()) onBlurEmpty?.();
                }, 180);
              }}
              accessibilityLabel={placeholder}
            />
          </Animated.View>
        </Animated.View>
      )}

      <Pressable
        onPressIn={() => clearTimeout(blurTimer.current)}
        onPress={() => { clearTimeout(blurTimer.current); if (open) onClose(); else onOpen(); }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={open ? translateUI("Aramayı kapat") : translateUI("Ara")}
        style={styles.btnSlot}
      >
        <Animated.View style={[styles.btn, { transform: [{ scale: press }] }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.btnGold, { opacity: icon }]} />
          <Animated.View
            style={[styles.iconLayer, {
              opacity: icon.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: "clamp" }),
              transform: [{ rotate: icon.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }],
            }]}
          >
            <Search size={17} color={c.text} />
          </Animated.View>
          <Animated.View
            style={[styles.iconLayer, {
              opacity: icon.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: "clamp" }),
              transform: [{ rotate: icon.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) }],
            }]}
          >
            <X size={17} color={DARK_ON_GOLD} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    field: {
      position: "absolute", left: 0, right: 0, bottom: 4, height: SLIT_BUTTON, borderRadius: SLIT_BUTTON / 2,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.accent, overflow: "hidden",
      transformOrigin: "right center",
    },
    glow: { backgroundColor: c.accent, borderRadius: SLIT_BUTTON / 2 },
    inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: SLIT_BUTTON + 10 },
    input: { flex: 1, color: c.text, fontSize: 13.5, paddingVertical: 0, height: SLIT_BUTTON - 2, ...Platform.select({ web: { outlineStyle: "none" }, default: {} }) },
    btnSlot: { position: "absolute", right: 0, bottom: 4, width: SLIT_BUTTON, height: SLIT_BUTTON },
    btn: {
      width: SLIT_BUTTON, height: SLIT_BUTTON, borderRadius: SLIT_BUTTON / 2, overflow: "hidden",
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center",
    },
    btnGold: { backgroundColor: c.accent },
    iconLayer: { position: "absolute", alignItems: "center", justifyContent: "center" },
  });
}
