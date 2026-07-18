import React, { useRef, useEffect } from "react";
import { Animated, PanResponder, Dimensions, StyleSheet } from "react-native";

const { height: SCREEN_H } = Dimensions.get("window");

// Ekstra paket gerektirmeyen, düz React Native Animated + PanResponder ile yazılmış
// kaydırılabilir panel. @gorhom/bottom-sheet'in bu projede tekrarlayan ortam
// çakışmalarına (private properties, DOMException) yol açması üzerine bilinçli
// olarak buna geçildi — Discover/TasteMate'teki kaydırma kartlarıyla AYNI, kanıtlanmış
// mekanizmayı kullanıyor.
export default function DraggableSheet({ collapsedHeight, expandedHeight, peek, children, style }) {
  const travel = expandedHeight - collapsedHeight; // panel kapalıyken translateY bu kadar aşağıda
  const translateY = useRef(new Animated.Value(travel)).current;
  const startValue = useRef(travel);
  const currentValue = useRef(travel);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { currentValue.current = value; });
    return () => translateY.removeListener(id);
  }, [translateY]);

  function snapTo(toValue) {
    // useNativeDriver: false OLMAK ZORUNDA — sürükleme (onPanResponderMove) JS tarafında
    // setValue() ile çalışıyor. Aynı değeri bir yandan native driver'a bırakıp bir yandan
    // JS'ten değiştirmeye çalışmak çakışıyordu: bu yüzden dokunma (tap) çalışıyor ama
    // sürükleme hiçbir görsel etki yaratmıyordu.
    Animated.spring(translateY, { toValue, useNativeDriver: false, friction: 9, tension: 60 }).start();
  }

  function expand() { snapTo(0); }
  function collapse() { snapTo(travel); }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 2,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateY.stopAnimation();
        startValue.current = currentValue.current;
      },
      onPanResponderMove: (_, g) => {
        const next = startValue.current + g.dy;
        translateY.setValue(Math.min(travel, Math.max(0, next)));
      },
      onPanResponderRelease: (_, g) => {
        // Neredeyse hiç sürüklenmediyse (parmak sadece dokunup kalktıysa) bunu bir "tap"
        // sayıp panele göre aç/kapa yap. Yeterince sürüklendiyse yön ve hıza göre karar ver.
        if (Math.abs(g.dy) < 6 && Math.abs(g.vy) < 0.2) {
          currentValue.current > travel / 2 ? expand() : collapse();
          return;
        }
        if (g.vy > 0.4 || currentValue.current > travel / 2) collapse();
        else expand();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        style,
        StyleSheet.absoluteFillObject,
        { top: SCREEN_H - expandedHeight, height: expandedHeight, transform: [{ translateY }] },
      ]}
    >
      <Animated.View {...panResponder.panHandlers}>
        {peek}
      </Animated.View>
      {children}
    </Animated.View>
  );
}
