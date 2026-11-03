// Pellix Salon tasarım dili, TV için: telefonla aynı renkler ve yazı tipleri, 10 adım öteden
// okunacak boyutlarda. Android TV ekranı mantıksal olarak ~960x540.
export const C = {
  bg: "#14121a",
  surface: "#1c1a24",
  surface2: "#242230",
  text: "#f2ede2",
  dim: "#8f8a9c",
  accent: "#c9a44c",
  onAccent: "#1a140b",
  danger: "#d9636f",
  border: "#2d2b38",
};

export const FONTS = {
  marquee: "BigShoulders_800ExtraBold",
  marqueeBold: "BigShoulders_700Bold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
  logo: "Baloo2_800ExtraBold",
};

// Türkçe büyük harf (i → İ, ı → I).
export const upperTR = (s) => String(s || "").replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();

export const SAFE_X = 48;
export const SAFE_Y = 27;

// Seans panosu (Salon): fiziksel bir nesne, iki temada da koyu.
export const BOARD = { bg: "#0d0b0a", border: "#3a332b", plate: "#26221d", seam: "#070606", ink: "#f2ede2", gold: "#d4a94a", dim: "#a39684" };

// TMDB görsel boyutu (ör. w342 → w185): TV'de görselleri gösterildiği boyutta indirmek için.
export const tmdbSize = (url, size) => (url ? String(url).replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${size}/`) : url);

// Ana ekran ölçüleri (960x540 mantıksal TV ekranı).
export const TOPBAR_H = 64;
export const HERO_H = 288;
export const HERO_W = 960 - SAFE_X * 2;
export const HERO_MEDIA_W = Math.round((HERO_H * 16) / 9); // fragman 16:9, kırpılmadan
export const PREVIEW_H = 190;
