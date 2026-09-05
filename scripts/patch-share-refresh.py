from pathlib import Path
import re


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)


# Daily Poster Puzzle: move sharing into ShareCardModal so the same spoiler-safe result
# can be posted to Pellix social, saved as an image, or shared externally.
p = Path("src/screens/DailyPosterPuzzleScreen.js")
text = p.read_text(encoding="utf-8")
text = once(
    text,
    'import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Share, ScrollView } from "react-native";',
    'import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";',
    "remove native Share import",
)
text = once(
    text,
    'import ScreenHeader from "../components/ScreenHeader";',
    'import ScreenHeader from "../components/ScreenHeader";\nimport ShareCardModal from "../components/ShareCardModal";\nimport PosterPuzzleShareCard from "../components/PosterPuzzleShareCard";',
    "puzzle share imports",
)
text = once(
    text,
    '  const [result, setResult] = useState(null);',
    '  const [result, setResult] = useState(null);\n  const [showShareCard, setShowShareCard] = useState(false);',
    "puzzle share state",
)
old_share = '''  async function shareResult() {
    if (!result || !puzzle) return;
    const squares = resultSquares(result);
    const message = `Pellix Poster Puzzle · ${localDateKey()}\\n${squares}\\n${result.correct ? `Filmi ${result.wrongCount + 1}. denemede buldum 🎬` : "Bugün poster beni yendi 😅"}\\nSen kaçta bulursun?`;
    try { await Share.share({ message }); } catch {}
  }'''
new_share = '''  function shareResult() {
    if (!result || !puzzle) return;
    setShowShareCard(true);
  }'''
text = once(text, old_share, new_share, "puzzle share function")
old_close = '''      )}
    </View>
  );
}'''
new_close = '''      )}

      {showShareCard && result && puzzle && (
        <ShareCardModal
          onClose={() => setShowShareCard(false)}
          shareMessage={`Pellix Poster Puzzle · ${localDateKey()}\\n${resultSquares(result)}\\n${result.correct ? `Posteri ${Number(result.wrongCount || 0) + 1}. denemede bildim 🎬` : "Bugün poster beni yendi 😅"}\\nCevabı göstermiyorum. Sen kaçta bulursun?`}
          socialCard={{
            kind: "poster_puzzle",
            date: localDateKey(),
            correct: !!result.correct,
            wrongCount: Number(result.wrongCount || 0),
            attempts: result.correct ? Number(result.wrongCount || 0) + 1 : MAX_WRONG,
            squares: resultSquares(result),
          }}
          previewHeight={458}
        >
          <PosterPuzzleShareCard
            date={localDateKey()}
            correct={!!result.correct}
            wrongCount={Number(result.wrongCount || 0)}
            squares={resultSquares(result)}
          />
        </ShareCardModal>
      )}
    </View>
  );
}'''
text = once(text, old_close, new_close, "puzzle share modal")
p.write_text(text, encoding="utf-8")


# Profile: pass the same Taste DNA shown in the new profile UI into both exported cards
# and the social-feed payload.
p = Path("src/screens/ProfileScreen.js")
text = p.read_text(encoding="utf-8")
old_social = '''            favoriteShow: profile.favoriteShow ? { id: profile.favoriteShow.id, title: profile.favoriteShow.title, poster: profile.favoriteShow.poster } : null,
            isPremium: !!premiumStatus?.isPremium,
          }}'''
new_social = '''            favoriteShow: profile.favoriteShow ? { id: profile.favoriteShow.id, title: profile.favoriteShow.title, poster: profile.favoriteShow.poster } : null,
            isPremium: !!premiumStatus?.isPremium,
            tasteDNA: {
              genres: tasteDNA.genres,
              filmPercent: tasteDNA.filmPercent,
              showPercent: tasteDNA.showPercent,
              signalCount: tasteDNA.signalCount,
            },
            streak: questStreak,
          }}
          previewHeight={555}'''
text = once(text, old_social, new_social, "profile social payload")

pattern = re.compile(r'(?m)^(\s+)backgroundUrl=\{profile\.profileBackgroundUrl\}$')
matches = list(pattern.finditer(text))
if len(matches) != 3:
    raise SystemExit(f"ProfileShareCard background props: expected 3, got {len(matches)}")
text = pattern.sub(
    lambda m: (
        f'{m.group(1)}backgroundUrl={{profile.profileBackgroundUrl}}\n'
        f'{m.group(1)}tasteDNA={{tasteDNA}}\n'
        f'{m.group(1)}streak={{questStreak}}'
    ),
    text,
)
p.write_text(text, encoding="utf-8")


# Blend: use the refreshed card's actual height for safe preview scaling.
p = Path("src/screens/BlendScreen.js")
text = p.read_text(encoding="utf-8")
text = once(
    text,
    '            socialCard={{\n              kind: "blend",',
    '            previewHeight={528}\n            socialCard={{\n              kind: "blend",',
    "blend preview height",
)
p.write_text(text, encoding="utf-8")
