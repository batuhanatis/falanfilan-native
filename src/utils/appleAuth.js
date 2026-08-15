import { API_BASE } from "../api/client";

export async function appleAuthWithCode(identityToken, fullName, authorizationCode) {
  const response = await fetch(`${API_BASE}/api/auth/apple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityToken, fullName, authorizationCode }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Apple ile giriş başarısız oldu.");
  return data;
}
