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

function clientIdOf(message) {
  return message?.client_id || message?._clientId || null;
}

// Savunma katmanı: normalde SQLite PRIMARY KEY aynı server id'sinin iki kez saklanmasına zaten
// izin vermez. Fakat optimistic temp mesaj (negatif id) ile onun gerçek server karşılığı
// (pozitif id) kısa bir yarış anında hafıza önbelleğine birlikte girebilir. clientId aynıysa
// bunları TEK mantıksal mesaj kabul ediyoruz ve mümkün olduğunda server-confirmed (pozitif id)
// olanı tercih ediyoruz. Böylece bayat bir prefetch cache, sohbet ilk açıldığı karede bile
// "gönderilemedi + gönderildi" şeklinde iki balon gösteremez.
function dedupeMessages(messages) {
  const out = [];
  const idIndex = new Map();
  const clientIndex = new Map();

  for (const message of messages || []) {
    if (!message) continue;
    const idKey = String(message.id);
    const clientId = clientIdOf(message);
    const clientKey = clientId ? String(clientId) : null;

    if (clientKey && clientIndex.has(clientKey)) {
      const idx = clientIndex.get(clientKey);
      const existing = out[idx];
      const existingIsServer = Number(existing?.id) > 0;
      const incomingIsServer = Number(message.id) > 0;
      if (!existingIsServer || incomingIsServer) {
        out[idx] = message;
        idIndex.delete(String(existing?.id));
        idIndex.set(idKey, idx);
      }
      continue;
    }

    if (idIndex.has(idKey)) {
      const idx = idIndex.get(idKey);
      out[idx] = message;
      if (clientKey) clientIndex.set(clientKey, idx);
      continue;
    }

    const idx = out.length;
    out.push(message);
    idIndex.set(idKey, idx);
    if (clientKey) clientIndex.set(clientKey, idx);
  }

  return out.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

export function getPrefetchedMessages(chatId) {
  const cached = prefetchCache.get(chatId);
  if (!cached) return null;
  const clean = dedupeMessages(cached);
  if (clean.length !== cached.length) prefetchCache.set(chatId, clean);
  return clean;
}

export function setPrefetchedMessages(chatId, messages) {
  prefetchCache.set(chatId, dedupeMessages(messages));
}

// ÖNEMLİ (bildirime dokunup girince "en yeni mesaj eksik" düzeltmesi): prefetchAllChats bir
// sohbeti BİR KERE önbelleğe aldıktan sonra bir daha asla güncellemiyordu (prefetchCache.has()
// hep true dönüp atlıyordu) — sohbet listesindeyken yeni bir mesaj gelip sonra o sohbete
// tıklandığında, ChatConversationScreen İLK KAREDE bu BAYAT önbellekten okuyordu, az önce
// bildirimini aldığın mesaj bir an görünmeyip sonra (gerçek senkron bitince) beliriyordu. Global
// WS dinleyicisi (bkz. UnreadContext.js) her "message" olayında bunu çağırıp önbelleği CANLI
// tutuyor — sohbet hiç önbellekte yoksa hiçbir şey yapmıyoruz (ilk açılışta zaten sıfırdan
// yüklenecek, burada icat etmeye gerek yok).
export function appendPrefetchedMessage(chatId, message) {
  const existing = prefetchCache.get(chatId);
  if (!existing) return;
  prefetchCache.set(chatId, dedupeMessages([...existing, message]));
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
        prefetchCache.set(chatId, dedupeMessages(local));
      } catch { /* bu sohbet için sorun olursa atla, diğerlerini engellemesin */ }
    }
  } catch { /* SQLite henüz hazır değilse sessizce geç, ChatConversationScreen zaten kendi yükler */ }
}