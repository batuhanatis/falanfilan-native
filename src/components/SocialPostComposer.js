import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ImagePlus, Lock, MapPin, Search, Send, Sparkles, Swords, Ticket, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const MODES = [
  ["thought", "Bir şey söyle"],
  ["recommend", "Öner"],
  ["poll", "Anket"],
  ["checkin", "Sinemadayım"],
];

// Sunucudaki sınırla aynı (social-routes.js → CHECKIN_PHOTO_MAX_BYTES). İstemcide de kontrol
// ediyoruz ki kullanıcı megabaytlarca veriyi yükleyip ancak sonunda "çok büyük" duymasın.
const CHECKIN_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export default function SocialPostComposer({ visible, initialMovie = null, initialType = null, initialContext = null, presentation = "sheet", onClose, onCreated }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets), [c, insets.top, insets.bottom, insets.left, insets.right]);
  const [mode, setMode] = useState(initialType || (initialMovie ? "recommend" : "thought"));
  const [body, setBody] = useState("");
  const [movie, setMovie] = useState(initialMovie);
  const [pollA, setPollA] = useState(initialType === "poll" ? initialMovie : null);
  const [pollB, setPollB] = useState(null);
  const [selecting, setSelecting] = useState(initialType === "poll" && initialMovie ? "b" : "a");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const searchInputRef = useRef(null);
  // "Sinemadayım"
  const [cinema, setCinema] = useState(null);          // { id, label, place } ya da elle yazılan { id: null, label }
  const [cinemaQuery, setCinemaQuery] = useState("");
  const [cinemaResults, setCinemaResults] = useState([]);
  const [cinemaSearching, setCinemaSearching] = useState(false);
  const [photo, setPhoto] = useState(null);            // { uri, dataUri }
  const island = presentation === "island";

  useEffect(() => {
    if (!visible) return;
    const nextMode = initialType || (initialMovie ? "recommend" : "thought");
    setMode(nextMode);
    setBody("");
    setMovie(nextMode === "recommend" ? initialMovie : null);
    setPollA(nextMode === "poll" ? initialMovie : null);
    setPollB(null);
    setSelecting(nextMode === "poll" && initialMovie ? "b" : "a");
    setQuery("");
    setResults([]);
    setError("");
    setCinema(null);
    setCinemaQuery("");
    setCinemaResults([]);
    setPhoto(null);
  }, [visible, initialMovie?.id, initialType, initialContext]);

  // Sinema araması. Kutu boşken de istek atıyoruz: sunucu boş sorguda en çok check-in alan
  // salonları döndürüyor, kullanıcı yazmadan tanıdık bir salon görebilsin.
  useEffect(() => {
    if (!visible || mode !== "checkin" || cinema) {
      setCinemaSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCinemaSearching(true);
      try {
        const data = await api.cinemas(auth.token, cinemaQuery.trim());
        if (!cancelled) setCinemaResults(data.results || []);
      } catch {
        if (!cancelled) setCinemaResults([]);
      }
      if (!cancelled) setCinemaSearching(false);
    }, cinemaQuery.trim() ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, mode, cinema, cinemaQuery, auth.token]);

  async function pickPhoto() {
    setError("");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError("Fotoğraf eklemek için galeri izni gerekiyor."); return; }
      // Sohbet fotoğraflarıyla aynı sıkıştırma; kırpma 4:5'e zorluyor ki akışta her kart aynı oranda dursun.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) { setError("Fotoğraf okunamadı."); return; }
      const bytes = Math.floor((asset.base64.length * 3) / 4);
      if (bytes > CHECKIN_PHOTO_MAX_BYTES) { setError("Fotoğraf çok büyük (en fazla 4 MB)."); return; }
      const mime = asset.mimeType && asset.mimeType.startsWith("image/") ? asset.mimeType : "image/jpeg";
      setPhoto({ uri: asset.uri, dataUri: `data:${mime};base64,${asset.base64}` });
    } catch (e) {
      setError("Fotoğraf açılamadı: " + (e?.message || "bilinmeyen hata"));
    }
  }

  useEffect(() => {
    if (!visible || mode === "thought" || (mode === "checkin" && !cinema) || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const [movies, shows] = await Promise.all([
          api.search(auth.token, query.trim(), "movie"),
          api.search(auth.token, query.trim(), "tv"),
        ]);
        if (cancelled) return;
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
        const merged = [...byId.values()]
          .sort((a, b) => {
            const tierDiff = matchTier(a.title) - matchTier(b.title);
            if (tierDiff !== 0) return tierDiff;
            return (b.votes || 0) - (a.votes || 0);
          })
          .slice(0, 12);
        setResults(merged);
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, mode, cinema, query, auth.token]);

  function choose(item) {
    if (mode === "recommend" || mode === "checkin") {
      setMovie(item);
      setQuery("");
      setResults([]);
      return;
    }
    if (selecting === "a") {
      if (Number(pollB?.id) === Number(item.id)) return;
      setPollA(item);
      setSelecting("b");
    } else {
      if (Number(pollA?.id) === Number(item.id)) return;
      setPollB(item);
    }
    setQuery("");
    setResults([]);
  }

  const canSend = mode === "thought" ? !!body.trim()
    : mode === "recommend" ? !!movie
    : mode === "checkin" ? !!cinema
    : !!pollA && !!pollB && Number(pollA.id) !== Number(pollB.id);

  async function submit() {
    if (!canSend || sending) return;
    setSending(true);
    setError("");
    try {
      const answer = body.trim();
      const outgoingBody = initialContext
        ? `🔥 Günün Sorusu: ${initialContext}${answer ? `\n\n${answer}` : ""}`
        : answer;
      await api.socialCreatePost(auth.token, {
        type: mode,
        body: outgoingBody,
        movieId: mode === "recommend" || mode === "checkin" ? movie?.id : undefined,
        pollMovieAId: mode === "poll" ? pollA?.id : undefined,
        pollMovieBId: mode === "poll" ? pollB?.id : undefined,
        ...(mode === "checkin"
          ? {
              cinemaId: cinema?.id || undefined,
              cinemaName: cinema?.id ? undefined : cinema?.label,
              photo: photo?.dataUri || undefined,
            }
          : {}),
      });
      onCreated?.();
      onClose?.();
    } catch (e) {
      setError(e.message || "Paylaşım oluşturulamadı.");
    }
    setSending(false);
  }

  function selectedCard(item, slot) {
    if (!item) {
      return (
        <TouchableOpacity style={[styles.selectedCard, styles.selectedEmpty]} onPress={() => setSelecting(slot)}>
          <Search size={16} color={c.dim} />
          <Text style={styles.selectedEmptyText}>{slot === "a" ? "1. içeriği seç" : "2. içeriği seç"}</Text>
        </TouchableOpacity>
      );
    }
    const editSelection = () => {
      setQuery("");
      setResults([]);
      setSelecting(slot);
      if (mode === "recommend" || mode === "checkin") setMovie(null);
      else if (slot === "a") setPollA(null);
      else setPollB(null);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    };
    return (
      <TouchableOpacity style={[styles.selectedCard, mode === "poll" && selecting === slot && { borderColor: c.accent }]} onPress={editSelection}>
        {item.poster ? <Image source={{ uri: item.poster }} style={styles.selectedPoster} /> : <View style={[styles.selectedPoster, { backgroundColor: c.surface2 }]} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.selectedTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.selectedMeta}>{item.type || "İçerik"} {item.year ? `· ${item.year}` : ""}</Text>
        </View>
        <Check size={16} color={c.accent} />
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} transparent animationType={island ? "fade" : "slide"} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, island && styles.backdropIsland]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, island && styles.sheetIsland]}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Taste Post</Text>
                <Text style={styles.subtitle}>Zevkini paylaş, sohbeti başlat.</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}><X size={18} color={c.text} /></TouchableOpacity>
            </View>

            {/* Dört mod küçük ekranlarda tek satıra sığmıyor; yatay kaydırılabilir satır. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow} style={styles.modeScroll} keyboardShouldPersistTaps="handled">
              {MODES.map(([id, label]) => (
                <TouchableOpacity key={id} style={[styles.modeChip, mode === id && styles.modeChipActive]} onPress={() => { setMode(id); setError(""); }}>
                  {id === "recommend" ? <Sparkles size={12} color={mode === id ? c.bg : c.dim} />
                    : id === "poll" ? <Swords size={12} color={mode === id ? c.bg : c.dim} />
                    : id === "checkin" ? <Ticket size={12} color={mode === id ? c.bg : c.dim} />
                    : null}
                  <Text style={[styles.modeText, mode === id && styles.modeTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {mode === "checkin" && (
              cinema ? (
                <TouchableOpacity style={styles.cinemaSelected} onPress={() => { setCinema(null); setCinemaQuery(""); }} activeOpacity={0.85}>
                  <View style={styles.cinemaIcon}><MapPin size={16} color={c.bg} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cinemaName} numberOfLines={2}>{cinema.label}</Text>
                    <Text style={styles.cinemaPlace} numberOfLines={1}>{cinema.place || "Elle eklendi"}</Text>
                  </View>
                  <Text style={styles.cinemaChange}>Değiştir</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.searchArea}>
                  <View style={styles.searchWrap}>
                    <MapPin size={15} color={c.accent} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Hangi sinemadasın?"
                      placeholderTextColor={c.dim}
                      value={cinemaQuery}
                      onChangeText={setCinemaQuery}
                      autoCorrect={false}
                    />
                    {cinemaSearching && <ActivityIndicator size="small" color={c.accent} />}
                  </View>
                  {cinemaResults.length > 0 && (
                    <View style={styles.results}>
                      {cinemaResults.slice(0, 8).map((item) => (
                        <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => { setCinema(item); setCinemaResults([]); }}>
                          <MapPin size={15} color={c.dim} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.resultTitle} numberOfLines={1}>{item.label}</Text>
                            {!!item.place && <Text style={styles.resultMeta}>{item.place}</Text>}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {/* Listede olmayan salon. ÖNEMLİ: bu seçenek eskiden sonuç listesinin İÇİNDE, sonuçlarla
                      aynı görünümde duruyordu ve bir liste kaydı sanılıyordu ("CKM listede var ama öyle bir
                      sinema yok"). Artık listenin dışında, kesik çizgili ayrı bir düğme; aramada sonuç
                      çıkmadığında da bunu açıkça söylüyor. */}
                  {cinemaQuery.trim().length >= 2 && !cinemaSearching && (
                    <>
                      {cinemaResults.length === 0 && (
                        <Text style={styles.noCinemaText}>“{cinemaQuery.trim()}” listede bulunamadı.</Text>
                      )}
                      <TouchableOpacity
                        style={styles.customCinemaBtn}
                        onPress={() => { setCinema({ id: null, label: cinemaQuery.trim().slice(0, 80), place: null }); setCinemaResults([]); }}
                        activeOpacity={0.85}
                      >
                        <View style={styles.customPlus}><Text style={styles.customPlusText}>+</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.customCinemaTitle}>Listede yok mu? Elle ekle</Text>
                          <Text style={styles.customCinemaSub} numberOfLines={1}>“{cinemaQuery.trim()}” adıyla paylaşılır</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  )}
                  {/* ODbL atıf zorunluluğu: sinema listesi OpenStreetMap'ten. */}
                  <Text style={styles.attribution}>Sinema listesi © OpenStreetMap katkıcıları</Text>
                </View>
              )
            )}

            {!!initialContext && (
              <View style={styles.contextCard}>
                <Text style={styles.contextEyebrow}>🔥 GÜNÜN SORUSU</Text>
                <Text style={styles.contextText}>{initialContext}</Text>
                {mode !== "thought" && <Text style={styles.contextHint}>{mode === "recommend" ? "Cevap olarak bir film veya dizi seç." : "Cevabını iki içeriği kapıştırarak ver."}</Text>}
              </View>
            )}

            <TextInput
              style={styles.bodyInput}
              placeholder={mode === "checkin" ? "Nasıl geçiyor? (isteğe bağlı)…" : mode === "poll" ? "Kısa bir not ekle (isteğe bağlı)…" : mode === "recommend" ? (initialContext ? "Neden bu içerik? (isteğe bağlı)…" : "Neden öneriyorsun? (isteğe bağlı)…") : initialContext ? "Cevabını yaz…" : "Aklında ne var?"}
              placeholderTextColor={c.dim}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={800}
            />

            {(mode === "recommend" || mode === "checkin") && movie && selectedCard(movie, "a")}
            {mode === "poll" && (
              <View style={styles.pollSelectedRow}>
                <View style={{ flex: 1 }}>{selectedCard(pollA, "a")}</View>
                <Text style={styles.vs}>VS</Text>
                <View style={{ flex: 1 }}>{selectedCard(pollB, "b")}</View>
              </View>
            )}

            {mode !== "thought" && ((mode === "recommend" && !movie) || mode === "poll" || (mode === "checkin" && !!cinema && !movie)) && (
              <View style={styles.searchArea}>
                <View style={styles.searchWrap}>
                  <Search size={15} color={c.dim} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    placeholder={mode === "poll" ? `${selecting === "a" ? "1." : "2."} içeriği ara…` : mode === "checkin" ? "Ne izliyorsun? (isteğe bağlı)" : "Film veya dizi ara…"}
                    placeholderTextColor={c.dim}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                  />
                  {searching && <ActivityIndicator size="small" color={c.accent} />}
                </View>

                {results.length > 0 && (
                  <View style={styles.results}>
                    {results.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => choose(item)}>
                        {item.poster ? <Image source={{ uri: item.poster }} style={styles.resultPoster} /> : <View style={[styles.resultPoster, { backgroundColor: c.surface2 }]} />}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.resultMeta}>{item.type || "İçerik"} {item.year ? `· ${item.year}` : ""}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {mode === "checkin" && !!cinema && (
              photo ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)} accessibilityLabel="Fotoğrafı kaldır">
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto} activeOpacity={0.85}>
                  <ImagePlus size={16} color={c.accent} />
                  <Text style={styles.photoAddText}>Fotoğraf ekle (isteğe bağlı)</Text>
                </TouchableOpacity>
              )
            )}

            {mode === "checkin" && (
              <View style={styles.privacyNote}>
                <Lock size={11} color={c.dim} />
                <Text style={styles.privacyText}>Yalnızca arkadaşların görür. Konumun paylaşılmaz, sadece sinemanın adı.</Text>
              </View>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={[styles.submit, (!canSend || sending) && { opacity: 0.45 }]} onPress={submit} disabled={!canSend || sending}>
              {sending ? <ActivityIndicator size="small" color={c.bg} /> : <Send size={15} color={c.bg} />}
              <Text style={styles.submitText}>Paylaş</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    backdropIsland: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: Math.max(16, insets.top + 8),
      paddingBottom: Math.max(16, insets.bottom + 8),
      backgroundColor: "rgba(0,0,0,0.7)",
    },
    sheet: { maxHeight: "88%", backgroundColor: c.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: c.border },
    sheetIsland: { width: "100%", maxWidth: 420, borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.42, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
    sheetContent: { padding: 16, paddingBottom: Math.max(18, insets.bottom + 14) },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    title: { color: c.text, fontWeight: "900", fontSize: 18 },
    subtitle: { color: c.dim, fontSize: 11, marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    modeScroll: { marginBottom: 12, flexGrow: 0 },
    modeRow: { flexDirection: "row", gap: 7 },
    modeChip: { minHeight: 36, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    modeChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    modeText: { color: c.dim, fontSize: 11, fontWeight: "800" },
    modeTextActive: { color: c.bg },
    contextCard: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.accent, borderRadius: 14, padding: 11, marginBottom: 10 },
    contextEyebrow: { color: c.accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 },
    contextText: { color: c.text, fontSize: 12.5, fontWeight: "800", lineHeight: 18, marginTop: 4 },
    contextHint: { color: c.dim, fontSize: 10.5, lineHeight: 15, marginTop: 6 },
    bodyInput: { minHeight: 86, maxHeight: 140, textAlignVertical: "top", color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 15, padding: 12, fontSize: 13, marginBottom: 10 },
    searchArea: { marginTop: 8, marginBottom: 2 },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 11, minHeight: 42 },
    searchInput: { flex: 1, color: c.text, fontSize: 12.5 },
    results: { marginTop: 7, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface, overflow: "hidden" },
    resultRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    resultPoster: { width: 36, height: 53, borderRadius: 6 },
    resultTitle: { color: c.text, fontWeight: "800", fontSize: 12 },
    resultMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    selectedCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface2, padding: 7 },
    selectedEmpty: { justifyContent: "center", flexDirection: "column", gap: 5 },
    selectedEmptyText: { color: c.dim, fontSize: 10.5, fontWeight: "700", textAlign: "center" },
    selectedPoster: { width: 38, height: 56, borderRadius: 6 },
    selectedTitle: { color: c.text, fontSize: 11, fontWeight: "800" },
    selectedMeta: { color: c.dim, fontSize: 9, marginTop: 2 },
    pollSelectedRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
    vs: { color: c.accent, fontWeight: "900", fontSize: 10 },
    error: { color: c.danger, fontSize: 11, marginTop: 8 },
    cinemaSelected: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.accent, borderRadius: 14, backgroundColor: c.surface2, padding: 10, marginBottom: 10 },
    cinemaIcon: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    cinemaName: { color: c.text, fontSize: 13, fontWeight: "900" },
    cinemaPlace: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    cinemaChange: { color: c.accent, fontSize: 11, fontWeight: "800" },
    customPlus: { width: 20, height: 20, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    customPlusText: { color: c.accent, fontWeight: "900", fontSize: 13, lineHeight: 16 },
    attribution: { color: c.dim, fontSize: 9, marginTop: 6, marginBottom: 8, opacity: 0.8 },
    noCinemaText: { color: c.dim, fontSize: 11, marginTop: 8 },
    customCinemaBtn: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderStyle: "dashed", borderColor: c.accent, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 11 },
    customCinemaTitle: { color: c.accent, fontSize: 12, fontWeight: "800" },
    customCinemaSub: { color: c.dim, fontSize: 10.5, marginTop: 1 },
    photoAdd: { marginTop: 10, minHeight: 44, borderRadius: 13, borderWidth: 1, borderStyle: "dashed", borderColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    photoAddText: { color: c.accent, fontSize: 12, fontWeight: "800" },
    photoPreviewWrap: { marginTop: 10, alignSelf: "flex-start" },
    photoPreview: { width: 120, height: 150, borderRadius: 12, backgroundColor: c.surface2 },
    photoRemove: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
    privacyNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
    privacyText: { flex: 1, color: c.dim, fontSize: 10.5, lineHeight: 14 },
    submit: { marginTop: 12, minHeight: 44, borderRadius: 13, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    submitText: { color: c.bg, fontWeight: "900", fontSize: 13 },
  });
}
