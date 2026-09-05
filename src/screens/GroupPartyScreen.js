import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from "react-native";
import { Check, Users, History, ChevronDown, ChevronUp, Search, X, SlidersHorizontal, Zap } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import { GENRE_FILTERS } from "../theme/theme";
import { YEAR_OPTIONS } from "../utils/filterYears";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChipRow from "../components/ChipRow";
import FilterFields from "../components/FilterFields";
import { useCommonPlatforms } from "../hooks/useCommonPlatforms";
import ScreenHeader from "../components/ScreenHeader";

const MIN_IMDB_OPTIONS = [6.0, 6.5, 7.0, 7.5, 8.0];

export default function GroupPartyScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);
  const commonPlatforms = useCommonPlatforms();

  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [recentMatches, setRecentMatches] = useState([]);
  const [showRecent, setShowRecent] = useState(true);

  const [typePref, setTypePref] = useState("Hepsi");
  const [genrePref, setGenrePref] = useState(null);
  const [minImdb, setMinImdb] = useState(6.5);
  const [yearLabels, setYearLabels] = useState(new Set());
  const [platformPrefs, setPlatformPrefs] = useState(new Set());

  useEffect(() => {
    api.friends(auth.token).then((data) => setFriends(data.friends || [])).catch(() => {}).finally(() => setLoading(false));
    api.recentPartyMatches(auth.token).then((data) => setRecentMatches(data.results || [])).catch(() => {});
  }, []);

  function toggle(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleYear(label) {
    setYearLabels((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  }
  function togglePlatform(name) {
    setPlatformPrefs((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function shuffleGenre() {
    setGenrePref(GENRE_FILTERS[Math.floor(Math.random() * GENRE_FILTERS.length)]);
  }

  async function createGroupParty() {
    if (selected.size === 0 || creating) return;
    setCreating(true);
    try {
      const years = YEAR_OPTIONS.filter(([label]) => yearLabels.has(label)).map(([, key]) => key);
      const data = await api.createParty(auth.token, {
        to_user_ids: [...selected],
        filters: { type: typePref, genre: genrePref || "Hepsi", minImdb, years, platforms: [...platformPrefs] },
      });
      navigation.replace("MatchParty", { sessionId: data.id });
    } catch {
      setCreating(false);
    }
  }

  const filteredFriends = friendQuery.trim()
    ? friends.filter((f) => f.name?.toLowerCase().includes(friendQuery.trim().toLowerCase()))
    : friends;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="MatchParty" subtitle="Birlikte seçin" onBack={() => navigation.goBack()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom }}>
        <Text style={styles.subtitle}>Arkadaşlarını seç. İstersen hemen başlat, istersen filtrelerle geceni özelleştir.</Text>

        {selected.size > 0 && (
          <View style={styles.squadRow}>
            {friends.filter((f) => selected.has(f.id)).map((f) => (
              <RetryImage key={f.id} source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.squadAvatar} />
            ))}
            <Text style={styles.squadCount}>{selected.size} kişi seçildi</Text>
          </View>
        )}

        {recentMatches.length > 0 && (
          <>
            <TouchableOpacity style={styles.recentToggle} onPress={() => setShowRecent((v) => !v)}>
              <History size={14} color={c.accent} />
              <Text style={styles.recentToggleText}>Geçmiş Eşleşmeler</Text>
              {showRecent ? <ChevronUp size={14} color={c.dim} /> : <ChevronDown size={14} color={c.dim} />}
            </TouchableOpacity>
            {showRecent && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentRow}>
                {recentMatches.map((session) => (
                  <View key={session.sessionId} style={styles.recentCard}>
                    <Text style={styles.recentWith} numberOfLines={1}>
                      {session.others.map((o) => o.name).join(", ") || "Grup"}
                    </Text>
                    <View style={styles.recentPosters}>
                      {session.matches.slice(0, 3).map((m, i) => (
                        m.poster
                          ? <Image key={i} source={{ uri: m.poster }} style={styles.recentPoster} />
                          : <View key={i} style={[styles.recentPoster, { backgroundColor: c.surface2 }]} />
                      ))}
                    </View>
                    <Text style={styles.recentCount}>{session.matches.length} eşleşme</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {!loading && friends.length > 0 && (
          <View style={styles.searchBox}>
            <Search size={16} color={c.dim} />
            <TextInput
              style={styles.searchInput}
              placeholder="Arkadaş ara"
              placeholderTextColor={c.dim}
              value={friendQuery}
              onChangeText={setFriendQuery}
            />
            {friendQuery.length > 0 && (
              <TouchableOpacity onPress={() => setFriendQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color={c.dim} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginVertical: 24 }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptyBox}>
            <Users size={26} color={c.dim} style={{ marginBottom: 8, opacity: 0.6 }} />
            <Text style={styles.emptyText}>Henüz arkadaşın yok.</Text>
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>"{friendQuery}" ile eşleşen arkadaş bulunamadı.</Text>
          </View>
        ) : (
          <View style={styles.friendGrid}>
            {filteredFriends.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.friendCell}
                  onPress={() => toggle(item.id)}
                  activeOpacity={0.7}
                >
                  <View>
                    <RetryImage
                      source={{ uri: avatarOr(item.avatar_url, item.id) }}
                      style={[styles.gridAvatar, isSelected && styles.gridAvatarSelected]}
                    />
                    {isSelected && (
                      <View style={styles.gridCheckBadge}>
                        <Check size={11} color={c.bg} strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* İlk kullanımda filtre duvarı göstermiyoruz. MatchParty'nin ana işi karar vermeyi
            hızlandırmak; power-user ayarları isteğe bağlı olarak aşağı açılıyor. */}
        {friends.length > 0 && (
          <TouchableOpacity style={styles.filterToggle} onPress={() => setShowAdvancedFilters((v) => !v)} activeOpacity={0.85}>
            <View style={styles.filterIconWrap}>
              <SlidersHorizontal size={16} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterTitle}>Filtrelerle Özelleştir</Text>
              <Text style={styles.filterSubtitle}>Tür, yıl, platform ve IMDb puanı seç</Text>
            </View>
            {showAdvancedFilters ? <ChevronUp size={16} color={c.dim} /> : <ChevronDown size={16} color={c.dim} />}
          </TouchableOpacity>
        )}

        {showAdvancedFilters && (
          <View style={styles.advancedWrap}>
            <FilterFields
              typeValue={typePref}
              onTypeChange={setTypePref}
              genreValue={genrePref}
              onGenreChange={setGenrePref}
              yearSet={yearLabels}
              onToggleYear={toggleYear}
              platformSet={platformPrefs}
              onTogglePlatform={togglePlatform}
              platforms={commonPlatforms}
              onShuffleGenre={shuffleGenre}
            />

            <Text style={styles.label}>MİNİMUM IMDB PUANI: {minImdb.toFixed(1)}</Text>
            <ChipRow items={MIN_IMDB_OPTIONS.map(String)} active={String(minImdb)} onSelect={(v) => setMinImdb(parseFloat(v))} />
          </View>
        )}

        {selected.size > 0 && (
          <TouchableOpacity style={styles.goBtn} onPress={createGroupParty} disabled={creating} activeOpacity={0.88}>
            {creating ? <ActivityIndicator size="small" color={c.bg} /> : (
              <>
                {!showAdvancedFilters && <Zap size={17} color={c.bg} fill={c.bg} />}
                <Text style={styles.goBtnText}>
                  {showAdvancedFilters ? `${selected.size} Kişiyle Party Oluştur` : `${selected.size} Kişiyle Hızlı Party Başlat`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    subtitle: { fontSize: 12, color: c.dim, marginBottom: 10, lineHeight: 17 },
    squadRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, paddingLeft: 10 },
    squadAvatar: { width: 36, height: 36, borderRadius: 999, borderWidth: 2, borderColor: c.bg, marginLeft: -10, backgroundColor: c.surface2 },
    squadCount: { fontSize: 11.5, fontWeight: "700", color: c.dim, marginLeft: 12 },
    recentToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
    recentToggleText: { flex: 1, fontSize: 12, fontWeight: "700", color: c.text },
    recentRow: { marginBottom: 10 },
    recentCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 10, marginRight: 10, width: 140,
    },
    recentWith: { fontSize: 11, fontWeight: "700", color: c.text, marginBottom: 6 },
    recentPosters: { flexDirection: "row", gap: 4 },
    recentPoster: { width: 34, height: 50, borderRadius: 6 },
    recentCount: { fontSize: 10, color: c.dim, marginTop: 6, fontWeight: "600" },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 14,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 10 },
    friendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    friendCell: { width: "31%", alignItems: "center", marginBottom: 16 },
    gridAvatar: { width: 68, height: 68, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 2, borderColor: "transparent" },
    gridAvatarSelected: { borderColor: c.accent },
    gridCheckBadge: {
      position: "absolute", bottom: -2, right: 4, width: 20, height: 20, borderRadius: 999,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg,
    },
    gridName: { fontSize: 11.5, fontWeight: "700", color: c.text, marginTop: 6, textAlign: "center" },
    emptyBox: { alignItems: "center", paddingVertical: 24 },
    emptyText: { color: c.dim, fontSize: 12 },

    filterToggle: {
      flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginTop: 4,
    },
    filterIconWrap: { width: 34, height: 34, borderRadius: 11, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    filterTitle: { fontSize: 12.5, fontWeight: "800", color: c.text },
    filterSubtitle: { fontSize: 10.5, color: c.dim, marginTop: 2 },
    advancedWrap: { marginTop: 4 },
    label: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
    goBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 15, marginTop: 14,
    },
    goBtnText: { color: c.bg, fontWeight: "900", fontSize: 13 },
  });
}
