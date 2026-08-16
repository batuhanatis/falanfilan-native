import React, { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MessageCircle, MoreHorizontal, Send, Sparkles, Star } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import SocialCommentsModal from "./SocialCommentsModal";
import SocialSharedCard from "./SocialSharedCard";
import { reportSocialContent } from "../utils/socialReporting";
import SendToFriendModal from "./SendToFriendModal";

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
  if (item.activityType === "favorite_set") {
    return item.payload?.liked
      ? "bir içeriği beğendi ve favorisi yaptı"
      : "favorisini güncelledi";
  }
  if (item.activityType === "list_created") return `“${item.payload?.list_name || "Yeni liste"}” listesini oluşturdu`;
  return "zevk profilini güncelledi";
}

function activityMood(item) {
  if (item.activityType === "like") return { emoji: "🍿", label: "BEĞENDİ", colors: ["#FF3D81", "#8B5CF6"] };
  if (item.activityType === "favorite_set") return { emoji: "💘", label: "FAVORİSİ YAPTI", colors: ["#F97316", "#EF4444"] };
  if (item.activityType === "list_created") return { emoji: "🎬", label: "YENİ LİSTE", colors: ["#06B6D4", "#2563EB"] };
  return { emoji: "✨", label: "ZEVKİNİ GÜNCELLEDİ", colors: ["#8B5CF6", "#2563EB"] };
}

function postLabel(type) {
  if (type === "recommend") return "öneriyor";
  if (type === "poll") return "soruyor";
  if (type === "card") return "bir kart paylaştı";
  return "paylaştı";
}

const QUICK_REACTIONS = [
  ["fire", "🔥"],
  ["agree", "🤝"],
  ["nope", "👎"],
];
const REACTION_EMOJI = { fire: "🔥", agree: "🤝", nope: "👎" };

// ÖNEMLİ DÜZELTME: Eskiden her kartın altında SABİT, her zaman görünen üç ayrı emoji pill'i
// vardı ("beğen"in bu uygulamada karşılığı olmadığı için aktivite kartlarında hiç kalp yoktu,
// post kartlarında ise hem kalp HEM üç pill birden vardı — dört ayrı etkileşim satırı üst üste
// biniyordu). Artık tek bir buton: hızlı dokunuş varsayılan (🔥) tepkiyi açıp kapatıyor, basılı
// tutmak (iMessage/Instagram'daki gibi) üç seçenekli küçük bir seçici açıyor. Aynı buton hem
// post hem aktivite kartlarında kullanılıyor, "kalp" kavramı tamamen bunun içinde eridi.
function ReactionButton({ myReaction, counts, onReact, c, styles }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const total = QUICK_REACTIONS.reduce((sum, [id]) => sum + Number(counts?.[id] || 0), 0);
  const emoji = myReaction ? REACTION_EMOJI[myReaction] : null;

  function handlePress() {
    if (pickerOpen) { setPickerOpen(false); return; }
    onReact(myReaction || "fire");
  }

  return (
    <View style={styles.reactionWrap}>
      <Pressable
        style={styles.action}
        onPress={handlePress}
        onLongPress={() => setPickerOpen(true)}
        delayLongPress={380}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.reactionIcon}>{emoji || "✦"}</Text>
        {total > 0 && <Text style={[styles.actionText, myReaction && { color: c.accent }]}>{total}</Text>}
      </Pressable>
      {pickerOpen && (
        <View style={styles.reactionPicker}>
          {QUICK_REACTIONS.map(([id, emj]) => (
            <TouchableOpacity
              key={id}
              style={styles.reactionOption}
              onPress={() => { onReact(id); setPickerOpen(false); }}
              accessibilityRole="button"
              accessibilityLabel={id}
            >
              <Text style={styles.reactionOptionEmoji}>{emj}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Instagram'daki "kullanıcıadı: yorum" deseni — en son yorumu (varsa) bir sayı yerine doğrudan
// gösteriyor. Görünen bir konuşma, boş bir rakamdan çok daha güçlü bir katılım daveti.
function CommentPreview({ comment, count, onPress, styles }) {
  if (!comment) return null;
  return (
    <TouchableOpacity style={styles.commentPreview} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.commentPreviewText} numberOfLines={2}>
        <Text style={styles.commentPreviewName}>{comment.name} </Text>
        {comment.body}
      </Text>
      {count > 1 && <Text style={styles.commentPreviewMore}>{count} yorumun tümünü gör</Text>}
    </TouchableOpacity>
  );
}

export default function SocialFeedCard({ item, navigation, compact = false, onChanged }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [state, setState] = useState(item);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    setState(item);
  }, [item]);

  const user = state.user || {};
  const post = state.post;

  function openProfile() {
    if (Number(user.id) === Number(auth.id)) navigation.navigate("MainTabs", { screen: "Profile" });
    else navigation.navigate("OtherProfile", { userId: user.id });
  }

  function openMovie(movie) {
    if (movie) navigation.navigate("Detail", { movie });
  }

  async function vote(movieId) {
    if (!post?.id || !movieId) return;
    try {
      const data = await api.socialVote(auth.token, post.id, movieId);
      setState((s) => ({ ...s, post: { ...s.post, myVote: data.myVote, pollCounts: data.pollCounts || {} } }));
      onChanged?.();
    } catch {}
  }

  async function react(reaction) {
    const kind = state.kind === "post" ? "post" : "activity";
    const id = kind === "post" ? post?.id : state.activityId;
    if (!id) return;
    try {
      const data = await api.socialReact(auth.token, kind, id, reaction);
      if (kind === "post") {
        setState((s) => ({ ...s, post: { ...s.post, myReaction: data.myReaction || null, reactionCounts: data.reactionCounts || {} } }));
      } else {
        setState((s) => ({ ...s, myReaction: data.myReaction || null, reactionCounts: data.reactionCounts || {} }));
      }
      onChanged?.();
    } catch {}
  }

  function requestDeletePost() {
    if (!post?.id || deleting) return;
    Alert.alert(
      "Paylaşım silinsin mi?",
      "Bu paylaşım sosyal akıştan kalıcı olarak kaldırılacak.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Paylaşımı sil",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.socialDeletePost(auth.token, post.id);
              setRemoved(true);
              onChanged?.({ type: "deleted", postId: post.id });
            } catch (error) {
              Alert.alert("Silinemedi", error?.message || "Paylaşım silinirken bir sorun oluştu.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  function requestReportContent() {
    const targetType = state.kind === "post" ? "post" : "activity";
    const targetId = targetType === "post" ? post?.id : state.activityId;
    if (!targetId) return;
    const reasons = ["Uygunsuz/müstehcen içerik", "Taciz veya nefret söylemi", "Spam veya yanıltıcı içerik", "Diğer"];
    Alert.alert("İçeriği şikâyet et", "Nedeni seç", [
      ...reasons.map((reason) => ({
        text: reason,
        onPress: async () => {
          try {
            await reportSocialContent(auth.token, targetType, targetId, reason);
            Alert.alert("Teşekkürler", "Şikâyetin incelenmek üzere alındı.");
          } catch (error) {
            Alert.alert("Gönderilemedi", error?.message || "Şikâyet gönderilirken bir sorun oluştu.");
          }
        },
      })),
      { text: "Vazgeç", style: "cancel" },
    ]);
  }

  const body = post?.body?.trim();
  const primaryMovie = post?.movie || state.movies?.[0];
  const mood = state.kind === "activity" ? activityMood(state) : null;
  const isOwnPost = Number(user.id) === Number(auth.id);
  const isDailyQuestionPost = state.kind === "post" && body?.startsWith("🔥 Günün Sorusu:");
  // Ana kartın "yıldızı" bir poster olduğunda (aktivitede beğendi/favori, ya da bir öneri
  // postunda) kişi bilgisini ve menüyü AYRI bir başlık satırında değil, doğrudan posterin
  // içinde (sol üst kişi, sağ üst menü) gösteriyoruz — bkz. tasarım incelemesi.
  const isHeroMovie = !!primaryMovie && !(state.kind === "post" && post?.type === "poll");
  const reactionTargetId = state.kind === "post" ? post?.id : state.activityId;
  const myReaction = post?.myReaction ?? state.myReaction;
  const reactionCounts = post?.reactionCounts || state.reactionCounts || {};
  const commentCount = state.kind === "post" ? post?.commentCount : state.commentCount;
  const latestComment = state.kind === "post" ? post?.latestComment : state.latestComment;

  if (removed) return null;

  function PersonMenuRow({ hero }) {
    return (
      <>
        <TouchableOpacity style={hero ? styles.heroPerson : { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }} onPress={openProfile} activeOpacity={0.8}>
          <RetryImage source={{ uri: avatarOr(user.avatar_url, user.id) }} style={hero ? styles.heroAvatar : styles.avatar} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text style={hero ? styles.heroName : styles.name}>{user.name}</Text>
              {!!user.username && <Text style={hero ? styles.heroUsername : styles.username}>@{user.username}</Text>}
            </View>
            <Text style={hero ? styles.heroMeta : styles.meta}>
              {state.kind === "post" ? `${postLabel(post?.type)} · ` : ""}{relativeTime(state.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
        {post?.type === "recommend" && !hero && (
          <View style={styles.typeChip}><Sparkles size={11} color={c.accent} /><Text style={styles.typeChipText}>ÖNERİ</Text></View>
        )}
        <TouchableOpacity
          style={hero ? styles.heroMenuBtn : styles.postMenuButton}
          onPress={isOwnPost ? requestDeletePost : requestReportContent}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Paylaşım seçenekleri"
        >
          {deleting
            ? <ActivityIndicator size="small" color={hero ? "#fff" : c.dim} />
            : <MoreHorizontal size={hero ? 18 : 19} color={hero ? "#fff" : c.dim} />}
        </TouchableOpacity>
      </>
    );
  }

  return (
    <View style={[styles.card, state.kind === "activity" && !isHeroMovie && styles.activityCard, compact && styles.cardCompact]}>
      {mood && !isHeroMovie && <LinearGradient colors={mood.colors} style={styles.activityRail} />}

      {!isHeroMovie && (
        <View style={styles.header}>
          <PersonMenuRow hero={false} />
        </View>
      )}

      {mood && !isHeroMovie && (
        <View style={styles.activityHeadline}>
          <LinearGradient colors={mood.colors} style={styles.activityEmoji}><Text style={styles.activityEmojiText}>{mood.emoji}</Text></LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activityLabel, { color: mood.colors[0] }]}>{mood.label}</Text>
            <Text style={styles.activityTitle}>{activityCopy(state)}</Text>
          </View>
        </View>
      )}

      {!isHeroMovie && !!body && <Text style={styles.body}>{body}</Text>}

      {state.kind === "post" && post?.type === "card" && post.cardPayload ? (
        <SocialSharedCard payload={post.cardPayload} navigation={navigation} currentUserId={auth.id} />
      ) : state.kind === "post" && post?.type === "poll" && post.pollMovies?.length === 2 ? (
        <>
          {!!body && <Text style={styles.body}>{body}</Text>}
          <View style={styles.pollVsRow}>
            {post.pollMovies.map((movie, index) => {
              const count = Number(post.pollCounts?.[movie.id] || 0);
              const total = post.pollMovies.reduce((sum, m) => sum + Number(post.pollCounts?.[m.id] || 0), 0);
              const pct = total ? Math.round((count / total) * 100) : 0;
              const selected = Number(post.myVote) === Number(movie.id);
              return (
                <View key={movie.id} style={[styles.pollVsOpt, index === 0 && styles.pollVsOptBorder, selected && styles.pollVsOptSelected]}>
                  <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => openMovie(movie)} activeOpacity={0.9}>
                    {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.pollVsPoster} /> : <View style={[styles.pollVsPoster, { backgroundColor: c.surface2 }]} />}
                    <LinearGradient colors={["transparent", "rgba(8,6,12,0.94)"]} style={styles.pollVsShade} />
                  </TouchableOpacity>
                  <View style={styles.pollVsCopy} pointerEvents="box-none">
                    <Text style={styles.pollVsTitle} numberOfLines={1}>{movie.title}</Text>
                    {(post.myVote || total > 0) && <Text style={[styles.pollVsPct, selected && { color: c.accent }]}>{pct}% · {count} oy</Text>}
                    <TouchableOpacity style={[styles.pollVsVote, selected && styles.pollVsVoteSelected]} onPress={() => vote(movie.id)}>
                      <Text style={[styles.pollVsVoteText, selected && styles.pollVsVoteTextSelected]}>{selected ? "✓ Oy Verdin" : "Oy Ver"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <View style={styles.pollVsDivider}><Text style={styles.pollVsDividerText}>VS</Text></View>
          </View>
        </>
      ) : isHeroMovie ? (
        <View style={[styles.heroMedia, { marginHorizontal: -(compact ? 12 : 14), marginTop: -(compact ? 12 : 14) }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => openMovie(primaryMovie)} activeOpacity={0.92}>
            {primaryMovie.poster ? <Image source={{ uri: primaryMovie.poster }} style={styles.heroPoster} resizeMode="cover" /> : <View style={[styles.heroPoster, { backgroundColor: c.surface2 }]} />}
            <LinearGradient colors={["rgba(8,6,12,0.88)", "rgba(8,6,12,0.3)", "transparent"]} style={styles.heroShadeTop} pointerEvents="none" />
            <LinearGradient colors={["transparent", "rgba(8,6,12,0.94)"]} style={styles.heroShadeBottom} pointerEvents="none" />
            <View style={styles.heroCopy} pointerEvents="none">
              {mood ? (
                <LinearGradient colors={mood.colors} style={styles.heroTag}><Text style={styles.heroTagText}>{mood.emoji} {mood.label}</Text></LinearGradient>
              ) : isDailyQuestionPost ? (
                <LinearGradient colors={["#F97316", "#EF4444"]} style={styles.heroTag}><Text style={styles.heroTagText}>🔥 GÜNÜN SORUSU</Text></LinearGradient>
              ) : null}
              <Text style={styles.heroTitle} numberOfLines={2}>{primaryMovie.title}</Text>
              <View style={styles.heroMetaRow}>
                {!!primaryMovie.imdb && <><Star size={12} color="#FFD166" fill="#FFD166" /><Text style={styles.heroMetaText}>{primaryMovie.imdb}</Text></>}
                {!!primaryMovie.year && <Text style={styles.heroMetaText}>· {primaryMovie.year}</Text>}
                {!!primaryMovie.type && <Text style={styles.heroMetaText}>· {primaryMovie.type}</Text>}
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.heroTopRow} pointerEvents="box-none">
            <PersonMenuRow hero />
          </View>
        </View>
      ) : null}

      {isHeroMovie && !!body && (
        // Instagram'daki "kullanıcıadı: caption" deseni — posterin üstüne bindirmek yerine
        // (uzun bir metin değişken parlaklıktaki bir görselde erir) yorumların başladığı yerde
        // kısa bir önizleme. İki satırdan uzunsa kırpılır, dokununca yorumlar açılır (tam metin
        // orada görünür) — RN'in kendi numberOfLines'ı ile, gerçek bir "genişlet" state'i yok.
        <TouchableOpacity style={styles.heroCaption} onPress={() => setCommentsOpen(true)} activeOpacity={0.75}>
          <Text style={styles.heroCaptionText} numberOfLines={2}>
            <Text style={styles.heroCaptionName}>{user.name} </Text>
            {body}
          </Text>
        </TouchableOpacity>
      )}

      {!!reactionTargetId && (
        <View style={styles.actions}>
          <ReactionButton myReaction={myReaction} counts={reactionCounts} onReact={react} c={c} styles={styles} />
          <TouchableOpacity style={styles.action} onPress={() => setCommentsOpen(true)}>
            <MessageCircle size={17} color={c.dim} />
            <Text style={styles.actionText}>{commentCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.action, styles.actionShare]} onPress={() => setSendOpen(true)}>
            <Send size={17} color={c.dim} />
          </TouchableOpacity>
        </View>
      )}

      {!!reactionTargetId && Number(commentCount) > 0 && (
        <CommentPreview comment={latestComment} count={commentCount} onPress={() => setCommentsOpen(true)} styles={styles} />
      )}

      {(!!post?.id || !!state.activityId) && (
        <SocialCommentsModal
          visible={commentsOpen}
          postId={post?.id}
          activityId={state.activityId}
          canModerate={Number(user.id) === Number(auth.id)}
          onClose={() => setCommentsOpen(false)}
          onChanged={(event) => {
            const delta = event?.type === "comment_deleted" ? -1 : 1;
            if (post?.id) {
              setState((s) => ({
                ...s,
                post: { ...s.post, commentCount: Math.max(0, Number(s.post?.commentCount || 0) + delta) },
              }));
            } else {
              setState((s) => ({ ...s, commentCount: Math.max(0, Number(s.commentCount || 0) + delta) }));
            }
            onChanged?.(event);
          }}
        />
      )}
      {sendOpen && <SendToFriendModal activity={state} onClose={() => setSendOpen(false)} />}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 14, marginBottom: 12, overflow: "hidden" },
    activityCard: { backgroundColor: c.surface, borderColor: c.border, paddingLeft: 16 },
    activityRail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
    cardCompact: { marginBottom: 10, padding: 12 },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.surface2 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0, flexWrap: "wrap" },
    name: { color: c.text, fontWeight: "800", fontSize: 13 },
    username: { color: c.dim, fontSize: 10, flexShrink: 1 },
    meta: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    typeChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
    typeChipText: { color: c.accent, fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
    postMenuButton: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    body: { color: c.text, fontSize: 14, lineHeight: 20, marginTop: 12 },
    activityHeadline: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 },
    activityEmoji: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    activityEmojiText: { fontSize: 18 },
    activityLabel: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 },
    activityTitle: { color: c.text, fontSize: 14, fontWeight: "900", marginTop: 2 },

    // ---- hero: poster kartı büyütülüp kişi bilgisi + menü doğrudan görselin içinde ----
    // width YOK: sabit "100%" kullanılırsa ebeveynin padding'li kutusuna göre sabitlenir ve
    // aşağıdaki negatif marginHorizontal'ı genişliği büyütmeden sadece sola kaydırır — sonuç
    // sağda padding kadar boşluk. Genişliksiz bırakınca View'in varsayılan alignItems:"stretch"
    // davranışı devreye giriyor, negatif margin de genişliği doğru şekilde büyütüyor.
    heroMedia: { position: "relative", aspectRatio: 2 / 3 },
    heroPoster: { width: "100%", height: "100%" },
    heroShadeTop: { position: "absolute", left: 0, right: 0, top: 0, height: 90 },
    heroShadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 150 },
    heroTopRow: {
      position: "absolute", top: 0, left: 0, right: 0,
      flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
      padding: 13,
    },
    heroPerson: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, minWidth: 0 },
    heroAvatar: { width: 33, height: 33, borderRadius: 999, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)" },
    heroName: { color: "#fff", fontWeight: "800", fontSize: 13 },
    heroUsername: { color: "rgba(255,255,255,0.68)", fontSize: 10 },
    heroMeta: { color: "rgba(255,255,255,0.72)", fontSize: 10.5, marginTop: 2 },
    heroMenuBtn: {
      width: 29, height: 29, borderRadius: 999, alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(10,8,14,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    },
    heroCopy: { position: "absolute", left: 15, right: 15, bottom: 13 },
    heroTag: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 7 },
    heroTagText: { color: "#fff", fontSize: 9, fontWeight: "800" },
    heroTitle: { color: "#fff", fontWeight: "900", fontSize: 19, lineHeight: 23 },
    heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
    heroMetaText: { color: "rgba(255,255,255,0.82)", fontSize: 11.5, fontWeight: "700" },
    heroCaption: { paddingHorizontal: 15, paddingTop: 12 },
    heroCaptionName: { fontWeight: "800", color: c.text },
    heroCaptionText: { color: c.text, fontSize: 13, lineHeight: 19 },

    // ---- anket: "versus" — iki poster tam boy yan yana, ayrı Oy Ver butonu ----
    pollVsRow: { flexDirection: "row", height: 220, marginTop: 12, borderRadius: 16, overflow: "hidden", position: "relative" },
    pollVsOpt: { flex: 1, position: "relative", backgroundColor: c.surface2 },
    pollVsOptBorder: { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.14)" },
    pollVsOptSelected: { borderWidth: 2, borderColor: c.accent },
    pollVsPoster: { width: "100%", height: "100%" },
    pollVsShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
    pollVsCopy: { position: "absolute", left: 10, right: 10, bottom: 11 },
    pollVsTitle: { color: "#fff", fontWeight: "900", fontSize: 12.5 },
    pollVsPct: { color: "rgba(255,255,255,0.82)", fontWeight: "800", fontSize: 10, marginTop: 3 },
    pollVsVote: {
      marginTop: 8, paddingVertical: 6, borderRadius: 999, alignItems: "center",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(10,8,14,0.4)",
    },
    pollVsVoteSelected: { backgroundColor: c.accent, borderColor: c.accent },
    pollVsVoteText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
    pollVsVoteTextSelected: { color: c.bg },
    pollVsDivider: {
      position: "absolute", top: "50%", left: "50%", marginTop: -14, marginLeft: -14, zIndex: 5,
      width: 28, height: 28, borderRadius: 999, backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.border,
      alignItems: "center", justifyContent: "center",
    },
    pollVsDividerText: { color: c.dim, fontSize: 8.5, fontWeight: "900" },

    // ---- tepki/yorum/paylaş + yorum önizlemesi ----
    actions: { flexDirection: "row", alignItems: "center", gap: 18, borderTopWidth: 1, borderTopColor: c.border, marginTop: 10, paddingTop: 11, paddingHorizontal: 0, marginHorizontal: 0 },
    action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
    actionShare: { marginLeft: "auto" },
    actionText: { color: c.dim, fontSize: 11.5, fontWeight: "700" },
    reactionWrap: { position: "relative" },
    reactionIcon: { fontSize: 16 },
    reactionPicker: {
      position: "absolute", bottom: 34, left: -6, zIndex: 40,
      flexDirection: "row", gap: 2, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 999, padding: 4,
      shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
    },
    reactionOption: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    reactionOptionEmoji: { fontSize: 17 },
    commentPreview: { marginTop: 10, padding: 10, backgroundColor: c.surface2, borderRadius: 12 },
    commentPreviewName: { fontWeight: "800", color: c.text },
    commentPreviewText: { color: c.text, fontSize: 12, lineHeight: 17 },
    commentPreviewMore: { color: c.dim, fontSize: 10.5, fontWeight: "700", marginTop: 4 },
  });
}
