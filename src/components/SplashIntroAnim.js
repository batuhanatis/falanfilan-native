import React, { useEffect } from "react";
import { View, StyleSheet, Image, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");

// Native splash'taki logoya yakın ölçüde başlıyoruz; böylece native splash -> JS intro
// geçişinde logo zıplamıyor. Animasyon kısa tutuldu: marka hissi veriyor ama kullanıcıyı
// gereksiz yere bekletmiyor.
const LOGO_SIZE = Math.min(Math.max(SCREEN_W * 0.4, 136), 164);
const GLOW_SIZE = LOGO_SIZE * 2.5;

const EXIT_DELAY_MS = 1520;
const EXIT_DURATION_MS = 300;

export default function SplashIntroAnim({ onFinish }) {
  const onFinishRef = React.useRef(onFinish);
  onFinishRef.current = onFinish;

  const rootOpacity = useSharedValue(1);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.78);
  const logoPulse = useSharedValue(1);
  const logoY = useSharedValue(12);

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.72);

  const ring1Opacity = useSharedValue(0);
  const ring1Scale = useSharedValue(0.9);
  const ring2Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(0.9);

  const shimmerProgress = useSharedValue(0);

  const finish = React.useCallback(() => {
    onFinishRef.current?.();
  }, []);

  useEffect(() => {
    // 1) Karanlığın içinden yumuşak mor atmosfer gelir.
    glowOpacity.value = withSequence(
      withTiming(0.92, { duration: 340, easing: Easing.out(Easing.cubic) }),
      withTiming(0.58, { duration: 900, easing: Easing.inOut(Easing.ease) })
    );
    glowScale.value = withTiming(1.1, {
      duration: 1380,
      easing: Easing.out(Easing.cubic),
    });

    // 2) Logo küçükten doğal boyutuna gelir; sert "zoom" yerine hafif bir overshoot var.
    logoOpacity.value = withDelay(
      90,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
    );
    logoY.value = withDelay(
      80,
      withTiming(0, { duration: 430, easing: Easing.out(Easing.cubic) })
    );
    logoScale.value = withDelay(
      70,
      withSequence(
        withTiming(1.035, { duration: 390, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 14, stiffness: 175, mass: 0.55 })
      )
    );

    // 3) Logonun etrafından iki ince ışık halkası geçer. Film şeridinin renklerine rakip
    // olmaması için halkaları sıcak beyaz/altın tonunda ve düşük opaklıkta tutuyoruz.
    ring1Opacity.value = withDelay(
      430,
      withSequence(
        withTiming(0.34, { duration: 70 }),
        withTiming(0, { duration: 470, easing: Easing.out(Easing.cubic) })
      )
    );
    ring1Scale.value = withDelay(
      430,
      withTiming(1.42, { duration: 540, easing: Easing.out(Easing.cubic) })
    );

    ring2Opacity.value = withDelay(
      590,
      withSequence(
        withTiming(0.18, { duration: 70 }),
        withTiming(0, { duration: 430, easing: Easing.out(Easing.cubic) })
      )
    );
    ring2Scale.value = withDelay(
      590,
      withTiming(1.58, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // 4) Çok kısa bir highlight logonun üstünden akar. Bu efekt tek görsel asset ile bile
    // film şeridinin parlak/3D yüzeyini canlı hissettiriyor.
    shimmerProgress.value = withDelay(
      610,
      withTiming(1, { duration: 540, easing: Easing.inOut(Easing.cubic) })
    );

    // 5) Çıkmadan hemen önce neredeyse fark edilmeyen bir "breath".
    logoPulse.value = withDelay(
      1100,
      withSequence(
        withTiming(1.018, { duration: 160, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 210, easing: Easing.inOut(Easing.ease) })
      )
    );

    // 6) Tüm intro tek parça halinde kararıp uygulamaya bırakır.
    rootOpacity.value = withDelay(
      EXIT_DELAY_MS,
      withTiming(
        0,
        { duration: EXIT_DURATION_MS, easing: Easing.inOut(Easing.ease) },
        (finished) => {
          if (finished) runOnJS(finish)();
        }
      )
    );
  }, []);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoY.value },
      { scale: logoScale.value },
      { scale: logoPulse.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    const p = shimmerProgress.value;
    return {
      opacity: Math.sin(Math.PI * p) * 0.72,
      transform: [
        { translateX: -LOGO_SIZE * 0.9 + p * LOGO_SIZE * 1.8 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]}>
        <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id="pellixGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#7C3AED" stopOpacity="0.34" />
              <Stop offset="0.38" stopColor="#5B21B6" stopOpacity="0.18" />
              <Stop offset="0.72" stopColor="#32145F" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#020104" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="150" cy="150" r="150" fill="url(#pellixGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.ring, ring1Style]} />
      <Animated.View pointerEvents="none" style={[styles.ring, styles.ringSoft, ring2Style]} />

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={require("../../assets/splash-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Animated.View pointerEvents="none" style={[styles.shimmerTrack, shimmerStyle]}>
          <LinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.04)",
              "rgba(255,245,205,0.38)",
              "rgba(255,255,255,0.05)",
              "rgba(255,255,255,0)",
            ]}
            locations={[0, 0.28, 0.5, 0.72, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.shimmerBand}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020104",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: LOGO_SIZE * 1.08,
    height: LOGO_SIZE * 1.08,
    borderRadius: LOGO_SIZE * 0.31,
    borderWidth: 1.2,
    borderColor: "rgba(255,225,145,0.52)",
  },
  ringSoft: {
    borderWidth: 0.8,
    borderColor: "rgba(198,174,255,0.36)",
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.265,
    overflow: "hidden",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  shimmerTrack: {
    position: "absolute",
    top: -LOGO_SIZE * 0.28,
    left: -LOGO_SIZE * 0.22,
    width: LOGO_SIZE * 0.34,
    height: LOGO_SIZE * 1.56,
  },
  shimmerBand: {
    flex: 1,
    transform: [{ rotate: "18deg" }],
  },
});
