import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { ChevronLeft, Sparkles, Star, Share2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import ShareCardModal from "../components/ShareCardModal";
import BlendShareCard from "../components/BlendShareCard";

export default function BlendScreen({ route, navigation }) {
  const { friendId, friendName, friendAvatar } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showShareCard, setShowShareCard] = useState(false);
  // Paylaşım kartında GÜNCEL profil fotoğrafımın görünmesi için — auth objesi avatar bilgisini
  // tutmuyor (sadece token/id/isim gibi temel alanlar var), bu yüzden ayrıca çekiyoruz.
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);

  useEffect(() => {
    api.me(auth.token).then((me) => setMyAvatarUrl(me.avatarUrl || null)).catch(() => {});
  }, [auth.token]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.blend(auth.token, friendId)
      .then(setData)
      .catch((e) => setError(e.message || "Blend oluşturulamadı."))
      .finally(() => setLoading(false));
  }, [friendId]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blend</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.heroBox}>
            <View style={styles.avatarPair}>
              <RetryImage source={{ uri: avatarOr(myAvatarUrl, auth.id) }} style={[styles.heroAvatar, { marginRight: -14, zIndex: 2 }]} />
              <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={styles.heroAvatar} />
            </View>
            <Text style={styles.heroTitle}>{auth.name?.split(" ")[0]} × {friendName?.split(" ")[0]}</Text>
            {data?.matchPercent != null ? (
              <>
                <Text style={styles.heroPercent}>%{data.matchPercent}</Text>
                <Text style={styles.heroSubtitle}>zevk uyumu</Text>
                <TouchableOpacity style={styles.shareTriggerBtn} onPress={() => setShowShareCard(true)}>
                  <Share2 size={13} color={c.bg} />
                  <Text style={styles.shareTriggerText}>Sonucu Paylaş</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.heroSubtitle}>Uyumu görmek için ikiniz de biraz daha film/dizi beğenin.</Text>
            )}
          </View>

          {data?.common?.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.sectionTitle}>İkinizin de Beğendiği</Text>
              <FlatList
                data={data.common}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? (
                      <Image source={{ uri: item.poster }} style={styles.posterMed} />
                    ) : (
                      <View style={[styles.posterMed, { backgroundColor: c.surface2 }]} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <View style={{ marginTop: 24 }}>
            <View style={styles.recTitleRow}>
              <Sparkles size={15} color={c.accent} />
              <Text style={styles.sectionTitle}>Birlikte İzleyebilecekleriniz</Text>
            </View>
            <Text style={styles.recSubtitle}>İkinizin zevkine göre harmanlanmış, henüz beğenmediğiniz öneriler.</Text>
            {data?.recommendations?.length > 0 ? (
              <FlatList
                data={data.recommendations}
                numColumns={3}
                scrollEnabled={false}
                contentContainerStyle={{ paddingHorizontal: 16, marginTop: 12 }}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={{ width: "33.33%", padding: 5 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? (
                      <Image source={{ uri: item.poster }} style={styles.posterGrid} />
                    ) : (
                      <View style={[styles.posterGrid, { backgroundColor: c.surface2 }]} />
                    )}
                    <Text style={styles.recTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 }}>
                      <Star size={9} color={c.accent} fill={c.accent} />
                      <Text style={styles.recMeta}>{item.imdb}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={[styles.emptyText, { paddingHorizontal: 16, marginTop: 10 }]}>Şu an için öneri çıkaramadık, biraz daha film/dizi beğenin.</Text>
            )}
          </View>
        </ScrollView>
      )}

      {showShareCard && data?.matchPercent != null && (() => {
        const commonMovies = data.common || [];
        const genreCounts = {};
        commonMovies.forEach((m) => (m.genres && m.genres.length ? m.genres : [m.genre]).forEach((g) => {
          if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
        }));
        const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        return (
          <ShareCardModal
            onClose={() => setShowShareCard(false)}
            shareMessage={`${auth.name?.split(" ")[0]} ile ${friendName?.split(" ")[0]} arasında %${data.matchPercent} zevk uyumu 🎬`}
            shareUrl={auth.username && data.friend?.username ? `https://open.pellix.app/blend/${auth.username}/${data.friend.username}` : undefined}
          >
            <BlendShareCard
              myAvatar={myAvatarUrl}
              myId={auth.id}
              myName={auth.name}
              friendAvatar={friendAvatar}
              friendId={friendId}
              friendName={friendName}
              matchPercent={data.matchPercent}
              commonCount={commonMovies.length}
              topGenre={topGenre}
              posters={[...commonMovies, ...(data.recommendations || [])].slice(0, 4).map((m) => m.poster)}
            />
          </ShareCardModal>
        );
      })()}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    heroBox: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 20, backgroundColor: c.surface },
    avatarPair: { flexDirection: "row", marginBottom: 14 },
    heroAvatar: { width: 60, height: 60, borderRadius: 999, borderWidth: 3, borderColor: c.surface },
    heroTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    heroPercent: { fontSize: 40, fontWeight: "800", color: c.accent, marginTop: 10 },
    heroSubtitle: { fontSize: 12, color: c.dim, marginTop: 2, textAlign: "center" },
    shareTriggerBtn: {
      flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.accent,
      borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16,
    },
    shareTriggerText: { fontSize: 12, fontWeight: "800", color: c.bg },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: c.text, paddingHorizontal: 16, marginBottom: 10 },
    recTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, marginBottom: 0 },
    recSubtitle: { fontSize: 11, color: c.dim, paddingHorizontal: 16, marginTop: 2 },
    posterMed: { width: 100, aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: c.surface2 },
    posterGrid: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: c.surface2 },
    recTitle: { fontSize: 10.5, fontWeight: "600", color: c.text, marginTop: 4 },
    recMeta: { fontSize: 9.5, color: c.dim },
    emptyBox: { alignItems: "center", paddingVertical: 50, paddingHorizontal: 30 },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center" },
  });
}
