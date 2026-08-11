import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from "react-native";
import { ChevronLeft, Check, Users, History, ChevronDown, ChevronUp } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import { GENRE_FILTERS, COMMON_PLATFORMS } from "../theme/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChipRow from "../components/ChipRow";

const MIN_IMDB_OPTIONS = [6.0, 6.5, 7.0, 7.5, 8.0];
const YEAR_OPTIONS = [
  ["1990 öncesi", "before1990"],
  ["1990'lar", "1990s"],
  ["2000'ler", "2000s"],
  ["2010'lar", "2010s"],
  ["2020 ve sonrası", "2020s"],
];

// Birden fazla arkadaşı seçip TEK bir MatchParty oturumu açar. Eskiden bir DismissableSheet
// popup'tı — ama arkadaş listesi + birden fazla filtre satırı kaydırmak, popup'ın kendi
// "sürükleyerek kapat" jestiyle SÜREKLİ çakışıyordu (filtreleri kaydırmaya çalışırken popup
// yanlışlıkla kapanıyordu). Artık ayrı bir SAYFA — geri tuşu/navigasyon yığını doğal olarak
// çalışıyor, kaydırma jestiyle ilgili hiçbir çakışma riski yok.
export default function GroupPartyScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);

  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Son 3 eşleşme sonucu — girişte hafızada tutulup küçük bir "geçmiş" butonuyla açılıyor.
  const [recentMatches, setRecentMatches] = useState([]);
  const [showRecent, setShowRecent] = useState(false);

  const [typePref, setTypePref] = useState("Hepsi");
  const [genrePref, setGenrePref] = useState(null);
  const [minImdb, setMinImdb] = useState(6.5);
  const [yearLabels, setYearLabels] = useState(new Set());
  const [platformPrefs, setPlatformPrefs] = useState(new Set());

  useEffect(() => {
    api.friends(auth.token).then((data) => setFriends(data.friends || [])).catch(() => {}).finally(() => setLoading(false));
    api.recentPartyMatches(auth.token).then((data) => setRecentMatches(data.results || [])).catch(() => {});
  }, []);

  function toggle(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleYear(label) {
    setYearLabels((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  }
  function togglePlatform(name) {
    setPlatformPrefs((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  async function createGroupParty() {
    if (selected.size === 0 || creating) return;
    setCreating(true);
    try {
      const years = YEAR_OPTIONS.filter(([label]) => yearLabels.has(label)).map(([, key]) => key);
      const data = await api.createParty(auth.token, {
        to_user_ids: [...selected],
        filters: { type: typePref, genre: genrePref || "Hepsi", minImdb, years, platforms: [...platformPrefs] },
      });
      navigation.replace("MatchParty", { sessionId: data.id });
    } catch {
      setCreating(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grup Party Oluştur</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom }}>
        <Text style={styles.subtitle}>Birlikte izlemelik seçeceğiniz arkadaşlarını seç — birden fazla kişi seçebilirsin.</Text>

        {recentMatches.length > 0 && (
          <>
            <TouchableOpacity style={styles.recentToggle} onPress={() => setShowRecent((v) => !v)}>
              <History size={14} color={c.accent} />
              <Text style={styles.recentToggleText}>Geçmiş Eşleşmeler</Text>
              {showRecent ? <ChevronUp size={14} color={c.dim} /> : <ChevronDown size={14} color={c.dim} />}
            </TouchableOpacity>
            {showRecent && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentRow}>
                {recentMatches.map((session) => (
                  <View key={session.sessionId} style={styles.recentCard}>
                    <Text style={styles.recentWith} numberOfLines={1}>
                      {session.others.map((o) => o.name).join(", ") || "Grup"}
                    </Text>
                    <View style={styles.recentPosters}>
                      {session.matches.slice(0, 3).map((m, i) => (
                        m.poster
                          ? <Image key={i} source={{ uri: m.poster }} style={styles.recentPoster} />
                          : <View key={i} style={[styles.recentPoster, { backgroundColor: c.surface2 }]} />
                      ))}
                    </View>
                    <Text style={styles.recentCount}>{session.matches.length} eşleşme</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginVertical: 24 }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptyBox}>
            <Users size={26} color={c.dim} style={{ marginBottom: 8, opacity: 0.6 }} />
            <Text style={styles.emptyText}>Henüz arkadaşın yok.</Text>
          </View>
        ) : (
          friends.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, isSelected && { backgroundColor: c.surface2, borderRadius: 12 }]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
              >
                <RetryImage source={{ uri: avatarOr(item.avatar_url, item.id) }} style={styles.avatar} />
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.checkbox, isSelected && { backgroundColor: c.accent, borderColor: c.accent }]}>
                  {isSelected && <Check size={12} color={c.bg} strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Arkadaşına tek tek davet gönderirkenki (MatchPartyScreen setup) İLE AYNI filtreler. */}
        <Text style={styles.label}>TÜR</Text>
        <ChipRow items={["Film", "Dizi"]} active={typePref === "Hepsi" ? null : typePref}
          onSelect={(v) => setTypePref(v === typePref ? "Hepsi" : v)} />
        <Text style={styles.label}>KATEGORİ</Text>
        <ChipRow items={GENRE_FILTERS} active={genrePref} onSelect={(v) => setGenrePref(v === genrePref ? null : v)} />
        <Text style={styles.label}>MİNİMUM IMDB PUANI: {minImdb.toFixed(1)}</Text>
        <ChipRow items={MIN_IMDB_OPTIONS.map(String)} active={String(minImdb)} onSelect={(v) => setMinImdb(parseFloat(v))} />
        <Text style={styles.label}>YAPIM YILI (opsiyonel, birden fazla seçilebilir)</Text>
        <ChipRow items={YEAR_OPTIONS.map(([label]) => label)} isActive={(label) => yearLabels.has(label)} onSelect={toggleYear} />
        <Text style={styles.label}>PLATFORM (opsiyonel, birden fazla seçilebilir)</Text>
        <ChipRow items={COMMON_PLATFORMS} isActive={(name) => platformPrefs.has(name)} onSelect={togglePlatform} />

        {selected.size > 0 && (
          <TouchableOpacity style={styles.goBtn} onPress={createGroupParty} disabled={creating}>
            {creating ? <ActivityIndicator size="small" color={c.bg} /> : (
              <Text style={styles.goBtnText}>{selected.size} Kişiyle Party Oluştur</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 11, color: c.dim, marginBottom: 6, lineHeight: 16 },
    recentToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
    recentToggleText: { flex: 1, fontSize: 12, fontWeight: "700", color: c.text },
    recentRow: { marginBottom: 10 },
    recentCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 10, marginRight: 10, width: 140,
    },
    recentWith: { fontSize: 11, fontWeight: "700", color: c.text, marginBottom: 6 },
    recentPosters: { flexDirection: "row", gap: 4 },
    recentPoster: { width: 34, height: 50, borderRadius: 6 },
    recentCount: { fontSize: 10, color: c.dim, marginTop: 6, fontWeight: "600" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
    avatar: { width: 42, height: 42, borderRadius: 999, backgroundColor: c.surface2 },
    name: { flex: 1, fontSize: 13, fontWeight: "700", color: c.text },
    checkbox: {
      width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: c.border,
      alignItems: "center", justifyContent: "center",
    },
    emptyBox: { alignItems: "center", paddingVertical: 24 },
    emptyText: { color: c.dim, fontSize: 12 },
    label: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
    goBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, marginTop: 14,
    },
    goBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
  });
}
