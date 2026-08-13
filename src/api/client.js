// Web uygulamasıyla (falanfilan-app) TAMAMEN AYNI backend'e konuşur — sunucu tarafında
// hiçbir değişiklik gerekmiyor. Sadece istekleri React Native'den atıyoruz.
// ÖNEMLİ: Bu adres değiştirilmeden önce https://api.pellix.app'in gerçekten çalıştığı
// (DNS + Render custom domain kurulumu tamamlanmış) tarayıcıda doğrulanmalı — aksi halde
// uygulamanın TÜM ağ istekleri henüz hazır olmayan bir adrese gider.
export const API_BASE = "https://api.pellix.app";
export const WS_BASE = API_BASE.replace(/^http/, "ws") + "/ws";

async function request(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Bir şeyler ters gitti.");
    if (data.limitReached) err.limitReached = true;
    throw err;
  }
  return data;
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
  updatePhoto: (token, payload) => request("/api/me/photo", { method: "PUT", token, body: payload }),
  updateFavorite: (token, payload) => request("/api/me/favorite", { method: "PUT", token, body: payload }),
  updatePreferredGenres: (token, preferredGenres) => request("/api/me/preferences", { method: "PUT", token, body: { preferredGenres } }),
  updatePassword: (token, payload) => request("/api/me/password", { method: "PUT", token, body: payload }),
  deleteAccount: (token) => request("/api/me", { method: "DELETE", token }),
  onboardingComplete: (token) => request("/api/me/onboarding-complete", { method: "POST", token }),
  tutorialSeen: (token) => request("/api/me/tutorial-seen", { method: "POST", token }),
  tasteSurveySeen: (token) => request("/api/me/taste-survey-seen", { method: "POST", token }),

  watchlists: (token, movieId) => request(`/api/watchlists${movieId ? `?movieId=${movieId}` : ""}`, { token }),
  watchlistItems: (token, id) => request(`/api/watchlists/${id}/items`, { token }),
  // WL1 — coverEmoji/coverColor opsiyonel, verilmezse backend null bırakır (native taraf o
  // zaman isim/id'den türetilmiş bir renge düşer).
  createWatchlist: (token, name, cover) => request("/api/watchlists", { method: "POST", token, body: { name, ...(cover || {}) } }),
  updateWatchlist: (token, id, patch) => request(`/api/watchlists/${id}`, { method: "PATCH", token, body: patch }),
  aiRecommendForList: (token, id) => request(`/api/watchlists/${id}/ai-recommend`, { method: "POST", token }),
  deleteWatchlist: (token, id) => request(`/api/watchlists/${id}`, { method: "DELETE", token }),
  addToWatchlist: (token, id, movieId) => request(`/api/watchlists/${id}/items`, { method: "POST", token, body: { movie_id: movieId } }),
  removeFromWatchlist: (token, id, movieId) => request(`/api/watchlists/${id}/items/${movieId}`, { method: "DELETE", token }),
  // WL6 — ortak düzenleyici ekleme/çıkarma (sadece sahip ekleyebilir; biri kendini çıkarıp ayrılabilir).
  addWatchlistCollaborator: (token, id, userId) => request(`/api/watchlists/${id}/collaborators`, { method: "POST", token, body: { userId } }),
  removeWatchlistCollaborator: (token, id, userId) => request(`/api/watchlists/${id}/collaborators/${userId}`, { method: "DELETE", token }),

  movies: (token, type, page, sort) => request(`/api/movies?type=${type}&page=${page}${sort ? `&sort=${sort}` : ""}`, { token }),
  platforms: (token) => request("/api/platforms", { token }),
  trending: (token, type) => request(`/api/trending?type=${type}`, { token }),
  movieById: (token, id) => request(`/api/movies/${id}`, { token }),
  search: (token, q, type) => request(`/api/search?q=${encodeURIComponent(q)}&type=${type}`, { token }),
  describe: (token, query) => request("/api/describe", { method: "POST", token, body: { query } }),
  aiTaste: (token, payload) => request("/api/ai-taste", { method: "POST", token, body: payload }), // payload: { genre, type, years }
  identifyPhoto: (token, imageBase64) => request("/api/identify-photo", { method: "POST", token, body: { image: imageBase64 } }),
  recordInteraction: (token, movieId, action) =>
    request("/api/interactions", { method: "POST", token, body: { movie_id: movieId, action } }),
  removeInteraction: (token, movieId, action) =>
    request(`/api/interactions/${movieId}/${action}`, { method: "DELETE", token }),
  interactions: (token) => request("/api/interactions", { token }),

  friends: (token) => request("/api/friends", { token }),
  userSearch: (token, q) => request(`/api/users/search?q=${encodeURIComponent(q)}`, { token }),
  userProfile: (token, id) => request(`/api/users/${id}`, { token }),
  userByUsername: (token, username) => request(`/api/users/by-username/${username}`, { token }),
  allLikes: (token, id, page) => request(`/api/users/${id}/all-likes?page=${page}`, { token }),
  allDislikes: (token, page) => request(`/api/me/all-dislikes?page=${page}`, { token }),
  blend: (token, friendId) => request(`/api/blend/${friendId}`, { token }),
  friendMatchRanking: (token) => request("/api/friends/match-ranking", { token }), // BL4
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
  sendChatPhoto: (token, chatId, image, once, clientId) => request(`/api/chats/${chatId}/photo`, { method: "POST", token, body: { image, once, clientId } }),
  deleteMessage: (token, messageId) => request(`/api/messages/${messageId}`, { method: "DELETE", token }),
  unsendMessage: (token, messageId) => request(`/api/messages/${messageId}/unsend`, { method: "POST", token }),
  editMessage: (token, messageId, body) => request(`/api/messages/${messageId}`, { method: "PUT", token, body: { body } }),
  votePoll: (token, messageId, optionIndex) => request(`/api/messages/${messageId}/vote`, { method: "POST", token, body: { optionIndex } }),
  acceptPlan: (token, messageId) => request(`/api/messages/${messageId}/accept-plan`, { method: "POST", token }),
  createPlan: (token, chatId, scheduledAt, note) => request(`/api/chats/${chatId}/plan`, { method: "POST", token, body: { scheduledAt, note } }),
  deleteChat: (token, chatId) => request(`/api/chats/${chatId}`, { method: "DELETE", token }),
  reactToMessage: (token, messageId, emoji) => request(`/api/messages/${messageId}/react`, { method: "POST", token, body: { emoji } }),
  bulkDeleteMessages: (token, messageIds) => request("/api/messages/bulk-delete", { method: "POST", token, body: { messageIds } }),
  comments: (token, movieId) => request(`/api/movies/${movieId}/comments`, { token }),
  addComment: (token, movieId, body) => request(`/api/movies/${movieId}/comments`, { method: "POST", token, body: { body } }),
  deleteComment: (token, id) => request(`/api/comments/${id}`, { method: "DELETE", token }),
  messages: (token, chatId, after) => request(`/api/chats/${chatId}/messages${after ? `?after=${after}` : ""}`, { token }),
  sendMessage: (token, chatId, body, replyToId, clientId) => request(`/api/chats/${chatId}/messages`, { method: "POST", token, body: { body, replyToId: replyToId || null, clientId } }),

  notifications: (token) => request("/api/notifications", { token }),
  markAllRead: (token) => request("/api/notifications/read-all", { method: "POST", token }),
  deleteNotification: (token, id) => request(`/api/notifications/${id}`, { method: "DELETE", token }),
  deleteAllNotifications: (token) => request("/api/notifications", { method: "DELETE", token }),
  reportError: (payload) => request("/api/report-error", { method: "POST", body: payload }).catch(() => {}),
  registerPushToken: (token, expoPushToken) => request("/api/push/register-token", { method: "POST", token, body: { expoPushToken } }),
  spotlight: (token) => request("/api/spotlight", { token }),
  notifyMe: (token, movieId) => request(`/api/movies/${movieId}/notify-me`, { method: "POST", token }),
  notifySubscriptions: (token) => request("/api/me/notify-subscriptions", { token }),
  movieExtra: (token, movieId) => request(`/api/movies/${movieId}/extra`, { token }),
  personCredits: (token, personId, opts) => request(`/api/people/${personId}${opts?.full ? "?full=1" : ""}`, { token }),
  socialStats: (token, movieIds) => request("/api/movies/social-stats", { method: "POST", token, body: { movieIds } }),
  trackEvents: (token, events) => request("/api/analytics/events-batch", { method: "POST", token, body: { events } }),
  achievements: (token) => request("/api/achievements", { token }),
  activityFeed: (token) => request("/api/activity-feed", { token }),

  tastemates: (token) => request("/api/tastemates", { token }),
  tastemateSwipe: (token) => request("/api/tastemates/swipe", { method: "POST", token }),
  premiumStatus: (token) => request("/api/premium/status", { token }),
  generateProfileBackground: (token) => request("/api/profile/background/generate", { method: "POST", token }),
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
