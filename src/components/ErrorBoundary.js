import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { api } from "../api/client";

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

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: "#fff" },
  title: { fontSize: 16, fontWeight: "700", color: "#14121a" },
  subtitle: { fontSize: 13, color: "#666", textAlign: "center", marginTop: 8, lineHeight: 19 },
  btn: { marginTop: 18, backgroundColor: "#14121a", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
