import * as SQLite from "expo-sqlite";

// ÖNEMLİ: Mesajlardaki (chatDb.js) gibi bir "fark" (delta) kavramı burada yok — backend'in
// /api/chats uç noktası her seferinde TÜM listeyi (son mesaj önizlemesi, okunmamış sayısı dahil)
// döndürüyor, artımlı çekim desteklemiyor. Bu yüzden burada model daha basit: TÜM listeyi tek
// bir JSON olarak saklıyoruz — önce yerelden ANINDA gösterip, arka planda taze listeyi çekip
// hem ekranı hem yerel depoyu güncelliyoruz.
let dbPromise = null;

function getDb() {
  // Ayrı bir dosya kullanıyoruz (chatDb.js'in "pellix_chat.db"sinden farklı) — iki modülün
  // birbirinden bağımsız, karışmadan çalışması için.
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync("pellix_chatlist.db");
  return dbPromise;
}

let initPromise = null;

function ensureInit() {
  if (!initPromise) {
    initPromise = getDb().then((db) =>
      db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS chat_list_cache (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL
        );
      `)
    );
  }
  return initPromise;
}

// Yerelde önceden kaydedilmiş sohbet listesini döndürür — hiç yoksa null (ilk kurulum).
export async function getLocalChatList() {
  await ensureInit();
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT data FROM chat_list_cache WHERE id = 1`);
  return row ? JSON.parse(row.data) : null;
}

// ÖNEMLİ (mümkün olan en erken başlangıç): Bu modül import edildiği AN (bir React bileşeninin
// mount olmasını beklemeden) SQLite okumasını hemen başlatıyoruz — App.js'in en tepesinde,
// AuthProvider/UnreadProvider daha ilk render'ını bile yapmadan bu iş zaten arka planda
// başlamış oluyor. UnreadContext, kendi ilk render'ında bu değerin çözülüp çözülmediğini
// SENKRON olarak kontrol ediyor — çözülmüşse (SQLite bir modül-yükleme süresi kadar hızlı
// olduğu için genelde çözülmüş oluyor) sıfır gecikmeyle kullanabiliyor.
export let eagerChatListResult = null;
export const eagerChatListPromise = getLocalChatList()
  .then((data) => { eagerChatListResult = data; return data; })
  .catch(() => null);

// Sunucudan taze gelen TÜM listeyi yerel depoya yazar (üzerine yazma — burada "fark" birleştirme
// gerekmiyor, backend zaten her seferinde tam ve güncel listeyi veriyor).
export async function saveChatList(chats) {
  await ensureInit();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO chat_list_cache (id, data) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    [JSON.stringify(chats || [])]
  );
}
