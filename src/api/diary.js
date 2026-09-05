import { API_BASE } from "./client";

async function diaryRequest(path, token, options = {}) {
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
    const err = new Error(data.error || "Diary işlemi tamamlanamadı.");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const diaryApi = {
  list: (token, page = 1, limit = 30) => diaryRequest(`/api/diary?page=${page}&limit=${limit}`, token),
  stats: (token) => diaryRequest("/api/diary/stats", token),
  entry: (token, movieId) => diaryRequest(`/api/diary/${movieId}`, token),
  save: (token, movieId, payload = {}) => diaryRequest(`/api/diary/${movieId}`, token, { method: "PUT", body: payload }),
  remove: (token, movieId) => diaryRequest(`/api/diary/${movieId}`, token, { method: "DELETE" }),
};
