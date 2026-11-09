import { t as translateUI } from "../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { Modal, View, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Platform, TouchableWithoutFeedback, Share, Animated, useWindowDimensions } from "react-native";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Rect, Circle } from "react-native-svg";
import { X, Share2, Download, Check, Radio, Image as ImageIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";
import { canShareToStoryDirect, shareToStoryDirect } from "../utils/instagramStories";

const APP_LINK = "https://www.pellix.app";
const IG_COACH_KEY = "pellix_ig_story_coach_v1";

// Instagram düğmesindeki sade kamera simgesi (lucide'da marka simgeleri yok).
function InstagramGlyph({ size = 17, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
      <Rect x={3} y={3} width={18} height={18} rx={5.5} />
      <Circle cx={12} cy={12} r={4.2} />
      <Circle cx={17.4} cy={6.6} r={1.1} fill={color} stroke="none" />
    </Svg>
  );
}

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
// instagramStory ({ link }): Story kartı gibi 9:16 kartlarda "Instagram Story" düğmesi. Instagram,
// uygulamaların story'ye tıklanabilir link eklemesine izin vermiyor; link panoya kopyalanıyor ve
// kullanıcı Instagram'ın Bağlantı çıkartmasına yapıştırıyor (ilk seferde üç adımlık kısa anlatım).
// Yerel modül olan sürümlerde (bkz. utils/instagramStories.js) Instagram story düzenleyicisi
// doğrudan kartla açılıyor; diğerlerinde görsel sistemin paylaşım menüsüne gidiyor.
export default function ShareCardModal({ onClose, children, pages, shareMessage, shareUrl = APP_LINK, socialCard, onSocialShared, previewHeight, instagramStory }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = makeStyles(c);
  // Büyük, dışa aktarılacak kartın gerçek çözünürlüğünü değiştirmeden yalnızca ekrandaki
  // önizlemesini Android'in kullanılabilir yüksekliğine sığdır.
  const igMode = !!instagramStory?.link;
  const [igCoach, setIgCoach] = useState(false);
  // Kartın altındaki düğmeler (ya da Instagram anlatımı) için ayrılan yükseklik.
  const reserved = igMode ? (igCoach ? 340 : 236) : 150;
  const previewScale = previewHeight
    ? Math.min(1, Math.max(0.42, (windowHeight - insets.top - insets.bottom - reserved) / previewHeight))
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
  //
  // ÖNEMLİ DÜZELTME: Link eskiden yalnızca `url` alanında gidiyordu — Android `url`'yi HİÇ
  // kullanmıyor, yani Android'den paylaşılan metinlerde link yoktu (paylaşım yeni kullanıcı
  // getiremiyordu). Link artık metnin içinde; zaten içeriyorsa tekrar eklenmiyor.
  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const base = shareMessage || "pellix'te profilime göz at 🎬";
      const message = base.includes("pellix.app") ? base : `${base}\n${shareUrl}`;
      await Share.share({ message });
    } catch { /* kullanıcı paylaşımı iptal etmiş olabilir, sorun değil */ }
    setSharing(false);
  }

  // Kartın GÖRSELİNİ paylaşım menüsüne veriyor — Instagram burada "Hikaye" seçeneğini gösteriyor,
  // WhatsApp/Telegram vb. de resim olarak alıyor. (Instagram'a doğrudan geçiş güvenilir değildi,
  // bkz. dosya başındaki not; sistemin kendi menüsü her iki platformda da çalışıyor.)
  const [imageSharing, setImageSharing] = useState(false);
  async function handleImageShare() {
    if (imageSharing) return;
    setImageSharing(true);
    try {
      const uri = await shotRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Görseli paylaş" });
      } else {
        await Share.share({ url: uri });
      }
    } catch { /* iptal edilmiş olabilir */ }
    setImageSharing(false);
  }

  const [igBusy, setIgBusy] = useState(false);
  const [igHint, setIgHint] = useState(false);
  const igCoachSeen = useRef(false);
  const [igDirect, setIgDirect] = useState(false);
  useEffect(() => {
    if (!igMode) return undefined;
    let alive = true;
    canShareToStoryDirect().then((ok) => { if (alive) setIgDirect(ok); }).catch(() => {});
    return () => { alive = false; };
  }, [igMode]);
  async function handleInstagramStory() {
    if (igBusy) return;
    if (!igCoachSeen.current) {
      const seen = await AsyncStorage.getItem(IG_COACH_KEY).catch(() => null);
      igCoachSeen.current = !!seen;
      if (!seen) { setIgCoach(true); return; }
    }
    runInstagramStory();
  }
  async function runInstagramStory() {
    setIgCoach(false);
    igCoachSeen.current = true;
    AsyncStorage.setItem(IG_COACH_KEY, "1").catch(() => {});
    setIgBusy(true);
    try {
      await Clipboard.setStringAsync(instagramStory.link);
      setIgHint(true);
      const uri = await shotRef.current.capture();
      if (igDirect && await shareToStoryDirect(uri)) return;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Instagram Story" });
      } else {
        await Share.share({ url: uri });
      }
    } catch { /* iptal edilmiş olabilir */ } finally {
      setIgBusy(false);
    }
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
                  <Text style={styles.swipeHint}>{translateUI("Farklı bir görünüm için karta dokun")}</Text>
                </>
              )}

              {!!socialCard && (
                <TouchableOpacity style={styles.socialBtn} onPress={handleSocialShare} disabled={socialSharing || socialShared}>
                  {socialSharing ? <ActivityIndicator color="#fff" /> : (
                    <>
                      {socialShared ? <Check size={17} color="#fff" /> : <Radio size={17} color="#fff" />}
                      <Text style={styles.socialBtnText}>{socialShared ? translateUI("Sosyal akışta paylaşıldı") : translateUI("Sosyal Akışta Paylaş")}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {igMode && igCoach && (
                <View style={styles.igCoach}>
                  <Text style={styles.igCoachTitle}>{translateUI("Story'ye dokunan Pellix'te bu içeriğe gitsin")}</Text>
                  {[
                    !igDirect && translateUI("Açılan menüden Instagram'ı, sonra Hikaye'yi seç."),
                    translateUI("Üstteki çıkartma simgesine dokun, BAĞLANTI'yı seç."),
                    translateUI("Link panoda: yapıştır ve story'yi paylaş."),
                  ].filter(Boolean).map((step, i) => (
                    <View key={i} style={styles.igStep}>
                      <Text style={styles.igStepNo}>{i + 1}</Text>
                      <Text style={styles.igStepText}>{step}</Text>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.igBtn} onPress={runInstagramStory} accessibilityRole="button">
                    <InstagramGlyph color={c.bg} />
                    <Text style={styles.igBtnText}>{translateUI("Tamam, Instagram'a geç")}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {igMode && !igCoach && (
                <>
                  <TouchableOpacity style={styles.igBtn} onPress={handleInstagramStory} disabled={igBusy} accessibilityRole="button">
                    {igBusy ? <ActivityIndicator color={c.bg} /> : (
                      <>
                        <InstagramGlyph color={c.bg} />
                        <Text style={styles.igBtnText}>{translateUI("Instagram Story'de paylaş")}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {igHint && <Text style={styles.igHint}>{translateUI("Link panoda · çıkartma → BAĞLANTI → yapıştır")}</Text>}
                </>
              )}

              {!igCoach && (
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} accessibilityLabel={translateUI("Galeriye kaydet")}>
                  {saving ? <ActivityIndicator color="#fff" /> : saved ? <Check size={20} color="#fff" /> : <Download size={20} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity style={igMode ? styles.shareBtnQuiet : styles.shareBtn} onPress={handleImageShare} disabled={imageSharing}>
                  {imageSharing ? (
                    <ActivityIndicator color={igMode ? "#fff" : c.bg} />
                  ) : (
                    <>
                      <ImageIcon size={16} color={igMode ? "#fff" : c.bg} />
                      <Text style={igMode ? styles.shareBtnQuietText : styles.shareBtnText}>{igMode ? translateUI("Görseli paylaş (WhatsApp…)") : translateUI("Görseli Paylaş (Story, WhatsApp…)")}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              )}
              {!igCoach && (
              <TouchableOpacity style={[styles.linkBtn, { marginBottom: insets.bottom }]} onPress={handleShare} disabled={sharing}>
                {sharing ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Share2 size={15} color="#fff" />
                    <Text style={styles.linkBtnText}>{translateUI("Metin ve link olarak paylaş")}</Text>
                  </>
                )}
              </TouchableOpacity>
              )}
              {igCoach && (
                <TouchableOpacity style={[styles.igCancel, { marginBottom: insets.bottom }]} onPress={() => setIgCoach(false)}>
                  <Text style={styles.igCancelText}>{translateUI("Vazgeç")}</Text>
                </TouchableOpacity>
              )}
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
    shareBtnQuiet: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: "rgba(255,255,255,0.15)",
    },
    shareBtnQuietText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    igBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16,
      borderRadius: 999, paddingVertical: 14, backgroundColor: c.accent,
    },
    igBtnText: { color: c.bg, fontWeight: "900", fontSize: 14 },
    igHint: { color: "rgba(255,255,255,0.62)", fontSize: 11.5, textAlign: "center", marginTop: 8 },
    igCoach: { marginTop: 16, borderRadius: 18, padding: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
    igCoachTitle: { color: "#fff", fontWeight: "800", fontSize: 14, marginBottom: 10 },
    igStep: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 8 },
    igStepNo: { width: 20, height: 20, borderRadius: 10, overflow: "hidden", textAlign: "center", lineHeight: 20, fontSize: 11, fontWeight: "900", color: c.bg, backgroundColor: c.accent },
    igStepText: { flex: 1, color: "rgba(255,255,255,0.86)", fontSize: 13, lineHeight: 19 },
    igCancel: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
    igCancelText: { color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 13 },
    linkBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10,
      borderRadius: 999, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
    },
    linkBtnText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
  });
}
