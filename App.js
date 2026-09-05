import React, { useEffect, useState } from "react";
import { View, AppState, Animated, Easing, Image, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "./src/context/ThemeContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { WSProvider } from "./src/context/WSContext";
import { UnreadProvider } from "./src/context/UnreadContext";
import { PrefetchProvider } from "./src/context/PrefetchContext";
import AuthScreen from "./src/screens/AuthScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import RootNavigator from "./src/navigation/RootNavigator";
import TutorialOverlay from "./src/components/TutorialOverlay";
import SplashIntroAnim from "./src/components/SplashIntroAnim";
import TasteSurveyStep from "./src/components/TasteSurveyStep";
import NotificationPrimerModal from "./src/components/NotificationPrimerModal";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { api } from "./src/api/client";
import { setAnalyticsToken, startSession, endSession } from "./src/utils/analytics";
import { registerForPushNotifications, getPushPermissionStatus, clearDeliveredNotifications, setupNotificationTapHandling } from "./src/utils/pushNotifications";
import { configurePurchases } from "./src/utils/purchases";
import { emitLocalEvent } from "./src/utils/localEvents";
import { navigationRef } from "./src/navigation/RootNavigator";

// React render'ının DIŞINDA kalan JS hataları (örn. bir Promise'in beklenmeyen reddi, bir
// event handler'daki hata) için global yakalayıcı — Expo Go'da native Sentry SDK'sı
// kullanamadığımız için, hatayı kendi backend'imize gönderip oradan Sentry'ye iletiyoruz.
if (typeof ErrorUtils !== "undefined") {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    api.reportError({ message: error?.message, stack: error?.stack, context: isFatal ? "fatal" : "non-fatal" });
    defaultHandler(error, isFatal);
  });
}

// İçerik/oturum kontrolü sürerken gösterilen logo — düz bir spinner yerine, hafif nabız
// animasyonuyla (büyüyüp küçülerek) markayı hissettiriyor.
function LoadingLogo() {
  const scale = React.useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.Image
      source={require("./assets/icon.png")}
      style={{ width: 110, height: 110, borderRadius: 26, transform: [{ scale }] }}
      resizeMode="contain"
    />
  );
}

const PUSH_PRIMER_DISMISSED_KEY = "push_primer_dismissed_v1";

function Gate({ fontsLoaded }) {
  const { c, mode } = useAppTheme();
  const { auth, checking, markTutorialSeen, markTasteSurveySeen } = useAuth();
  // ÖNEMLİ: Bildirim izni artık login olur olmaz bağlamsızca istenmiyor — önce KENDİ ekranımızda
  // (NotificationPrimerModal) "neden" soruyoruz, sistemin tek seferlik diyaloğunu ancak kullanıcı
  // "Bildirimleri Aç" dedikten sonra tetikliyoruz. Bu, izin (Notifications API) ve "kartı daha
  // önce kapattın mı" (AsyncStorage) durumu HESAPLANANA kadar null — o ana kadar hiçbir şey
  // göstermiyoruz, "hesaplanmadı" ile "gösterilmemeli" birbirine karışmasın diye.
  const [showPushPrimer, setShowPushPrimer] = useState(null);
  // Splash artık uygulamanın yerine render edilmiyor; tam ekran bir overlay olarak üstte duruyor.
  // Böylece font + auth kontrolü ve mümkünse gerçek ilk ekran 1.6 sn'lik intro oynarken arkada
  // hazırlanıyor. Son fade gerçekten hazır ekrana crossfade oluyor.
  const [introDone, setIntroDone] = useState(false);

  // Analitik: hangi kullanıcıya ait olduğunu bilelim, uygulama ön plana/arka plana
  // geçtiğinde oturum başlasın/bitsin (bitişte son ekran + oturum süresi kaydediliyor).
  useEffect(() => {
    setAnalyticsToken(auth?.token || null);
    if (auth?.token) {
      clearDeliveredNotifications();
      configurePurchases(auth.id); // RevenueCat'in appUserID'sini bizim kullanıcı ID'mize eşitliyor

      (async () => {
        const status = await getPushPermissionStatus();
        if (status === "granted") {
          // Zaten izin verilmiş (ör. önceki bir sürümde ya da bu ekran kurulmadan önce) —
          // kullanıcıya tekrar bir şey sormaya gerek yok, sessizce jetonu kaydet.
          registerForPushNotifications(auth.token);
          setShowPushPrimer(false);
          return;
        }
        if (status !== "undetermined") {
          // "denied" (daha önce sistem diyaloğunda reddetmiş) ya da "unsupported" (simülatör) —
          // ikisinde de kendi ekranımızı göstermenin bir anlamı yok.
          setShowPushPrimer(false);
          return;
        }
        const dismissed = await AsyncStorage.getItem(PUSH_PRIMER_DISMISSED_KEY);
        setShowPushPrimer(!dismissed);
      })();
    }
  }, [auth?.token]);

  function handleEnablePush() {
    setShowPushPrimer(false);
    registerForPushNotifications(auth.token);
  }

  function handleDismissPush() {
    setShowPushPrimer(false);
    AsyncStorage.setItem(PUSH_PRIMER_DISMISSED_KEY, "1").catch(() => {});
  }

  useEffect(() => {
    startSession();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        startSession();
        // ÖNEMLİ: Eskiden sadece giriş yapılan AN (auth.token ilk set edildiğinde) temizleniyordu
        // — uygulama zaten açık girişliyken arka plana atılıp tekrar öne getirildiğinde (auth.token
        // hiç değişmediği için) bu hiç tetiklenmiyordu, arka planda gelen bildirimler sistem
        // bildirim alanında birikmeye devam ediyordu. Artık HER ön plana geçişte temizleniyor —
        // WhatsApp/Instagram'ın yaptığı gibi.
        clearDeliveredNotifications();
      } else {
        endSession();
      }
    });
    return () => sub.remove();
  }, []);

  // Bir push bildirimine tıklanınca doğru ekrana git — hangi ekran/parametre olduğu
  // TAMAMEN backend'de (pushNavTarget) belirleniyor, burada sadece navigationRef ile
  // uyguluyoruz. Tek istisna "Detail" — o ekran tam bir film nesnesi bekliyor, bildirim
  // sadece movieId taşıdığı için önce veriyi çekmemiz gerekiyor.
  useEffect(() => {
    // ÖNEMLİ DÜZELTME: Eskiden "navigasyon hazır değilse 400ms sonra bir kez daha dene" gibi
    // SABİT, TEK SEFERLİK bir gecikme kullanılıyordu. Soğuk başlangıçta (uygulama bildirime
    // dokunularak AÇILIYORSA) font yükleme + oturum kontrolü + navigasyon kurulumu 400ms'den
    // çok daha uzun sürebiliyor — bu durumda tek deneme de sessizce başarısız oluyor ve bir
    // daha HİÇ tekrar denenmiyordu (ör. sohbet bildirimine tıklayınca sadece Sohbetler listesinde
    // kalıp asıl sohbete hiç girmeme şikayeti buradan geliyordu). Artık navigasyon GERÇEKTEN
    // hazır olana kadar (en fazla ~8 saniye, 100ms aralıklarla) bekleyip öyle deniyoruz.
    function waitForNavReady(maxWaitMs = 8000) {
      return new Promise((resolve) => {
        if (navigationRef.isReady()) { resolve(true); return; }
        const start = Date.now();
        const interval = setInterval(() => {
          if (navigationRef.isReady()) {
            clearInterval(interval);
            resolve(true);
          } else if (Date.now() - start > maxWaitMs) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
      });
    }

    async function navigateWhenReady(screen, params) {
      const ready = await waitForNavReady();
      if (ready) navigationRef.navigate(screen, params);
    }

    async function handleNavTarget(data) {
      if (!data?.screen) return;
      if (data.screen === "Detail" && data.params?.movieId) {
        try {
          const movie = await api.movieById(auth?.token, data.params.movieId);
          navigateWhenReady("Detail", { movie });
        } catch { /* film artık yoksa/çekilemezse sessizce geç */ }
        return;
      }

      // ÖNEMLİ DÜZELTME: Bir MatchParty daveti bildirimine tıklanınca doğrudan "MatchParty"
      // ekranına atlıyorduk — davet HENÜZ yanıtlanmamışken bu, o ekranın "waiting" durumunu
      // (başka bir arkadaşın kabul etmesini beklediğin ekranı) yanlışlıkla gösteriyordu, oysa
      // TIKLAYAN kişi aslında davet EDİLEN taraf ve önce Kabul Et/Reddet seçmesi gerekiyor.
      // Backend (server.js: createNotification) push verisine "type" alanını da ekliyor — bu
      // sayede ekrana hiç gitmeden, tıklanan bildirimin yanıtlanmamış bir davet mi ("party_invite")
      // yoksa zaten aktif bir oturuma dair mi (ör. "party_accepted") olduğunu ayırt edip, davetse
      // GlobalPopups'taki Kabul Et/Reddet kartını açıyoruz (WS'ten gelen canlı davetle AYNI kart).
      if (data.type === "party_invite" && data.params?.sessionId) {
        if (await waitForNavReady()) {
          emitLocalEvent({ type: "party_invite", sessionId: data.params.sessionId, fromUser: data.from });
        }
        return;
      }

      // ÖNEMLİ DÜZELTME: Bir sohbet bildirimine tıklanınca doğrudan "ChatConversation"a
      // atlıyorduk — ama Sohbetler sekmesinin kendi geçmişinde önce "Tüm Sohbetler" listesi
      // (ChatList) hiç OLUŞMAMIŞ oluyordu. Bu yüzden: (1) geri tuşuna basınca gidecek bir liste
      // katmanı olmadığı için direkt Ana Sayfa'ya çıkıyordu, (2) alt sekmeden tekrar Sohbetler'e
      // basınca, o sekmenin "korunmuş" durumu hâlâ sadece o tek sohbeti gösteriyordu, listeye
      // hiç dönemiyordun. Çözüm: önce Sohbetler sekmesini LİSTE ekranıyla kur, hemen ardından
      // (liste artık temelde dururken) sohbeti ÜSTÜNE ekle — böylece geri tuşu doğal olarak
      // listeye dönüyor, tab geçişleri de listeyi koruyor.
      // ÖNEMLİ DÜZELTME (2): İkinci navigate eskiden navigasyon hazır olsun olmasın SABİT 250ms
      // sonra deneniyordu — soğuk başlangıçta bu da geç kalıp sessizce hiçbir şey yapmıyordu,
      // kullanıcı sadece Sohbetler listesinde kalıyordu. Artık navigasyonun GERÇEKTEN hazır
      // olduğunu bekleyip (waitForNavReady), ondan SONRA iki adımı sırayla uyguluyoruz.
      const isChatTarget = data.screen === "MainTabs" && data.params?.screen === "Chat" && data.params?.params?.screen === "ChatConversation";
      if (isChatTarget) {
        if (!(await waitForNavReady())) return;
        // ÖNEMLİ DÜZELTME: Sabit 300ms bekleme cihaz hızına göre değişen, güvenilmez bir tahmindi
        // (yavaş bir cihazda ilk navigasyon henüz commit olmadan ikincisi tetiklenebiliyordu).
        // Bunun yerine navigasyon state'inin GERÇEKTEN değiştiğini dinleyip ancak o zaman ikinci
        // adımı tetikliyoruz — cihaz hızından bağımsız, deterministik.
        navigationRef.navigate("MainTabs", { screen: "Chat", params: { screen: "ChatList" } });
        const unsub = navigationRef.addListener("state", () => {
          unsub();
          navigationRef.navigate("MainTabs", data.params);
        });
        return;
      }

      navigateWhenReady(data.screen, data.params || {});
    }

    return setupNotificationTapHandling(handleNavTarget);
  }, [auth?.token]);

  const appReady = fontsLoaded && !checking;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={!introDone ? "light" : mode === "dark" ? "light" : "dark"} />

      {/* Gerçek uygulama splash'ın altında hazırlanıyor. Auth/font kontrolü introdan önce
          biterse kullanıcı fade sonunda loader değil doğrudan hazır ekranı görüyor. */}
      {appReady ? (
        <>
          {!auth ? <AuthScreen /> : !auth.onboardingCompleted ? <OnboardingScreen /> : <RootNavigator />}

          {/* Bu onboarding katmanlarını splash bitmeden mount etmiyoruz; aksi halde kendi giriş
              animasyonları görünmeden çalışmaya başlayabilir. Ana ekran/nav ise preload ediliyor. */}
          {introDone && auth?.onboardingCompleted && !auth?.tutorialSeen && (
            <TutorialOverlay onFinish={markTutorialSeen} />
          )}
          {introDone && auth?.onboardingCompleted && auth?.tutorialSeen && !auth?.tasteSurveySeen && (
            <View style={StyleSheet.absoluteFillObject}>
              <TasteSurveyStep
                title="Zevkini biraz daha tanıyalım"
                subtitle="Bu birkaç soru, önerilerini ve arkadaşlarınla uyumunu çok daha isabetli hale getiriyor."
                skipLabel="Atla"
                continueLabel="Tamamla"
                onSkip={markTasteSurveySeen}
                onContinue={markTasteSurveySeen}
              />
            </View>
          )}
          {introDone && auth?.onboardingCompleted && auth?.tutorialSeen && auth?.tasteSurveySeen && showPushPrimer && (
            <NotificationPrimerModal onEnable={handleEnablePush} onDismiss={handleDismissPush} />
          )}
        </>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
          <LoadingLogo />
        </View>
      )}

      {/* OTA-güncellenebilir JS splash. Absolute overlay olduğu için uygulamanın yüklenmesini
          bloklamıyor ve kendi son opacity animasyonunda alttaki gerçek ekrana crossfade oluyor. */}
      {!introDone && <SplashIntroAnim onFinish={() => setIntroDone(true)} />}
    </View>
  );
}

export default function App() {
  // "pellix" markasının her yerde kullandığı eğlenceli, yuvarlak font (Baloo 2) — logo,
  // giriş ekranı gibi marka gösterimlerinde kullanılıyor. Splash artık font yüklenmesini
  // beklemiyor; Gate fontlar hazır olana kadar gerçek ekranı altta LoadingLogo ile tutuyor.
  const [fontsLoaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold });

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <WSProvider>
                <UnreadProvider>
                  <PrefetchProvider>
                    <Gate fontsLoaded={fontsLoaded} />
                  </PrefetchProvider>
                </UnreadProvider>
              </WSProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}