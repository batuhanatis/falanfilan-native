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
  return rows.map((r) => JSON.parse(r.data));
}

// Sunucudan gelen bir grup mesajı yerel depoya yazar (INSERT ya da güncelleme — mesaj
// düzenlenmiş/reaksiyon almış olabilir, id zaten varsa üzerine yazıyoruz). Ayrıca senkron
// durumunu (en son bilinen mesaj ID'si) güncelliyor ki bir dahaki "after" sorgusu doğru yerden devam etsin.
export async function saveMessages(chatId, messages) {
  if (!messages || messages.length === 0) return;
  await ensureInit();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const m of messages) {
      await db.runAsync(
        `INSERT INTO messages (id, chat_id, created_at, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
        [m.id, chatId, m.created_at, JSON.stringify(m)]
      );
    }
    const maxId = Math.max(...messages.map((m) => m.id));
    await db.runAsync(
      `INSERT INTO chat_sync (chat_id, last_message_id) VALUES (?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET last_message_id = MAX(chat_sync.last_message_id, excluded.last_message_id)`,
      [chatId, maxId]
    );
  });
}

// Tek bir mesajı güncelliyor (düzenleme, reaksiyon, okundu bilgisi gibi WS üzerinden CANLI gelen
// değişiklikler için) — yeni bir mesaj değil, VAR OLAN birinin içeriğini tazeliyor.
export async function updateLocalMessage(chatId, message) {
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
  await ensureInit();
  const db = await getDb();
  await db.execAsync(`DELETE FROM messages; DELETE FROM chat_sync;`);
}
