import React from "react";
import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";

// Android ana ekran widget'ları (Bu akşamın seansı + Blend). iOS'taki SwiftUI sürümüyle aynı
// tasarım: seans panosu (harf kutucukları) ve kadife koltuklu Blend. Boyut widget'ın
// gerçek genişliğine göre seçiliyor (küçük / orta / büyük).

export const C = {
  boardBg: "#0d0b0a",
  boardBorder: "#3a332b",
  flapTop: "#2e2924",
  flapBottom: "#26221d",
  ink: "#f2ede2",
  reasonInk: "#e6dfd1",
  dim: "#a39684",
  brass: "#d4a94a",
  onBrass: "#1a140b",
  rowLine: "#241f1a",
  velvetDeep: "#3f1214",
  velvetBorder: "#5a1d20",
  velvet: "#7a2428",
  velvetSeat: "#651d21",
  seatArm: "#3a2a22",
  glow: "#ffe3a3",
  billing: "#e9d8b9",
};

const F = {
  marquee: "BigShoulders_800ExtraBold",
  marqueeBold: "BigShoulders_700Bold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
};

const DEFAULT_LABELS = {
  tonight: "BU AKŞAM SENİN İÇİN",
  tonightShort: "BU AKŞAM",
  upcoming: "SIRADAKİ SEANSLAR",
  next: "Sıradaki",
  restart: "Baştan",
  discover: "Keşfet'e git",
  emptyBoard: "5 AFİŞ BEĞEN",
  emptyMeta: "PANO HENÜZ BOŞ",
  emptyText: "Panon beğendiklerinle kurulur. Keşfet'te 5 afiş beğen, ilk seansın gelsin.",
  doneBoard: "YARIN YENİ PANO",
  doneMeta: "BUGÜNÜN PANOSU TAMAM",
  doneText: "{0} seçimin hepsine baktın. Yeni pano yarın hazır.",
  ofCount: "{0} SEÇİMDEN {1}.",
  seans: "SEANS",
  blend: "BLEND",
  blendScore: "BEĞENİ UYUMU",
  together: "BİRLİKTE İZLEYİN",
  togetherNote: "İkinizin beğendiklerinden; henüz izlemediğiniz.",
  blendEmpty: "Bir arkadaşınla Blend'e bak; uyumunuz burada dursun.",
  lang: "tr",
};

export function label(labels, key, ...args) {
  let text = (labels && labels[key]) || DEFAULT_LABELS[key] || key;
  args.forEach((arg, i) => { text = text.split(`{${i}}`).join(String(arg)); });
  return text;
}

function upper(labels, text) {
  const value = String(text || "");
  if (label(labels, "lang") === "en") return value.toUpperCase();
  return value.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

const filmUri = (id) => `pellix://film/${id}`;
const DISCOVER_URI = "pellix://kesfet";
const BLENDS_URI = "pellix://widget/blendler";
const blendUri = (data) => `pellix://widget/blend/${data.friendId}?ad=${encodeURIComponent(data.friend || "")}`;

// Uygulamadaki SeansBoard ile aynı satır kırma.
export function flapLines(text, cols, rows) {
  let lines = [""];
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    const current = lines[lines.length - 1];
    const joined = current ? `${current} ${word}` : word;
    if (joined.length <= cols) lines[lines.length - 1] = joined;
    else if (word.length <= cols) lines.push(word);
    else {
      let rest = joined;
      lines[lines.length - 1] = rest.slice(0, cols);
      rest = rest.slice(cols);
      while (rest.length) { lines.push(rest.slice(0, cols)); rest = rest.slice(cols); }
    }
  }
  if (lines.length > rows) {
    lines = lines.slice(0, rows);
    let last = lines[rows - 1];
    if (last.length >= cols) last = last.slice(0, cols - 1);
    lines[rows - 1] = `${last}…`;
  }
  while (lines.length < rows) lines.push("");
  return lines.map((line) => Array.from(line.padEnd(cols, " ").slice(0, cols)));
}

function Flaps({ text, cols, rows, width, cellH, fontSize }) {
  const cellW = Math.max(8, Math.min(16, Math.floor((width - (cols - 1) * 2) / cols)));
  return (
    <FlexWidget style={{ flexDirection: "column", flexGap: 2 }}>
      {flapLines(text, cols, rows).map((line, r) => (
        <FlexWidget key={`r${r}`} style={{ flexDirection: "row", flexGap: 2 }}>
          {line.map((ch, c) => (
            <FlexWidget
              key={`c${c}`}
              style={{
                width: cellW, height: cellH, borderRadius: 3, justifyContent: "center", alignItems: "center",
                backgroundGradient: { from: C.flapTop, to: C.flapBottom, orientation: "TOP_BOTTOM" },
              }}
            >
              <TextWidget text={ch} allowFontScaling={false} style={{ fontSize: Math.min(fontSize, cellW * 0.82), fontFamily: F.marquee, color: C.ink }} />
            </FlexWidget>
          ))}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

function Mono({ text, size = 9, color = C.dim, medium = false, tracking = 0 }) {
  return (
    <TextWidget
      text={text}
      maxLines={1}
      truncate="END"
      allowFontScaling={false}
      style={{ fontSize: size, fontFamily: medium ? F.monoMedium : F.mono, color, letterSpacing: tracking }}
    />
  );
}

function Header({ left, right }) {
  return (
    <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between", alignItems: "center" }}>
      <Mono text={left} color={C.brass} medium tracking={0.1} />
      {right ? <Mono text={right} medium tracking={0.1} /> : null}
    </FlexWidget>
  );
}

function Pill({ text, action, gold = false }) {
  return (
    <FlexWidget
      {...(action ? { clickAction: action } : {})}
      style={{
        height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: "center", alignItems: "center",
        borderWidth: 1, borderColor: gold ? C.brass : C.boardBorder, backgroundColor: gold ? C.brass : C.boardBg,
      }}
    >
      <TextWidget text={text} allowFontScaling={false} style={{ fontSize: 11.5, fontWeight: "700", color: gold ? C.onBrass : C.ink }} />
    </FlexWidget>
  );
}

function Poster({ uri, width, height, border = C.boardBorder }) {
  if (!uri) {
    return (
      <FlexWidget style={{ width, height, borderRadius: 8, borderWidth: 1, borderColor: border, backgroundColor: C.flapBottom }} />
    );
  }
  return <ImageWidget image={uri} imageWidth={width} imageHeight={height} radius={8} resizeMode="cover" />;
}

function Body({ text, size = 11.5, lines = 2, color = C.reasonInk }) {
  return <TextWidget text={text} maxLines={lines} truncate="END" style={{ fontSize: size, color }} />;
}

function shortMeta(meta) {
  return String(meta || "").split(" · ").slice(0, 2).join(" · ");
}

function pad2(n) { return String(n).padStart(2, "0"); }

// ---------- Bu akşamın seansı ----------

export function SeansWidget({ data, index, labels, width = 320, height = 160 }) {
  const items = data?.items || [];
  const small = width < 230;
  const large = !small && height >= 250;
  const pad = 14;
  const inner = width - pad * 2;
  const posterW = large ? 100 : 92;
  const posterH = Math.round(posterW * 1.5);
  const textW = small ? inner : inner - posterW - 12;
  const cols = small ? 9 : large ? 12 : 11;

  const root = (uri, children) => (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        width: "match_parent", height: "match_parent", padding: pad, borderRadius: 24, borderWidth: 1,
        borderColor: C.boardBorder, backgroundColor: C.boardBg, flexDirection: "column",
      }}
    >
      {children}
    </FlexWidget>
  );

  // Boş pano ya da günün seçkisi bitti.
  const safeIndex = Math.min(Math.max(Number(index) || 0, 0), items.length);
  if (!items.length || safeIndex === items.length) {
    const finished = items.length > 0;
    const board = label(labels, finished ? "doneBoard" : "emptyBoard");
    return root(DISCOVER_URI, (
      <FlexWidget style={{ flexDirection: "column", width: "match_parent", height: "match_parent" }}>
        <Header left={label(labels, small ? "tonightShort" : "tonight")} right={finished ? `${items.length}/${items.length}` : null} />
        <FlexWidget style={{ height: 8 }} />
        <Flaps text={board} cols={cols} rows={2} width={textW} cellH={19} fontSize={13} />
        <FlexWidget style={{ height: 8 }} />
        <Mono text={label(labels, finished ? "doneMeta" : "emptyMeta")} size={9.5} />
        <FlexWidget style={{ height: 5 }} />
        <Body text={finished ? label(labels, "doneText", items.length) : label(labels, "emptyText")} lines={small ? 4 : 3} />
        <FlexWidget style={{ flex: 1 }} />
        {small ? null : (
          <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "flex-end" }}>
            {finished
              ? <Pill text={label(labels, "restart")} action="NEXT" />
              : <Pill text={label(labels, "discover")} gold />}
          </FlexWidget>
        )}
      </FlexWidget>
    ));
  }

  const item = items[safeIndex];
  const position = `${pad2(safeIndex + 1)}/${pad2(items.length)}`;
  const upcoming = [1, 2, 3].map((k) => items[safeIndex + k]).filter(Boolean);

  const textColumn = (
    <FlexWidget style={{ flexDirection: "column", width: textW, height: small ? "match_parent" : posterH }}>
      <Header left={label(labels, small ? "tonightShort" : "tonight")} right={position} />
      <FlexWidget style={{ height: small ? 8 : 6 }} />
      <Flaps text={item.board} cols={cols} rows={2} width={textW} cellH={large ? 20 : 19} fontSize={large ? 14 : 13} />
      <FlexWidget style={{ height: 7 }} />
      <Mono text={large && item.imdb ? `${item.meta} · IMDb ${item.imdb}` : item.meta} size={9.5} />
      <FlexWidget style={{ height: 5 }} />
      {item.reason ? <Body text={large && item.overview ? `${item.reason} ${item.overview}` : item.reason} lines={large ? 4 : 2} size={small ? 11 : 11.5} /> : null}
      <FlexWidget style={{ flex: 1 }} />
      {small ? (item.imdb ? <Mono text={`IMDb ${item.imdb}`} /> : null) : (
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between", alignItems: "center" }}>
          <Mono text={item.imdb ? `IMDb ${item.imdb}` : " "} size={9.5} />
          <Pill text={`${label(labels, "next")} ›`} action="NEXT" />
        </FlexWidget>
      )}
    </FlexWidget>
  );

  if (small) return root(filmUri(item.id), textColumn);

  return root(filmUri(item.id), (
    <FlexWidget style={{ flexDirection: "column", width: "match_parent", height: "match_parent" }}>
      <FlexWidget style={{ flexDirection: "row", flexGap: 12, width: "match_parent" }}>
        <Poster uri={item.poster} width={posterW} height={posterH} />
        {textColumn}
      </FlexWidget>
      {large && upcoming.length ? (
        <FlexWidget style={{ flexDirection: "column", width: "match_parent", marginTop: 14 }}>
          <Mono text={label(labels, "upcoming")} color={C.brass} medium tracking={0.1} />
          <FlexWidget style={{ flexDirection: "column", width: "match_parent", marginTop: 4 }}>
            {upcoming.map((next, k) => (
              <FlexWidget
                key={`u${next.id}`}
                clickAction="OPEN_URI"
                clickActionData={{ uri: filmUri(next.id) }}
                style={{ flexDirection: "row", alignItems: "center", flexGap: 10, width: "match_parent", height: 34, borderBottomWidth: 1, borderBottomColor: C.rowLine }}
              >
                <Mono text={pad2(safeIndex + k + 2)} size={10.5} color={C.brass} medium />
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget text={next.title} maxLines={1} truncate="END" allowFontScaling={false} style={{ fontSize: 17, fontFamily: F.marqueeBold, color: C.ink }} />
                </FlexWidget>
                <Mono text={shortMeta(next.meta)} />
              </FlexWidget>
            ))}
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  ));
}

// ---------- Blend ----------

function Seat({ initial }) {
  return (
    <FlexWidget style={{ flexDirection: "column", alignItems: "center" }}>
      <FlexWidget style={{ width: 46, height: 24, backgroundColor: C.velvet, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, justifyContent: "center", alignItems: "center" }}>
        <TextWidget text={initial} allowFontScaling={false} style={{ fontSize: 14, fontFamily: F.marqueeBold, color: C.billing }} />
      </FlexWidget>
      <FlexWidget style={{ width: 50, height: 8, borderRadius: 3, backgroundColor: C.velvetSeat }} />
    </FlexWidget>
  );
}

function Seats({ left, right }) {
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "flex-end", flexGap: 4 }}>
      <Seat initial={left} />
      <FlexWidget style={{ width: 6, height: 18, borderRadius: 3, backgroundColor: C.seatArm }} />
      <Seat initial={right} />
    </FlexWidget>
  );
}

function Glow({ width }) {
  return <FlexWidget style={{ width, height: 3, borderRadius: 2, backgroundColor: C.glow }} />;
}

export function BlendWidget({ data, labels, width = 160, height = 160 }) {
  const medium = width >= 250;
  const rootStyle = {
    width: "match_parent", height: "match_parent", padding: 14, borderRadius: 24, borderWidth: 1,
    borderColor: C.velvetBorder, backgroundColor: C.velvetDeep,
  };
  const initialOf = (name) => upper(labels, String(name || "?").slice(0, 1));

  if (!data) {
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: BLENDS_URI }} style={{ ...rootStyle, flexDirection: "column", alignItems: "center" }}>
        <FlexWidget style={{ width: "match_parent" }}>
          <Mono text={label(labels, "blend")} color={C.brass} medium tracking={0.1} />
        </FlexWidget>
        <FlexWidget style={{ height: 8 }} />
        <Glow width={medium ? 200 : 104} />
        <FlexWidget style={{ height: 10 }} />
        <TextWidget text={label(labels, "blendEmpty")} maxLines={3} style={{ fontSize: 12, color: C.billing, textAlign: "center" }} />
        <FlexWidget style={{ flex: 1 }} />
        <Seats left="?" right="?" />
      </FlexWidget>
    );
  }

  const score = (size) => (
    <FlexWidget style={{ flexDirection: "column", alignItems: "center" }}>
      <Glow width={medium ? 96 : 104} />
      <FlexWidget style={{ height: 6 }} />
      <TextWidget text={`%${data.percent}`} allowFontScaling={false} style={{ fontSize: size, fontFamily: F.marquee, color: C.brass }} />
      <Mono text={upper(labels, `${data.me} × ${data.friend}`)} size={9.5} color={C.billing} tracking={0.1} />
    </FlexWidget>
  );

  const left = (
    <FlexWidget style={{ flexDirection: "column", alignItems: "center", width: medium ? 120 : "match_parent", height: "match_parent" }}>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between" }}>
        <Mono text={label(labels, "blend")} color={C.brass} medium tracking={0.1} />
        {medium ? null : <Mono text={label(labels, "blendScore")} color={C.billing} medium tracking={0.1} />}
      </FlexWidget>
      <FlexWidget style={{ height: 8 }} />
      {score(medium ? 46 : 42)}
      <FlexWidget style={{ flex: 1 }} />
      <Seats left={initialOf(data.me)} right={initialOf(data.friend)} />
    </FlexWidget>
  );

  if (!medium) {
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: blendUri(data) }} style={{ ...rootStyle, flexDirection: "column" }}>
        {left}
      </FlexWidget>
    );
  }

  const films = (data.films || []).slice(0, 3);
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: blendUri(data) }} style={{ ...rootStyle, flexDirection: "row", flexGap: 14 }}>
      {left}
      <FlexWidget style={{ flexDirection: "column", flex: 1, height: "match_parent" }}>
        <Mono text={label(labels, "together")} color={C.brass} medium tracking={0.1} />
        <FlexWidget style={{ height: 10 }} />
        <FlexWidget style={{ flexDirection: "row", flexGap: 8 }}>
          {films.map((film) => (
            <FlexWidget key={`f${film.id}`} clickAction="OPEN_URI" clickActionData={{ uri: filmUri(film.id) }} style={{ flexDirection: "column", width: 56 }}>
              <Poster uri={film.poster} width={56} height={84} border={C.velvetBorder} />
              <FlexWidget style={{ height: 5 }} />
              <TextWidget text={film.title} maxLines={1} truncate="END" style={{ fontSize: 9.5, color: C.billing }} />
            </FlexWidget>
          ))}
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
        <Body text={label(labels, "togetherNote")} size={10.5} color={C.billing} />
      </FlexWidget>
    </FlexWidget>
  );
}
