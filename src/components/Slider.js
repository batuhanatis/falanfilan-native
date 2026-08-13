import React, { useRef, useState } from "react";
import { View, PanResponder, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hapticLight } from "../utils/haptics";

const THUMB_SIZE = 20;

// Projede hazır bir slider kütüphanesi yok (native modül eklemek yeni bir build gerektirirdi) —
// bu yüzden PanResponder + Animated tabanlı, bu kod tabanında zaten kurulu olan desenle
// (SwipeableCard, ShareCardModal'ın kart geçişi) tutarlı, hafif bir tane.
export default function Slider({ value, onChange, onSlidingComplete, min = 0, max = 100 }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [trackWidth, setTrackWidth] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const trackWidthRef = useRef(0);

  function handleTouch(x) {
    const w = trackWidthRef.current;
    if (w <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / w));
    const next = Math.round(min + ratio * (max - min));
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChange(next);
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        hapticLight();
        handleTouch(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => handleTouch(e.nativeEvent.locationX),
      onPanResponderRelease: () => onSlidingComplete?.(valueRef.current),
      onPanResponderTerminate: () => onSlidingComplete?.(valueRef.current),
    })
  ).current;

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <View
      style={styles.track}
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
        setTrackWidth(e.nativeEvent.layout.width);
      }}
      hitSlop={{ top: 12, bottom: 12 }}
      {...panResponder.panHandlers}
    >
      <View style={styles.trackBg} />
      {trackWidth > 0 && (
        <>
          <View style={[styles.fill, { width: `${pct}%` }]} />
          <View style={[styles.thumb, { left: `${pct}%` }]} />
        </>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    track: { height: 28, justifyContent: "center" },
    trackBg: { height: 4, borderRadius: 999, backgroundColor: c.surface2 },
    fill: { position: "absolute", left: 0, top: 12, height: 4, borderRadius: 999, backgroundColor: c.accent },
    thumb: {
      position: "absolute", top: 4, width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
      marginLeft: -THUMB_SIZE / 2, backgroundColor: c.accent, borderWidth: 2, borderColor: c.bg,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3,
    },
  });
}
