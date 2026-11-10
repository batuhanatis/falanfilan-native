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
//
// rightExitTarget (isteğe bağlı): sağa atılan kartın ekrandan çıkmak yerine uçacağı noktayı
// ({ x, y, scale? }, kartın merkezine göre) döndüren fonksiyon. Keşfet'te beğenilen kart sol üstteki
// "duvar"a küçülerek uçuyor; vermeyen ekranlar (MatchParty, TasteMate) eskisi gibi çalışır.
const SwipeableCard = forwardRef(function SwipeableCard({ onSwipeLeft, onSwipeRight, rightExitTarget, style, children }, ref) {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const crossedRef = useRef(false);

  function animateOff(direction) {
    const target = direction === "right" ? rightExitTarget?.() : null;
    if (target) {
      const { scale: endScale = 0.08, ...to } = target;
      Animated.parallel([
        Animated.timing(pan, { toValue: to, duration: 520, easing: Easing.bezier(0.5, 0, 0.75, 0), useNativeDriver: false }),
        Animated.timing(scale, { toValue: endScale, duration: 520, easing: Easing.bezier(0.5, 0, 0.75, 0), useNativeDriver: false }),
      ]).start(() => onSwipeRight());
      return;
    }
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

  // Tanıtım "provası": kart kendiliğinden hafifçe sağa, sonra sola kayıp geri geliyor (kaydırmayı
  // gösteriyor; kartın üstündeki ipuçları da pan.x'e bağlı olduğu için kendiliğinden beliriyor).
  // follower verilirse aynı anda -1..1 arasında aynı ritimle oynatılıyor (eşlik eden el ikonu için).
  // Kullanıcı karta dokunduğu an duruyor; Promise, prova sonuna kadar oynadıysa true döner.
  const nudgeRef = useRef(null);
  function nudge(follower) {
    nudgeRef.current?.stop();
    const STEPS = [[72, 520, 450], [0, 380, 250], [-72, 520, 450], [0, 380, 0]];
    const seq = (value, k) => Animated.sequence(STEPS.flatMap(([to, duration, hold]) => [
      Animated.timing(value, { toValue: to * k, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ...(hold ? [Animated.delay(hold)] : []),
    ]));
    const anim = follower ? Animated.parallel([seq(pan.x, 1), seq(follower, 1 / 72)]) : seq(pan.x, 1);
    nudgeRef.current = anim;
    return new Promise((resolve) => anim.start(({ finished }) => {
      if (nudgeRef.current === anim) nudgeRef.current = null;
      resolve(finished);
    }));
  }
  function stopNudge() {
    if (!nudgeRef.current) return;
    nudgeRef.current.stop();
    nudgeRef.current = null;
    Animated.timing(pan.x, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }

  useImperativeHandle(ref, () => ({
    swipeRight: () => animateOff("right"),
    swipeLeft: () => animateOff("left"),
    nudge,
    stopNudge,
  }));

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
    onPanResponderGrant: () => {
      crossedRef.current = false;
      if (nudgeRef.current) { nudgeRef.current.stop(); nudgeRef.current = null; }
    },
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
