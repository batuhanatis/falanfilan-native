import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Frown } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import SocialFeedCard from "../components/SocialFeedCard";
import EmptyState from "../components/EmptyState";

// Bir bildirime (push ya da Bildirimler ekranından) dokunulunca gelinen, TEK bir paylaşım/
// aktiviteyi kendi başına gösteren sayfa — Aktivite akışının bir parçası değil, ayrı bir
// "permalink" ekranı. Akışta olsun olmasın (ör. akıştan çoktan düşmüş eski bir öğe) her zaman
// çalışır, çünkü /api/social/posts/:id ve /api/social/activities/:id o TEK öğeyi doğrudan
// getiriyor — feed'in son-50 sınırına bağlı değil.
export default function SharedItemScreen({ navigation, route }) {
  const { kind, id } = route?.params || {};
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!kind || !id) { setFailed(true); setLoading(false); return; }
    setLoading(true);
    setFailed(false);
    const request = kind === "activity" ? api.socialActivityById(auth.token, id) : api.socialPostById(auth.token, id);
    request
      .then((data) => { if (data?.result) setItem(data.result); else setFailed(true); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [kind, id, auth.token]);

  // Geri tuşu her zaman Aktivite sekmesine iniyor — bildirime dokunup uygulamayı SOĞUK
  // başlatan bir kullanıcı için (navigasyon yığınında bu ekranın altında hiçbir şey olmayabilir)
  // navigation.goBack() güvenilir değil, bu yüzden hedefi açıkça belirtiyoruz.
  function goToActivity() {
    navigation.navigate("MainTabs", { screen: "Activity" });
  }

  // SocialFeedCard onChanged'ı beğeni/oy/tepki/yorum sonrası da çağırıyor (parametresiz) —
  // kart bu durumları zaten kendi yerel state'iyle gösteriyor, burada özel bir şey gerekmiyor.
  // Sadece SAHİBİ kendi paylaşımını silerse (type: "deleted") gösterecek bir şey kalmıyor,
  // o zaman akışa dönüyoruz.
  function handleChanged(event) {
    if (event?.type === "deleted") goToActivity();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={["rgba(139,92,246,0.16)", "rgba(139,92,246,0)"]} style={styles.glowTop} />
        <LinearGradient colors={["rgba(236,72,153,0.12)", "rgba(236,72,153,0)"]} style={styles.glowBottom} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={goToActivity} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{kind === "activity" ? "Aktivite" : "Paylaşım"}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={c.accent} /></View>
      ) : failed || !item ? (
        <View style={styles.center}>
          <EmptyState
            icon={Frown}
            title="Bu içerik artık mevcut değil"
            text="Silinmiş olabilir ya da artık görüntüleme iznin yok."
            ctaLabel="Aktiviteye Dön"
            onPress={goToActivity}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SocialFeedCard item={item} navigation={navigation} onChanged={handleChanged} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    glowTop: { position: "absolute", top: -120, left: -80, width: 320, height: 320, borderRadius: 999 },
    glowBottom: { position: "absolute", bottom: -140, right: -100, width: 340, height: 340, borderRadius: 999 },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
      paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    content: { padding: 16, paddingBottom: 40 },
  });
}
