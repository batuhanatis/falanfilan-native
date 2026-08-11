// movieShare.js ile aynı mantık — mesaj metninin içine tanınabilir bir işaretle birlikte
// fotoğraf verisini (base64) JSON olarak gömüyoruz. "once: true" ise tek seferlik görüntüleme,
// alıcı gördükten sonra backend fotoğrafı GERÇEKTEN siliyor (consumed: true haline dönüşüyor).
const PREFIX = "__PHOTO_MSG__";

export function encodePhotoMessage(imageBase64DataUri, once) {
  return `${PREFIX}${JSON.stringify({ image: imageBase64DataUri, once: !!once })}`;
}

export function decodePhotoMessage(body) {
  if (!body || typeof body !== "string" || !body.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(body.slice(PREFIX.length));
  } catch {
    return null;
  }
}
