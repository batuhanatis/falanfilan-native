import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Camera, Check, CheckCircle2, ImagePlus, Search, Send, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import CinemaPicker from "./CinemaPicker";

// Sunucudaki sınırla aynı (social-routes.js → CHECKIN_PHOTO_MAX_BYTES). İstemcide de kontrol
// ediyoruz ki kullanıcı megabaytlarca veriyi yükleyip ancak sonunda "çok büyük" duymasın.
const STORY_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

// SocialPostComposer'daki arama/eşleştirme mantığının küçültülmüş hali — burada tek bir
// içerik seçiliyor, anket/öner modları yok. Story'ler ayrı bir tabloda (stories), post değil.
export default function StoryComposer({ visible, onClose, onCreated }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [movie, setMovie] = useState(null);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");
  // "Sinemadayım": story'ye isteğe bağlı sinema + fotoğraf (eskiden sosyal akışta ayrı bir post modu idi).
  const [cinema, setCinema] = useState(null);
  const [photo, setPhoto] = useState(null);            // { uri, dataUri }
  const searchInputRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setMovie(null);
    setNote("");
    setQuery("");
    setResults([]);
    setSending(false);
    setPosted(false);
    setError("");
    setCinema(null);
    setPhoto(null);
  }, [visible]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

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
        // ÖNEMLİ DÜZELTME: Eskiden filmler diziler ile birleştirilip DOĞRUDAN 12'ye kesiliyordu —
        // aramanın 12'den fazla film sonucu varsa, dizi sonuçları listeye HİÇ GİREMİYORDU (diziler
        // hep filmlerden SONRA ekleniyordu). SocialPostComposer'daki gibi önce tekilleştirip
        // alaka düzeyine (tam eşleşme > baştan eşleşme > içeren, eşitlikte oy sayısı) göre
        // sıralıyoruz, KESME işlemi bu sıralamadan SONRA — böylece film de dizi de en alakalı
        // 12 sonuç arasına adil şekilde girebiliyor.
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
    if (!movie || sending) return;
    setSending(true);
    setError("");
    try {
      await api.socialCreateStory(auth.token, {
        movieId: movie.id,
        note: note.trim(),
        cinemaId: cinema?.id || undefined,
        cinemaName: cinema && !cinema.id ? cinema.label : undefined,
        photo: photo?.dataUri || undefined,
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
              <Text style={styles.subtitle}>Şu an ne izliyorsun? 24 saat sonra kaybolur.</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}><X size={18} color={c.text} /></TouchableOpacity>
          </View>

          {sending && (
            <View style={styles.sendingOverlay} pointerEvents="auto">
              <ActivityIndicator size="large" color={c.accent} />
              <Text style={styles.sendingText}>{photo ? "Fotoğraf yükleniyor…" : "Paylaşılıyor…"}</Text>
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
          {movie ? (
            <TouchableOpacity style={styles.selectedCard} onPress={() => { setMovie(null); requestAnimationFrame(() => searchInputRef.current?.focus()); }}>
              {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.selectedPoster} /> : <View style={[styles.selectedPoster, { backgroundColor: c.surface2 }]} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.selectedTitle} numberOfLines={2}>{movie.title}</Text>
                <Text style={styles.selectedMeta}>{movie.type || "İçerik"} {movie.year ? `· ${movie.year}` : ""}</Text>
              </View>
              <Check size={16} color={c.accent} />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchArea}>
              <View style={styles.searchWrap}>
                <Search size={15} color={c.dim} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Film veya dizi ara…"
                  placeholderTextColor={c.dim}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={c.accent} />}
              </View>
              {/* Sonuçlar artık açılır katman değil, akışın içinde: form bir ScrollView'da ve
                  ScrollView taşan mutlak konumlu katmanı kırpıyor. */}
              {results.length > 0 && (
                <View style={styles.results}>
                  {results.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => { setMovie(item); setQuery(""); setResults([]); }}>
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

          {!!movie && (
            <>
              <Text style={styles.sectionLabel}>Sinemada mısın? (isteğe bağlı)</Text>
              <CinemaPicker value={cinema} onChange={setCinema} />

              <Text style={styles.sectionLabel}>Fotoğraf (isteğe bağlı)</Text>
              {photo ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)} accessibilityLabel="Fotoğrafı kaldır">
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtons}>
                  <TouchableOpacity style={styles.photoAdd} onPress={() => pickPhoto(true)} activeOpacity={0.85}>
                    <Camera size={16} color={c.accent} />
                    <Text style={styles.photoAddText}>Kamerayla çek</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoAdd} onPress={() => pickPhoto(false)} activeOpacity={0.85}>
                    <ImagePlus size={16} color={c.accent} />
                    <Text style={styles.photoAddText}>Galeriden seç</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ height: 12 }} />
            </>
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

          <TouchableOpacity style={[styles.submit, (!movie || sending) && { opacity: 0.45 }]} onPress={submit} disabled={!movie || sending}>
            {sending ? <ActivityIndicator size="small" color={c.bg} /> : <Send size={15} color={c.bg} />}
            <Text style={styles.submitText}>Story olarak paylaş</Text>
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
    searchArea: { marginBottom: 10 },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 11, minHeight: 42 },
    searchInput: { flex: 1, color: c.text, fontSize: 12.5 },
    results: { marginTop: 7, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface, overflow: "hidden" },
    resultRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    resultPoster: { width: 36, height: 53, borderRadius: 6 },
    resultTitle: { color: c.text, fontWeight: "800", fontSize: 12 },
    resultMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    selectedCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface2, padding: 7, marginBottom: 10 },
    selectedPoster: { width: 38, height: 56, borderRadius: 6 },
    selectedTitle: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    selectedMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    noteInput: { minHeight: 42, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 12, fontSize: 12.5, marginBottom: 12 },
    error: { color: c.danger, fontSize: 11, marginBottom: 8 },
    sectionLabel: { color: c.dim, fontSize: 10.5, fontWeight: "800", marginTop: 4, marginBottom: 6 },
    photoButtons: { flexDirection: "row", gap: 8 },
    photoAdd: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderStyle: "dashed", borderColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    photoAddText: { color: c.accent, fontSize: 12, fontWeight: "800" },
    photoPreviewWrap: { alignSelf: "flex-start" },
    photoPreview: { width: 96, height: 170, borderRadius: 12, backgroundColor: c.surface2 },
    photoRemove: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
    submit: { minHeight: 44, borderRadius: 13, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    submitText: { color: c.bg, fontWeight: "900", fontSize: 13 },
  });
}
