from pathlib import Path
import subprocess

# Preserve the current polished social Home so it can become the Activity tab.
current_social_home = Path('src/screens/HomeScreen.js').read_text()

# Restore the pre-social Home layout exactly from repository history.
old_home = subprocess.check_output([
    'git', 'show', '57f2989e9aa14e7d1024fdc0cbae42450e847745:src/screens/HomeScreen.js'
], text=True)
Path('src/screens/HomeScreen.js').write_text(old_home)

# Build ActivityScreen from the current polished social Home, while keeping
# Popular/Pellix Play on the restored old Home instead of duplicating them.
s = current_social_home
s = s.replace('export default function HomeScreen({ navigation }) {', 'export default function ActivityScreen({ navigation }) {', 1)
s = s.replace('ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, StyleSheet', 'ActivityIndicator, FlatList, RefreshControl, StyleSheet', 1)
s = s.replace('import { Flame, Heart, MessageCircle, Plus, Sparkles, Swords } from "lucide-react-native";', 'import { Flame, Heart, MessageCircle, Plus, Sparkles, Swords, Users } from "lucide-react-native";', 1)
s = s.replace('import PlayHubCard from "../components/PlayHubCard";\n', '', 1)

start = s.index('function interleave(')
end = s.index('const DAILY_QUESTIONS', start)
s = s[:start] + s[end:]

s = s.replace('  const [popular, setPopular] = useState([]);\n', '', 1)
load_start = s.index('  const load = useCallback(')
load_end = s.index('\n\n  useEffect(() => { load();', load_start)
new_load = '''  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.socialFeed(auth.token);
      setFeed(data.results || []);
    } catch {
      setFeed([]);
    }
    setLoading(false);
  }, [auth.token]);'''
s = s[:load_start] + new_load + s[load_end:]

s = s.replace('      <PopularNowRow items={popular} c={c} styles={styles} navigation={navigation} />\n\n', '', 1)
s = s.replace('      <PlayHubCard navigation={navigation} />\n\n', '', 1)
s = s.replace('<TopBar centerLabel="Ana Sayfa" />', '<TopBar centerLabel="Aktivite" />', 1)

anchor = '      </LinearGradient>\n\n      <TouchableOpacity style={styles.dailyCard}'
taste_card = '''      </LinearGradient>

      <TouchableOpacity style={styles.tasteMateCard} onPress={() => navigation.navigate("TasteMate")} activeOpacity={0.86}>
        <View style={styles.tasteMateIcon}><Users size={18} color={c.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tasteMateEyebrow}>TASTEMATCH</Text>
          <Text style={styles.tasteMateTitle}>Zevkine yakın insanları keşfet</Text>
          <Text style={styles.tasteMateSub}>Uyumunu gör, yeni profiller bul ve bağlantı kur.</Text>
        </View>
        <Text style={styles.tasteMateCta}>Keşfet →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dailyCard}'''
assert anchor in s
s = s.replace(anchor, taste_card, 1)

pop_start = s.index('function PopularNowRow(')
styles_start = s.index('function makeStyles(c)', pop_start)
s = s[:pop_start] + s[styles_start:]

style_anchor = '    dailyCard: { flexDirection: "row", gap: 11, alignItems: "flex-start", backgroundColor: c.surface, borderWidth: 1, borderColor: "#F97316", borderRadius: 18, padding: 13, marginBottom: 12 },\n'
new_styles = '''    tasteMateCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 13, marginBottom: 12 },
    tasteMateIcon: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    tasteMateEyebrow: { color: c.accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.7 },
    tasteMateTitle: { color: c.text, fontSize: 12.5, fontWeight: "900", marginTop: 2 },
    tasteMateSub: { color: c.dim, fontSize: 10.2, lineHeight: 14, marginTop: 2 },
    tasteMateCta: { color: c.accent, fontSize: 10.5, fontWeight: "900" },
''' + style_anchor
assert style_anchor in s
s = s.replace(style_anchor, new_styles, 1)
Path('src/screens/ActivityScreen.js').write_text(s)

# Replace TasteMate bottom tab with Activity.
p = Path('src/navigation/MainTabs.js')
t = p.read_text()
t = t.replace('import { Home, Compass, Users, MessageCircle, User } from "lucide-react-native";', 'import { Home, Compass, Activity, MessageCircle, User } from "lucide-react-native";', 1)
t = t.replace('import TasteMateScreen from "../screens/TasteMateScreen";', 'import ActivityScreen from "../screens/ActivityScreen";', 1)
old = '''      <Tab.Screen name="TasteMate" component={TasteMateScreen}
        options={{ title: "TasteMate", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />'''
new = '''      <Tab.Screen name="Activity" component={ActivityScreen}
        options={{ title: "Aktivite", tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }} />'''
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)

# Keep TasteMate reachable as a regular stack screen from Activity.
p = Path('src/navigation/RootNavigator.js')
t = p.read_text()
t = t.replace('import MainTabs from "./MainTabs";\n', 'import MainTabs from "./MainTabs";\nimport TasteMateScreen from "../screens/TasteMateScreen";\n', 1)
t = t.replace('        <Stack.Screen name="MainTabs" component={MainTabs} />\n', '        <Stack.Screen name="MainTabs" component={MainTabs} />\n        <Stack.Screen name="TasteMate" component={TasteMateScreen} options={{ presentation: "card" }} />\n', 1)
p.write_text(t)

# Tutorial should match the new visible bottom nav.
p = Path('src/components/TutorialOverlay.js')
t = p.read_text()
t = t.replace('import { Home, Compass, Users, MessageCircle, User, ChevronRight, X } from "lucide-react-native";', 'import { Home, Compass, Activity, MessageCircle, User, ChevronRight, X } from "lucide-react-native";', 1)
old = '  { icon: Users, title: "TasteMate", desc: "Zevkine yakın kullanıcıları kaydırarak keşfet, yeni arkadaşlıklar kur." },'
new = '  { icon: Activity, title: "Aktivite", desc: "Arkadaşlarının beğenilerini ve Taste Post’larını gör, yorum yap ve hızlı reaksiyon bırak." },'
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)
