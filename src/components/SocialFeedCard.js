import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Heart, MessageCircle, Sparkles, Star, ThumbsUp } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import SocialCommentsModal from "./SocialCommentsModal";

function relativeTime(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} gün`;
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function activityCopy(item) {
  if (item.activityType === "like") {
    const count = item.activityCount || item.movies?.length || 1;
    return count > 1 ? `${count} içerik beğendi` : "bir içeriği beğendi";
  }
  if (item.activityType === "favorite_set") return "favorisini güncelledi";
  if (item.activityType === "list_created") return `“${item.payload?.list_name || "Yeni liste"}” listesini oluşturdu`;
  return "zevk profilini güncelledi";
}

function postLabel(type) {
  if (type === "recommend") return "öneriyor";
  if (type === "poll") return "soruyor";
  return "paylaştı";
}

export default function SocialFeedCard({ item, navigation, compact = false, onChanged }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [state, setState] = useState(item);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activityLiked, setActivityLiked] = useState(false);

  useEffect(() => setState(item), [item]);

  const user = state.user || {};
  const post = state.post;

  function openProfile() {
    if (Number(user.id) === Number(auth.id)) navigation.navigate("MainTabs", { screen: "Profile" });
    else navigation.navigate("OtherProfile", { userId: user.id });
  }

  function openMovie(movie) {
    if (movie) navigation.navigate("Detail", { movie });
  }

  async function togglePostLike() {
    if (!post?.id) return;
    const prev = state;
    const nextLiked = !post.likedByMe;
    const nextCount = Math.max(0, Number(post.likeCount || 0) + (nextLiked ? 1 : -1));
    setState((s) => ({ ...s, post: { ...s.post, likedByMe: nextLiked, likeCount: nextCount } }));
    try {
      const data = await api.socialToggleLike(auth.token, post.id);
      setState((s) => ({ ...s, post: { ...s.post, likedByMe: !!data.liked, likeCount: Number(data.likeCount || 0) } }));
      onChanged?.();
    } catch {
      setState(prev);
    }
  }

  async function vote(movieId) {
    if (!post?.id || !movieId) return;
    try {
      const data = await api.socialVote(auth.token, post.id, movieId);
      setState((s) => ({ ...s, post: { ...s.post, myVote: data.myVote, pollCounts: data.pollCounts || {} } }));
      onChanged?.();
    } catch {}
  }

  async function likeActivityMovie(movie) {
    if (!movie || activityLiked) return;
    setActivityLiked(true);
    try { await api.recordInteraction(auth.token, movie.id, "like"); } catch { setActivityLiked(false); }
  }

  const body = post?.body?.trim();
  const primaryMovie = post?.movie || state.movies?.[0];

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openProfile} activeOpacity={0.8}>
          <RetryImage source={{ uri: avatarOr(user.avatar_url, user.id) }} style={styles.avatar} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={openProfile} activeOpacity={0.75}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}</Text>
            {!!user.username && <Text style={styles.username}>@{user.username}</Text>}
          </View>
          <Text style={styles.meta}>{state.kind === "post" ? postLabel(post?.type) : activityCopy(state)} · {relativeTime(state.created_at)}</Text>
        </TouchableOpacity>
        {post?.type === "recommend" && <View style={styles.typeChip}><Sparkles size={11} color={c.accent} /><Text style={styles.typeChipText}>ÖNERİ</Text></View>}
      </View>

      {!!body && <Text style={styles.body}>{body}</Text>}

      {state.kind === "post" && post?.type === "poll" && post.pollMovies?.length === 2 ? (
        <View style={styles.pollWrap}>
          {post.pollMovies.map((movie) => {
            const count = Number(post.pollCounts?.[movie.id] || 0);
            const total = post.pollMovies.reduce((sum, m) => sum + Number(post.pollCounts?.[m.id] || 0), 0);
            const pct = total ? Math.round((count / total) * 100) : 0;
            const selected = Number(post.myVote) === Number(movie.id);
            return (
              <TouchableOpacity key={movie.id} style={[styles.pollOption, selected && { borderColor: c.accent }]} onPress={() => vote(movie.id)} activeOpacity={0.85}>
                {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.pollPoster} /> : <View style={[styles.pollPoster, { backgroundColor: c.surface2 }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.movieTitle} numberOfLines={2}>{movie.title}</Text>
                  {(post.myVote || total > 0) && <Text style={[styles.pollPct, selected && { color: c.accent }]}>{pct}% · {count} oy</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : state.kind === "activity" && state.movies?.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterStrip}>
          {state.movies.map((movie) => (
            <TouchableOpacity key={movie.id} onPress={() => openMovie(movie)}>
              {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.stripPoster} /> : <View style={[styles.stripPoster, { backgroundColor: c.surface2 }]} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : primaryMovie ? (
        <TouchableOpacity style={styles.movieCard} onPress={() => openMovie(primaryMovie)} activeOpacity={0.85}>
          {primaryMovie.poster ? <Image source={{ uri: primaryMovie.poster }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.movieTitle} numberOfLines={2}>{primaryMovie.title}</Text>
            <View style={styles.movieMetaRow}>
              {!!primaryMovie.imdb && <><Star size={11} color={c.accent} fill={c.accent} /><Text style={styles.movieMeta}>{primaryMovie.imdb}</Text></>}
              {!!primaryMovie.year && <Text style={styles.movieMeta}>· {primaryMovie.year}</Text>}
              {!!primaryMovie.type && <Text style={styles.movieMeta}>· {primaryMovie.type}</Text>}
            </View>
            <Text style={styles.openHint}>İçeriği aç</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {state.kind === "post" ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={togglePostLike}>
            <Heart size={17} color={post?.likedByMe ? c.accent2 : c.dim} fill={post?.likedByMe ? c.accent2 : "none"} />
            <Text style={[styles.actionText, post?.likedByMe && { color: c.accent2 }]}>{post?.likeCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => setCommentsOpen(true)}>
            <MessageCircle size={17} color={c.dim} />
            <Text style={styles.actionText}>{post?.commentCount || 0}</Text>
          </TouchableOpacity>
          {!!primaryMovie && (
            <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={() => openMovie(primaryMovie)}>
              <Text style={styles.actionLink}>İçeriğe git</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : primaryMovie ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => likeActivityMovie(primaryMovie)}>
            <ThumbsUp size={16} color={activityLiked ? c.accent2 : c.dim} fill={activityLiked ? c.accent2 : "none"} />
            <Text style={[styles.actionText, activityLiked && { color: c.accent2 }]}>{activityLiked ? "Beğenildi" : "Ben de beğendim"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={() => openMovie(primaryMovie)}>
            <Text style={styles.actionLink}>Detay</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!!post?.id && (
        <SocialCommentsModal
          visible={commentsOpen}
          postId={post.id}
          onClose={() => setCommentsOpen(false)}
          onChanged={() => {
            setState((s) => ({ ...s, post: { ...s.post, commentCount: Number(s.post?.commentCount || 0) + 1 } }));
            onChanged?.();
          }}
        />
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 14, marginBottom: 12 },
    cardCompact: { marginBottom: 10, padding: 12 },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.surface2 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    name: { color: c.text, fontWeight: "800", fontSize: 13 },
    username: { color: c.dim, fontSize: 10, flexShrink: 1 },
    meta: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    typeChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
    typeChipText: { color: c.accent, fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
    body: { color: c.text, fontSize: 14, lineHeight: 20, marginTop: 12 },
    movieCard: { flexDirection: "row", gap: 11, marginTop: 12, padding: 10, backgroundColor: c.surface2, borderRadius: 14, borderWidth: 1, borderColor: c.border },
    poster: { width: 62, height: 92, borderRadius: 9 },
    movieTitle: { color: c.text, fontWeight: "800", fontSize: 13 },
    movieMetaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
    movieMeta: { color: c.dim, fontSize: 10.5 },
    openHint: { color: c.accent, fontSize: 10.5, fontWeight: "700", marginTop: 10 },
    posterStrip: { gap: 8, paddingTop: 12 },
    stripPoster: { width: 76, height: 112, borderRadius: 10 },
    pollWrap: { gap: 8, marginTop: 12 },
    pollOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2 },
    pollPoster: { width: 46, height: 68, borderRadius: 8 },
    pollPct: { color: c.dim, fontWeight: "800", fontSize: 10.5, marginTop: 5 },
    actions: { flexDirection: "row", alignItems: "center", gap: 18, borderTopWidth: 1, borderTopColor: c.border, marginTop: 12, paddingTop: 11 },
    action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
    actionText: { color: c.dim, fontSize: 11.5, fontWeight: "700" },
    actionLink: { color: c.accent, fontSize: 11.5, fontWeight: "800" },
  });
}
