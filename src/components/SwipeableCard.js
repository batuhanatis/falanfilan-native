import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { Animated, PanResponder, Dimensions } from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = 110;

// ÖNEMLİ MİMARİ NOT: Bu bileşen HER KART İÇİN "key" ile yeniden oluşturulmalı
// (örn. <SwipeableCard key={item.id} .../>). Bu sayede her kartın "pan" (konum)
// değeri kendine ait, TAMAMEN YENİ bir Animated.Value olarak sıfırdan başlar —
// önceki kartların konumunu "sıfırlamaya" hiç gerek kalmaz. Paylaşılan/tekrar
// kullanılan tek bir pan değeriyle çalışmak, kartlar arası geçişte eski kartın
// bir anlığına geri görünmesi gibi pürüzlere sebep oluyordu — bu tasarım o
// sınıf hatayı kökten ortadan kaldırıyor.
const SwipeableCard = forwardRef(function SwipeableCard({ onSwipeLeft, onSwipeRight, style, children }, ref) {
  const pan = useRef(new Animated.ValueXY()).current;

  function animateOff(direction) {
    Animated.timing(pan, {
      toValue: { x: direction === "right" ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (direction === "right") onSwipeRight();
      else onSwipeLeft();
    });
  }

  useImperativeHandle(ref, () => ({
    swipeRight: () => animateOff("right"),
    swipeLeft: () => animateOff("left"),
  }));

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) animateOff("right");
      else if (g.dx < -SWIPE_THRESHOLD) animateOff("left");
      else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
    },
  });

  const rotate = pan.x.interpolate({ inputRange: [-SCREEN_W, 0, SCREEN_W], outputRange: ["-15deg", "0deg", "15deg"] });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[style, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }]}
    >
      {typeof children === "function" ? children(pan) : children}
    </Animated.View>
  );
});

export default SwipeableCard;
