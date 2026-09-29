import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Camera, CheckCircle2, Film, ImagePlus, Search, Send, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import CinemaPicker from "./CinemaPicker";

// Sunucudaki sınırla aynı (social-routes.js → CHECKIN_PHOTO_MAX_BYTES). İstemcide de kontrol
// ediyoruz ki kullanıcı megabaytlarca veriyi yükleyip ancak sonunda "çok büyük" duymasın.
const STORY_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

// Story = fotoğraf (zorunlu) + isteğe bağlı "Sinemadayım", film/dizi ve kısa not. Seçilen film
// story'de GÖRSEL olarak yer almıyor (fotoğraf öne çıksın); izleyicide sadece altta detay düğmesi var. Story'ler ayrı bir tabloda
// (stories), post değil; yalnızca arkadaşlara görünüyor ve 24 saat sonra fotoğrafla birlikte siliniyor.
export default function StoryComposer({ visible, onClose, onCreated }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [photo, setPhoto] = useState(null);            // { uri, dataUri }
  const [cinema, setCinema] = useState(null);
  const [movie, setMovie] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setPhoto(null);
    setCinema(null);
    setMovie(null);
    setQuery("");
    setResults([]);
    setNote("");
    setSending(false);
    setPosted(false);
    setError("");
  }, [visible]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Film/dizi araması — SocialPostComposer'daki ile aynı: önce tekilleştirip alaka düzeyine
  // (tam eşleşme > baştan eşleşme > içeren, eşitlikte oy sayısı) göre sırala, SONRA kes; yoksa
  // çok film sonucu olan aramalarda diziler listeye hiç giremiyor.
  useEffect(() => {
    if (!visible || movie || query.trim().length < 2) {
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
        const matchTier = (title) => {
          const t = (title || "").trim().toLocaleLowerCase("tr-TR");
          return t === normalizedQuery ? 0 : t.startsWith(normalizedQuery) ? 1 : 2;
        };
        setResults(
          [...byId.values()]
            .sort((a, b) => (matchTier(a.title) - matchTier(b.title)) || ((b.votes || 0) - (a.votes || 0)))
            .slice(0, 8)
        );
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, movie, query, auth.token]);

  // Kamera, sohbetteki fotoğraf çekme ile AYNI izin ve modülü kullanıyor — native bir değişiklik
  // gerekmiyor. Kırpma yok: story tam ekran gösteriliyor, iOS'ta allowsEditing kare kırpmaya zorluyor.
  async function pickPhoto(fromCamera = false) {
    setError("");
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(fromCamera ? "Fotoğraf çekmek için kamera izni gerekiyor." : "Fotoğraf eklemek için galeri izni gerekiyor.");
        return;
      }
      const options = { mediaTypes: ["images"], allowsEditing: false, quality: 0.4, base64: true };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) { setError("Fotoğraf okunamadı."); return; }
      const bytes = Math.floor((asset.base64.length * 3) / 4);
      if (bytes > STORY_PHOTO_MAX_BYTES) { setError("Fotoğraf çok büyük (en fazla 4 MB)."); return; }
      // Sohbet/profil fotoğraflarıyla aynı: picker sıkıştırırken JPEG'e çeviriyor (HEIC gelse bile),
      // o yüzden asset.mimeType'a değil sadece PNG istisnasına bakıyoruz — HEIC etiketlenirse
      // Android'de görüntülenemez.
      const mime = asset.mimeType === "image/png" ? "image/png" : "image/jpeg";
      setPhoto({ uri: asset.uri, dataUri: `data:${mime};base64,${asset.base64}` });
    } catch (e) {
      setError("Fotoğraf açılamadı: " + (e?.message || "bilinmeyen hata"));
    }
  }

  async function submit() {
    if (!photo || sending) return;
    setSending(true);
    setError("");
    try {
      await api.socialCreateStory(auth.token, {
        note: note.trim(),
        movieId: movie?.id || undefined,
        cinemaId: cinema?.id || undefined,
        cinemaName: cinema && !cinema.id ? cinema.label : undefined,
        photo: photo.dataUri,
      });
      onCreated?.();
      setSending(false);
      setPosted(true);
      // Kapanmadan önce kısa bir "Paylaşıldı!" anı gösteriyoruz — kullanıcı paylaşımın
      // gerçekten gittiğinden emin olsun diye, sessizce kaybolan bir modal yerine.
      closeTimer.current = setTimeout(() => onClose?.(), 1100);
    } catch (e) {
      setError(e.message || "Story paylaşılamadı.");
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={posted ? undefined : onClose} />
        {posted ? (
          <View style={styles.sheet}>
            <View style={styles.postedWrap}>
              <View style={styles.postedIcon}><CheckCircle2 size={40} color={c.accent} /></View>
              <Text style={styles.postedTitle}>Paylaşıldı!</Text>
              <Text style={styles.postedSubtitle}>Story'n 24 saat boyunca arkadaşlarında görünecek.</Text>
            </View>
          </View>
        ) : (
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Story paylaş</Text>
              <Text style={styles.subtitle}>Bir fotoğraf paylaş, 24 saat sonra kaybolur.</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}><X size={18} color={c.text} /></TouchableOpacity>
          </View>

          {sending && (
            <View style={styles.sendingOverlay} pointerEvents="auto">
              <ActivityIndicator size="large" color={c.accent} />
              <Text style={styles.sendingText}>Fotoğraf yükleniyor…</Text>
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {photo ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
                <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)} accessibilityLabel="Fotoğrafı kaldır">
                  <X size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoButtons}>
                <TouchableOpacity style={styles.photoAdd} onPress={() => pickPhoto(true)} activeOpacity={0.85}>
                  <Camera size={24} color={c.accent} />
                  <Text style={styles.photoAddText}>Kamerayla çek</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoAdd} onPress={() => pickPhoto(false)} activeOpacity={0.85}>
                  <ImagePlus size={24} color={c.accent} />
                  <Text style={styles.photoAddText}>Galeriden seç</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.sectionLabel}>Sinemadayım (isteğe bağlı)</Text>
            <CinemaPicker value={cinema} onChange={setCinema} />

            <Text style={styles.sectionLabel}>Ne izliyorsun? (isteğe bağlı)</Text>
            {movie ? (
              <View style={styles.movieSelected}>
                {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.moviePoster} /> : <View style={[styles.moviePoster, { backgroundColor: c.surface2 }]} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.movieTitle} numberOfLines={2}>{movie.title}</Text>
                  <Text style={styles.movieMeta}>{movie.type || "İçerik"}{movie.year ? ` · ${movie.year}` : ""}</Text>
                </View>
                <TouchableOpacity onPress={() => setMovie(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Filmi kaldır">
                  <X size={16} color={c.dim} />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.searchWrap}>
                  <Search size={15} color={c.dim} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Film veya dizi ara…"
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
                      <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => { setMovie(item); setQuery(""); setResults([]); }}>
                        {item.poster ? <Image source={{ uri: item.poster }} style={styles.resultPoster} /> : <View style={[styles.resultPoster, { backgroundColor: c.surface2 }]} />}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.resultMeta}>{item.type || "İçerik"}{item.year ? ` · ${item.year}` : ""}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
            {!!movie && (
              <View style={styles.movieHint}>
                <Film size={11} color={c.dim} />
                <Text style={styles.movieHintText}>Afiş story'de görünmez; arkadaşların altta detayına gidebilir.</Text>
              </View>
            )}

            <TextInput
              style={styles.noteInput}
              placeholder="Kısa bir not ekle (isteğe bağlı)…"
              placeholderTextColor={c.dim}
              value={note}
              onChangeText={setNote}
              maxLength={140}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={[styles.submit, (!photo || sending) && { opacity: 0.45 }]} onPress={submit} disabled={!photo || sending}>
              {sending ? <ActivityIndicator size="small" color={c.bg} /> : <Send size={15} color={c.bg} />}
              <Text style={styles.submitText}>{photo ? "Story olarak paylaş" : "Önce bir fotoğraf ekle"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.7)" },
    sheet: { width: "100%", maxWidth: 420, maxHeight: "92%", backgroundColor: c.bg, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: c.border, shadowColor: "#000", shadowOpacity: 0.42, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16, position: "relative" },
    sendingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: c.bg, opacity: 0.94, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 10, zIndex: 100, elevation: 100 },
    sendingText: { color: c.dim, fontSize: 12, fontWeight: "700" },
    postedWrap: { alignItems: "center", paddingVertical: 26, gap: 8 },
    postedIcon: { width: 64, height: 64, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    postedTitle: { color: c.text, fontWeight: "900", fontSize: 17 },
    postedSubtitle: { color: c.dim, fontSize: 12, textAlign: "center", lineHeight: 17, maxWidth: 260 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    title: { color: c.text, fontWeight: "900", fontSize: 18 },
    subtitle: { color: c.dim, fontSize: 11, marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    scroll: { flexGrow: 0 },
    photoButtons: { flexDirection: "row", gap: 10 },
    photoAdd: { flex: 1, height: 128, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.accent, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", gap: 9 },
    photoAddText: { color: c.accent, fontSize: 12.5, fontWeight: "800" },
    photoPreviewWrap: { alignSelf: "center" },
    photoPreview: { width: 150, height: 266, borderRadius: 16, backgroundColor: c.surface2 },
    photoRemove: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
    sectionLabel: { color: c.dim, fontSize: 10.5, fontWeight: "800", marginTop: 16, marginBottom: 6 },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 11, minHeight: 42 },
    searchInput: { flex: 1, color: c.text, fontSize: 12.5 },
    results: { marginTop: 7, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface, overflow: "hidden" },
    resultRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    resultPoster: { width: 32, height: 47, borderRadius: 5 },
    resultTitle: { color: c.text, fontWeight: "800", fontSize: 12 },
    resultMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    movieSelected: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface2, padding: 7 },
    moviePoster: { width: 34, height: 50, borderRadius: 5 },
    movieTitle: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    movieMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    movieHint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    movieHintText: { flex: 1, color: c.dim, fontSize: 10, lineHeight: 13 },
    noteInput: { minHeight: 42, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 12, fontSize: 12.5, marginTop: 12, marginBottom: 12 },
    error: { color: c.danger, fontSize: 11, marginBottom: 8 },
    submit: { minHeight: 44, borderRadius: 13, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    submitText: { color: c.bg, fontWeight: "900", fontSize: 13 },
  });
}
