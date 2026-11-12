import { t as translateUI } from "../../i18n/core";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MessageCircle, MoreHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS, upperTR } from "../../theme/fonts";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { hapticLight } from "../../utils/haptics";
import { Face, MonoLabel } from "./feedKit";

// Paylaşımın üst satırı: kim, ne yaptı, ne zaman. Profilde (compact) kişi zaten belli olduğu için
// yalnızca "NE YAPTI · NE ZAMAN" satırı kalıyor.
export function PostHeader({ c, user, verb, time, compact, onProfile, onMenu, menuBusy }) {
  const meta = `${upperTR(verb)} · ${upperTR(time)}`;
  if (compact) {
    return (
      <View style={st.compactHead}>
        <MonoLabel color={c.dim} style={{ flex: 1 }} numberOfLines={1}>{meta}</MonoLabel>
        <MenuButton c={c} onPress={onMenu} busy={menuBusy} />
      </View>
    );
  }
  return (
    <View style={st.head}>
      <TouchableOpacity style={st.person} onPress={onProfile} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={user?.name || undefined}>
        <Face uri={user?.avatar_url} name={user?.name} size={36} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={st.nameRow}>
            <Text style={[st.name, { color: c.text }]} numberOfLines={1}>{user?.name}</Text>
            {!!user?.username && <Text style={[st.username, { color: c.dim }]} numberOfLines={1}>{translateUI("@")}{user.username}</Text>}
          </View>
          <MonoLabel color={c.dim} numberOfLines={1}>{meta}</MonoLabel>
        </View>
      </TouchableOpacity>
      <MenuButton c={c} onPress={onMenu} busy={menuBusy} />
    </View>
  );
}

function MenuButton({ c, onPress, busy }) {
  if (!onPress) return null;
  return (
    <TouchableOpacity style={st.menu} onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={translateUI("Paylaşım seçenekleri")}>
      {busy ? <ActivityIndicator size="small" color={c.dim} /> : <MoreHorizontal size={20} color={c.dim} />}
    </TouchableOpacity>
  );
}

// Alt satır: Alkışla (tek tepki) · Yorum · Gönder. Fikir paylaşımlarında oy da aynı tepki
// kaydını kullandığı için alkış gösterilmiyor (applause = null).
export function PostFooter({ c, applause, commentCount, onComments, share, compact }) {
  if (compact) {
    return (
      <View style={st.compactFoot}>
        {!!applause && (
          <Pressable onPress={applause.onPress} onLongPress={applause.onLongPress} delayLongPress={380} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: !!applause.mine }}>
            <MonoLabel color={applause.mine ? c.accent : c.dim}>{applause.total > 0 ? translateUI("{0} ALKIŞ", { 0: applause.total }) : translateUI("ALKIŞLA")}</MonoLabel>
          </Pressable>
        )}
        <Pressable onPress={onComments} hitSlop={8} accessibilityRole="button">
          <MonoLabel color={c.dim}>{commentCount > 0 ? translateUI("{0} YORUM", { 0: commentCount }) : translateUI("YORUM YAZ")}</MonoLabel>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={st.foot}>
      {!!applause && (
        <Pressable
          onPress={() => { hapticLight(); applause.onPress(); }}
          onLongPress={applause.onLongPress}
          delayLongPress={380}
          style={({ pressed }) => [
            st.clap,
            { borderColor: applause.mine ? c.accent : c.border, backgroundColor: applause.mine ? c.accent : "transparent" },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: !!applause.mine }}
          accessibilityHint={translateUI("Basılı tutunca alkışlayanları gösterir")}
        >
          <Text style={[st.clapText, { color: applause.mine ? "#1a140b" : c.text }]}>{applause.mine ? translateUI("Alkışladın") : translateUI("Alkışla")}</Text>
          {applause.total > 0 && <Text style={[st.clapCount, { color: applause.mine ? "#1a140b" : c.dim }]}>{applause.total}</Text>}
        </Pressable>
      )}
      <TouchableOpacity style={[st.comment, !applause && { marginLeft: -12 }]} onPress={onComments} accessibilityRole="button" accessibilityLabel={translateUI("Yorumlar, {0}", { 0: commentCount || 0 })}>
        <MessageCircle size={18} color={c.dim} />
        {commentCount > 0 && <Text style={[st.count, { color: c.dim }]}>{commentCount}</Text>}
      </TouchableOpacity>
      {share ? <View style={{ marginLeft: "auto" }}>{share}</View> : null}
    </View>
  );
}

// En son yorum tek satır: "Ad yorum · N yorum".
export function CommentLine({ c, comment, count, onPress }) {
  if (!comment) return null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={st.commentLine}>
      <Text style={[st.commentText, { color: c.text }]} numberOfLines={2}>
        <Text style={{ fontWeight: "600" }}>{comment.name} </Text>
        {comment.body}
        {count > 1 ? <Text style={{ color: c.dim }}>{translateUI(" · {0} yorum", { 0: count })}</Text> : null}
      </Text>
    </TouchableOpacity>
  );
}

// "Alkışla"ya basılı tutunca: paylaşımı kimlerin alkışladığı.
export function ApplauseSheet({ c, visible, kind, targetId, onClose, onOpenProfile }) {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState({ loading: true, users: [], failed: false });

  useEffect(() => {
    if (!visible || !targetId) return undefined;
    let active = true;
    setState({ loading: true, users: [], failed: false });
    api.socialReactors(auth.token, kind, targetId)
      .then((data) => { if (active) setState({ loading: false, users: (data?.users || []).filter((u) => u.reaction === "fire"), failed: false }); })
      .catch(() => { if (active) setState({ loading: false, users: [], failed: true }); });
    return () => { active = false; };
  }, [visible, kind, targetId, auth.token]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={translateUI("Kapat")} />
      <View style={[st.sheet, { backgroundColor: c.surface, borderColor: c.border, paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <View style={[st.grabber, { backgroundColor: c.border }]} />
        <Text style={[st.sheetTitle, { color: c.text }]}>{translateUI("Alkışlayanlar")}</Text>
        {state.loading ? (
          <ActivityIndicator color={c.accent} style={{ marginVertical: 28 }} />
        ) : state.failed ? (
          <Text style={[st.sheetEmpty, { color: c.dim }]}>{translateUI("Liste şu an açılamadı. Biraz sonra tekrar dene.")}</Text>
        ) : state.users.length === 0 ? (
          <Text style={[st.sheetEmpty, { color: c.dim }]}>{translateUI("Henüz kimse alkışlamadı.")}</Text>
        ) : (
          <FlatList
            data={state.users}
            keyExtractor={(u) => String(u.id)}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={st.userRow} onPress={() => { onClose(); onOpenProfile?.(item.id); }} accessibilityRole="button">
                <Face uri={item.avatar_url} name={item.name} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[st.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
                  {!!item.username && <Text style={[st.username, { color: c.dim }]} numberOfLines={1}>{translateUI("@")}{item.username}</Text>}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginRight: -10 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 6, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  username: { fontSize: 13, flexShrink: 1 },
  menu: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  compactHead: { flexDirection: "row", alignItems: "center", marginRight: -10, minHeight: 36 },
  foot: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, marginRight: -10 },
  clap: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  clapText: { fontSize: 13.5, fontWeight: "700" },
  clapCount: { fontFamily: FONTS.monoMedium, fontSize: 12 },
  comment: { minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  count: { fontFamily: FONTS.mono, fontSize: 12 },
  compactFoot: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10, minHeight: 24 },
  commentLine: { marginTop: 4 },
  commentText: { fontSize: 13, lineHeight: 18 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 999, marginBottom: 10 },
  sheetTitle: { fontFamily: FONTS.marquee, fontSize: 24, lineHeight: 28, marginBottom: 6 },
  sheetEmpty: { fontSize: 14, lineHeight: 20, marginVertical: 18 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
});
