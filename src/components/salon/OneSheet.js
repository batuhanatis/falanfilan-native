import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

// Profil afişinin ("one-sheet") zemini: kapak fotoğrafı yoksa kadife perde, üstünde spot ışığı.
// Kendi profilin (ProfileScreen) ve başkasının profili (OtherProfileScreen) aynı afişi kullanıyor;
// afiş fiziksel bir nesne olduğu için iki temada da aynı koyu renklerde.
const CURTAIN_FOLDS = 18;

export function Curtain() {
  return (
    <View style={[StyleSheet.absoluteFillObject, { flexDirection: "row" }]} pointerEvents="none">
      {Array.from({ length: CURTAIN_FOLDS }, (_, i) => (
        <LinearGradient key={i} colors={["#3a1012", "#7a2428", "#4a1416"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      ))}
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(10,3,4,0.55)"]} style={StyleSheet.absoluteFillObject} />
    </View>
  );
}

// id: aynı anda iki afiş yığında açık olabildiği için (profil sekmesi + üstüne açılan başka profil)
// her biri kendi gradyan kimliğini kullanıyor.
export function Spotlight({ id = "profileSpot" }) {
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="22%" rx="60%" ry="62%" fx="50%" fy="18%">
          <Stop offset="0" stopColor="#ffe4aa" stopOpacity="0.5" />
          <Stop offset="0.55" stopColor="#ffe4aa" stopOpacity="0.1" />
          <Stop offset="1" stopColor="#ffe4aa" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50%" cy="22%" rx="60%" ry="62%" fill={`url(#${id})`} />
    </Svg>
  );
}
