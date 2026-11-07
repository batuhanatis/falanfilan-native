// İsimlere Türkçe ek: ünlü uyumu ve kaynaştırma harfiyle ("Ece'ye", "Kaan'a", "Elif'e", "Can'a").
// Ünlü bulunamazsa (ör. "XYZ", emoji) null döner; çağıran ekin gerekmediği bir cümleye geçer.
const BACK = "aıouâû";
const FRONT = "eiöüî";

function lastVowel(name) {
  const s = String(name || "").trim().toLocaleLowerCase("tr-TR");
  for (let i = s.length - 1; i >= 0; i--) {
    if (BACK.includes(s[i])) return { back: true, final: i === s.length - 1 };
    if (FRONT.includes(s[i])) return { back: false, final: i === s.length - 1 };
  }
  return null;
}

// Yönelme hâli: "Elif'e", "Ece'ye", "Kaan'a"
export function dativeTR(name) {
  const v = lastVowel(name);
  if (!v) return null;
  return `${String(name).trim()}'${v.final ? "y" : ""}${v.back ? "a" : "e"}`;
}

// "de / da" bağlacı: "Elif de", "Kaan da"
export function alsoTR(name) {
  const v = lastVowel(name);
  return `${String(name || "").trim()} ${v && v.back ? "da" : "de"}`;
}

// Belirtme hâli: "Elif'i", "Ece'yi", "Kaan'ı", "Burcu'yu", "Ömür'ü"
export function accusativeTR(name) {
  const s = String(name || "").trim();
  const low = s.toLocaleLowerCase("tr-TR");
  for (let i = low.length - 1; i >= 0; i--) {
    const ch = low[i];
    const suffix = "aıâ".includes(ch) ? "ı" : "eiî".includes(ch) ? "i" : "ouû".includes(ch) ? "u" : "öü".includes(ch) ? "ü" : null;
    if (suffix) return `${s}'${i === low.length - 1 ? "y" : ""}${suffix}`;
  }
  return null;
}
