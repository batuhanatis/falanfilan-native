import { t as translateUI } from "../../i18n/core";
import React from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ListVideo, MapPin } from "lucide-react-native";
import { FONTS, upperTR } from "../../theme/fonts";
import { platformName } from "../../utils/platform";
import { hapticSelection } from "../../utils/haptics";
import { OBJ, Face, MonoLabel, clockTime, shortDate } from "./feedKit";

function metaLine(m, extra = []) {
  return upperTR([m?.type ? translateUI(m.type) : null, m?.genre ? translateUI(m.genre) : null, m?.runtime, m?.year, ...extra].filter(Boolean).join(" · "));
}

// ---- Günün sorusu cevabı: klaket ----
export function DailyQuestionSlate({ c, question, answer, createdAt, compact, onAnswer }) {
  const day = new Date(createdAt || Date.now()).getDate();
  return (
    <View style={{ gap: 10 }}>
      <View style={[ob.slate, compact && { marginTop: 6 }]}>
        <View style={ob.slateStripes} pointerEvents="none">
          {Array.from({ length: 22 }, (_, i) => <View key={i} style={[ob.slateStripe, i % 2 ? ob.slateStripeDark : null]} />)}
        </View>
        <View style={[ob.slateBody, compact && { padding: 12, gap: 8 }]}>
          <View style={ob.rowBetween}>
            <MonoLabel color={OBJ.slateMeta}>{translateUI("GÜNÜN SORUSU")}</MonoLabel>
            <MonoLabel color={OBJ.slateMeta}>{translateUI("SAHNE {0}", { 0: day })}{" · "}{shortDate(createdAt)}</MonoLabel>
          </View>
          <Text style={[ob.slateQuestion, compact && { fontSize: 21, lineHeight: 24 }]}>{question}</Text>
          {!!answer && (
            <>
              <View style={ob.slateRule} />
              <MonoLabel color={OBJ.brass}>{translateUI("CEVAP")}</MonoLabel>
              <Text style={[ob.slateAnswer, compact && { fontSize: 14, lineHeight: 20 }]}>{answer}</Text>
            </>
          )}
        </View>
      </View>
      {!!onAnswer && (
        <TouchableOpacity style={[ob.ghost, { borderColor: OBJ.boardBorder, alignSelf: "flex-start" }]} onPress={onAnswer} accessibilityRole="button">
          <Text style={[ob.ghostText, { color: c.text }]}>{translateUI("Sen de cevapla")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---- Fikir: düz yazı + "Katılıyor musun?" (oy, tepki kaydının agree/nope değeri) ----
export function OpinionVote({ c, myReaction, counts, onVote }) {
  const agree = Number(counts?.agree || 0);
  const nope = Number(counts?.nope || 0);
  const total = agree + nope;
  const voted = myReaction === "agree" || myReaction === "nope";
  const pct = total ? Math.round((agree / total) * 100) : 0;
  const pill = (id, label, count) => {
    const on = myReaction === id;
    return (
      <TouchableOpacity
        key={id}
        style={[ob.votePill, { borderColor: on ? c.accent : OBJ.boardBorder, backgroundColor: on ? c.accent : "transparent" }]}
        onPress={() => { hapticSelection(); onVote(id); }}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
      >
        <Text style={[ob.votePillText, { color: on ? OBJ.onAccent : c.text }]}>{label}</Text>
        {voted && <Text style={[ob.votePillCount, { color: on ? OBJ.onAccent : c.dim }]}>{count}</Text>}
      </TouchableOpacity>
    );
  };
  return (
    <View style={{ gap: 8, marginTop: 14 }}>
      <MonoLabel color={c.dim}>{translateUI("KATILIYOR MUSUN?")}</MonoLabel>
      {voted && total > 0 && (
        <View style={[ob.ratioTrack, { backgroundColor: c.surface2 }]}>
          <View style={[ob.ratioFill, { width: `${pct}%`, backgroundColor: c.accent }]} />
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {pill("agree", translateUI("Katılıyorum"), agree)}
        {pill("nope", translateUI("Katılmıyorum"), nope)}
      </View>
      {voted && total > 0 && <MonoLabel color={c.dim}>{translateUI("%{0} KATILIYOR · {1} KİŞİ", { 0: pct, 1: total })}</MonoLabel>}
    </View>
  );
}

// ---- Öneri: afiş + künye + (varsa) önerenin not kâğıdı ----
export function RecommendObject({ c, movie, note, authorName, compact, onOpen, onAddToList }) {
  if (!movie) return null;
  const platform = platformName(movie.platforms?.[0]);
  const w = compact ? 90 : 120;
  return (
    <View style={{ gap: 14, marginTop: compact ? 6 : 12 }}>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <TouchableOpacity onPress={onOpen} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={translateUI("{0}, detayları gör", { 0: movie.title })}>
          {movie.poster
            ? <Image source={{ uri: movie.poster }} style={[ob.recPoster, { width: w, height: w * 1.5 }]} />
            : <View style={[ob.recPoster, { width: w, height: w * 1.5, backgroundColor: c.surface2 }]} />}
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <MonoLabel color={OBJ.brass}>{translateUI("ÖNERİ")}</MonoLabel>
          <Text style={[ob.recTitle, { color: c.text }, compact && { fontSize: 24, lineHeight: 25 }]} numberOfLines={3}>{movie.title}</Text>
          <Text style={[ob.meta, { color: c.dim }]} numberOfLines={2}>{metaLine(movie)}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {Number(movie.imdb) > 0 && <View style={[ob.pill, { backgroundColor: c.surface2 }]}><Text style={[ob.pillMono, { color: c.text }]}>{translateUI("IMDB {0}", { 0: Number(movie.imdb).toFixed(1) })}</Text></View>}
            {!!platform && <View style={[ob.pill, { backgroundColor: c.surface2 }]}><Text style={[ob.pillText, { color: c.text }]} numberOfLines={1}>{platform}</Text></View>}
          </View>
          {!compact && !!onAddToList && (
            <TouchableOpacity style={[ob.ghost, { borderColor: OBJ.boardBorder, alignSelf: "flex-start", marginTop: "auto" }]} onPress={onAddToList} accessibilityRole="button">
              <Text style={[ob.ghostText, { color: c.text }]}>{translateUI("Listeye ekle")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {!!note && (
        <View style={ob.noteSlip}>
          <View style={ob.notePerf} pointerEvents="none">
            {Array.from({ length: 26 }, (_, i) => <View key={i} style={[ob.notePerfHole, { backgroundColor: c.bg }]} />)}
          </View>
          <Text style={ob.noteText}>“{note}”</Text>
          {!!authorName && <Text style={ob.noteSign}>{upperTR(authorName)}</Text>}
        </View>
      )}
    </View>
  );
}

// ---- Anket: iki salon kapısı; oy verince doluluk ----
export function PollSalons({ c, question, movies, counts, voters, myVote, onVote, onOpen }) {
  const total = movies.reduce((sum, m) => sum + Number(counts?.[m.id] || 0), 0);
  const voted = !!myVote;
  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      <View style={{ gap: 4 }}>
        <MonoLabel color={OBJ.brass}>{translateUI("HANGİ SALON?")}</MonoLabel>
        {!!question && <Text style={[ob.pollQuestion, { color: c.text }]}>{question}</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        {movies.map((movie, index) => {
          const count = Number(counts?.[movie.id] || 0);
          const pct = total ? Math.round((count / total) * 100) : 0;
          const mine = Number(myVote) === Number(movie.id);
          const people = voters?.[movie.id] || [];
          return (
            <View key={movie.id} style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <MonoLabel color={OBJ.boardDim}>{translateUI("SALON {0}", { 0: index + 1 })}</MonoLabel>
              <TouchableOpacity onPress={() => onOpen(movie)} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={translateUI("{0}, detayları gör", { 0: movie.title })}>
                {movie.poster
                  ? <Image source={{ uri: movie.poster }} style={[ob.pollPoster, mine && { borderColor: c.accent }]} />
                  : <View style={[ob.pollPoster, { backgroundColor: c.surface2 }]} />}
                {mine && <Text style={ob.stamp}>{translateUI("SENİN BİLETİN")}</Text>}
              </TouchableOpacity>
              <Text style={[ob.pollTitle, { color: c.text }]} numberOfLines={2}>{movie.title}</Text>
              {voted ? (
                <>
                  <View style={[ob.ratioTrack, { backgroundColor: c.surface2 }]}>
                    <View style={[ob.ratioFill, { width: `${pct}%`, backgroundColor: mine ? c.accent : OBJ.boardDim }]} />
                  </View>
                  <MonoLabel color={c.dim}>{translateUI("SALON %{0} DOLU · {1} OY", { 0: pct, 1: count })}</MonoLabel>
                  {people.length > 0 && (
                    <View style={{ flexDirection: "row" }}>
                      {people.slice(0, 4).map((v, i) => <Face key={v.id} uri={v.avatarUrl} name={v.name} size={20} style={i > 0 ? { marginLeft: -6, borderWidth: 1.5, borderColor: c.bg } : { borderWidth: 1.5, borderColor: c.bg }} />)}
                      {people.length > 4 && <Text style={[ob.meta, { color: c.dim, marginLeft: 6 }]}>{translateUI("+{0}", { 0: people.length - 4 })}</Text>}
                    </View>
                  )}
                </>
              ) : (
                <Text style={[ob.meta, { color: c.dim }]} numberOfLines={1}>{metaLine(movie)}</Text>
              )}
              <TouchableOpacity
                style={[ob.ghost, { borderColor: mine ? c.accent : OBJ.boardBorder, backgroundColor: mine ? c.accent : "transparent" }]}
                onPress={() => { hapticSelection(); onVote(movie.id); }}
                accessibilityRole="button"
                accessibilityState={{ selected: mine }}
              >
                <Text style={[ob.ghostText, { color: mine ? OBJ.onAccent : c.text }]}>{mine ? translateUI("Seçtin") : translateUI("Bunu seç")}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---- Sinemadayım: gişe bileti ----
export function CheckinTicket({ c, checkin, movie, createdAt, onOpenMovie }) {
  return (
    <View style={{ marginTop: 12, gap: 10 }}>
      {!!checkin.photoUrl && <Image source={{ uri: checkin.photoUrl }} style={[ob.checkinPhoto, { backgroundColor: c.surface2 }]} resizeMode="cover" />}
      <View style={[ob.ticket, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={{ flex: 1, minWidth: 0, padding: 14, gap: 6 }}>
          <MonoLabel color={OBJ.brass}>{translateUI("GİŞE")}</MonoLabel>
          <Text style={[ob.ticketCinema, { color: c.text }]} numberOfLines={2}>{checkin.name}</Text>
          {!!checkin.place && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MapPin size={12} color={c.dim} />
              <Text style={{ color: c.dim, fontSize: 12.5, flex: 1 }} numberOfLines={1}>{checkin.place}</Text>
            </View>
          )}
          <MonoLabel color={c.dim} style={{ marginTop: 4 }}>{translateUI("GİRİŞ {0} · {1}", { 0: clockTime(createdAt), 1: shortDate(createdAt) })}</MonoLabel>
        </View>
        {!!movie && (
          <TouchableOpacity style={[ob.stub, { borderLeftColor: OBJ.boardBorder }]} onPress={() => onOpenMovie(movie)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={translateUI("{0}, detayları gör", { 0: movie.title })}>
            <View style={[ob.notch, ob.notchTop, { backgroundColor: c.bg, borderColor: c.border }]} />
            <View style={[ob.notch, ob.notchBottom, { backgroundColor: c.bg, borderColor: c.border }]} />
            {movie.poster ? <Image source={{ uri: movie.poster }} style={ob.stubPoster} /> : <View style={[ob.stubPoster, { backgroundColor: c.surface2 }]} />}
            <Text style={[ob.stubTitle, { color: c.text }]} numberOfLines={2}>{movie.title}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---- Beğendi / favori / liste: kutusuz satır ----
const ACTIVITY_TONE = { like: OBJ.gold, favorite_set: OBJ.wrong, list_created: OBJ.list };
export function activityLabel(item) {
  if (item.activityType === "like") return translateUI("BEĞENDİ");
  if (item.activityType === "favorite_set") return translateUI("FAVORİSİ");
  if (item.activityType === "list_created") return translateUI("YENİ LİSTE");
  return translateUI("GÜNCELLEDİ");
}
export function activitySentence(item) {
  if (item.activityType === "list_created") return translateUI("“{0}” listesini açtı", { 0: item.payload?.list_name || translateUI("Yeni liste") });
  if (item.activityType === "favorite_set") return item.payload?.liked === false ? translateUI("favorisini güncelledi") : translateUI("favorisi yaptı");
  const count = item.activityCount || item.movies?.length || 1;
  return count > 1 ? translateUI("{0} içerik beğendi", { 0: count }) : translateUI("beğendi");
}

export function ActivityLine({ c, item, time, onOpenProfile, onOpen }) {
  const movie = item.movies?.[0] || null;
  return (
    <TouchableOpacity style={ob.activityRow} onPress={onOpen} activeOpacity={0.75} accessibilityRole="button">
      <TouchableOpacity onPress={onOpenProfile} hitSlop={6} accessibilityRole="button" accessibilityLabel={item.user?.name || undefined}>
        <Face uri={item.user?.avatar_url} name={item.user?.name} size={32} />
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 14, lineHeight: 19 }} numberOfLines={2}>
          <Text style={{ fontWeight: "600" }}>{item.user?.name}</Text>
          {" "}{activitySentence(item)}
          {!!movie && item.activityType !== "list_created" && (item.activityCount || 1) <= 1 ? <Text>{" · "}<Text style={{ fontWeight: "600" }}>{movie.title}</Text></Text> : null}
        </Text>
        <MonoLabel color={ACTIVITY_TONE[item.activityType] || OBJ.boardDim}>
          {activityLabel(item)}<Text style={{ color: c.dim }}>{" · "}{upperTR(time)}</Text>
        </MonoLabel>
      </View>
      {movie?.poster ? (
        <Image source={{ uri: movie.poster }} style={ob.activityThumb} />
      ) : (
        <View style={[ob.activityThumb, { backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }]}>
          <ListVideo size={14} color={c.dim} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---- Düşünce paylaşımına eklenmiş içerik ----
export function MovieChip({ c, movie, onOpen }) {
  if (!movie) return null;
  return (
    <TouchableOpacity style={[ob.chip, { backgroundColor: c.surface, borderColor: c.border }]} onPress={onOpen} activeOpacity={0.85} accessibilityRole="button">
      {movie.poster ? <Image source={{ uri: movie.poster }} style={ob.chipPoster} /> : <View style={[ob.chipPoster, { backgroundColor: c.surface2 }]} />}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[ob.chipTitle, { color: c.text }]} numberOfLines={2}>{movie.title}</Text>
        <Text style={[ob.meta, { color: c.dim }]} numberOfLines={1}>{metaLine(movie)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ---- "Sen kaç verirsin?": 1-10 arası seçim; seçilen sayıya kadar dolar ----
export function RatePicker({ c, value, onChange, disabled, loading, watched, onWatched, saving }) {
  return (
    <View style={{ marginTop: 14, gap: 8 }}>
      <View style={ob.rowBetween}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{value ? translateUI("Sen {0} verdin", { 0: value }) : translateUI("Sen kaç verirsin?")}</Text>
          <MonoLabel color={c.dim}>{translateUI("PUANIN GÜNLÜĞÜNE DE YAZILIR")}</MonoLabel>
        </View>
        <TouchableOpacity
          style={[ob.ghost, { borderColor: watched ? c.accent : OBJ.boardBorder, minHeight: 40 }]}
          onPress={onWatched}
          disabled={disabled || watched}
          accessibilityRole="button"
          accessibilityState={{ selected: !!watched }}
        >
          {saving && !watched ? <ActivityIndicator size="small" color={c.accent} /> : (
            <Text style={[ob.ghostText, { color: watched ? c.accent : c.text, fontSize: 13 }]}>{watched ? translateUI("İzledin") : translateUI("Ben de izledim")}</Text>
          )}
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={c.dim} style={{ height: 32 }} />
      ) : (
        <View style={{ flexDirection: "row", gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel={translateUI("Puanın, 1 ile 10 arası")}>
          {Array.from({ length: 10 }, (_, i) => {
            const n = i + 1;
            const on = !!value && n <= value;
            return (
              <Pressable
                key={n}
                onPress={() => { hapticSelection(); onChange(n); }}
                disabled={disabled}
                hitSlop={{ top: 6, bottom: 6 }}
                style={[ob.rateDot, { borderColor: on ? c.accent : OBJ.boardBorder, backgroundColor: on ? c.accent : c.surface }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: n === value }}
                accessibilityLabel={translateUI("{0} puan", { 0: n })}
              >
                <Text style={[ob.rateDotText, { color: on ? OBJ.onAccent : c.dim }]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ob = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  meta: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.3 },
  ghost: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14, fontWeight: "700" },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillMono: { fontFamily: FONTS.mono, fontSize: 11 },
  pillText: { fontSize: 12 },

  slate: { marginTop: 12, borderRadius: 14, overflow: "hidden", backgroundColor: OBJ.slate, borderWidth: 1, borderColor: OBJ.slateLine },
  slateStripes: { height: 16, flexDirection: "row", overflow: "hidden", borderBottomWidth: 1, borderBottomColor: OBJ.slateLine },
  slateStripe: { width: 22, height: 30, marginTop: -7, backgroundColor: OBJ.paper, transform: [{ skewX: "-40deg" }] },
  slateStripeDark: { backgroundColor: OBJ.slate },
  slateBody: { padding: 16, paddingTop: 14, gap: 10 },
  slateQuestion: { color: OBJ.ink, fontFamily: FONTS.marqueeBold, fontSize: 25, lineHeight: 28 },
  slateRule: { height: 1, backgroundColor: OBJ.slateLine },
  slateAnswer: { color: OBJ.ink, fontSize: 15, lineHeight: 22 },

  votePill: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  votePillText: { fontSize: 14, fontWeight: "700" },
  votePillCount: { fontFamily: FONTS.monoMedium, fontSize: 12 },
  ratioTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  ratioFill: { height: 8, borderRadius: 999 },

  recPoster: { borderRadius: 6, borderWidth: 1, borderColor: "rgba(212,169,74,0.45)" },
  recTitle: { fontFamily: FONTS.marquee, fontSize: 30, lineHeight: 30 },
  noteSlip: { backgroundColor: OBJ.paper, borderRadius: 4, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, transform: [{ rotate: "-0.6deg" }] },
  notePerf: { position: "absolute", left: 4, right: 4, top: -4, height: 8, flexDirection: "row", justifyContent: "space-between", overflow: "hidden" },
  notePerfHole: { width: 7, height: 7, borderRadius: 999 },
  noteText: { fontFamily: FONTS.mono, fontSize: 13, lineHeight: 19, color: OBJ.paperInk },
  noteSign: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1, color: OBJ.paperInk, textAlign: "right", marginTop: 6 },

  pollQuestion: { fontFamily: FONTS.marquee, fontSize: 26, lineHeight: 28 },
  pollPoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 6, borderWidth: 1, borderColor: OBJ.boardBorder },
  pollTitle: { fontFamily: FONTS.marquee, fontSize: 21, lineHeight: 22 },
  stamp: {
    position: "absolute", left: 10, bottom: 12, transform: [{ rotate: "-6deg" }],
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 2, borderColor: OBJ.brass, borderRadius: 4,
    backgroundColor: "rgba(13,11,10,0.78)", color: OBJ.brass, fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1, overflow: "hidden",
  },

  checkinPhoto: { width: "100%", aspectRatio: 4 / 5, borderRadius: 14 },
  ticket: { flexDirection: "row", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  ticketCinema: { fontFamily: FONTS.marquee, fontSize: 26, lineHeight: 27 },
  stub: { width: 104, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center", gap: 6, borderLeftWidth: 2, borderStyle: "dashed" },
  notch: { position: "absolute", left: -10, width: 18, height: 18, borderRadius: 999, borderWidth: 1 },
  notchTop: { top: -9 },
  notchBottom: { bottom: -9 },
  stubPoster: { width: 58, height: 87, borderRadius: 4 },
  stubTitle: { fontSize: 11.5, lineHeight: 14, fontWeight: "600", textAlign: "center" },

  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 4 },
  activityThumb: { width: 36, height: 54, borderRadius: 3 },

  chip: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, borderWidth: 1 },
  chipPoster: { width: 40, height: 60, borderRadius: 4 },
  chipTitle: { fontFamily: FONTS.marquee, fontSize: 19, lineHeight: 20 },

  rateDot: { flex: 1, height: 32, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rateDotText: { fontFamily: FONTS.mono, fontSize: 11 },
});
