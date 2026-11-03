import React, { memo, useCallback } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { C, FONTS, SAFE_X } from "../theme";
import Poster, { POSTER_W, POSTER_H, POSTER_GAP } from "./Poster";

const TITLE_H = 34;
// Satır yüksekliği sabit: dikey liste getItemLayout ile ölçmeden kaydırabiliyor.
export const ROW_H = TITLE_H + POSTER_H + 20 + 14;
const ITEM_W = POSTER_W + POSTER_GAP;

// Bir öneri satırı. Yatay liste sanallaştırılmış: yalnızca ekrana yakın afişler çiziliyor.
function Row({ row, rowIndex, onFocusItem, onOpenItem, preferredId, upTag }) {
  const renderItem = useCallback(({ item, index }) => (
    <Poster
      movie={item}
      rowIndex={rowIndex}
      index={index}
      onFocusItem={onFocusItem}
      onOpenItem={onOpenItem}
      hasTVPreferredFocus={preferredId === item.id}
      nextFocusUp={upTag}
    />
  ), [rowIndex, onFocusItem, onOpenItem, preferredId, upTag]);

  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>{row.title}</Text>
      <FlatList
        horizontal
        data={row.items}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: ITEM_W, offset: SAFE_X + ITEM_W * i, index: i })}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

export default memo(Row);

const styles = StyleSheet.create({
  row: { height: ROW_H },
  title: { height: TITLE_H, fontFamily: FONTS.marqueeBold, fontSize: 24, color: C.text, paddingHorizontal: SAFE_X, paddingTop: 4 },
  list: { paddingHorizontal: SAFE_X },
});
