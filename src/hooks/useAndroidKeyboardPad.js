import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";

// Android'de (Expo SDK 54, edge-to-edge) pencere klavye açılınca artık küçülmüyor; içerik klavyenin
// arkasında kalıyor. Bu kanca, kapsayıcının alt kenarı ile klavyenin üst kenarı arasındaki çakışmayı
// ölçüp o kadar alt boşluk döndürür. Pencere yine de küçülürse (eski davranış) çakışma 0 çıkar,
// çift boşluk oluşmaz. iOS'ta hiçbir şey yapmaz (orada KeyboardAvoidingView "padding" kullanılıyor).
//
// Kullanım: const kb = useAndroidKeyboardPad();
//   <View ref={kb.ref} onLayout={kb.onLayout} style={{ flex: 1, paddingBottom: kb.pad }}>…</View>
// kb.visible: klavye açık mı (Android).
const MIN_OVERLAP = 40; // durum çubuğu ölçüm farkı gibi küçük sapmaları yok say

export default function useAndroidKeyboardPad() {
  const ref = useRef(null);
  const keyboardTop = useRef(null);
  const [pad, setPad] = useState(0);
  const [visible, setVisible] = useState(false);

  const measure = useCallback(() => {
    if (Platform.OS !== "android") return;
    const top = keyboardTop.current;
    if (top == null || !ref.current?.measureInWindow) { setPad(0); return; }
    ref.current.measureInWindow((x, y, w, h) => {
      if (keyboardTop.current == null) return;
      const overlap = Math.round(y + h - top);
      const next = overlap >= MIN_OVERLAP ? overlap : 0;
      setPad((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTop.current = e?.endCoordinates?.screenY ?? null;
      setVisible(true);
      measure();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = null;
      setVisible(false);
      setPad(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [measure]);

  return { ref, onLayout: measure, pad: Platform.OS === "android" ? pad : 0, visible: Platform.OS === "android" && visible };
}
