import React from "react";
import Svg, { Rect, Circle } from "react-native-svg";

// Instagram düğmelerindeki sade kamera simgesi (lucide'da marka simgeleri yok).
export default function InstagramGlyph({ size = 17, color, strokeWidth = 2.2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Rect x={3} y={3} width={18} height={18} rx={5.5} />
      <Circle cx={12} cy={12} r={4.2} />
      <Circle cx={17.4} cy={6.6} r={1.1} fill={color} stroke="none" />
    </Svg>
  );
}
