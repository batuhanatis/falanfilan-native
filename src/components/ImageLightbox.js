import React from "react";
import { Modal, View, Image, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from "react-native";
import { X } from "lucide-react-native";

// Herhangi bir görseli (şimdilik profil fotoğrafları için) tam boyutta gösteren, ekranın
// tamamını kaplayan sade bir "lightbox" — arka plana ya da X'e dokununca kapanıyor.
export default function ImageLightbox({ uri, onClose }) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
  closeBtn: { position: "absolute", top: 56, right: 20, zIndex: 10, padding: 8 },
  image: { width: "100%", height: "80%" },
});
