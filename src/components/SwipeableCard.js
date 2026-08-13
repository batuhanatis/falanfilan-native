import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { Animated, PanResponder, Dimensions, Easing } from "react-native";
import { hapticLight, hapticMedium } from "../utils/haptics";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = 110;

// ÖNEMLİ MİMARİ NOT: Bu bileşen HER KART İÇİN "key" ile yeniden oluşturulmalı
// (örn. <SwipeableCard key={item.id} .../>). Bu sayede her kartın "pan" (konum)
// değeri kendine ait, TAMAMEN YENİ bir Animated.Value olarak sıfırdan başlar —
// önceki kartların konumunu "sıfırlamaya" hiç gerek kalmaz. Paylaşılan/tekrar
// kullanılan tek bir pan değeriyle çalışmak, kartlar arası geçişte eski kartın
// bir anlığına geri görünmesi gibi pürüzlere sebep oluyordu — bu tasarım o
// sınıf hatayı kökten ortadan kaldırıyor.
//
// DC2/MP1/TM1 — bu TEK bileşen Discover, MatchParty ve TasteMate'in ÜÇÜNÜN de swipe motoru,
// bu yüzden buraya eklenen haptic/his düzeltmesi üçünü birden kapsıyor. Eskiden swipe tamamen
// dokunsal olarak sessizdi: eşiği geçerken hiçbir tık yoktu, kart atılırken sabit hızda
// kayıyordu. Artık eşik geçilirken hafif bir haptic ("az kaldı") + serbest bırakılıp commit
// edilince orta şiddette bir haptic ("gitti") var; kart atılırken de sabit hız yerine hafifçe
// küçülerek (squash) hızlanan bir eğriyle fırlıyor.
const SwipeableCard = forwardRef(function SwipeableCard({ onSwipeLeft, onSwipeRight, style, children }, ref) {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const crossedRef = useRef(false);

  function animateOff(direction) {
    Animated.parallel([
      Animated.timing(pan, {
        toValue: { x: direction === "right" ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, y: 0 },
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(scale, { toValue: 0.9, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(() => {
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
    onPanResponderGrant: () => { crossedRef.current = false; },
    onPanResponderMove: (...args) => {
      Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(...args);
      const [, g] = args;
      const pastThreshold = Math.abs(g.dx) > SWIPE_THRESHOLD;
      if (pastThreshold && !crossedRef.current) {
        crossedRef.current = true;
        hapticLight();
      } else if (!pastThreshold && crossedRef.current) {
        crossedRef.current = false;
      }
      scale.setValue(1 - Math.min(0.06, Math.abs(g.dx) / SCREEN_W * 0.12));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) { hapticMedium(); animateOff("right"); }
      else if (g.dx < -SWIPE_THRESHOLD) { hapticMedium(); animateOff("left"); }
      else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, friction: 6 }).start();
      }
    },
  });

  const rotate = pan.x.interpolate({ inputRange: [-SCREEN_W, 0, SCREEN_W], outputRange: ["-15deg", "0deg", "15deg"] });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[style, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }, { scale }] }]}
    >
      {typeof children === "function" ? children(pan) : children}
    </Animated.View>
  );
});

export default SwipeableCard;
