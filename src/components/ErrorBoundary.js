import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Appearance } from "react-native";
import { api } from "../api/client";
import { THEMES } from "../theme/theme";

// React'in kendi hata yakalama mekanizması — bir ekranın RENDER sırasında çökmesi durumunda
// tüm uygulamanın beyaz/kırmızı ekran vermesi yerine burada nazik bir mesaj gösteriyoruz,
// hatayı da backend üzerinden Sentry'ye bildiriyoruz.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    api.reportError({
      message: error?.message,
      stack: `${error?.stack || ""}\n${info?.componentStack || ""}`,
      context: "render-crash",
    });
  }

  render() {
    if (this.state.hasError) {
      // ÖNEMLİ: ErrorBoundary, ThemeProvider'ın DIŞINDA render ediliyor (bkz. App.js) — provider'ın
      // kendisi çökse bile bu ekran çalışabilsin diye kasıtlı. Bu yüzden React context'ten tema
      // okuyamıyoruz; onun yerine cihazın sistem temasını (Appearance) kullanıyoruz. Eskiden burası
      // hep sabit beyaz zemindi — karanlık modda bir çökme, aniden göz kamaştıran beyaz bir ekrana
      // sıçratıyordu.
      const c = THEMES[Appearance.getColorScheme() === "dark" ? "dark" : "light"];
      const styles = makeStyles(c);
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Bir şeyler ters gitti</Text>
          <Text style={styles.subtitle}>Sorun otomatik olarak bize bildirildi. Uygulamayı yeniden başlatmayı dener misin?</Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.btnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: c.bg },
    title: { fontSize: 16, fontWeight: "700", color: c.text },
    subtitle: { fontSize: 13, color: c.dim, textAlign: "center", marginTop: 8, lineHeight: 19 },
    btn: { marginTop: 18, backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
    btnText: { color: c.bg, fontWeight: "700", fontSize: 13 },
  });
}
