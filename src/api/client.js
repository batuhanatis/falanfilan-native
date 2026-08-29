// Web uygulamasıyla (falanfilan-app) TAMAMEN AYNI backend'e konuşur — sunucu tarafında
// hiçbir değişiklik gerekmiyor. Sadece istekleri React Native'den atıyoruz.
// ÖNEMLİ: Bu adres değiştirilmeden önce https://api.pellix.app'in gerçekten çalıştığı
// (DNS + Render custom domain kurulumu tamamlanmış) tarayıcıda doğrulanmalı — aksi halde
// uygulamanın TÜM ağ istekleri henüz hazır olmayan bir adrese gider.
export const API_BASE = "https://api.pellix.app";
export const WS_BASE = API_BASE.replace(/^http/, "ws") + "/ws";

const REQUEST_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 60000;
const AI_IMAGE_TIMEOUT_MS = 90000;

async function request(path, { method = "GET", token, body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      const timeoutErr = new Error("Bağlantı zaman aşımına uğradı.");
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Bir şeyler ters gitti.");
    if (data.limitReached) err.limitReached = true;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ChatConversationScreen metin/fotoğraf retry akışında kendi clientId'sini üretip aynı değeri
// bütün tekrar denemelerde yeniden kullanıyor. Fakat anket, film/liste paylaşımı gibi bazı
// tek-atımlık akışlar api.sendMessage'i clientId vermeden çağırabiliyor. Bu fallback sayesinde
// backend'in mevcut UNIQUE(client_id) idempotency koruması bu mesaj türlerinde de otomatik
// devreye girer. Çağıran bir clientId verdiyse ASLA değiştirmiyoruz.
function generateMessageClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// clientId'yi kendisi vermeyen tek-atımlık akışlarda (anket, film/liste paylaşımı vb.) ağ
// zaman aşımından sonra kullanıcı aynı işlemi tekrar tetiklerse YENİ bir id üretmek yine gerçek
// duplicate yaratabilirdi. Aynı chat + body + reply kombinasyonu kısa süre içinde yeniden
// denenirse aynı id'yi kullanıyoruz. Başarılı cevap gelince anahtarı hemen bırakıyoruz; dolayısıyla
// kullanıcı gerçekten aynı içeriği daha sonra yeniden göndermek isterse normal şekilde yeni
// mesaj oluşur. Normal yazı sohbeti zaten explicit clientId kullandığı için bu cache ona etki etmez.
const IMPLICIT_MESSAGE_ID_TTL_MS = 2 * 60 * 1000;
const implicitMessageIds = new Map(); // fingerprint -> { id, createdAt }

function implicitMessageFingerprint(chatId, body, replyToId) {
  return `${chatId}|${replyToId || ""}|${body || ""}`;
}

function getImplicitMessageId(chatId, body, replyToId) {
  const now = Date.now();
  for (const [key, entry] of implicitMessageIds.entries()) {
    if (now - entry.createdAt > IMPLICIT_MESSAGE_ID_TTL_MS) implicitMessageIds.delete(key);
  }
  const key = implicitMessageFingerprint(chatId, body, replyToId);
  const existing = implicitMessageIds.get(key);
  if (existing) return { key, id: existing.id };
  const id = generateMessageClientId();
  implicitMessageIds.set(key, { id, createdAt: now });
  return { key, id };
}

async function sendMessageRequest(token, chatId, body, replyToId, clientId) {
  const implicit = !clientId;
  const implicitEntry = implicit ? getImplicitMessageId(chatId, body, replyToId) : null;
  const effectiveClientId = clientId || implicitEntry.id;
  try {
    const result = await request(`/api/chats/${chatId}/messages`, {
      method: "POST",
      token,
      body: { body, replyToId: replyToId || null, clientId: effectiveClientId },
    });
    if (implicitEntry) implicitMessageIds.delete(implicitEntry.key);
    return result;
  } catch (e) {
    // Network/timeout/408/429/5xx belirsizdir: server işlemiş olabilir, aynı id retry için kalsın.
    // Kesin 4xx hatalarında server mesajı oluşturmamıştır; fingerprint'i serbest bırakabiliriz.
    if (implicitEntry && e?.status != null && e.status < 500 && e.status !== 408 && e.status !== 429) {
      implicitMessageIds.delete(implicitEntry.key);
    }
    throw e;
  }
}

// ChatConversationScreen hem mount useEffect'inde hem navigation focus listener'ında aynı anda
// loadMessages çağırabiliyor. Aynı chat için iki paralel TAM snapshot isteği hem gereksiz ağ/JSON
// işi yapıyor hem de optimistic mesajın server cevabıyla uzlaşması sırasında yarış penceresini
// büyütüyordu. Aynı token+chat için devam eden bir GET varsa ikinci çağrı aynı Promise'i paylaşır;
// istek bitince kayıt hemen temizlenir, sonraki gerçek focus yine güncel snapshot alır.
const messageSnapshotInflight = new Map();

function chatMessagesRequest(token, chatId) {
  const key = `${token}|${chatId}`;
  const existing = messageSnapshotInflight.get(key);
  if (existing) return existing;
  const pending = request(`/api/chats/${chatId}/messages`, { token }).finally(() => {
    if (messageSnapshotInflight.get(key) === pending) messageSnapshotInflight.delete(key);
  });
  messageSnapshotInflight.set(key, pending);
  return pending;
}

export const api = {
  signup: (payload) => request("/api/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  forgotPassword: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (email, code, newPassword) => request("/api/auth/reset-password", { method: "POST", body: { email, code, new_password: newPassword } }),
  googleAuth: (idToken) => request("/api/auth/google", { method: "POST", body: { idToken } }),
  googleCompleteSignup: (ticket, name, username, termsAccepted, referredByUsername) => request("/api/auth/google/complete-signup", { method: "POST", body: { ticket, name, username, termsAccepted, referredByUsername } }),
  appleAuth: (identityToken, fullName) => request("/api/auth/apple", { method: "POST", body: { identityToken, fullName } }),
  appleCompleteSignup: (ticket, name, username, termsAccepted, referredByUsername) => request("/api/auth/apple/complete-signup", { method: "POST", body: { ticket, name, username, termsAccepted, referredByUsername } }),
  phoneSendCode: (phone) => request("/api/auth/phone/send-code", { method: "POST", body: { phone } }),
  phoneVerify: (phone, code) => request("/api/auth/phone/verify", { method: "POST", body: { phone, code } }),
  phoneCompleteSignup: (ticket, name, username, termsAccepted, referredByUsername) => request("/api/auth/phone/complete-signup", { method: "POST", body: { ticket, name, username, termsAccepted, referredByUsername } }),
  me: (token) => request("/api/me", { token }),
  setTastemateVisibility: (token, visible) => request("/api/me/tastemate-visibility", { method: "PATCH", token, body: { visible } }),
  updateMe: (token, payload) => request("/api/me", { method: "PUT", token, body: payload }),
  updatePhoto: (token, payload) => request("/api/me/photo", { method: "PUT", token, body: payload, timeoutMs: UPLOAD_TIMEOUT_MS }),
  updateFavorite: (token, payload) => request("/api/me/favorite", { method: "PUT", token, body: payload }),
  updatePreferredGenres: (token, preferredGenres) => request("/api/me/preferences", { method: "PUT", token, body: { preferredGenres } }),
  updatePassword: (token, payload) => request("/api/me/password", { method: "PUT", token, body: payload }),
  deleteAccount: (token) => request("/api/me", { method: "DELETE", token }),
  onboardingComplete: (token) => request("/api/me/onboarding-complete", { method: "POST", token }),
  tutorialSeen: (token) => request("/api/me/tutorial-seen", { method: "POST", token }),
  tasteSurveySeen: (token) => request("/api/me/taste-survey-seen", { method: "POST", token }),

  watchlists: (token, movieId) => request(`/api/watchlists${movieId ? `?movieId=${movieId}` : ""}`, { token }),
  watchlistItems: (token, id) => request(`/api/watchlists/${id}/items`, { token }),
  createWatchlist: (token, name, cover) => request("/api/watchlists", { method: "POST", token, body: { name, ...(cover || {}) } }),
  updateWatchlist: (token, id, patch) => request(`/api/watchlists/${id}`, { method: "PATCH", token, body: patch }),
  aiRecommendForList: (token, id) => request(`/api/watchlists/${id}/ai-recommend`, { method: "POST", token }),
  deleteWatchlist: (token, id) => request(`/api/watchlists/${id}`, { method: "DELETE", token }),
  addToWatchlist: (token, id, movieId) => request(`/api/watchlists/${id}/items`, { method: "POST", token, body: { movie_id: movieId } }),
  removeFromWatchlist: (token, id, movieId) => request(`/api/watchlists/${id}/items/${movieId}`, { method: "DELETE", token }),
  addWatchlistCollaborator: (token, id, userId) => request(`/api/watchlists/${id}/collaborators`, { method: "POST", token, body: { userId } }),
  removeWatchlistCollaborator: (token, id, userId) => request(`/api/watchlists/${id}/collaborators/${userId}`, { method: "DELETE", token }),

  movies: (token, type, page, sort, excludeIds) => request(`/api/movies?type=${type}&page=${page}${sort ? `&sort=${sort}` : ""}${excludeIds && excludeIds.length ? `&excludeIds=${excludeIds.join(",")}` : ""}`, { token }),
  platforms: (token) => request("/api/platforms", { token }),
  trending: (token, type) => request(`/api/trending?type=${type}`, { token }),
  recommendations: (token, type = null, limit = null) => {
    const parts = [];
    if (type === "movie" || type === "tv") parts.push(`type=${type}`);
    if (Number.isFinite(Number(limit))) parts.push(`limit=${Math.floor(Number(limit))}`);
    return request(`/api/recommendations${parts.length ? `?${parts.join("&")}` : ""}`, { token });
  },
  movieById: (token, id) => request(`/api/movies/${id}`, { token }),
  search: (token, q, type) => request(`/api/search?q=${encodeURIComponent(q)}&type=${type}`, { token }),
  describe: (token, query) => request("/api/describe", { method: "POST", token, body: { query } }),
  aiTaste: (token, payload) => request("/api/ai-taste", { method: "POST", token, body: payload }),
  identifyPhoto: (token, imageBase64) => request("/api/identify-photo", { method: "POST", token, body: { image: imageBase64 }, timeoutMs: UPLOAD_TIMEOUT_MS }),
  recordInteraction: (token, movieId, action) => request("/api/interactions", { method: "POST", token, body: { movie_id: movieId, action } }),
  removeInteraction: (token, movieId, action) => request(`/api/interactions/${movieId}/${action}`, { method: "DELETE", token }),
  interactions: (token) => request("/api/interactions", { token }),
  setLikeProfileVisibility: (token, movieId, hidden) => request(`/api/me/likes/${movieId}/visibility`, { method: "PATCH", token, body: { hidden } }),

  friends: (token) => request("/api/friends", { token }),
  userSearch: (token, q) => request(`/api/users/search?q=${encodeURIComponent(q)}`, { token }),
  userProfile: (token, id) => request(`/api/users/${id}`, { token }),
  userByUsername: (token, username) => request(`/api/users/by-username/${username}`, { token }),
  allLikes: (token, id, page) => request(`/api/users/${id}/all-likes?page=${page}`, { token }),
  allDislikes: (token, page) => request(`/api/me/all-dislikes?page=${page}`, { token }),
  blend: (token, friendId) => request(`/api/blend/${friendId}`, { token }),
  friendMatchRanking: (token) => request("/api/friends/match-ranking", { token }),
  blockUser: (token, id) => request(`/api/users/${id}/block`, { method: "POST", token }),
  unblockUser: (token, id) => request(`/api/users/${id}/block`, { method: "DELETE", token }),
  blockedUsers: (token) => request("/api/me/blocked", { token }),
  reportUser: (token, id, reason, details) => request(`/api/users/${id}/report`, { method: "POST", token, body: { reason, details } }),
  friendRequest: (token, toUserId) => request("/api/friends/request", { method: "POST", token, body: { to_user_id: toUserId } }),
  friendRespond: (token, fromUserId, accept) => request("/api/friends/respond", { method: "POST", token, body: { from_user_id: fromUserId, accept } }),
  unfriend: (token, userId) => request(`/api/friends/${userId}`, { method: "DELETE", token }),

  chats: (token) => request("/api/chats", { token }),
  chatWith: (token, friendId) => request(`/api/chats/with/${friendId}`, { method: "POST", token }),
  markChatRead: (token, chatId) => request(`/api/chats/${chatId}/read`, { method: "POST", token }),
  consumePhoto: (token, messageId) => request(`/api/messages/${messageId}/consume-photo`, { method: "POST", token }),
  sendChatPhoto: (token, chatId, image, once, clientId) => request(`/api/chats/${chatId}/photo`, { method: "POST", token, body: { image, once, clientId: clientId || generateMessageClientId() }, timeoutMs: UPLOAD_TIMEOUT_MS }),
  deleteMessage: (token, messageId) => request(`/api/messages/${messageId}`, { method: "DELETE", token }),
  unsendMessage: (token, messageId) => request(`/api/messages/${messageId}/unsend`, { method: "POST", token }),
  editMessage: (token, messageId, body) => request(`/api/messages/${messageId}`, { method: "PUT", token, body: { body } }),
  votePoll: (token, messageId, optionIndex) => request(`/api/messages/${messageId}/vote`, { method: "POST", token, body: { optionIndex } }),
  acceptPlan: (token, messageId) => request(`/api/messages/${messageId}/accept-plan`, { method: "POST", token }),
  createPlan: (token, chatId, scheduledAt, note, clientId) => request(`/api/chats/${chatId}/plan`, { method: "POST", token, body: { scheduledAt, note, clientId: clientId || generateMessageClientId() } }),
  deleteChat: (token, chatId) => request(`/api/chats/${chatId}`, { method: "DELETE", token }),
  reactToMessage: (token, messageId, emoji) => request(`/api/messages/${messageId}/react`, { method: "POST", token, body: { emoji } }),
  bulkDeleteMessages: (token, messageIds) => request("/api/messages/bulk-delete", { method: "POST", token, body: { messageIds } }),
  comments: (token, movieId) => request(`/api/movies/${movieId}/comments`, { token }),
  addComment: (token, movieId, body) => request(`/api/movies/${movieId}/comments`, { method: "POST", token, body: { body } }),
  deleteComment: (token, id) => request(`/api/comments/${id}`, { method: "DELETE", token }),
  // Güvenilirlik önceliği: mevcut server delta endpoint'i yalnız yeni ID'leri döndürüyor ve
  // uygulama kapalıyken düzenlenen/reaksiyon alan eski mesajları kaçırabiliyordu. Backend'e
  // updated_at tabanlı senkron eklenene kadar focus'ta tam snapshot çekmek bu veri kaybını kapatır.
  // ChatConversation zaten ID bazında merge ettiği için görünüm veya mesaj sırası değişmez.
  messages: (token, chatId, _after) => chatMessagesRequest(token, chatId),
  sendMessage: (token, chatId, body, replyToId, clientId) => sendMessageRequest(token, chatId, body, replyToId, clientId),

  notifications: (token) => request("/api/notifications", { token }),
  markAllRead: (token) => request("/api/notifications/read-all", { method: "POST", token }),
  deleteNotification: (token, id) => request(`/api/notifications/${id}`, { method: "DELETE", token }),
  deleteAllNotifications: (token) => request("/api/notifications", { method: "DELETE", token }),
  reportError: (payload) => request("/api/report-error", { method: "POST", body: payload }).catch(() => {}),
  registerPushToken: (token, expoPushToken) => request("/api/push/register-token", { method: "POST", token, body: { expoPushToken } }),
  unregisterPushToken: (token, expoPushToken) => request("/api/push/unregister-token", { method: "DELETE", token, body: { expoPushToken } }),
  spotlight: (token) => request("/api/spotlight", { token }),
  notifyMe: (token, movieId) => request(`/api/movies/${movieId}/notify-me`, { method: "POST", token }),
  notifySubscriptions: (token) => request("/api/me/notify-subscriptions", { token }),
  movieExtra: (token, movieId) => request(`/api/movies/${movieId}/extra`, { token }),
  personCredits: (token, personId, opts) => {
    const params = [];
    if (opts?.full) params.push("full=1");
    if (opts?.role === "director") params.push("role=director");
    return request(`/api/people/${personId}${params.length ? `?${params.join("&")}` : ""}`, { token });
  },
  socialStats: (token, movieIds) => request("/api/movies/social-stats", { method: "POST", token, body: { movieIds } }),
  trackEvents: (token, events) => request("/api/analytics/events-batch", { method: "POST", token, body: { events } }),
  achievements: (token) => request("/api/achievements", { token }),
  activityFeed: (token) => request("/api/activity-feed", { token }),
  dailyQuestion: (date) => request(`/api/daily-question?date=${encodeURIComponent(date)}`),
  socialFeed: (token) => request("/api/social/feed", { token }),
  markFeedSeen: (token, ids) => request("/api/social/feed/seen", { method: "POST", token, body: { ids } }),
  socialPostById: (token, id) => request(`/api/social/posts/${id}`, { token }),
  socialActivityById: (token, id) => request(`/api/social/activities/${id}`, { token }),
  socialCreatePost: (token, payload) => request("/api/social/posts", { method: "POST", token, body: payload }),
  socialDeletePost: (token, id) => request(`/api/social/posts/${id}`, { method: "DELETE", token }),
  socialToggleLike: (token, id) => request(`/api/social/posts/${id}/like`, { method: "POST", token }),
  socialReact: (token, kind, id, reaction) => request(`/api/social/reactions/${kind}/${id}`, { method: "POST", token, body: { reaction } }),
  socialComments: (token, id) => request(`/api/social/posts/${id}/comments`, { token }),
  socialAddComment: (token, id, body) => request(`/api/social/posts/${id}/comments`, { method: "POST", token, body: { body } }),
  socialDeleteComment: (token, postId, commentId) => request(`/api/social/posts/${postId}/comments/${commentId}`, { method: "DELETE", token }),
  socialActivityComments: (token, id) => request(`/api/social/activities/${id}/comments`, { token }),
  socialAddActivityComment: (token, id, body) => request(`/api/social/activities/${id}/comments`, { method: "POST", token, body: { body } }),
  socialDeleteActivityComment: (token, activityId, commentId) => request(`/api/social/activities/${activityId}/comments/${commentId}`, { method: "DELETE", token }),
  socialVote: (token, id, movieId) => request(`/api/social/posts/${id}/vote`, { method: "POST", token, body: { movieId } }),
  socialUserPosts: (token, userId) => request(`/api/social/users/${userId}/posts`, { token }),

  tastemates: (token) => request("/api/tastemates", { token }),
  tastemateSwipe: (token) => request("/api/tastemates/swipe", { method: "POST", token }),
  tastemateSwipeV2: (token, targetUserId, direction) => request("/api/tastemates/swipe-v2", { method: "POST", token, body: { targetUserId, direction } }),
  premiumStatus: (token) => request("/api/premium/status", { token }),
  generateProfileBackground: (token) => request("/api/profile/background/generate", { method: "POST", token, timeoutMs: AI_IMAGE_TIMEOUT_MS }),
  resetProfileBackground: (token) => request("/api/profile/background/reset", { method: "POST", token }),
  updateProfileBackgroundIntensity: (token, intensity) => request("/api/me/profile-background-intensity", { method: "PATCH", token, body: { intensity } }),
  devGrantPremium: (token, days) => request("/api/premium/dev-grant", { method: "POST", token, body: { days } }),
  quests: (token) => request("/api/quests", { token }),
  claimQuestReward: (token) => request("/api/quests/claim", { method: "POST", token }),
  myReferrals: (token) => request("/api/referrals/my", { token }),

  createParty: (token, payload) => request("/api/matchparty/sessions", { method: "POST", token, body: payload }),
  respondParty: (token, id, accept) => request(`/api/matchparty/${id}/respond`, { method: "POST", token, body: { accept } }),
  getParty: (token, id) => request(`/api/matchparty/${id}`, { token }),
  swipeParty: (token, id, movieId, liked) => request(`/api/matchparty/${id}/swipe`, { method: "POST", token, body: { movie_id: movieId, liked } }),
  partyMatches: (token, id) => request(`/api/matchparty/${id}/matches`, { token }),
  endParty: (token, id) => request(`/api/matchparty/${id}/end`, { method: "POST", token }),
  extendParty: (token, id) => request(`/api/matchparty/${id}/extend`, { method: "POST", token }),
  recentPartyMatches: (token) => request("/api/matchparty/recent", { token }),
  partyStatusWithFriend: (token, friendId) => request(`/api/matchparty/status?friendId=${friendId}`, { token }),
};