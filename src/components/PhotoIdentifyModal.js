import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Camera, Image as ImageIcon, Star, Crown } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticSuccess } from "../utils/haptics";
import IslandModal from "./IslandModal";
import LoadingLines from "./LoadingLines";

const PHOTO_GRADIENT = ["#f7971e", "#ffd200", "#f857a6"];

// PH1 — "Bul"a basınca artık düz bir buton-içi spinner değil, fotoğrafın üzerinde yukarıdan
// aşağıya süzülen bir tarama çizgisi + dönen mikro-metin var ("Shazam anı" — bu özelliğin
// bütün değer önerisi burada, önceden bir yorum listesi yüklemesinden görsel olarak farksızdı).
const SCAN_LOADING_LINES = ["Kareyi inceliyorum…", "Kataloğa bakıyorum…", "Neredeyse buldum…"];

function ScanOverlay() {
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1400, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[scanStyles.line, { transform: [{ translateY }] }]} />
      <View style={scanStyles.tint} />
    </View>
  );
}

const scanStyles = StyleSheet.create({
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
  line: {
    position: "absolute", left: 0, right: 0, height: 3, backgroundColor: "#ffd200",
    shadowColor: "#ffd200", shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
});

// PH2 — sonuçlar artık .map()'in düz, anlık listelemesi yerine sırayla (kademeli) beliriyor.
function ResultRow({ m, index, isTop, onPress, styles, c }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 90),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity style={styles.resultRow} onPress={onPress}>
        {m.poster ? <Image source={{ uri: m.poster }} style={styles.resultPoster} /> : <View style={[styles.resultPoster, { backgroundColor: c.surface2 }]} />}
        <View style={{ flex: 1 }}>
          {/* PH3 — ilk sonuç artık "en iyi eşleşme" rozetiyle öne çıkıyor, diğerleriyle aynı
              ağırlıkta görünmüyor. */}
          {isTop && (
            <View style={styles.topMatchPill}>
              <Crown size={9} color="#fff" fill="#fff" />
              <Text style={styles.topMatchPillText}>En iyi eşleşme</Text>
            </View>
          )}
          <Text style={styles.resultTitle} numberOfLines={1}>{m.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
            <Star size={10} color={c.accent} fill={c.accent} />
            <Text style={styles.resultMeta}>{m.imdb} · {m.year} · {m.type}</Text>
          </View>
          {Number.isFinite(Number(m.matchConfidence)) && (
            <Text style={styles.confidenceText}>Eşleşme güveni %{Math.round(Number(m.matchConfidence) * 100)}</Text>
          )}
          {!!m.matchReason && <Text style={styles.matchReason} numberOfLines={2}>{m.matchReason}</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PhotoIdentifyModal({ onClose, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const styles = makeStyles(c);

  async function pickImage(fromCamera) {
    setError("");
    setResults(null);
    setAnalysis(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin gerekli", "Devam etmek için izin vermelisin."); return; }

    const launch = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
      mediaTypes: ['images'],
      quality: 0.75,
      base64: true,
      allowsEditing: true,
    });
    if (result.canceled) return;
    setImageUri(result.assets[0].uri);
    setImageBase64(result.assets[0].base64);
  }

  async function identify() {
    if (!imageBase64) return;
    setLoading(true);
    setError("");
    try {
      const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
      const data = await api.identifyPhoto(auth.token, dataUrl);
      setAnalysis(data);
      if ((data.results || []).length === 0) {
        setError(data.needsClearerImage
          ? "Bu kare için yeterince güçlü bir eşleşme bulamadım. Yüzün, mekânın veya ekrandaki yazının daha net göründüğü başka bir kare deneyebilir misin?"
          : "Bu fotoğraftan hangi film/dizi olduğunu çıkaramadım, başka bir kare dener misin?");
      } else {
        hapticSuccess(); // PH4 — fotoğrafın filme dönüştüğü an artık fiziksel olarak da hissediliyor.
        setResults(data.results);
      }
    } catch (e) {
      setError(e.message || "Tanımlama başarısız, tekrar dener misin?");
      if (e.limitReached) {
        Alert.alert("Günlük hakkın doldu", e.message, [
          { text: "Tamam", style: "cancel" },
          { text: "Premium'a Geç", onPress: () => { onClose(); navigation.navigate("Premium", { reason: "ai_limit" }); } },
        ]);
      }
    }
    setLoading(false);
  }

  function openMovie(movie) {
    onClose();
    navigation.navigate("Detail", { movie });
  }

  return (
    <IslandModal
      visible
      onClose={onClose}
      title="Fotoğraftan Bul"
      icon={ImageIcon}
      gradientColors={PHOTO_GRADIENT}
      subtitle="Bir sahne/kare yükle, hangi film/diziden olduğunu bulalım. Fotoğraf kaydedilmiyor."
    >
      {imageUri ? (
        <TouchableOpacity onPress={() => pickImage(false)} disabled={loading}>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          {loading && <ScanOverlay />}
        </TouchableOpacity>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(true)}>
            <Camera size={20} color={c.text} />
            <Text style={styles.pickBtnText}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(false)}>
            <ImageIcon size={20} color={c.text} />
            <Text style={styles.pickBtnText}>Galeri</Text>
          </TouchableOpacity>
        </View>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {results && analysis?.confidenceLevel === "medium" && (
        <View style={styles.uncertainBox}>
          <Text style={styles.uncertainTitle}>Tam emin değilim</Text>
          <Text style={styles.uncertainText}>En olası üç eşleşmeyi sıraladım. Doğru olanı seçebilirsin.</Text>
        </View>
      )}

      {imageUri && !results && (
        <TouchableOpacity activeOpacity={0.88} onPress={identify} disabled={loading}>
          <LinearGradient colors={PHOTO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.goBtn}>
            {loading ? (
              <LoadingLines lines={SCAN_LOADING_LINES} style={styles.goBtnText} />
            ) : (
              <Text style={styles.goBtnText}>Bul</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {results && results.map((m, i) => (
        <ResultRow key={m.id} m={m} index={i} isTop={i === 0} onPress={() => openMovie(m)} styles={styles} c={c} />
      ))}

      {/* PH5 — sonuç yanlışsa/eminsen değilse, fotoğrafı baştan seçmeye gerek kalmadan
          aynı kareyle tekrar deneyebiliyorsun. */}
      {results && (
        <TouchableOpacity onPress={() => { setResults(null); setAnalysis(null); }} style={{ alignSelf: "center", marginTop: 14 }}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      )}
    </IslandModal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    pickRow: { flexDirection: "row", gap: 10 },
    pickBtn: {
      flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 14,
      paddingVertical: 24, alignItems: "center", gap: 8,
    },
    pickBtnText: { fontSize: 12, fontWeight: "700", color: c.text },
    preview: { width: "100%", aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: c.surface2 },
    errorText: { color: c.danger, fontSize: 11, marginTop: 14, textAlign: "center" },
    goBtn: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    goBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    resultRow: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: c.surface2, borderRadius: 14, padding: 10, marginTop: 12 },
    resultPoster: { width: 46, height: 66, borderRadius: 8 },
    resultTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    resultMeta: { fontSize: 11, color: c.dim },
    confidenceText: { fontSize: 9.5, fontWeight: "800", color: c.accent2, marginTop: 5 },
    matchReason: { fontSize: 9.5, lineHeight: 12.5, color: c.dim, marginTop: 3 },
    uncertainBox: { marginTop: 13, padding: 11, borderRadius: 12, backgroundColor: "rgba(248,87,166,0.10)", borderWidth: 1, borderColor: "rgba(248,87,166,0.28)" },
    uncertainTitle: { color: c.text, fontSize: 11.5, fontWeight: "800" },
    uncertainText: { color: c.dim, fontSize: 10.5, lineHeight: 14, marginTop: 3 },
    topMatchPill: {
      flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f857a6",
      alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4,
    },
    topMatchPillText: { fontSize: 8.5, fontWeight: "800", color: "#fff" },
    retryText: { fontSize: 12, fontWeight: "700", color: c.dim, textDecorationLine: "underline" },
  });
}
