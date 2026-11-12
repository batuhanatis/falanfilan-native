import { Alert } from "../i18n/native";
import { t as translateUI } from "../i18n/core";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Send } from "lucide-react-native";
import { FONTS } from "../theme/fonts";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { diaryApi } from "../api/diary";
import SocialCommentsModal from "./SocialCommentsModal";
import SocialSharedCard from "./SocialSharedCard";
import ListPickerModal from "./ListPickerModal";
import { reportSocialContent } from "../utils/socialReporting";
import SendToFriendModal from "./SendToFriendModal";
import ShareFan, { shareOptions } from "./salon/ShareFan";
import { parseDailyQuestion, relativeTime, totalReactions } from "./social/feedKit";
import { ApplauseSheet, CommentLine, PostFooter, PostHeader } from "./social/PostChrome";
import {
  ActivityLine,
  CheckinTicket,
  DailyQuestionSlate,
  MovieChip,
  OpinionVote,
  PollSalons,
  RatePicker,
  RecommendObject,
} from "./social/PostObjects";

// Sosyal akış (Fuaye): her paylaşım kutusuz bir satır. Üstte kim / ne yaptı / ne zaman, ortada
// paylaşılan nesne (klaket, afiş, salon kapıları, bilet, koltuk, pano), altta Alkışla · Yorum ·
// Gönder. Profilde (compact) aynı nesneler kişi satırı olmadan gösteriliyor.
//
// Tepki: tek tepki "Alkış" (verideki "fire"). Eski 🤝/👎 tepkileri de alkış sayılır; fikir
// paylaşımlarında aynı kayıt "Katılıyorum/Katılmıyorum" oyu olduğu için orada alkış yok.

function postVerb(post, dq) {
  if (!post) return translateUI("paylaştı");
  if (dq) return translateUI("günün sorusunu cevapladı");
  if (post.type === "recommend") return translateUI("öneriyor");
  if (post.type === "poll") return translateUI("soruyor");
  if (post.type === "checkin") return translateUI("sinemada");
  if (post.type === "thought") return translateUI("bir fikir yazdı");
  if (post.type === "card") {
    const kind = post.cardPayload?.kind;
    if (kind === "diary_rating") return translateUI("izledi ve puanladı");
    if (kind === "blend") return translateUI("Blend sonucunu paylaştı");
    if (kind === "profile") return translateUI("profilini paylaştı");
    if (kind === "poster_puzzle") return translateUI("günün oyununu oynadı");
    return translateUI("oyun sonucunu paylaştı");
  }
  return translateUI("paylaştı");
}

export default function SocialFeedCard({ item, navigation, compact = false, onChanged, onAnswerQuestion }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [state, setState] = useState(item);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [applauseOpen, setApplauseOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [listMovie, setListMovie] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [viewerDiaryEntry, setViewerDiaryEntry] = useState(null);
  const [viewerDiaryLoaded, setViewerDiaryLoaded] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);

  useEffect(() => {
    setState(item);
  }, [item]);

  const user = state.user || {};
  const post = state.post;
  const isOwnPost = Number(user.id) === Number(auth.id);
  const ratingMovie = post?.type === "card" && post?.cardPayload?.kind === "diary_rating"
    ? post.cardPayload.movie
    : null;
  // Kendi puan paylaşımında "Sen kaç verirsin?" sorulmuyor.
  const askViewerRating = !!ratingMovie?.id && !isOwnPost && !compact;

  useEffect(() => {
    if (!askViewerRating) {
      setViewerDiaryEntry(null);
      setViewerDiaryLoaded(false);
      return;
    }
    let active = true;
    setViewerDiaryLoaded(false);
    diaryApi.entry(auth.token, ratingMovie.id)
      .then((data) => {
        if (!active) return;
        setViewerDiaryEntry(data?.entry || null);
        setViewerDiaryLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        if (error?.status === 404) {
          setViewerDiaryEntry(null);
          setViewerDiaryLoaded(true);
        }
      });
    return () => { active = false; };
  }, [auth.token, ratingMovie?.id, askViewerRating]);

  function openProfile(userId = user.id) {
    if (Number(userId) === Number(auth.id)) navigation.navigate("MainTabs", { screen: "Profile" });
    else navigation.navigate("OtherProfile", { userId });
  }

  function openMovie(movie) {
    if (movie) navigation.navigate("Detail", { movie });
  }

  async function rateFromFeed(value) {
    if (!ratingMovie?.id || !viewerDiaryLoaded || ratingSaving) return;
    setRatingSaving(true);
    try {
      const result = await diaryApi.save(auth.token, ratingMovie.id, {
        watchedAt: viewerDiaryEntry?.watchedAt || new Date().toISOString(),
        rating: value,
        note: viewerDiaryEntry?.note || null,
      });
      setViewerDiaryEntry(result?.entry || { ...(viewerDiaryEntry || {}), rating: value });
    } catch {}
    setRatingSaving(false);
  }

  async function markWatchedFromFeed() {
    if (!ratingMovie?.id || !viewerDiaryLoaded || ratingSaving || viewerDiaryEntry) return;
    setRatingSaving(true);
    try {
      const result = await diaryApi.save(auth.token, ratingMovie.id, {
        watchedAt: new Date().toISOString(),
        rating: null,
        note: null,
      });
      setViewerDiaryEntry(result?.entry || { watchedAt: new Date().toISOString(), rating: null, note: null });
    } catch {}
    setRatingSaving(false);
  }

  async function vote(movieId) {
    if (!post?.id || !movieId) return;
    try {
      const data = await api.socialVote(auth.token, post.id, movieId);
      setState((s) => ({ ...s, post: { ...s.post, myVote: data.myVote, pollCounts: data.pollCounts || {}, pollVoters: data.pollVoters || {} } }));
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
  const dq = state.kind === "post" && post?.type === "thought" ? parseDailyQuestion(body) : null;
  const isOpinionPost = state.kind === "post" && post?.type === "thought" && !!body && !dq;
  const isCheckin = state.kind === "post" && post?.type === "checkin" && !!post?.checkin;
  const reactionKind = state.kind === "post" ? "post" : "activity";
  const reactionTargetId = state.kind === "post" ? post?.id : state.activityId;
  const myReaction = post?.myReaction ?? state.myReaction;
  const reactionCounts = post?.reactionCounts || state.reactionCounts || {};
  const commentCount = state.kind === "post" ? post?.commentCount : state.commentCount;
  const latestComment = state.kind === "post" ? post?.latestComment : state.latestComment;
  const time = relativeTime(state.created_at);

  if (removed) return null;

  const applause = reactionTargetId && !isOpinionPost
    ? {
      mine: !!myReaction,
      total: totalReactions(reactionCounts),
      onPress: () => react(myReaction || "fire"),
      onLongPress: () => setApplauseOpen(true),
    }
    : null;

  const share = !compact && reactionTargetId ? (
    <ShareFan
      style={styles.share}
      accessibilityLabel={translateUI("Gönder")}
      options={primaryMovie?.id
        ? shareOptions({
          message: translateUI("{0} Pellix'te \"{1}\" paylaştı: {2}", { 0: user.name || translateUI("Bir arkadaşım"), 1: primaryMovie.title, 2: `https://open.pellix.app/u/film/${primaryMovie.id}?c=social_share` }),
          url: `https://open.pellix.app/u/film/${primaryMovie.id}?c=social_share`,
          sendToFriend: () => setSendOpen(true),
        })
        : [{ key: "friend", label: translateUI("Arkadaşına"), onPress: () => setSendOpen(true) }]}
    >
      <Send size={18} color={c.dim} />
    </ShareFan>
  ) : null;

  let object = null;
  if (state.kind === "activity") {
    object = (
      <ActivityLine
        c={c}
        item={state}
        time={time}
        onOpenProfile={() => openProfile(state.user?.id)}
        onOpen={() => {
          if (primaryMovie) openMovie(primaryMovie);
          else if (state.activityType === "list_created" && state.payload?.list_id) {
            navigation.navigate("WatchlistDetail", { watchlistId: state.payload.list_id, name: state.payload.list_name });
          }
        }}
      />
    );
  } else if (isCheckin) {
    object = <CheckinTicket c={c} checkin={post.checkin} movie={primaryMovie} createdAt={state.created_at} onOpenMovie={openMovie} />;
  } else if (post?.type === "card" && post.cardPayload) {
    object = <SocialSharedCard payload={post.cardPayload} navigation={navigation} currentUserId={auth.id} compact={compact} />;
  } else if (post?.type === "poll" && post.pollMovies?.length === 2) {
    object = (
      <PollSalons
        c={c}
        question={body}
        movies={post.pollMovies}
        counts={post.pollCounts}
        voters={post.pollVoters}
        myVote={post.myVote}
        onVote={vote}
        onOpen={openMovie}
      />
    );
  } else if (post?.type === "recommend" && primaryMovie) {
    object = (
      <RecommendObject
        c={c}
        movie={primaryMovie}
        note={body}
        authorName={user.name}
        compact={compact}
        onOpen={() => openMovie(primaryMovie)}
        onAddToList={() => setListMovie(primaryMovie)}
      />
    );
  } else if (dq) {
    object = (
      <DailyQuestionSlate
        c={c}
        question={dq.question}
        answer={dq.answer}
        createdAt={state.created_at}
        compact={compact}
        onAnswer={!compact && !isOwnPost && onAnswerQuestion ? () => onAnswerQuestion(dq.question) : null}
      />
    );
  } else {
    object = (
      <>
        {!!body && <Text style={[styles.thought, compact && styles.thoughtCompact]}>{body}</Text>}
        {!!primaryMovie && <MovieChip c={c} movie={primaryMovie} onOpen={() => openMovie(primaryMovie)} />}
        {isOpinionPost && !!reactionTargetId && <OpinionVote c={c} myReaction={myReaction} counts={reactionCounts} onVote={react} />}
      </>
    );
  }

  return (
    <View style={[styles.post, compact && styles.postCompact]}>
      {state.kind !== "activity" && (
        <PostHeader
          c={c}
          user={user}
          verb={postVerb(post, dq)}
          time={time}
          compact={compact}
          onProfile={() => openProfile()}
          onMenu={isOwnPost ? requestDeletePost : requestReportContent}
          menuBusy={deleting}
        />
      )}

      {object}

      {askViewerRating && (
        <RatePicker
          c={c}
          value={viewerDiaryEntry?.rating || null}
          onChange={rateFromFeed}
          disabled={!viewerDiaryLoaded || ratingSaving}
          loading={!viewerDiaryLoaded}
          watched={!!viewerDiaryEntry}
          onWatched={markWatchedFromFeed}
          saving={ratingSaving}
        />
      )}

      {!!reactionTargetId && (
        <PostFooter
          c={c}
          compact={compact || state.kind === "activity"}
          applause={applause}
          commentCount={commentCount}
          onComments={() => setCommentsOpen(true)}
          share={share}
        />
      )}

      {!!reactionTargetId && !compact && Number(commentCount) > 0 && (
        <CommentLine c={c} comment={latestComment} count={Number(commentCount)} onPress={() => setCommentsOpen(true)} />
      )}

      {(!!post?.id || !!state.activityId) && (
        <SocialCommentsModal
          visible={commentsOpen}
          postId={post?.id}
          activityId={state.activityId}
          originalNote={state.kind === "post" && !!body ? { authorId: user.id, authorName: user.name, authorAvatar: user.avatar_url, text: dq ? [dq.question, dq.answer].filter(Boolean).join("\n\n") : body } : null}
          canModerate={Number(user.id) === Number(auth.id)}
          navigation={navigation}
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
      {!!reactionTargetId && (
        <ApplauseSheet
          c={c}
          visible={applauseOpen}
          kind={reactionKind}
          targetId={reactionTargetId}
          onClose={() => setApplauseOpen(false)}
          onOpenProfile={(id) => openProfile(id)}
        />
      )}
      {sendOpen && <SendToFriendModal activity={state} onClose={() => setSendOpen(false)} />}
      {listMovie && <ListPickerModal movie={listMovie} onClose={() => setListMovie(null)} />}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    post: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    postCompact: { paddingVertical: 14 },
    thought: { color: c.text, fontSize: 18, lineHeight: 26, marginTop: 12 },
    thoughtCompact: { fontSize: 16, lineHeight: 23, marginTop: 6 },
    share: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    mono: { fontFamily: FONTS.monoMedium },
  });
}
