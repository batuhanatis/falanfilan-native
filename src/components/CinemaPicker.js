import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

// Sinema seçici. value: { id, label, place } ya da elle yazılan { id: null, label, place: null }.
// Gönderirken id varsa cinemaId, yoksa cinemaName olarak label gidiyor (sunucu: resolveCinemaFromBody).
export default function CinemaPicker({ value, onChange, placeholder = "Hangi sinemadasın?" }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Kutu boşken de istek atıyoruz: sunucu boş sorguda en çok check-in alan salonları döndürüyor,
  // kullanıcı yazmadan tanıdık bir salon görebilsin.
  useEffect(() => {
    if (value) {
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.cinemas(auth.token, query.trim());
        if (!cancelled) setResults(data.results || []);
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setSearching(false);
    }, query.trim() ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value, query, auth.token]);

  function pick(cinema) {
    setResults([]);
    onChange?.(cinema);
  }

  if (value) {
    return (
      <TouchableOpacity style={styles.selected} onPress={() => { setQuery(""); onChange?.(null); }} activeOpacity={0.85}>
        <View style={styles.icon}><MapPin size={16} color={c.bg} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={2}>{value.label}</Text>
          <Text style={styles.place} numberOfLines={1}>{value.place || "Elle eklendi"}</Text>
        </View>
        <Text style={styles.change}>Değiştir</Text>
      </TouchableOpacity>
    );
  }

  const trimmed = query.trim();
  return (
    <View>
      <View style={styles.searchWrap}>
        <MapPin size={15} color={c.accent} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={c.dim}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={c.accent} />}
      </View>
      {results.length > 0 && (
        <View style={styles.results}>
          {results.slice(0, 6).map((item) => (
            <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => pick(item)}>
              <MapPin size={15} color={c.dim} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.label}</Text>
                {!!item.place && <Text style={styles.resultMeta}>{item.place}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Listede olmayan salon: sonuç listesinin DIŞINDA, kesik çizgili ayrı bir düğme — liste
          kaydı sanılmasın ("CKM listede var ama öyle bir sinema yok" karışıklığı). */}
      {trimmed.length >= 2 && !searching && (
        <>
          {results.length === 0 && <Text style={styles.noResult}>“{trimmed}” listede bulunamadı.</Text>}
          <TouchableOpacity
            style={styles.customBtn}
            onPress={() => pick({ id: null, label: trimmed.slice(0, 80), place: null })}
            activeOpacity={0.85}
          >
            <View style={styles.customPlus}><Text style={styles.customPlusText}>+</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customTitle}>Listede yok mu? Elle ekle</Text>
              <Text style={styles.customSub} numberOfLines={1}>“{trimmed}” adıyla paylaşılır</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
      {/* ODbL atıf zorunluluğu: sinema listesi OpenStreetMap'ten. */}
      <Text style={styles.attribution}>Sinema listesi © OpenStreetMap katkıcıları</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    selected: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.accent, borderRadius: 14, backgroundColor: c.surface2, padding: 10 },
    icon: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    name: { color: c.text, fontSize: 13, fontWeight: "900" },
    place: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    change: { color: c.accent, fontSize: 11, fontWeight: "800" },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 11, minHeight: 42 },
    searchInput: { flex: 1, color: c.text, fontSize: 12.5 },
    results: { marginTop: 7, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface, overflow: "hidden" },
    resultRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    resultTitle: { color: c.text, fontWeight: "800", fontSize: 12 },
    resultMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    noResult: { color: c.dim, fontSize: 11, marginTop: 8 },
    customBtn: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderStyle: "dashed", borderColor: c.accent, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 11 },
    customPlus: { width: 20, height: 20, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    customPlusText: { color: c.accent, fontWeight: "900", fontSize: 13, lineHeight: 16 },
    customTitle: { color: c.accent, fontSize: 12, fontWeight: "800" },
    customSub: { color: c.dim, fontSize: 10.5, marginTop: 1 },
    attribution: { color: c.dim, fontSize: 9, marginTop: 6, opacity: 0.8 },
  });
}
