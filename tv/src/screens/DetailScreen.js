import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, BackHandler, AppState } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONTS, SAFE_X, SAFE_Y, upperTR } from "../theme";
import { platformLabel, openOnPlatform, canOpenPlatform } from "../platforms";
import FocusButton from "../components/FocusButton";

// İçerik detayı: kararı verdiren yer. "…'te izle" platform uygulamasını doğrudan içerikte açıyor;
// link yoksa uygulama ana ekranında açılıyor ve bunu söylüyoruz.
export default function DetailScreen({ movie, onBack }) {
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

  const all = Array.isArray(movie.watchLinks) && movie.watchLinks.length
    ? movie.watchLinks
    : (movie.platforms || []).map((p) => ({ platform: p.name, url: null }));
  // TV'de açamadığımız uygulamalar (paket adı bilinmiyor, link yok) düğme değil, bilgi satırı.
  const links = all.filter(canOpenPlatform);
  const otherNames = all.filter((l) => !canOpenPlatform(l)).map((l) => platformLabel(l.platform).name);
  const others = otherNames.map((n) => n.toUpperCase());

  function watch(link) {
    const label = platformLabel(link.platform);
    const r = openOnPlatform(link);
    if (r.ok && r.how === "deep") setStatus({ text: `${label.name} açılıyor…`, tone: "info" });
    else if (r.ok) setStatus({ text: `Bu içeriğin ${label.name} linki henüz yok; ${label.name} açıldı, adını aratabilirsin.`, tone: "info" });
    else if (r.reason === "not_installed") setStatus({ text: `${label.name} bu TV'de yüklü değil.`, tone: "error" });
    else if (r.reason === "unknown_app") setStatus({ text: `${label.name} uygulamasını bu TV'de henüz açamıyoruz.`, tone: "error" });
    else setStatus({ text: r.message || "Açılamadı.", tone: "error" });
  }

  const meta = [movie.type, movie.year, movie.imdb ? `IMDb ${movie.imdb}` : null].filter(Boolean).join("  ·  ");

  return (
    <View style={styles.root}>
      {!!movie.poster && <Image source={{ uri: movie.poster }} style={StyleSheet.absoluteFill} blurRadius={22} />}
      <LinearGradient colors={["rgba(20,18,26,0.82)", "rgba(20,18,26,0.96)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        {movie.poster
          ? <Image source={{ uri: movie.poster }} style={styles.poster} />
          : <View style={[styles.poster, { backgroundColor: C.surface2 }]} />}
        <View style={styles.info}>
          <Text style={styles.meta}>{upperTR(meta)}</Text>
          <Text style={styles.title} numberOfLines={2}>{movie.title}</Text>
          {!!movie.genre && <Text style={styles.genre}>{movie.genre}</Text>}
          {!!movie.overview && <Text style={styles.overview} numberOfLines={5}>{movie.overview}</Text>}

          <Text style={styles.section}>NEREDE İZLENİR</Text>
          {links.length || others.length ? (
            <View>
            <View style={styles.buttons}>
              {links.map((l, i) => {
                const label = platformLabel(l.platform);
                return (
                  <FocusButton
                    key={l.platform}
                    label={l.url ? label.watch : label.open}
                    primary={i === 0}
                    hasTVPreferredFocus={i === 0}
                    onPress={() => watch(l)}
                    style={{ marginRight: 12, marginBottom: 12 }}
                  />
                );
              })}
            </View>
            {!!others.length && (links.length
              ? <Text style={styles.others}>AYRICA  ·  {others.join("  ·  ")}</Text>
              : <Text style={styles.none}>{otherNames.join(", ")} uygulamasından izleyebilirsin; o uygulamayı TV'nden açman yeterli.</Text>)}
            {!links.length && <FocusButton label="Geri dön" onPress={onBack} hasTVPreferredFocus style={{ marginTop: 14, alignSelf: "flex-start" }} />}
            </View>
          ) : (
            <View style={{ alignItems: "flex-start" }}>
              <Text style={styles.none}>Şu an Türkiye'de bir platformda görünmüyor.</Text>
              <FocusButton label="Geri dön" onPress={onBack} hasTVPreferredFocus style={{ marginTop: 14 }} />
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
  content: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: SAFE_X * 1.5, paddingVertical: SAFE_Y },
  poster: { width: 220, height: 330, borderRadius: 10 },
  info: { flex: 1, marginLeft: 40 },
  meta: { fontFamily: FONTS.monoMedium, color: C.accent, fontSize: 13, letterSpacing: 1.5 },
  title: { fontFamily: FONTS.marquee, color: C.text, fontSize: 56, lineHeight: 58, marginTop: 6 },
  genre: { color: C.dim, fontSize: 16, marginTop: 4 },
  overview: { color: C.text, opacity: 0.86, fontSize: 16, lineHeight: 23, marginTop: 12, maxWidth: 620 },
  section: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 2, marginTop: 24, marginBottom: 10 },
  buttons: { flexDirection: "row", flexWrap: "wrap" },
  none: { color: C.dim, fontSize: 16 },
  others: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 13, letterSpacing: 1.5, marginTop: 4 },
  status: { color: C.dim, fontSize: 15, marginTop: 6, maxWidth: 620 },
});
