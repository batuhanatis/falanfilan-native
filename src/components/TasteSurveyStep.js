import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Heart, Check, Sparkles } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticLight } from "../utils/haptics";
import { GENRE_FILTERS } from "../theme/theme";
import { GENRE_COLORS } from "../utils/genreColors";
import FavoritePicker from "./FavoritePicker";

// Zevk anketi ekranı (türler + en sevdiğin film/dizi) — paylaşılabilir bir bileşen olarak
// çıkarıldı: hem onboarding'in 1. adımında, hem de bunu HİÇ görmemiş (bu özellik eklenmeden ÖNCE
// onboarding'i tamamlamış) mevcut kullanıcılara App.js'te bir kerelik geriye dönük olarak
// gösteriliyor (bkz. Gate bileşeni). Kendi state'ini/kayıt mantığını taşıyor — her iki kullanım
// da sadece başlık/alt başlık/buton etiketleri ve dışarı çıkış (onSkip/onContinue) sağlıyor.
export default function TasteSurveyStep({ title, subtitle, topExtra, skipLabel = "Atla", continueLabel = "Devam Et", onSkip, onContinue }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();

  const [selectedGenres, setSelectedGenres] = useState(new Set());
  const [favMovie, setFavMovie] = useState(null);
  const [favShow, setFavShow] = useState(null);

  // Daha önce kısmen yanıtlanmış olabilir (ör. bir kullanıcı bu ekranı görüp bir şey seçtikten
  // sonra "Atla" demiş, sonra geriye dönük hatırlatmayla tekrar karşılaştıysa) — mevcut cevapları
  // önceden dolduruyoruz, sıfırdan başlatmıyoruz.
  useEffect(() => {
    api.me(auth.token).then((me) => {
      setSelectedGenres(new Set(me.preferredGenres || []));
      if (me.favoriteMovie) setFavMovie(me.favoriteMovie);
      if (me.favoriteShow) setFavShow(me.favoriteShow);
    }).catch(() => {});
  }, []);

  // Her değişiklik ANINDA kalıcı hale geliyor (WhatsApp'taki gibi "kaydet" butonu beklemeden) —
  // kullanıcı "Atla" dese bile, o ana kadar verdiği cevaplar kaybolmuyor.
  function toggleGenre(genre) {
    hapticLight();
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      next.has(genre) ? next.delete(genre) : next.add(genre);
      api.updatePreferredGenres(auth.token, [...next]).catch(() => {});
      return next;
    });
  }

  function pickFavorite(type, movie) {
    const setFn = type === "Film" ? setFavMovie : setFavShow;
    setFn(movie);
    if (movie) {
      api.updateFavorite(auth.token, { movie_id: movie.id }).catch(() => {});
      api.recordInteraction(auth.token, movie.id, "like").catch(() => {}); // zevk motoruna da yansısın
    } else {
      api.updateFavorite(auth.token, { movie_id: null, type }).catch(() => {});
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 }}>
        {topExtra}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconWrap}><Sparkles size={13} color={c.accent} /></View>
          <Text style={styles.sectionTitle}>Hangi türleri seversin?</Text>
        </View>
        <Text style={styles.sectionHint}>Birden fazla seçebilirsin</Text>
        <View style={styles.genreGrid}>
          {GENRE_FILTERS.map((genre) => {
            const on = selectedGenres.has(genre);
            const color = GENRE_COLORS[genre] || c.accent;
            return (
              <TouchableOpacity
                key={genre}
                style={[styles.genreChip, on && { backgroundColor: color, borderColor: color }]}
                onPress={() => toggleGenre(genre)}
                activeOpacity={0.8}
              >
                {on && <Check size={12} color="#fff" style={{ marginRight: 5 }} />}
                <Text style={[styles.genreChipText, on && { color: "#fff" }]}>{genre}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <View style={styles.sectionIconWrap}><Heart size={13} color={c.accent} /></View>
          <Text style={styles.sectionTitle}>En sevdiklerin</Text>
        </View>
        <Text style={styles.sectionHint}>İstersen boş bırakabilirsin, sonra profilinden de ekleyebilirsin</Text>

        <View style={{ marginTop: 14 }}>
          <FavoritePicker
            label="En sevdiğin film"
            type="Film"
            value={favMovie}
            onSelect={(m) => pickFavorite("Film", m)}
          />
        </View>
        <View style={{ marginTop: 18 }}>
          <FavoritePicker
            label="En sevdiğin dizi"
            type="Dizi"
            value={favShow}
            onSelect={(m) => pickFavorite("Dizi", m)}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>{skipLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueBtn} onPress={onContinue}>
          <Text style={styles.continueText}>{continueLabel}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    title: { color: c.text, fontSize: 20, fontWeight: "800" },
    subtitle: { color: c.dim, fontSize: 12.5, marginTop: 5, lineHeight: 18 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionIconWrap: {
      width: 24, height: 24, borderRadius: 999, backgroundColor: c.surface2,
      alignItems: "center", justifyContent: "center",
    },
    sectionTitle: { fontSize: 14.5, fontWeight: "800", color: c.text },
    sectionHint: { fontSize: 11, color: c.dim, marginTop: 4, marginLeft: 32 },
    genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    genreChip: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    genreChipText: { fontSize: 12.5, fontWeight: "700", color: c.text },
    footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: c.border },
    skipBtn: { paddingHorizontal: 18, justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: c.border },
    skipText: { color: c.dim, fontWeight: "700", fontSize: 13 },
    continueBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    continueText: { color: c.bg, fontWeight: "800", fontSize: 14 },
  });
}
