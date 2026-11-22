import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import * as Updates from "expo-updates";

// Mağazadan yeni kurulan (ya da mağazadan güncellenen) uygulamanın ilk açılışı "gömülü" pakettir;
// expo-updates en yeni OTA'yı arka planda indirip ancak bir sonraki açılışta uygular. Bu yüzden
// yeni kullanıcılar ilk açılışta haftalar önceki ekranları görüyordu (ör. düello yoktu).
// Burada yalnızca gömülü açılışta, yerel açılış ekranının aynısını gösterirken kısa süre
// güncelleme aranır; varsa indirilip uygulama yeniden yüklenir. Ağ yoksa ya da süre dolarsa
// gömülü paketle devam edilir (indirme arka planda sürer, sonraki açılışta uygulanır).
const CHECK_MS = 5000;
const FETCH_MS = 15000;
const BG = "#14121a"; // app.json expo-splash-screen backgroundColor ile aynı

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export function shouldGateLaunch() {
  try {
    return !__DEV__ && Updates.isEnabled && Updates.isEmbeddedLaunch === true;
  } catch {
    return false;
  }
}

export default function UpdateGate({ children }) {
  const [done, setDone] = useState(() => !shouldGateLaunch());
  useEffect(() => {
    if (done) return undefined;
    let alive = true;
    (async () => {
      try {
        const check = await withTimeout(Updates.checkForUpdateAsync(), CHECK_MS);
        if (check?.isAvailable) {
          const res = await withTimeout(Updates.fetchUpdateAsync(), FETCH_MS);
          if (res?.isNew) { await Updates.reloadAsync(); return; }
        }
      } catch {}
      if (alive) setDone(true);
    })();
    return () => { alive = false; };
  }, []);
  if (done) return children;
  return (
    <View style={styles.root} accessibilityLabel="pellix">
      <Image source={require("../../assets/splash-logo.png")} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  logo: { width: 160, height: 160 },
});
