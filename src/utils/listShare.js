// movieShare.js ile AYNI yöntem — bir listeyi sohbette "zengin" bir kart olarak göstermek için,
// mesaj metninin içine tanınabilir bir işaretle birlikte liste verisini JSON olarak gömüyoruz.
const PREFIX = "__LIST_SHARE__";

export function encodeListShare({ id, name, count, previewPoster, ownerName }) {
  const payload = { id, name, count, previewPoster: previewPoster || null, ownerName };
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function decodeListShare(body) {
  if (!body || typeof body !== "string" || !body.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(body.slice(PREFIX.length));
  } catch {
    return null;
  }
}
