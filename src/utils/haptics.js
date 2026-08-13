// Uygulama genelinde ortak, tek bir haptic sözlüğü — her ekranın kendi Haptics import'unu
// tekrar etmesi yerine buradan tek noktadan çağırıyoruz. Haptics bazı cihazlarda/emulatörlerde
// reddedebiliyor, bu yüzden her çağrı sessizce yutuluyor (asla bir etkileşimi bozmasın diye).
import * as Haptics from "expo-haptics";

// Küçük, sık tekrar eden dokunuşlar — chip seçimi, checkbox, oy verme.
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Daha "ağır" bir commit anı — swipe'ın eşiği geçmesi, mesaj gönderme, kart atma.
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

// Kutlama anları — rozet/görev kazanma, eşleşme, satın alma, başarılı bir "büyük" aksiyon.
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// Olumsuz/dikkat anları — beğenmeme, silme, gönderilemedi, limit doldu.
export function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

// Bir seçici/toggle içinde gezinme (segment değiştirme, tab geçişi).
export function hapticSelection() {
  Haptics.selectionAsync().catch(() => {});
}
