import React, { useEffect } from "react";
import { View, StyleSheet, Image, Dimensions } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");

// Bütün koreografi orijinal "Şerit Girdabı" HTML prototipindeki 300x300'lük SVG viewBox
// birimleriyle tanımlandı (from/to x-y, path noktaları); SCALE bu birimleri gerçek piksele
// çeviriyor. Kurdeleler artık react-native-svg'nin animatedProps üzerinden string bir
// "transform" ile DEĞİL — her biri kendi (statik) küçük Svg'sini saran, düz Reanimated
// useAnimatedStyle (translateX/Y, rotate, scale) ile taşınan bir Animated.View olarak
// hareket ediyor. Neden: react-native-svg'de <G>'nin transform'unu Reanimated'in
// useAnimatedProps'u ile string olarak sürmek, native tarafa JS'teki string→matrix
// dönüşümünü atlayarak sızıyor ve cihazda kurdeleler hiç görünmüyordu (sadece düz
// arkaplan/glow/logo görünüyordu) — RN'in kendi transform stilini kullanmak (glow/logo'da
// zaten kanıtlanmış aynı yol) bunu güvenilir hale getiriyor.
const RIG_SIZE = SCREEN_W * 1.3;
const SCALE = RIG_SIZE / 300;
const RIBBON_BOX = 200 * SCALE;
const LOGO_SIZE = Math.min(Math.max(SCREEN_W * 0.28, 76), 110);

const FLY_MS = 2500;
const HOLD_UNTIL_MS = 3750;
const RING_FADE_MS = 600;
const LOGO_DELAY_MS = 3700;
const LOGO_POP_MS = 260;
const GLOW_DELAY_MS = 3650;
const GLOW_DURATION_MS = 950;
const PULSE_DELAY_MS = 3750;
const PULSE_DURATION_MS = 700;
const TOTAL_MS = 5000;

const FLY_EASING = Easing.bezier(0.18, 0.7, 0.24, 1);

const PATH_A = "M -70,-20 C -30,-55 25,-50 55,-10 C 75,18 55,55 15,60 C -15,64 -45,42 -35,10";
const PATH_B = "M 60,-25 C 90,10 65,55 20,60 C -20,64 -50,35 -40,0 C -32,-25 -5,-45 25,-35";
const PATH_C = "M -20,-65 C 15,-80 60,-55 55,-15 C 50,20 15,50 -25,40 C -55,32 -60,-5 -35,-25";

const RINGS = [
  { id: "r1", delay: 300, colors: ["#7C3AED", "#C084FC"], path: PATH_A, from: { x: -190, y: -90, rot: -210, scale: 0.55 }, to: { x: -19, y: -15, rot: -24, scale: 0.85 } },
  { id: "r2", delay: 460, colors: ["#DB2777", "#F472B6"], path: PATH_B, from: { x: 200, y: -55, rot: 230, scale: 0.55 }, to: { x: 22, y: -11, rot: 16, scale: 0.85 } },
  { id: "r3", delay: 620, colors: ["#F5A524", "#FCD34D"], path: PATH_C, from: { x: 180, y: 105, rot: -270, scale: 0.55 }, to: { x: 17, y: 19, rot: -11, scale: 0.85 } },
  { id: "r4", delay: 780, colors: ["#22D3EE", "#38BDF8"], path: PATH_A, from: { x: -45, y: 200, rot: 250, scale: 0.55 }, to: { x: -9, y: 22, rot: 27, scale: 0.85 } },
  { id: "r5", delay: 940, colors: ["#3B82F6", "#818CF8"], path: PATH_B, from: { x: -200, y: 70, rot: -235, scale: 0.55 }, to: { x: -24, y: 7, rot: -16, scale: 0.85 } },
  { id: "r6", delay: 1100, colors: ["#A855F7", "#E879F9"], path: PATH_C, from: { x: 65, y: -205, rot: 275, scale: 0.55 }, to: { x: 11, y: -22, rot: 21, scale: 0.85 } },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Ribbon({ id, delay, from, to, path, colors }) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: FLY_MS, easing: FLY_EASING }));
    const holdMs = Math.max(0, HOLD_UNTIL_MS - delay - FLY_MS);
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 160 }),
        withTiming(1, { duration: holdMs }),
        withTiming(0, { duration: RING_FADE_MS })
      )
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const tx = (from.x + (to.x - from.x) * progress.value) * SCALE;
    const ty = (from.y + (to.y - from.y) * progress.value) * SCALE;
    const rot = from.rot + (to.rot - from.rot) * progress.value;
    const scale = from.scale + (to.scale - from.scale) * progress.value;
    return {
      opacity: opacity.value,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${rot}deg` },
        { scale },
      ],
    };
  });

  const gradientId = `grad-${id}`;

  return (
    <Animated.View style={[styles.ribbonBox, style]}>
      <Svg width={RIBBON_BOX} height={RIBBON_BOX} viewBox="-100 -100 200 200">
        <Defs>
          <LinearGradient id={gradientId} x1="-35" y1="-10" x2="30" y2="32" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Path d={path} stroke={`url(#${gradientId})`} strokeWidth={15} strokeOpacity={0.28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={path} stroke={`url(#${gradientId})`} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={path} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

export default function SplashIntroAnim({ onFinish }) {
  const ambientOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowRadius = useSharedValue(30);
  const pulseRadius = useSharedValue(8);
  const pulseOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.6);

  useEffect(() => {
    ambientOpacity.value = withDelay(50, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));

    glowOpacity.value = withDelay(
      GLOW_DELAY_MS,
      withSequence(
        withTiming(1, { duration: GLOW_DURATION_MS * 0.3, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: GLOW_DURATION_MS * 0.7, easing: Easing.out(Easing.ease) })
      )
    );
    glowRadius.value = withDelay(
      GLOW_DELAY_MS,
      withTiming(115, { duration: GLOW_DURATION_MS, easing: Easing.out(Easing.cubic) })
    );

    pulseOpacity.value = withDelay(
      PULSE_DELAY_MS,
      withSequence(
        withTiming(0.55, { duration: 90 }),
        withTiming(0, { duration: PULSE_DURATION_MS - 90, easing: Easing.out(Easing.ease) })
      )
    );
    pulseRadius.value = withDelay(
      PULSE_DELAY_MS,
      withTiming(100, { duration: PULSE_DURATION_MS, easing: Easing.out(Easing.cubic) })
    );

    logoOpacity.value = withDelay(LOGO_DELAY_MS, withTiming(1, { duration: LOGO_POP_MS, easing: Easing.out(Easing.ease) }));
    logoScale.value = withDelay(
      LOGO_DELAY_MS,
      withSequence(
        withTiming(1.12, { duration: LOGO_POP_MS, easing: Easing.out(Easing.ease) }),
        withSpring(1, { damping: 11, stiffness: 170, mass: 0.6 })
      )
    );

    const timer = setTimeout(() => {
      onFinish?.();
    }, TOTAL_MS);
    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const ambientProps = useAnimatedProps(() => ({ opacity: ambientOpacity.value }));
  const glowProps = useAnimatedProps(() => ({
    r: glowRadius.value,
    opacity: glowOpacity.value,
  }));
  const pulseProps = useAnimatedProps(() => ({
    r: pulseRadius.value,
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Svg width={RIG_SIZE} height={RIG_SIZE} viewBox="-150 -150 300 300" style={styles.rig}>
          <Defs>
            <RadialGradient id="ambientGrad" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#7C3AED" stopOpacity="0.32" />
              <Stop offset="0.6" stopColor="#7C3AED" stopOpacity="0.12" />
              <Stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="glowGrad" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#F5A524" stopOpacity="0.9" />
              <Stop offset="0.55" stopColor="#F5A524" stopOpacity="0.25" />
              <Stop offset="1" stopColor="#F5A524" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <AnimatedCircle cx="0" cy="0" r="145" fill="url(#ambientGrad)" animatedProps={ambientProps} />
          <AnimatedCircle cx="0" cy="0" fill="url(#glowGrad)" animatedProps={glowProps} />
          <AnimatedCircle cx="0" cy="0" fill="none" stroke="#FFF7E6" strokeWidth={2.2} animatedProps={pulseProps} />
        </Svg>

        {RINGS.map((ring) => (
          <Ribbon key={ring.id} id={ring.id} delay={ring.delay} from={ring.from} to={ring.to} path={ring.path} colors={ring.colors} />
        ))}

        <Animated.View style={[styles.logoTile, logoStyle]}>
          <Image source={require("../../assets/splash-logo.png")} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020104" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  rig: { position: "absolute" },
  ribbonBox: {
    position: "absolute",
    width: RIBBON_BOX,
    height: RIBBON_BOX,
    marginLeft: -RIBBON_BOX / 2,
    marginTop: -RIBBON_BOX / 2,
    left: "50%",
    top: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoTile: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.27,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: { width: "100%", height: "100%" },
});
