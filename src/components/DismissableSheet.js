import React, { useRef } from "react";
import { Animated, PanResponder, View, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

// ÖNEMLİ: Uygulamadaki TÜM popup/alt sayfa (arkadaş ekleme, bildirimler, MatchParty daveti,
// listeye ekleme vb.) için ORTAK, yeniden kullanılabilir bir "parmakla sürükleyerek kapatma"
// kaplaması. Var olan her modal'ın kendi "sheet" View'ını (arka plan rengi, köşe yuvarlaklığı,
// padding'i vs. AYNEN korunuyor) bunun İÇİNE alıyoruz — bu bileşen sadece parmak hareketini
// takip eden bir transform ve üstte tutamaç (grabber) ekliyor, görsel tasarıma karışmıyor.
//
// Davranış: Parmağın hareketi BİREBİR takip ediliyor (aşağı çekince sheet aşağı iniyor, yukarı
// iterse geri yukarı çıkıyor — WhatsApp/Instagram'daki gibi). Parmak bırakılınca: yeterince
// aşağı çekilmişse (eşik) YA DA hızlı bir "fırlatma" hareketiyse kapanıyor; değilse yumuşak bir
// yay animasyonuyla eski konumuna geri dönüyor.
//
// "direction" — çoğu popup ALTTAN açılıyor, bu yüzden kapatma yönü de AŞAĞI ("down", varsayılan).
// Ama ekranın ÜSTÜNDEN açılan paneller (ör. Bildirimler) için kapatma yönü YUKARI olmalı — bu
// durumda direction="up" veriliyor, tüm işaretler ters çevriliyor.
//
// NOT: Aynı klasördeki DraggableSheet.js'ten KASITLI olarak farklı bir bileşen — o, açılır/
// kapanır bir PANEL (peek/expanded yükseklik) için; bu ise herhangi bir modal'ı "çekince kapat"
// davranışıyla sarmalamak için. İsim çakışmasını önlemek için farklı adlandırıldı.
//
// "handleOnly" — varsayılan davranışta (false) sürükleme jesti SHEET'İN HER YERİNDEN
// başlatılabiliyor. İçinde kaydırılabilir bir liste/ScrollView olan popup'larda bu, o içeriği
// kaydırmaya çalışan her dokunuşu sheet'i kapatma jestiyle karıştırıyordu (ör. bir filtre
// panelini kaydırmaya çalışırken popup yanlışlıkla kapanması). handleOnly=true verilince
// PanResponder SHEET GÖVDESİNE hiç bağlanmıyor — SADECE üstteki (ya da direction="up" için
// alttaki) tutamaca bağlanıyor, o da interaktif hale geliyor. Geri kalan içerik (liste, ScrollView
// vb.) kendi kaydırma/dokunma davranışını serbestçe kullanabiliyor. Bu, "style" prop'unu
// DOĞRUDAN görünür sheet kutusuna uygulayan tüketiciler için işliyor — yerleşik tutamaç zaten o
// kutunun İÇİNDE render edildiği için handleOnly eklemek tek satırlık bir değişiklik.
export default function DismissableSheet({ onClose, style, children, dismissThreshold = 120, direction = "down", showGrabber = true, handleOnly = false }) {
  const { c } = useAppTheme();
  const sign = direction === "up" ? -1 : 1;
  const translateY = useRef(new Animated.Value(0)).current;
  // ÖNEMLİ: "şu an nerede olduğumuzu" ayrıca bir ref'te de senkron takip ediyoruz, jest
  // başlangıcında sıfırdan değil KALDIĞI yerden devam etsin diye (Animated'ın kendi iç değeri
  // her an senkron okunamayabiliyor).
  const lastOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      // Sadece DİKEY, belirgin bir hareket varsa jesti biz alalım — yatay kaydırmalı iç
      // bileşenlerle (ör. yatay bir liste, ya da bir TextInput'un imleç hareketi) çakışmasın diye.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        translateY.setOffset(lastOffset.current);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        // "Kapanış yönü"nün TERSİNE çok fazla gitmesin — sheet'in sınırdan çıkıp tuhaf
        // durmasını engelliyoruz, hafif bir "direnç" ile sınırlıyoruz.
        const raw = g.dy * sign; // kapanış yönünde pozitif olacak şekilde normalize ediyoruz
        const dy = raw < 0 ? raw * 0.35 : raw;
        translateY.setValue(dy * sign);
      },
      onPanResponderRelease: (_, g) => {
        translateY.flattenOffset();
        const raw = g.dy * sign;
        const dyRaw = g.vy * sign;
        const shouldDismiss = raw > dismissThreshold || dyRaw > 1.2;
        if (shouldDismiss) {
          Animated.timing(translateY, {
            toValue: 900 * sign, duration: 220, useNativeDriver: true,
          }).start(() => onClose && onClose());
        } else {
          lastOffset.current = 0;
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const bodyHandlers = handleOnly ? {} : panResponder.panHandlers;
  const grabberHandlers = handleOnly ? panResponder.panHandlers : {};
  const grabberHitSlop = { top: 10, bottom: 10, left: 30, right: 30 };

  return (
    <Animated.View
      style={[style, { transform: [{ translateY }] }]}
      {...bodyHandlers}
    >
      {showGrabber && direction === "down" && (
        <View style={styles.grabberWrap} {...grabberHandlers} pointerEvents={handleOnly ? "auto" : "none"} hitSlop={handleOnly ? grabberHitSlop : undefined}>
          <View style={[styles.grabber, { backgroundColor: c.dim }]} />
        </View>
      )}
      {children}
      {showGrabber && direction === "up" && (
        <View style={styles.grabberWrap} {...grabberHandlers} pointerEvents={handleOnly ? "auto" : "none"} hitSlop={handleOnly ? grabberHitSlop : undefined}>
          <View style={[styles.grabber, { backgroundColor: c.dim }]} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grabberWrap: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  grabber: { width: 40, height: 4, borderRadius: 999, opacity: 0.4 },
});
