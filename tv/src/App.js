import React, { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { BigShoulders_800ExtraBold } from "@expo-google-fonts/big-shoulders/800ExtraBold";
import { BigShoulders_700Bold } from "@expo-google-fonts/big-shoulders/700Bold";
import { DMMono_400Regular } from "@expo-google-fonts/dm-mono/400Regular";
import { DMMono_500Medium } from "@expo-google-fonts/dm-mono/500Medium";
import { Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2/800ExtraBold";
import { api, loadAuth, saveAuth } from "./api";
import { C } from "./theme";
import PairScreen from "./screens/PairScreen";
import HomeScreen from "./screens/HomeScreen";
import DetailScreen from "./screens/DetailScreen";

export default function App() {
  const [fontsLoaded] = useFonts({ BigShoulders_800ExtraBold, BigShoulders_700Bold, DMMono_400Regular, DMMono_500Medium, Baloo2_800ExtraBold });
  const [booting, setBooting] = useState(true);
  const [auth, setAuth] = useState(null);
  const [detail, setDetail] = useState(null);
  const [preferred, setPreferred] = useState(null); // detaydan dönünce odağın döneceği afiş

  useEffect(() => {
    (async () => {
      const saved = await loadAuth();
      if (saved?.token) {
        try {
          await api.me(saved.token);
          setAuth(saved);
        } catch (e) {
          if (e.status === 401) await saveAuth(null);
          else setAuth(saved); // ağ hatası: oturumu koru, ana ekran kendi hatasını gösterir
        }
      }
      setBooting(false);
    })();
  }, []);

  const signOut = useCallback(async () => {
    await saveAuth(null);
    setDetail(null);
    setPreferred(null);
    setAuth(null);
  }, []);

  const open = useCallback((movie, row) => {
    setPreferred({ id: movie.id, row });
    setDetail(movie);
  }, []);

  const back = useCallback(() => setDetail(null), []);

  if (!fontsLoaded || booting) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {!auth ? (
        <PairScreen onPaired={setAuth} />
      ) : (
        <>
          <HomeScreen auth={auth} onOpen={open} onSignOut={signOut} preferred={detail ? null : preferred} hidden={!!detail} />
          {detail && <DetailScreen movie={detail} onBack={back} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
});
