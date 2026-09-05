import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

export default function IslandModal({ visible, onClose, title, icon: Icon, gradientColors, subtitle, children }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
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
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                nestedScrollEnabled
              >
                {children}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.62)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 22,
      paddingTop: Math.max(22, insets.top + 10),
      paddingBottom: Math.max(22, insets.bottom + 10),
    },
    card: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "88%",
      backgroundColor: c.surface,
      borderRadius: 26,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.4,
      shadowRadius: 30,
      elevation: 20,
    },
    header: { padding: 18 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { fontSize: 15.5, fontWeight: "800", color: "#fff" },
    headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 6 },
    closeBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    body: { flexShrink: 1, minHeight: 0 },
    bodyContent: { padding: 20, paddingBottom: Math.max(20, insets.bottom + 12) },
  });
}
