import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { t as translateUI } from "../i18n/core";
import { platformName, platformLogo } from "../utils/platform";
import { storeOptions, storeOfferText } from "../utils/watchLinks";

// Kartlardaki "nerede izlenir" satırı: önce abonelik platformlarının logoları, ardından ince bir
// ayraçla kiralık / satın alınabilir mağazalar (logo + "Kirala"). Detay sayfasıyla aynı bilgi:
// kartta "Platformda yok" yazıp içeride Apple TV'de kiralık göstermiyoruz. İkisi de yoksa
// emptyText (verilmişse). short: dar kartlarda tek kelime ("Kirala" ya da "Satın al").
function WatchBadges({ platforms, stores, size = 16, max = 3, emptyText, style, emptyStyle, short = false }) {
  const { c } = useAppTheme();
  const subs = Array.isArray(platforms) ? platforms : [];
  const storeList = storeOptions(stores, Platform.OS);
  if (!subs.length && !storeList.length) {
    return emptyText ? <Text style={emptyStyle} numberOfLines={1}>{emptyText}</Text> : null;
  }

  const shownSubs = subs.slice(0, max);
  const shownStores = storeList.slice(0, Math.max(1, max - shownSubs.length));
  const offers = [...new Set(storeList.flatMap((s) => s.offers))];
  const offerLabel = short
    ? (offers.includes("rent") ? translateUI("Kirala") : translateUI("Satın al"))
    : storeOfferText(offers);
  const gap = Math.round(size / 4);
  const fontSize = Math.max(7.5, Math.round(size * 0.55 * 2) / 2);
  const logoStyle = { width: size, height: size, borderRadius: Math.round(size / 4), backgroundColor: "#fff" };
  const fallback = (name, key) => (
    <View key={key} style={[styles.fallback, { backgroundColor: c.surface2, maxWidth: size * 5 }]}>
      <Text style={{ fontSize, color: c.text }} numberOfLines={1}>{name}</Text>
    </View>
  );
  const label = [
    ...shownSubs.map(platformName),
    ...shownStores.map((s) => `${s.name} (${storeOfferText(s.offers)})`),
  ].filter(Boolean).join(", ");

  return (
    <View style={[styles.row, { gap }, style]} accessible accessibilityLabel={label}>
      {shownSubs.map((p, i) => (platformLogo(p)
        ? <Image key={`p${i}`} source={{ uri: platformLogo(p) }} style={logoStyle} />
        : fallback(platformName(p), `p${i}`)))}
      {shownStores.length > 0 && (
        <View
          style={[
            styles.row,
            { gap },
            shownSubs.length > 0 && { marginLeft: gap, paddingLeft: gap + 1, borderLeftWidth: 1, borderLeftColor: c.border },
          ]}
        >
          {shownStores.map((s, i) => (s.logo
            ? <Image key={`s${i}`} source={{ uri: s.logo }} style={logoStyle} />
            : fallback(s.name, `s${i}`)))}
          <Text style={[styles.offer, { fontSize, color: c.dim }]} numberOfLines={1}>{offerLabel}</Text>
        </View>
      )}
    </View>
  );
}

export default React.memo(WatchBadges);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  fallback: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999 },
  offer: { flexShrink: 1 },
});
