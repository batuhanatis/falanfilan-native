from pathlib import Path


def replace_once(s, old, new, label):
    if old not in s:
        raise RuntimeError(f"missing anchor: {label}")
    return s.replace(old, new, 1)

# API client
p = Path("src/api/client.js")
s = p.read_text()
if "recommendations: (token)" not in s:
    s = replace_once(
        s,
        '  trending: (token, type) => request(`/api/trending?type=${type}`, { token }),\n',
        '  trending: (token, type) => request(`/api/trending?type=${type}`, { token }),\n  recommendations: (token) => request("/api/recommendations", { token }),\n',
        "api recommendations",
    )
if "setLikeProfileVisibility" not in s:
    s = replace_once(
        s,
        '  interactions: (token) => request("/api/interactions", { token }),\n',
        '  interactions: (token) => request("/api/interactions", { token }),\n  setLikeProfileVisibility: (token, movieId, hidden) => request(`/api/me/likes/${movieId}/visibility`, { method: "PATCH", token, body: { hidden } }),\n',
        "api like visibility",
    )
if "socialFeed: (token)" not in s:
    social_methods = '''  socialFeed: (token) => request("/api/social/feed", { token }),
  socialCreatePost: (token, payload) => request("/api/social/posts", { method: "POST", token, body: payload }),
  socialDeletePost: (token, id) => request(`/api/social/posts/${id}`, { method: "DELETE", token }),
  socialToggleLike: (token, id) => request(`/api/social/posts/${id}/like`, { method: "POST", token }),
  socialComments: (token, id) => request(`/api/social/posts/${id}/comments`, { token }),
  socialAddComment: (token, id, body) => request(`/api/social/posts/${id}/comments`, { method: "POST", token, body: { body } }),
  socialVote: (token, id, movieId) => request(`/api/social/posts/${id}/vote`, { method: "POST", token, body: { movieId } }),
  socialUserPosts: (token, userId) => request(`/api/social/users/${userId}/posts`, { token }),
'''
    s = replace_once(
        s,
        '  activityFeed: (token) => request("/api/activity-feed", { token }),\n',
        '  activityFeed: (token) => request("/api/activity-feed", { token }),\n' + social_methods,
        "api social methods",
    )
p.write_text(s)

# Prefetch: use recommendation engine, not random catalog pages.
p = Path("src/context/PrefetchContext.js")
s = p.read_text()
start = s.index("    (async () => {")
end = s.index("\n\n    return () => { cancelled = true; };", start)
replacement = '''    (async () => {
      try {
        const data = await api.recommendations(token);
        if (!stillCurrent()) return;
        setDiscoverQueue((data.results || []).slice(0, DISCOVER_STOCK_TARGET));
      } catch {
        // Hata durumunda null bırak; Discover kendi öneri isteğini atsın.
      }
    })();'''
s = s[:start] + replacement + s[end:]
p.write_text(s)

# AI zone can start expanded in its Discover sheet.
p = Path("src/components/AIZone.js")
s = p.read_text()
s = replace_once(
    s,
    'export default function AIZone({ navigation, hasResults, onResults, onClear }) {',
    'export default function AIZone({ navigation, hasResults, onResults, onClear, defaultOpen = false }) {',
    "AI zone props",
)
s = replace_once(
    s,
    '  const [aiOpen, setAiOpen] = useState(false);',
    '  const [aiOpen, setAiOpen] = useState(defaultOpen);',
    "AI zone default open",
)
p.write_text(s)

# Discover: recommendation engine + content search + AI discovery tools.
p = Path("src/screens/DiscoverScreen.js")
s = p.read_text()
s = replace_once(
    s,
    'import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from "react-native";',
    'import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Modal, TextInput, FlatList } from "react-native";',
    "Discover RN import",
)
s = replace_once(
    s,
    'import { ChevronLeft, Heart, X, Star, ListVideo, Send } from "lucide-react-native";',
    'import { Heart, X, Star, ListVideo, Send, Search, Sparkles } from "lucide-react-native";',
    "Discover icons",
)
s = replace_once(
    s,
    'import Confetti from "../components/Confetti";',
    'import Confetti from "../components/Confetti";\nimport AIZone from "../components/AIZone";',
    "Discover AIZone import",
)
s = replace_once(
    s,
    '  const [sendMovie, setSendMovie] = useState(null);',
    '''  const [sendMovie, setSendMovie] = useState(null);
  const [showAiTools, setShowAiTools] = useState(false);
  const [aiLabel, setAiLabel] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);''',
    "Discover states",
)
start = s.index("  const growQueue = useCallback(")
end = s.index("\n\n  const resetForFilter = useCallback", start)
new_grow = '''  const growQueue = useCallback(async (existingQueue, existingShown, existingFilter) => {
    if (growingRef.current) return [];
    growingRef.current = true;
    try {
      const votedIds = await getVotedIds();
      const usedIds = new Set([...existingQueue.map((m) => m.id), ...existingShown, ...votedIds]);
      const data = await api.recommendations(auth.token);
      return (data.results || [])
        .filter((m) => !usedIds.has(m.id))
        .filter((m) => existingFilter === "All" || (existingFilter === "Movie" ? m.type === "Film" : m.type === "Dizi"))
        .slice(0, Math.max(STOCK_TARGET, 18));
    } catch {
      return [];
    } finally {
      growingRef.current = false;
    }
  }, [auth.token]);'''
s = s[:start] + new_grow + s[end:]
s = s.replace("Kartların karılıyor...", "Öneri motorun sana özel kartları hazırlıyor...", 1)
s = s.replace("Daha sonra tekrar bak, ya da baştan başla.", "Zevkin geliştikçe yeni öneriler burada belirecek.", 1)
marker = "  const current = queue[0];\n  const next = queue[1];"
handlers = '''  async function runSearch() {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearchLoading(true);
    try {
      const [movies, shows] = await Promise.all([
        api.search(auth.token, q, "movie"),
        api.search(auth.token, q, "tv"),
      ]);
      const seen = new Set();
      setSearchResults([...(movies.results || []), ...(shows.results || [])].filter((item) => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).slice(0, 30));
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  }

  async function applyAiResults(results, label = "AI seçimi") {
    const voted = await getVotedIds();
    const fresh = (results || []).filter((m) => !voted.has(m.id) && matchesType(m));
    setShownIds(new Set());
    setQueue(fresh);
    setStockReady(true);
    setAiLabel(label || "AI seçimi");
    setShowAiTools(false);
  }

  function clearAiResults() {
    setAiLabel(null);
    resetForFilter(filterType);
  }

  const current = queue[0];
  const next = queue[1];'''
s = replace_once(s, marker, handlers, "Discover handlers")
start = s.index("      <View style={styles.topBar}>")
end = s.index("\n\n      {stockReady && current && (", start)
topbar = '''      <View style={styles.topBar}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowSearch(true)}>
          <Search size={18} color="#fff" />
        </TouchableOpacity>
        <View style={styles.pillWrap}>
          <View style={styles.pillRow}>
            {[["All", "Tümü"], ["Movie", "Film"], ["TV Shows", "Dizi"]].map(([id, label]) => (
              <TouchableOpacity
                key={id}
                onPress={() => { setAiLabel(null); setFilterType(id); }}
                style={[styles.pill, filterType === id && styles.pillActive]}
              >
                <Text style={[styles.pillText, filterType === id && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowAiTools(true)}>
          <Sparkles size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {!!aiLabel && (
        <TouchableOpacity style={styles.aiResultBadge} onPress={clearAiResults}>
          <Sparkles size={12} color="#fff" />
          <Text style={styles.aiResultBadgeText} numberOfLines={1}>{aiLabel}</Text>
          <X size={12} color="#fff" />
        </TouchableOpacity>
      )}'''
s = s[:start] + topbar + s[end:]
marker = '      {pickerMovie && <ListPickerModal movie={pickerMovie} onClose={() => setPickerMovie(null)} />}'
modals = '''      <Modal visible={showSearch} transparent animationType="fade" onRequestClose={() => setShowSearch(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSearch(false)} />
          <View style={styles.searchSheet}>
            <View style={styles.searchHeader}>
              <Text style={styles.modalTitle}>İçerik ara</Text>
              <TouchableOpacity onPress={() => setShowSearch(false)}><X size={18} color={c.text} /></TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Search size={16} color={c.dim} />
              <TextInput
                style={styles.searchInput}
                placeholder="Film veya dizi ara..."
                placeholderTextColor={c.dim}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={runSearch}
                returnKeyType="search"
                autoFocus
              />
              {searchLoading && <ActivityIndicator size="small" color={c.accent} />}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultRow} onPress={() => { setShowSearch(false); navigation.navigate("Detail", { movie: item }); }}>
                  {item.poster ? <Image source={{ uri: item.poster }} style={styles.searchResultPoster} /> : <View style={[styles.searchResultPoster, { backgroundColor: c.surface2 }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.searchResultMeta}>{item.type} {item.year ? `· ${item.year}` : ""}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={searchQuery.trim().length >= 2 && !searchLoading ? <Text style={styles.searchEmpty}>Aramak için klavyedeki “ara” tuşuna dokun.</Text> : null}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showAiTools} transparent animationType="fade" onRequestClose={() => setShowAiTools(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAiTools(false)} />
          <View style={styles.aiSheet}>
            <View style={styles.searchHeader}>
              <View>
                <Text style={styles.modalTitle}>Yapay Zeka Köşesi</Text>
                <Text style={styles.modalSub}>İçerik keşfinin içinde, tam olması gereken yerde.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiTools(false)}><X size={18} color={c.text} /></TouchableOpacity>
            </View>
            <AIZone
              navigation={navigation}
              defaultOpen
              hasResults={!!aiLabel}
              onResults={applyAiResults}
              onClear={clearAiResults}
            />
          </View>
        </View>
      </Modal>

      {pickerMovie && <ListPickerModal movie={pickerMovie} onClose={() => setPickerMovie(null)} />}'''
s = replace_once(s, marker, modals, "Discover modals")
s = replace_once(
    s,
    '''    backBtn: {
      width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
    },''',
    '''    toolBtn: {
      width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
    },''',
    "Discover tool style",
)
style_marker = '    actionCircle: { width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center" },'
extra_styles = style_marker + '''
    aiResultBadge: { position: "absolute", top: 90, alignSelf: "center", maxWidth: "78%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(109,40,217,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, zIndex: 30 },
    aiResultBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800", flexShrink: 1 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    searchSheet: { height: "72%", backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, borderWidth: 1, borderColor: c.border },
    aiSheet: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 30, borderWidth: 1, borderColor: c.border },
    searchHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    modalTitle: { color: c.text, fontWeight: "900", fontSize: 17 },
    modalSub: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    searchBox: { minHeight: 44, borderRadius: 13, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 },
    searchInput: { flex: 1, color: c.text, fontSize: 13 },
    searchResultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    searchResultPoster: { width: 42, height: 62, borderRadius: 7 },
    searchResultTitle: { color: c.text, fontWeight: "800", fontSize: 12.5 },
    searchResultMeta: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    searchEmpty: { color: c.dim, textAlign: "center", fontSize: 11, marginTop: 24 },'''
s = replace_once(s, style_marker, extra_styles, "Discover extra styles")
p.write_text(s)

# Chat: keep only conversations in UI; activity moves to Home.
p = Path("src/screens/ChatListScreen.js")
s = p.read_text()
s = replace_once(
    s,
    '  useEffect(() => { loadFriends(); loadActivity(); }, [loadFriends, loadActivity]);',
    '  useEffect(() => { loadFriends(); }, [loadFriends]);',
    "Chat initial activity load",
)
s = replace_once(
    s,
    '    const unsubFocus = navigation.addListener("focus", () => { loadFriends(); loadActivity(); refreshUnread(); });',
    '    const unsubFocus = navigation.addListener("focus", () => { loadFriends(); refreshUnread(); });',
    "Chat focus activity load",
)
s = replace_once(
    s,
    '''      <View style={styles.tabRow}>
        {[["chats", "Sohbetler"], ["activity", "Aktivite"]].map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setSub(id)} style={[styles.tabBtn, sub === id && { backgroundColor: c.accent, borderColor: c.accent }]}>
            <Text style={[styles.tabText, sub === id && { color: c.bg }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>''',
    '''      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "900" }}>Sohbetler</Text>
        <Text style={{ color: c.dim, fontSize: 10.5, marginTop: 2 }}>Arkadaş aktiviteleri artık Ana Sayfa’daki sosyal akışta.</Text>
      </View>''',
    "Chat tabs",
)
p.write_text(s)

# Profile: posts first, hidden-like eye control.
p = Path("src/screens/ProfileScreen.js")
s = p.read_text()
s = replace_once(s, '  X, Lock,\n} from "lucide-react-native";', '  X, Lock, Eye, EyeOff,\n} from "lucide-react-native";', "Profile icons")
s = replace_once(s, 'import EditProfileModal from "../components/EditProfileModal";', 'import EditProfileModal from "../components/EditProfileModal";\nimport SocialFeedCard from "../components/SocialFeedCard";', "Profile social import")
s = replace_once(s, '  const [watchlists, setWatchlists] = useState([]);', '  const [watchlists, setWatchlists] = useState([]);\n  const [socialPosts, setSocialPosts] = useState([]);', "Profile social state")
s = replace_once(s, '  const [sub, setSub] = useState(route?.params?.initialSub || "likes"); // likes | dislikes | badges', '  const [sub, setSub] = useState(route?.params?.initialSub || "posts"); // posts | likes | dislikes | badges', "Profile default tab")
s = replace_once(s, '    api.achievements(auth.token).then(setAchievements).catch(() => {});', '    api.socialUserPosts(auth.token, auth.id).then((data) => setSocialPosts(data.results || [])).catch(() => setSocialPosts([]));\n    api.achievements(auth.token).then(setAchievements).catch(() => {});', "Profile post load")
s = replace_once(
    s,
    '  if (loading || !profile) {',
    '''  async function toggleLikeVisibility(item) {
    const hidden = !item.profileHidden;
    setLikedMovies((prev) => prev.map((m) => Number(m.id) === Number(item.id) ? { ...m, profileHidden: hidden } : m));
    try {
      await api.setLikeProfileVisibility(auth.token, item.id, hidden);
    } catch {
      setLikedMovies((prev) => prev.map((m) => Number(m.id) === Number(item.id) ? { ...m, profileHidden: !hidden } : m));
    }
  }

  if (loading || !profile) {''',
    "Profile visibility helper",
)
s = replace_once(
    s,
    '{[["likes", "Beğeniler"], ["dislikes", "Beğenmediklerim"], ["badges", `Rozetler${achievements ? ` (${achievements.unlockedCount}/${achievements.totalCount})` : ""}`]].map(([id, label]) => (',
    '{[["posts", "Paylaşımlar"], ["likes", "Beğeniler"], ["dislikes", "Beğenmediklerim"], ["badges", `Rozetler${achievements ? ` (${achievements.unlockedCount}/${achievements.totalCount})` : ""}`]].map(([id, label]) => (',
    "Profile tabs",
)
s = replace_once(
    s,
    '        {sub === "likes" && (',
    '''        {sub === "posts" && (
          socialPosts.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              {socialPosts.map((item) => <SocialFeedCard key={item.id} item={item} navigation={navigation} compact />)}
            </View>
          ) : <Text style={styles.emptyText}>Henüz bir paylaşımın yok. Ana Sayfa’dan ilk Taste Post’unu oluşturabilirsin.</Text>
        )}

        {sub === "likes" && (''',
    "Profile posts block",
)
old_like_render = '''                renderItem={({ item }) => (
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? <Image source={{ uri: item.poster }} style={styles.posterThumb} />
                      : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }]} />}
                  </TouchableOpacity>
                )}'''
new_like_render = '''                renderItem={({ item }) => (
                  <TouchableOpacity style={{ flex: 1, position: "relative" }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? <Image source={{ uri: item.poster }} style={[styles.posterThumb, item.profileHidden && { opacity: 0.48 }]} />
                      : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }, item.profileHidden && { opacity: 0.48 }]} />}
                    <TouchableOpacity
                      style={styles.likeVisibilityBtn}
                      onPress={(e) => { e.stopPropagation?.(); toggleLikeVisibility(item); }}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      {item.profileHidden ? <EyeOff size={14} color="#fff" /> : <Eye size={14} color="#fff" />}
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}'''
s = replace_once(s, old_like_render, new_like_render, "Profile likes render")
s = replace_once(s, '    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },', '    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },\n    likeVisibilityBtn: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center", zIndex: 5 },', "Profile eye style")
p.write_text(s)

# All likes: eye control for self, including hidden likes outside first 30.
p = Path("src/screens/AllLikesScreen.js")
s = p.read_text()
s = replace_once(s, 'import { ChevronLeft } from "lucide-react-native";', 'import { ChevronLeft, Eye, EyeOff } from "lucide-react-native";', "AllLikes icons")
s = replace_once(
    s,
    '  async function handleLoadMore() {',
    '''  async function toggleVisibility(item) {
    if (kind !== "likes" || Number(userId) !== Number(auth.id)) return;
    const hidden = !item.profileHidden;
    setItems((prev) => prev.map((m) => Number(m.id) === Number(item.id) ? { ...m, profileHidden: hidden } : m));
    try { await api.setLikeProfileVisibility(auth.token, item.id, hidden); }
    catch { setItems((prev) => prev.map((m) => Number(m.id) === Number(item.id) ? { ...m, profileHidden: !hidden } : m)); }
  }

  async function handleLoadMore() {''',
    "AllLikes toggle helper",
)
s = replace_once(
    s,
    '''          renderItem={({ item }) => (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
              {item.poster ? <Image source={{ uri: item.poster }} style={styles.poster} />
                : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
            </TouchableOpacity>
          )}''',
    '''          renderItem={({ item }) => (
            <TouchableOpacity style={{ flex: 1, position: "relative" }} onPress={() => navigation.navigate("Detail", { movie: item })}>
              {item.poster ? <Image source={{ uri: item.poster }} style={[styles.poster, item.profileHidden && { opacity: 0.48 }]} />
                : <View style={[styles.poster, { backgroundColor: c.surface2 }, item.profileHidden && { opacity: 0.48 }]} />}
              {kind === "likes" && Number(userId) === Number(auth.id) && (
                <TouchableOpacity style={styles.eyeBtn} onPress={(e) => { e.stopPropagation?.(); toggleVisibility(item); }}>
                  {item.profileHidden ? <EyeOff size={14} color="#fff" /> : <Eye size={14} color="#fff" />}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}''',
    "AllLikes render",
)
s = replace_once(s, '    poster: { flex: 1, aspectRatio: 2 / 3, borderRadius: 8 },', '    poster: { flex: 1, aspectRatio: 2 / 3, borderRadius: 8 },\n    eyeBtn: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center" },', "AllLikes eye style")
p.write_text(s)

# Other profile: social posts before likes.
p = Path("src/screens/OtherProfileScreen.js")
s = p.read_text()
s = replace_once(s, 'import ImageLightbox from "../components/ImageLightbox";', 'import ImageLightbox from "../components/ImageLightbox";\nimport SocialFeedCard from "../components/SocialFeedCard";', "OtherProfile social import")
s = replace_once(s, '  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);', '  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);\n  const [socialPosts, setSocialPosts] = useState([]);', "OtherProfile social state")
s = replace_once(
    s,
    '''    api.userProfile(auth.token, userId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));''',
    '''    api.userProfile(auth.token, userId)
      .then((data) => {
        setProfile(data);
        api.socialUserPosts(auth.token, userId).then((posts) => setSocialPosts(posts.results || [])).catch(() => setSocialPosts([]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));''',
    "OtherProfile load posts",
)
s = replace_once(
    s,
    '          <Text style={styles.sectionTitle}>Beğeniler</Text>',
    '''          <Text style={styles.sectionTitle}>Paylaşımlar</Text>
          {socialPosts.length > 0 ? (
            <View style={{ marginTop: 10 }}>
              {socialPosts.slice(0, 8).map((item) => <SocialFeedCard key={item.id} item={item} navigation={navigation} compact />)}
            </View>
          ) : <Text style={styles.emptyText}>Henüz bir paylaşımı yok.</Text>}

          <Text style={styles.sectionTitle}>Beğeniler</Text>''',
    "OtherProfile posts block",
)
p.write_text(s)

# Detail: share/recommend as a Taste Post from the natural content context.
p = Path("src/screens/DetailScreen.js")
s = p.read_text()
s = replace_once(s, 'import { ChevronLeft, Film, Tv, Clock, Star, Heart, X, Bookmark, Send } from "lucide-react-native";', 'import { ChevronLeft, Film, Tv, Clock, Star, Heart, X, Bookmark, Send, Share2 } from "lucide-react-native";', "Detail Share icon")
s = replace_once(s, 'import SendToFriendModal from "../components/SendToFriendModal";', 'import SendToFriendModal from "../components/SendToFriendModal";\nimport SocialPostComposer from "../components/SocialPostComposer";', "Detail composer import")
s = replace_once(s, '  const [sendOpen, setSendOpen] = useState(false);', '  const [sendOpen, setSendOpen] = useState(false);\n  const [postComposerOpen, setPostComposerOpen] = useState(false);', "Detail composer state")
old_send = '''            <TouchableOpacity style={styles.actionSquare} onPress={() => setSendOpen(true)}>
              <Send size={16} color={c.text} />
            </TouchableOpacity>'''
s = replace_once(s, old_send, old_send + '''
            <TouchableOpacity style={styles.actionSquare} onPress={() => setPostComposerOpen(true)}>
              <Share2 size={16} color={c.text} />
            </TouchableOpacity>''', "Detail post action")
s = replace_once(s, '      {sendOpen && <SendToFriendModal movie={movie} onClose={() => setSendOpen(false)} />}', '      {sendOpen && <SendToFriendModal movie={movie} onClose={() => setSendOpen(false)} />}\n      <SocialPostComposer visible={postComposerOpen} initialMovie={movie} initialType="recommend" onClose={() => setPostComposerOpen(false)} />', "Detail composer render")
p.write_text(s)
