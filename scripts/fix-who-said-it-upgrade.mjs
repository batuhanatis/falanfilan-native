import fs from "fs";

const path = "scripts/upgrade-who-said-it.mjs";
let s = fs.readFileSync(path, "utf8");
s = s.replace(
  '{round?.mode === "daily" ? "Günlük" : `${kindLabel} · ${difficultyLabel}`}',
  '{round?.mode === "daily" ? "Günlük" : kindLabel + " · " + difficultyLabel}'
);
s = s.replace(
  '{feedback.correct ? "Doğru!" : `Doğru cevap: ${feedback.answer}`}',
  '{feedback.correct ? "Doğru!" : "Doğru cevap: " + feedback.answer}'
);
fs.writeFileSync(path, s);
