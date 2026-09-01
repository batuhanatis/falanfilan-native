import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import {
  Star, Film, ListVideo, BarChart2, Crown, Check, CalendarClock, Clock, AlertCircle,
  RotateCcw, X, Eye, EyeOff, Reply, Sparkles, MessageCircle,
} from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import { platformLogo } from "../utils/platform";
import { timeLabel } from "../utils/chatTimeLabels";
import { decodeMovieShare } from "../utils/movieShare";
import { decodeListShare } from "../utils/listShare";
import { decodeActivityShare } from "../utils/activityShare";
import { decodePhotoMessage } from "../utils/photoShare";
import { decodePoll, decodePlan, formatPlanTime } from "../utils/richMessage";
import { decodeStoryReply } from "../utils/storyReplyShare";
import RetryImage from "./RetryImage";

// CH2 — bir mesaja reaksiyon eklendiğinde/değiştiğinde rozet artık sabit belirmiyor, küçük bir
// sıçramayla (spring) beliriyor. "key" prop'u (renderReactionBadge'de emoji setine bağlı)
// değişince React bunu SIFIRDAN kurar, bu yüzden animasyon her değişiklikte baştan oynar.
function ReactionBadgePop({ style, children }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 16 }).start();
  }, []);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

// CH4 — "gönderilemedi" uyarısı artık ilk belirdiği anda hafifçe sallanıp dikkat çekiyor,
// eskiden sessizce/statik beliriyordu.
function ShakeOnMount({ children }) {
  const translateX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(translateX, { toValue: -5, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 5, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -4, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ transform: [{ translateX }] }}>{children}</Animated.View>;
}

function renderReactionBadge(reactionsKey, isMine, styles) {
  if (!reactionsKey) return null;
  return (
    <ReactionBadgePop key={reactionsKey} style={[styles.reactionBadge, isMine ? { right: 4 } : { left: 4 }]}>
      <Text style={styles.reactionBadgeText}>{reactionsKey}</Text>
    </ReactionBadgePop>
  );
}

function renderLeftActions(dragX, c, styles) {
  const scale = dragX.interpolate({ inputRange: [0, 60], outputRange: [0.5, 1], extrapolate: "clamp" });
  return (
    <View style={styles.replySwipeAction}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Reply size={18} color={c.accent} />
      </Animated.View>
    </View>
  );
}

// ÖNEMLİ (performans — asıl "smooth" düzeltmesi): Bu bileşen eskiden ChatConversationScreen'in
// FlatList'ine doğrudan verilen dev bir inline fonksiyondu. Sohbetteki HERHANGİ bir mutasyon
// (bir mesajın "okundu" bayrağı, bir reaksiyon, yazıyor göstergesi vb.) tüm mesaj dizisini
// YENİDEN oluşturuyordu (bkz. flatData), bu da ekranda o an görünen HER balonun yeniden render
// edilmesine yol açıyordu — uzun sohbetlerde WhatsApp'ın asla yaşamadığı türden bir takılmaydı.
// Artık ayrı, React.memo'lu bir bileşen: parent SADECE İLKEL (primitive) değerler + tek, SABİT
// kimlikli bir "actions" köprüsü geçiyor — değişmeyen bir mesajın propları da DEĞERCE aynı
// kaldığı için memo, o satırı render etmeden atlayabiliyor.
function ChatMessageRow({
  id, body, isMine, myId, createdAt, editedAt, deletedForEveryone, status, reactionsKey, showSeenTick,
  replyToId, replySnippet, rowSpacing, isSelected, isHighlighted, selectionMode,
  friendId, friendAvatar, storyActive, c, styles, actions,
}) {
  const isFailed = status === "failed";
  const isSending = status === "sending";
  const canLongPress = !deletedForEveryone && !selectionMode;

  function handlePress() {
    if (selectionMode) actions.toggleSelected(id);
  }
  function handleLongPress() {
    if (canLongPress) actions.openMenu(id);
  }

  const timeInBubble = (
    <Text style={[styles.timeTextInBubble, isMine ? { color: "rgba(20,18,10,0.55)" } : { color: c.dim }]}>
      {timeLabel(createdAt)}
    </Text>
  );

  function renderReplyPreviewBlock() {
    if (!replyToId || !replySnippet) return null;
    return (
      <TouchableOpacity
        onPress={() => actions.scrollToMessage(replyToId)}
        style={[styles.replyPreviewInBubble, isMine ? { borderLeftColor: "rgba(20,18,10,0.35)" } : { borderLeftColor: c.accent }]}
      >
        <Text style={[styles.replyPreviewText, isMine ? { color: "rgba(20,18,10,0.7)" } : { color: c.dim }]} numberOfLines={1}>
          {replySnippet}
        </Text>
      </TouchableOpacity>
    );
  }

  const shared = decodeMovieShare(body);
  const listShared = decodeListShare(body);
  const activityShared = decodeActivityShare(body);
  const photo = decodePhotoMessage(body);
  const poll = decodePoll(body);
  const plan = decodePlan(body);
  const storyReplyShared = decodeStoryReply(body);
  const maxWidthPct = poll || plan || activityShared || storyReplyShared ? "92%" : "84%";

  let bubbleContent;

  if (deletedForEveryone) {
    bubbleContent = (
      <View style={[styles.photoLockedBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <X size={13} color={isMine ? c.bg : c.dim} />
        <Text style={[styles.messageBodyText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs, { fontStyle: "italic" }]}>Bu mesaj silindi</Text>
      </View>
    );
  } else if (photo) {
    if (photo.consumed) {
      bubbleContent = (
        <View style={[styles.photoLockedBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <EyeOff size={14} color={isMine ? c.bg : c.dim} />
          <Text style={[styles.messageBodyText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>Fotoğraf görüntülendi</Text>
        </View>
      );
    } else if (photo.once) {
      bubbleContent = (
        <TouchableOpacity
          style={[styles.photoLockedBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, isFailed && { opacity: 0.7 }]}
          activeOpacity={isMine && !isFailed ? 1 : 0.75}
          onPress={() => (isFailed ? actions.retryFailedMessage(id) : selectionMode ? actions.toggleSelected(id) : !isMine && actions.openOnceView(id))}
          onLongPress={isSending || isFailed ? undefined : handleLongPress}
        >
          {isSending ? <Clock size={14} color={isMine ? c.bg : c.text} /> : isFailed ? <AlertCircle size={14} color={c.danger} /> : <Eye size={14} color={isMine ? c.bg : c.text} />}
          <Text style={[styles.messageBodyText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {isSending ? "Gönderiliyor..." : isFailed ? "Gönderilemedi — tekrar dene" : isMine ? "Tek seferlik fotoğraf gönderildi" : "Fotoğrafı Gör"}
          </Text>
        </TouchableOpacity>
      );
    } else {
      bubbleContent = (
        <TouchableOpacity
          onPress={() => (isFailed ? actions.retryFailedMessage(id) : selectionMode ? actions.toggleSelected(id) : actions.openViewer(photo.image, true))}
          onLongPress={isSending || isFailed ? undefined : handleLongPress}
          activeOpacity={0.9}
          style={{ position: "relative" }}
        >
          {renderReplyPreviewBlock()}
          <Image source={{ uri: photo.image }} style={[styles.photoBubbleImage, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }, (isSending || isFailed) && { opacity: 0.55 }]} />
          {(isSending || isFailed) && (
            <View style={styles.photoStatusOverlay} pointerEvents="none">
              {isSending ? <Clock size={20} color="#fff" /> : (
                <>
                  <AlertCircle size={20} color="#fff" />
                  <Text style={styles.photoStatusOverlayText}>Tekrar dene</Text>
                </>
              )}
            </View>
          )}
          <View style={styles.photoTimeBadge}><Text style={styles.photoTimeBadgeText}>{timeLabel(createdAt)}</Text></View>
          {renderReactionBadge(reactionsKey, isMine, styles)}
        </TouchableOpacity>
      );
    }
  } else if (shared) {
    const movieGradient = shared.type === "Dizi" ? ["#0EA5E9", "#6366F1"] : ["#8B5CF6", "#EC4899"];
    bubbleContent = (
      <TouchableOpacity
        style={[styles.movieBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
        activeOpacity={0.8}
        onPress={() => (selectionMode ? actions.toggleSelected(id) : actions.navigateDetail(shared))}
        onLongPress={handleLongPress}
      >
        <View style={styles.movieBubblePosterWrap}>
          {shared.poster ? (
            <Image source={{ uri: shared.poster }} style={styles.movieBubblePoster} />
          ) : (
            <View style={[styles.movieBubblePoster, { backgroundColor: c.surface2 }]} />
          )}
          {!!shared.imdb && (
            <View style={styles.movieBubbleRatingBadge}>
              <Star size={8} color="#F5C518" fill="#F5C518" />
              <Text style={styles.movieBubbleRatingText}>{shared.imdb}</Text>
            </View>
          )}
        </View>
        <View style={styles.movieBubbleInfo}>
          <LinearGradient colors={movieGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.movieBubblePill}>
            <Film size={10} color="#fff" />
            <Text style={styles.movieBubblePillText} numberOfLines={1}>{shared.type === "Dizi" ? "Dizi Önerisi" : "Film Önerisi"}</Text>
          </LinearGradient>
          <Text style={[styles.movieBubbleTitle, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>{shared.title}</Text>
          <Text style={[styles.movieBubbleMeta, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={1}>
            {shared.year}{shared.genre ? ` · ${shared.genre}` : ""}
          </Text>
          {(() => {
            const logos = (Array.isArray(shared.platforms) ? shared.platforms : []).map(platformLogo).filter(Boolean).slice(0, 4);
            return logos.length > 0 ? (
              <View style={styles.movieBubblePlatformsRow}>
                {logos.map((logo, i) => <Image key={i} source={{ uri: logo }} style={styles.movieBubblePlatformLogo} />)}
              </View>
            ) : null;
          })()}
        </View>
        <View style={styles.movieBubbleTimeCorner}>{timeInBubble}</View>
        {renderReactionBadge(reactionsKey, isMine, styles)}
      </TouchableOpacity>
    );
  } else if (listShared) {
    bubbleContent = (
      <TouchableOpacity
        style={[styles.movieBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
        activeOpacity={0.8}
        onPress={() => (selectionMode ? actions.toggleSelected(id) : actions.navigateWatchlist(listShared.id, listShared.name))}
        onLongPress={handleLongPress}
      >
        {listShared.previewPoster ? (
          <Image source={{ uri: listShared.previewPoster }} style={styles.movieBubblePoster} />
        ) : (
          <LinearGradient colors={["#14B8A6", "#0EA5E9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.movieBubblePoster, { alignItems: "center", justifyContent: "center" }]}>
            <ListVideo size={26} color="#fff" />
          </LinearGradient>
        )}
        <View style={styles.movieBubbleInfo}>
          <LinearGradient colors={["#14B8A6", "#0EA5E9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.movieBubblePill}>
            <ListVideo size={10} color="#fff" />
            <Text style={styles.movieBubblePillText} numberOfLines={1}>Liste</Text>
          </LinearGradient>
          <Text style={[styles.movieBubbleTitle, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>{listShared.name}</Text>
          <Text style={[styles.movieBubbleMeta, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={1}>
            {listShared.ownerName} · {listShared.count} içerik
          </Text>
        </View>
        <View style={styles.movieBubbleTimeCorner}>{timeInBubble}</View>
        {renderReactionBadge(reactionsKey, isMine, styles)}
      </TouchableOpacity>
    );
  } else if (activityShared) {
    const activityMovie = activityShared.movie;
    bubbleContent = (
      <TouchableOpacity
        style={[styles.activityShareBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
        activeOpacity={0.82}
        onPress={() => (selectionMode ? actions.toggleSelected(id) : actions.navigateActivity())}
        onLongPress={handleLongPress}
      >
        <LinearGradient colors={["#EC4899", "#8B5CF6", "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.activityShareHeader}>
          <Sparkles size={12} color="#fff" />
          <Text style={styles.activityShareHeaderText}>AKTİVİTE PAYLAŞIMI</Text>
        </LinearGradient>
        <View style={styles.activityShareBody}>
          {activityMovie?.poster ? (
            <Image source={{ uri: activityMovie.poster }} style={styles.activitySharePoster} />
          ) : (
            <LinearGradient colors={["#EC4899", "#6366F1"]} style={[styles.activitySharePoster, { alignItems: "center", justifyContent: "center" }]}>
              <Sparkles size={24} color="#fff" />
            </LinearGradient>
          )}
          <View style={styles.activityShareInfo}>
            <View style={styles.activityShareUserRow}>
              {!!activityShared.user && <RetryImage source={{ uri: avatarOr(activityShared.user.avatar_url, activityShared.user.id) }} style={styles.activityShareAvatar} />}
              <Text style={[styles.activityShareUser, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={1}>
                {activityShared.user?.name || "Pellix"}
              </Text>
            </View>
            <Text style={[styles.activityShareText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={3}>{activityShared.text}</Text>
            {!!activityShared.body && (
              <Text style={[styles.activityShareCaption, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>“{activityShared.body}”</Text>
            )}
            {!!activityMovie?.title && (
              <Text style={[styles.activityShareMovieTitle, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>{activityMovie.title}</Text>
            )}
          </View>
        </View>
        <View style={styles.movieBubbleTimeCorner}>{timeInBubble}</View>
        {renderReactionBadge(reactionsKey, isMine, styles)}
      </TouchableOpacity>
    );
  } else if (storyReplyShared) {
    const storyMovie = storyReplyShared.movie;
    bubbleContent = (
      <View style={[styles.activityShareBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <LinearGradient colors={["#F59E0B", "#EC4899"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.activityShareHeader}>
          <MessageCircle size={12} color="#fff" />
          <Text style={styles.activityShareHeaderText}>{isMine ? "STORY'YE YANIT VERDİN" : "STORY'NE YANIT VERDİ"}</Text>
        </LinearGradient>
        <View style={styles.activityShareBody}>
          {storyActive ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => (selectionMode ? actions.toggleSelected(id) : actions.navigateDetail(storyMovie))}
              onLongPress={handleLongPress}
            >
              {storyMovie?.poster ? (
                <Image source={{ uri: storyMovie.poster }} style={styles.activitySharePoster} />
              ) : (
                <LinearGradient colors={["#F59E0B", "#EC4899"]} style={[styles.activitySharePoster, { alignItems: "center", justifyContent: "center" }]}>
                  <Film size={22} color="#fff" />
                </LinearGradient>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.activitySharePoster, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(120,120,130,0.25)" }]}>
              <EyeOff size={18} color={isMine ? "rgba(20,18,10,0.55)" : c.dim} />
            </View>
          )}
          <View style={styles.activityShareInfo}>
            <Text style={[styles.activityShareText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={4}>
              {storyReplyShared.note}
            </Text>
            {storyActive ? (
              !!storyMovie?.title && (
                <Text style={[styles.activityShareMovieTitle, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>
                  {storyMovie.title}
                </Text>
              )
            ) : (
              <Text style={[styles.activityShareMovieTitle, { fontStyle: "italic", opacity: 0.75 }, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>
                Bu story artık görüntülenemiyor
              </Text>
            )}
          </View>
        </View>
        <View style={styles.movieBubbleTimeCorner}>{timeInBubble}</View>
        {renderReactionBadge(reactionsKey, isMine, styles)}
      </View>
    );
  } else if (poll) {
    const myVote = poll.votes?.[String(myId)] ?? poll.votes?.[myId];
    const friendVote = poll.votes?.[String(friendId)] ?? poll.votes?.[friendId];
    const totalVotes = Object.keys(poll.votes || {}).length;
    const voteCounts = poll.options.map((_, i) => Object.values(poll.votes || {}).filter((v) => v === i).length);
    const maxVoteCount = Math.max(0, ...voteCounts);
    bubbleContent = (
      <View style={[styles.pollBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <LinearGradient colors={["#F97316", "#DB2777", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pollHeaderStrip}>
          <BarChart2 size={13} color="#fff" />
          <Text style={styles.pollQuestion} numberOfLines={2}>{poll.question}</Text>
        </LinearGradient>
        <View style={styles.pollBody}>
          <View style={styles.pollOptionsRow}>
            {poll.options.map((opt, i) => {
              const voteCount = voteCounts[i];
              const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              const isMyVote = myVote === i;
              const isFriendVote = friendVote === i;
              const isLeader = totalVotes > 0 && voteCount > 0 && voteCount === maxVoteCount;
              const checkColor = isMine ? c.bg : c.accent;
              return (
                <View key={opt.id ?? i} style={styles.pollOptionCol}>
                  <TouchableOpacity onPress={() => actions.navigateDetail(opt)} activeOpacity={0.85} style={{ position: "relative" }}>
                    {opt.poster
                      ? <Image source={{ uri: opt.poster }} style={[styles.pollOptionPoster, isLeader && styles.pollOptionPosterLeading]} />
                      : <View style={[styles.pollOptionPoster, { backgroundColor: c.surface2 }]} />}
                    {isLeader && (
                      <View style={styles.pollLeaderBadge}>
                        <Crown size={11} color="#1a1a1a" fill="#FFD700" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={[styles.pollOptionTitle, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>
                    {opt.title}
                  </Text>
                  <View style={styles.pollOptionBarTrack}>
                    {pct > 0 && (
                      <LinearGradient
                        colors={["#F97316", "#DB2777"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.pollOptionBarFill, { width: `${pct}%` }]}
                      />
                    )}
                  </View>
                  <Text style={[styles.pollOptionPct, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                    {totalVotes > 0 ? `%${pct}` : " "}
                  </Text>
                  <TouchableOpacity style={styles.pollVoteRow} onPress={() => actions.votePoll(id, i)} activeOpacity={0.7}>
                    <View style={[
                      styles.pollCheckbox,
                      { borderColor: checkColor },
                      isMyVote && { backgroundColor: checkColor },
                    ]}>
                      {isMyVote && <Check size={13} color={isMine ? c.accent : c.bg} />}
                    </View>
                    {isFriendVote && (
                      <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={styles.pollVoterAvatar} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.movieBubbleTimeCorner}>{timeInBubble}</View>
      </View>
    );
  } else if (plan) {
    bubbleContent = (
      <View style={[styles.planBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <LinearGradient colors={["#06B6D4", "#6366F1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.planHeaderStrip}>
          <CalendarClock size={14} color="#fff" />
          <Text style={styles.planHeaderStripText}>İzleme Planı</Text>
        </LinearGradient>
        <View style={styles.planBody}>
          <Text style={[styles.planNote, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {formatPlanTime(plan.scheduledAt)}
          </Text>
          {!!plan.note && (
            <Text style={[styles.planSubNote, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>{plan.note}</Text>
          )}
          {plan.status === "accepted" ? (
            <View style={styles.planStatusRow}>
              <Check size={13} color={isMine ? c.bg : c.accent2} />
              <Text style={[styles.planStatusText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>Kabul edildi</Text>
            </View>
          ) : isMine ? (
            <Text style={[styles.planStatusText, styles.bubbleTextMine, { opacity: 0.8 }]}>Yanıt bekleniyor...</Text>
          ) : (
            <TouchableOpacity onPress={() => actions.acceptPlan(id)} activeOpacity={0.85}>
              <LinearGradient colors={["#22C55E", "#06B6D4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.planAcceptBtn}>
                <Check size={14} color="#fff" />
                <Text style={styles.planAcceptBtnText}>Kabul Et</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.movieBubbleTimeCorner}>{timeInBubble}</View>
      </View>
    );
  } else {
    bubbleContent = (
      <TouchableOpacity
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : [styles.bubbleTheirs, styles.bubbleTheirsBorder],
          isFailed && { opacity: 0.7 },
        ]}
        activeOpacity={0.8}
        onPress={() => (isFailed ? actions.retryFailedMessage(id) : handlePress())}
        onLongPress={isSending || isFailed ? undefined : handleLongPress}
      >
        {/* CH1 — düz metin balonları eskiden zengin kartların yanında tamamen sönük duruyordu;
            "mine" balona ince bir üst parlaklık (gloss), "theirs" balona hafif bir çerçeve
            eklendi — abartılı bir gradyan değil, küçük bir doku. */}
        {isMine && (
          <LinearGradient
            colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
            style={styles.bubbleGloss}
            pointerEvents="none"
          />
        )}
        {renderReplyPreviewBlock()}
        <Text style={[styles.messageBodyText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>{body}</Text>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 2 }}>
          {!!editedAt && (
            <Text style={[styles.editedTag, isMine ? { color: "rgba(20,18,10,0.6)" } : { color: c.dim }]}>düzenlendi</Text>
          )}
          {isMine && isSending && <Clock size={11} color="rgba(20,18,10,0.55)" />}
          {isMine && isFailed && <AlertCircle size={12} color={c.danger} />}
          {timeInBubble}
        </View>
        {isFailed && (
          <ShakeOnMount>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={(e) => { e.stopPropagation(); actions.retryFailedMessage(id); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <RotateCcw size={11} color={c.danger} />
              <Text style={styles.failedText}>Gönderilemedi — tekrar dene</Text>
            </TouchableOpacity>
          </ShakeOnMount>
        )}
        {renderReactionBadge(reactionsKey, isMine, styles)}
      </TouchableOpacity>
    );
  }

  const row = (
    <View style={[
      { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: isMine ? "flex-end" : "flex-start", borderRadius: 14, marginTop: rowSpacing },
      isHighlighted && styles.highlightedRow,
    ]}>
      {selectionMode && !isMine && (
        <View style={[styles.selectCircle, isSelected && { backgroundColor: c.accent, borderColor: c.accent }]}>
          {isSelected && <Check size={12} color={c.bg} />}
        </View>
      )}
      <View style={{ maxWidth: maxWidthPct }}>
        {bubbleContent}
        {showSeenTick && (
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 2 }}>
            <Text style={styles.seenText}>Görüldü</Text>
          </View>
        )}
      </View>
      {selectionMode && isMine && (
        <View style={[styles.selectCircle, isSelected && { backgroundColor: c.accent, borderColor: c.accent }]}>
          {isSelected && <Check size={12} color={c.bg} />}
        </View>
      )}
    </View>
  );

  const measureLayout = (e) => actions.measureLayout(id, e.nativeEvent.layout.y);

  if (deletedForEveryone || selectionMode) {
    return <View onLayout={measureLayout}>{row}</View>;
  }

  return (
    <View onLayout={measureLayout}>
      <Swipeable
        ref={(ref) => actions.setSwipeRef(id, ref)}
        renderLeftActions={(progress, dragX) => renderLeftActions(dragX, c, styles)}
        onSwipeableWillOpen={() => actions.startReply(id)}
        leftThreshold={35}
        friction={1.4}
        overshootLeft={false}
      >
        {row}
      </Swipeable>
    </View>
  );
}

export default React.memo(ChatMessageRow);
