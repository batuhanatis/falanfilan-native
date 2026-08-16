import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, Crown, Check, Sparkles, Users, Zap, Gift, Minus, Palette } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api, API_BASE } from "../api/client";
import { getCurrentOffering, purchasePackage, restorePurchases, hasActivePremiumEntitlement } from "../utils/purchases";

// PM1 — üç fayda artık salt limit kaldırmakla sınırlı değil, profilde görünen bir KİMLİK de
// içeriyor (altın çerçeve — bkz. ProfileScreen/OtherProfileScreen avatarPremiumRing).
const BENEFITS = [
  { icon: Sparkles, text: "Sınırsız AI önerisi (Anlat-Bulalım, Zevkine Göre Öner, Fotoğraftan Bul)" },
  { icon: Users, text: "TasteMate'te sınırsız kaydırma" },
  { icon: Crown, text: "Profilinde altın Premium çerçevesi" },
  { icon: Palette, text: "Zevkine özel, AI ile üretilen profil arka planı" },
  { icon: Zap, text: "Yeni özelliklere öncelikli erişim" },
];

// PM2 — ücretsiz/premium farkı artık iki ayrı kartı zihinde karşılaştırmaya bırakılmıyor, tek
// bir tabloda yan yana.
const COMPARISON_ROWS = [
  { label: "AI önerisi (günlük)", free: "Sınırlı", premium: "Sınırsız" },
  { label: "TasteMate kaydırma", free: "Sınırlı", premium: "Sınırsız" },
  { label: "Profil çerçevesi", free: false, premium: true },
  { label: "AI profil arka planı", free: false, premium: true },
  { label: "Yeni özelliklere öncelik", free: false, premium: true },
];

// PM4 — kullanıcı buraya BOŞ yere değil, bir limite takıldığı için geldiyse, bunu bağlama
// duyarlı bir başlıkla karşılıyoruz.
const REASON_COPY = {
  ai_limit: { title: "AI önerin bugünlük bitti", subtitle: "Premium ile Anlat-Bulalım, Zevkine Göre Öner ve Fotoğraftan Bul'u sınırsız kullan." },
  tastemate_limit: { title: "TasteMate hakkın bugünlük bitti", subtitle: "Premium ile sınırsız kaydırıp zevk uyumu yüksek kişileri keşfetmeye devam et." },
};

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
  useEffect(() => {
    getCurrentOffering()
      .then((offering) => {
        const pkg = offering?.availablePackages?.[0] || null;
        setOfferingPkg(pkg);
        // ÖNEMLİ: Ham RevenueCat hata/tanı metnini kullanıcıya HİÇBİR ZAMAN göstermiyoruz —
        // sadece konsola logluyoruz, arayüzde offeringError bayrağı üzerinden nazik bir
        // "şu an kullanılamıyor" mesajına dönüşüyor (bkz. purchaseBtnText).
        if (!pkg) {
          setOfferingError(true);
          console.warn("[Premium] offering paketi yok:", offering ? "offering var ama içinde paket yok" : "offering hiç gelmedi (current=null)");
        }
      })
      .catch((e) => { setOfferingError(true); console.warn("[Premium] offering yüklenemedi:", e.message || e); });
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
  const reasonCopy = !isPremium ? REASON_COPY[route?.params?.reason] : null;

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
          <Text style={styles.heroTitle}>{isPremium ? "Premium Aktif" : reasonCopy?.title || "pellix Premium"}</Text>
          {isPremium ? (
            <Text style={styles.heroSubtitle}>
              {new Date(status.premiumUntil).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} tarihine kadar sınırsız kullan.
            </Text>
          ) : (
            <Text style={styles.heroSubtitle}>{reasonCopy?.subtitle || "Sınırsız AI önerisi ve TasteMate — haftalık"}</Text>
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
                : "Kodunu paylaş, MatchParty'de eşleşince ikiniz de AI hakkı kazanın."}
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

        {/* PM2 — ücretsiz/premium farkını iki ayrı karttan çıkarmak yerine tek tabloda gösteriyoruz. */}
        {!isPremium && (
          <View style={styles.compareCard}>
            <View style={styles.compareHeaderRow}>
              <Text style={[styles.compareHeaderCell, { flex: 1.4, textAlign: "left" }]}> </Text>
              <Text style={styles.compareHeaderCell}>Ücretsiz</Text>
              <Text style={[styles.compareHeaderCell, { color: "#F59E0B" }]}>Premium</Text>
            </View>
            {COMPARISON_ROWS.map((row, i) => (
              <View key={i} style={[styles.compareRow, i === COMPARISON_ROWS.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={[styles.compareLabel, { flex: 1.4 }]}>{row.label}</Text>
                <View style={styles.compareCell}>
                  {typeof row.free === "boolean" ? (
                    row.free ? <Check size={14} color={c.dim} /> : <Minus size={14} color={c.dim} />
                  ) : <Text style={styles.compareCellText}>{row.free}</Text>}
                </View>
                <View style={styles.compareCell}>
                  {typeof row.premium === "boolean" ? (
                    row.premium ? <Check size={14} color="#F59E0B" /> : <Minus size={14} color={c.dim} />
                  ) : <Text style={[styles.compareCellText, { color: "#F59E0B", fontWeight: "800" }]}>{row.premium}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

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

        {!isPremium && (
          <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreLink}>
            <Text style={styles.restoreLinkText}>{restoring ? "Kontrol ediliyor..." : "Satın Almaları Geri Yükle"}</Text>
          </TouchableOpacity>
        )}

        {/* Otomatik yenilenen abonelik içeren ekranlarda Gizlilik Politikası/Kullanım
            Şartları'na satın alma noktasına yakın bir bağlantı zorunlu (App Store Guideline 3.1.2). */}
        {!isPremium && (
          <View style={styles.legalLinksRow}>
            <Text style={styles.legalLinkText} onPress={() => Linking.openURL(`${API_BASE}/privacy`)}>Gizlilik Politikası</Text>
            <Text style={styles.legalLinksDot}>·</Text>
            <Text style={styles.legalLinkText} onPress={() => Linking.openURL(`${API_BASE}/terms`)}>Kullanım Şartları</Text>
          </View>
        )}

        {/* PM3 — eskiden alt bilgide tek satırlık bir bağlantıydı, şimdi kendi kartı var. */}
        {!isPremium && (
          <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate("WeeklyQuests")} style={styles.questsCardShadow}>
            <LinearGradient colors={["#0EA5E9", "#6366F1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.questsCard}>
              <View style={styles.questsIconWrap}><Gift size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.questsCardTitle}>Ücretsiz de kazanabilirsin</Text>
                <Text style={styles.questsCardSubtitle}>Haftalık görevleri tamamla, 3 günlük Premium kazan</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
          </TouchableOpacity>
        )}
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
    legalLinksRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10 },
    legalLinkText: { fontSize: 11, color: c.dim, fontWeight: "600", textDecorationLine: "underline" },
    legalLinksDot: { fontSize: 11, color: c.dim },

    compareCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      padding: 14, marginTop: 16,
    },
    compareHeaderRow: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    compareHeaderCell: { flex: 1, fontSize: 10.5, fontWeight: "800", color: c.dim, textAlign: "center" },
    compareRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    compareLabel: { fontSize: 12, color: c.text, fontWeight: "600" },
    compareCell: { flex: 1, alignItems: "center", justifyContent: "center" },
    compareCellText: { fontSize: 11.5, color: c.dim, fontWeight: "600" },

    questsCardShadow: {
      marginTop: 16, borderRadius: 16,
      shadowColor: "#6366F1", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
    },
    questsCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14 },
    questsIconWrap: { width: 36, height: 36, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    questsCardTitle: { fontSize: 13, fontWeight: "800", color: "#fff" },
    questsCardSubtitle: { fontSize: 10.5, color: "rgba(255,255,255,0.9)", marginTop: 2, lineHeight: 14 },
  });
}
