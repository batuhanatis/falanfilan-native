import { t as translateUI } from "../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { Modal, View, TouchableOpacity, StyleSheet, ActivityIndicator, Text, Platform, TouchableWithoutFeedback, Share, Animated, useWindowDimensions } from "react-native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { X, Share2, Check, Radio } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";
import { canShareToStoryDirect, shareToStoryDirect } from "../utils/instagramStories";
import { getStoreLink } from "../utils/appLinks";
import InstagramGlyph from "./salon/InstagramGlyph";

const APP_LINK = getStoreLink("share_card");
const IG_COACH_KEY = "pellix_ig_story_coach_v1";

// Kartın (children) Instagram Story penceresi. Profil, Blend, MatchParty, oyun sonuçları ve içerik
// detayındaki Story kartı bunu kullanıyor; ShareFan'deki "Instagram" seçeneği buraya açılıyor.
//
// PR6 — `pages` (opsiyonel, React node dizisi): Profil kartı gibi BİRDEN FAZLA görsel varyantı
// olan durumlar için — ör. Premium'un AI temalı kartı VE varsayılan (temasız) kartı. Verilirse,
// karta HER DOKUNUŞ bir sonraki varyanta geçiyor (baştan sona döngü) — o an EKRANDA GÖRÜNEN
// varyant hangisiyse Story'ye o gidiyor. ÖNEMLİ (geçmiş): Bu ÖNCE yatay bir kaydırma
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
// Paylaşımlar artık link (open.pellix.app/...): link WhatsApp/iMessage'da afişli önizlemeyle gidiyor,
// dokununca uygulama açılıyor. Telefonda görsel YALNIZCA Instagram Story için üretiliyor, çünkü
// Instagram story'ye yalnızca görsel kabul ediyor; link panoya kopyalanıyor ve kişi Bağlantı
// çıkartmasıyla ekliyor. Bu pencere o Story akışı; "Linki paylaş" aynı linki metinle gönderiyor.
// Görseli galeriye kaydetme ve görseli diğer uygulamalara gönderme kaldırıldı.
export default function ShareCardModal({ onClose, children, pages, shareMessage, shareUrl = APP_LINK, socialCard, onSocialShared, previewHeight, instagramStory }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = makeStyles(c);
  // Büyük, dışa aktarılacak kartın gerçek çözünürlüğünü değiştirmeden yalnızca ekrandaki
  // önizlemesini Android'in kullanılabilir yüksekliğine sığdır.
  const storyLink = instagramStory?.link || shareUrl;
  const igMode = !!storyLink;
  const [igCoach, setIgCoach] = useState(false);
  // Kartın altındaki düğmeler (ya da Instagram anlatımı) için ayrılan yükseklik.
  const reserved = igMode ? (igCoach ? 340 : 236) : 150;
  const previewScale = previewHeight
    ? Math.min(1, Math.max(0.42, (windowHeight - insets.top - insets.bottom - reserved) / previewHeight))
    : 1;
  const previewMargin = previewHeight ? -((previewHeight * (1 - previewScale)) / 2) : 0;
  const shotRef = useRef(null);
  const [sharing, setSharing] = useState(false);
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
      const message = base.includes(shareUrl) ? base : `${base}\n${shareUrl}`;
      await Share.share({ message });
    } catch { /* kullanıcı paylaşımı iptal etmiş olabilir, sorun değil */ }
    setSharing(false);
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
      await Clipboard.setStringAsync(storyLink);
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
                  {socialSharing ? <ActivityIndicator color={c.accent} /> : (
                    <>
                      {socialShared ? <Check size={17} color={c.accent} /> : <Radio size={17} color={c.accent} />}
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
              <TouchableOpacity style={[styles.linkBtn, { marginBottom: insets.bottom }]} onPress={handleShare} disabled={sharing}>
                {sharing ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Share2 size={15} color="#fff" />
                    <Text style={styles.linkBtnText}>{translateUI("Linki paylaş (WhatsApp, Mesajlar…)")}</Text>
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
    socialBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, borderRadius: 999, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(201,164,76,0.5)" },
    socialBtnText: { color: c.accent, fontWeight: "800", fontSize: 13 },
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
