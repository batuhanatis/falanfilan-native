import { API_BASE } from "../api/client";

export async function reportSocialContent(token, targetType, targetId, reason, details) {
  const response = await fetch(`${API_BASE}/api/social/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ targetType, targetId, reason, details }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Şikâyet gönderilemedi.");
  return data;
}
