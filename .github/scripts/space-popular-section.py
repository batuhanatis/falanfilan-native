from pathlib import Path

path = Path('src/screens/HomeScreenV2.js')
text = path.read_text()
old = '''\n\n        <PopularNowRow items={popularNow} onPress={(movie) => navigation.navigate("Detail", { movie })} />\n'''
new = '''\n\n        <View style={styles.popularNowSection}>\n          <PopularNowRow items={popularNow} onPress={(movie) => navigation.navigate("Detail", { movie })} />\n        </View>\n'''
if old not in text:
    raise SystemExit('PopularNowRow target not found')
text = text.replace(old, new, 1)
old_style = '''    todayRow: { gap: 8 },\n'''
new_style = '''    todayRow: { gap: 8 },\n    popularNowSection: { marginTop: 22 },\n'''
if old_style not in text:
    raise SystemExit('todayRow style target not found')
text = text.replace(old_style, new_style, 1)
path.write_text(text)
