import React, { useState, useMemo, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { X, CalendarClock } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import DismissableSheet from "./DismissableSheet";

const TIME_OPTIONS = ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];

function buildDayOptions() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    let label;
    if (i === 0) label = "Bugün";
    else if (i === 1) label = "Yarın";
    else label = d.toLocaleDateString("tr-TR", { weekday: "short" });
    days.push({ date: d, label });
  }
  return days;
}

// Arkadaşına "birlikte ne zaman izleyelim?" önerisi göndermek için — SERBEST METİN değil,
// gerçek bir gün + saat seçtiriyoruz ki backend'deki hatırlatma işi doğru zamanda güvenilir
// bir şekilde bildirim gönderebilsin (bkz. server.js: checkWatchPlanReminders).
export default function PlanCreatorModal({ visible, onClose, onSubmit }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const dayOptions = useMemo(() => buildDayOptions(), [visible]);

  const [dayIndex, setDayIndex] = useState(0);
  const [time, setTime] = useState("21:00");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) { setDayIndex(0); setTime("21:00"); setNote(""); }
  }, [visible]);

  const scheduledDate = useMemo(() => {
    const day = dayOptions[dayIndex]?.date || new Date();
    const [h, m] = time.split(":").map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
  }, [dayOptions, dayIndex, time]);

  const isPast = scheduledDate.getTime() < Date.now();

  function handleSubmit() {
    if (isPast) return;
    onSubmit(scheduledDate.toISOString(), note.trim() || null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={styles.sheet} handleOnly>
              <View style={styles.header}>
                <Text style={styles.title}>İzleme Planı Öner</Text>
                <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
              </View>
              <Text style={styles.subtitle}>Arkadaşın kabul edince, tam zamanı geldiğinde ikinize de hatırlatma göndeririz.</Text>

              <Text style={styles.label}>GÜN</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {dayOptions.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.pill, dayIndex === i && styles.pillActive]}
                    onPress={() => setDayIndex(i)}
                  >
                    <Text style={[styles.pillText, dayIndex === i && styles.pillTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>SAAT</Text>
              <View style={styles.timeGrid}>
                {TIME_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, time === t && styles.pillActive]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[styles.pillText, time === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>NOT (opsiyonel)</Text>
              <TextInput
                style={styles.input}
                placeholder="ör. Sende mi buluşalım?"
                placeholderTextColor={c.dim}
                value={note}
                onChangeText={setNote}
              />

              {isPast && <Text style={styles.errorText}>Geçmiş bir zaman seçemezsin.</Text>}

              <TouchableOpacity style={[styles.submitBtn, isPast && { opacity: 0.4 }]} onPress={handleSubmit} disabled={isPast}>
                <CalendarClock size={16} color={c.bg} />
                <Text style={styles.submitBtnText}>Planı Gönder</Text>
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
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    title: { fontSize: 16, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12, color: c.dim, marginBottom: 18, lineHeight: 17 },
    label: { fontSize: 11, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8 },
    pill: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999,
      paddingHorizontal: 14, paddingVertical: 9, marginRight: 8,
    },
    pillActive: { backgroundColor: c.accent, borderColor: c.accent },
    pillText: { fontSize: 13, fontWeight: "700", color: c.text },
    pillTextActive: { color: c.bg },
    timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    input: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 11, color: c.text, fontSize: 13, marginBottom: 6,
    },
    errorText: { color: c.danger || "#ef4444", fontSize: 11.5, marginBottom: 6 },
    submitBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, marginTop: 12,
    },
    submitBtnText: { color: c.bg, fontWeight: "800", fontSize: 13.5 },
  });
}
