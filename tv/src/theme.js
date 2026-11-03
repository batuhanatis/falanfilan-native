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
