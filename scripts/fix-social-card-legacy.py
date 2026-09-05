from pathlib import Path

p = Path("src/components/SocialSharedCard.js")
text = p.read_text(encoding="utf-8")

old = '''  const genres = Array.isArray(payload.tasteDNA?.genres) ? payload.tasteDNA.genres.slice(0, 3) : [];
  const filmPercent = bounded(payload.tasteDNA?.filmPercent || 50);'''
new = '''  const hasTasteDNA = !!payload.tasteDNA;
  const genres = Array.isArray(payload.tasteDNA?.genres) ? payload.tasteDNA.genres.slice(0, 3) : [];
  const filmPercent = bounded(payload.tasteDNA?.filmPercent || 50);'''
if text.count(old) != 1:
    raise SystemExit(f"taste dna declaration: expected 1, got {text.count(old)}")
text = text.replace(old, new, 1)

old = '''            <Text style={styles.profileSignal}>{Number(payload.tasteDNA?.signalCount || 0)} zevk sinyali</Text>'''
new = '''            <Text style={styles.profileSignal}>
              {hasTasteDNA ? `${Number(payload.tasteDNA?.signalCount || 0)} zevk sinyali` : "Pellix profil kartı"}
            </Text>'''
if text.count(old) != 1:
    raise SystemExit(f"profile signal: expected 1, got {text.count(old)}")
text = text.replace(old, new, 1)

old = '''        <View style={styles.formatMini}>
          <Text style={styles.formatText}>FİLM %{filmPercent}</Text>
          <View style={styles.formatTrack}><View style={[styles.formatFill, { width: `${filmPercent}%` }]} /></View>
          <Text style={styles.formatText}>DİZİ %{100 - filmPercent}</Text>
        </View>'''
new = '''        {hasTasteDNA && (
          <View style={styles.formatMini}>
            <Text style={styles.formatText}>FİLM %{filmPercent}</Text>
            <View style={styles.formatTrack}><View style={[styles.formatFill, { width: `${filmPercent}%` }]} /></View>
            <Text style={styles.formatText}>DİZİ %{100 - filmPercent}</Text>
          </View>
        )}'''
if text.count(old) != 1:
    raise SystemExit(f"profile format: expected 1, got {text.count(old)}")
text = text.replace(old, new, 1)

p.write_text(text, encoding="utf-8")
