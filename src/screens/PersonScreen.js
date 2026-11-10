import { t as translateUI } from "../i18n/core";
import { FONTS } from "../theme/fonts";
import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { ChevronLeft, Star, Clapperboard } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { GoldWash, SALON } from "../components/salon/SalonKit";

// Detay sayfasındaki "OYUNCULAR" satırında bir isme dokununca açılıyor — o kişinin oynadığı
// film/dizileri, IMDB oy sayısına göre en tanınandan başlayarak, poster ızgarası olarak gösterir.
// Ayrı bir SAYFA olması bilinçli bir seçim: bir popup'ın üstüne, kullanıcı bir postere dokunup
// TEKRAR Detay'a (yığının üstüne) gideceği için — bu, WatchlistDetail/OtherProfile'daki gibi
// navigasyon yığınıyla doğal olarak çalışan, geri tuşunun beklendiği gibi davrandığı bir akış.
export default function PersonScreen({ route, navigation }) {
  const { personId, name: initialName, photo: initialPhoto, role = "actor" } = route.params;
  const isDirector = role === "director";
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [person, setPerson] = useState({ name: initialName, photo: initialPhoto, results: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.personCredits(auth.token, personId, { role })
      .then((data) => { if (!cancelled) setPerson(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personId, role]);

  // ÖNEMLİ: İlk yükleme sadece en tanınan 40 rolü (havuz) işliyor, bu yüzden sonuç listesi her
  // zaman gerçek toplamdan az/eşit olabiliyor — "hasMore" varsa geri kalanını tek seferlik bir
  // istekle (full=1) çekip mevcut listenin SONUNA ekliyoruz.
  function loadMore() {
    if (loadingMore || !person.hasMore) return;
    setLoadingMore(true);
    api.personCredits(auth.token, personId, { full: true, role })
      .then((data) => {
        setPerson((prev) => ({ ...prev, results: [...(prev.results || []), ...(data.results || [])], hasMore: false }));
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  const results = [...(person.results || [])].sort((a, b) => {
    const aDate = a.creditDate || a.releaseDate || (a.year ? `${a.year}-01-01` : "");
    const bDate = b.creditDate || b.releaseDate || (b.year ? `${b.year}-01-01` : "");
    return bDate.localeCompare(aDate);
  });
  // Üstteki sayı artık her zaman GERÇEK toplamı gösteriyor (TMDB'nin ham kredi sayısı) —
  // henüz hiç zenginleştirilmemiş/gösterilmemiş olsa bile doğru.
  const totalCount = person.totalCount ?? results.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerEyebrow} numberOfLines={1}>{translateUI("KÜNYE")}</Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        numColumns={3}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          // Salon künyesi: afiş gibi bir kahraman kartı — altın halkalı portre, rol künyesi,
          // Big Shoulders isim; altında filmografi başlığı.
          <View>
            <View style={styles.hero}>
              <GoldWash height={190} strength={0.18} />
              <View style={styles.photoRing}>
                {(person.photo || initialPhoto) ? (
                  <Image source={{ uri: person.photo || initialPhoto }} style={styles.profilePhoto} />
                ) : (
                  <View style={[styles.profilePhoto, styles.profilePhotoFallback]} />
                )}
              </View>
              <Text style={styles.roleEyebrow}>{isDirector ? translateUI("YÖNETMEN") : translateUI("OYUNCU")}</Text>
              <Text style={styles.profileName}>{person.name || initialName}</Text>
              {!loading && (
                <View style={styles.profileMetaRow}>
                  <Clapperboard size={12} color={c.accent} />
                  <Text style={styles.profileMeta}>
                    {totalCount > 0 ? translateUI("{0} yapım {1}", {0: totalCount,1: isDirector ? "yönetti" : "oynadı"}) : translateUI("Bilinen bir yapım bulunamadı")}
                  </Text>
                </View>
              )}
            </View>
            {results.length > 0 && <Text style={styles.sectionLabel}>{translateUI("FİLMOGRAFİ")}</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("Detail", { movie: item })}
          >
            <View style={styles.posterWrap}>
              {item.poster ? (
                <Image source={{ uri: item.poster }} style={StyleSheet.absoluteFillObject} />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]} />
              )}
              <View style={styles.ratingBadge}>
                <Star size={8} color={c.accent} fill={c.accent} />
                <Text style={styles.ratingText}>{item.imdb}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>{item.year}{translateUI(" · ")}{translateUI(item.type)}</Text>
            {!isDirector && !!item.character && <Text style={styles.cardCharacter} numberOfLines={1}>{item.character}{translateUI(" olarak")}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>{translateUI("Bu kişi için gösterilecek bir yapım bulunamadı.")}</Text>
          )
        }
        ListFooterComponent={
          !loading && person.hasMore ? (
            <TouchableOpacity style={styles.seeAllBtn} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Text style={styles.seeAllBtnText}>{translateUI("Tümünü Gör")}</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerEyebrow: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.6, color: c.accent, flex: 1 },
    hero: {
      alignItems: "center", paddingTop: 26, paddingBottom: 22, paddingHorizontal: 18, marginBottom: 20,
      borderRadius: 18, borderWidth: 1, borderColor: SALON.goldLine, backgroundColor: c.surface, overflow: "hidden",
    },
    photoRing: { padding: 4, borderRadius: 999, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg },
    profilePhoto: { width: 104, height: 104, borderRadius: 999 },
    profilePhotoFallback: { backgroundColor: c.surface2 },
    roleEyebrow: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.8, color: c.accent, marginTop: 16 },
    profileName: { fontFamily: FONTS.marquee, fontSize: 40, lineHeight: 42, color: c.text, marginTop: 4, textAlign: "center" },
    profileMetaRow: {
      flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12,
      borderWidth: 1, borderColor: "rgba(201,164,76,0.4)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    },
    profileMeta: { fontFamily: FONTS.monoMedium, fontSize: 10.5, color: c.accent, letterSpacing: 0.4 },
    sectionLabel: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.6, color: c.dim, marginBottom: 12 },
    card: { flex: 1, marginBottom: 18 },
    posterWrap: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: "rgba(201,164,76,0.22)" },
    posterFallback: { backgroundColor: c.surface2 },
    ratingBadge: {
      position: "absolute", top: 6, left: 6,
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(20,18,26,0.82)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999,
    },
    ratingText: { fontSize: 9, fontFamily: FONTS.monoMedium, color: SALON.cream },
    cardTitle: { fontFamily: FONTS.marquee, fontSize: 15, lineHeight: 16, color: c.text, marginTop: 7 },
    cardMeta: { fontFamily: FONTS.monoMedium, fontSize: 9, color: c.dim, marginTop: 2 },
    cardCharacter: { fontSize: 9.5, color: c.accent, marginTop: 1, fontStyle: "italic" },
    emptyText: { fontSize: 12, color: c.dim, textAlign: "center", marginTop: 20, paddingHorizontal: 30 },
    seeAllBtn: {
      alignItems: "center", justifyContent: "center", paddingVertical: 14, marginTop: 4,
      borderWidth: 1, borderColor: "rgba(201,164,76,0.4)", borderRadius: 12, backgroundColor: "transparent",
    },
    seeAllBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
  });
}
