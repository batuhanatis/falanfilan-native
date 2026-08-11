import React, { useState, useEffect } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Search, Star, X, Check } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

// Onboarding'deki "en sevdiğin film/dizi" alanları için — Ana Sayfa'daki arama dropdown'uyla
// AYNI görsel dil: kutunun altında, popülerliğe göre sıralı bir sonuç listesi. Bir şey
// seçildiğinde arama kutusu yerini, seçimi net gösteren "onaylandı" kartına bırakıyor.
export default function FavoritePicker({ label, type, value, onSelect }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      api.search(auth.token, query, type === "Film" ? "movie" : "tv")
        .then((data) => setResults((data.results || []).sort((a, b) => (b.votes || 0) - (a.votes || 0))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, type]);

  function pick(item) {
    onSelect(item);
    setQuery("");
    setFocused(false);
  }

  const dropdownOpen = focused && query.trim().length > 0;

  // ÖNEMLİ: Aynı ekranda birden fazla FavoritePicker alt alta dururken (ör. "en sevdiğin film" +
  // "en sevdiğin dizi"), dropdown'u açık olan hangisiyse o, SONRAKİ kardeşinin (aynı zIndex'teki
  // varsayılan DOM sırası kazanır) üzerine çıkabilsin diye zIndex'i sadece açıkken yükseltiyoruz.
  return (
    <View style={{ zIndex: dropdownOpen ? 50 : 1 }}>
      <Text style={styles.label}>{label}</Text>

      {value ? (
        <View style={styles.selectedCard}>
          {value.poster ? (
            <Image source={{ uri: value.poster }} style={styles.selectedPoster} />
          ) : (
            <View style={[styles.selectedPoster, { backgroundColor: c.surface2 }]} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.selectedCheckRow}>
              <Check size={12} color={c.accent} />
              <Text style={styles.selectedCheckText}>Seçildi</Text>
            </View>
            <Text style={styles.selectedTitle} numberOfLines={2}>{value.title}</Text>
            <Text style={styles.selectedMeta} numberOfLines={1}>{value.year} · ⭐ {value.imdb}</Text>
          </View>
          <TouchableOpacity onPress={() => onSelect(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={c.dim} />
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
            <Search size={15} color={focused ? c.accent : c.dim} />
            <TextInput
              style={styles.input}
              placeholder={type === "Film" ? "Bir film ara..." : "Bir dizi ara..."}
              placeholderTextColor={c.dim}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>

          {dropdownOpen && (
            <View style={styles.dropdown}>
              {loading ? (
                <ActivityIndicator style={{ paddingVertical: 18 }} color={c.accent} />
              ) : results.length === 0 ? (
                <Text style={styles.dropdownEmpty}>"{query}" için sonuç bulunamadı</Text>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 260 }}>
                  {results.slice(0, 8).map((item) => (
                    <TouchableOpacity key={item.id} style={styles.dropdownRow} onPress={() => pick(item)} activeOpacity={0.7}>
                      {item.poster ? (
                        <Image source={{ uri: item.poster }} style={styles.dropdownPoster} />
                      ) : (
                        <View style={[styles.dropdownPoster, { backgroundColor: c.surface2 }]} />
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.dropdownTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.dropdownMeta} numberOfLines={1}>{item.year}</Text>
                      </View>
                      <View style={styles.dropdownRating}>
                        <Star size={10} color={c.accent} fill={c.accent} />
                        <Text style={styles.dropdownRatingText}>{item.imdb}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    label: { fontSize: 11, fontWeight: "800", color: c.dim, letterSpacing: 0.4, marginBottom: 8 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchBoxFocused: { borderColor: c.accent },
    input: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 11 },
    dropdown: {
      position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, zIndex: 30,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
      overflow: "hidden",
    },
    dropdownEmpty: { fontSize: 12, color: c.dim, textAlign: "center", paddingVertical: 18, paddingHorizontal: 16 },
    dropdownRow: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    dropdownPoster: { width: 32, height: 46, borderRadius: 6 },
    dropdownTitle: { fontSize: 12.5, fontWeight: "700", color: c.text },
    dropdownMeta: { fontSize: 10.5, color: c.dim, marginTop: 2 },
    dropdownRating: { flexDirection: "row", alignItems: "center", gap: 3 },
    dropdownRatingText: { fontSize: 10.5, fontWeight: "800", color: c.text },
    selectedCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.accent, borderRadius: 14, padding: 10,
    },
    selectedPoster: { width: 44, height: 64, borderRadius: 8 },
    selectedCheckRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    selectedCheckText: { fontSize: 9.5, fontWeight: "800", color: c.accent, letterSpacing: 0.3 },
    selectedTitle: { fontSize: 13, fontWeight: "800", color: c.text, marginTop: 2 },
    selectedMeta: { fontSize: 11, color: c.dim, marginTop: 2 },
  });
}
