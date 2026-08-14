import { API_BASE } from "./client";

async function playRequest(path, token, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Bir şeyler ters gitti.");
    err.status = res.status;
    err.disabled = !!data.disabled;
    throw err;
  }
  return data;
}

export const playApi = {
  features: (token) => playRequest("/api/play/features", token),
  tasteBattle: (token) => playRequest("/api/play/taste-battle", token),
  chooseTasteBattle: (token, winnerId, loserId) => playRequest("/api/play/taste-battle/choose", token, { method: "POST", body: { winnerId, loserId } }),
  friendQuiz: (token) => playRequest("/api/play/friend-quiz", token),
  answerFriendQuiz: (token, friendId, chosenMovieId, correctMovieId) => playRequest("/api/play/friend-quiz/answer", token, { method: "POST", body: { friendId, chosenMovieId, correctMovieId } }),
  blindPick: (token) => playRequest("/api/play/blind-pick", token),
  answerBlindPick: (token, movieId, interested) => playRequest("/api/play/blind-pick/answer", token, { method: "POST", body: { movieId, interested } }),
};
