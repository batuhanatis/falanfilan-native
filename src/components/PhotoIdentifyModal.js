import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, TouchableWithoutFeedback } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { X, Camera, Image as ImageIcon, Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";

export default function PhotoIdentifyModal({ onClose, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const styles = makeStyles(c);

  async function pickImage(fromCamera) {
    setError("");
    setResults(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin gerekli", "Devam etmek için izin vermelisin."); return; }

    const launch = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
      mediaTypes: ['images'],
      quality: 0.5,
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
      if ((data.results || []).length === 0) {
        setError(data.guess ? `"${data.guess}" olabilir diye düşündüm ama kataloğumuzda bulamadım.` : "Bu fotoğraftan hangi film/dizi olduğunu çıkaramadım, başka bir kare dener misin?");
      } else {
        setResults(data.results);
      }
    } catch (e) {
      setError(e.message || "Tanımlama başarısız, tekrar dener misin?");
      if (e.limitReached) {
        Alert.alert("Günlük hakkın doldu", e.message, [
          { text: "Tamam", style: "cancel" },
          { text: "Premium'a Geç", onPress: () => { onClose(); navigation.navigate("Premium"); } },
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
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={styles.sheet} handleOnly>
          <LinearGradient colors={["#f7971e", "#ffd200", "#f857a6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            <View style={styles.header}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ImageIcon size={18} color="#fff" />
                <Text style={styles.headerTitle}>Fotoğraftan Bul</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#fff" /></TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>Bir sahne/kare yükle, hangi film/diziden olduğunu bulalım. Fotoğraf kaydedilmiyor.</Text>
          </LinearGradient>

          <View style={{ padding: 20 }}>
            {imageUri ? (
              <TouchableOpacity onPress={() => pickImage(false)}>
                <Image source={{ uri: imageUri }} style={styles.preview} />
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

            {imageUri && !results && (
              <TouchableOpacity style={styles.goBtn} onPress={identify} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.goBtnText}>Bul</Text>}
              </TouchableOpacity>
            )}

            {results && results.map((m) => (
              <TouchableOpacity key={m.id} style={styles.resultRow} onPress={() => openMovie(m)}>
                {m.poster ? <Image source={{ uri: m.poster }} style={styles.resultPoster} /> : <View style={[styles.resultPoster, { backgroundColor: c.surface2 }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{m.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <Star size={10} color={c.accent} fill={c.accent} />
                    <Text style={styles.resultMeta}>{m.imdb} · {m.year} · {m.type}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </DismissableSheet>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden", maxHeight: "85%" },
    headerGradient: { padding: 20 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
    headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.9)", marginTop: 6, lineHeight: 16 },
    closeBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    pickRow: { flexDirection: "row", gap: 10 },
    pickBtn: {
      flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 14,
      paddingVertical: 24, alignItems: "center", gap: 8,
    },
    pickBtnText: { fontSize: 12, fontWeight: "700", color: c.text },
    preview: { width: "100%", aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: c.surface2 },
    errorText: { color: c.danger, fontSize: 11, marginTop: 14, textAlign: "center" },
    goBtn: { marginTop: 16, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    goBtnText: { color: "#14121a", fontWeight: "800", fontSize: 13 },
    resultRow: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: c.surface2, borderRadius: 14, padding: 10, marginTop: 12 },
    resultPoster: { width: 46, height: 66, borderRadius: 8 },
    resultTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    resultMeta: { fontSize: 11, color: c.dim },
  });
}
