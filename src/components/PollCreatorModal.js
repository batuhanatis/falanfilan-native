import React, { useState, useEffect, useRef } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { X, Search, Check, BarChart2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";

// Sohbette "hangisini izleyelim?" tarzı bir mini anket oluşturmak için — 2-3 film/dizi seçip
// arkadaşınla oylama yapabiliyorsunuz. Seçenek olarak gerçek film/dizi verisi (poster dahil)
// kullanıyoruz, düz metin değil — bu, sonuçtaki anket kartını çok daha zengin gösteriyor.
export default function PollCreatorModal({ visible, onClose, onSubmit }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [question, setQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]); // en fazla 3 film/dizi

  useEffect(() => {
    if (!visible) { setQuestion(""); setQuery(""); setResults([]); setSelected([]); }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      // ÖNEMLİ DÜZELTME: Eskiden sadece "movie" aranıyordu, diziler bu ankete hiç seçenek
      // olamıyordu. Ana sayfadaki aramayla aynı mantık: film+dizi birleştir, alaka düzeyine
      // (tam eşleşme > baştan eşleşme > içeren, eşitlikte oy sayısı) göre sırala.
      Promise.all([
        api.search(auth.token, query.trim(), "movie"),
        api.search(auth.token, query.trim(), "tv"),
      ])
        .then(([movies, shows]) => {
          const byId = new Map();
          [...(movies.results || []), ...(shows.results || [])].forEach((item) => {
            if (item?.id) byId.set(item.id, item);
          });
          const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
          function matchTier(title) {
            const normalizedTitle = (title || "").trim().toLocaleLowerCase("tr-TR");
            if (normalizedTitle === normalizedQuery) return 0;
            if (normalizedTitle.startsWith(normalizedQuery)) return 1;
            return 2;
          }
          setResults([...byId.values()].sort((a, b) => {
            const tierDiff = matchTier(a.title) - matchTier(b.title);
            if (tierDiff !== 0) return tierDiff;
            return (b.votes || 0) - (a.votes || 0);
          }));
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  function toggleSelect(movie) {
    setSelected((prev) => {
      if (prev.some((m) => m.id === movie.id)) return prev.filter((m) => m.id !== movie.id);
      if (prev.length >= 3) return prev; // en fazla 3 seçenek
      return [...prev, movie];
    });
  }

  function handleSubmit() {
    if (selected.length < 2) return; // en az 2 seçenek gerekli, anlamlı bir anket için
    // ÖNEMLİ: Sadece id/title/poster değil, arama sonucundan gelen TAM film verisini (IMDB
    // puanı, platform bilgisi vs.) saklıyoruz — aksi halde anketteki bir postere tıklayıp detay
    // sayfasına gidince her şey boş gelirdi (aktivite akışında yaşadığımız aynı hataydı).
    const options = selected;
    onSubmit(question.trim() || "Hangisini izleyelim?", options);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={styles.sheet} handleOnly>
              <View style={styles.header}>
                <Text style={styles.title}>Mini Anket Oluştur</Text>
                <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
              </View>

              <TextInput
                style={styles.questionInput}
                placeholder="Soru (opsiyonel) — ör. Bu akşam ne izlesek?"
                placeholderTextColor={c.dim}
                value={question}
                onChangeText={setQuestion}
              />

              {selected.length > 0 && (
                <View style={styles.selectedRow}>
                  {selected.map((m) => (
                    <TouchableOpacity key={m.id} style={styles.selectedChip} onPress={() => toggleSelect(m)}>
                      {m.poster ? <Image source={{ uri: m.poster }} style={styles.selectedPoster} /> : <View style={[styles.selectedPoster, { backgroundColor: c.surface2 }]} />}
                      <View style={styles.selectedCheckBadge}><Check size={10} color="#fff" /></View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.searchBox}>
                <Search size={15} color={c.dim} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Film ara..."
                  placeholderTextColor={c.dim}
                  value={query}
                  onChangeText={setQuery}
                />
              </View>

              {loading ? (
                <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} />
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => String(item.id)}
                  style={{ maxHeight: 220 }}
                  renderItem={({ item }) => {
                    const isSelected = selected.some((m) => m.id === item.id);
                    return (
                      <TouchableOpacity style={styles.resultRow} onPress={() => toggleSelect(item)}>
                        {item.poster ? <Image source={{ uri: item.poster }} style={styles.resultPoster} /> : <View style={[styles.resultPoster, { backgroundColor: c.surface2 }]} />}
                        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                        {isSelected && <Check size={16} color={c.accent} />}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={query.trim() ? <Text style={styles.emptyText}>Sonuç bulunamadı.</Text> : null}
                />
              )}

              <TouchableOpacity
                style={[styles.submitBtn, selected.length < 2 && { opacity: 0.4 }]}
                onPress={handleSubmit}
                disabled={selected.length < 2}
              >
                <BarChart2 size={16} color={c.bg} />
                <Text style={styles.submitBtnText}>
                  {selected.length < 2 ? "En az 2 seçenek seç" : `Anketi Gönder (${selected.length})`}
                </Text>
              </TouchableOpacity>
            </DismissableSheet>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { fontSize: 16, fontWeight: "800", color: c.text },
    questionInput: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 11, color: c.text, fontSize: 13, marginBottom: 12,
    },
    selectedRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    selectedChip: { position: "relative" },
    selectedPoster: { width: 44, height: 64, borderRadius: 8 },
    selectedCheckBadge: {
      position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 999,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.surface,
    },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 10 },
    resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
    resultPoster: { width: 32, height: 46, borderRadius: 6 },
    resultTitle: { flex: 1, fontSize: 13, color: c.text, fontWeight: "600" },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 14 },
    submitBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, marginTop: 12,
    },
    submitBtnText: { color: c.bg, fontWeight: "800", fontSize: 13.5 },
  });
}
