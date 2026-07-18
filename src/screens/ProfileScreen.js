import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, FlatList, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Settings, Camera, Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";

export default function ProfileScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [likedMovies, setLikedMovies] = useState([]);
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState("likes"); // likes | watchlist | friends
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    // Sadece İLK yüklemede tam ekran spinner göster — Detay sayfasından geri dönüş gibi
    // odaklanma bazlı yenilemelerde arka planda sessizce güncellensin, ekran "zıplamasın".
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [me, selfProfile, friendsData, watchlistsData] = await Promise.all([
        api.me(auth.token),
        api.userProfile(auth.token, auth.id),
        api.friends(auth.token),
        api.watchlists(auth.token),
      ]);
      setProfile({ ...me, friendCount: friendsData.friends?.length || 0 });
      setLikedMovies(selfProfile.likedMovies || []);
      setFriends(friendsData.friends || []);
      setWatchlists(watchlistsData.results || []);
      hasLoadedRef.current = true;
    } catch { /* sessizce geç */ }
    setLoading(false);
  }, [auth.token, auth.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", load);
    return unsub;
  }, [navigation, load]);

  async function pickPhoto(kind) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin gerekli", "Fotoğraf seçmek için galeri izni vermelisin."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: kind === "avatar" ? [1, 1] : [3, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;

    const setUploading = kind === "avatar" ? setUploadingAvatar : setUploadingCover;
    setUploading(true);
    try {
      const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await api.updatePhoto(auth.token, kind === "avatar" ? { avatar_url: dataUrl } : { cover_url: dataUrl });
      setProfile((prev) => ({ ...prev, [kind === "avatar" ? "avatarUrl" : "coverUrl"]: dataUrl }));
    } catch { Alert.alert("Hata", "Fotoğraf yüklenemedi, tekrar dene."); }
    setUploading(false);
  }

  if (loading || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={[styles.cover, { backgroundColor: profile.coverUrl ? c.surface2 : c.accent }]}
        onPress={() => pickPhoto("cover")}
        activeOpacity={0.85}
      >
        {profile.coverUrl && <Image source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFillObject} />}
        <View style={styles.coverEditBadge}>
          {uploadingCover ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={13} color="#fff" />}
        </View>
      </TouchableOpacity>

      <View style={{ padding: 20 }}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => pickPhoto("avatar")} activeOpacity={0.85}>
            <Image source={{ uri: avatarOr(profile.avatarUrl, auth.id) }} style={styles.avatar} />
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? <ActivityIndicator size="small" color={c.bg} /> : <Camera size={11} color={c.bg} />}
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Settings")}>
              <Settings size={15} color={c.text} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.username}>{profile.username ? `@${profile.username} · ` : ""}{profile.email}</Text>
        <Text style={styles.bio}>{profile.bio || "Henüz bir biyografi eklemedin."}</Text>

        {(profile.favoriteMovie || profile.favoriteShow) && (
          <View style={styles.favRow}>
            {profile.favoriteMovie && <FavCard label="Favori Film" movie={profile.favoriteMovie} c={c} />}
            {profile.favoriteShow && <FavCard label="Favori Dizi" movie={profile.favoriteShow} c={c} />}
          </View>
        )}

        <View style={styles.tabRow}>
          {[["likes", "Beğeniler"], ["watchlist", "Listelerim"], ["friends", "Arkadaşlar"]].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => setSub(id)} style={[styles.tabBtn, sub === id && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}>
              <Text style={[styles.tabText, sub === id && { color: c.accent }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {sub === "likes" && (
          likedMovies.length > 0 ? (
            <FlatList
              data={likedMovies}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 6 }}
              contentContainerStyle={{ gap: 6 }}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
                  {item.poster ? <Image source={{ uri: item.poster }} style={styles.posterThumb} />
                    : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }]} />}
                </TouchableOpacity>
              )}
            />
          ) : <Text style={styles.emptyText}>Henüz bir beğeni yok.</Text>
        )}

        {sub === "watchlist" && (
          watchlists.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {watchlists.map((wl) => (
                <TouchableOpacity key={wl.id} style={styles.watchlistCard} onPress={() => navigation.navigate("WatchlistDetail", { watchlistId: wl.id, name: wl.name })}>
                  {wl.previewPoster ? (
                    <Image source={{ uri: wl.previewPoster }} style={styles.watchlistPreview} />
                  ) : (
                    <View style={[styles.watchlistPreview, { backgroundColor: c.surface2 }]} />
                  )}
                  <Text style={styles.watchlistName} numberOfLines={1}>{wl.name}</Text>
                  <Text style={styles.watchlistCount}>{wl.count} içerik</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : <Text style={styles.emptyText}>Henüz bir listen yok.</Text>
        )}

        {sub === "friends" && (
          friends.length > 0 ? (
            friends.map((f) => (
              <TouchableOpacity key={f.id} style={styles.friendRow} onPress={() => navigation.navigate("OtherProfile", { userId: f.id })}>
                <Image source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.friendAvatar} />
                <Text style={styles.friendName}>{f.name}</Text>
              </TouchableOpacity>
            ))
          ) : <Text style={styles.emptyText}>Henüz arkadaşın yok.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function FavCard({ label, movie, c }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 8, alignItems: "center" }}>
      {movie.poster ? (
        <Image source={{ uri: movie.poster }} style={{ width: 40, height: 58, borderRadius: 8 }} />
      ) : (
        <View style={{ width: 40, height: 58, borderRadius: 8, backgroundColor: c.surface2 }} />
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Star size={9} color={c.accent} fill={c.accent} />
          <Text style={{ fontSize: 8, fontWeight: "800", color: c.accent }}>{label.toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", color: c.text, marginTop: 2 }} numberOfLines={1}>{movie.title}</Text>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center" },
    cover: { height: 100, position: "relative" },
    coverEditBadge: {
      position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: -40 },
    avatar: { width: 76, height: 76, borderRadius: 999, borderWidth: 4, borderColor: c.bg },
    avatarEditBadge: {
      position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: 999, backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg,
    },
    headerActions: { flexDirection: "row", gap: 8, marginBottom: 4 },
    iconBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    name: { fontSize: 20, fontWeight: "700", color: c.text, marginTop: 12 },
    username: { fontSize: 12, color: c.dim, marginTop: 2 },
    bio: { fontSize: 13, color: c.text, marginTop: 8, lineHeight: 19 },
    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    tabRow: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { paddingVertical: 10, marginRight: 20 },
    tabText: { fontSize: 12, fontWeight: "700", color: c.dim },
    posterThumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    emptyText: { color: c.dim, fontSize: 12, marginTop: 14 },
    watchlistCard: { width: "31%", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 8 },
    watchlistPreview: { width: "100%", aspectRatio: 1, borderRadius: 8, marginBottom: 6 },
    watchlistName: { fontSize: 11, fontWeight: "700", color: c.text },
    watchlistCount: { fontSize: 10, color: c.dim, marginTop: 1 },
    friendRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    friendAvatar: { width: 38, height: 38, borderRadius: 999 },
    friendName: { fontSize: 13, fontWeight: "600", color: c.text },
  });
}
