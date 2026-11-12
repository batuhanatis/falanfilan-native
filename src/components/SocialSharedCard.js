import { t as translateUI } from "../i18n/core";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FONTS, upperTR } from "../theme/fonts";
import { verdictFor } from "../utils/blendVerdict";
import { useAppTheme } from "../context/ThemeContext";
import { OBJ, Face, MonoLabel, Sprockets, bounded, firstName, shortDate } from "./social/feedKit";

// Sosyal akışta paylaşılan kartlar (Fuaye): her biri kendi sinema nesnesi.
//   diary_rating   → koçanı işaretli bilet (işaret sayısı = puan)
//   blend          → kadife zeminde yan yana iki koltuk
//   oyun sonuçları → skor panosu
//   profile        → küçük profil afişi
// Nesneler iki temada da kendi renklerinde kalır; emoji kullanılmaz.

// verdictFor() Blend ekranı için emojili cümle döndürüyor; akışta son simgeyi atıyoruz.
function plainVerdict(pct) {
  const words = String(verdictFor(pct) || "").trim().split(/\s+/);
  while (words.length > 1 && !/[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(words[words.length - 1])) words.pop();
  return words.join(" ");
}

export default function SocialSharedCard({ payload, navigation, currentUserId, compact = false }) {
  const { c } = useAppTheme();
  if (!payload) return null;

  if (payload.kind === "diary_rating") {
    const movie = payload.movie || null;
    const open = movie?.id ? () => navigation.navigate("Detail", { movie }) : undefined;
    return <RatingTicket c={c} movie={movie} rating={payload.rating} note={payload.note} watchedAt={payload.watchedAt} onPress={open} compact={compact} />;
  }

  if (payload.kind === "blend") {
    const me = payload.me || {};
    const friend = payload.friend || {};
    const percent = bounded(payload.matchPercent);
    // Blend'in iki tarafından biriysen karşı tarafla Blend açılır; değilsen paylaşanla kendi uyumuna bakarsın.
    const viewerIsMe = Number(me.id) === Number(currentUserId);
    const participant = viewerIsMe || Number(friend.id) === Number(currentUserId);
    const target = viewerIsMe ? friend : me;
    const canOpen = !!target?.id && Number(target.id) !== Number(currentUserId);
    const open = () => {
      if (!canOpen) return;
      navigation.navigate("Blend", { friendId: target.id, friendName: target.name, friendAvatar: target.avatarUrl });
    };
    return (
      <View style={{ gap: 10 }}>
        <TouchableOpacity onPress={open} activeOpacity={0.92} disabled={!canOpen} accessibilityRole="button">
          <View style={[sc.velvet, compact && { marginTop: 6 }]}>
            <View style={sc.spot} pointerEvents="none" />
            <View style={sc.blendTop}>
              <View style={[sc.rowBetween, { alignSelf: "stretch" }]}>
                <MonoLabel color={OBJ.billing}>{translateUI("BLEND · YAN YANA")}</MonoLabel>
                <MonoLabel color={OBJ.brass}>{translateUI("UYUM")}</MonoLabel>
              </View>
              <View style={sc.seatsRow}>
                <Seat person={me} />
                <View style={{ alignItems: "center", paddingBottom: 14 }}>
                  <Text style={sc.percent}>{translateUI("%{0}", { 0: percent })}</Text>
                </View>
                <Seat person={friend} />
              </View>
              <Text style={sc.blendNames} numberOfLines={1}>{firstName(me.name)}{" × "}{firstName(friend.name)}</Text>
              <Text style={sc.verdict}>{plainVerdict(percent)}</Text>
              <MonoLabel color={OBJ.billing} style={{ textAlign: "center" }}>
                {upperTR([
                  translateUI("{0} ORTAK FAVORİ", { 0: Number(payload.commonCount || 0) }),
                  payload.topGenre ? translateUI("EN ÇOK {0}", { 0: translateUI(payload.topGenre) }) : null,
                ].filter(Boolean).join(" · "))}
              </MonoLabel>
            </View>
            {!!payload.posters?.filter(Boolean).length && (
              <View style={sc.band}>
                <Sprockets />
                <View style={sc.bandRow}>
                  {payload.posters.filter(Boolean).slice(0, 4).map((uri, i) => <Image key={`${uri}-${i}`} source={{ uri }} style={sc.bandPoster} />)}
                </View>
                <Sprockets />
              </View>
            )}
          </View>
        </TouchableOpacity>
        {!compact && canOpen && (
          <TouchableOpacity style={[sc.ghost, { borderColor: OBJ.boardBorder }]} onPress={open} accessibilityRole="button">
            <Text style={[sc.ghostText, { color: c.text }]}>{participant ? translateUI("Blend'i aç") : translateUI("Sen de {0} ile uyumuna bak", { 0: firstName(target.name) })}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (payload.kind === "poster_puzzle") {
    const attempts = Math.max(1, Number(payload.attempts || 1));
    const tiles = puzzleTiles(payload);
    return (
      <GameBoard
        c={c}
        compact={compact}
        label={translateUI("AFİŞ BULMACASI")}
        side={translateUI("GÜNÜN OYUNU")}
        title={payload.correct ? translateUI("{0}. denemede bildi", { 0: attempts }) : translateUI("Bugün afiş kazandı")}
        sub={payload.correct ? translateUI("Afişin parçalarından filmi buldu.") : translateUI("Doğru cevabı bulamadı; sıra sende.")}
        tiles={tiles}
        cta={translateUI("Cevabı görmeden sen de oyna")}
        onPress={() => navigation.navigate("DailyPosterPuzzle")}
      />
    );
  }

  if (payload.kind === "who_said_it") {
    return (
      <GameBoard
        c={c}
        compact={compact}
        label={translateUI("KİM SÖYLEDİ?")}
        side={payload.isDaily ? translateUI("GÜNÜN OYUNU") : translateUI("PELLIX PLAY")}
        score={`${Number(payload.score || 0)}/${Number(payload.total || 0)}`}
        title={translateUI("{0} replikten {1} tanesini bildi", { 0: Number(payload.total || 0), 1: Number(payload.score || 0) })}
        cta={translateUI("Sen de oyna")}
        onPress={() => navigation.navigate("PellixPlay", { initialGame: "who_said_it" })}
      />
    );
  }

  if (payload.kind === "character_quiz") {
    const character = payload.character || {};
    return (
      <GameBoard
        c={c}
        compact={compact}
        label={translateUI("HANGİ KARAKTERSİN?")}
        side={translateUI("PELLIX PLAY")}
        score={translateUI("%{0}", { 0: bounded(payload.matchPercent) })}
        title={character.name || translateUI("Karakter")}
        sub={character.title || null}
        photo={character.actorPhoto || null}
        cta={translateUI("Sen de oyna")}
        onPress={() => navigation.navigate("PellixPlay", { initialGame: "character_quiz" })}
      />
    );
  }

  if (payload.kind === "friend_quiz") {
    const friend = payload.friend || {};
    const percent = bounded(payload.percent ?? (payload.total ? (payload.score / payload.total) * 100 : 0));
    const canOpen = !!friend?.id && Number(friend.id) !== Number(currentUserId);
    return (
      <GameBoard
        c={c}
        compact={compact}
        label={translateUI("ARKADAŞINI TANIYOR MUSUN?")}
        side={translateUI("PELLIX PLAY")}
        score={translateUI("%{0}", { 0: percent })}
        title={translateUI("{0} sorusunda {1} doğru", { 0: Number(payload.total || 0), 1: Number(payload.score || 0) })}
        sub={friend.name ? translateUI("{0} hakkında", { 0: firstName(friend.name) }) : null}
        cta={canOpen ? translateUI("{0} profilini aç", { 0: firstName(friend.name) }) : null}
        onPress={canOpen ? () => navigation.navigate("OtherProfile", { userId: friend.id }) : null}
      />
    );
  }

  // profile
  const openProfile = () => {
    if (Number(payload.userId) === Number(currentUserId)) navigation.navigate("MainTabs", { screen: "Profile" });
    else if (payload.userId) navigation.navigate("OtherProfile", { userId: payload.userId });
  };
  const genres = Array.isArray(payload.tasteDNA?.genres) ? payload.tasteDNA.genres.slice(0, 3).map((g) => g?.name).filter(Boolean) : [];
  return (
    <View style={{ gap: 10 }}>
      <TouchableOpacity onPress={openProfile} activeOpacity={0.92} accessibilityRole="button">
        <View style={[sc.velvet, sc.profile, compact && { marginTop: 6 }]}>
          <View style={sc.spotLeft} pointerEvents="none" />
          <Face uri={payload.avatarUrl} name={payload.name} size={76} ring={OBJ.brass} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={sc.billing} numberOfLines={1}>{translateUI("PELLIX SUNAR · BİR {0} PROFİLİ", { 0: upperTR(firstName(payload.name)) })}</Text>
            <Text style={sc.profileName} numberOfLines={1}>{upperTR(firstName(payload.name))}</Text>
            {!!genres.length && <MonoLabel color={OBJ.billing} numberOfLines={1}>{upperTR(genres.map((g) => translateUI(g)).join(" · "))}</MonoLabel>}
          </View>
        </View>
      </TouchableOpacity>
      {!compact && (
        <TouchableOpacity style={[sc.ghost, { borderColor: OBJ.boardBorder }]} onPress={openProfile} accessibilityRole="button">
          <Text style={[sc.ghostText, { color: c.text }]}>{translateUI("Profili aç")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Seat({ person }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={sc.seatBack}>
        <Face uri={person?.avatarUrl} name={person?.name} size={48} ring={OBJ.brass} />
      </View>
      <View style={sc.seatCushion} />
    </View>
  );
}

// "🟩⬛🟥" gibi kayıtlı deneme dizisini pano kutucuklarına çeviriyor (emoji gösterilmiyor).
function puzzleTiles(payload) {
  const chars = Array.from(String(payload.squares || ""));
  const tiles = chars.map((ch) => (ch === "🟩" ? "right" : ch === "🟥" || ch === "🟨" || ch === "🟧" ? "wrong" : "empty")).filter(Boolean);
  if (tiles.length) return tiles.slice(0, 6);
  const attempts = Math.max(1, Number(payload.attempts || 1));
  return Array.from({ length: Math.max(3, attempts) }, (_, i) => (payload.correct && i === attempts - 1 ? "right" : i < attempts ? "wrong" : "empty"));
}

function GameBoard({ c, compact, label, side, title, sub, score, tiles, photo, cta, onPress }) {
  return (
    <TouchableOpacity onPress={onPress || undefined} disabled={!onPress} activeOpacity={0.92} accessibilityRole={onPress ? "button" : undefined}>
      <View style={[sc.board, compact && { marginTop: 6 }]}>
        <View style={sc.rowBetween}>
          <MonoLabel color={OBJ.brass}>{label}</MonoLabel>
          <MonoLabel color={OBJ.boardDim}>{side}</MonoLabel>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {tiles ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {tiles.map((t, i) => (
                <View key={i} style={[sc.flap, t === "right" && { backgroundColor: OBJ.gold }]}>
                  {t !== "right" && <View style={sc.flapBottom} />}
                  {t !== "empty" && <Text style={[sc.flapText, { color: t === "right" ? OBJ.onAccent : OBJ.wrong }]}>{i + 1}</Text>}
                  <View style={[sc.flapSeam, t === "right" && { backgroundColor: "rgba(0,0,0,0.35)" }]} />
                </View>
              ))}
            </View>
          ) : photo ? (
            <Face uri={photo} name={title} size={56} ring={OBJ.brass} />
          ) : null}
          {!!score && (
            <View style={[sc.flap, sc.scoreFlap]}>
              <View style={sc.flapBottom} />
              <Text style={sc.scoreText}>{score}</Text>
              <View style={sc.flapSeamWide} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={sc.boardTitle} numberOfLines={2}>{title}</Text>
            {!!sub && <Text style={sc.boardSub} numberOfLines={2}>{sub}</Text>}
          </View>
        </View>
        {!compact && !!cta && !!onPress && (
          <View style={sc.goldBtn}>
            <Text style={sc.goldBtnText}>{cta}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function RatingTicket({ c, movie, rating, note, watchedAt, onPress, compact }) {
  const value = Math.max(0, Math.min(10, Number(rating) || 0));
  const poster = compact ? 60 : 72;
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.92} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={movie?.title ? translateUI("{0}, {1}/10", { 0: movie.title, 1: value }) : undefined}>
      <View style={[sc.ticket, { backgroundColor: c.surface, borderColor: c.border }, compact ? { marginTop: 6 } : { marginTop: 12 }]}>
        <View style={{ flex: 1, minWidth: 0, padding: compact ? 12 : 14, flexDirection: "row", gap: 12 }}>
          {movie?.poster
            ? <Image source={{ uri: movie.poster }} style={[sc.ticketPoster, { width: poster, height: poster * 1.5 }]} />
            : <View style={[sc.ticketPoster, { width: poster, height: poster * 1.5, backgroundColor: c.surface2 }]} />}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={[sc.ticketTitle, { color: c.text }, compact && { fontSize: 20, lineHeight: 21 }]} numberOfLines={2}>{movie?.title}</Text>
            <MonoLabel color={c.dim} numberOfLines={1}>
              {upperTR([movie?.type ? translateUI(movie.type) : null, movie?.year, watchedAt ? shortDate(watchedAt) : null].filter(Boolean).join(" · "))}
            </MonoLabel>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text style={[sc.ticketScore, compact && { fontSize: 30, lineHeight: 32 }]}>{value}</Text>
              <Text style={[sc.ticketOutOf, { color: c.dim }]}>{translateUI("/10")}</Text>
            </View>
            {!!note && !compact && <Text style={[sc.ticketNote, { color: c.text }]} numberOfLines={3}>“{note}”</Text>}
          </View>
        </View>
        <View style={[sc.ticketStub, { borderLeftColor: OBJ.boardBorder }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[sc.notch, { top: -9, backgroundColor: c.bg, borderColor: c.border }]} />
          <View style={[sc.notch, { bottom: -9, backgroundColor: c.bg, borderColor: c.border }]} />
          {Array.from({ length: 10 }, (_, i) => (
            <View key={i} style={[sc.mark, i < value ? { backgroundColor: OBJ.brass, borderColor: OBJ.brass } : { backgroundColor: "transparent", borderColor: OBJ.boardBorder }]} />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  ghost: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14, fontWeight: "700" },

  velvet: { marginTop: 12, borderRadius: 14, overflow: "hidden", backgroundColor: OBJ.velvetDeep, borderWidth: 1, borderColor: OBJ.velvetEdge },
  spot: { position: "absolute", left: "15%", right: "15%", top: -60, height: 140, borderRadius: 999, backgroundColor: "rgba(255,227,163,0.10)" },
  spotLeft: { position: "absolute", left: -30, top: -50, width: 200, height: 160, borderRadius: 999, backgroundColor: "rgba(255,227,163,0.09)" },
  blendTop: { padding: 16, paddingBottom: 14, alignItems: "center", gap: 10 },
  seatsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 18, marginTop: 4 },
  seatBack: { width: 70, height: 70, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: OBJ.velvet, alignItems: "center", justifyContent: "center" },
  seatCushion: { width: 80, height: 14, borderRadius: 4, backgroundColor: OBJ.velvetSeat, marginTop: -2 },
  percent: { color: OBJ.billing, fontFamily: FONTS.marquee, fontSize: 54, lineHeight: 54 },
  blendNames: { color: OBJ.ink, fontFamily: FONTS.marquee, fontSize: 24, lineHeight: 26 },
  verdict: { color: OBJ.billing, fontSize: 14, lineHeight: 20, textAlign: "center" },
  band: { backgroundColor: OBJ.band, paddingVertical: 6, gap: 6 },
  bandRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10 },
  bandPoster: { flex: 1, aspectRatio: 2 / 3, borderRadius: 3 },

  profile: { padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  billing: { color: OBJ.billing, fontFamily: FONTS.marqueeMedium, fontSize: 11.5, letterSpacing: 1.6 },
  profileName: { color: OBJ.billing, fontFamily: FONTS.marquee, fontSize: 40, lineHeight: 40 },

  board: { marginTop: 12, borderRadius: 18, backgroundColor: OBJ.board, borderWidth: 1, borderColor: OBJ.boardBorder, padding: 14, paddingBottom: 16, gap: 12 },
  flap: { width: 44, height: 54, borderRadius: 3, backgroundColor: OBJ.flapTop, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  flapBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 27, backgroundColor: OBJ.flapBottom },
  flapSeam: { position: "absolute", left: 0, right: 0, top: 26.5, height: 1, backgroundColor: OBJ.seam },
  flapSeamWide: { position: "absolute", left: 0, right: 0, top: 26.5, height: 1, backgroundColor: OBJ.seam },
  flapText: { fontFamily: FONTS.marquee, fontSize: 26 },
  scoreFlap: { width: 76 },
  scoreText: { color: OBJ.ink, fontFamily: FONTS.marquee, fontSize: 28 },
  boardTitle: { color: OBJ.ink, fontFamily: FONTS.marquee, fontSize: 24, lineHeight: 26 },
  boardSub: { color: OBJ.boardDim, fontSize: 12.5, lineHeight: 17 },
  goldBtn: { minHeight: 44, borderRadius: 999, backgroundColor: OBJ.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  goldBtnText: { color: OBJ.onAccent, fontSize: 14, fontWeight: "700" },

  ticket: { flexDirection: "row", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  ticketPoster: { borderRadius: 6, borderWidth: 1, borderColor: OBJ.boardBorder },
  ticketTitle: { fontFamily: FONTS.marquee, fontSize: 22, lineHeight: 23 },
  ticketScore: { color: OBJ.brass, fontFamily: FONTS.monoMedium, fontSize: 36, lineHeight: 38 },
  ticketOutOf: { fontFamily: FONTS.mono, fontSize: 13 },
  ticketNote: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  ticketStub: { width: 44, borderLeftWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12 },
  notch: { position: "absolute", left: -10, width: 18, height: 18, borderRadius: 999, borderWidth: 1 },
  mark: { width: 8, height: 8, borderRadius: 999, borderWidth: 1 },
});
