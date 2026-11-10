import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SeansWidget, BlendWidget } from "./AndroidWidgets";

// Android widget'larının arka plan görevi (index.js'te kaydediliyor). Veriyi uygulama
// src/widgets/homeWidgets.js ile AsyncStorage'a yazıyor; burada okunup çiziliyor.
const KEYS = {
  seans: "pellix:widget:seans",
  index: "pellix:widget:seansIndex",
  blend: "pellix:widget:blend",
  labels: "pellix:widget:labels",
};

function parse(text) {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

async function readState() {
  const pairs = await AsyncStorage.multiGet([KEYS.seans, KEYS.index, KEYS.blend, KEYS.labels]).catch(() => []);
  const map = Object.fromEntries(pairs || []);
  return {
    seans: parse(map[KEYS.seans]),
    index: Number(map[KEYS.index]) || 0,
    blend: parse(map[KEYS.blend]),
    labels: parse(map[KEYS.labels]),
  };
}

export async function renderAndroidWidget(widgetName, widgetInfo) {
  const state = await readState();
  const size = { width: widgetInfo?.width, height: widgetInfo?.height };
  if (widgetName === "Blend") return <BlendWidget data={state.blend} labels={state.labels} {...size} />;
  return <SeansWidget data={state.seans} index={state.index} labels={state.labels} {...size} />;
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }) {
  if (widgetAction === "WIDGET_DELETED") return;
  if (widgetAction === "WIDGET_CLICK" && clickAction === "NEXT") {
    const { seans, index } = await readState();
    const count = seans?.items?.length || 0;
    if (count > 0) {
      const current = Math.min(Math.max(index, 0), count);
      await AsyncStorage.setItem(KEYS.index, String((current + 1) % (count + 1))).catch(() => {});
    }
  }
  renderWidget(await renderAndroidWidget(widgetInfo.widgetName, widgetInfo));
}
