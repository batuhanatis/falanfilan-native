import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, Crown, Check, Sparkles, Users, Zap } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { getCurrentOffering, purchasePackage, restorePurchases, hasActivePremiumEntitlement } from "../utils/purchases";

const BENEFITS = [
  { icon: Sparkles, text: "Sınırsız AI önerisi (Anlat-Bulalım, Zevkine Göre Öner, Fotoğraftan Bul)" },
  { icon: Users, text: "TasteMate'te sınırsız kaydırma" },
  { icon: Zap, text: "Yeni özelliklere öncelikli erişim" },
];

export default function PremiumScreen({ navigation, route }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [status, setStatus] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [offeringPkg, setOfferingPkg] = useState(null); // RevenueCat'ten gelen GERÇEK ürün/fiyat
  const [offeringError, setOfferingError] = useState(false);
  const autoTriedRef = useRef(false);

  const load = useCallback(() => {
    Promise.all([
      api.premiumStatus(auth.token).catch(() => null),
      api.myReferrals(auth.token).catch(() => null),
    ]).then(([s, r]) => { setStatus(s); setReferrals(r); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // RevenueCat'ten GERÇEK teklifi (ürün, fiyat, süre) çekiyoruz — App Store Connect'te
  // tanımladığımız aboneliğin şu anki gerçek fiyatı, kullanıcının kendi bölgesine/para birimine
  // göre burada otomatik doğru geliyor (kodda sabit bir fiyat yazmıyoruz).
  const [offeringErrorDetail, setOfferingErrorDetail] = useState(""); // GEÇİCİ — sorun bulunca kaldırılacak

  useEffect(() => {
    getCurrentOffering()
      .then((offering) => {
        const pkg = offering?.availablePackages?.[0] || null;
        setOfferingPkg(pkg);
        if (!pkg) {
          setOfferingError(true);
          setOfferingErrorDetail(offering ? "offering var ama içinde paket yok" : "offering hiç gelmedi (current=null)");
        }
      })
      .catch((e) => { setOfferingError(true); setOfferingErrorDetail(e.message || String(e)); });
  }, []);

  // ÖNEMLİ: TasteMate/AI gibi yerlerde günlük hakkı dolan kullanıcı "Premium'a Geç" dediğinde,
  // burada tekrar bir butona basmasına gerek kalmadan satın alma akışı DOĞRUDAN başlıyor —
  // route.params.autoPurchase=true ile buraya gelindiyse, yüklenme bitince otomatik tetikleniyor.
  useEffect(() => {
    if (!loading && offeringPkg && route?.params?.autoPurchase && !status?.isPremium && !autoTriedRef.current) {
      autoTriedRef.current = true;
      handlePurchase();
    }
  }, [loading, status, offeringPkg]);

  // ÖNEMLİ: Satın alma, RevenueCat'in SDK'sı üzerinden doğrudan Apple/Google'a gidiyor — biz
  // hiçbir ödeme bilgisi görmüyoruz/işlemiyoruz. Backend'deki premium_until'ın güncellenmesi,
  // RevenueCat'in gönderdiği webhook üzerinden (neredeyse anında) OTOMATİK oluyor — burada
  // sadece kullanıcıya "alındı" geri bildirimini verip, webhook'un yetişmesi için kısa bir
  // gecikmeyle durumu tekrar sorguluyoruz.
  async function handlePurchase() {
    if (!offeringPkg) {
      Alert.alert("Şu an kullanılamıyor", "Satın alma seçenekleri yüklenemedi, birazdan tekrar dener misin?");
      return;
    }
    setPurchasing(true);
    try {
      const customerInfo = await purchasePackage(offeringPkg);
      if (hasActivePremiumEntitlement(customerInfo)) {
        Alert.alert("Hoş geldin, Premium! 🎉", "Artık sınırsız AI ve TasteMate hakkın var.");
        // Webhook'un backend'e ulaşıp premium_until'ı güncellemesi için kısa bir pay veriyoruz.
        setTimeout(load, 1500);
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert("Olmadı", e.message || "Bir sorun oluştu, tekrar dener misin?");
      }
    }
    setPurchasing(false);
  }

  // Apple'ın KESİN olarak zorunlu kıldığı bir özellik — kullanıcı telefon değiştirdiğinde ya da
  // uygulamayı silip yeniden kurduğunda, önceden satın aldığı aboneliği buradan geri kazanabilmeli.
  async function handleRestore() {
    setRestoring(true);
    try {
      const customerInfo = await restorePurchases();
      if (hasActivePremiumEntitlement(customerInfo)) {
        Alert.alert("Geri Yüklendi", "Premium üyeliğin bulundu ve etkinleştirildi.");
        setTimeout(load, 1500);
      } else {
        Alert.alert("Bulunamadı", "Bu hesaba bağlı aktif bir satın alma bulunamadı.");
      }
    } catch (e) {
      Alert.alert("Olmadı", e.message || "Geri yükleme başarısız oldu.");
    }
    setRestoring(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const isPremium = status?.isPremium;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <LinearGradient colors={["#F59E0B", "#EA580C", "#DC2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <Crown size={32} color="#fff" />
          <Text style={styles.heroTitle}>{isPremium ? "Premium Aktif" : "pellix Premium"}</Text>
          {isPremium ? (
            <Text style={styles.heroSubtitle}>
              {new Date(status.premiumUntil).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} tarihine kadar sınırsız kullan.
            </Text>
          ) : (
            <Text style={styles.heroSubtitle}>Sınırsız AI önerisi ve TasteMate — haftalık</Text>
          )}
        </LinearGradient>

        {!isPremium && (
          <View style={styles.limitsCard}>
            <Text style={styles.limitsTitle}>Şu anki ücretsiz hakların</Text>
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>AI önerisi (bugün)</Text>
              <Text style={styles.limitValue}>{status?.ai?.remaining ?? 0} / {status?.ai?.limit}</Text>
            </View>
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>TasteMate (bugün)</Text>
              <Text style={styles.limitValue}>{status?.tastemate?.remaining ?? 0} / {status?.tastemate?.limit}</Text>
            </View>
            {status?.bonusAiUses > 0 && (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Davet bonusu (ekstra AI)</Text>
                <Text style={[styles.limitValue, { color: c.accent }]}>+{status.bonusAiUses}</Text>
              </View>
            )}
          </View>
        )}

        {!!referrals && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate("InviteFriend")}
            style={styles.limitsCard}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.limitsTitle}>Davetlerin</Text>
              <ChevronRight size={16} color={c.dim} />
            </View>
            <Text style={styles.referralHint}>
              {referrals.totalCompleted > 0
                ? `${referrals.totalCompleted} arkadaşınla eşleştin, ödülünü kazandın 🎉`
                : "Kodunu paylaş, MatchParty'de eşleşince +5 AI hakkı kazan."}
            </Text>
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Davet edilen</Text>
              <Text style={styles.limitValue}>{referrals.totalInvited}</Text>
            </View>
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Tamamlanan (eşleşilen)</Text>
              <Text style={[styles.limitValue, { color: c.accent }]}>{referrals.totalCompleted}</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.benefitsCard}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}><b.icon size={16} color={c.accent} /></View>
              <Text style={styles.benefitText}>{b.text}</Text>
              <Check size={16} color={c.accent} />
            </View>
          ))}
        </View>

        {!isPremium && (
          <TouchableOpacity style={styles.purchaseBtn} onPress={handlePurchase} disabled={purchasing || !offeringPkg}>
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseBtnText}>
                {offeringPkg ? `${offeringPkg.product.priceString} — Premium'a Geç` : offeringError ? "Şu an kullanılamıyor" : "Yükleniyor..."}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* GEÇİCİ TANILAMA — sorun bulunca kaldırılacak */}
        {!!offeringErrorDetail && (
          <Text selectable style={{ color: c.danger, fontSize: 10, marginTop: 8, textAlign: "center" }}>
            Tanı: {offeringErrorDetail}
          </Text>
        )}

        {!isPremium && (
          <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreLink}>
            <Text style={styles.restoreLinkText}>{restoring ? "Kontrol ediliyor..." : "Satın Almaları Geri Yükle"}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.navigate("WeeklyQuests")} style={styles.questsLink}>
          <Text style={styles.questsLinkText}>Haftalık görevleri tamamlayarak da 3 günlük Premium kazanabilirsin →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    heroCard: { borderRadius: 22, padding: 24, alignItems: "center" },
    heroTitle: { fontFamily: "Baloo2_800ExtraBold", fontSize: 22, color: "#fff", marginTop: 10 },
    heroSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 6, textAlign: "center" },
    limitsCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      padding: 16, marginTop: 16,
    },
    limitsTitle: { fontSize: 11, fontWeight: "800", color: c.dim, letterSpacing: 0.4, marginBottom: 10 },
    limitRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
    limitLabel: { fontSize: 13, color: c.text },
    limitValue: { fontSize: 13, fontWeight: "700", color: c.text },
    referralHint: { fontSize: 11.5, color: c.dim, lineHeight: 17, marginBottom: 10 },
    benefitsCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      padding: 16, marginTop: 16, gap: 14,
    },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    benefitIconWrap: { width: 30, height: 30, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    benefitText: { flex: 1, fontSize: 12.5, color: c.text },
    purchaseBtn: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 22 },
    purchaseBtnText: { color: c.bg, fontWeight: "800", fontSize: 15 },
    restoreLink: { marginTop: 14, alignItems: "center" },
    restoreLinkText: { fontSize: 12.5, color: c.dim, fontWeight: "600" },
    questsLink: { marginTop: 16, alignItems: "center" },
    questsLinkText: { fontSize: 12, color: c.accent, fontWeight: "600", textAlign: "center" },
  });
}
