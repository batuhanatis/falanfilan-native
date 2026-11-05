import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, BackHandler, AppState } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api";
import { C, BOARD, FONTS, SAFE_X, SAFE_Y, upperTR } from "../theme";
import { platformLabel, canOpenPlatform, watchLinksOf, watchButtonLabel, watchAndDescribe, openTrailerInYouTube, storesOf, canOpenStore, openStoreAndDescribe } from "../platforms";
import FocusButton from "../components/FocusButton";
import Huzme from "../components/Huzme";

// İçerik detayı: kararı verdiren yer. "…'te izle" platform uygulamasını doğrudan içerikte açıyor;
// link yoksa uygulamayı ana ekranında açıyor ve bunu söylüyoruz. Satırlardan gelen içerik hafif
// (platform linkleri yok); detay açılınca tamamı ve yatay görsel/fragman çekiliyor. Arka plan
// bulanık değil (TV'de pahalı): yatay görsel, soldan ve alttan karartılmış.
export default function DetailScreen({ movie: initial, token, onBack }) {
  const [movie, setMovie] = useState(initial);
  const [media, setMedia] = useState(null); // { trailer, backdrop }
  const [ready, setReady] = useState(Array.isArray(initial.watchLinks) && Array.isArray(initial.stores));
  const [status, setStatus] = useState(null); // { text, tone }

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  // Platform uygulamasından geri dönünce durum yazısını temizle.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") setStatus(null); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    if (!Array.isArray(initial.watchLinks) || !Array.isArray(initial.stores)) {
      api.movie(token, initial.id)
        .then((full) => { if (alive) setMovie((m) => ({ ...m, ...full })); })
        .catch(() => {})
        .finally(() => { if (alive) setReady(true); });
    }
    api.trailer(token, initial.id).then((r) => { if (alive) setMedia(r); }).catch(() => {});
    return () => { alive = false; };
  }, [initial, token]);

  const all = watchLinksOf(movie);
  // TV'de açamadığımız uygulamalar (paket adı bilinmiyor, link yok) düğme değil, bilgi satırı.
  const links = all.filter(canOpenPlatform);
  const otherNames = all.filter((l) => !canOpenPlatform(l)).map((l) => platformLabel(l.platform).name);
  const others = otherNames.map((n) => n.toUpperCase());
  const trailerKey = media?.trailer?.key;
  // Kiralık / satın alınabilir: TV'de açabildiklerimiz düğme, diğerleri bilgi satırı.
  const stores = storesOf(movie);
  const storeButtons = stores.filter(canOpenStore);
  const storeOthers = stores.filter((st) => !canOpenStore(st)).map((st) => `${st.name.toUpperCase()} (${st.offerText.toLocaleUpperCase("tr-TR")})`);
  const focusStoreFirst = !links.length && storeButtons.length > 0;

  const watch = (link) => setStatus(watchAndDescribe(link));
  const meta = [movie.genre, movie.type, movie.year, movie.runtime, movie.imdb ? `IMDb ${movie.imdb}` : null].filter(Boolean).join(" · ");

  return (
    <View style={styles.root}>
      {!!media?.backdrop && (
        <View style={styles.backdrop}>
          <Image source={media.backdrop} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
          <LinearGradient colors={[C.bg, "rgba(20,18,26,0.75)", "rgba(20,18,26,0.25)"]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(20,18,26,0)", C.bg]} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
        </View>
      )}
      <View style={styles.content}>
        {movie.poster
          ? <Image source={movie.poster} style={styles.poster} contentFit="cover" cachePolicy="memory-disk" />
          : <View style={[styles.poster, { backgroundColor: C.surface2 }]} />}
        <View style={styles.info}>
          <Text style={styles.meta} numberOfLines={1}>{upperTR(meta)}</Text>
          <Text style={styles.title} numberOfLines={2}>{movie.title}</Text>
          {!!movie.overview && <Text style={styles.overview} numberOfLines={5}>{movie.overview}</Text>}

          <Text style={styles.section}>NEREDE İZLENİR</Text>
          {!ready ? (
            <Huzme compact label="PLATFORMLAR" />
          ) : links.length || others.length ? (
            <View>
              <View style={styles.buttons}>
                {links.map((l, i) => (
                  <FocusButton
                    key={l.platform}
                    label={watchButtonLabel(l)}
                    primary={i === 0}
                    hasTVPreferredFocus={i === 0}
                    onPress={() => watch(l)}
                    style={styles.btn}
                  />
                ))}
                {!!trailerKey && <FocusButton label="Fragman" onPress={() => setStatus(openTrailerInYouTube(trailerKey))} style={styles.btn} />}
              </View>
              {!!others.length && (links.length
                ? <Text style={styles.others}>AYRICA  ·  {others.join("  ·  ")}</Text>
                : <Text style={styles.none}>{otherNames.join(", ")} uygulamasından izleyebilirsin; o uygulamayı TV'nden açman yeterli.</Text>)}
              {!links.length && !storeButtons.length && <FocusButton label="Geri dön" onPress={onBack} hasTVPreferredFocus style={{ marginTop: 14, alignSelf: "flex-start" }} />}
            </View>
          ) : (
            <View style={{ alignItems: "flex-start" }}>
              <Text style={styles.none}>Şu an Türkiye'de abonelikle izlenebileceği bir platformda görünmüyor.</Text>
              {!storeButtons.length && <FocusButton label="Geri dön" onPress={onBack} hasTVPreferredFocus style={{ marginTop: 14 }} />}
            </View>
          )}

          {ready && stores.length > 0 && (
            <View>
              <Text style={styles.section}>KİRALA / SATIN AL</Text>
              {!!storeButtons.length && (
                <View style={styles.buttons}>
                  {storeButtons.map((st, i) => (
                    <FocusButton
                      key={st.key || st.store}
                      label={`${st.name}  ·  ${st.offerText}`}
                      hasTVPreferredFocus={focusStoreFirst && i === 0}
                      onPress={() => setStatus(openStoreAndDescribe(st))}
                      style={styles.btn}
                    />
                  ))}
                  {!links.length && !others.length && !!trailerKey && <FocusButton label="Fragman" onPress={() => setStatus(openTrailerInYouTube(trailerKey))} style={styles.btn} />}
                </View>
              )}
              {!!storeOthers.length && <Text style={styles.others}>{storeButtons.length ? "AYRICA  ·  " : ""}{storeOthers.join("  ·  ")}</Text>}
            </View>
          )}
          {!!status && (
            <Text style={[styles.status, status.tone === "error" && { color: C.danger }]}>{status.text}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg },
  backdrop: { position: "absolute", top: 0, right: 0, width: "70%", height: "80%", opacity: 0.85 },
  content: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: SAFE_X * 1.5, paddingVertical: SAFE_Y },
  poster: { width: 220, height: 330, borderRadius: 10, backgroundColor: C.surface2 },
  info: { flex: 1, marginLeft: 40 },
  meta: { fontFamily: FONTS.monoMedium, color: BOARD.gold, fontSize: 13, letterSpacing: 1.2 },
  title: { fontFamily: FONTS.marquee, color: C.text, fontSize: 56, lineHeight: 58, marginTop: 6 },
  overview: { color: C.text, opacity: 0.88, fontSize: 16, lineHeight: 23, marginTop: 12, maxWidth: 620 },
  section: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 2, marginTop: 24, marginBottom: 10 },
  buttons: { flexDirection: "row", flexWrap: "wrap" },
  btn: { marginRight: 12, marginBottom: 12 },
  none: { color: C.dim, fontSize: 16 },
  others: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 13, letterSpacing: 1.5, marginTop: 4 },
  status: { color: C.dim, fontSize: 15, marginTop: 6, maxWidth: 620 },
});
