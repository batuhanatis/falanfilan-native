import React, { useEffect } from "react";
import { View, StyleSheet, Image } from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Path,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";

// Expo native splash'taki imageWidth ile aynı tutuluyor. Böylece native splash kapanıp
// React Native katmanı geldiğinde logo yeniden boyutlanmış gibi görünmüyor.
const LOGO_SIZE = 160;
const GLOW_SIZE = 390;
const FILM_PATH_LENGTH = 250;
const TOTAL_MS = 1600;

// Gerçek logodaki renkli film şeridinin merkez hattına oturan yol. 160x160 viewBox içinde
// tanımlandığı için splash-logo.png ile birlikte her cihazda aynı oranda ölçekleniyor.
const FILM_PATH =
  "M 70 29 C 68 40 45 43 43 54 C 40 64 55 67 69 71 C 82 76 94 82 98 88 C 104 95 100 100 91 103 C 80 108 67 108 54 112 C 47 114 44 120 45 126";

// Logodaki perforasyonların gerçek görseldeki yaklaşık merkezleri. Bir ışık şeridi bunların
// üzerinden geçerken sırayla çok kısa parlamaları, hareketi filmin kendisine bağlı hissettiriyor.
const PERFORATIONS = [
  { x: 69.4, y: 71.1 },
  { x: 76.6, y: 74.3 },
  { x: 83.5, y: 77.7 },
  { x: 89.9, y: 81.5 },
  { x: 95.1, y: 85.6 },
  { x: 90.1, y: 97.1 },
  { x: 83.8, y: 100.2 },
  { x: 76.9, y: 102.9 },
  { x: 69.5, y: 105.5 },
  { x: 61.8, y: 108.1 },
  { x: 54.0, y: 110.9 },
];

const AnimatedPath = Animated.createAnimatedComponent(Path);

function PerforationFlash({ x, y, delay }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.9, { duration: 55, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) })
      )
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.18, { duration: 70, easing: Easing.out(Easing.cubic) }),
        withTiming(0.92, { duration: 135, easing: Easing.inOut(Easing.ease) })
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.perforationFlash,
        {
          left: x - 2,
          top: y - 1.6,
        },
        style,
      ]}
    />
  );
}

export default function SplashIntroAnim({ onFinish }) {
  const onFinishRef = React.useRef(onFinish);
  onFinishRef.current = onFinish;

  const rootOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const logoY = useSharedValue(0);

  const purpleGlowOpacity = useSharedValue(0.34);
  const purpleGlowScale = useSharedValue(0.92);
  const goldGlowOpacity = useSharedValue(0);
  const goldGlowScale = useSharedValue(0.78);

  const filmProgress = useSharedValue(0);
  const filmOpacity = useSharedValue(0);
  const goldActivationOpacity = useSharedValue(0);

  const finish = React.useCallback(() => {
    onFinishRef.current?.();
  }, []);

  useEffect(() => {
    // Başlangıçta logo native splash'ın devamı gibi zaten tam boyutta ve görünür. Hareketi
    // logonun tamamına değil, Pellix'e özgü film şeridine veriyoruz.
    purpleGlowOpacity.value = withSequence(
      withTiming(0.62, { duration: 380, easing: Easing.out(Easing.cubic) }),
      withTiming(0.34, { duration: 720, easing: Easing.inOut(Easing.ease) })
    );
    purpleGlowScale.value = withTiming(1.1, {
      duration: 1150,
      easing: Easing.out(Easing.cubic),
    });

    // Film şeridini mor uçtan mavi uca doğru takip eden ışık.
    filmOpacity.value = withDelay(
      90,
      withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 210, easing: Easing.out(Easing.ease) })
      )
    );
    filmProgress.value = withDelay(
      90,
      withTiming(1, { duration: 720, easing: Easing.bezier(0.22, 0.72, 0.25, 1) })
    );

    // Şerit P'nin merkezinden geçince altın taraf kısa süreliğine aktive oluyor.
    goldActivationOpacity.value = withDelay(
      470,
      withSequence(
        withTiming(0.23, { duration: 170, easing: Easing.out(Easing.cubic) }),
        withTiming(0.08, { duration: 410, easing: Easing.inOut(Easing.ease) })
      )
    );
    goldGlowOpacity.value = withDelay(
      500,
      withSequence(
        withTiming(0.42, { duration: 190, easing: Easing.out(Easing.cubic) }),
        withTiming(0.12, { duration: 430, easing: Easing.out(Easing.ease) })
      )
    );
    goldGlowScale.value = withDelay(
      500,
      withTiming(1.08, { duration: 620, easing: Easing.out(Easing.cubic) })
    );

    // Finalde yalnızca %2'lik bir settle. Büyük bir zoom yerine logonun "yerine oturması"
    // hissini veriyor.
    logoScale.value = withDelay(
      840,
      withSequence(
        withTiming(1.022, { duration: 145, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 16, stiffness: 190, mass: 0.5 })
      )
    );
    logoY.value = withDelay(
      840,
      withSequence(
        withTiming(-1.5, { duration: 145, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 210, easing: Easing.inOut(Easing.ease) })
      )
    );

    // Uygulama Gate içinde bu splash'ın ALTINDA önceden render ediliyor. Bu nedenle son fade
    // gerçekten ana ekrana crossfade oluyor; arada boş/loader karesi oluşmuyor.
    rootOpacity.value = withDelay(
      1310,
      withTiming(
        0,
        { duration: 290, easing: Easing.inOut(Easing.ease) },
        (finished) => {
          if (finished) runOnJS(finish)();
        }
      )
    );

    // Reanimated callback'in çalışmadığı uç bir durumda splash'ın takılı kalmaması için fallback.
    const fallback = setTimeout(() => onFinishRef.current?.(), TOTAL_MS + 180);
    return () => clearTimeout(fallback);
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoY.value }, { scale: logoScale.value }],
  }));

  const purpleGlowStyle = useAnimatedStyle(() => ({
    opacity: purpleGlowOpacity.value,
    transform: [{ scale: purpleGlowScale.value }],
  }));

  const goldGlowStyle = useAnimatedStyle(() => ({
    opacity: goldGlowOpacity.value,
    transform: [{ translateX: 24 }, { translateY: -5 }, { scale: goldGlowScale.value }],
  }));

  const goldActivationStyle = useAnimatedStyle(() => ({
    opacity: goldActivationOpacity.value,
  }));

  const filmAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: FILM_PATH_LENGTH * (1 - filmProgress.value),
    opacity: filmOpacity.value,
  }));

  return (
    <Animated.View pointerEvents="auto" style={[styles.root, rootStyle]}>
      <Animated.View pointerEvents="none" style={[styles.ambientGlow, purpleGlowStyle]}>
        <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id="purpleAmbient" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#7C3AED" stopOpacity="0.30" />
              <Stop offset="0.42" stopColor="#5B21B6" stopOpacity="0.14" />
              <Stop offset="0.78" stopColor="#2E1065" stopOpacity="0.06" />
              <Stop offset="1" stopColor="#14121A" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="150" cy="150" r="150" fill="url(#purpleAmbient)" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.ambientGlow, goldGlowStyle]}>
        <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id="goldAmbient" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#F6C453" stopOpacity="0.24" />
              <Stop offset="0.45" stopColor="#E69A22" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#14121A" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="150" cy="150" r="150" fill="url(#goldAmbient)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={require("../../assets/splash-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* P'nin altın bölümüne düşen çok yumuşak sıcak ışık. Raster logoyu değiştirmeden,
            film şeridi geçtiğinde yüzeyin aktive olduğu hissini veriyor. */}
        <Animated.View pointerEvents="none" style={[styles.logoOverlay, goldActivationStyle]}>
          <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 160 160">
            <Defs>
              <RadialGradient id="goldActivation" cx="68%" cy="46%" r="43%">
                <Stop offset="0" stopColor="#FFF3BF" stopOpacity="0.72" />
                <Stop offset="0.45" stopColor="#FFD45C" stopOpacity="0.24" />
                <Stop offset="1" stopColor="#FFD45C" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="108" cy="74" r="66" fill="url(#goldActivation)" />
          </Svg>
        </Animated.View>

        {/* Pellix imzası: ışık doğrudan logonun film şeridini takip ediyor. */}
        <View pointerEvents="none" style={styles.logoOverlay}>
          <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 160 160">
            <Defs>
              <SvgLinearGradient
                id="filmSweep"
                x1="46"
                y1="30"
                x2="92"
                y2="122"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="#B946FF" />
                <Stop offset="0.30" stopColor="#FF4D9B" />
                <Stop offset="0.58" stopColor="#FFD166" />
                <Stop offset="0.82" stopColor="#6A5CFF" />
                <Stop offset="1" stopColor="#29D9FF" />
              </SvgLinearGradient>
            </Defs>

            <AnimatedPath
              d={FILM_PATH}
              fill="none"
              stroke="url(#filmSweep)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.20}
              strokeDasharray={[FILM_PATH_LENGTH, FILM_PATH_LENGTH]}
              animatedProps={filmAnimatedProps}
            />
            <AnimatedPath
              d={FILM_PATH}
              fill="none"
              stroke="#FFF8DC"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.86}
              strokeDasharray={[FILM_PATH_LENGTH, FILM_PATH_LENGTH]}
              animatedProps={filmAnimatedProps}
            />
          </Svg>
        </View>

        {PERFORATIONS.map((hole, index) => (
          <PerforationFlash
            key={`${hole.x}-${hole.y}`}
            x={hole.x}
            y={hole.y}
            delay={260 + index * 48}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    // OTA kullanan mevcut binary'lerdeki native splash ile uyumlu ton. Native config ileride
    // yeni build aldığında değişse bile animasyonun kendisi tamamen JS tarafında kalıyor.
    backgroundColor: "#14121A",
    overflow: "hidden",
    zIndex: 10000,
  },
  ambientGlow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 43,
    overflow: "hidden",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  logoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  perforationFlash: {
    position: "absolute",
    width: 4,
    height: 3.2,
    borderRadius: 0.8,
    backgroundColor: "rgba(255,248,218,0.96)",
    shadowColor: "#FFF0A8",
    shadowOpacity: 0.95,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
});
