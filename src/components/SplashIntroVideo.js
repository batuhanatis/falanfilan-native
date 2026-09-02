import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

const introSource = require("../../assets/splash-intro.mp4");

// Native açılış ekranındaki statik logo kapanır kapanmaz, arkadan gelen sessiz bir video
// bir kez oynuyor: renkli şeritler kenarlardan girdap gibi içe dolanıyor, son saniyede
// çözülüp küçük/ortalanmış gerçek logoya dönüşüyor. Video bitince (playToEnd) onFinish ile
// asıl uygulama akışına (Gate'teki checking/auth mantığına) devrediyoruz — oturum kontrolü
// videodan önce bitmiş olsa bile bu ilk-açılış anını erken kesmiyoruz, videodan sonra bitmemişse
// de mevcut LoadingLogo (nabız animasyonu) devralıp beklemeye devam ediyor.
export default function SplashIntroVideo({ onFinish }) {
  const player = useVideoPlayer(introSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener("playToEnd", () => {
      onFinish?.();
    });
    return () => sub.remove();
  }, [player, onFinish]);

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020104" },
});
