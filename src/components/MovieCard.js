import React, { useState, useRef, useEffect } from "react";
import { View, Text, Image, Animated, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X, Bookmark, Star, Send, Sparkles, MessageCircle, Bell, BellRing } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { platformName, platformLogo } from "../utils/platform";
import { hapticLight } from "../utils/haptics";
import CommentsModal from "./CommentsModal";

// CM4 — poster yüklenirken ani "pat" yerine yumuşak bir fade-in. FlatList ızgarası dolarken
// tüm posterlerin aynı anda pat diye belirmesi yerine her biri kendi yüklenme hızında beliriyor.
function FadeInImage({ style, ...props }) {
  const opacity = useRef(new Animated.Value(0)).current;
  return (
    <Animated.Image
      {...props}
      style={[style, { opacity }]}
      onLoad={(e) => {
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        props.onLoad?.(e);
      }}
    />
  );
}

// Instagram gönderisi mantığı: üstte poster (biraz kısaltılmış, sayfaya daha rahat sığsın diye),
// altında aksiyon ikonları + "X ve Y kişi beğendi" satırı + başlık + "N yorumun tümünü gör".
// PERF — React.memo: Ana Sayfa'nın sonsuz kaydırmalı ızgarasında her yeni sayfa (loadMore)
// geldiğinde HomeScreen yeniden render oluyor; bu bileşen memo'suzken FlatList'teki HER kart
// (o an ekranda/bellekte olan onlarcası) gereksiz yere yeniden render ediliyordu — kaydırdıkça
// daha çok kart canlı kaldığı için gecikme birikip "sayfa ağırlaşıyor" hissi veriyordu. Artık
// sadece BU kartın kendi prop'ları (liked/disliked/reason/stats gibi ilkel değerler) gerçekten
// değiştiğinde yeniden render oluyor — bunun işe yaraması için HomeScreen'in geçtiği
// onLike/onDislike/onPress gibi callback'lerin de KARARLI (stabil referanslı) olması gerekiyor.
const MovieCard = React.memo(function MovieCard({ movie, liked, disliked, watchlisted, onLike, onDislike, onAddToList, onSend, onPress, reason, stats, showNotify, notifySubscribed, onNotify, compact }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(stats?.comments || 0);
  // ÖNEMLİ DÜZELTME: useState'in başlangıç değeri sadece İLK render'da okunuyor — Home, social
  // stats'ı (yorum sayısı dahil) async olarak SONRADAN getirdiği için, stats prop'u ilk boş/0
  // halinden gerçek değerine güncellense bile commentCount hiç yenilenmiyordu (kart hep 0
  // yorumla açılıp öyle kalıyordu). Prop değiştiğinde local state'i senkron tutuyoruz.
  useEffect(() => {
    if (stats?.comments != null) setCommentCount(stats.comments);
  }, [stats?.comments]);

  const likeCount = stats?.likes || 0;
  const friendName = stats?.friendName || null;

  let likeLine = null;
  if (friendName && likeCount > 1) likeLine = `${friendName} ve ${(likeCount - 1).toLocaleString("tr-TR")} kişi beğendi`;
  else if (friendName) likeLine = `${friendName} beğendi`;
  else if (likeCount > 0) likeLine = `${likeCount.toLocaleString("tr-TR")} kişi beğendi`;

  // Ana Sayfa'daki kişiselleştirilmiş 2 sütunlu ızgara için — tüm aksiyon çubuğu/yorum/platform
  // satırları yerine sadece poster + başlık + tek bir "beğen" butonu. Diğer aksiyonlar (beğenme,
  // listeye ekleme, gönderme, yorum) artık sadece Detay sayfasında yapılabiliyor.
  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={() => onPress?.(movie)} activeOpacity={0.92}>
        <View style={styles.compactPosterWrap}>
          {movie.poster ? (
            <FadeInImage source={{ uri: movie.poster }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0)"]}
            locations={[0, 0.4]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={styles.compactRatingBadge}>
            <Star size={9} color={c.accent} fill={c.accent} />
            <Text style={styles.compactRatingText}>{movie.imdb}</Text>
          </View>
          {!!reason && (
            <View style={styles.compactReasonBadge}>
              <Sparkles size={9} color={c.accent2} />
              <Text style={styles.compactReasonText} numberOfLines={1}>{reason}</Text>
            </View>
          )}
          {/* CM2 — ızgarada artık sadece beğen değil, hızlı bir "istemiyorum" sinyali de var;
              eskiden beğenmemek için Detay sayfasına gitmek gerekiyordu. */}
          {!!onDislike && (
            <TouchableOpacity
              style={[styles.compactDislikeBtn, disliked && { backgroundColor: c.danger }]}
              onPress={() => { hapticLight(); onDislike(movie.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={13} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.compactLikeBtn, liked && { backgroundColor: c.accent2 }]}
            onPress={() => { hapticLight(); onLike(movie.id); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Heart size={14} color="#fff" fill={liked ? "#fff" : "none"} />
          </TouchableOpacity>
        </View>
        <Text style={styles.compactTitle} numberOfLines={1}>{movie.title}</Text>
        <Text style={styles.compactMeta} numberOfLines={1}>{movie.year} · {movie.type}</Text>
        {/* ÖNEMLİ: Hangi platformda yayında olduğu — bilgi amaçlı (bir AKSİYON değil), bu yüzden
            "sadece beğen butonu yeterli" kuralı bunu kapsamıyor. Detay sayfasına gitmeden burada
            görünmesi gerekiyordu, geri eklendi. */}
        {Array.isArray(movie.platforms) && movie.platforms.length > 0 ? (
          <View style={styles.compactPlatformsRow}>
            {movie.platforms.slice(0, 3).map((p, i) => {
              const logo = platformLogo(p);
              return logo ? (
                <Image key={i} source={{ uri: logo }} style={styles.compactPlatformLogo} />
              ) : (
                <View key={i} style={styles.compactPlatformFallback}>
                  <Text style={styles.compactPlatformFallbackText} numberOfLines={1}>{platformName(p)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.compactNoPlatform} numberOfLines={1}>Platformda yok</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.posterWrap} onPress={() => onPress?.(movie)} activeOpacity={0.94}>
        {movie.poster ? (
          <FadeInImage source={{ uri: movie.poster }} style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
          locations={[0, 0.35]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.ratingBadge}>
          <Star size={10} color={c.accent} fill={c.accent} />
          <Text style={styles.ratingText}>{movie.imdb}</Text>
        </View>
        {!!reason && (
          <View style={styles.reasonBadge}>
            <Sparkles size={10} color={c.accent2} />
            <Text style={styles.reasonText} numberOfLines={1}>{reason}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <IconBtn icon={Heart} active={liked} activeColor={c.accent2} filled={liked} onPress={() => onLike(movie.id)} c={c} />
          <IconBtn icon={X} active={disliked} activeColor="#ef4444" filled={disliked} onPress={() => onDislike(movie.id)} c={c} />
          <IconBtn icon={MessageCircle} onPress={() => setShowComments(true)} c={c} />
          <IconBtn icon={Send} onPress={() => onSend(movie)} c={c} />
        </View>
        <View style={{ flexDirection: "row", gap: 14 }}>
          {showNotify && (
            <IconBtn
              icon={notifySubscribed ? BellRing : Bell}
              active={notifySubscribed}
              activeColor={c.accent}
              filled={notifySubscribed}
              onPress={() => onNotify(movie.id)}
              c={c}
            />
          )}
          <IconBtn icon={Bookmark} active={watchlisted} activeColor={c.accent} filled={watchlisted} onPress={() => onAddToList(movie)} c={c} />
        </View>
      </View>
      {showNotify && (
        <Text style={styles.notifyHint}>
          {notifySubscribed ? "Çıkınca bildirim alacaksın 🔔" : "Çıkış tarihini kaçırma, bildirim al"}
        </Text>
      )}

      {!!likeLine && (
        <View style={styles.likeLineRow}>
          <Heart size={11} color={c.accent2} fill={c.accent2} />
          <Text style={styles.likeLine} numberOfLines={1}>{likeLine}</Text>
        </View>
      )}

      <Text style={styles.caption} numberOfLines={2}>
        <Text style={styles.captionTitle}>{movie.title}</Text>
        <Text style={styles.captionMeta}>  ·  {movie.year} · {movie.type}</Text>
      </Text>

      {commentCount > 0 && (
        <TouchableOpacity onPress={() => setShowComments(true)}>
          <Text style={styles.viewComments}>{commentCount} yorumun tümünü gör</Text>
        </TouchableOpacity>
      )}

      {Array.isArray(movie.platforms) && movie.platforms.length > 0 ? (
        <View style={styles.platformsRow}>
          {movie.platforms.slice(0, 4).map((p, i) => {
            const logo = platformLogo(p);
            const name = platformName(p);
            return logo ? (
              <Image key={i} source={{ uri: logo }} style={styles.platformLogo} />
            ) : (
              <View key={i} style={styles.platformFallback}>
                <Text style={styles.platformFallbackText} numberOfLines={1}>{name}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.noPlatformText}>Şu an Türkiye'de bir platformda yayında değil</Text>
      )}

      {showComments && (
        <CommentsModal
          movie={movie}
          onClose={() => setShowComments(false)}
          onCommentAdded={(count) => setCommentCount(count)}
        />
      )}
    </View>
  );
});

export default MovieCard;

// CM1 — eskiden basışta hiçbir görsel/dokunsal tepki yoktu (sadece renk anlık değişiyordu).
// Artık her basışta hafif bir sıçrama + haptic var — beğen/beğenme tüm feed'in ana sinyali
// olduğu için bu tek düzeltme uygulamanın en sık kullanılan etkileşimini kapsıyor.
function IconBtn({ icon: Icon, active, activeColor, filled, onPress, c }) {
  const scale = useRef(new Animated.Value(1)).current;
  function handlePress() {
    hapticLight();
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 40, bounciness: 14 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    onPress();
  }
  return (
    <TouchableOpacity onPress={handlePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon size={24} color={active ? activeColor : c.text} fill={filled ? activeColor : "none"} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    card: {
      width: "100%", borderRadius: 20, overflow: "hidden",
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 18,
    },
    posterWrap: { width: "100%", aspectRatio: 4 / 5, backgroundColor: c.surface2 },
    posterFallback: { backgroundColor: c.surface2 },
    ratingBadge: {
      position: "absolute", top: 10, left: 10,
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    },
    ratingText: { fontSize: 11, fontWeight: "800", color: "#fff" },
    // HM4 — eskiden 8px, neredeyse okunmuyordu. Punto büyütüldü, arka plan koyultuldu.
    reasonBadge: {
      position: "absolute", top: 10, right: 10, maxWidth: "60%",
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999,
    },
    reasonText: { fontSize: 10, fontWeight: "800", color: "#fff" },
    actionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
    likeLineRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, marginTop: 4 },
    likeLine: { fontSize: 12, fontWeight: "800", color: c.accent2 },
    notifyHint: { fontSize: 11, fontWeight: "600", color: c.dim, paddingHorizontal: 14, marginTop: 2 },
    caption: { paddingHorizontal: 14, marginTop: 4 },
    captionTitle: { fontSize: 13, fontWeight: "800", color: c.text },
    captionMeta: { fontSize: 12, color: c.dim },
    viewComments: { fontSize: 12, color: c.dim, paddingHorizontal: 14, marginTop: 4 },
    platformsRow: { flexDirection: "row", gap: 6, paddingHorizontal: 14, marginTop: 10, marginBottom: 14, flexWrap: "wrap" },
    noPlatformText: { fontSize: 11, color: c.dim, fontStyle: "italic", paddingHorizontal: 14, marginTop: 10, marginBottom: 14 },
    platformLogo: { width: 20, height: 20, borderRadius: 6, backgroundColor: "#fff" },
    platformFallback: { backgroundColor: c.surface2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    platformFallbackText: { fontSize: 9, color: c.text },

    // Ana Sayfa'nın 2 sütunlu kişiselleştirilmiş ızgarası için kompakt kart.
    compactCard: { flex: 1, marginBottom: 18 },
    compactPosterWrap: {
      width: "100%", aspectRatio: 2 / 3, borderRadius: 14, overflow: "hidden", backgroundColor: c.surface2,
    },
    compactRatingBadge: {
      position: "absolute", top: 8, left: 8,
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999,
    },
    compactRatingText: { fontSize: 10, fontWeight: "800", color: "#fff" },
    compactReasonBadge: {
      position: "absolute", top: 8, right: 8, maxWidth: "66%",
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999,
    },
    compactReasonText: { fontSize: 9, fontWeight: "800", color: "#fff" },
    compactLikeBtn: {
      position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    compactDislikeBtn: {
      position: "absolute", bottom: 8, left: 8, width: 24, height: 24, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    compactTitle: { fontSize: 12.5, fontWeight: "800", color: c.text, marginTop: 6 },
    compactMeta: { fontSize: 10.5, color: c.dim, marginTop: 1 },
    compactPlatformsRow: { flexDirection: "row", gap: 4, marginTop: 5 },
    compactPlatformLogo: { width: 16, height: 16, borderRadius: 4, backgroundColor: "#fff" },
    compactPlatformFallback: { backgroundColor: c.surface2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999 },
    compactPlatformFallbackText: { fontSize: 7.5, color: c.text },
    compactNoPlatform: { fontSize: 9.5, color: c.dim, fontStyle: "italic", marginTop: 4 },
  });
}
