// Web uygulamasıyla (falanfilan-app) TAMAMEN AYNI backend'e konuşur — sunucu tarafında
// hiçbir değişiklik gerekmiyor. Sadece istekleri React Native'den atıyoruz.
export const API_BASE = "https://falanfilan-api.onrender.com";
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
  if (!res.ok) throw new Error(data.error || "Bir şeyler ters gitti.");
  return data;
}

export const api = {
  signup: (payload) => request("/api/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  me: (token) => request("/api/me", { token }),
  updateMe: (token, payload) => request("/api/me", { method: "PUT", token, body: payload }),
  updatePhoto: (token, payload) => request("/api/me/photo", { method: "PUT", token, body: payload }),
  updateFavorite: (token, payload) => request("/api/me/favorite", { method: "PUT", token, body: payload }),
  updatePassword: (token, payload) => request("/api/me/password", { method: "PUT", token, body: payload }),
  deleteAccount: (token) => request("/api/me", { method: "DELETE", token }),
  onboardingComplete: (token) => request("/api/me/onboarding-complete", { method: "POST", token }),

  watchlists: (token) => request("/api/watchlists", { token }),
  watchlistItems: (token, id) => request(`/api/watchlists/${id}/items`, { token }),
  createWatchlist: (token, name) => request("/api/watchlists", { method: "POST", token, body: { name } }),
  deleteWatchlist: (token, id) => request(`/api/watchlists/${id}`, { method: "DELETE", token }),
  addToWatchlist: (token, id, movieId) => request(`/api/watchlists/${id}/items`, { method: "POST", token, body: { movie_id: movieId } }),
  removeFromWatchlist: (token, id, movieId) => request(`/api/watchlists/${id}/items/${movieId}`, { method: "DELETE", token }),

  movies: (token, type, page) => request(`/api/movies?type=${type}&page=${page}`, { token }),
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
  friendRequest: (token, toUserId) => request("/api/friends/request", { method: "POST", token, body: { to_user_id: toUserId } }),
  friendRespond: (token, fromUserId, accept) => request("/api/friends/respond", { method: "POST", token, body: { from_user_id: fromUserId, accept } }),
  unfriend: (token, userId) => request(`/api/friends/${userId}`, { method: "DELETE", token }),

  chats: (token) => request("/api/chats", { token }),
  chatWith: (token, friendId) => request(`/api/chats/with/${friendId}`, { method: "POST", token }),
  messages: (token, chatId) => request(`/api/chats/${chatId}/messages`, { token }),
  sendMessage: (token, chatId, body) => request(`/api/chats/${chatId}/messages`, { method: "POST", token, body: { body } }),

  notifications: (token) => request("/api/notifications", { token }),
  markAllRead: (token) => request("/api/notifications/read-all", { method: "POST", token }),

  tastemates: (token) => request("/api/tastemates", { token }),

  createParty: (token, payload) => request("/api/matchparty/sessions", { method: "POST", token, body: payload }),
  respondParty: (token, id, accept) => request(`/api/matchparty/${id}/respond`, { method: "POST", token, body: { accept } }),
  getParty: (token, id) => request(`/api/matchparty/${id}`, { token }),
  swipeParty: (token, id, movieId, liked) => request(`/api/matchparty/${id}/swipe`, { method: "POST", token, body: { movie_id: movieId, liked } }),
  partyMatches: (token, id) => request(`/api/matchparty/${id}/matches`, { token }),
  endParty: (token, id) => request(`/api/matchparty/${id}/end`, { method: "POST", token }),
};
