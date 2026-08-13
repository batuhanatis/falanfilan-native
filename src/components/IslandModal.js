import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

// Bottom-sheet'in (DismissableSheet) tersine — ne alttan ne üstten açılıyor, ekranın TAM
// ORTASINDA, dört köşesi de yuvarlak bir "ada" olarak beliriyor. Filtre gibi kısa süreli,
// odaklı bir karar anına daha çok yakışıyor — sayfanın bir parçası gibi değil, kendi başına
// küçük bir an gibi hissettiriyor. Hem Ana Sayfa'nın filtre paneli hem "Zevkine Göre Öner"
// bunu paylaşıyor.
export default function IslandModal({ visible, onClose, title, icon: Icon, gradientColors, subtitle, children }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
                <View style={styles.headerRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    {!!Icon && <Icon size={18} color="#fff" />}
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
                {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
              </LinearGradient>
              <ScrollView style={styles.body} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 22 },
    card: {
      width: "100%", maxWidth: 420, maxHeight: "84%", backgroundColor: c.surface, borderRadius: 26, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 30, elevation: 20,
    },
    header: { padding: 18 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { fontSize: 15.5, fontWeight: "800", color: "#fff" },
    headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 6 },
    closeBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    body: { flexGrow: 0 },
  });
}
