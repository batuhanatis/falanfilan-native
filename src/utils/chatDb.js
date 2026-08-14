import * as SQLite from "expo-sqlite";

// ÖNEMLİ MİMARİ NOT: Mesajları normalize edilmiş sütunlara (sender_id, body, reply_to_id, ayrı
// ayrı...) BÖLMÜYORUZ — bunun yerine, uygulamanın zaten her yerde kullandığı TAM mesaj nesnesini
// JSON olarak tek bir "data" sütununda saklıyoruz. Bunun sebebi: backend'deki mesaj şekli
// (reaksiyonlar, anket, izleme planı, düzenleme geçmişi vb.) zaman içinde değişebiliyor — her
// alanı SQLite şemasında ayrı ayrı yansıtmaya çalışmak, her küçük değişiklikte kırılgan bir
// migrasyon zinciri gerektirirdi. JSON olarak saklamak, backend'in döndürdüğü HER ŞEYİ otomatik
// olarak koruyor, sadece sıralama/arama için gereken (id, chat_id, created_at) sütunları ayrı.
let dbPromise = null;

function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync("pellix_chat.db");
  return dbPromise;
}

// Bir optimistic mesajın sunucudaki gerçek karşılığını bulabilmek için, o sohbet içinde henüz
// server ID'sine dönüşmemiş mesajları clientId ile hafızada tutuyoruz. Burada özellikle MESAJ
// NESNESİNİN referansını da saklıyoruz: ChatConversationScreen aynı nesneyi state'e koyduğu için
// server snapshot'ı geldiğinde Object.assign ile bu nesneyi gerçek mesaj haline getirip, hemen
// arkasından çalışan state merge'inin temp + real diye iki balon üretmesini engelleyebiliyoruz.
// Bu registry yalnız süreç içi bir hızlandırıcı; uygulama kapanıp açılırsa getLocalMessages()
// SQLite'taki negatif ID'li kayıtları okuyup yeniden kuruyor.
const pendingByChat = new Map(); // chatId -> Map<clientId, { tempId, message }>

function chatKey(chatId) {
  return String(chatId);
}

function pendingMapFor(chatId, create = false) {
  const key = chatKey(chatId);
  let map = pendingByChat.get(key);
  if (!map && create) {
    map = new Map();
    pendingByChat.set(key, map);
  }
  return map || null;
}

function registerPending(chatId, message) {
  if (!message || Number(message.id) >= 0 || !message._clientId) return;
  pendingMapFor(chatId, true).set(String(message._clientId), {
    tempId: Number(message.id),
    message,
  });
}

function clearPending(chatId, clientId) {
  if (!clientId) return;
  const key = chatKey(chatId);
  const map = pendingByChat.get(key);
  if (!map) return;
  map.delete(String(clientId));
  if (map.size === 0) pendingByChat.delete(key);
}

function stripLocalDeliveryFields(message) {
  delete message._status;
  delete message._retryCount;
  delete message._autoRetryStopped;
  delete message._clientId;
  return message;
}

// ÖNEMLİ DÜZELTME: Eskiden initChatDb() ve mesaj okuma/yazma fonksiyonları AYRI AYRI, PARALEL
// tetikleniyordu (ikisi de ekran açılışında, farklı useEffect'lerde) — tablo henüz oluşmadan
// bir okuma denemesi yapılırsa SESSİZCE başarısız oluyordu (try/catch bunu yutuyordu), bu da
// "yerelden hiç veri gelmiyor, hep ağdan bekleniyor" hissine yol açıyordu. Artık şema
// başlatmasını BİR KERE çalışacak şekilde önbelleğe alıyoruz ve HER fonksiyon (okuma/yazma fark
// etmeksizin) önce bunun bittiğinden emin oluyor — çağıran tarafın doğru sırayı tutturmasına
// bel bağlamıyoruz, bu artık otomatik garanti ediliyor.
let initPromise = null;

function ensureInit() {
  if (!initPromise) {
    initPromise = getDb().then((db) =>
      db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY,
          chat_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);
        CREATE TABLE IF NOT EXISTS chat_sync (
          chat_id INTEGER PRIMARY KEY,
          last_message_id INTEGER
        );
      `)
    );
  }
  return initPromise;
}

export async function initChatDb() {
  await ensureInit();
}

// Bir sohbetin YEREL DEPODAKİ (önceden indirilmiş) mesajlarını, oluşturulma sırasına göre döndürür.
export async function getLocalMessages(chatId) {
  await ensureInit();
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT data FROM messages WHERE chat_id = ? ORDER BY created_at ASC`,
    [chatId]
  );
  const messages = rows.map((r) => JSON.parse(r.data));

  // Ekran/app kapanınca çalışan HTTP isteğinin callback'i artık garanti edilemez. Bu yüzden
  // SQLite'ta "sending" kalmış negatif mesajı yeniden açılışta tekrar denenebilir "failed"
  // durumuna çeviriyoruz. clientId aynı kaldığı için, ilk istek aslında server'a ulaşmış olsa
  // bile retry ikinci bir DB kaydı oluşturmaz; server mevcut mesajı geri verir.
  for (const message of messages) {
    if (Number(message.id) < 0 && message._clientId) {
      if (message._status === "sending") {
        message._status = "failed";
        message._autoRetryStopped = false;
      }
      registerPending(chatId, message);
    }
  }
  return messages;
}

// Sunucudan gelen bir grup mesajı yerel depoya yazar (INSERT ya da güncelleme — mesaj
// düzenlenmiş/reaksiyon almış olabilir, id zaten varsa üzerine yazıyoruz). Ayrıca senkron
// durumunu (en son bilinen mesaj ID'si) güncelliyor ki bir dahaki "after" sorgusu doğru yerden devam etsin.
export async function saveMessages(chatId, messages) {
  if (!messages || messages.length === 0) return;

  // ÇİFT MESAJ DÜZELTMESİ — bu blok BİLEREK ilk await'ten önce çalışıyor.
  // ChatConversationScreen şu sırayı izliyor:
  //   saveMessages(chatId, fresh).catch(...);
  //   setMessages(prev => merge(prev, fresh));
  // Dolayısıyla burada `fresh` dizisini senkron olarak uzlaştırırsak, hemen sonraki merge artık
  // aynı mantıksal mesajı temp ID + server ID olarak iki kez göremez.
  //
  // Server'ın client_id'si, local optimistic mesajın _clientId'si ile eşleşiyorsa:
  // 1) State'te zaten bulunan temp mesaj NESNESİNİ gerçek server mesajına yerinde dönüştürüyoruz.
  // 2) Server mesajını `fresh` dizisinden çıkarıyoruz; merge aynı mesajı ikinci kez eklemiyor.
  // 3) SQLite transaction'ında negatif temp satırını silip pozitif gerçek satırı yazıyoruz.
  const sourceMessages = messages.slice();

  // `messages_read` gibi bulk state güncellemeleri pending mesajı `{ ...m }` ile kopyalayabilir.
  // Registry eski nesne referansına bakarsa sonraki server snapshot'ı ekrandaki güncel temp balonu
  // yerinde dönüştüremez. Bu nedenle saveMessages'e gelen gruptaki negatif optimistic kayıtları
  // ilk iş yeniden register ediyoruz; server-only snapshotlarda bu döngü doğal olarak no-op.
  for (const candidate of sourceMessages) registerPending(chatId, candidate);

  const pending = pendingMapFor(chatId, false);
  const reconciledTempIds = [];

  if (pending && pending.size > 0) {
    const visibleFresh = [];
    for (const serverMessage of messages) {
      const serverClientId = serverMessage?.client_id || serverMessage?.clientId;
      const entry = serverClientId ? pending.get(String(serverClientId)) : null;
      if (!entry || Number(serverMessage?.id) <= 0) {
        visibleFresh.push(serverMessage);
        continue;
      }

      reconciledTempIds.push(entry.tempId);
      // Aynı nesne referansı ChatConversation state'inde de kullanılıyor. Önce local-only
      // alanları temizle, sonra server'ın doğruluk kaynağı olan tam mesajını üzerine yaz.
      stripLocalDeliveryFields(entry.message);
      Object.assign(entry.message, serverMessage);
      pending.delete(String(serverClientId));
      // serverMessage'ı visibleFresh'e EKLEME: state'teki entry.message artık zaten bu mesaj.
    }
    messages.splice(0, messages.length, ...visibleFresh);
    if (pending.size === 0) pendingByChat.delete(chatKey(chatId));
  }

  // saveMessages yalnız server snapshot'ında değil, "messages_read" gibi nadir bulk local
  // güncellemelerde de çağrılıyor. Böyle bir dizide temp ve real aynı anda bulunmuşsa, yukarıda
  // uzlaştırdığımız negatif temp kaydı sourceMessages içinde kalmış olabilir. Transaction'da
  // önce silip sonra yanlışlıkla tekrar INSERT etmemek için sadece o uzlaştırılmış temp ID'leri
  // persistence grubundan çıkarıyoruz; eşleşmemiş gerçek pending mesajlar korunmaya devam eder.
  const reconciledSet = new Set(reconciledTempIds.map(Number));
  const messagesToPersist = sourceMessages.filter((m) => !reconciledSet.has(Number(m.id)));

  await ensureInit();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (reconciledTempIds.length > 0) {
      const placeholders = reconciledTempIds.map(() => "?").join(",");
      await db.runAsync(
        `DELETE FROM messages WHERE chat_id = ? AND id IN (${placeholders})`,
        [chatId, ...reconciledTempIds]
      );
    }

    for (const m of messagesToPersist) {
      await db.runAsync(
        `INSERT INTO messages (id, chat_id, created_at, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
        [m.id, chatId, m.created_at, JSON.stringify(m)]
      );
    }
    const positiveIds = messagesToPersist.map((m) => Number(m.id)).filter((id) => Number.isFinite(id) && id > 0);
    if (positiveIds.length > 0) {
      const maxId = Math.max(...positiveIds);
      await db.runAsync(
        `INSERT INTO chat_sync (chat_id, last_message_id) VALUES (?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET last_message_id = MAX(chat_sync.last_message_id, excluded.last_message_id)`,
        [chatId, maxId]
      );
    }
  });
}

// Tek bir mesajı güncelliyor (düzenleme, reaksiyon, okundu bilgisi gibi WS üzerinden CANLI gelen
// değişiklikler için) — yeni bir mesaj değil, VAR OLAN birinin içeriğini tazeliyor.
export async function updateLocalMessage(chatId, message) {
  // Optimistic kayıt state'e konduğu anda aynı nesne referansını registry'ye al. Böylece ekran
  // açıkken focus senkronu ile POST cevabı yarışsa bile clientId üzerinden tek mesaja uzlaşır.
  registerPending(chatId, message);

  await ensureInit();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO messages (id, chat_id, created_at, data) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    [message.id, chatId, message.created_at, JSON.stringify(message)]
  );
}

// ÖNEMLİ (mesajların çiftlenmesini önleyen asıl düzeltme): Bir mesaj iyimser (geçici, negatif
// ID'li) bir kayıt olarak eklenip sunucu onayından sonra GERÇEK ID'siyle değiştirildiğinde, eski
// yöntem "sil" (deleteLocalMessages) ile "yaz" (saveMessages/updateLocalMessage) işlemlerini İKİ
// AYRI, birbirinden habersiz async çağrı olarak yapıyordu. Bu ikisi arasında bir sıra garantisi
// yoktu — sohbet geçmişi uzunsa, geçici mesajı da İÇEREN önceki bir "tüm listeyi yaz" işlemi hâlâ
// sürüyorken (yüzlerce satırlık bir INSERT döngüsü) "sil" işlemi çoktan bitmiş olabiliyordu; o
// yavaş "yaz" işlemi sonunda geçici satırı YENİDEN yazınca, silinen kayıt "hayalet" olarak geri
// diriliyordu — sohbetten çıkıp geri girince (ya da uygulama yeniden başlayınca) bu hayalet,
// gerçek mesajın YANINDA ikinci bir balon olarak beliriyordu. Bu fonksiyon, silme+yazmayı TEK bir
// transaction'da, atomik olarak yapıyor — böyle bir yarışın oluşması artık mümkün değil.
export async function replaceLocalMessage(chatId, oldId, newMessage) {
  // Başarılı POST cevabı normal yoldan geldiyse pending registry'yi burada da temizle.
  // Server snapshot'ı önce davranıp uzlaştırdıysa bu no-op olur.
  const oldPending = pendingMapFor(chatId, false);
  if (oldPending) {
    for (const [clientId, entry] of oldPending.entries()) {
      if (Number(entry.tempId) === Number(oldId)) {
        clearPending(chatId, clientId);
        break;
      }
    }
  }

  await ensureInit();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM messages WHERE chat_id = ? AND id = ?`, [chatId, oldId]);
    await db.runAsync(
      `INSERT INTO messages (id, chat_id, created_at, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
      [newMessage.id, chatId, newMessage.created_at, JSON.stringify(newMessage)]
    );
    await db.runAsync(
      `INSERT INTO chat_sync (chat_id, last_message_id) VALUES (?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET last_message_id = MAX(chat_sync.last_message_id, excluded.last_message_id)`,
      [chatId, newMessage.id]
    );
  });
}

export async function deleteLocalMessages(chatId, messageIds) {
  if (!messageIds || messageIds.length === 0) return;

  // Silinen temp mesajların registry kaydını da kaldır; aksi halde daha sonraki bir snapshot'ta
  // artık ekranda olmayan eski bir nesneyi yanlışlıkla uzlaştırabiliriz.
  const pending = pendingMapFor(chatId, false);
  if (pending) {
    const ids = new Set(messageIds.map(Number));
    for (const [clientId, entry] of [...pending.entries()]) {
      if (ids.has(Number(entry.tempId))) pending.delete(clientId);
    }
    if (pending.size === 0) pendingByChat.delete(chatKey(chatId));
  }

  await ensureInit();
  const db = await getDb();
  const placeholders = messageIds.map(() => "?").join(",");
  await db.runAsync(`DELETE FROM messages WHERE chat_id = ? AND id IN (${placeholders})`, [chatId, ...messageIds]);
}

// En son bilinen mesaj ID'sini döndürür — "after" parametresiyle sunucudan sadece FARKI
// (delta) çekebilmek için. Hiç yerel veri yoksa null döner (o zaman tam geçmiş çekilir).
export async function getLastSyncedMessageId(chatId) {
  await ensureInit();
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT last_message_id FROM chat_sync WHERE chat_id = ?`, [chatId]);
  return row?.last_message_id || null;
}

// ÖNEMLİ (privacy — hesap değiştirme sızıntısı düzeltmesi): Bu tablolarda user_id/account
// namespace'i yok — cihazdaki TEK bir sohbet geçmişi olarak tutuluyorlar. Aynı cihazda A
// hesabından çıkıp B hesabıyla girildiğinde, B'nin sohbet ekranı ağ isteği tamamlanana kadar
// A'nın yerel mesajlarını gösterebiliyordu. Logout sırasında çağrılıp tüm yerel geçmişi siliyor.
export async function clearAllLocalMessages() {
  pendingByChat.clear();
  await ensureInit();
  const db = await getDb();
  await db.execAsync(`DELETE FROM messages; DELETE FROM chat_sync;`);
}