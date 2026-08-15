import React, { useRef, useState } from "react";
import { Modal, View, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Platform, TouchableWithoutFeedback, Share, Animated, useWindowDimensions } from "react-native";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import { X, Share2, Download, Check, Radio } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";

const APP_LINK = "https://www.pellix.app";

// Herhangi bir kartı (children olarak verilen görsel içerik) ekran görüntüsüne çevirip
// paylaşan/kaydeden genel amaçlı modal. Blend, MatchParty ve Profil kartları bunu kullanıyor.
//
// NOT: "Instagram Story'de Paylaş" butonu (doğrudan Instagram Stories'e geçiş) kaldırıldı —
// güvenilir şekilde çalıştırılamadı (Expo'nun sunduğu araçlarla Instagram'ın panosuna gerekli
// özel formatta yazmak/algılatmak tutarlı sonuç vermedi). "Diğer Uygulamalarla Paylaş" (gerçek
// link+metin paylaşımı) hâlâ duruyor, WhatsApp/Mesajlar/Instagram'ın kendi genel paylaşım
// menüsü üzerinden çalışıyor.
//
// PR6 — `pages` (opsiyonel, React node dizisi): Profil kartı gibi BİRDEN FAZLA görsel varyantı
// olan durumlar için — ör. Premium'un AI temalı kartı VE varsayılan (temasız) kartı. Verilirse,
// karta HER DOKUNUŞ bir sonraki varyanta geçiyor (baştan sona döngü) — o an EKRANDA GÖRÜNEN
// varyant hangisiyse Kaydet/Paylaş onu yakalıyor. ÖNEMLİ (geçmiş): Bu ÖNCE yatay bir kaydırma
// jestiydi (PanResponder) — ama DismissableSheet'in "aşağı çekince kapat" jestiyle SÜREKLİ
// çakıştı (handleOnly ve hatta DismissableSheet'i tamamen devre dışı bırakmak bile yetmedi,
// muhtemelen üstteki TouchableWithoutFeedback katmanlarıyla ilişkiliydi). Basit bir dokunuş,
// hiçbir gesture-negotiation riski taşımadığı için kesin çalışıyor — ayrıca DismissableSheet'in
// aşağı-çekerek-kapatması da artık HİÇBİR kullanımda (Blend/MatchParty/Profil) engellenmiyor.
export default function ShareCardModal({ onClose, children, pages, shareMessage, shareUrl = APP_LINK, socialCard, onSocialShared, previewHeight }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = makeStyles(c);
  // Büyük, dışa aktarılacak kartın gerçek çözünürlüğünü değiştirmeden yalnızca ekrandaki
  // önizlemesini Android'in kullanılabilir yüksekliğine sığdır.
  const previewScale = previewHeight
    ? Math.min(1, Math.max(0.58, (windowHeight - insets.top - insets.bottom - 150) / previewHeight))
    : 1;
  const previewMargin = previewHeight ? -((previewHeight * (1 - previewScale)) / 2) : 0;
  const shotRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [socialSharing, setSocialSharing] = useState(false);
  const [socialShared, setSocialShared] = useState(false);

  const items = pages && pages.length > 0 ? pages : null;
  const isMultiPage = !!(items && items.length > 1);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function cycleCard() {
    if (!isMultiPage) return;
    const nextIndex = (activeIndexRef.current + 1) % items.length;
    activeIndexRef.current = nextIndex;
    Animated.timing(fadeAnim, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setActiveIndex(nextIndex);
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }

  // ÖNEMLİ DÜZELTME: Önceki halinde bu buton expo-sharing kullanıyordu — o SADECE dosya (PNG)
  // paylaşabiliyor, metin+link birlikte paylaşamıyor. "Link olarak açılsın" isteği için, film
  // paylaşımında zaten kullandığımız YÖNTEME (React Native'in kendi Share API'si, message+url)
  // geçtik — bu, WhatsApp/Mesajlar gibi kanallarda gerçek, tıklanabilir bir link olarak açılıyor.
  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const message = shareMessage || "pellix'te profilime göz at 🎬";
      await Share.share({ message, url: shareUrl });
    } catch { /* kullanıcı paylaşımı iptal etmiş olabilir, sorun değil */ }
    setSharing(false);
  }

  async function handleSocialShare() {
    if (!socialCard || socialSharing || socialShared) return;
    setSocialSharing(true);
    try {
      await api.socialCreatePost(auth.token, { type: "card", cardPayload: socialCard });
      setSocialShared(true);
      onSocialShared?.();
    } catch { /* modal açık kalır; kullanıcı yeniden deneyebilir */ }
    setSocialSharing(false);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const uri = await shotRef.current.capture();
      const perm = Platform.OS === "ios" ? await MediaLibrary.requestPermissionsAsync(true) : { granted: true };
      if (perm.granted) {
        await MediaLibrary.saveToLibraryAsync(uri);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch { /* sessizce geç */ }
    setSaving(false);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={{}} showGrabber={false} respectBottomInset={false}>
              <TouchableWithoutFeedback onPress={cycleCard} disabled={!isMultiPage}>
                <Animated.View
                  style={{
                    opacity: fadeAnim,
                    transform: [{ scale: previewScale }],
                    marginVertical: previewMargin,
                  }}
                >
                  <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
                    {items ? items[activeIndex] : children}
                  </ViewShot>
                </Animated.View>
              </TouchableWithoutFeedback>

              {isMultiPage && (
                <>
                  <View style={styles.dotsRow}>
                    {items.map((_, i) => (
                      <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                    ))}
                  </View>
                  <Text style={styles.swipeHint}>Farklı bir görünüm için karta dokun</Text>
                </>
              )}

              {!!socialCard && (
                <TouchableOpacity style={styles.socialBtn} onPress={handleSocialShare} disabled={socialSharing || socialShared}>
                  {socialSharing ? <ActivityIndicator color="#fff" /> : (
                    <>
                      {socialShared ? <Check size={17} color="#fff" /> : <Radio size={17} color="#fff" />}
                      <Text style={styles.socialBtnText}>{socialShared ? "Sosyal akışta paylaşıldı" : "Sosyal Akışta Paylaş"}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={[styles.btnRow, { marginBottom: insets.bottom }]}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : saved ? <Check size={20} color="#fff" /> : <Download size={20} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
                  {sharing ? (
                    <ActivityIndicator color={c.bg} />
                  ) : (
                    <>
                      <Share2 size={16} color={c.bg} />
                      <Text style={styles.shareBtnText}>Diğer Uygulamalarla Paylaş</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </DismissableSheet>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
    closeBtn: { position: "absolute", top: Platform.OS === "ios" ? 56 : 30, right: 20, zIndex: 10, padding: 8 },
    dotsRow: { flexDirection: "row", gap: 6, alignSelf: "center", marginTop: 14 },
    dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.3)" },
    dotActive: { backgroundColor: "#fff", width: 16 },
    swipeHint: { color: "rgba(255,255,255,0.55)", fontSize: 11, textAlign: "center", marginTop: 8 },
    socialBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, borderRadius: 999, paddingVertical: 12, backgroundColor: "#7C3AED" },
    socialBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    btnRow: { flexDirection: "row", gap: 14, marginTop: 10, alignItems: "center" },
    saveBtn: {
      width: 46, height: 46, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center", justifyContent: "center",
    },
    shareBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.accent,
      borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13,
    },
    shareBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
  });
}
