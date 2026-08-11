import { getLocalMessages, initChatDb } from "./chatDb";

// ÖNEMLİ (sıfır bekleme deneyimi): Sohbet ekranına girdiğinde SQLite'tan okuma yapmak bile
// (bağlantı zaten açık olsa dahi) birkaç yüz milisaniyelik bir asenkron gecikme yaratıyordu —
// React'in İLK render'ı boş state ile oluyor, veri ancak bir sonraki render'da (useEffect'in
// SQLite sorgusu bitince) geliyor, bu da o kısa "önce boş, sonra dolu" titremesine yol açıyordu.
//
// Çözüm: sohbet LİSTESİ ekranı yüklenir yüklenmez, her sohbetin mesajlarını ARKA PLANDA,
// kullanıcı daha o sohbete hiç tıklamadan, bu paylaşılan hafıza-içi Map'e önceden çekiyoruz.
// Kullanıcı bir sohbete tıkladığında, ChatConversationScreen artık SQLite'a hiç gitmeden,
// state'in İLK REACT RENDER'INDA (useState'in başlangıç değeri olarak) bu Map'ten senkron
// olarak okuyor — yani gerçekten "tıkla ve anında gör", ekstra bir async adım yok.
const prefetchCache = new Map(); // chatId -> mesaj dizisi

export function getPrefetchedMessages(chatId) {
  return prefetchCache.get(chatId) || null;
}

export function setPrefetchedMessages(chatId, messages) {
  prefetchCache.set(chatId, messages);
}

// Hesap değiştiğinde (çıkış yapılınca) çağrılıyor — bu, modül seviyesinde (React state'i
// DEĞİL) yaşayan bir önbellek olduğu için, aksi halde önceki hesabın sohbet verileri hafızada
// kalmaya devam ederdi.
export function clearPrefetchCache() {
  prefetchCache.clear();
}

// Sohbet listesindeki TÜM sohbetlerin mesajlarını arka planda, birer birer (hepsini aynı anda
// değil — telefonun SQLite'ını gereksiz yere boğmamak için) hafızaya çekiyor.
export async function prefetchAllChats(chatIds) {
  try {
    await initChatDb();
    for (const chatId of chatIds) {
      if (prefetchCache.has(chatId)) continue; // zaten önceden çekilmiş
      try {
        const local = await getLocalMessages(chatId);
        prefetchCache.set(chatId, local);
      } catch { /* bu sohbet için sorun olursa atla, diğerlerini engellemesin */ }
    }
  } catch { /* SQLite henüz hazır değilse sessizce geç, ChatConversationScreen zaten kendi yükler */ }
}
