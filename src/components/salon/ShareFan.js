import { t as translateUI } from "../../i18n/core";
import React, { useRef, useState } from "react";
import {
  Modal, View, Text, Pressable, Animated, Easing, StyleSheet, AccessibilityInfo, Linking, Share, useWindowDimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { X, MessageCircle, Link2, Share2, Send, Image as ImageIcon, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/ThemeContext";
import { hapticSelection, hapticLight } from "../../utils/haptics";
import { emitLocalEvent } from "../../utils/localEvents";

// Yelpaze: paylaş düğmesine basınca seçenekler, elindeki kartları yelpaze gibi açar gibi
// düğmenin etrafına açılıyor. Düğmenin görünüşünü ekran kendisi veriyor (children + style);
// yelpaze ekranın üstünde, düğmenin konumundan açılan saydam bir pencerede çiziliyor. Düğme
// ekranın üst yarısındaysa seçenekler aşağı, alt yarısındaysa yukarı; kenara yakınsa içeri açılır.

const OPTION = 56;
const CELL_WIDTH = 104;
const CELL_HEIGHT = 112;

export default function ShareFan({ options, style, children, accessibilityLabel = "Paylaş", disabled, hitSlop }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const triggerRef = useRef(null);
  const [anchor, setAnchor] = useState(null);
  const [picked, setPicked] = useState(null);
  const progress = useRef([]).current;
  const busy = useRef(false);

  const list = (options || []).filter(Boolean).slice(0, 5);

  function targets(a) {
    // Her ikon ve etikete ayrı hücre ayır. Tek tek kenara sıkıştırılan yay
    // noktaları özellikle sağ üstte üst üste geliyordu.
    const columns = Math.min(3, list.length, Math.max(1, Math.floor((W - 32) / CELL_WIDTH)));
    const rows = Math.ceil(list.length / columns);
    const cellWidth = Math.min(CELL_WIDTH, (W - 32) / columns);
    const panelWidth = columns * cellWidth;
    const panelHeight = rows * CELL_HEIGHT;
    const left = Math.max(16, Math.min(W - 16 - panelWidth, a.cx - panelWidth / 2));
    const minTop = insets.top + 12;
    const maxBottom = H - insets.bottom - 12;
    const below = a.cy + 48;
    const above = a.cy - 48 - panelHeight;
    const preferred = below + panelHeight <= maxBottom ? below : above;
    const top = Math.max(minTop, Math.min(maxBottom - panelHeight, preferred));
    return list.map((_, i) => ({
      x: left + (i % columns + 0.5) * cellWidth,
      y: top + Math.floor(i / columns) * CELL_HEIGHT + OPTION / 2,
    }));
  }

  function open() {
    if (disabled || busy.current || !list.length) return;
    if (list.length === 1) { hapticSelection(); list[0].onPress?.(); return; }
    busy.current = true;
    hapticSelection();
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      const a = { cx: x + w / 2, cy: y + h / 2 };
      list.forEach((_, i) => {
        if (!progress[i]) progress[i] = new Animated.Value(0);
        progress[i].setValue(0);
      });
      setPicked(null);
      setAnchor(a);
      AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
        if (reduce) { list.forEach((_, i) => progress[i].setValue(1)); busy.current = false; return; }
        Animated.stagger(40, list.map((_, i) => Animated.spring(progress[i], { toValue: 1, friction: 6, tension: 120, useNativeDriver: true })))
          .start(() => { busy.current = false; });
      }).catch(() => { list.forEach((_, i) => progress[i].setValue(1)); busy.current = false; });
    });
  }

  function close(after) {
    Animated.parallel(list.map((_, i) => Animated.timing(progress[i], { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true })))
      .start(() => {
        setAnchor(null);
        setPicked(null);
        if (after) setTimeout(after, 60);
      });
  }

  function choose(i) {
    if (picked != null) return;
    hapticLight();
    setPicked(i);
    // Seçilen seçenek yerinde kalıp hafifçe büyüyor, diğerleri merkeze katlanıyor.
    Animated.parallel(list.map((_, k) => (k === i
      ? Animated.sequence([Animated.delay(140), Animated.timing(progress[k], { toValue: 0, duration: 150, useNativeDriver: true })])
      : Animated.timing(progress[k], { toValue: 0, duration: 150, easing: Easing.in(Easing.cubic), useNativeDriver: true }))))
      .start(() => {
        setAnchor(null);
        setPicked(null);
        setTimeout(() => list[i].onPress?.(), 60);
      });
  }

  const pos = anchor ? targets(anchor) : [];

  return (
    <>
      <Pressable
        ref={triggerRef}
        style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}
        onPress={open}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: !!anchor, disabled: !!disabled }}
      >
        {children}
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="fade" statusBarTranslucent onRequestClose={() => close()}>
        <Pressable style={styles.backdrop} onPress={() => close()} accessibilityLabel={translateUI("Paylaşımı kapat")} />
        {!!anchor && (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
            {list.map((opt, i) => {
              const p = progress[i] || new Animated.Value(1);
              const dx = pos[i].x - anchor.cx;
              const dy = pos[i].y - anchor.cy;
              const scale = p.interpolate({ inputRange: [0, 1], outputRange: [0.3, picked === i ? 1.12 : 1] });
              return (
                <Animated.View
                  key={opt.key || opt.label}
                  style={[styles.optWrap, {
                    left: anchor.cx - 44, top: anchor.cy - OPTION / 2,
                    opacity: p,
                    transform: [
                      { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                      { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                      { scale },
                    ],
                  }]}
                >
                  <Pressable
                    style={[styles.opt, { backgroundColor: picked === i ? c.accent : c.surface, borderColor: c.border }]}
                    onPress={() => choose(i)}
                    accessibilityRole="button"
                    accessibilityLabel={opt.a11y || translateUI(opt.label)}
                  >
                    {opt.Icon && <opt.Icon size={22} color={picked === i ? "#1a140b" : c.text} />}
                  </Pressable>
                  <Text style={styles.optLabel} numberOfLines={2} maxFontSizeMultiplier={1.3}>{translateUI(opt.label)}</Text>
                </Animated.View>
              );
            })}
            <Pressable
              style={[styles.hub, { left: anchor.cx - 24, top: anchor.cy - 24, backgroundColor: c.accent }]}
              onPress={() => close()}
              accessibilityRole="button"
              accessibilityLabel={translateUI("Kapat")}
            >
              <X size={20} color="#1a140b" />
            </Pressable>
          </View>
        )}
      </Modal>
    </>
  );
}

// Bir paylaşımın ortak seçenekleri. Ekran kendi özel seçeneklerini (görsel kart, arkadaşına
// gönder, akışta paylaş) başa ekliyor; WhatsApp, kopyala ve diğer uygulamalar buradan.
// Link dokunuşta oluşuyorsa (ör. Party linki) message/url yerine prepare verilir:
// async () => ({ message, url }); null dönerse paylaşım yapılmaz.
export function shareOptions({ message, url, prepare, copyText, card, sendToFriend, feed, copy = true }) {
  async function payload() {
    const p = prepare ? await prepare() : { message, url };
    if (!p) return null;
    const text = p.url && !String(p.message || "").includes(p.url) ? `${p.message}\n${p.url}` : p.message;
    return { text, copyText: copyText || p.url };
  }
  const run = (fn) => () => { payload().then((p) => p && fn(p)).catch(() => {}); };
  return [
    card && { key: "card", label: translateUI("Görsel kart"), Icon: ImageIcon, onPress: card },
    sendToFriend && { key: "friend", label: translateUI("Arkadaşına"), a11y: "Arkadaşına gönder", Icon: Send, onPress: sendToFriend },
    feed && { key: "feed", label: translateUI("Akışta"), a11y: "Sosyal akışta paylaş", Icon: Users, onPress: feed },
    {
      key: "whatsapp",
      label: translateUI("WhatsApp"),
      a11y: "WhatsApp'ta paylaş",
      Icon: MessageCircle,
      onPress: run(({ text }) => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`)
        .catch(() => Share.share({ message: text }).catch(() => {}))),
    },
    copy && (url || copyText || prepare) && {
      key: "copy",
      label: translateUI("Kopyala"),
      a11y: copyText ? "Metni kopyala" : "Bağlantıyı kopyala",
      Icon: Link2,
      onPress: run(({ copyText: value }) => {
        if (!value) return;
        Clipboard.setStringAsync(value)
          .then(() => emitLocalEvent({ type: "toast", title: copyText ? "Kopyalandı" : "Bağlantı kopyalandı", message: copyText ? "" : value }))
          .catch(() => {});
      }),
    },
    { key: "other", label: translateUI("Diğer"), a11y: "Diğer uygulamalarla paylaş", Icon: Share2, onPress: run(({ text }) => Share.share({ message: text }).catch(() => {})) },
  ].filter(Boolean);
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,6,10,0.55)" },
  optWrap: { position: "absolute", width: 88, alignItems: "center" },
  opt: {
    width: OPTION, height: OPTION, borderRadius: OPTION / 2, borderWidth: 1, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  optLabel: { width: 88, minHeight: 36, textAlign: "center", lineHeight: 18, marginTop: 6, color: "#f2ede2", fontSize: 12, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  hub: { position: "absolute", width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
