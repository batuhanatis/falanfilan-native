import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
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
import SearchScreen from "./screens/SearchScreen";
import Curtain from "./components/Curtain";
import Huzme from "./components/Huzme";

// Ekranlar üst üste duruyor: ana ekran hep açık (durumu ve kaydırması korunuyor), arama ve detay
// onun üstünde. Açılışta "Perde" oynuyor; o sırada oturum kontrolü ve ana ekran arkada yükleniyor.
export default function App() {
  const [fontsLoaded] = useFonts({ BigShoulders_800ExtraBold, BigShoulders_700Bold, DMMono_400Regular, DMMono_500Medium, Baloo2_800ExtraBold });
  const [booting, setBooting] = useState(true);
  const [intro, setIntro] = useState(true);
  const [auth, setAuth] = useState(null);
  const [search, setSearch] = useState(false);
  const [detail, setDetail] = useState(null); // { movie, from: "home" | "search" }
  const [preferred, setPreferred] = useState(null); // ana ekrana dönünce odağın gideceği yer

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
    setSearch(false);
    setPreferred(null);
    setAuth(null);
  }, []);

  const open = useCallback((movie, row) => {
    if (row === "search") {
      setDetail({ movie, from: "search" });
      return;
    }
    setPreferred({ id: movie.id, row });
    setDetail({ movie, from: "home" });
  }, []);

  const back = useCallback(() => setDetail(null), []);
  const openSearch = useCallback(() => setSearch(true), []);
  const closeSearch = useCallback(() => { setSearch(false); setPreferred({ row: "search" }); }, []);
  const introDone = useCallback(() => setIntro(false), []);

  if (!fontsLoaded) return <View style={styles.root}><StatusBar hidden /></View>;

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {booting ? (
        <Huzme />
      ) : !auth ? (
        <PairScreen onPaired={setAuth} />
      ) : (
        <>
          <HomeScreen
            auth={auth}
            onOpen={open}
            onSignOut={signOut}
            onSearch={openSearch}
            preferred={detail || search ? null : preferred}
            hidden={!!detail || search}
          />
          {search && <SearchScreen auth={auth} onOpen={open} onBack={closeSearch} hidden={!!detail} />}
          {detail && <DetailScreen movie={detail.movie} token={auth.token} onBack={back} />}
        </>
      )}
      {intro && <Curtain onDone={introDone} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});
