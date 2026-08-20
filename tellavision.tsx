import { useState, useMemo, useRef, useEffect } from "react";

// App version. Distinct from the drawing's REV, which is per-project and set
// by the user in the Project panel. Bump on release and tag the repo to match.
const APP_VERSION = "2.3.0";

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — DATA
// Domain tables. Sizes in inches unless suffixed _mm.
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// Catalog data model: SHIPPED BASELINE + LOCAL OVERLAY.
//
// The BASE_* tables below are the versioned, provenance-carrying source of
// truth and are never written to at runtime. Anything the user changes in the
// Data screen lands in a separate overlay in localStorage and is merged over
// the baseline at load. Two reasons this is not just "make the consts
// editable": an app update can improve the baseline without clobbering local
// corrections, and every changed row stays identifiable as unverified rather
// than silently impersonating a spec-sheet figure.
//
// The overlay is small (deltas only) and loads synchronously, so the effective
// tables are ready before anything derives from them.
const OVERRIDE_KEY = "tellavision-catalog-v1";
const loadOverlay = () => {
  try {
    if (typeof window === "undefined") return {};
    return JSON.parse(window.localStorage.getItem(OVERRIDE_KEY) || "{}") || {};
  } catch { return {}; }
};
const saveOverlay = (ov) => {
  try { window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(ov)); } catch {}
};
const clone = (v) => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

// A table slice is { rows: { key: <full record> }, removed: [keys] }. `rows`
// holds the complete effective record for anything edited or added, so a diff
// against the baseline is what marks a row as changed.
const mergeTable = (base, slice) => {
  const out = clone(base);
  if (!slice) return out;
  (slice.removed || []).forEach(k => { delete out[k]; });
  Object.entries(slice.rows || {}).forEach(([k, v]) => { out[k] = clone(v); });
  return out;
};

const BASE_TV_CATALOG = {
  Sony:    [42, 43, 48, 50, 55, 65, 75, 77, 85, 98, 100, 115],
  Samsung: [32, 43, 50, 55, 65, 75, 77, 83, 85, 98, 100, 115],
  LG:      [42, 48, 55, 65, 77, 83, 97],
};

// Back boxes.
//
// Future Automation WB series — verified 2026-08-19 against the manufacturer's
// own technical sheets (futureautomation.co.uk/Tech/<model>-tech.pdf) and the
// WB21/26/31-2S installation guide (Tech/wb-2s-instructions.pdf).
//
// ORIENTATION MATTERS AND IS EASY TO GET BACKWARDS. The model number is the
// HEIGHT, not the width, in both families:
//   * non-2S boxes recess into a SINGLE stud bay, so width is pinned at 353mm
//     (13.9") to pass between studs at 406mm (16") centres. They are portrait.
//   * "-2S" boxes span TWIN studs: the install guide gives a cut-out of
//     762mm [30.0"] WIDE x DIM X high, where DIM X is 540/668/795mm
//     (21.3/26.3/31.3") for WB21/26/31-2S. They are landscape.
// So WB21 is 13.9"w x 20.9"h, and WB21-2S is 29.9"w x 21.1"h — same nominal
// "21" height class, roughly double the width. w/h were transposed here until
// 2026-08-19; see the studBay self-tests below, which pin this down.
//
// w/h/d are the published "Product Dimensions (in wall)" (the box body).
// Cut-outs run ~2mm larger, and FA requires a MINIMUM cut-out depth of
// 101.6mm [4.0"] — deeper than the 3.8" box itself.
//
// tvMin/tvMax are OUR routing rule (inferred from PS-bracket pairing), NOT
// published by FA — the only screen range FA states is WB80's 60"-90".
const BASE_BACK_BOXES = {
  // single stud bay — 353mm (13.9") wide, fits between 16" o.c. studs
  "FA-WB21":    { brand: "Future Automation", line: "WB", w: 13.9, h: 20.9, d: 3.8, label: "WB21",    bracket: "PS40",            studs: "single", tvMin: 40, tvMax: 55 },
  "FA-WB26":    { brand: "Future Automation", line: "WB", w: 13.9, h: 26.0, d: 3.8, label: "WB26",    bracket: "PS40/PS55",       studs: "single", tvMin: 50, tvMax: 65 },
  "FA-WB31":    { brand: "Future Automation", line: "WB", w: 13.9, h: 31.0, d: 3.8, label: "WB31",    bracket: "PS40/PS55/PS65",  studs: "single", tvMin: 60, tvMax: 75 },
  // twin stud — 762mm (30.0") cut-out across studs at 30" centres
  "FA-WB16-2S": { brand: "Future Automation", line: "WB", w: 24.6, h: 15.9, d: 3.8, label: "WB16-2S (twin stud)", bracket: "PS32",           studs: "twin", tvMin: 32, tvMax: 43 },
  "FA-WB21-2S": { brand: "Future Automation", line: "WB", w: 29.9, h: 21.1, d: 3.8, label: "WB21-2S (twin stud)", bracket: "PS40",           studs: "twin", tvMin: 40, tvMax: 55 },
  "FA-WB26-2S": { brand: "Future Automation", line: "WB", w: 29.9, h: 26.2, d: 3.8, label: "WB26-2S (twin stud)", bracket: "PS40/PS55",      studs: "twin", tvMin: 50, tvMax: 65 },
  "FA-WB31-2S": { brand: "Future Automation", line: "WB", w: 29.9, h: 31.2, d: 3.8, label: "WB31-2S (twin stud)", bracket: "PS40/PS55/PS65", studs: "twin", tvMin: 60, tvMax: 75 },
  // WB80 sheet states (WxHxD) explicitly: 1169 x 863 x 97mm, screens 60"-90".
  // At 46" it spans three bays, not two — its guide calls for three top and
  // three bottom fixings, so it is "multi", not "twin".
  "FA-WB80":    { brand: "Future Automation", line: "WB", w: 46.0, h: 34.0, d: 3.8, label: "WB80",    bracket: "PS80",            studs: "multi", tvMin: 60, tvMax: 90 },

  // SnapAV Strong VersaBox — verified 2026-08-19 against Snap One's own
  // installation manuals and dimensioned drawings (snapav.com .../Mounts and
  // .../StructuredWiring ManualsAndGuides, plus the VersaBox Pro XL cutsheet).
  //
  // SAME TRAP AS THE FA LINE: marketing names these "8 x 14", "14 x 14",
  // "14 x 20" with the HEIGHT first, and the XL was stored here transposed as
  // 20w x 14h. Every VersaBox is ~14.25" WIDE — they all drop into ONE 16" o.c.
  // stud bay ("centre the cutout template between the studs"; the manual only
  // mentions dog ears for studs wider than 16"). Height is what varies.
  //
  // Manuals state cutout, drawings state the box shell. w/h below are the box
  // shell where a drawing exists, cutout where only the manual does (noted);
  // the two differ by ~0.25", well inside drawing tolerance.
  //   SM-RBX-8        cutout 14.25 (W) x 8.5 (H)
  //   SM-RBX-14       cutout 14.0 (W) x 13.25 (H)
  //   SM-RBX-PRO-8    shell 14.25 x 8.29 x 3.76   (cutout 14.25 x 8.5)
  //   SM-RBX-PRO-14   shell 14.25 x 13.29 x 3.76  (cutout 14.5 x 13.5)
  //   SM-RBX-PRO-20   shell 14.25 x 20 x 3.9      (cutout 14.5 x 20.2)
  // Depth: drawings show a 3.76" shell, Snap One publishes 3.9" — 3.9 kept as
  // the rough-in figure. tvMin/tvMax are OUR routing rule; Snap One publishes
  // no screen range for these (the boxes are display-agnostic).
  "SM-RBX-8":     { brand: "SnapAV Strong", line: "VersaBox",     w: 14.25, h: 8.5,   d: 3.9, label: "VersaBox 8",      bracket: "Razor", studs: "single", tvMin: 32, tvMax: 65, note: "Cutout figures — no shell drawing published" },
  "SM-RBX-14":    { brand: "SnapAV Strong", line: "VersaBox",     w: 14.0,  h: 13.25, d: 3.9, label: "VersaBox 14",     bracket: "Razor", studs: "single", tvMin: 50, tvMax: 85, note: "Cutout figures — no shell drawing published" },
  "SM-RBX-PRO-8": { brand: "SnapAV Strong", line: "VersaBox Pro", w: 14.25, h: 8.29,  d: 3.9, label: "VersaBox Pro 8",  bracket: "Razor", studs: "single", tvMin: 32, tvMax: 65 },
  "SM-RBX-PRO-14":{ brand: "SnapAV Strong", line: "VersaBox Pro", w: 14.25, h: 13.29, d: 3.9, label: "VersaBox Pro 14", bracket: "Razor", studs: "single", tvMin: 50, tvMax: 85 },
  "SM-RBX-PRO-20":{ brand: "SnapAV Strong", line: "VersaBox Pro", w: 14.25, h: 20.0,  d: 3.9, label: "VersaBox Pro XL", bracket: "Razor", studs: "single", tvMin: 65, tvMax: 98, note: "Fits Samsung One Connect 8K (15.5 x 7 x 3.2)" },
};

// Framing the boxes have to survive, in inches of clear opening.
const STUD_CLEAR = {
  single: 16 - 1.5,        // 16" o.c. less one 2x4 -> 14.5" clear
  twin:   16 * 2 - 1.5,    // centre stud removed -> 30.5" clear (FA cut-out 30.0")
  multi:  16 * 3 - 1.5,    // two studs removed -> 46.5" clear (WB80 is 46.0")
};

// SANUS Black Series (Legrand AV, doc SANBLK0919) — specs from the user's
// catalog JSON. plateW/plateH from product dimensions (min of ranges);
// vesaMax parsed W×H mm. depth = profile off wall; ext = full-motion reach.
// The VersaBox keys used to be invented ("SB-RBX-*"); real Snap One SKUs are
// "SM-RBX-*". Saved designs and previously exported JSON still carry the old
// ones, so map them forward rather than silently falling back to a default box.
const LEGACY_BOX_KEYS = {
  "SB-RBX-8": "SM-RBX-8", "SB-RBX-14": "SM-RBX-14", "SB-RBX-PRO-8": "SM-RBX-PRO-8",
  "SB-RBX-PRO-14": "SM-RBX-PRO-14", "SB-RBX-PRO-XL": "SM-RBX-PRO-20",
};
const canonBoxKey = (k) => LEGACY_BOX_KEYS[k] || k;

// Sanus Black Series (a.k.a. Choice Collection) custom-install mounts.
//
// VERIFIED 2026-08-20 against SANUS's own Black Series literature,
// sanus.com/assets/literature/pdf/SANBLK0919_web.pdf — every model has a spec
// block there giving VESA min/max, capacity, depth, extension, tilt, suggested
// screen range, list price and product dimensions. All seven were already
// correct; unlike the back boxes, nothing here was transposed.
//
// Field notes, so the next person does not "fix" a correct value:
//  * plateW/plateH are the PRODUCT dimensions (w x h) — the physical extent of
//    the mount, which is what the elevation draws. Sanus also prints a separate
//    wall-plate drawing; do not mix the two.
//  * depth is the spec-block DEPTH, which differs by a few hundredths from the
//    product-dimension depth on some models (CILT1 2.2 vs 2.18, CIXT1 2.5 vs
//    2.41). The DEPTH field is the one Sanus quotes, so it is the one used.
//  * list is LIST PRICE. MSRP is lower and is not carried here.
//  * vesaMin matters: a panel whose pattern is SMALLER than the mount's minimum
//    will not bolt up without an adapter. Checking only the max reported a
//    Sony 42" (100x100) as compatible with CILT1 (min 200x200).
//  * SANUS does not publish a swivel figure for this line — the literature
//    lists Extension and Tilt only. Two invented swivel numbers were removed
//    on 2026-08-20 rather than shipping unsourced angles.
//  * CIXT1 ships with extender brackets, so its footprint is a RANGE.
//    plateWMax/plateHMax carry the extended size.
const BASE_SANUS_MOUNTS = {
  "S-CILF230": { model: "CILF230-G1", name: "Large Full Motion", style: "fullmotion", tvMin: 46, tvMax: 95, capLbs: 175, vesaMinW: 200, vesaMinH: 200, vesaMaxW: 600, vesaMaxH: 400, depth: 2.46, ext: 30, plateW: 36.73, plateH: 22.03, tilt: "+5/-15", swivel: null, list: 499.99 },
  "S-CILF226": { model: "CILF226-B1", name: "Large Full Motion", style: "fullmotion", tvMin: 37, tvMax: 80, capLbs: 135, vesaMinW: 200, vesaMinH: 200, vesaMaxW: 600, vesaMaxH: 400, depth: 2.4, ext: 26, plateW: 27.59, plateH: 19.55, tilt: "+5/-15", swivel: null, list: 299.99 },
  "S-CILT2":   { model: "CILT2-B1", name: "Large Advanced Tilt", style: "tilt", tvMin: 37, tvMax: 90, capLbs: 150, vesaMinW: 200, vesaMinH: 100, vesaMaxW: 690, vesaMaxH: 415, depth: 2.75, ext: 5.75, plateW: 30, plateH: 18.11, tilt: "+7/-12", swivel: null, list: 279.99 },
  "S-CILT1":   { model: "CILT1-B1", name: "Large Tilting", style: "tilt", tvMin: 37, tvMax: 95, capLbs: 180, vesaMinW: 200, vesaMinH: 200, vesaMaxW: 690, vesaMaxH: 415, depth: 2.2, ext: null, plateW: 30, plateH: 17.53, tilt: "+7/-10", swivel: null, list: 249.99 },
  "S-CIXT1":   { model: "CIXT1-B1", name: "Extra Large Tilting", style: "tilt", tvMin: 40, tvMax: 110, capLbs: 300, vesaMinW: 200, vesaMinH: 200, vesaMaxW: 1100, vesaMaxH: 800, depth: 2.5, ext: null, plateW: 33.43, plateH: 17.53, plateWMax: 52.93, plateHMax: 32.49, tilt: "+7/-10", swivel: null, list: 299.99, note: "Extender brackets included — footprint grows to 52.93 x 32.49" },
  "S-CILL2":   { model: "CILL2-B1", name: "Large Fixed", style: "fixed", tvMin: 37, tvMax: 90, capLbs: 150, vesaMinW: 100, vesaMinH: 100, vesaMaxW: 825, vesaMaxH: 500, depth: 0.55, ext: null, plateW: 35.26, plateH: 22.1, tilt: null, swivel: null, list: 199.99 },
  "S-CILL1":   { model: "CILL1-B1", name: "Large Fixed", style: "fixed", tvMin: 37, tvMax: 95, capLbs: 180, vesaMinW: 200, vesaMinH: 200, vesaMaxW: 690, vesaMaxH: 415, depth: 1.6, ext: null, plateW: 30, plateH: 17.53, tilt: null, swivel: null, list: 199.99 },
};

const BASE_SANUS_STYLE_ORDER = {
  fixed: ["S-CILL1", "S-CILL2"],
  tilt: ["S-CILT1", "S-CILT2", "S-CIXT1"],
  fullmotion: ["S-CILF226", "S-CILF230"],
};

const BASE_VESA_DATA = {
  Sony: {
    42: { w_mm: 100, h_mm: 100, screw: "M4", voffset_pct: 0, note: "Verify - small sizes vary by series" },
    43: { w_mm: 200, h_mm: 200, screw: "M6", voffset_pct: 0 },
    48: { w_mm: 300, h_mm: 300, screw: "M6", voffset_pct: -5, note: "OLED - pattern biased low" },
    50: { w_mm: 200, h_mm: 200, screw: "M6", voffset_pct: 0 },
    55: { w_mm: 300, h_mm: 300, screw: "M6", voffset_pct: -3 },
    65: { w_mm: 300, h_mm: 300, screw: "M6", voffset_pct: -3 },
    75: { w_mm: 300, h_mm: 300, screw: "M6", voffset_pct: 0 },
    77: { w_mm: 300, h_mm: 300, screw: "M6", voffset_pct: -5, note: "OLED - pattern biased low" },
    85: { w_mm: 400, h_mm: 400, screw: "M8", voffset_pct: 0 },
    98: { w_mm: 600, h_mm: 400, screw: "M8", voffset_pct: 0 },
    100:{ w_mm: 600, h_mm: 400, screw: "M8", voffset_pct: 0 },
  },
  Samsung: {
    32: { w_mm: 100, h_mm: 100, screw: "M8", voffset_pct: 0 },
    43: { w_mm: 200, h_mm: 200, screw: "M8", voffset_pct: 0 },
    50: { w_mm: 200, h_mm: 200, screw: "M8", voffset_pct: 0 },
    55: { w_mm: 300, h_mm: 300, screw: "M8", voffset_pct: 0, note: "OLED 300x300, Neo QLED 400x300" },
    65: { w_mm: 400, h_mm: 300, screw: "M8", voffset_pct: -3 },
    75: { w_mm: 400, h_mm: 300, screw: "M8", voffset_pct: 0 },
    77: { w_mm: 400, h_mm: 400, screw: "M8", voffset_pct: -3, note: "OLED only - biased low" },
    83: { w_mm: 400, h_mm: 400, screw: "M8", voffset_pct: -3, note: "S95F OLED" },
    85: { w_mm: 600, h_mm: 400, screw: "M8", voffset_pct: 0 },
    98: { w_mm: 600, h_mm: 400, screw: "M8", voffset_pct: 0 },
    100:{ w_mm: 600, h_mm: 400, screw: "M8", voffset_pct: 0 },
    115:{ w_mm: 1000, h_mm: 600, screw: "M8", voffset_pct: 0, note: "Micro RGB - 1000x600 verified from spec sheet; screw depth 16-18mm; no Sanus Black mount this size" },
  },
  LG: {
    42: { w_mm: 300, h_mm: 200, screw: "M6", voffset_pct: -8, note: "OLED - pattern biased low" },
    48: { w_mm: 300, h_mm: 200, screw: "M6", voffset_pct: -8, note: "OLED - pattern biased low" },
    55: { w_mm: 300, h_mm: 200, screw: "M6", voffset_pct: -10, note: "C5: bottom holes ~9in from bottom edge" },
    65: { w_mm: 300, h_mm: 200, screw: "M6", voffset_pct: -10, note: "C5: bottom holes ~9in from bottom edge" },
    77: { w_mm: 300, h_mm: 200, screw: "M6", voffset_pct: -10, note: "C5: pattern offset low for weight distribution" },
    83: { w_mm: 400, h_mm: 400, screw: "M8", voffset_pct: -5, note: "Larger pattern - closer to center" },
    97: { w_mm: 600, h_mm: 400, screw: "M8", voffset_pct: 0 },
  },
};

// Every abbreviation that can appear on the drawing or status bar, with its
// expansion. Feeds the in-app LEGEND panel and the PDF legend strip; the
// FULL WORDS toggle swaps drawing labels to the spelled-out forms instead.
const ABBREVIATIONS = [
  ["AFF", "above finished floor"],
  ["CL", "centerline"],
  ["CTR", "center"],
  ["BTM", "bottom"],
  ["ABV / BLW", "above / below"],
  ["LT / RT", "left / right of centerline"],
  ["PWR", "power outlet"],
  ["LV", "low-voltage feed"],
  ["VESA", "TV mounting-hole pattern"],
  ["EXT", "extension (mount reach off wall)"],
  ["WB", "wall box (Future Automation)"],
  ["REV", "revision"],
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — ENGINE
// Pure functions only: inches in, inches out. No React, no DOM, no rounding.
// Display rounding happens at render via fmtIn(). The UI must never do
// arithmetic — every number on screen reads a field computed here.
// ═══════════════════════════════════════════════════════════════════════════

// Gap between TV bottom edge and mantel top / firebox opening top, in inches.
const BASE_CLEARANCE = { mantel: 8, noMantel: 10 };

// 16:9 panel + ~1.2" bezel allowance. Constants are 16/sqrt(337), 9/sqrt(337).
const BASE_FORMULA = { wCoef: 0.872, hCoef: 0.490, bezel: 1.2 };
const tvDims = (size) => ({ w: size * FORMULA.wCoef + FORMULA.bezel, h: size * FORMULA.hCoef + FORMULA.bezel });

// Exact panel data from manufacturer spec sheets (set WITHOUT stand).
// When present these REPLACE the 16:9 formula in every calculation, and
// weightLbs feeds the mount capacity check automatically.
const BASE_TV_OVERRIDES = {
  Samsung: { 115: { w: 101.2, h: 58.2, d: 1.4, weightLbs: 194.0, model: '115" Micro RGB' } },
  Sony:    { 115: { w: 101.0, h: 57.75, d: 2.5, weightLbs: 235.3, model: 'BRAVIA 9 II K115XR90M2 True RGB' } },
};

// ---- effective catalog = baseline + overlay -------------------------------
// These are `let` on purpose: the Data screen reassigns them through
// applyOverlay() so an edit takes effect without a reload. Everything
// downstream reads them at call time, never captures them at module init —
// BRANDS is derived here for the same reason.
const CATALOG_TABLES = {
  TV_CATALOG:       { base: () => BASE_TV_CATALOG,       nested: "list"    },
  BACK_BOXES:       { base: () => BASE_BACK_BOXES,       nested: "record"  },
  SANUS_MOUNTS:     { base: () => BASE_SANUS_MOUNTS,     nested: "record"  },
  SANUS_STYLE_ORDER:{ base: () => BASE_SANUS_STYLE_ORDER,nested: "list"    },
  VESA_DATA:        { base: () => BASE_VESA_DATA,        nested: "nested2" },
  TV_OVERRIDES:     { base: () => BASE_TV_OVERRIDES,     nested: "nested2" },
  CLEARANCE:        { base: () => BASE_CLEARANCE,        nested: "scalars" },
  FORMULA:          { base: () => BASE_FORMULA,          nested: "scalars" },
};

let OVERLAY = loadOverlay();
let TV_CATALOG, BACK_BOXES, SANUS_MOUNTS, SANUS_STYLE_ORDER, VESA_DATA, TV_OVERRIDES, CLEARANCE, FORMULA, BRANDS;

const applyOverlay = (ov) => {
  OVERLAY = ov || {};
  TV_CATALOG        = mergeTable(BASE_TV_CATALOG,        OVERLAY.TV_CATALOG);
  BACK_BOXES        = mergeTable(BASE_BACK_BOXES,        OVERLAY.BACK_BOXES);
  SANUS_MOUNTS      = mergeTable(BASE_SANUS_MOUNTS,      OVERLAY.SANUS_MOUNTS);
  SANUS_STYLE_ORDER = mergeTable(BASE_SANUS_STYLE_ORDER, OVERLAY.SANUS_STYLE_ORDER);
  VESA_DATA         = mergeTable(BASE_VESA_DATA,         OVERLAY.VESA_DATA);
  TV_OVERRIDES      = mergeTable(BASE_TV_OVERRIDES,      OVERLAY.TV_OVERRIDES);
  CLEARANCE         = mergeTable(BASE_CLEARANCE,         OVERLAY.CLEARANCE);
  FORMULA           = mergeTable(BASE_FORMULA,           OVERLAY.FORMULA);
  BRANDS            = Object.keys(TV_CATALOG);
  return OVERLAY;
};
applyOverlay(OVERLAY);

// Which rows differ from what shipped — drives the "edited" badges in the UI.
const overlayDiff = () => {
  const out = {};
  Object.entries(CATALOG_TABLES).forEach(([id, meta]) => {
    const slice = OVERLAY[id] || {};
    const added = [], edited = [];
    Object.keys(slice.rows || {}).forEach(k => {
      (k in meta.base() ? edited : added).push(k);
    });
    const removed = (slice.removed || []).filter(k => k in meta.base());
    if (added.length || edited.length || removed.length) out[id] = { added, edited, removed };
  });
  return out;
};
const overlayCount = () => Object.values(overlayDiff())
  .reduce((n, d) => n + d.added.length + d.edited.length + d.removed.length, 0);

const tvDimsFor = (brand, size) => {
  const o = TV_OVERRIDES[brand]?.[size];
  return o ? { w: o.w, h: o.h } : tvDims(size);
};

const mmToIn = (mm) => mm / 25.4;

const recommendBackBox = (tvSize, mountSystem, brand) => {
  if (!tvSize) return null;
  const samsung8K = brand === "Samsung" && tvSize >= 65;
  if (mountSystem === "fa") {
    if (tvSize <= 43) return "FA-WB16-2S";
    if (tvSize <= 55) return "FA-WB21";
    if (tvSize <= 65) return "FA-WB26";
    if (tvSize <= 75) return "FA-WB31";
    return "FA-WB80";
  }
  if (samsung8K) return "SM-RBX-PRO-20";
  if (tvSize <= 55) return "SM-RBX-PRO-8";
  if (tvSize > 85) return "SM-RBX-PRO-20";
  return "SM-RBX-PRO-14";
};

// Pick the Sanus Black mount for a TV size + style. Walks the style's
// price-ordered ladder; prefers a model whose size AND VESA both fit, then
// size-only (vesa flagged), then falls back to the XL tilt if nothing in
// the style covers the size. Returns null when no catalog mount fits.
// A panel must fall INSIDE the mount's pattern range. Checking only the max
// let a Sony 42" (100x100) through on a CILT1 whose published minimum is
// 200x200 — it will not bolt up without an adapter.
const vesaFitsMount = (spec, m) => {
  if (!spec || !m) return true;
  const minW = m.vesaMinW ?? 0, minH = m.vesaMinH ?? 0;
  return spec.w_mm >= minW && spec.h_mm >= minH &&
         spec.w_mm <= m.vesaMaxW && spec.h_mm <= m.vesaMaxH;
};

const recommendSanusMount = (tvSize, style, brand) => {
  if (!tvSize) return null;
  const spec = VESA_DATA[brand]?.[tvSize] || null;
  const vesaFits = (m) => vesaFitsMount(spec, m);
  const sizeFits = (m) => tvSize >= m.tvMin && tvSize <= m.tvMax;
  const order = SANUS_STYLE_ORDER[style] || SANUS_STYLE_ORDER.fixed;
  let key = order.find(k => sizeFits(SANUS_MOUNTS[k]) && vesaFits(SANUS_MOUNTS[k]));
  if (!key) key = order.find(k => sizeFits(SANUS_MOUNTS[k]));
  let styleFallback = false;
  if (!key && style !== "tilt" && sizeFits(SANUS_MOUNTS["S-CIXT1"])) {
    key = "S-CIXT1";
    styleFallback = true;
  }
  if (!key) return null;
  const m = SANUS_MOUNTS[key];
  return { key, ...m, vesaOk: vesaFits(m), sizeOk: sizeFits(m), styleFallback };
};

// --- display formatting (display-only; engine math stays full precision) ---
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

const fmtIn = (v, mode = "dec") => {
  if (v == null || isNaN(v)) return "—";
  if (mode === "dec") return `${v.toFixed(1)}"`;
  const neg = v < 0 ? "-" : "";
  const av = Math.abs(v);
  const fracParts = (x) => {
    let whole = Math.floor(x);
    let num = Math.round((x - whole) * 8);
    let den = 8;
    if (num === 8) { whole += 1; num = 0; }
    if (num > 0) { const g = gcd(num, den); num /= g; den /= g; }
    return [whole, num, den];
  };
  if (mode === "frac") {
    const [w, n, d] = fracParts(av);
    if (n === 0) return `${neg}${w}"`;
    return w === 0 ? `${neg}${n}/${d}"` : `${neg}${w}-${n}/${d}"`;
  }
  // "ftin"
  let ft = Math.floor(av / 12);
  let [w, n, d] = fracParts(av - ft * 12);
  if (w === 12) { ft += 1; w = 0; }
  if (ft === 0) return fmtIn(neg ? -av : av, "frac");
  const inch = n === 0 ? `${w}` : `${w} ${n}/${d}`;
  return `${neg}${ft}'-${inch}"`;
};

const computeTvCL = ({ wallW, hasFireplace, fbOffsetIn, tvOffsetIn }) =>
  wallW / 2 + (hasFireplace ? fbOffsetIn : 0) + tvOffsetIn;

const computeRecommendedCenterH = ({ selectedSize, brand, hasFireplace, hasMantel, mantelH, fbOpeningH, useViewDist, viewDist }) => {
  if (!selectedSize) return 42;
  const { h: tvH } = tvDimsFor(brand, selectedSize);
  if (hasFireplace && hasMantel) return mantelH + CLEARANCE.mantel + tvH / 2;
  if (hasFireplace && !hasMantel) return fbOpeningH + CLEARANCE.noMantel + tvH / 2;
  let base = 42;
  if (useViewDist && viewDist > 144) base = 44;
  if (useViewDist && viewDist > 192) base = 46;
  return base;
};

const computeCenterH = ({ mountHeightOverride, heightRef, recommendedCenterH, selectedSize, brand }) => {
  if (!mountHeightOverride) return recommendedCenterH;
  const val = parseFloat(mountHeightOverride);
  if (isNaN(val)) return recommendedCenterH;
  if (heightRef === "bottom" && selectedSize) return val + tvDimsFor(brand, selectedSize).h / 2;
  return val;
};

// Convert a height override between center- and bottom-reference, preserving
// the physical TV position. Full precision; caller rounds for display.
const convertOverride = (value, toRef, brand, selectedSize) => {
  if (!selectedSize || isNaN(value)) return null;
  const half = tvDimsFor(brand, selectedSize).h / 2;
  return toRef === "bottom" ? value - half : value + half;
};

// All geometry in inches. X measured from the LEFT WALL EDGE, heights are
// AFF (above finished floor). Single source of truth for schematic, status
// bar, spec panel, and PDF.
const computeLayout = ({ selectedSize, brand, centerH, tvCL, showBackBox, effectiveBoxModel, mountSystem, sanusMount }) => {
  if (!selectedSize) return null;
  const { w: tvW, h: tvH } = tvDimsFor(brand, selectedSize);
  const tvLeft = tvCL - tvW / 2;
  const tvRight = tvCL + tvW / 2;
  const tvTop = centerH + tvH / 2;
  const tvBottom = centerH - tvH / 2;

  const vesaSpec = VESA_DATA[brand]?.[selectedSize] || null;
  let vesa = null;
  if (vesaSpec) {
    vesa = {
      w: mmToIn(vesaSpec.w_mm),
      h: mmToIn(vesaSpec.h_mm),
      // negative voffset_pct = pattern biased low on the panel
      aff: centerH + (vesaSpec.voffset_pct / 100) * tvH,
      spec: vesaSpec,
    };
  }

  let box = null;
  if (showBackBox && BACK_BOXES[effectiveBoxModel]) {
    const bb = BACK_BOXES[effectiveBoxModel];
    const anchorAFF = vesa ? vesa.aff : centerH;
    let cx;
    if (mountSystem === "fa" && bb.brand === "Future Automation") {
      cx = tvCL; // FA boxes sit behind the bracket, centered on VESA
    } else {
      const vesaHalfW = vesa ? vesa.w / 2 : 0;
      cx = tvCL + vesaHalfW + 3 + bb.w / 2;
      if (cx + bb.w / 2 > tvRight - 0.5) {
        const leftCx = tvCL - vesaHalfW - 3 - bb.w / 2;
        if (leftCx - bb.w / 2 >= tvLeft + 0.5) cx = leftCx;
      }
    }
    const extendsOff =
      cx - bb.w / 2 < tvLeft || cx + bb.w / 2 > tvRight ||
      anchorAFF + bb.h / 2 > tvTop || anchorAFF - bb.h / 2 < tvBottom;
    const underRated = selectedSize < bb.tvMin || selectedSize > bb.tvMax;
    // btm matters in the field: with FA mounts the box location dictates
    // where the TV lands, so installers set the box from its bottom edge.
    box = { ...bb, model: effectiveBoxModel, cx, aff: anchorAFF, btm: anchorAFF - bb.h / 2, extendsOff, underRated };
  }

  // Electrical rough-in: inside the back box when there is one, otherwise
  // tucked behind the panel just right of the VESA plate.
  let outlet, lv;
  if (box) {
    const y = box.aff - box.h / 2 + Math.min(2.5, box.h / 2);
    outlet = { x: box.cx - box.w * 0.25, aff: y };
    lv = { x: box.cx + box.w * 0.25, aff: y };
  } else {
    const y = vesa ? vesa.aff : centerH;
    outlet = { x: tvCL + 4, aff: y };
    lv = { x: tvCL + 8, aff: y };
  }

  // mount: FA bracket implied by the system; Sanus carries real plate
  // dims, depth/profile, capacity, and fit flags
  const mount = mountSystem === "fa"
    ? { system: "fa" }
    : (sanusMount ? { system: "sanus", ...sanusMount } : null);

  return { tvW, tvH, tvCL, tvLeft, tvRight, tvTop, tvBottom, vesa, box, outlet, lv, mount, centerH };
};

// Reasons a size fails the proportional/clearance guidelines (size cards +
// warning panel). Empty array = recommended fit.
const computeFitIssues = (sz, { brand, wallW, wallH, hasFireplace, hasMantel, mantelH, fbOpeningH }) => {
  const { w, h } = tvDimsFor(brand, sz);
  const maxByWall = wallW * 0.65;
  const minByWall = wallW * 0.35;
  const issues = [];
  if (w > maxByWall) issues.push(`TV width (${w.toFixed(1)}") exceeds 65% of wall (${maxByWall.toFixed(1)}" max)`);
  if (w < minByWall) issues.push(`TV width (${w.toFixed(1)}") is below 35% of wall (${minByWall.toFixed(1)}" min)`);
  if (hasFireplace && hasMantel) {
    const available = wallH - mantelH - CLEARANCE.mantel;
    if (h > available) issues.push(`TV height (${h.toFixed(1)}") exceeds mantel clearance (${available.toFixed(1)}" available)`);
  }
  if (hasFireplace && !hasMantel) {
    const available = wallH - fbOpeningH - CLEARANCE.noMantel;
    if (h > available) issues.push(`TV height (${h.toFixed(1)}") exceeds firebox clearance (${available.toFixed(1)}" available)`);
  }
  return issues;
};

const computeRecommendations = ({ brand, wallW, wallH, hasFireplace, hasMantel, mantelH, fbOpeningH, useViewDist, viewDist }) => {
  const sizes = TV_CATALOG[brand];
  let candidates = sizes.filter(sz =>
    computeFitIssues(sz, { brand, wallW, wallH, hasFireplace, hasMantel, mantelH, fbOpeningH }).length === 0
  );
  if (useViewDist) {
    const ideal = viewDist / 1.6;
    candidates = candidates.slice().sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
  }
  return candidates.slice(0, 4);
};

const computePlacementIssues = ({ layout, wallW, wallH, hasFireplace, fbOpeningW, fbOffsetIn }) => {
  const issues = [];
  if (layout) {
    if (layout.tvBottom < 0) issues.push(`TV bottom is ${layout.tvBottom < 0 ? (-layout.tvBottom).toFixed(1) : 0}" below the floor`);
    if (layout.tvTop > wallH) issues.push(`TV top is ${(layout.tvTop - wallH).toFixed(1)}" above the wall`);
    if (layout.tvLeft < 0) issues.push(`TV extends ${(-layout.tvLeft).toFixed(1)}" past the left wall edge`);
    if (layout.tvRight > wallW) issues.push(`TV extends ${(layout.tvRight - wallW).toFixed(1)}" past the right wall edge`);
  }
  // Audit finding: the legacy build let the fireplace slide off the wall
  // silently. Firebox must sit fully on the wall.
  if (hasFireplace) {
    const fbLeft = wallW / 2 + fbOffsetIn - fbOpeningW / 2;
    const fbRight = wallW / 2 + fbOffsetIn + fbOpeningW / 2;
    if (fbLeft < 0) issues.push(`Firebox extends ${(-fbLeft).toFixed(1)}" past the left wall edge`);
    if (fbRight > wallW) issues.push(`Firebox extends ${(fbRight - wallW).toFixed(1)}" past the right wall edge`);
  }
  return issues;
};

const buildPartsList = ({ layout, showOutlet, showLowVolt }) => {
  if (!layout) return [];
  const rows = [];
  if (layout.mount?.system === "sanus") {
    rows.push([`Mount`, `Sanus Black ${layout.mount.model} (${layout.mount.name})`]);
  }
  if (layout.box) {
    rows.push([`Back box`, `${layout.box.brand} ${layout.box.label}`]);
    if (layout.mount?.system === "fa") rows.push([`Bracket`, `${layout.box.bracket} series (articulating)`]);
  } else if (layout.mount?.system === "fa") {
    rows.push([`Mount`, `Future Automation articulating bracket`]);
  }
  if (layout.vesa) rows.push([`VESA hardware`, `4× ${layout.vesa.spec.screw} screws (${layout.vesa.spec.w_mm}×${layout.vesa.spec.h_mm} pattern)`]);
  if (showOutlet) rows.push([`Power`, `1× recessed outlet kit`]);
  if (showLowVolt) rows.push([`Low voltage`, `1× LV mounting bracket + wall plate`]);
  return rows;
};

// --- reference underlay (imported PDF / image elevation) -----------------
// The underlay lives in wall-inch space, never screen pixels: `ppi` is bitmap
// pixels per real inch, and (ox, oy) is the image's top-left corner — ox inches
// right of the wall's left edge, oy inches above the floor. Keeping it in world
// units is what lets calibration survive a window resize, a mobile/desktop
// scale change, and the separate print render.
//
//   native px -> wall inches:  x = ox + px / ppi ,  y = oy - py / ppi
//   wall inches -> native px:  px = (x - ox) * ppi , py = (oy - y) * ppi
const UNDERLAY_MAX_PX = 1800;    // long-side cap for a rendered page bitmap
const UNDERLAY_JPEG_Q = 0.82;
const PDFJS_VERSION = "3.11.174"; // last UMD build — matches the app's no-bundler setup
const PDFJS_SRC = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.min.js`;
const PDFJS_WORKER = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.js`;

// Field input: accepts 96, 96", 8', 8'6", 8' 6 1/2", 6 1/2
const parseLenIn = (raw) => {
  if (raw == null) return NaN;
  const t = String(raw).trim().replace(/[\u2013\u2014]/g, "-").replace(/\u2019/g, "'").replace(/\u201D/g, '"');
  if (!t) return NaN;
  const m = t.match(/^(?:(\d+(?:\.\d+)?)\s*'\s*)?(?:(\d+(?:\.\d+)?)\s*)?(?:(\d+)\s*\/\s*(\d+)\s*)?"?$/);
  if (!m) return NaN;
  const ft = m[1] ? parseFloat(m[1]) : 0;
  const inch = m[2] ? parseFloat(m[2]) : 0;
  const frac = m[3] && m[4] && parseFloat(m[4]) ? parseFloat(m[3]) / parseFloat(m[4]) : 0;
  const v = ft * 12 + inch + frac;
  return v > 0 ? v : NaN;
};

const underlayInW = (u) => u.natW / u.ppi;
const underlayInH = (u) => u.natH / u.ppi;

// Drop a freshly imported bitmap onto the wall at a sane starting size. Fit to
// the wall (contain) so it is always on screen — the user calibrates from there.
const fitUnderlay = (natW, natH, wallW, wallH) => {
  const w = Math.max(wallW || 1, 1), h = Math.max(wallH || 1, 1);
  const ppi = Math.max(natW / w, natH / h);
  return { ppi, ox: (w - natW / ppi) / 2, oy: (h + natH / ppi) / 2 };
};

// Rescale by `k` about a fixed anchor (wall inches) so the point under the
// user's first click does not slide out from under them while the image resizes.
// k > 1 means the drawing represents MORE inches than we currently think.
const rescaleUnderlay = (u, k, anchor) => {
  if (!u || !(k > 0) || !isFinite(k)) return u;
  return {
    ...u,
    ppi: u.ppi / k,
    ox: anchor.x - (anchor.x - u.ox) * k,
    oy: anchor.y - (anchor.y - u.oy) * k,
  };
};

// Two-point calibration: user clicks across a known dimension and types its
// true length. Anchored on p1.
const calibrateTwoPoint = (u, p1, p2, trueIn) => {
  const measured = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (!u || !(measured > 1e-6) || !(trueIn > 0)) return null;
  return rescaleUnderlay(u, trueIn / measured, p1);
};

// Snap-to-object: user boxes the TV drawn on the imported elevation. Its real
// width is known from the catalog, so one gesture sets the scale AND parks the
// underlay so the drawn TV lands under the app's TV.
const calibrateToBox = (u, box, realW, target) => {
  const measured = Math.abs(box.x2 - box.x1);
  if (!u || !(measured > 1e-6) || !(realW > 0)) return null;
  const anchor = { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 };
  const scaled = rescaleUnderlay(u, realW / measured, anchor);
  if (!target) return scaled;
  return { ...scaled, ox: scaled.ox + (target.x - anchor.x), oy: scaled.oy + (target.y - anchor.y) };
};

// --- markup layer --------------------------------------------------------
// Every point is stored in wall inches for the same reason as the underlay.
const MARKUP_TOOLS = ["select", "mask", "pen", "line", "arrow", "rect", "text", "measure"];
const MARKUP_COLORS = ["#FF3B30", "#FFB000", "#00D68F", "#4A9EFF", "#FFFFFF", "#111111"];
const MARKUP_WIDTHS = [1, 2, 3.5];

// Drawing type size. Scales every glyph AND the padding, plate and rail-packing
// maths derived from it, so a bigger label never collides or clips.
const TEXT_SCALES = [
  { v: 0.9,  label: "S" },
  { v: 1,    label: "M" },
  { v: 1.15, label: "L" },
  { v: 1.3,  label: "XL" },
];

// Pen strokes arrive at pointer-event density; thin them before they hit
// localStorage. Perpendicular-distance decimation, tolerance in inches.
const simplifyPts = (pts, tol = 0.25) => {
  if (!pts || pts.length < 3) return pts || [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const dx = c.x - a.x, dy = c.y - a.y;
    const len = Math.hypot(dx, dy);
    const d = len < 1e-9
      ? Math.hypot(b.x - a.x, b.y - a.y)
      : Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / len;
    if (d > tol) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
};

// --- picking and editing existing markup ---------------------------------
// All of this works in wall inches; the caller converts a pixel tolerance so
// the grab radius feels identical however the drawing is scaled.
const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const rectCorners = (a, b) => {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
};

// Topmost hit wins, matching what the user sees stacked on screen.
const hitMarkup = (items, q, tol) => {
  for (let i = (items || []).length - 1; i >= 0; i--) {
    const m = items[i], pts = (m && m.pts) || [];
    if (!pts.length) continue;
    if (m.type === "text") {
      if (Math.hypot(q.x - pts[0].x, q.y - pts[0].y) <= Math.max(tol, 2.5)) return i;
      continue;
    }
    if (m.type === "mask") {
      // filled, so anywhere inside it is a hit — unlike an outline box
      const c = rectCorners(pts[0], pts[pts.length - 1]);
      if (q.x >= c[0].x - tol && q.x <= c[2].x + tol && q.y >= c[0].y - tol && q.y <= c[2].y + tol) return i;
      continue;
    }
    if (m.type === "rect") {
      const c = rectCorners(pts[0], pts[pts.length - 1]);
      if ([[0, 1], [1, 2], [2, 3], [3, 0]].some(([u, v]) => distToSeg(q, c[u], c[v]) <= tol)) return i;
      continue;
    }
    for (let j = 1; j < pts.length; j++) if (distToSeg(q, pts[j - 1], pts[j]) <= tol) return i;
    if (pts.length === 1 && Math.hypot(q.x - pts[0].x, q.y - pts[0].y) <= tol) return i;
  }
  return -1;
};

// Grab points. A box shows all four corners even though only two are stored;
// a pen stroke and a text label are move-only (reshaping them handle-by-handle
// would be worse than redrawing).
const handlesFor = (m) => {
  if (!m || !m.pts || !m.pts.length) return [];
  if (m.type === "text" || m.type === "pen") return [];
  if (m.type === "rect" || m.type === "mask") return rectCorners(m.pts[0], m.pts[m.pts.length - 1]).map((p, i) => ({ ...p, ix: i }));
  return m.pts.map((p, i) => ({ ...p, ix: i }));
};

const moveHandle = (m, ix, q) => {
  if (m.type === "rect" || m.type === "mask") {
    const a = { ...m.pts[0] }, b = { ...m.pts[m.pts.length - 1] };
    // corners run clockwise from top-left of the normalised box
    if (ix === 0) { a.x = q.x; a.y = q.y; }
    else if (ix === 1) { b.x = q.x; a.y = q.y; }
    else if (ix === 2) { b.x = q.x; b.y = q.y; }
    else { a.x = q.x; b.y = q.y; }
    return { ...m, pts: [a, b] };
  }
  return { ...m, pts: m.pts.map((p, i) => (i === ix ? { x: q.x, y: q.y } : p)) };
};

// --- snapping --------------------------------------------------------------
// Snaps to things that MEAN something on this drawing rather than an arbitrary
// grid, so "measure from the TV edge to the wall" lands exactly and the number
// can be trusted. Each axis snaps independently, then 2-point shapes get an
// ortho lock so a dimension stays truly horizontal or vertical.
const snapAnchors = (layout, wallW, wallH) => {
  const xs = [{ v: 0, why: "wall left" }, { v: wallW, why: "wall right" }, { v: wallW / 2, why: "wall centre" }];
  const ys = [{ v: 0, why: "floor" }, { v: wallH, why: "ceiling" }];
  if (layout) {
    xs.push({ v: layout.tvLeft, why: "TV left" }, { v: layout.tvRight, why: "TV right" }, { v: layout.tvCL, why: "TV centreline" });
    ys.push({ v: layout.tvTop, why: "TV top" }, { v: layout.tvBottom, why: "TV bottom" }, { v: layout.centerH, why: "TV centre" });
    if (layout.box) {
      xs.push({ v: layout.box.cx - layout.box.w / 2, why: "box left" }, { v: layout.box.cx + layout.box.w / 2, why: "box right" });
      ys.push({ v: layout.box.btm, why: "box bottom" }, { v: layout.box.aff + layout.box.h / 2, why: "box top" });
    }
    if (layout.outlet) ys.push({ v: layout.outlet.aff, why: "outlet" });
  }
  return { xs, ys };
};

const nearest = (list, v, tol) => {
  let best = null;
  list.forEach(a => {
    const d = Math.abs(a.v - v);
    if (d <= tol && (!best || d < best.d)) best = { ...a, d };
  });
  return best;
};

// Returns { x, y, hitX, hitY } — the hits drive the on-screen "why did it jump"
// guides. `other` is the far end of a 2-point shape, used for the ortho lock.
const snapPoint = (q, anchors, tol, other) => {
  const hx = nearest(anchors.xs, q.x, tol);
  const hy = nearest(anchors.ys, q.y, tol);
  let x = hx ? hx.v : q.x, y = hy ? hy.v : q.y;
  let orthoX = null, orthoY = null;
  if (other) {
    if (!hy && Math.abs(y - other.y) <= tol) { y = other.y; orthoY = true; }
    if (!hx && Math.abs(x - other.x) <= tol) { x = other.x; orthoX = true; }
  }
  return { x, y, hitX: hx, hitY: hy, orthoX, orthoY };
};

const translateMarkup = (m, dx, dy) => ({ ...m, pts: m.pts.map(p => ({ x: p.x + dx, y: p.y + dy })) });

// Where a measure's label sits: offset along the line's NORMAL so it never
// lands on its own shaft. A vertical measure used to centre the text on the
// line and read as struck through.
const measureLabelPos = (x1, y1, x2, y2, off = 13) => {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return { x: (x1 + x2) / 2 + Math.cos(ang - Math.PI / 2) * off,
           y: (y1 + y2) / 2 + Math.sin(ang - Math.PI / 2) * off };
};

const markupSpan = (m) => {
  const p = m && m.pts;
  if (!p || p.length < 2) return 0;
  return Math.hypot(p[p.length - 1].x - p[0].x, p[p.length - 1].y - p[0].y);
};

// --- offline bitmap store ------------------------------------------------
// A rendered page is 1-3 MB; localStorage (already holding the design) caps at
// ~5 MB, so the bitmap goes to IndexedDB and only its calibration rides along
// in the design JSON.
const IDB_NAME = "tellavision";
const IDB_STORE = "underlay";
const idbOpen = () => new Promise((res, rej) => {
  if (typeof indexedDB === "undefined") return rej(new Error("no indexedDB"));
  const rq = indexedDB.open(IDB_NAME, 1);
  rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains(IDB_STORE)) rq.result.createObjectStore(IDB_STORE); };
  rq.onsuccess = () => res(rq.result);
  rq.onerror = () => rej(rq.error);
});
const idbSet = async (key, val) => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
};
const idbGet = async (key) => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
};
const idbDel = async (key) => {
  const db = await idbOpen();
  return new Promise((res) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
};

// --- PDF rasterisation ---------------------------------------------------
// pdf.js is injected on first import only, so users who never import a drawing
// pay nothing. The service worker pre-caches it alongside React.
let pdfjsPromise = null;
const loadPdfJs = () => {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PDFJS_SRC;
    s.onload = () => {
      if (!window.pdfjsLib) return rej(new Error("pdf.js loaded but did not register"));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      res(window.pdfjsLib);
    };
    s.onerror = () => { pdfjsPromise = null; rej(new Error("Could not load the PDF engine — connect once to cache it for offline use")); };
    document.head.appendChild(s);
  });
  return pdfjsPromise;
};

// Render one page to a capped-resolution JPEG. Returns { src, natW, natH, pages }.
const rasterizePdfPage = async (arrayBuf, pageNum = 1) => {
  const pdfjsLib = await loadPdfJs();
  const doc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
  const pages = doc.numPages;
  const page = await doc.getPage(Math.min(Math.max(pageNum, 1), pages));
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(UNDERLAY_MAX_PX / Math.max(base.width, base.height), 4);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { src: canvas.toDataURL("image/jpeg", UNDERLAY_JPEG_Q), natW: canvas.width, natH: canvas.height, pages };
};

// Images (a phone photo of a printed elevation, or a screenshot) take the same
// path — downscaled to the same cap so storage behaves identically.
const rasterizeImageFile = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onerror = () => rej(new Error("Could not read that image"));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => rej(new Error("Could not decode that image"));
    img.onload = () => {
      const k = Math.min(1, UNDERLAY_MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(Math.round(img.width * k), 1);
      canvas.height = Math.max(Math.round(img.height * k), 1);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      res({ src: canvas.toDataURL("image/jpeg", UNDERLAY_JPEG_Q), natW: canvas.width, natH: canvas.height, pages: 1 });
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

// --- persistence ---
const STORAGE_KEY = "tellavision-v1";
const LEGACY_STORAGE_KEY = "tv-wall-planner-v1"; // pre-rename designs migrate on load
const loadSaved = () => {
  try {
    if (typeof window === "undefined") return {};
    return JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_STORAGE_KEY) || "{}"
    ) || {};
  } catch {
    return {};
  }
};
const SAVED = loadSaved();
const SAVED_BRAND = BRANDS.includes(SAVED.brand) ? SAVED.brand : "Sony";
const SAVED_SIZE = TV_CATALOG[SAVED_BRAND].includes(SAVED.selectedSize) ? SAVED.selectedSize : null;

// --- JSON interop --------------------------------------------------------
// Export carries both the editable design AND the computed numbers so
// downstream apps can consume results without reimplementing the engine.
const buildExportJSON = (design, layout) => ({
  app: "tellavision",
  appName: "TellaVision",
  legacyApp: "tv-wall-planner", // imports accept either id
  schema: 1,
  exportedAt: new Date().toISOString(),
  design,
  computed: layout ? {
    tvWidthIn: layout.tvW, tvHeightIn: layout.tvH,
    tvCenterlineFromLeftIn: layout.tvCL,
    centerAFFIn: layout.centerH, bottomAFFIn: layout.tvBottom, topAFFIn: layout.tvTop,
    vesa: layout.vesa ? { w_mm: layout.vesa.spec.w_mm, h_mm: layout.vesa.spec.h_mm, screw: layout.vesa.spec.screw, centerAFFIn: layout.vesa.aff } : null,
    backBox: layout.box ? { model: layout.box.model, label: layout.box.label, brand: layout.box.brand, bracket: layout.box.bracket, centerFromLeftIn: layout.box.cx, centerAFFIn: layout.box.aff, bottomAFFIn: layout.box.btm } : null,
    mount: layout.mount ? (layout.mount.system === "fa" ? { system: "fa" } : { system: "sanus", model: layout.mount.model, depthIn: layout.mount.depth, extensionIn: layout.mount.ext, capacityLbs: layout.mount.capLbs }) : null,
    outlet: layout.outlet ? { fromLeftIn: layout.outlet.x, AFFIn: layout.outlet.aff } : null,
    lowVoltage: layout.lv ? { fromLeftIn: layout.lv.x, AFFIn: layout.lv.aff } : null,
  } : null,
});

// --- DXF export (Visio / AutoCAD / Bluebeam) ------------------------------
// R12 ASCII DXF: the most universally importable CAD format. Geometry is at
// TRUE SCALE in inches — origin at the left wall edge on the floor, Y up —
// which is exactly the engine's coordinate system (X from left, AFF up).
const DXF_LAYERS = [
  ["WALL", 7], ["FIREPLACE", 8], ["TV", 7], ["SCREEN", 8], ["VESA", 2],
  ["MOUNT", 8], ["BACKBOX", 4], ["ELECTRICAL", 3], ["LOWVOLT", 30],
  ["DIMENSIONS", 7], ["CENTERLINE", 1], ["TAPEOUT", 5], ["NOTES", 7], ["MARKUP", 1],
];

const buildDXF = (S, layout) => {
  if (!layout) return null;
  const fmt = (v) => fmtIn(v, S.dispUnits);
  const out = [];
  const P = (code, val) => { out.push(String(code)); out.push(String(val)); };
  const esc = (s) => String(s).replace(/×/g, "x").replace(/[—–]/g, "-").replace(/[^\x20-\x7E]/g, "");
  const est = (s, h) => String(s).length * h * 0.8; // rough text width
  const line = (layer, x1, y1, x2, y2) => { P(0, "LINE"); P(8, layer); P(10, x1.toFixed(4)); P(20, y1.toFixed(4)); P(30, "0.0"); P(11, x2.toFixed(4)); P(21, y2.toFixed(4)); P(31, "0.0"); };
  const rect = (layer, x, y, w, h) => { line(layer, x, y, x + w, y); line(layer, x + w, y, x + w, y + h); line(layer, x + w, y + h, x, y + h); line(layer, x, y + h, x, y); };
  const circle = (layer, cx, cy, r) => { P(0, "CIRCLE"); P(8, layer); P(10, cx.toFixed(4)); P(20, cy.toFixed(4)); P(30, "0.0"); P(40, r.toFixed(4)); };
  const text = (layer, x, y, h, s) => { P(0, "TEXT"); P(8, layer); P(10, x.toFixed(4)); P(20, y.toFixed(4)); P(30, "0.0"); P(40, h.toFixed(4)); P(1, esc(s)); };
  const textC = (layer, cx, y, h, s) => text(layer, cx - est(s, h) / 2, y, h, s);
  const textR = (layer, xRight, y, h, s) => text(layer, xRight - est(s, h), y, h, s);
  // dash-dot centerline drawn as real segments (no linetype dependencies)
  const dashDot = (layer, x, y1, y2) => {
    let y = y1;
    while (y < y2) {
      const d1 = Math.min(2.5, y2 - y); line(layer, x, y, x, y + d1); y += d1 + 0.8;
      if (y >= y2) break;
      const d2 = Math.min(0.4, y2 - y); line(layer, x, y, x, y + d2); y += d2 + 0.8;
    }
  };

  // ---- file skeleton ----
  P(0, "SECTION"); P(2, "HEADER"); P(9, "$ACADVER"); P(1, "AC1009"); P(0, "ENDSEC");
  P(0, "SECTION"); P(2, "TABLES");
  P(0, "TABLE"); P(2, "LTYPE"); P(70, 1);
  P(0, "LTYPE"); P(2, "CONTINUOUS"); P(70, 0); P(3, "Solid line"); P(72, 65); P(73, 0); P(40, "0.0");
  P(0, "ENDTAB");
  P(0, "TABLE"); P(2, "LAYER"); P(70, DXF_LAYERS.length);
  DXF_LAYERS.forEach(([name, color]) => { P(0, "LAYER"); P(2, name); P(70, 0); P(62, color); P(6, "CONTINUOUS"); });
  P(0, "ENDTAB");
  P(0, "ENDSEC");
  P(0, "SECTION"); P(2, "ENTITIES");

  const { wallW, wallH } = S;

  // wall + floor + hatch ticks
  rect("WALL", 0, 0, wallW, wallH);
  line("WALL", -6, 0, wallW + 6, 0);
  for (let i = 0; i <= 12; i++) {
    const x = -5 + i * ((wallW + 10) / 12);
    line("WALL", x, 0, x - 1.5, -1.5);
  }

  // fireplace
  if (S.hasFireplace) {
    const fbLeft = wallW / 2 + S.fbOffsetIn - S.fbOpeningW / 2;
    rect("FIREPLACE", fbLeft, 0, S.fbOpeningW, S.fbOpeningH);
    if (S.fbOpeningW > 4 && S.fbOpeningH > 4) rect("FIREPLACE", fbLeft + 1.5, 1.5, S.fbOpeningW - 3, S.fbOpeningH - 3);
    if (S.hasMantel) rect("FIREPLACE", fbLeft - 12, S.mantelH - S.mantelDepth, S.fbOpeningW + 24, S.mantelDepth);
  }

  // TV
  rect("TV", layout.tvLeft, layout.tvBottom, layout.tvW, layout.tvH);
  rect("SCREEN", layout.tvLeft + 0.8, layout.tvBottom + 0.8, layout.tvW - 1.6, layout.tvH - 1.6);
  text("TV", layout.tvLeft + 1.5, layout.tvTop - 3.2, 1.6, `${S.brand.toUpperCase()} ${S.selectedSize}"`);

  // VESA + mount
  if (layout.vesa) {
    if (S.showVesa) {
      const v = layout.vesa;
      rect("VESA", layout.tvCL - v.w / 2, v.aff - v.h / 2, v.w, v.h);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) =>
        circle("VESA", layout.tvCL + sx * v.w / 2, v.aff + sy * v.h / 2, 0.25));
    }
    const mw = layout.mount?.system === "sanus" ? layout.mount.plateW : layout.vesa.w + (layout.mount?.system === "fa" ? 3 : 2);
    const mh = layout.mount?.system === "sanus" ? layout.mount.plateH : (layout.mount?.system === "fa" ? layout.vesa.h + 2 : 3.5);
    rect("MOUNT", layout.tvCL - mw / 2, layout.vesa.aff - mh / 2, mw, mh);
  }

  // back box
  if (layout.box) rect("BACKBOX", layout.box.cx - layout.box.w / 2, layout.box.aff - layout.box.h / 2, layout.box.w, layout.box.h);

  // electrical
  if (S.showOutlet) {
    rect("ELECTRICAL", layout.outlet.x - 2, layout.outlet.aff - 2, 4, 4);
    circle("ELECTRICAL", layout.outlet.x - 0.8, layout.outlet.aff, 0.35);
    circle("ELECTRICAL", layout.outlet.x + 0.8, layout.outlet.aff, 0.35);
  }
  if (S.showLowVolt) {
    rect("LOWVOLT", layout.lv.x - 2, layout.lv.aff - 2, 4, 4);
    text("LOWVOLT", layout.lv.x - 1.1, layout.lv.aff - 0.6, 1.2, "LV");
  }

  // ---- dimensions (lines + ticks + text, true scale) ----
  const refAFF = S.heightRef === "bottom" ? layout.tvBottom : layout.centerH;
  const refLabel = S.heightRef === "bottom" ? "TO TV BOTTOM" : "TO TV CENTER";
  line("DIMENSIONS", -6, 0, -6, refAFF);
  line("DIMENSIONS", -7, 0, -5, 0);
  line("DIMENSIONS", -7, refAFF, -5, refAFF);
  textR("DIMENSIONS", -8, refAFF / 2, 2.5, fmt(refAFF));
  textR("DIMENSIONS", -8, refAFF / 2 - 3.4, 1.2, refLabel);
  line("CENTERLINE", layout.tvLeft - 3, refAFF, layout.tvLeft, refAFF);
  line("CENTERLINE", layout.tvRight, refAFF, layout.tvRight + 3, refAFF);

  line("DIMENSIONS", layout.tvLeft, layout.tvTop + 4, layout.tvRight, layout.tvTop + 4);
  line("DIMENSIONS", layout.tvLeft, layout.tvTop + 3, layout.tvLeft, layout.tvTop + 5);
  line("DIMENSIONS", layout.tvRight, layout.tvTop + 3, layout.tvRight, layout.tvTop + 5);
  textC("DIMENSIONS", layout.tvCL, layout.tvTop + 5.5, 2.2, `${fmt(layout.tvW)} W`);

  dashDot("CENTERLINE", layout.tvCL, layout.tvTop + 2, wallH);
  line("CENTERLINE", 0, wallH + 5, layout.tvCL, wallH + 5);
  line("CENTERLINE", 0, wallH + 4, 0, wallH + 6);
  line("CENTERLINE", layout.tvCL, wallH + 4, layout.tvCL, wallH + 6);
  textC("CENTERLINE", layout.tvCL / 2, wallH + 6.5, 2.2, `${fmt(layout.tvCL)} TO TV CL`);

  line("DIMENSIONS", 0, -8, wallW, -8);
  line("DIMENSIONS", 0, -9, 0, -7);
  line("DIMENSIONS", wallW, -9, wallW, -7);
  textC("DIMENSIONS", wallW / 2, -12.5, 2.5, `${fmt(wallW)} WALL`);

  line("DIMENSIONS", wallW + 6, 0, wallW + 6, wallH);
  line("DIMENSIONS", wallW + 5, 0, wallW + 7, 0);
  line("DIMENSIONS", wallW + 5, wallH, wallW + 7, wallH);
  text("DIMENSIONS", wallW + 8, wallH / 2, 2.5, `${fmt(wallH)} H`);

  // ---- tape-out lines (where the installer snaps tape on the real wall) ----
  if (S.showTapeOut) {
    line("TAPEOUT", 0, layout.tvTop, wallW, layout.tvTop);
    line("TAPEOUT", 0, layout.tvBottom, wallW, layout.tvBottom);
    line("TAPEOUT", layout.tvLeft, 0, layout.tvLeft, layout.tvTop);
    line("TAPEOUT", layout.tvRight, 0, layout.tvRight, layout.tvTop);
    text("TAPEOUT", 1, layout.tvTop + 0.8, 1.6, `TAPE TOP ${fmt(layout.tvTop)} AFF`);
    text("TAPEOUT", 1, layout.tvBottom + 0.8, 1.6, `TAPE BTM ${fmt(layout.tvBottom)} AFF`);
    text("TAPEOUT", layout.tvLeft + 0.8, 2, 1.6, `${fmt(layout.tvLeft)}`);
    text("TAPEOUT", layout.tvRight + 0.8, 2, 1.6, `${fmt(layout.tvRight)}`);
  }

  // ---- notes column (true data, right of the wall) ----
  const nx = wallW + 24;
  let ny = wallH - 2;
  const note = (s, h = 1.8) => { text("NOTES", nx, ny, h, s); ny -= h + 2.2; };
  note(`${S.brand.toUpperCase()} ${S.selectedSize}" - FRONT ELEVATION`, 2.2);
  note(`TV: ${fmt(layout.tvW)} W x ${fmt(layout.tvH)} H`);
  note(`CENTER ${fmt(layout.centerH)} AFF / BOTTOM ${fmt(layout.tvBottom)} AFF`);
  note(`TV CL: ${fmt(layout.tvCL)} FROM LEFT WALL EDGE`);
  if (layout.vesa) note(`VESA ${layout.vesa.spec.w_mm}x${layout.vesa.spec.h_mm} MM - ${layout.vesa.spec.screw} SCREWS`);
  if (layout.box) note(`BOX: ${layout.box.brand} ${layout.box.label} (${layout.box.w}x${layout.box.h}x${layout.box.d} IN)`);
  if (S.showBoxDims && layout.box) note(`BOX BTM: ${fmt(layout.box.btm)} AFF (${fmt(Math.abs(layout.box.btm - layout.tvBottom))} ${layout.box.btm >= layout.tvBottom ? "ABV" : "BLW"} TV BTM)`);
  if (S.showOutlet) note(`PWR: ${fmt(layout.outlet.aff)} AFF, ${fmt(Math.abs(layout.outlet.x - layout.tvCL))} ${layout.outlet.x < layout.tvCL ? "LT" : "RT"} OF CL`);
  if (S.showLowVolt) note(`LV: ${fmt(layout.lv.aff)} AFF, ${fmt(Math.abs(layout.lv.x - layout.tvCL))} ${layout.lv.x < layout.tvCL ? "LT" : "RT"} OF CL`);
  note(`MOUNT: ${layout.mount ? (layout.mount.system === "fa" ? "FUTURE AUTOMATION ARTICULATING" : `SANUS ${layout.mount.model} - DEPTH ${fmt(layout.mount.depth)}${layout.mount.ext ? ` / EXT ${fmt(layout.mount.ext)}` : ""}`) : "TBD"}`);

  // ---- title block ----
  const title = [S.projectName, S.clientName].filter(Boolean).join(" - ");
  if (title) text("NOTES", 0, -18, 2, title.toUpperCase());
  text("NOTES", 0, -22, 1.5, `REV ${S.revision || "01"} - UNITS: INCHES - NOT TO SCALE, DIMENSIONS GOVERN`);

  P(0, "ENDSEC");
  P(0, "EOF");
  // Hand markup rides along on its own layer at true scale. The raster
  // underlay has no DXF equivalent, so it is deliberately left behind.
  (S.markup || []).forEach((m) => {
    const pts = m && m.pts;
    if (!pts || !pts.length) return;
    const a = pts[0], b = pts[pts.length - 1];
    if (m.type === "pen") {
      for (let i = 1; i < pts.length; i++) line("MARKUP", pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    } else if (m.type === "rect") {
      rect("MARKUP", Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (m.type === "text") {
      text("MARKUP", a.x, a.y, 2, m.text || "");
    } else if (m.type === "measure") {
      line("MARKUP", a.x, a.y, b.x, b.y);
      text("MARKUP", (a.x + b.x) / 2, (a.y + b.y) / 2 + 1, 2, fmt(Math.hypot(b.x - a.x, b.y - a.y)));
    } else {
      line("MARKUP", a.x, a.y, b.x, b.y);   // line + arrow share the shaft
    }
  });

  return out.join("\r\n");
};

// ---------------------------------------------------------------------------
// Data screen schemas. One entry per catalog table describes its shape, its
// columns and its rules, and a single generic grid renders all of them — so
// adding a table later is a schema entry, not a new screen.
//
// kind:
//   record   key -> flat object            (BACK_BOXES, SANUS_MOUNTS)
//   list     key -> array of numbers       (TV_CATALOG, SANUS_STYLE_ORDER)
//   nested2  key -> key2 -> flat object    (VESA_DATA, TV_OVERRIDES)
//   scalars  single flat object            (CLEARANCE, FORMULA)
const N = (k, label, unit, opt) => ({ k, label, t: "num", unit, ...(opt || {}) });
const S_ = (k, label, opt) => ({ k, label, t: "text", ...(opt || {}) });

const TABLE_SCHEMAS = [
  {
    id: "BACK_BOXES", title: "Back Boxes", kind: "record", keyLabel: "SKU",
    hint: "Future Automation WB dimensions verified 2026-08-19 from manufacturer tech sheets. Width is the horizontal dimension in the wall — non-2S boxes are portrait so they pass between studs.",
    cols: [
      S_("brand", "Brand"), S_("label", "Label"), S_("line", "Line"),
      N("w", "Width", "in"), N("h", "Height", "in"), N("d", "Depth", "in"),
      S_("bracket", "Bracket"),
      { k: "studs", label: "Framing", t: "enum", options: ["single", "twin", "multi"] },
      N("tvMin", "TV min", "in"), N("tvMax", "TV max", "in"),
    ],
    blank: { brand: "Custom", label: "New box", line: "", w: 14, h: 14, d: 3.8, bracket: "", studs: "single", tvMin: 40, tvMax: 65 },
    validate: (row, key, all) => {
      const e = [];
      ["w", "h", "d"].forEach(k => { if (!(row[k] > 0)) e.push([k, "must be greater than 0"]); });
      if (!(row.tvMax > row.tvMin)) e.push(["tvMax", "must exceed TV min"]);
      const clear = STUD_CLEAR[row.studs];
      if (clear && row.w > clear) e.push(["w", `${row.w}" will not fit ${row.studs} framing (${clear}" clear)`]);
      if (/-2S$/.test(key)) {
        const base = all[key.replace(/-2S$/, "")];
        if (base && !(row.w > base.w)) e.push(["w", "a twin-stud box must be wider than its single-stud sibling"]);
      }
      return e;
    },
  },
  {
    id: "SANUS_MOUNTS", title: "Mounts", kind: "record", keyLabel: "SKU",
    hint: "Sanus Black Series custom-install mounts, verified 2026-08-20 against SANUS Black Series literature. A panel's VESA pattern must fall INSIDE the min–max range — below the minimum it will not bolt up without an adapter.",
    cols: [
      S_("model", "Model"), S_("name", "Name"),
      { k: "style", label: "Style", t: "enum", options: ["fixed", "tilt", "fullmotion"] },
      N("tvMin", "TV min", "in"), N("tvMax", "TV max", "in"), N("capLbs", "Capacity", "lb"),
      N("vesaMinW", "VESA min W", "mm"), N("vesaMinH", "VESA min H", "mm"),
      N("vesaMaxW", "VESA max W", "mm"), N("vesaMaxH", "VESA max H", "mm"),
      N("plateW", "Plate W", "in"), N("plateH", "Plate H", "in"),
      N("depth", "Depth", "in"), N("ext", "Extension", "in"), N("list", "List", "$"),
    ],
    blank: { model: "NEW-1", name: "Custom mount", style: "fixed", tvMin: 40, tvMax: 85, capLbs: 150, vesaMinW: 200, vesaMinH: 200, vesaMaxW: 600, vesaMaxH: 400, plateW: 30, plateH: 18, depth: 1.5, ext: null, list: 0 },
    validate: (row) => {
      const e = [];
      if (!(row.tvMax > row.tvMin)) e.push(["tvMax", "must exceed TV min"]);
      if (!(row.capLbs > 0)) e.push(["capLbs", "must be greater than 0"]);
      ["vesaMaxW", "vesaMaxH", "plateW", "plateH"].forEach(k => { if (!(row[k] > 0)) e.push([k, "must be greater than 0"]); });
      if (row.vesaMinW > row.vesaMaxW) e.push(["vesaMinW", "minimum pattern exceeds the maximum"]);
      if (row.vesaMinH > row.vesaMaxH) e.push(["vesaMinH", "minimum pattern exceeds the maximum"]);
      return e;
    },
  },
  {
    id: "VESA_DATA", title: "VESA Patterns", kind: "nested2", keyLabel: "Brand", key2Label: "Size",
    hint: "Mounting pattern per brand and screen size. voffset_pct biases the pattern up or down from the panel centre (OLEDs often sit low).",
    cols: [N("w_mm", "Pattern W", "mm"), N("h_mm", "Pattern H", "mm"), S_("screw", "Screw"), N("voffset_pct", "V offset", "%"), S_("note", "Note")],
    blank: { w_mm: 400, h_mm: 400, screw: "M8", voffset_pct: 0 },
    validate: (row) => {
      const e = [];
      if (!(row.w_mm > 0)) e.push(["w_mm", "must be greater than 0"]);
      if (!(row.h_mm > 0)) e.push(["h_mm", "must be greater than 0"]);
      if (!row.screw) e.push(["screw", "required"]);
      if (Math.abs(row.voffset_pct || 0) > 25) e.push(["voffset_pct", "beyond +/-25% looks wrong"]);
      return e;
    },
  },
  {
    id: "TV_OVERRIDES", title: "Exact Panels", kind: "nested2", keyLabel: "Brand", key2Label: "Size",
    hint: "Real spec-sheet panel dimensions (no stand). When present these REPLACE the 16:9 formula everywhere, and weight feeds the mount capacity check.",
    cols: [N("w", "Panel W", "in"), N("h", "Panel H", "in"), N("d", "Depth", "in"), N("weightLbs", "Weight", "lb"), S_("model", "Model")],
    blank: { w: 0, h: 0, d: 1.5, weightLbs: 0, model: "" },
    validate: (row) => {
      const e = [];
      if (!(row.w > 0)) e.push(["w", "must be greater than 0"]);
      if (!(row.h > 0)) e.push(["h", "must be greater than 0"]);
      if (row.w && row.h && (row.w / row.h < 1.2 || row.w / row.h > 2.6)) e.push(["h", "aspect ratio looks wrong"]);
      return e;
    },
  },
  {
    id: "TV_CATALOG", title: "TV Sizes", kind: "list", keyLabel: "Brand",
    hint: "Screen sizes offered per brand, in inches. Comma separated.",
    validate: (arr) => {
      const e = [];
      if (!arr.length) e.push(["list", "at least one size required"]);
      if (arr.some(v => !(v > 0))) e.push(["list", "sizes must be positive numbers"]);
      if (new Set(arr).size !== arr.length) e.push(["list", "duplicate sizes"]);
      return e;
    },
  },
  {
    id: "SANUS_STYLE_ORDER", title: "Mount Ladder", kind: "list", keyLabel: "Style", text: true,
    hint: "Preference order the recommender walks for each style — cheapest acceptable first. Values are mount SKUs.",
    validate: (arr, key, all, ctx) => {
      const e = [];
      arr.forEach(k => { if (!ctx.SANUS_MOUNTS[k]) e.push(["list", `unknown mount SKU: ${k}`]); });
      return e;
    },
  },
  {
    id: "CLEARANCE", title: "Clearances", kind: "scalars",
    hint: "Vertical gap held above a fireplace or mantel, in inches.",
    cols: [N("mantel", "Above mantel", "in"), N("noMantel", "Above firebox", "in")],
    validate: (row) => Object.entries(row).filter(([, v]) => !(v > 0)).map(([k]) => [k, "must be greater than 0"]),
  },
  {
    id: "FORMULA", title: "Size Formula", kind: "scalars",
    hint: "16:9 panel estimate used when no exact panel is listed: width = size x wCoef + bezel. Defaults are 16/sqrt(337) and 9/sqrt(337). Changing these shifts EVERY drawing that has no exact-panel entry.",
    cols: [N("wCoef", "Width coefficient"), N("hCoef", "Height coefficient"), N("bezel", "Bezel allowance", "in")],
    validate: (row) => {
      const e = [];
      if (!(row.wCoef > 0.5 && row.wCoef < 1.2)) e.push(["wCoef", "expected roughly 0.87"]);
      if (!(row.hCoef > 0.3 && row.hCoef < 0.8)) e.push(["hCoef", "expected roughly 0.49"]);
      if (!(row.bezel >= 0 && row.bezel < 6)) e.push(["bezel", "expected 0-6 inches"]);
      return e;
    },
  },
];

// Run a table's rules across the EFFECTIVE catalog. Returns { key: [[col,msg]] }.
const validateTable = (schema, table, ctx) => {
  const out = {};
  if (schema.kind === "scalars") {
    const e = schema.validate ? schema.validate(table) : [];
    if (e.length) out.__scalars = e;
    return out;
  }
  Object.entries(table).forEach(([key, val]) => {
    if (schema.kind === "nested2") {
      Object.entries(val).forEach(([k2, row]) => {
        const e = schema.validate ? schema.validate(row, k2, val, ctx) : [];
        if (e.length) out[`${key}\u0000${k2}`] = e;
      });
    } else {
      const e = schema.validate ? schema.validate(val, key, table, ctx) : [];
      if (e.length) out[key] = e;
    }
  });
  return out;
};

const normKey = (k) => String(k).toLowerCase().replace(/[\s_-]/g, "");

// Pull TV-relevant fields out of ANY JSON — our own exports, the job-walk
// app, whatever — and ignore everything else. Deep-walks nested objects and
// arrays. Returns { fields, matched, ignored, notes, native }.
const extractImportedDesign = (data) => {
  const out = { fields: {}, matched: [], ignored: 0, notes: [], native: false };
  if (!data || typeof data !== "object") { out.notes.push("Not a JSON object"); return out; }

  if ((data.app === "tellavision" || data.app === "tv-wall-planner") && data.design && typeof data.design === "object") {
    out.fields = { ...data.design };
    out.matched.push("native tv-wall-planner design");
    out.native = true;
    return out;
  }

  const set = (key, val, label) => {
    if (out.fields[key] === undefined) {
      out.fields[key] = val;
      if (label) out.matched.push(label);
    }
  };
  const brandFrom = (s) => BRANDS.find(b => new RegExp(`\\b${b}\\b`, "i").test(String(s)));

  const visit = (node, key, parentK) => {
    const k = normKey(key || "");
    if (node === null || node === undefined) { out.ignored++; return; }
    if (Array.isArray(node)) { node.forEach(v => visit(v, key, parentK)); return; }
    if (typeof node === "object") {
      if (k.includes("fireplace")) set("hasFireplace", true, "fireplace section");
      if (k.includes("mantel")) { set("hasMantel", true, "mantel section"); set("hasFireplace", true); }
      Object.entries(node).forEach(([ck, cv]) => visit(cv, ck, k));
      return;
    }
    const pk = parentK || "";
    const num = typeof node === "number" ? node
      : (typeof node === "string" && /^-?\d+(\.\d+)?$/.test(node.trim()) ? parseFloat(node) : null);
    const str = typeof node === "string" ? node : null;
    const isTVCtx = pk.includes("tv") || pk.includes("display") || pk.includes("television") || pk.includes("screen");

    if ((/^(tvsize|screensize|tvdiagonal|diagonal|panelsize)$/.test(k) || (isTVCtx && /^(size|diag(onal)?|inches)$/.test(k))) && num != null && num >= 18 && num <= 130) {
      set("selectedSize", num, `TV size ${num}"`);
    } else if (/(brand|make|manufacturer)/.test(k) && str && brandFrom(str)) {
      set("brand", brandFrom(str), `brand ${brandFrom(str)}`);
    } else if (isTVCtx && /^(model|name|label|description)$/.test(k) && str) {
      const b = brandFrom(str);
      if (b) set("brand", b, `brand ${b} (from "${str.slice(0, 30)}")`);
      const m = str.match(/(\d{2,3})\s*("|in\b|inch|”)/i) || str.match(/\b(\d{2,3})\b/);
      if (m && +m[1] >= 18 && +m[1] <= 130) set("selectedSize", +m[1], `TV size ${m[1]}" (from "${str.slice(0, 30)}")`);
    } else if ((/^(wallwidth|wallw)$/.test(k) || (pk.includes("wall") && /^(width|w)$/.test(k))) && num != null && num >= 24 && num <= 600) {
      set("wallW", num, `wall width ${num}"`);
    } else if ((/^(wallheight|wallh)$/.test(k) || (pk.includes("wall") && /^(height|h)$/.test(k))) && num != null && num >= 24 && num <= 300) {
      set("wallH", num, `wall height ${num}"`);
    } else if (/^(hasfireplace|fireplace)$/.test(k) && typeof node === "boolean") {
      if (node) set("hasFireplace", true, "fireplace: yes"); else out.ignored++;
    } else if (pk.includes("fireplace") && /^(openingwidth|width|w)$/.test(k) && num != null && num > 10 && num < 200) {
      set("fbOpeningW", num, `firebox W ${num}"`);
    } else if (pk.includes("fireplace") && /^(openingheight|height|h)$/.test(k) && num != null && num > 10 && num < 100) {
      set("fbOpeningH", num, `firebox H ${num}"`);
    } else if (pk.includes("fireplace") && /offset/.test(k) && num != null && Math.abs(num) < 200) {
      set("fbOffsetX", String(num), `fireplace offset ${num}"`);
    } else if (((pk.includes("mantel") && /^(height|top|topheight)$/.test(k)) || /^(mantelheight|manteltop)/.test(k)) && num != null && num > 20 && num < 90) {
      set("mantelH", num, `mantel top ${num}"`); set("hasMantel", true); set("hasFireplace", true);
    } else if (/(mounttype|^mount$)/.test(k) && str) {
      if (/future.?automation|\bfa\b/i.test(str)) set("mountSystem", "fa", "mount: Future Automation");
      else if (/artic|motion|swivel/i.test(str)) { set("mountSystem", "sanus", "mount: full motion"); set("sanusStyle", "fullmotion"); }
      else if (/tilt/i.test(str)) { set("mountSystem", "sanus", "mount: tilt"); set("sanusStyle", "tilt"); }
      else if (/flat|fixed|low.?profile/i.test(str)) { set("mountSystem", "sanus", "mount: fixed"); set("sanusStyle", "fixed"); }
      else out.ignored++;
    } else if (/(viewingdistance|viewdist|seatingdistance|distancetoseating)/.test(k) && num != null && num >= 36 && num <= 480) {
      set("viewDist", num, `viewing distance ${num}"`);
    } else if ((/^(project|projectname|jobname|jobsite|address|site)$/.test(k) && str) || ((pk.includes("project") || pk.includes("job")) && /^name$/.test(k) && str)) {
      set("projectName", str.slice(0, 80), `project "${str.slice(0, 40)}"`);
    } else if ((/^(client|clientname|customer|customername|owner)$/.test(k) && str) || ((pk.includes("client") || pk.includes("customer")) && /^name$/.test(k) && str)) {
      set("clientName", str.slice(0, 80), `client "${str.slice(0, 40)}"`);
    } else if (/(mountheight|mountingheight|centerheight)/.test(k) && num != null && num >= 20 && num <= 120) {
      set("mountHeightOverride", String(num), `mount height ${num}" (to center)`); set("heightRef", "center");
    } else {
      out.ignored++;
    }
  };
  visit(data, "", "");
  return out;
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — SELF-TESTS
// Golden cases (hand-computed) + invariants swept over the full catalog.
// Runs on load; results feed the diagnostics panel. If this is red, do not
// trust the drawing.
// ═══════════════════════════════════════════════════════════════════════════

const approx = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

const runSelfTests = () => {
  const results = [];
  const T = (group, name, pass, detail = "") => results.push({ group, name, pass: !!pass, detail });

  // ---- Golden case A: Sony 65" flat, 120×108 wall, no fireplace ----
  {
    const inp = { selectedSize: 65, brand: "Sony", centerH: 42, tvCL: 60, showBackBox: true, effectiveBoxModel: "SM-RBX-PRO-14", mountSystem: "sanus", sanusMount: null };
    const L = computeLayout(inp);
    T("golden", "A: TV 57.9 × 33.1", approx(L.tvW, 57.88) && approx(L.tvH, 33.05), `w=${L.tvW.toFixed(2)} h=${L.tvH.toFixed(2)}`);
    T("golden", "A: VESA center 41.01\" AFF (−3% bias)", approx(L.vesa.aff, 41.0085), `aff=${L.vesa.aff.toFixed(3)}`);
    T("golden", "A: box center 76.03\" from left", approx(L.box.cx, 76.0305), `cx=${L.box.cx.toFixed(3)}`);   // 60 + 11.811/2 + 3 + 14.25/2
    T("golden", "A: PWR 36.86\" AFF, 12.47\" right of CL", approx(L.outlet.aff, 36.8635) && approx(L.outlet.x - L.tvCL, 12.468), `aff=${L.outlet.aff.toFixed(3)} dx=${(L.outlet.x - L.tvCL).toFixed(3)}`);   // 41.0085 - 13.29/2 + 2.5
    T("golden", "A: LV 19.59\" right of CL", approx(L.lv.x - L.tvCL, 19.593), `dx=${(L.lv.x - L.tvCL).toFixed(3)}`);   // cx + 14.25*0.25
    T("golden", "A: box within TV, not flagged", !L.box.extendsOff && !L.box.underRated);
    T("golden", "A: box bottom 34.36\" AFF, 8.89\" above TV bottom",
      approx(L.box.btm, 34.3635) && approx(L.box.btm - L.tvBottom, 8.8885),
      `btm=${L.box.btm.toFixed(3)} d=${(L.box.btm - L.tvBottom).toFixed(3)}`);
    T("golden", "A: tape-out edges L 31.06 / R 88.94 / T 58.53 / B 25.48",
      approx(L.tvLeft, 31.06) && approx(L.tvRight, 88.94) && approx(L.tvTop, 58.525) && approx(L.tvBottom, 25.475),
      `L=${L.tvLeft.toFixed(2)} R=${L.tvRight.toFixed(2)} T=${L.tvTop.toFixed(2)} B=${L.tvBottom.toFixed(2)}`);
  }
  // ---- Golden case B: "Smith Residence" — fireplace +15", mantel 54", bottom override 53.5 ----
  {
    const recommended = computeRecommendedCenterH({ selectedSize: 65, brand: "Sony", hasFireplace: true, hasMantel: true, mantelH: 54, fbOpeningH: 30, useViewDist: true, viewDist: 144 });
    T("golden", "B: recommended center 78.53\" (mantel 54 + 8 + h/2)", approx(recommended, 78.525), `rec=${recommended.toFixed(3)}`);
    const centerH = computeCenterH({ mountHeightOverride: "53.5", heightRef: "bottom", recommendedCenterH: recommended, selectedSize: 65, brand: "Sony" });
    T("golden", "B: override 53.5 bottom → center 70.03", approx(centerH, 70.025), `center=${centerH.toFixed(3)}`);
    const tvCL = computeTvCL({ wallW: 120, hasFireplace: true, fbOffsetIn: 15, tvOffsetIn: 0 });
    T("golden", "B: TV CL 75.0\" (follows fireplace)", approx(tvCL, 75));
    const L = computeLayout({ selectedSize: 65, brand: "Sony", centerH, tvCL, showBackBox: true, effectiveBoxModel: "SM-RBX-PRO-14", mountSystem: "sanus", sanusMount: null });
    T("golden", "B: PWR 64.89\" AFF, 12.47\" right of CL", approx(L.outlet.aff, 64.8885) && approx(L.outlet.x - tvCL, 12.468), `aff=${L.outlet.aff.toFixed(3)}`);   // 69.0335 - 13.29/2 + 2.5
  }
  // ---- Golden case C: LG 55" (−10% VESA bias, shallow box) ----
  {
    const L = computeLayout({ selectedSize: 55, brand: "LG", centerH: 42, tvCL: 60, showBackBox: true, effectiveBoxModel: "SM-RBX-PRO-8", mountSystem: "sanus", sanusMount: null });
    T("golden", "C: LG 55 VESA center 39.19\" AFF (−10%)", approx(L.vesa.aff, 39.185), `aff=${L.vesa.aff.toFixed(3)}`);
    T("golden", "C: outlet 37.54\" AFF in 8.29\"-tall box", approx(L.outlet.aff, 37.540), `aff=${L.outlet.aff.toFixed(3)}`);   // 39.185 - 8.29/2 + 2.5
  }
  // ---- Golden: back-box selector branches ----
  T("golden", "Samsung 85 Sanus → Pro XL (One Connect)", recommendBackBox(85, "sanus", "Samsung") === "SM-RBX-PRO-20");
  T("golden", "Sony 98 Sanus → Pro XL (>85 rule)", recommendBackBox(98, "sanus", "Sony") === "SM-RBX-PRO-20");
  T("golden", "Sony 100 articulating → WB80, flagged under-rated", (() => {
    const L = computeLayout({ selectedSize: 100, brand: "Sony", centerH: 50, tvCL: 60, showBackBox: true, effectiveBoxModel: recommendBackBox(100, "fa", "Sony"), mountSystem: "fa", sanusMount: null });
    return L.box.model === "FA-WB80" && L.box.underRated;
  })());
  // ---- Golden: spec-sheet panel overrides (115" RGB class) ----
  T("golden", "Samsung 115 Micro RGB exact dims 101.2 × 58.2", (() => {
    const d = tvDimsFor("Samsung", 115);
    return d.w === 101.2 && d.h === 58.2;
  })());
  T("golden", "Sony 115 BRAVIA 9 II exact dims 101.0 × 57.75, 235.3 lbs", (() => {
    const d = tvDimsFor("Sony", 115);
    return d.w === 101.0 && d.h === 57.75 && TV_OVERRIDES.Sony[115].weightLbs === 235.3;
  })());
  T("golden", "Samsung 115 VESA corrected to 1000×600 M8", VESA_DATA.Samsung[115].w_mm === 1000 && VESA_DATA.Samsung[115].h_mm === 600 && VESA_DATA.Samsung[115].screw === "M8");
  T("golden", "Sony 115 has NO VESA entry (spec sheet lacks it — never guess)", !VESA_DATA.Sony[115]);
  T("golden", "Layout uses exact dims: Samsung 115 @ center 50 → top 79.1", (() => {
    const L = computeLayout({ selectedSize: 115, brand: "Samsung", centerH: 50, tvCL: 75, showBackBox: true, effectiveBoxModel: "SM-RBX-PRO-20", mountSystem: "sanus", sanusMount: null });
    return approx(L.tvTop, 50 + 29.1) && approx(L.tvW, 101.2);
  })());
  T("invariant", "Every TV_OVERRIDES entry exists in the catalog", (() =>
    Object.entries(TV_OVERRIDES).every(([b, sizes]) => Object.keys(sizes).every(sz => TV_CATALOG[b]?.includes(+sz)))
  )());

  // ---- Golden: Sanus Black mount selection ----
  T("golden", "Sony 65 fixed → CILL1-B1", recommendSanusMount(65, "fixed", "Sony")?.model === "CILL1-B1");
  T("golden", "Samsung 85 full motion → CILF230-G1", recommendSanusMount(85, "fullmotion", "Samsung")?.model === "CILF230-G1");
  T("golden", "LG 97 fixed → falls back to CIXT1-B1 (XL tilt)", (() => {
    const m = recommendSanusMount(97, "fixed", "LG");
    return m?.model === "CIXT1-B1" && m.styleFallback === true;
  })());
  T("golden", "Samsung 115 → no Sanus Black mount (catalog max 110)", recommendSanusMount(115, "tilt", "Samsung") === null);
  T("golden", "Samsung 32 → no Sanus Black mount (catalog min 37)", recommendSanusMount(32, "fixed", "Samsung") === null);
  T("invariant", "Sanus selector: every pick fits size; null only outside 37–110", (() => {
    let ok = true;
    BRANDS.forEach(b => TV_CATALOG[b].forEach(sz => ["fixed", "tilt", "fullmotion"].forEach(st => {
      const m = recommendSanusMount(sz, st, b);
      if (m === null) { if (sz >= 37 && sz <= 110) ok = false; }
      else if (sz < m.tvMin || sz > m.tvMax) ok = false;
    })));
    return ok;
  })());

  // ---- Golden: recommendations (120×108 wall, Sony, 144" viewing) ----
  {
    const rec = computeRecommendations({ brand: "Sony", wallW: 120, wallH: 108, hasFireplace: false, hasMantel: true, mantelH: 54, fbOpeningH: 30, useViewDist: true, viewDist: 144 });
    T("golden", "Recommendations = [85, 77, 75, 65]", JSON.stringify(rec) === JSON.stringify([85, 77, 75, 65]), JSON.stringify(rec));
  }
  // ---- Golden: formatting ----
  T("format", `64.5 → 64-1/2"`, fmtIn(64.5, "frac") === `64-1/2"`, fmtIn(64.5, "frac"));
  T("format", `75 → 6'-3"`, fmtIn(75, "ftin") === `6'-3"`, fmtIn(75, "ftin"));
  T("format", `75.25 → 6'-3 1/4"`, fmtIn(75.25, "ftin") === `6'-3 1/4"`, fmtIn(75.25, "ftin"));
  T("format", `60 → 5'-0"`, fmtIn(60, "ftin") === `5'-0"`, fmtIn(60, "ftin"));
  T("format", `36.51 → 36.5" (dec)`, fmtIn(36.5085, "dec") === `36.5"`, fmtIn(36.5085, "dec"));
  T("format", `0.375 → 3/8"`, fmtIn(0.375, "frac") === `3/8"`, fmtIn(0.375, "frac"));
  T("format", `-2.5 → -2-1/2"`, fmtIn(-2.5, "frac") === `-2-1/2"`, fmtIn(-2.5, "frac"));

  // ---- JSON interop: the extractor pulls TV fields from foreign files ----
  // ---- back box data integrity ----
  // These pin the 2026-08-19 spec-sheet audit and deliberately run against the
  // SHIPPED baseline, not the effective catalog: a local override must never be
  // able to turn the app's health badge red. The same rules are re-run against
  // effective data inside the Data screen, where they surface as cell errors.
  T("studBay", "every FA box declares its stud requirement", (() => (
    Object.entries(BASE_BACK_BOXES).filter(([, b]) => b.brand === "Future Automation")
      .every(([, b]) => !!STUD_CLEAR[b.studs])
  ))());
  T("studBay", "no box is wider than the framing it claims to fit", (() => (
    Object.values(BASE_BACK_BOXES).filter(b => b.studs)
      .every(b => b.w <= STUD_CLEAR[b.studs])
  ))());
  T("studBay", "single-bay boxes physically fit between 16\" o.c. studs", (() => (
    Object.entries(BASE_BACK_BOXES).filter(([, b]) => b.studs === "single")
      .every(([, b]) => b.w <= STUD_CLEAR.single)
  ))());
  T("studBay", "twin-stud boxes fit the 30\" cut-out", (() => (
    Object.entries(BASE_BACK_BOXES).filter(([, b]) => b.studs === "twin")
      .every(([, b]) => b.w <= STUD_CLEAR.twin)
  ))());
  T("studBay", "a -2S variant is never identical to its single-stud sibling", (() => {
    const pairs = Object.keys(BASE_BACK_BOXES).filter(k => k.endsWith("-2S"))
      .map(k => [k, k.replace(/-2S$/, "")]).filter(([, base]) => BASE_BACK_BOXES[base]);
    if (!pairs.length) return false;
    return pairs.every(([tw, base]) => {
      const a = BASE_BACK_BOXES[tw], b = BASE_BACK_BOXES[base];
      return a.w !== b.w && a.w > b.w;   // twin stud exists to be WIDER
    });
  })());
  T("studBay", "single-bay WB boxes are taller than wide (portrait in the bay)", (() => (
    Object.entries(BASE_BACK_BOXES).filter(([, b]) => b.line === "WB" && b.studs === "single")
      .every(([, b]) => b.h > b.w)
  ))());
  T("studBay", "WB21 matches the published sheet (532 x 353 x 96.5mm)", (() => {
    const b = BASE_BACK_BOXES["FA-WB21"];
    return approx(b.w, 353 / 25.4, 0.05) && approx(b.h, 532 / 25.4, 0.05) && approx(b.d, 96.5 / 25.4, 0.05);
  })());
  T("studBay", "WB21-2S matches the install-guide cut-out (762 x 540mm)", (() => {
    const b = BASE_BACK_BOXES["FA-WB21-2S"];
    return approx(b.w, 760 / 25.4, 0.06) && approx(b.h, 537 / 25.4, 0.06);
  })());
  T("studBay", "every VersaBox fits one 16\" o.c. bay (all ~14.25 wide)", (() => (
    Object.entries(BASE_BACK_BOXES).filter(([, b]) => b.line && b.line.startsWith("VersaBox"))
      .every(([, b]) => b.w >= 13.9 && b.w <= STUD_CLEAR.single)
  ))());
  T("studBay", "VersaBox Pro XL is portrait, 14.25 x 20 (was stored transposed)", (() => {
    const b = BASE_BACK_BOXES["SM-RBX-PRO-20"];
    return approx(b.w, 14.25, 0.01) && approx(b.h, 20.0, 0.01) && b.h > b.w;
  })());
  T("studBay", "legacy SB-RBX-* keys still resolve to a real box", (() => (
    ["SB-RBX-8", "SB-RBX-14", "SB-RBX-PRO-8", "SB-RBX-PRO-14", "SB-RBX-PRO-XL"]
      .every(k => !!BASE_BACK_BOXES[canonBoxKey(k)])
  ))());
  T("studBay", "WB80 matches its stated WxHxD (1169 x 863 x 97mm)", (() => {
    const b = BASE_BACK_BOXES["FA-WB80"];
    return approx(b.w, 1169 / 25.4, 0.05) && approx(b.h, 863 / 25.4, 0.05) && approx(b.d, 97 / 25.4, 0.05);
  })());
  T("studBay", "every box carries a bracket and a sane size range", (() => (
    Object.values(BASE_BACK_BOXES).every(b => !!b.bracket && b.tvMin > 0 && b.tvMax > b.tvMin)
  ))());

  // ---- Sanus mount data (pins the 2026-08-20 spec-sheet audit) ----
  T("mounts", "every mount declares a VESA range, min <= max", (() => (
    Object.values(BASE_SANUS_MOUNTS).every(m =>
      m.vesaMinW > 0 && m.vesaMinH > 0 && m.vesaMinW <= m.vesaMaxW && m.vesaMinH <= m.vesaMaxH)
  ))());
  T("mounts", "a panel below the mount's minimum pattern is rejected", (() => {
    const cilt1 = BASE_SANUS_MOUNTS["S-CILT1"];               // published min 200x200
    const small = { w_mm: 100, h_mm: 100 };                   // e.g. Sony 42"
    const ok = { w_mm: 300, h_mm: 300 };
    const huge = { w_mm: 800, h_mm: 500 };
    return !vesaFitsMount(small, cilt1) && vesaFitsMount(ok, cilt1) && !vesaFitsMount(huge, cilt1);
  })());
  T("mounts", "the Sony 42 / CILT1 false positive is closed", (() => {
    const spec = VESA_DATA.Sony[42];
    return spec.w_mm === 100 && !vesaFitsMount(spec, BASE_SANUS_MOUNTS["S-CILT1"]) &&
           vesaFitsMount(spec, BASE_SANUS_MOUNTS["S-CILL2"]);   // CILL2 min is 100x100, so it does fit
  })());
  T("mounts", "CILT1 matches the published spec block", (() => {
    const m = BASE_SANUS_MOUNTS["S-CILT1"];
    return m.model === "CILT1-B1" && m.tvMin === 37 && m.tvMax === 95 && m.capLbs === 180 &&
           m.vesaMinW === 200 && m.vesaMaxW === 690 && m.vesaMaxH === 415 &&
           approx(m.depth, 2.2, 1e-9) && approx(m.plateW, 30, 1e-9) && approx(m.plateH, 17.53, 1e-9);
  })());
  T("mounts", "CILF230 matches the published spec block (and is the -G1 SKU)", (() => {
    const m = BASE_SANUS_MOUNTS["S-CILF230"];
    return m.model === "CILF230-G1" && m.tvMin === 46 && m.tvMax === 95 && m.capLbs === 175 &&
           m.vesaMaxW === 600 && m.vesaMaxH === 400 && approx(m.ext, 30, 1e-9) &&
           approx(m.plateW, 36.73, 1e-9) && approx(m.plateH, 22.03, 1e-9);
  })());
  T("mounts", "no unsourced swivel figures ship", (() => (
    Object.values(BASE_SANUS_MOUNTS).every(m => m.swivel == null)   // SANUS does not publish swivel for this line
  ))());
  T("mounts", "CIXT1 carries its extended footprint", (() => {
    const m = BASE_SANUS_MOUNTS["S-CIXT1"];
    return m.plateWMax > m.plateW && m.plateHMax > m.plateH &&
           approx(m.plateWMax, 52.93, 1e-9) && approx(m.plateHMax, 32.49, 1e-9);
  })());
  T("mounts", "every style ladder entry is a real mount of that style", (() => (
    Object.entries(BASE_SANUS_STYLE_ORDER).every(([style, keys]) =>
      keys.length > 0 && keys.every(k => BASE_SANUS_MOUNTS[k] && BASE_SANUS_MOUNTS[k].style === style))
  ))());

  // ---- reference underlay: calibration + markup ----
  const U0 = { natW: 1000, natH: 500, ...fitUnderlay(1000, 500, 120, 108) };
  T("underlay", "fit-to-wall lands inside the wall", (() => {
    const u = U0;
    return approx(underlayInW(u), 120, 0.01) && underlayInH(u) <= 108 + 0.01 &&
           approx(u.ox, 0, 0.01) && approx(u.oy, (108 + underlayInH(u)) / 2, 0.01);
  })());
  T("underlay", "two-point calibrate makes the picked span read true", (() => {
    // pick a span the fitted image thinks is 60" and declare it 96"
    const p1 = { x: 10, y: 40 }, p2 = { x: 70, y: 40 };
    const u = calibrateTwoPoint(U0, p1, p2, 96);
    if (!u) return false;
    // that span, re-measured in the new frame, must now be 96"
    const nat1 = (p1.x - U0.ox) * U0.ppi, nat2 = (p2.x - U0.ox) * U0.ppi;
    const in1 = u.ox + nat1 / u.ppi, in2 = u.ox + nat2 / u.ppi;
    return approx(in2 - in1, 96, 0.001);
  })());
  T("underlay", "calibration anchors on the first click (no jump)", (() => {
    const p1 = { x: 10, y: 40 }, p2 = { x: 70, y: 40 };
    const u = calibrateTwoPoint(U0, p1, p2, 96);
    const natX = (p1.x - U0.ox) * U0.ppi, natY = (U0.oy - p1.y) * U0.ppi;
    return approx(u.ox + natX / u.ppi, p1.x, 0.001) && approx(u.oy - natY / u.ppi, p1.y, 0.001);
  })());
  T("underlay", "rescale is reversible", (() => {
    const a = { x: 33, y: 44 };
    const back = rescaleUnderlay(rescaleUnderlay(U0, 2.5, a), 1 / 2.5, a);
    return approx(back.ppi, U0.ppi, 1e-6) && approx(back.ox, U0.ox, 1e-6) && approx(back.oy, U0.oy, 1e-6);
  })());
  T("underlay", "snap-to-TV scales from panel width and re-centres", (() => {
    // a 65" Sony is 57.9" wide; user boxes it 30" wide in the current frame
    const realW = tvDimsFor("Sony", 65).w;
    const target = { x: 60, y: 50 };
    const u = calibrateToBox(U0, { x1: 20, y1: 60, x2: 50, y2: 40 }, realW, target);
    if (!u) return false;
    const boxNat1 = (20 - U0.ox) * U0.ppi, boxNat2 = (50 - U0.ox) * U0.ppi;
    const w = (boxNat2 - boxNat1) / u.ppi;
    const cxNat = ((20 + 50) / 2 - U0.ox) * U0.ppi;
    return approx(w, realW, 0.001) && approx(u.ox + cxNat / u.ppi, target.x, 0.001);
  })());
  T("underlay", "degenerate picks are rejected, not applied", (() => {
    const same = calibrateTwoPoint(U0, { x: 5, y: 5 }, { x: 5, y: 5 }, 96);
    const zero = calibrateTwoPoint(U0, { x: 1, y: 1 }, { x: 9, y: 1 }, 0);
    return same === null && zero === null;
  })());
  T("underlay", `length parser: 96 / 8' / 8'6" / 6 1/2 / junk`, (() => (
    approx(parseLenIn("96"), 96) && approx(parseLenIn("8'"), 96) &&
    approx(parseLenIn(`8' 6"`), 102) && approx(parseLenIn("6 1/2"), 6.5) &&
    approx(parseLenIn(`96"`), 96) && isNaN(parseLenIn("abc")) && isNaN(parseLenIn(""))
  ))());
  T("markup", "pen decimation keeps the endpoints", (() => {
    const raw = [];
    for (let i = 0; i <= 40; i++) raw.push({ x: i, y: 0 });   // dead-straight run
    const out = simplifyPts(raw, 0.25);
    return out.length === 2 && out[0].x === 0 && out[1].x === 40;
  })());
  T("markup", "pen decimation keeps a real corner", (() => {
    const out = simplifyPts([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 0.25);
    return out.length === 3;
  })());
  T("markup", "point-to-segment distance clamps at the ends", (() => (
    approx(distToSeg({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3, 1e-9) &&
    approx(distToSeg({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 4, 1e-9) &&
    approx(distToSeg({ x: 14, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 4, 1e-9)
  ))());
  T("markup", "hit test picks the topmost item under the cursor", (() => {
    const items = [
      { type: "line", pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      { type: "line", pts: [{ x: 0, y: 1 }, { x: 10, y: 1 }] },
    ];
    return hitMarkup(items, { x: 5, y: 0.9 }, 1) === 1 &&
           hitMarkup(items, { x: 5, y: 0.1 }, 0.5) === 0 &&
           hitMarkup(items, { x: 5, y: 40 }, 1) === -1;
  })());
  T("markup", "a box edge is grabbable but its empty middle is not", (() => {
    const items = [{ type: "rect", pts: [{ x: 0, y: 0 }, { x: 20, y: 20 }] }];
    return hitMarkup(items, { x: 10, y: 0.2 }, 1) === 0 && hitMarkup(items, { x: 10, y: 10 }, 1) === -1;
  })());
  T("markup", "handle counts: box 4, line 2, pen/text move-only", (() => (
    handlesFor({ type: "rect", pts: [{ x: 0, y: 0 }, { x: 4, y: 4 }] }).length === 4 &&
    handlesFor({ type: "measure", pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }] }).length === 2 &&
    handlesFor({ type: "pen", pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }] }).length === 0 &&
    handlesFor({ type: "text", pts: [{ x: 0, y: 0 }], text: "x" }).length === 0
  ))());
  T("markup", "dragging a box corner holds the opposite corner", (() => {
    const r0 = { type: "rect", pts: [{ x: 0, y: 0 }, { x: 20, y: 10 }] };
    const r1 = moveHandle(r0, 2, { x: 30, y: 25 });     // corner 2 = (b.x, b.y)
    const r2 = moveHandle(r0, 0, { x: -5, y: -5 });     // corner 0 = (a.x, a.y)
    return r1.pts[0].x === 0 && r1.pts[0].y === 0 && r1.pts[1].x === 30 && r1.pts[1].y === 25 &&
           r2.pts[1].x === 20 && r2.pts[1].y === 10 && r2.pts[0].x === -5;
  })());
  T("markup", "dragging an endpoint leaves the other end alone", (() => {
    const m = moveHandle({ type: "line", pts: [{ x: 1, y: 2 }, { x: 9, y: 2 }] }, 1, { x: 12, y: 7 });
    return m.pts[0].x === 1 && m.pts[0].y === 2 && m.pts[1].x === 12 && m.pts[1].y === 7;
  })());
  T("markup", "translate shifts every point and preserves shape", (() => {
    const m = translateMarkup({ type: "pen", pts: [{ x: 0, y: 0 }, { x: 3, y: 4 }] }, 5, -2);
    return m.pts[0].x === 5 && m.pts[0].y === -2 && m.pts[1].x === 8 && m.pts[1].y === 2 &&
           approx(markupSpan(m), 5, 1e-9);
  })());
  T("snap", "snaps each axis to the nearest meaningful anchor", (() => {
    const L = computeLayout({ selectedSize: 65, brand: "Sony", centerH: 42, tvCL: 60, showBackBox: false, mountSystem: "sanus", sanusMount: null });
    const a = snapAnchors(L, 120, 108);
    const r = snapPoint({ x: 32.0, y: 50 }, a, 2, null);   // 0.94" shy of tvLeft
    return approx(r.x, L.tvLeft, 1e-9) && r.hitX.why === "TV left" && r.y === 50;
  })());
  T("snap", "leaves a point alone when nothing is close", (() => {
    const a = snapAnchors(null, 120, 108);
    const r = snapPoint({ x: 55, y: 44 }, a, 2, null);
    return r.x === 55 && r.y === 44 && !r.hitX && !r.hitY;
  })());
  T("snap", "ortho lock levels a two-point shape", (() => {
    const a = snapAnchors(null, 120, 108);
    const r = snapPoint({ x: 87.7, y: 50.6 }, a, 2, { x: 31.06, y: 50 });
    return approx(r.y, 50, 1e-9) && r.orthoY === true;
  })());
  T("snap", "an anchor beats the ortho lock on the same axis", (() => {
    const L = computeLayout({ selectedSize: 65, brand: "Sony", centerH: 42, tvCL: 60, showBackBox: false, mountSystem: "sanus", sanusMount: null });
    const a = snapAnchors(L, 120, 108);
    const r = snapPoint({ x: 60, y: L.tvTop + 0.3 }, a, 2, { x: 10, y: 20 });
    return approx(r.y, L.tvTop, 1e-9) && !r.orthoY;
  })());
  T("markup", "a measure label never lands on its own shaft", (() => {
    const vert = measureLabelPos(100, 50, 100, 200);      // vertical run
    const horiz = measureLabelPos(50, 100, 200, 100);     // horizontal run
    const diag = measureLabelPos(0, 0, 100, 100);
    return approx(Math.abs(vert.x - 100), 13, 1e-6) && approx(vert.y, 125, 1e-6) &&   // pushed sideways
           approx(horiz.x, 125, 1e-6) && approx(Math.abs(horiz.y - 100), 13, 1e-6) && // pushed up
           approx(Math.hypot(diag.x - 50, diag.y - 50), 13, 1e-6);                    // always clear by 13
  })());
  T("markup", "a blanking patch is hit anywhere inside it, a box only on its edge", (() => {
    const mask = [{ type: "mask", pts: [{ x: 0, y: 0 }, { x: 20, y: 20 }] }];
    const box = [{ type: "rect", pts: [{ x: 0, y: 0 }, { x: 20, y: 20 }] }];
    return hitMarkup(mask, { x: 10, y: 10 }, 0.5) === 0 && hitMarkup(box, { x: 10, y: 10 }, 0.5) === -1;
  })());
  T("markup", "a blanking patch exposes four corner handles", (() => (
    handlesFor({ type: "mask", pts: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }).length === 4
  ))());
  T("markup", "measure span is the true wall-inch distance", (() => (
    approx(markupSpan({ pts: [{ x: 0, y: 0 }, { x: 3, y: 4 }] }), 5, 1e-9)
  ))());
  T("markup", "markup reaches the DXF on its own layer", (() => {
    const dxfLayout2 = computeLayout({ selectedSize: 65, brand: "Sony", centerH: 52, tvCL: 60, showBackBox: false, mountSystem: "sanus", sanusMount: null });
    const d = buildDXF({ wallW: 120, wallH: 108, brand: "Sony", selectedSize: 65, dispUnits: "dec",
      markup: [{ type: "line", pts: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }] }, dxfLayout2);
    return typeof d === "string" && d.includes("MARKUP");
  })());

  T("interop", "Job-walk style JSON → brand/size/wall/project/fireplace", (() => {
    const ex = extractImportedDesign({
      job: { name: "Beach House" },
      rooms: [{
        name: "Living",
        tv: { brand: "Sony Bravia", size: 65 },
        wall: { width: 120, height: 108 },
        fireplace: { openingWidth: 40, openingHeight: 30, mantelHeight: 54 },
      }],
    });
    const f = ex.fields;
    return f.brand === "Sony" && f.selectedSize === 65 && f.wallW === 120 && f.wallH === 108 &&
           f.projectName === "Beach House" && f.hasFireplace === true && f.mantelH === 54 &&
           f.fbOpeningW === 40 && f.fbOpeningH === 30;
  })());
  T("interop", `TV model string "Samsung QN90 75 inch" parses`, (() => {
    const ex = extractImportedDesign({ tv: { model: "Samsung QN90 75 inch" } });
    return ex.fields.brand === "Samsung" && ex.fields.selectedSize === 75;
  })());
  T("interop", "Native export round-trips (new id)", (() => {
    const ex = extractImportedDesign(buildExportJSON({ wallW: 96, brand: "LG", selectedSize: 77 }, null));
    return ex.native === true && ex.fields.wallW === 96 && ex.fields.brand === "LG" && ex.fields.selectedSize === 77;
  })());
  T("interop", "Legacy tv-wall-planner exports still import", (() => {
    const ex = extractImportedDesign({ app: "tv-wall-planner", design: { brand: "Sony", selectedSize: 65 } });
    return ex.native === true && ex.fields.selectedSize === 65;
  })());
  T("interop", "Irrelevant JSON tolerated, nothing matched", (() => {
    const ex = extractImportedDesign({ a: [1, 2, { b: "x" }], c: null, speakers: { count: 4 } });
    return ex.matched.length === 0 && ex.ignored > 0;
  })());

  // ---- DXF export ----
  {
    const dxfLayout = computeLayout({ selectedSize: 65, brand: "Sony", centerH: 42, tvCL: 60, showBackBox: true, effectiveBoxModel: "SM-RBX-PRO-14", mountSystem: "sanus", sanusMount: recommendSanusMount(65, "fixed", "Sony") });
    const dxfState = { wallW: 120, wallH: 108, hasFireplace: false, fbOpeningW: 40, fbOpeningH: 30, fbOffsetIn: 0, hasMantel: false, mantelH: 54, mantelDepth: 8, brand: "Sony", selectedSize: 65, dispUnits: "dec", showVesa: true, showOutlet: true, showLowVolt: true, heightRef: "center", projectName: "DXF Test", clientName: "", revision: "01" };
    const dxf = buildDXF(dxfState, dxfLayout);
    T("interop", "DXF: valid R12 skeleton (header/tables/entities/EOF)",
      dxf.startsWith("0\r\nSECTION") && dxf.includes("AC1009") && dxf.includes("ENTITIES") && dxf.endsWith("EOF") && dxf.includes("BACKBOX") && dxf.includes("ELECTRICAL"));
    T("interop", "DXF: geometry at true scale (wall 120, TV right edge 88.94)",
      dxf.includes("120.0000") && dxf.includes(dxfLayout.tvRight.toFixed(4)) && dxf.includes(dxfLayout.outlet.aff.toFixed(4)));
    T("interop", "DXF: ASCII-safe text (no unicode survives)",
      !/[^\x00-\x7F]/.test(dxf));
  }

  // ---- Invariants: swept across every brand / size / mount / fireplace config ----
  const configs = [
    { name: "open wall", hasFireplace: false, hasMantel: false, mantelH: 54, fbOpeningH: 30 },
    { name: "fireplace+mantel", hasFireplace: true, hasMantel: true, mantelH: 54, fbOpeningH: 30 },
    { name: "fireplace no mantel", hasFireplace: true, hasMantel: false, mantelH: 54, fbOpeningH: 30 },
  ];
  let geomOK = true, vesaOK = true, boxKeyOK = true, boxHonest = true, elecOK = true, convOK = true, recFitsOK = true;
  let sweepCount = 0;
  const detail = [];
  BRANDS.forEach(brand => {
    TV_CATALOG[brand].forEach(sz => {
      ["sanus", "fa"].forEach(mountSystem => {
        const boxModel = recommendBackBox(sz, mountSystem, brand);
        if (!BACK_BOXES[boxModel]) { boxKeyOK = false; detail.push(`no box: ${brand} ${sz} ${mountSystem}`); }
        const L = computeLayout({ selectedSize: sz, brand, centerH: 50, tvCL: 60, showBackBox: true, effectiveBoxModel: boxModel, mountSystem, sanusMount: mountSystem === "sanus" ? recommendSanusMount(sz, "fixed", brand) : null });
        sweepCount++;
        // geometry symmetry + height identities
        if (!approx(L.tvTop - L.tvBottom, L.tvH, 1e-9) || !approx((L.tvLeft + L.tvRight) / 2, L.tvCL, 1e-9)) { geomOK = false; detail.push(`geom: ${brand} ${sz}`); }
        // VESA mm→inch exact + bias direction
        if (L.vesa) {
          const spec = VESA_DATA[brand][sz];
          if (!approx(L.vesa.w, spec.w_mm / 25.4, 1e-9) || !approx(L.vesa.aff, 50 + (spec.voffset_pct / 100) * L.tvH, 1e-9)) { vesaOK = false; detail.push(`vesa: ${brand} ${sz}`); }
        }
        // box honesty: flag must match independently recomputed geometry
        if (L.box) {
          const out = L.box.cx - L.box.w / 2 < L.tvLeft || L.box.cx + L.box.w / 2 > L.tvRight ||
                      L.box.aff + L.box.h / 2 > L.tvTop || L.box.aff - L.box.h / 2 < L.tvBottom;
          if (out !== L.box.extendsOff) { boxHonest = false; detail.push(`box flag: ${brand} ${sz} ${mountSystem}`); }
          // electrical inside box
          const inBox = (p) => p.x >= L.box.cx - L.box.w / 2 - 1e-9 && p.x <= L.box.cx + L.box.w / 2 + 1e-9 &&
                               p.aff >= L.box.aff - L.box.h / 2 - 1e-9 && p.aff <= L.box.aff + L.box.h / 2 + 1e-9;
          if (!inBox(L.outlet) || !inBox(L.lv)) { elecOK = false; detail.push(`elec: ${brand} ${sz} ${mountSystem}`); }
        }
        // override conversion round-trip
        const there = convertOverride(50, "bottom", brand, sz);
        const back = convertOverride(there, "center", brand, sz);
        if (!approx(back, 50, 1e-9)) { convOK = false; detail.push(`conv: ${sz}`); }
      });
      // recommendation ⇒ placed at recommended height, TV fits the wall
      configs.forEach(cfg => {
        const rec = computeRecommendations({ brand, wallW: 120, wallH: 108, useViewDist: false, viewDist: 144, ...cfg });
        rec.forEach(rsz => {
          const rc = computeRecommendedCenterH({ selectedSize: rsz, brand, useViewDist: false, viewDist: 144, ...cfg });
          const top = rc + tvDimsFor(brand, rsz).h / 2;
          if (top > 108 + 1e-9) { recFitsOK = false; detail.push(`rec-fit: ${brand} ${rsz} ${cfg.name} top=${top.toFixed(1)}`); }
        });
      });
    });
  });
  T("invariant", `Geometry identities (${sweepCount} layouts)`, geomOK, detail.filter(d => d.startsWith("geom")).join("; "));
  T("invariant", "VESA mm→inch exact, bias applied correctly", vesaOK, detail.filter(d => d.startsWith("vesa")).join("; "));
  T("invariant", "Box selector always returns a real model", boxKeyOK, detail.filter(d => d.startsWith("no box")).join("; "));
  T("invariant", "extendsOff flag never lies", boxHonest, detail.filter(d => d.startsWith("box flag")).join("; "));
  T("invariant", "Outlet & LV always inside the back box", elecOK, detail.filter(d => d.startsWith("elec")).join("; "));
  T("invariant", "Center↔bottom conversion round-trips", convOK, detail.filter(d => d.startsWith("conv")).join("; "));
  T("invariant", "Every recommended size fits its wall at recommended height", recFitsOK, detail.filter(d => d.startsWith("rec-fit")).join("; "));

  // fireplace bounds issue detection (new engine capability)
  T("invariant", "Off-wall firebox is detected", (() => {
    const iss = computePlacementIssues({ layout: null, wallW: 120, wallH: 108, hasFireplace: true, fbOpeningW: 40, fbOffsetIn: 45 });
    return iss.some(s => s.includes("Firebox"));
  })());

  // persistence round-trip (pure shape check)
  T("invariant", "Saved state survives JSON round-trip", (() => {
    const state = { wallW: 120, selectedSize: 65, tvOffsetX: "-3.5", heightRef: "bottom" };
    const back = JSON.parse(JSON.stringify(state));
    return back.wallW === 120 && back.selectedSize === 65 && back.tvOffsetX === "-3.5" && back.heightRef === "bottom";
  })());

  const passed = results.filter(r => r.pass).length;
  return { results, passed, total: results.length };
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — THEME ("Blueprint Modern")
// Screen: white linework on Prussian navy (a true blueprint).
// Print:  navy linework on white (a "blueline" — toner-friendly exports).
// Schematic colors are literal hex (CSS vars don't survive SVG export).
// ═══════════════════════════════════════════════════════════════════════════

const SCREEN_PALETTE = {
  id: "scr",
  canvas: "#0D1B2A", grid: "rgba(232,238,245,0.05)",
  wallFill: "#13263B", wallStroke: "#E8EEF5",
  line: "#E8EEF5", lineSoft: "#8DA3B8",
  tvFill: "#060B12", tvStroke: "#E8EEF5", screenFill: "#0B1622", tvLabel: "#8DA3B8",
  mantel: "#27425F", fbFill: "#1A3049", fbOpen: "#060B12",
  dimText: "#E8EEF5", dimSub: "#8DA3B8", halo: "#0D1B2A", dimW: 1, maskFill: "#0D1B2A",
  cl: "#FF7A6B", vesa: "#FFD166", box: "#3ECFE0", boxBad: "#FF5C4D", pwr: "#4ADE80", lv: "#FFA94D",
  mount: "#8DA3B8",
  pillStyle: "filled", pillText: "#06121F",
  tape: "#5EEAD4",
  title: "#8DA3B8",
};

const PRINT_PALETTE = {
  id: "prt",
  canvas: "#FFFFFF", grid: "rgba(16,42,67,0.07)",
  wallFill: "#F4F7FA", wallStroke: "#102A43",
  line: "#102A43", lineSoft: "#5C7186",
  tvFill: "#102A43", tvStroke: "#102A43", screenFill: "#1D3A57", tvLabel: "#B8C9DA",
  mantel: "#D7E0E9", fbFill: "#E8EEF4", fbOpen: "#102A43",
  dimText: "#102A43", dimSub: "#5C7186", halo: "#FFFFFF", dimW: 1, maskFill: "#FFFFFF",
  cl: "#C0392B", vesa: "#8A6A1A", box: "#0E7C90", boxBad: "#C0392B", pwr: "#1E7D3C", lv: "#B25E0F",
  mount: "#5C7186",
  pillStyle: "outline", pillText: null, // outline pills use the accent color for text
  tape: "#0E7C90",
  title: "#5C7186",
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — SCHEMATIC BUILDER + ANNOTATION ENGINE
// Collision-free by construction:
//  • right-side callouts pack into a leader rail (no overlap possible)
//  • dimensions take "lanes" that step outward when crowded
//  • SVG padding is DERIVED from what's actually drawn — no magic numbers
// ═══════════════════════════════════════════════════════════════════════════

// IBM Plex Mono advance ≈ 0.6em
// Over an imported drawing the blueprint palette inverts on itself: near-white
// ink vanishes on a white scan. Trace mode therefore reuses the PRINT palette —
// dark ink on white, already tuned for paper — and hollows every solid so the
// drawing underneath stays readable while you align to it. Side effect worth
// having: the screen now matches the exported PDF.
const tracePalette = (P) => ({
  ...PRINT_PALETTE,
  id: P.id,
  canvas: "#F2F5F8", grid: "rgba(16,42,67,0.06)",
  wallFill: "none", tvFill: "none", screenFill: "none",
  mantel: "none", fbFill: "none", fbOpen: "none",
  tvLabel: "#5C7186",
  dimW: 1.6,
  // Over a scan the label plates go fully opaque — a translucent plate lets the
  // architect's linework bleed through the callout pills and dimension text.
  halo: "#FFFFFF",
  maskFill: "#FFFFFF",
});

const textW = (str, fontSize) => str.length * fontSize * 0.62;

// Pack rail entries top-down using each entry's REAL height (pills can have
// 2 or 3 lines). Deterministic: sorted by anchor Y, ties broken by
// registration order. ≥8px gap between pill boxes — overlap impossible.
const packRail = (entries, minY, ts = 1) => {
  const sorted = entries.map((e, i) => ({ ...e, _i: i }))
    .sort((a, b) => (a.anchorY - b.anchorY) || (a._i - b._i));
  let prevTop = -Infinity, prevH = 0;
  sorted.forEach(e => {
    const h = 16 * ts + (e.lines.length - 1) * 13 * ts; // pill bg + extra text lines
    const top = Math.max(e.anchorY - 16 * ts, prevTop + prevH + 8, minY - 12 * ts);
    e.slotY = top + 12 * ts;
    prevTop = top;
    prevH = h;
  });
  return sorted;
};

// Renders the markup layer for a given inch->pixel frame. Shared by the
// schematic build and by the live in-progress stroke, so a pen drag repaints a
// handful of nodes instead of rebuilding several hundred.
const renderMarkupEls = (items, { wallX, floorY, scale, keyPrefix = "mk", fmt, paper, ts = 1 }) => {
  const FS = (n) => +(n * ts).toFixed(2);
  const out = [];
  const MX = (pt) => wallX + pt.x * scale;
  const MY = (pt) => floorY - pt.y * scale;
  const MXY = (pt) => ({ x: MX(pt), y: MY(pt) });
  (items || []).forEach((m, i) => {
    if (!m) return;
    const key = `${keyPrefix}-${m.id ?? i}`;
    const col = m.color || "#FF3B30";
    const sw = m.w || 2;
    const pts = m.pts || [];
    if (!pts.length) return;
    const a = pts[0], b = pts[pts.length - 1];
    if (m.type === "mask") {
      // Blanking patch: paints over the imported drawing so the schematic above
      // it can be read. Uses the palette's paper colour, not white, so it
      // disappears in the blueprint view as well as the trace view.
      const c = rectCorners(pts[0], pts[pts.length - 1]).map(MXY);
      out.push(<polygon key={key} points={c.map(q => `${q.x},${q.y}`).join(" ")}
        fill={paper || "#FFFFFF"} stroke="none"/>);
    } else if (m.type === "pen") {
      out.push(<polyline key={key} points={pts.map(pt => `${MX(pt)},${MY(pt)}`).join(" ")}
        fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>);
    } else if (m.type === "line") {
      out.push(<line key={key} x1={MX(a)} y1={MY(a)} x2={MX(b)} y2={MY(b)} stroke={col} strokeWidth={sw} strokeLinecap="round"/>);
    } else if (m.type === "arrow") {
      const x1 = MX(a), y1 = MY(a), x2 = MX(b), y2 = MY(b);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const hl = Math.max(8, sw * 4);
      out.push(<line key={key} x1={x1} y1={y1} x2={x2 - Math.cos(ang) * hl * 0.6} y2={y2 - Math.sin(ang) * hl * 0.6} stroke={col} strokeWidth={sw} strokeLinecap="round"/>);
      out.push(<polygon key={`${key}-h`} fill={col} points={[
        [x2, y2],
        [x2 - Math.cos(ang - 0.4) * hl, y2 - Math.sin(ang - 0.4) * hl],
        [x2 - Math.cos(ang + 0.4) * hl, y2 - Math.sin(ang + 0.4) * hl],
      ].map(q => q.join(",")).join(" ")}/>);
    } else if (m.type === "rect") {
      out.push(<rect key={key} x={Math.min(MX(a), MX(b))} y={Math.min(MY(a), MY(b))}
        width={Math.abs(MX(b) - MX(a))} height={Math.abs(MY(b) - MY(a))}
        fill="none" stroke={col} strokeWidth={sw}/>);
    } else if (m.type === "text") {
      const fs = FS(m.size || 13);
      const tw = textW(m.text || "", fs) + 8;
      out.push(<rect key={`${key}-b`} x={MX(a) - 4} y={MY(a) - fs + 1} width={tw} height={fs + 5} rx="2"
        fill={paper || "#FFFFFF"} stroke="none"/>);
      out.push(<text key={key} x={MX(a)} y={MY(a)} fill={col} fontSize={fs} fontWeight="600"
        fontFamily="'IBM Plex Mono', monospace">{m.text || ""}</text>);
    } else if (m.type === "measure") {
      const x1 = MX(a), y1 = MY(a), x2 = MX(b), y2 = MY(b);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const tx = Math.cos(ang + Math.PI / 2) * 5, ty = Math.sin(ang + Math.PI / 2) * 5;
      out.push(<line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={sw}/>);
      out.push(<line key={`${key}-t1`} x1={x1 - tx} y1={y1 - ty} x2={x1 + tx} y2={y1 + ty} stroke={col} strokeWidth={sw}/>);
      out.push(<line key={`${key}-t2`} x1={x2 - tx} y1={y2 - ty} x2={x2 + tx} y2={y2 + ty} stroke={col} strokeWidth={sw}/>);
      // Offset the label along the line's NORMAL, not just upward: a vertical
      // measure used to centre its text on its own shaft and get struck through.
      const lbl = fmt ? fmt(markupSpan(m)) : markupSpan(m).toFixed(2);
      const lp = measureLabelPos(x1, y1, x2, y2);
      const lx = lp.x, ly = lp.y;
      const lw = textW(lbl, FS(12)) + 8;
      out.push(<rect key={`${key}-lb`} x={lx - lw / 2} y={ly - 10} width={lw} height={14} rx="2"
        fill={paper || "#FFFFFF"} stroke="none"/>);
      out.push(<text key={`${key}-l`} x={lx} y={ly + 1} textAnchor="middle" dominantBaseline="middle" fill={col}
        fontSize={FS(12)} fontWeight="600" fontFamily="'IBM Plex Mono', monospace">{lbl}</text>);
    }
  });
  return out;
};

const buildSchematic = (S, BASE_P) => {
  const {
    wallW, wallH, hasFireplace, fbOpeningW, fbOpeningH, fbOffsetIn, hasMantel,
    mantelH, mantelDepth, brand, selectedSize, layout, heightRef,
    showVesa, showOutlet, showLowVolt, showBoxDims, showTvDims, showTapeOut,
    showTravel, travelIn, fullWords, projectName, clientName, revision,
    dispUnits, isMobile, isTablet, viewportW, underlay, markup,
  } = S;
  const hasUnderlay = !!(underlay && underlay.src && underlay.visible !== false);
  const traceOn = hasUnderlay && S.trace !== false;
  // Every glyph on the drawing scales from one factor. Crucially the PADDING,
  // plate widths and rail packing derive from FS() too — scaling the font
  // attributes alone would leave labels colliding and clipped.
  const TS = S.textScale || 1;
  const FS = (n) => +(n * TS).toFixed(2);
  const P = traceOn ? tracePalette(BASE_P) : BASE_P;
  const fmt = (v) => fmtIn(v, dispUnits);

  // drawing vocabulary — abbreviated (default) or spelled out (FULL WORDS).
  // Expansions must stay in sync with ABBREVIATIONS.
  const W = fullWords
    ? { AFF: "ABOVE FLOOR", BTM: "BOTTOM", ABV: "ABOVE", BLW: "BELOW", CL: "CENTERLINE", PWR: "POWER", LV: "LOW VOLTAGE", EXT: "EXTENDS" }
    : { AFF: "AFF", BTM: "BTM", ABV: "ABV", BLW: "BLW", CL: "CL", PWR: "PWR", LV: "LV", EXT: "EXT" };

  const safeWallW = Math.max(wallW || 1, 1);
  const safeWallH = Math.max(wallH || 1, 1);
  const basePad = isMobile ? 48 : 64;
  const maxW = isMobile ? Math.max(viewportW - 60, 280) : (isTablet ? Math.max(viewportW - 360, 460) : 760);
  const maxH = isMobile ? 360 : (isTablet ? 480 : 540);
  const scale = Math.min(maxW / safeWallW, maxH / safeWallH);

  // --- derive pads from content (all predicates are pad-independent) ---
  // Left: the mount-height dimension is two lines — the value (13px) and the
  // reference sub-label (8px + 1px letterspacing). Pad covers the wider one.
  const refValue = layout ? (heightRef === "bottom" ? layout.tvBottom : layout.centerH) : 0;
  const leftDimText = layout ? fmt(refValue) : "";
  const leftDimSub = heightRef === "bottom" ? "TO BOTTOM" : "TO CENTER";
  const leftDimW = Math.max(textW(leftDimText, FS(13)), leftDimSub.length * (FS(8) * 0.62 + 1));
  const leftPad = layout ? Math.max(basePad, 44 + leftDimW + 16) : basePad;

  // Top: TV-width dim sits 18px above the TV; the CL dim needs its own lane
  // above the wall — and steps up if the TV mounts near the wall top.
  let clDimRelY = -16; // relative to wallY
  if (layout) {
    const tvTopRel = (safeWallH - layout.tvTop) * scale; // px from wall top down to TV top
    const widthDimRelY = tvTopRel - 18;
    if (widthDimRelY < clDimRelY + 24) clDimRelY = widthDimRelY - 24;
  }
  const topPad = Math.max(basePad, -clDimRelY + 30);

  // Right: leader rail (when callouts shown) + wall-height dim, both lane-aware.
  // Spelled-out labels need a wider rail (worst case: "LOW VOLTAGE 5' - 3 1/8" ABOVE FLOOR").
  const railW = (fullWords ? 250 : 148) * TS;   // reserved for callout pills — scales with the type
  const hasRail = layout && (showVesa || layout.box || showOutlet || showLowVolt);
  let hDimRelX = safeWallW * scale + 32; // relative to wallX
  if (hasRail) {
    const tvRightRel = layout.tvRight * scale;
    const railRightRel = tvRightRel + 16 + railW;
    if (hDimRelX < railRightRel + 12) hDimRelX = railRightRel + 12;
  }
  const rightPad = (hDimRelX - safeWallW * scale) + 24 + textW(`${safeWallH}" H`, FS(13)) + 12;

  const hasTitleBlock = !!(projectName || clientName);
  const tbDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const titleStr = hasTitleBlock ? `${[projectName, clientName].filter(Boolean).join("  •  ").toUpperCase()}  •  REV ${revision || "01"}  •  ${tbDate}` : "";
  const ntsStr = "NOT TO SCALE — DIMENSIONS GOVERN";
  // The leader rail can outrun a small-scale wall (anchors near the floor
  // drag pills down). Simulate the exact packing in wall-relative space —
  // pad-independent — and reserve the real overflow in bottomPad.
  let railBottomRel = 0;
  if (layout) {
    const wallPxHRel = safeWallH * scale;
    const relY = (aff) => wallPxHRel - aff * scale;
    const ents = [];
    if (layout.vesa && showVesa) ents.push({ a: relY(layout.vesa.aff + layout.vesa.h / 2), n: 2 });
    if (layout.box) ents.push({ a: relY(layout.box.aff), n: 2 + (layout.box.extendsOff ? 1 : 0) + (showBoxDims ? 2 + (hasFireplace && hasMantel ? 1 : 0) : 0) });
    if (showOutlet) ents.push({ a: relY(layout.outlet.aff), n: 2 });
    if (showLowVolt) ents.push({ a: relY(layout.lv.aff), n: 2 });
    if (showTapeOut) ents.push({ a: relY(layout.tvTop), n: 2 });
    if (layout.mount?.system === "sanus") ents.push({ a: relY(layout.vesa ? layout.vesa.aff : layout.centerH), n: 2 });
    if (showTravel && S.mountSystem === "fa" && layout.box && layout.box.brand === "Future Automation" && travelIn > 0) ents.push({ a: relY(layout.tvTop + travelIn), n: 2 });
    const relTvTop = relY(layout.tvTop);
    const topFloor = showTvDims ? relTvTop + 2 - 12 : 10;
    let prevTop = -Infinity, prevH = 0;
    ents.map((e, i) => ({ ...e, _i: i }))
      .sort((x, y) => (x.a - y.a) || (x._i - y._i))
      .forEach(e => {
        const h = 16 * TS + (e.n - 1) * 13 * TS;
        const top = Math.max(e.a - 16 * TS, prevTop + prevH + 8, topFloor);
        railBottomRel = top + h;
        prevTop = top;
        prevH = h;
      });
  }
  // wall width + side pads are already fixed here, so the bottom-row fit
  // check is exact: stack title and NTS when one row can't hold both
  const svgWForRow = safeWallW * scale + leftPad + (layout ? Math.max(basePad, 88) : Math.max(basePad, 88));
  const twoLineBottom = hasTitleBlock && (textW(titleStr, FS(9)) + textW(ntsStr, FS(9)) + 48 > svgWForRow);
  const bottomPad = Math.max(
    basePad + 26 + (hasTitleBlock ? (twoLineBottom ? 30 : 16) : 0),
    railBottomRel - safeWallH * scale + 30 + (hasTitleBlock ? (twoLineBottom ? 30 : 16) : 0)
  );

  // A calibrated sheet is usually several times the size of the TV wall. By
  // default we let the root <svg> clip it, so the schematic keeps its full
  // working size and the drawing shows through where it matters. "WHOLE SHEET"
  // opts into growing the canvas instead — capped per side so a mis-scaled
  // import can't shrink the TV to a dot.
  const wallPxW = safeWallW * scale;
  const wallPxH = safeWallH * scale;
  let uL = 0, uT = 0, uR = 0, uB = 0;
  if (hasUnderlay && underlay.fitSheet) {
    const capW = wallPxW * 1.5, capH = wallPxH * 1.5;
    const uw = underlayInW(underlay) * scale, uh = underlayInH(underlay) * scale;
    const ux = underlay.ox * scale;                // px right of wall left edge
    const uy = (safeWallH - underlay.oy) * scale;  // px below wall top edge
    uL = Math.min(Math.max(0, -ux - leftPad), capW);
    uT = Math.min(Math.max(0, -uy - topPad), capH);
    uR = Math.min(Math.max(0, ux + uw - wallPxW - rightPad), capW);
    uB = Math.min(Math.max(0, uy + uh - wallPxH - bottomPad), capH);
  }
  const wallX = leftPad + uL;
  const wallY = topPad + uT;
  const floorY = wallY + wallPxH;
  const svgW = wallPxW + leftPad + uL + rightPad + uR;
  const svgH = wallPxH + topPad + uT + bottomPad + uB;

  const elements = [];
  const K = (k) => `${P.id}-${k}`; // unique keys/ids per palette render
  // Index where the ANNOTATION layer starts — callout pills, dimension lines
  // and every dimension label. Hand markup is spliced in here rather than
  // appended, so a redline can never strike through the drawing's own
  // dimensions. Geometry (wall, TV, box) still sits under the markup.
  let labelStart = -1;

  // Imported reference elevation, painted under the schematic.
  //
  // Two ways to get the architect's clutter out of the way, in this order:
  //   crop   — a window on the sheet; everything outside it simply is not drawn
  //            (kills border hatching, title blocks, the sheet's own dimension
  //            strings) without touching the calibration
  //   masks  — opaque patches over whatever is left inside the working area
  // Both sit BELOW the schematic, so the TV and our dimensions still read.
  if (hasUnderlay) {
    const cr = underlay.crop;
    const clipId = K("ucrop");
    if (cr) {
      elements.push(
        <clipPath key={K("ucd")} id={clipId}>
          <rect x={wallX + cr.x * scale} y={floorY - (cr.y + cr.h) * scale}
                width={cr.w * scale} height={cr.h * scale}/>
        </clipPath>);
    }
    elements.push(<image key={K("underlay")} href={underlay.src} xlinkHref={underlay.src}
      x={wallX + underlay.ox * scale} y={floorY - underlay.oy * scale}
      width={underlayInW(underlay) * scale} height={underlayInH(underlay) * scale}
      opacity={underlay.opacity ?? 0.75} preserveAspectRatio="none"
      clipPath={cr ? `url(#${clipId})` : undefined}/>);
  }

  // Blanking patches sit directly on top of the reference drawing and directly
  // below the schematic, so they hide the architect's clutter without ever
  // hiding our own TV, dimensions or callouts.
  const masks = (markup || []).filter(m => m && m.type === "mask");
  if (masks.length) {
    renderMarkupEls(masks, { wallX, floorY, scale, keyPrefix: K("mask"), fmt, paper: P.maskFill, ts: TS })
      .forEach(el => elements.push(el));
  }

  // wall + floor — fill drops to none over an underlay so the scan shows through
  elements.push(<rect key={K("wall")} x={wallX} y={wallY} width={wallPxW} height={wallPxH} fill={hasUnderlay ? "none" : P.wallFill} stroke={P.wallStroke} strokeWidth="1.5"/>);
  elements.push(<line key={K("floor")} x1={wallX - 20} y1={floorY} x2={wallX + wallPxW + 20} y2={floorY} stroke={P.line} strokeWidth="2"/>);
  for (let i = 0; i < 12; i++) {
    const x = wallX - 18 + i * ((wallPxW + 36) / 12);
    elements.push(<line key={K(`hatch-${i}`)} x1={x} y1={floorY} x2={x + 6} y2={floorY + 8} stroke={P.lineSoft} strokeWidth="0.8"/>);
  }

  if (hasFireplace) {
    const fbW = fbOpeningW * scale;
    const fbH = fbOpeningH * scale;
    const fbX = wallX + (wallPxW - fbW) / 2 + fbOffsetIn * scale;
    const fbY = floorY - fbH;
    elements.push(<rect key={K("fb")} x={fbX} y={fbY} width={fbW} height={fbH} fill={P.fbFill} stroke={P.wallStroke} strokeWidth="1"/>);
    const inset = 6;
    elements.push(<rect key={K("fbop")} x={fbX + inset} y={fbY + inset} width={fbW - inset * 2} height={fbH - inset * 2} fill={P.fbOpen} stroke={P.lineSoft} strokeWidth="0.8"/>);
    if (hasMantel) {
      const mH = mantelDepth * scale;
      const mY = floorY - mantelH * scale;
      const overhang = 12 * scale;
      elements.push(<rect key={K("mantel")} x={fbX - overhang} y={mY} width={fbW + overhang * 2} height={mH} fill={P.mantel} stroke={P.wallStroke} strokeWidth="1"/>);
    }
  }

  // pill helper — filled (screen) or outlined (print)
  const pushPill = (key, x, y, lines, color) => {
    const w = Math.max(...lines.map(l => textW(l.text, FS(l.size)))) + 14;
    const filled = P.pillStyle === "filled";
    elements.push(<rect key={K(`${key}-bg`)} x={x} y={y - 12 * TS} width={w} height={16 * TS} rx="2"
      fill={filled ? color : P.canvas} stroke={filled ? P.canvas : color} strokeWidth={filled ? 0.8 : 1.1}/>);
    lines.forEach((l, i) => {
      const fill = i === 0 ? (filled ? P.pillText : color) : color;
      elements.push(<text key={K(`${key}-t${i}`)} x={x + 6} y={y - 1 + i * 13 * TS} textAnchor="start"
        fill={fill} fontSize={FS(l.size)} fontFamily="'IBM Plex Mono', monospace"
        fontWeight={i === 0 ? 700 : 500} letterSpacing="0.3">{l.text}</text>);
    });
    return w;
  };

  if (layout) {
    const { tvW, tvH } = layout;
    const tvPxW = tvW * scale;
    const tvPxH = tvH * scale;
    const tvX = wallX + layout.tvLeft * scale;
    const tvCenterY = floorY - layout.centerH * scale;
    const tvY = tvCenterY - tvPxH / 2;
    const clPx = wallX + layout.tvCL * scale;

    // TV
    elements.push(<rect key={K("tv")} x={tvX} y={tvY} width={tvPxW} height={tvPxH} fill={P.tvFill} stroke={P.tvStroke} strokeWidth="1.5"/>);
    elements.push(<rect key={K("tvscreen")} x={tvX + 3} y={tvY + 3} width={tvPxW - 6} height={tvPxH - 6} fill={P.screenFill} stroke="none"/>);
    if (tvPxW > 120) {
      elements.push(<text key={K("tvlabel")} x={tvX + 8} y={tvY + 16} textAnchor="start" fill={P.tvLabel} fontSize={FS(10)} fontFamily="'Space Grotesk', sans-serif" letterSpacing="1" fontWeight="500">{brand.toUpperCase()} {selectedSize}"</text>);
    }

    // VESA + mount plate
    const vesaCenterX = clPx;
    let vesaCenterY = tvCenterY, vesaPxW = 0, vesaPxH = 0;
    if (layout.vesa) {
      vesaPxW = layout.vesa.w * scale;
      vesaPxH = layout.vesa.h * scale;
      vesaCenterY = floorY - layout.vesa.aff * scale;
      const mountPxW = (layout.mount?.system === "sanus" ? layout.mount.plateW : layout.vesa.w + (layout.mount?.system === "fa" ? 3 : 2)) * scale;
      const mountPxH = (layout.mount?.system === "sanus" ? layout.mount.plateH : (layout.mount?.system === "fa" ? layout.vesa.h + 2 : 3.5)) * scale;
      elements.push(<rect key={K("mount")} x={vesaCenterX - mountPxW / 2} y={vesaCenterY - mountPxH / 2} width={mountPxW} height={mountPxH} fill="none" stroke={P.mount} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>);
    }

    // back box
    let bbX = 0, bbY = 0, bbPxW = 0, bbPxH = 0;
    if (layout.box) {
      bbPxW = layout.box.w * scale;
      bbPxH = layout.box.h * scale;
      bbX = wallX + (layout.box.cx - layout.box.w / 2) * scale;
      bbY = floorY - (layout.box.aff + layout.box.h / 2) * scale;
      const c = layout.box.extendsOff ? P.boxBad : P.box;
      elements.push(<rect key={K("bb")} x={bbX} y={bbY} width={bbPxW} height={bbPxH} fill={c} fillOpacity="0.14" stroke={c} strokeWidth="1.8" strokeDasharray="8 4"/>);
      if (showBoxDims) {
        // emphasized bottom edge — the FA set line in the field
        elements.push(<line key={K("bb-btm")} x1={bbX - 6} y1={bbY + bbPxH} x2={bbX + bbPxW + 6} y2={bbY + bbPxH} stroke={c} strokeWidth="2"/>);
      }
    }

    if (showVesa && layout.vesa) {
      const vLeft = vesaCenterX - vesaPxW / 2;
      const vTop = vesaCenterY - vesaPxH / 2;
      elements.push(<rect key={K("vesa-rect")} x={vLeft} y={vTop} width={vesaPxW} height={vesaPxH} fill="none" stroke={P.vesa} strokeWidth="1.5" strokeDasharray="3 2"/>);
      [[vLeft, vTop], [vLeft + vesaPxW, vTop], [vLeft, vTop + vesaPxH], [vLeft + vesaPxW, vTop + vesaPxH]].forEach(([hx, hy], i) => {
        elements.push(<circle key={K(`hole-${i}`)} cx={hx} cy={hy} r={3.5} fill={P.vesa} stroke={P.tvFill} strokeWidth="1.5"/>);
        elements.push(<circle key={K(`holei-${i}`)} cx={hx} cy={hy} r={1.7} fill={P.tvFill}/>);
      });
      if (layout.vesa.spec.voffset_pct !== 0) {
        elements.push(<line key={K("vesa-bias")} x1={tvX + 4} y1={tvY + tvPxH / 2} x2={tvX + tvPxW - 4} y2={tvY + tvPxH / 2} stroke={P.vesa} strokeWidth="0.6" strokeDasharray="1 4" opacity="0.5"/>);
      }
    }

    // ----- leader rail: every right-side callout registers, then packs -----
    const sideOf = (x) => {
      const d = x - layout.tvCL;
      if (Math.abs(d) < 0.05) return `ON TV ${W.CL}`;
      return `${fmt(Math.abs(d))} ${d < 0 ? (fullWords ? "LEFT" : "LT") : (fullWords ? "RIGHT" : "RT")} OF ${W.CL}`;
    };
    const rail = [];
    if (showVesa && layout.vesa) {
      rail.push({
        id: "vesa", color: P.vesa,
        anchor: [vesaCenterX + vesaPxW / 2, vesaCenterY - vesaPxH / 2],
        anchorY: vesaCenterY - vesaPxH / 2,
        lines: [
          { text: `VESA ${layout.vesa.spec.w_mm}×${layout.vesa.spec.h_mm}`, size: 10 },
          { text: `${layout.vesa.spec.screw} screw`, size: 9 },
        ],
      });
    }
    if (layout.box) {
      const c = layout.box.extendsOff ? P.boxBad : P.box;
      const lines = [
        { text: layout.box.label, size: 10 },
        { text: layout.box.brand, size: 9 },
      ];
      if (layout.box.extendsOff) lines.push({ text: "! EXTENDS BEYOND TV", size: 9 });
      if (showBoxDims) {
        lines.push({ text: `BOX ${W.BTM} ${fmt(layout.box.btm)} ${W.AFF}`, size: 9 });
        const d = layout.box.btm - layout.tvBottom;
        lines.push({ text: `${fmt(Math.abs(d))} ${d >= 0 ? W.ABV : W.BLW} TV ${W.BTM}`, size: 9 });
        if (hasFireplace && hasMantel) lines.push({ text: `${fmt(layout.box.btm - mantelH)} ${W.ABV} MANTEL`, size: 9 });
      }
      rail.push({ id: "bb", color: c, anchor: [bbX + bbPxW, bbY + bbPxH / 2], anchorY: bbY + bbPxH / 2, lines });
    }
    if (showOutlet) {
      const ox = wallX + layout.outlet.x * scale;
      const oy = floorY - layout.outlet.aff * scale;
      elements.push(<rect key={K("outlet")} x={ox - 7} y={oy - 5} width={14} height={10} fill={P.halo} stroke={P.pwr} strokeWidth="1.4"/>);
      elements.push(<circle key={K("o1")} cx={ox - 2.5} cy={oy} r="1.2" fill={P.pwr}/>);
      elements.push(<circle key={K("o2")} cx={ox + 2.5} cy={oy} r="1.2" fill={P.pwr}/>);
      rail.push({
        id: "pwr", color: P.pwr, anchor: [ox + 7, oy], anchorY: oy,
        lines: [{ text: `${W.PWR} ${fmt(layout.outlet.aff)} ${W.AFF}`, size: 10 }, { text: sideOf(layout.outlet.x), size: 9 }],
      });
    }
    if (showLowVolt) {
      const lx = wallX + layout.lv.x * scale;
      const ly = floorY - layout.lv.aff * scale;
      elements.push(<rect key={K("lv")} x={lx - 6} y={ly - 5} width={12} height={10} fill={P.halo} stroke={P.lv} strokeWidth="1.4"/>);
      elements.push(<text key={K("lvt")} x={lx} y={ly + 3} textAnchor="middle" fill={P.lv} fontSize={FS(7)} fontFamily="'IBM Plex Mono', monospace" fontWeight="700">LV</text>);
      rail.push({
        id: "lv", color: P.lv, anchor: [lx + 6, ly], anchorY: ly,
        lines: [{ text: `${W.LV} ${fmt(layout.lv.aff)} ${W.AFF}`, size: 10 }, { text: sideOf(layout.lv.x), size: 9 }],
      });
    }
    if (showTapeOut) {
      rail.push({
        id: "tape", color: P.tape,
        anchor: [tvX + tvPxW - 4, floorY - layout.tvTop * scale],
        anchorY: floorY - layout.tvTop * scale,
        lines: [{ text: "TAPE-OUT", size: 10 }, { text: "VERTICALS FROM LEFT WALL", size: 9 }],
      });
    }

    if (layout.mount?.system === "sanus") {
      rail.push({
        id: "mnt", color: P.mount,
        anchor: [vesaCenterX + ((layout.mount.plateW / 2) * scale), vesaCenterY],
        anchorY: vesaCenterY,
        lines: [
          { text: `SANUS ${layout.mount.model}`, size: 10 },
          { text: `DEPTH ${fmt(layout.mount.depth)}${layout.mount.ext ? ` · ${W.EXT} ${fmt(layout.mount.ext)}` : ""}`, size: 9 },
        ],
      });
    }

    if (showTravel && S.mountSystem === "fa" && layout.box && layout.box.brand === "Future Automation" && travelIn > 0) {
      const t = travelIn * scale;
      const yT = tvY - t, yB = tvY + tvPxH + t;
      elements.push(<line key={K("tr-top")} x1={tvX + 4} y1={yT} x2={tvX + tvPxW - 4} y2={yT} stroke={P.lineSoft} strokeWidth="1" strokeDasharray="4 4" opacity="0.8"/>);
      elements.push(<line key={K("tr-btm")} x1={tvX + 4} y1={yB} x2={tvX + tvPxW - 4} y2={yB} stroke={P.lineSoft} strokeWidth="1" strokeDasharray="4 4" opacity="0.8"/>);
      const ax = tvX + 14;
      elements.push(<line key={K("tr-ar")} x1={ax} y1={yT} x2={ax} y2={yB} stroke={P.lineSoft} strokeWidth="1" opacity="0.9"/>);
      elements.push(<path key={K("tr-a1")} d={`M${ax - 3} ${yT + 6} L${ax} ${yT} L${ax + 3} ${yT + 6}`} stroke={P.lineSoft} fill="none" strokeWidth="1"/>);
      elements.push(<path key={K("tr-a2")} d={`M${ax - 3} ${yB - 6} L${ax} ${yB} L${ax + 3} ${yB - 6}`} stroke={P.lineSoft} fill="none" strokeWidth="1"/>);
      rail.push({
        id: "travel", color: P.lineSoft, anchor: [tvX + tvPxW - 4, yT], anchorY: yT,
        lines: [{ text: `TV ADJUST ±${fmt(travelIn)}`, size: 10 }, { text: "FA BRACKET — VERIFY SPEC", size: 9 }],
      });
    }

    labelStart = elements.length;
    const railX = tvX + tvPxW + 16;
    packRail(rail, showTvDims ? tvY + 2 : wallY + 10, TS).forEach(e => {
      elements.push(<line key={K(`${e.id}-leader`)} x1={e.anchor[0]} y1={e.anchor[1]} x2={railX - 4} y2={e.slotY - 4} stroke={e.color} strokeWidth="0.8" opacity="0.7"/>);
      pushPill(e.id, railX, e.slotY, e.lines, e.color);
    });

    // ----- dimensions -----
    // height (left)
    const dimX = wallX - 32;
    const refY = heightRef === "bottom" ? (tvY + tvPxH) : tvCenterY;
    const refLabel = heightRef === "bottom" ? "TO BOTTOM" : "TO CENTER";
    elements.push(<line key={K("dh")} x1={dimX} y1={floorY} x2={dimX} y2={refY} stroke={P.line} strokeWidth={P.dimW}/>);
    elements.push(<line key={K("dha")} x1={dimX - 4} y1={floorY} x2={dimX + 4} y2={floorY} stroke={P.line} strokeWidth={P.dimW}/>);
    elements.push(<line key={K("dhb")} x1={dimX - 4} y1={refY} x2={dimX + 4} y2={refY} stroke={P.line} strokeWidth={P.dimW}/>);
    const dhMidY = (floorY + refY) / 2;
    const dhW = textW(leftDimText, FS(13)) + 8;
    elements.push(<rect key={K("dhbg")} x={dimX - 8 - dhW} y={dhMidY - FS(12)} width={dhW + 4} height={FS(35)} fill={P.halo} stroke="none" rx="2"/>);
    elements.push(<text key={K("dht")} x={dimX - 8} y={dhMidY + FS(4)} textAnchor="end" fill={P.dimText} fontSize={FS(13)} fontWeight="600" fontFamily="'IBM Plex Mono', monospace">{leftDimText}</text>);
    elements.push(<text key={K("dhl")} x={dimX - 8} y={dhMidY + FS(19)} textAnchor="end" fill={P.dimSub} fontSize={FS(8)} fontFamily="'IBM Plex Mono', monospace" letterSpacing="1">{refLabel}</text>);
    elements.push(<line key={K("reft1")} x1={tvX - 12} y1={refY} x2={tvX} y2={refY} stroke={P.cl} strokeWidth="1.5"/>);
    elements.push(<line key={K("reft2")} x1={tvX + tvPxW} y1={refY} x2={tvX + tvPxW + 12} y2={refY} stroke={P.cl} strokeWidth="1.5"/>);

    // width (top, lane 0)
    const dimY = tvY - 18;
    if (showTvDims) {
      const wTxt = `${fmt(tvW)} W × ${fmt(tvH)} H`;
      elements.push(<line key={K("dw")} x1={tvX} y1={dimY} x2={tvX + tvPxW} y2={dimY} stroke={P.line} strokeWidth={P.dimW}/>);
      elements.push(<line key={K("dwa")} x1={tvX} y1={dimY - 4} x2={tvX} y2={dimY + 4} stroke={P.line} strokeWidth={P.dimW}/>);
      elements.push(<line key={K("dwb")} x1={tvX + tvPxW} y1={dimY - 4} x2={tvX + tvPxW} y2={dimY + 4} stroke={P.line} strokeWidth={P.dimW}/>);
      const dwMidX = tvX + tvPxW / 2;
      const dwW = textW(wTxt, FS(13)) + 8;
      elements.push(<rect key={K("dwbg")} x={dwMidX - dwW / 2} y={dimY - FS(18)} width={dwW} height={FS(16)} fill={P.halo} stroke="none" rx="2"/>);
      elements.push(<text key={K("dwt")} x={dwMidX} y={dimY - FS(6)} textAnchor="middle" fill={P.dimText} fontSize={FS(13)} fontWeight="600" fontFamily="'IBM Plex Mono', monospace">{wTxt}</text>);
    }

    // centerline (top, lane 1 — steps above the width dim when crowded) +
    // dash-dot CL through the wall, stopping short of the width dimension lane
    const clDimY = wallY + clDimRelY;
    elements.push(<line key={K("cl-line")} x1={clPx} y1={wallY + 2} x2={clPx} y2={Math.max(dimY - 8, wallY + 2)} stroke={P.cl} strokeWidth="0.9" strokeDasharray="9 3 2 3" opacity="0.8"/>);
    elements.push(<line key={K("cl-dim")} x1={wallX} y1={clDimY} x2={clPx} y2={clDimY} stroke={P.cl} strokeWidth={P.dimW}/>);
    elements.push(<line key={K("cl-da")} x1={wallX} y1={clDimY - 4} x2={wallX} y2={clDimY + 4} stroke={P.cl} strokeWidth={P.dimW}/>);
    elements.push(<line key={K("cl-db")} x1={clPx} y1={clDimY - 4} x2={clPx} y2={clDimY + 4} stroke={P.cl} strokeWidth={P.dimW}/>);
    const clTxt = `${fmt(layout.tvCL)} TO TV ${W.CL}`;
    const clMidX = (wallX + clPx) / 2;
    const clW = textW(clTxt, FS(10)) + 8;
    elements.push(<rect key={K("cl-bg")} x={clMidX - clW / 2} y={clDimY - FS(16)} width={clW} height={FS(13)} fill={P.halo} stroke="none" rx="2"/>);
    elements.push(<text key={K("cl-t")} x={clMidX} y={clDimY - FS(6)} textAnchor="middle" fill={P.cl} fontSize={FS(10)} fontWeight="600" fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.5">{clTxt}</text>);

    // tape-out mode: the four lines an installer actually snaps on the wall
    if (showTapeOut) {
      const tTop = floorY - layout.tvTop * scale;
      const tBtm = floorY - layout.tvBottom * scale;
      [["t-top", tTop, `TOP ${fmt(layout.tvTop)} ${W.AFF}`], ["t-btm", tBtm, `${W.BTM} ${fmt(layout.tvBottom)} ${W.AFF}`]].forEach(([id, y, txt]) => {
        elements.push(<line key={K(id)} x1={wallX + 2} y1={y} x2={wallX + wallPxW - 2} y2={y} stroke={P.tape} strokeWidth="1.2" strokeDasharray="10 5" opacity="0.95"/>);
        const w = textW(txt, FS(10)) + 10;
        elements.push(<rect key={K(`${id}-bg`)} x={wallX + 6} y={y - FS(14)} width={w} height={FS(13)} fill={P.halo} rx="2"/>);
        elements.push(<text key={K(`${id}-t`)} x={wallX + 11} y={y - FS(4)} fill={P.tape} fontSize={FS(10)} fontWeight="700" fontFamily="'IBM Plex Mono', monospace">{txt}</text>);
      });
      // The vertical tape labels tuck INWARD from their lines rather than
      // centring on them: a centred right-edge label bleeds into the callout
      // rail, which starts just 16px beyond the TV. On a narrow TV the two
      // would then meet in the middle, so when the span cannot hold both they
      // stagger vertically instead — the usual CAD answer to a tight dimension.
      const tapeV = [["t-l", layout.tvLeft, 1], ["t-r", layout.tvRight, -1]].map(([id, v, dir]) => {
        const txt = fmt(v);
        return { id, v, dir, txt, x: wallX + v * scale, w: textW(txt, FS(10)) + 10 };
      });
      const [tL, tR] = tapeV;
      const tight = (tR.x - 4 - tR.w) < (tL.x + 4 + tL.w);
      tapeV.forEach((e, i) => {
        elements.push(<line key={K(e.id)} x1={e.x} y1={tTop} x2={e.x} y2={floorY - 2} stroke={P.tape} strokeWidth="1.2" strokeDasharray="10 5" opacity="0.95"/>);
        const row = tight && i === 1 ? FS(13) + 3 : 0;          // drop the right one a line
        const bx = e.dir > 0 ? e.x + 4 : e.x - 4 - e.w;
        elements.push(<rect key={K(`${e.id}-bg`)} x={bx} y={floorY - FS(24) + row} width={e.w} height={FS(13)} fill={P.halo} rx="2"/>);
        elements.push(<text key={K(`${e.id}-t`)} x={e.dir > 0 ? e.x + 9 : e.x - 9} y={floorY - FS(14) + row}
          textAnchor={e.dir > 0 ? "start" : "end"} fill={P.tape} fontSize={FS(10)} fontWeight="700"
          fontFamily="'IBM Plex Mono', monospace">{e.txt}</text>);
      });
    }
  }

  if (labelStart < 0) labelStart = elements.length;   // no TV picked yet

  // wall width (bottom)
  const wdY = floorY + 30;
  elements.push(<line key={K("ww")} x1={wallX} y1={wdY} x2={wallX + wallPxW} y2={wdY} stroke={P.line} strokeWidth={P.dimW}/>);
  elements.push(<line key={K("wwa")} x1={wallX} y1={wdY - 4} x2={wallX} y2={wdY + 4} stroke={P.line} strokeWidth={P.dimW}/>);
  elements.push(<line key={K("wwb")} x1={wallX + wallPxW} y1={wdY - 4} x2={wallX + wallPxW} y2={wdY + 4} stroke={P.line} strokeWidth={P.dimW}/>);
  const wwTxt = `${fmtIn(safeWallW, dispUnits)} WALL`;
  const wwW = textW(wwTxt, FS(13)) + 10;
  elements.push(<rect key={K("wwbg")} x={wallX + wallPxW / 2 - wwW / 2} y={wdY + 4} width={wwW} height={FS(17)} rx="2" fill={P.halo} stroke="none"/>);
  elements.push(<text key={K("wwt")} x={wallX + wallPxW / 2} y={wdY + FS(16)} textAnchor="middle" fill={P.dimText} fontSize={FS(13)} fontWeight="600" fontFamily="'IBM Plex Mono', monospace">{wwTxt}</text>);

  // wall height (right, lane-aware)
  const whX = wallX + hDimRelX;
  elements.push(<line key={K("wh")} x1={whX} y1={wallY} x2={whX} y2={floorY} stroke={P.line} strokeWidth={P.dimW}/>);
  elements.push(<line key={K("wha")} x1={whX - 4} y1={wallY} x2={whX + 4} y2={wallY} stroke={P.line} strokeWidth={P.dimW}/>);
  elements.push(<line key={K("whb")} x1={whX - 4} y1={floorY} x2={whX + 4} y2={floorY} stroke={P.line} strokeWidth={P.dimW}/>);
  const whTxt = `${fmtIn(safeWallH, dispUnits)} H`;
  const whW = textW(whTxt, FS(13)) + 10;
  elements.push(<rect key={K("whbg")} x={whX + 4} y={(wallY + floorY) / 2 - FS(8)} width={whW} height={FS(17)} rx="2" fill={P.halo} stroke="none"/>);
  elements.push(<text key={K("wht")} x={whX + 8} y={(wallY + floorY) / 2 + FS(4)} fill={P.dimText} fontSize={FS(13)} fontWeight="600" fontFamily="'IBM Plex Mono', monospace">{whTxt}</text>);

  // Hand markup goes ABOVE the geometry but BELOW the annotation layer, so a
  // scribbled line cannot strike through a dimension the installer has to read.
  // Blanking patches are excluded — they were painted under the schematic.
  const inkMarkup = (markup || []).filter(m => m && m.type !== "mask");
  if (inkMarkup.length) {
    const inkEls = renderMarkupEls(inkMarkup, { wallX, floorY, scale, keyPrefix: K("mk"), fmt, paper: P.maskFill, ts: TS });
    elements.splice(labelStart < 0 ? elements.length : labelStart, 0, ...inkEls);
  }

  // title block + NTS note — stacked on two rows when one can't hold both
  const tbY = svgH - 10;
  if (hasTitleBlock) {
    elements.push(<text key={K("tb")} x={16} y={twoLineBottom ? tbY - 14 : tbY} textAnchor="start" fill={P.title} fontSize={FS(9)} fontFamily="'IBM Plex Mono', monospace" letterSpacing="1">{titleStr}</text>);
  }
  elements.push(<text key={K("nts")} x={svgW - 16} y={tbY} textAnchor="end" fill={P.title} fontSize={FS(9)} fontFamily="'IBM Plex Mono', monospace" letterSpacing="1">{ntsStr}</text>);

  return { elements, svgW, svgH, scale, wallX, wallY, floorY, P, traceOn };
};

// ---- stress sweep -------------------------------------------------------
// Renders ~100 configurations into an offscreen root and bbox-audits every
// label. The collision guarantee, proven config-by-config on demand.
const sweepConfigs = () => {
  const cfgs = [];
  const base = {
    wallW: 120, wallH: 108, fbOpeningW: 40, fbOpeningH: 30, mantelH: 54, mantelDepth: 8,
    fbOffsetIn: 0, hasMantel: true, showVesa: true, showOutlet: true, showLowVolt: true,
    showBoxDims: true, showTvDims: true, showTapeOut: false, showTravel: true, travelIn: 1.5,
    projectName: "Sweep", clientName: "QA", revision: "01", fullWords: false,
    isMobile: false, isTablet: false, viewportW: 1280, heightRef: "center", override: "",
  };
  BRANDS.forEach(brand => TV_CATALOG[brand].forEach(sz => {
    cfgs.push({ ...base, name: `${brand} ${sz} flat/dec/open`, brand, selectedSize: sz, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "dec", hasFireplace: false });
    cfgs.push({ ...base, name: `${brand} ${sz} artic/ftin/fp`, brand, selectedSize: sz, mountSystem: "fa", dispUnits: "ftin", hasFireplace: true, heightRef: "bottom" });
  }));
  BRANDS.forEach(brand => {
    const sizes = TV_CATALOG[brand];
    const big = sizes[sizes.length - 1], small = sizes[0];
    cfgs.push({ ...base, name: `${brand} ${big} high mount`, brand, selectedSize: big, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, override: String(108 - tvDimsFor(brand, big).h / 2 - 1) });
    cfgs.push({ ...base, name: `${brand} ${small} low mount`, brand, selectedSize: small, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "dec", hasFireplace: false, heightRef: "bottom", override: "12" });
    cfgs.push({ ...base, name: `${brand} ${small} mobile/frac/fp`, brand, selectedSize: small, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "frac", hasFireplace: true, isMobile: true, viewportW: 375 });
  });
  // Re-run the densest shapes at the largest type. Text size scales the pads,
  // the plate widths and the rail packing; XL is where those break first.
  const xl = [
    { name: "XL type · 85 fp mantel ftin fullwords", brand: "Sony", selectedSize: 85, wallW: 110, wallH: 100, mountSystem: "fa", dispUnits: "ftin", hasFireplace: true, fullWords: true, showTapeOut: true },
    { name: "XL type · 115 giant wall", brand: "Samsung", selectedSize: 115, wallW: 300, wallH: 140, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, fullWords: true },
    { name: "XL type · 32 cramped 60×72", brand: "Samsung", selectedSize: 32, wallW: 60, wallH: 72, mountSystem: "fa", dispUnits: "ftin", hasFireplace: false, fullWords: true, heightRef: "bottom" },
    { name: "XL type · 65 mobile", brand: "Sony", selectedSize: 65, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "frac", hasFireplace: true, isMobile: true, viewportW: 375, fullWords: true },
  ];
  [1.15, 1.3].forEach(tsv => xl.forEach(c =>
    cfgs.push({ ...base, ...c, name: `${c.name} @${tsv}`, textScale: tsv, showTapeOut: true })));

  cfgs.push({ ...base, name: "offsets fb+20 tv−15 ftin", brand: "Sony", selectedSize: 65, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: true, fbOffsetIn: 20, tvOffsetIn: -15 });
  cfgs.push({ ...base, name: "small wall 84×84 ftin", brand: "Samsung", selectedSize: 43, wallW: 84, wallH: 84, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false });
  cfgs.push({ ...base, name: "narrow wall 70×96 mobile", brand: "LG", selectedSize: 48, wallW: 70, wallH: 96, mountSystem: "fa", dispUnits: "frac", hasFireplace: false, isMobile: true, viewportW: 375 });
  // hostile geometry: tiny scale, cramped walls, TV far off-center, max text width
  cfgs.push({ ...base, name: "giant wall 300×140 ftin", brand: "Samsung", selectedSize: 115, wallW: 300, wallH: 140, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false });
  cfgs.push({ ...base, name: "giant wall small TV", brand: "Sony", selectedSize: 42, wallW: 300, wallH: 140, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, heightRef: "bottom" });
  cfgs.push({ ...base, name: "cramped 60×72 ftin", brand: "Samsung", selectedSize: 32, wallW: 60, wallH: 72, mountSystem: "fa", dispUnits: "ftin", hasFireplace: false, heightRef: "bottom" });
  cfgs.push({ ...base, name: "TV hard left", brand: "Sony", selectedSize: 55, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, tvOffsetIn: -33 });
  cfgs.push({ ...base, name: "TV hard right", brand: "Sony", selectedSize: 55, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, tvOffsetIn: 33, heightRef: "bottom" });
  cfgs.push({ ...base, name: "wide TV near top + ftin + fp", brand: "Samsung", selectedSize: 98, mountSystem: "fa", dispUnits: "ftin", hasFireplace: true, override: String(108 - tvDims(98).h / 2 - 0.5) });
  cfgs.push({ ...base, name: "mobile giant wall", brand: "LG", selectedSize: 97, wallW: 280, wallH: 130, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "frac", hasFireplace: false, isMobile: true, viewportW: 375 });
  // tape-out mode at the extremes
  cfgs.push({ ...base, name: "tape-out open wall ftin", brand: "Sony", selectedSize: 65, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, showTapeOut: true });
  cfgs.push({ ...base, name: "tape-out small TV mobile", brand: "Samsung", selectedSize: 32, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "frac", hasFireplace: true, showTapeOut: true, isMobile: true, viewportW: 375 });
  cfgs.push({ ...base, name: "tape-out wide TV high", brand: "Samsung", selectedSize: 98, mountSystem: "fa", dispUnits: "ftin", hasFireplace: false, showTapeOut: true, override: String(108 - tvDims(98).h / 2 - 1) });
  cfgs.push({ ...base, name: "tape-out offset TV", brand: "LG", selectedSize: 55, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "dec", hasFireplace: false, showTapeOut: true, tvOffsetIn: -25 });
  cfgs.push({ ...base, name: "no TV, long title, narrow wall", brand: "Sony", selectedSize: null, wallW: 80, wallH: 96, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "dec", hasFireplace: false, projectName: "Round Trip Test Estate", clientName: "R. Carter-Wellington" });
  // FULL WORDS mode: longest labels the rail/tape/CL lanes can carry — worst
  // with ft-in units (e.g. LOW VOLTAGE 5' - 3 1/8" ABOVE FLOOR)
  cfgs.push({ ...base, name: "fullwords fp ftin 65", brand: "Sony", selectedSize: 65, mountSystem: "fa", dispUnits: "ftin", hasFireplace: true, fullWords: true });
  cfgs.push({ ...base, name: "fullwords cramped 60×72", brand: "Samsung", selectedSize: 32, wallW: 60, wallH: 72, mountSystem: "fa", dispUnits: "ftin", hasFireplace: false, heightRef: "bottom", fullWords: true });
  cfgs.push({ ...base, name: "fullwords tape-out mobile", brand: "Samsung", selectedSize: 75, mountSystem: "sanus", sanusStyle: "fullmotion", dispUnits: "frac", hasFireplace: false, showTapeOut: true, isMobile: true, viewportW: 375, fullWords: true });
  cfgs.push({ ...base, name: "fullwords TV hard right ftin", brand: "Sony", selectedSize: 55, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, tvOffsetIn: 33, fullWords: true });
  cfgs.push({ ...base, name: "fullwords giant wall ftin", brand: "Samsung", selectedSize: 115, wallW: 300, wallH: 140, mountSystem: "sanus", sanusStyle: "fixed", dispUnits: "ftin", hasFireplace: false, fullWords: true });
  // sanus full-motion + XL tilt: mount pill, big plates, depth callout
  cfgs.push({ ...base, name: "sanus FM 85 ftin", brand: "Samsung", selectedSize: 85, mountSystem: "sanus", sanusStyle: "fullmotion", dispUnits: "ftin", hasFireplace: false });
  cfgs.push({ ...base, name: "sanus FM 48 fp", brand: "Sony", selectedSize: 48, mountSystem: "sanus", sanusStyle: "fullmotion", dispUnits: "dec", hasFireplace: true });
  cfgs.push({ ...base, name: "sanus XL tilt 97", brand: "LG", selectedSize: 97, mountSystem: "sanus", sanusStyle: "tilt", dispUnits: "ftin", hasFireplace: false });
  cfgs.push({ ...base, name: "sanus FM mobile tape", brand: "Samsung", selectedSize: 75, mountSystem: "sanus", sanusStyle: "fullmotion", dispUnits: "frac", hasFireplace: false, showTapeOut: true, isMobile: true, viewportW: 375 });
  return cfgs;
};

const runStressSweep = () => {
  const cfgs = sweepConfigs();
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-100000px;top:0;";
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  const failures = [];
  cfgs.forEach(cfg => {
    const recommended = computeRecommendedCenterH({ selectedSize: cfg.selectedSize, brand: cfg.brand, hasFireplace: cfg.hasFireplace, hasMantel: cfg.hasMantel, mantelH: cfg.mantelH, fbOpeningH: cfg.fbOpeningH, useViewDist: false, viewDist: 144 });
    const centerH = computeCenterH({ mountHeightOverride: cfg.override, heightRef: cfg.heightRef, recommendedCenterH: recommended, selectedSize: cfg.selectedSize, brand: cfg.brand });
    const tvCL = computeTvCL({ wallW: cfg.wallW, hasFireplace: cfg.hasFireplace, fbOffsetIn: cfg.fbOffsetIn || 0, tvOffsetIn: cfg.tvOffsetIn || 0 });
    const boxModel = recommendBackBox(cfg.selectedSize, cfg.mountSystem, cfg.brand);
    const sanusMount = cfg.mountSystem === "sanus" ? recommendSanusMount(cfg.selectedSize, cfg.sanusStyle || "fixed", cfg.brand) : null;
    const layout = computeLayout({ selectedSize: cfg.selectedSize, brand: cfg.brand, centerH, tvCL, showBackBox: true, effectiveBoxModel: boxModel, mountSystem: cfg.mountSystem, sanusMount });
    const schem = buildSchematic({ ...cfg, layout }, SCREEN_PALETTE);
    ReactDOM.flushSync(() => root.render(
      <svg width={schem.svgW} height={schem.svgH} viewBox={`0 0 ${schem.svgW} ${schem.svgH}`} xmlns="http://www.w3.org/2000/svg">{schem.elements}</svg>
    ));
    const svg = host.querySelector("svg");
    const rects = Array.from(svg.querySelectorAll("text")).map(t => { const b = t.getBBox(); return { t: t.textContent, x: b.x, y: b.y, w: b.width, h: b.height }; });
    let overlaps = 0, clipped = 0;
    const pairs = [];
    rects.forEach((q, i) => {
      if (q.x < -1 || q.x + q.w > schem.svgW + 1 || q.y < -1 || q.y + q.h > schem.svgH + 2) { clipped++; pairs.push(`clip: ${q.t}`); }
      for (let j = i + 1; j < rects.length; j++) {
        const p = rects[j];
        if (q.x < p.x + p.w && p.x < q.x + q.w && q.y < p.y + p.h && p.y < q.y + q.h) { overlaps++; pairs.push(`${q.t} ⨯ ${p.t}`); }
      }
    });
    if (overlaps || clipped) failures.push({ name: cfg.name, overlaps, clipped, pairs: pairs.slice(0, 4) });
  });
  root.unmount();
  host.remove();
  return { total: cfgs.length, failures };
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// Catalog mutation. Every write goes through here so the overlay, the effective
// tables and localStorage never drift apart.
const effective = () => ({ TV_CATALOG, BACK_BOXES, SANUS_MOUNTS, SANUS_STYLE_ORDER, VESA_DATA, TV_OVERRIDES, CLEARANCE, FORMULA });
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const writeOverlay = (mutate) => {
  const ov = clone(OVERLAY);
  mutate(ov);
  Object.keys(ov).forEach(id => {                       // drop empty slices
    const sl = ov[id];
    if (sl && !Object.keys(sl.rows || {}).length && !(sl.removed || []).length) delete ov[id];
  });
  saveOverlay(ov);
  applyOverlay(ov);
};
const slice = (ov, id) => (ov[id] = ov[id] || { rows: {}, removed: [] });
const setRow = (id, key, row) => writeOverlay(ov => {
  const sl = slice(ov, id);
  sl.rows[key] = row;
  sl.removed = (sl.removed || []).filter(k => k !== key);
});
const dropRow = (id, key) => writeOverlay(ov => {
  const sl = slice(ov, id);
  delete sl.rows[key];
  if (key in CATALOG_TABLES[id].base()) sl.removed = [...new Set([...(sl.removed || []), key])];
});
const revertRow = (id, key) => writeOverlay(ov => {
  const sl = slice(ov, id);
  delete sl.rows[key];
  sl.removed = (sl.removed || []).filter(k => k !== key);
});
const resetTable = (id) => writeOverlay(ov => { delete ov[id]; });
const resetCatalog = () => writeOverlay(ov => { Object.keys(ov).forEach(k => delete ov[k]); });

// row state vs the shipped baseline — drives the badges
const rowState = (id, key, key2) => {
  const base = CATALOG_TABLES[id].base();
  const eff = effective()[id];
  const b = key2 == null ? base[key] : (base[key] || {})[key2];
  const e = key2 == null ? eff[key] : (eff[key] || {})[key2];
  if (b === undefined) return "added";
  return sameJSON(b, e) ? "stock" : "edited";
};

// ---------------------------------------------------------------------------
const DataScreen = ({ onClose, onChange }) => {
  const [tab, setTab] = useState(TABLE_SCHEMAS[0].id);
  const [, bump] = useState(0);
  const [q, setQ] = useState("");
  const fileRef = useRef(null);
  const schema = TABLE_SCHEMAS.find(t => t.id === tab);
  const eff = effective();
  const table = eff[tab];
  const errs = validateTable(schema, table, eff);
  const touch = () => { bump(n => n + 1); onChange && onChange(); };

  const commit = (fn) => { fn(); touch(); };
  const num = (v) => (v === "" || v == null ? null : (isNaN(parseFloat(v)) ? v : parseFloat(v)));

  const cellErr = (rowKey, col) => {
    const list = errs[rowKey] || [];
    const hit = list.find(([c]) => c === col);
    return hit ? hit[1] : null;
  };

  const Input = ({ col, value, onSet, bad }) => {
    if (col.t === "enum") {
      return (
        <select className={`dcell ${bad ? "bad" : ""}`} value={value ?? ""} onChange={e => onSet(e.target.value)}>
          {col.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input className={`dcell ${bad ? "bad" : ""}`} title={bad || ""}
             type={col.t === "num" ? "number" : "text"} step="any"
             value={value ?? ""} onChange={e => onSet(col.t === "num" ? num(e.target.value) : e.target.value)}/>
    );
  };

  const StateTag = ({ st }) => st === "stock" ? null : (
    <span className={`dtag ${st}`}>{st === "added" ? "CUSTOM" : "EDITED"}</span>
  );

  // ---- per-kind bodies ----
  const recordBody = () => {
    const keys = Object.keys(table).filter(k => !q || (k + JSON.stringify(table[k])).toLowerCase().includes(q.toLowerCase()));
    return (
      <table className="dgrid">
        <thead><tr>
          <th>{schema.keyLabel}</th>
          {schema.cols.map(c => <th key={c.k}>{c.label}{c.unit ? <span className="dunit"> {c.unit}</span> : null}</th>)}
          <th/>
        </tr></thead>
        <tbody>
          {keys.map(key => {
            const row = table[key], st = rowState(tab, key);
            return (
              <tr key={key} className={errs[key] ? "rowbad" : ""}>
                <td className="dkey">{key}<StateTag st={st}/></td>
                {schema.cols.map(c => (
                  <td key={c.k}>
                    <Input col={c} value={row[c.k]} bad={cellErr(key, c.k)}
                           onSet={v => commit(() => setRow(tab, key, { ...row, [c.k]: v }))}/>
                  </td>
                ))}
                <td className="dact">
                  {st !== "stock" && <button className="chip" title="Restore the shipped values" onClick={() => commit(() => revertRow(tab, key))}>REVERT</button>}
                  <button className="chip" title="Remove from the catalog" onClick={() => commit(() => dropRow(tab, key))}>DEL</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const nested2Body = () => {
    const out = [];
    Object.keys(table).forEach(k1 => {
      Object.keys(table[k1]).forEach(k2 => {
        if (q && !(`${k1} ${k2} ${JSON.stringify(table[k1][k2])}`).toLowerCase().includes(q.toLowerCase())) return;
        out.push([k1, k2]);
      });
    });
    return (
      <table className="dgrid">
        <thead><tr>
          <th>{schema.keyLabel}</th><th>{schema.key2Label}</th>
          {schema.cols.map(c => <th key={c.k}>{c.label}{c.unit ? <span className="dunit"> {c.unit}</span> : null}</th>)}
          <th/>
        </tr></thead>
        <tbody>
          {out.map(([k1, k2]) => {
            const row = table[k1][k2], st = rowState(tab, k1, k2), ek = `${k1}\u0000${k2}`;
            const write = (patch) => commit(() => setRow(tab, k1, { ...table[k1], [k2]: { ...row, ...patch } }));
            return (
              <tr key={ek} className={errs[ek] ? "rowbad" : ""}>
                <td className="dkey">{k1}</td>
                <td className="dkey">{k2}"<StateTag st={st}/></td>
                {schema.cols.map(c => (
                  <td key={c.k}>
                    <Input col={c} value={row[c.k]} bad={(errs[ek] || []).find(([cc]) => cc === c.k)?.[1]}
                           onSet={v => write({ [c.k]: v })}/>
                  </td>
                ))}
                <td className="dact">
                  {st !== "stock" && <button className="chip" onClick={() => commit(() => {
                    const base = CATALOG_TABLES[tab].base();
                    const restored = { ...table[k1] };
                    if (base[k1] && base[k1][k2] !== undefined) restored[k2] = clone(base[k1][k2]); else delete restored[k2];
                    sameJSON(restored, base[k1]) ? revertRow(tab, k1) : setRow(tab, k1, restored);
                  })}>REVERT</button>}
                  <button className="chip" onClick={() => commit(() => {
                    const next = { ...table[k1] }; delete next[k2]; setRow(tab, k1, next);
                  })}>DEL</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const listBody = () => (
    <table className="dgrid">
      <thead><tr><th>{schema.keyLabel}</th><th>Values {schema.text ? "(SKUs)" : "(inches)"}</th><th/></tr></thead>
      <tbody>
        {Object.keys(table).filter(k => !q || k.toLowerCase().includes(q.toLowerCase())).map(key => {
          const st = rowState(tab, key);
          const bad = (errs[key] || [])[0];
          return (
            <tr key={key} className={errs[key] ? "rowbad" : ""}>
              <td className="dkey">{key}<StateTag st={st}/></td>
              <td>
                <input className={`dcell wide ${bad ? "bad" : ""}`} title={bad ? bad[1] : ""}
                       value={table[key].join(", ")}
                       onChange={e => {
                         const parts = e.target.value.split(",").map(x => x.trim()).filter(Boolean);
                         commit(() => setRow(tab, key, schema.text ? parts : parts.map(Number)));
                       }}/>
                {bad && <div className="derr">{bad[1]}</div>}
              </td>
              <td className="dact">
                {st !== "stock" && <button className="chip" onClick={() => commit(() => revertRow(tab, key))}>REVERT</button>}
                <button className="chip" onClick={() => commit(() => dropRow(tab, key))}>DEL</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const scalarBody = () => {
    const bad = errs.__scalars || [];
    return (
      <table className="dgrid">
        <thead><tr><th>Setting</th><th>Value</th><th/></tr></thead>
        <tbody>
          {schema.cols.map(c => {
            const st = rowState(tab, c.k);
            const msg = (bad.find(([k]) => k === c.k) || [])[1];
            return (
              <tr key={c.k} className={msg ? "rowbad" : ""}>
                <td className="dkey">{c.label}{c.unit ? <span className="dunit"> {c.unit}</span> : null}<StateTag st={st}/></td>
                <td><Input col={c} value={table[c.k]} bad={msg} onSet={v => commit(() => setRow(tab, c.k, v))}/>
                    {msg && <div className="derr">{msg}</div>}</td>
                <td className="dact">{st !== "stock" && <button className="chip" onClick={() => commit(() => revertRow(tab, c.k))}>REVERT</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const addRow = () => {
    if (schema.kind === "record") {
      let i = 1, key = "CUSTOM-1";
      while (table[key]) key = `CUSTOM-${++i}`;
      commit(() => setRow(tab, key, clone(schema.blank)));
    } else if (schema.kind === "nested2") {
      const k1 = Object.keys(table)[0] || "Custom";
      let sz = 65; while ((table[k1] || {})[sz]) sz++;
      commit(() => setRow(tab, k1, { ...(table[k1] || {}), [sz]: clone(schema.blank) }));
    } else if (schema.kind === "list") {
      let i = 1, key = "Custom";
      while (table[key]) key = `Custom ${++i}`;
      commit(() => setRow(tab, key, schema.text ? [] : [55, 65, 75]));
    }
  };

  const exportOverlay = () => {
    const blob = new Blob([JSON.stringify({ app: "tellavision-catalog", v: 1, overlay: OVERLAY }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tellavision-catalog.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importOverlay = (file) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        const ov = d && d.overlay ? d.overlay : d;
        if (!ov || typeof ov !== "object") throw new Error("not a catalog file");
        writeOverlay(o => { Object.keys(o).forEach(k => delete o[k]); Object.assign(o, ov); });
        touch();
      } catch (e) { alert("Could not read that catalog file: " + e.message); }
    };
    r.readAsText(file);
  };

  const diff = overlayDiff();
  const totalErrs = TABLE_SCHEMAS.reduce((n, sc) => n + Object.keys(validateTable(sc, eff[sc.id], eff)).length, 0);

  return (
    <div className="dwrap">
      <div className="dhead">
        <div>
          <div className="rec-tag">CATALOG DATA</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Measurements &amp; Product Tables</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {overlayCount() > 0 && <span className="dtag edited">{overlayCount()} LOCAL CHANGE{overlayCount() === 1 ? "" : "S"}</span>}
          {totalErrs > 0 && <span className="dtag bad">{totalErrs} PROBLEM{totalErrs === 1 ? "" : "S"}</span>}
          <button className="btn ghost" onClick={exportOverlay}>EXPORT</button>
          <button className="btn ghost" onClick={() => fileRef.current && fileRef.current.click()}>IMPORT</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
                 onChange={e => { const f = e.target.files && e.target.files[0]; if (f) importOverlay(f); e.target.value = ""; }}/>
          <button className="btn ghost" onClick={() => { if (confirm("Discard every local catalog change and return to the shipped data?")) commit(resetCatalog); }}>RESET ALL</button>
          <button className="btn" onClick={onClose}>DONE</button>
        </div>
      </div>
      <div className="dbody">
        <div className="dnav">
          {TABLE_SCHEMAS.map(t => {
            const d = diff[t.id];
            const n = d ? d.added.length + d.edited.length + d.removed.length : 0;
            return (
              <button key={t.id} className={`dnav-item ${tab === t.id ? "on" : ""}`} onClick={() => { setTab(t.id); setQ(""); }}>
                {t.title}{n > 0 && <span className="dtag edited">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="dmain">
          <div className="hint" style={{ marginBottom: 10 }}>{schema.hint}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {schema.kind !== "scalars" && <input className="inp" style={{ maxWidth: 220 }} placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)}/>}
            {schema.kind !== "scalars" && <button className="btn ghost" onClick={addRow}>ADD ROW</button>}
            {diff[tab] && <button className="btn ghost" onClick={() => commit(() => resetTable(tab))}>REVERT THIS TABLE</button>}
          </div>
          <div className="dscroll">
            {schema.kind === "record" && recordBody()}
            {schema.kind === "nested2" && nested2Body()}
            {schema.kind === "list" && listBody()}
            {schema.kind === "scalars" && scalarBody()}
          </div>
          {diff[tab] && diff[tab].removed.length > 0 && (
            <div className="hint" style={{ marginTop: 10 }}>
              Hidden from the shipped catalog: {diff[tab].removed.join(", ")} —{" "}
              <button className="chip" onClick={() => commit(() => diff[tab].removed.forEach(k => revertRow(tab, k)))}>RESTORE</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Icon = ({ name, size = 13 }) => {
  const s = size;
  const st = "currentColor";
  const sw = 1.4;
  const p = {
    wall: <rect x="2" y="2" width={s-4} height={s-4} fill="none" stroke={st} strokeWidth={sw}/>,
    fire: <path d={`M${s/2} 3 C${s/2-2} ${s/2}, ${s-4} ${s/2}, ${s/2+1} ${s-3} C${s/2-3} ${s-4}, ${s/2-4} ${s/2+1}, ${s/2} 3 Z`} fill="none" stroke={st} strokeWidth={sw} strokeLinejoin="round"/>,
    eye: <><path d={`M2 ${s/2} Q${s/2} 2, ${s-2} ${s/2} Q${s/2} ${s-2}, 2 ${s/2} Z`} fill="none" stroke={st} strokeWidth={sw}/><circle cx={s/2} cy={s/2} r="1.6" fill={st}/></>,
    tv: <><rect x="2" y="3" width={s-4} height={s-7} fill="none" stroke={st} strokeWidth={sw}/><line x1={s/2-3} y1={s-2} x2={s/2+3} y2={s-2} stroke={st} strokeWidth={sw}/></>,
    mount: <><rect x="3" y={s/2-1} width={s-6} height="2" fill="none" stroke={st} strokeWidth={sw}/><line x1="2" y1="3" x2="2" y2={s-3} stroke={st} strokeWidth={sw}/><line x1={s-2} y1="3" x2={s-2} y2={s-3} stroke={st} strokeWidth={sw}/></>,
    box: <><rect x="2.5" y="3.5" width={s-5} height={s-7} fill="none" stroke={st} strokeWidth={sw}/><line x1="2.5" y1={s/2} x2={s-2.5} y2={s/2} stroke={st} strokeWidth={sw} strokeDasharray="1.5 1"/></>,
    plug: <><rect x={s/2-3} y="3" width="6" height={s-6} rx="1" fill="none" stroke={st} strokeWidth={sw}/><circle cx={s/2-1} cy={s/2} r="0.8" fill={st}/><circle cx={s/2+1} cy={s/2} r="0.8" fill={st}/></>,
    bolt: <path d={`M${s/2+1} 2 L3 ${s/2+1} L${s/2-1} ${s/2+1} L${s/2-2} ${s-2} L${s-3} ${s/2-1} L${s/2+1} ${s/2-1} Z`} fill="none" stroke={st} strokeWidth={sw} strokeLinejoin="round"/>,
    doc: <><rect x="3" y="2" width={s-6} height={s-4} fill="none" stroke={st} strokeWidth={sw}/><line x1="5" y1={s/2-2} x2={s-5} y2={s/2-2} stroke={st} strokeWidth={sw}/><line x1="5" y1={s/2+1} x2={s-5} y2={s/2+1} stroke={st} strokeWidth={sw}/></>,
    download: <path d={`M${s/2} 2 L${s/2} ${s-5} M${s/2-3} ${s/2+1} L${s/2} ${s-5} L${s/2+3} ${s/2+1} M3 ${s-2} L${s-3} ${s-2}`} fill="none" stroke={st} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>,
    check: <path d={`M3 ${s/2} L${s/2-1} ${s-4} L${s-3} 4`} fill="none" stroke={st} strokeWidth={sw+0.4} strokeLinecap="round" strokeLinejoin="round"/>,
  };
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: "inline-block", verticalAlign: "middle" }}>{p[name]}</svg>;
};

const Sec = ({ icon, title, children, first, defaultOpen = true, summary }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: first ? 0 : 22 }}>
      <div className="sec-title sec-clk" onClick={() => setOpen(o => !o)}>
        <Icon name={icon}/> {title}
        <span className="sec-sum">{!open && summary ? summary : ""}</span>
        <span className={`sec-chev ${open ? "" : "closed"}`}>▾</span>
      </div>
      {open && children}
    </div>
  );
};

const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 10 }}>
    <div className="lbl">{label}</div>
    {children}
    {hint && <div className="hint">{hint}</div>}
  </div>
);

const Check = ({ on, onClick, children }) => (
  <div className="chk-row" onClick={onClick}>
    <div className={`chk ${on ? "on" : ""}`}>{on && <Icon name="check" size={11}/>}</div>
    <span>{children}</span>
  </div>
);

const Seg = ({ options, value, onChange, small }) => (
  <div className={`seg ${small ? "small" : ""}`}>
    {options.map(o => (
      <button key={o.value} className={`seg-btn ${value === o.value ? "on" : ""}`} onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const [wallW, setWallW] = useState(SAVED.wallW ?? 120);
  const [wallH, setWallH] = useState(SAVED.wallH ?? 108);
  const [hasFireplace, setHasFireplace] = useState(SAVED.hasFireplace ?? false);
  const [fbOpeningH, setFbOpeningH] = useState(SAVED.fbOpeningH ?? 30);
  const [fbOpeningW, setFbOpeningW] = useState(SAVED.fbOpeningW ?? 40);
  const [fbOffsetX, setFbOffsetX] = useState(SAVED.fbOffsetX ?? "");
  const [hasMantel, setHasMantel] = useState(SAVED.hasMantel ?? true);
  const [mantelH, setMantelH] = useState(SAVED.mantelH ?? 54);
  const [mantelDepth, setMantelDepth] = useState(SAVED.mantelDepth ?? 8);
  const [viewDist, setViewDist] = useState(SAVED.viewDist ?? 144);
  const [useViewDist, setUseViewDist] = useState(SAVED.useViewDist ?? true);
  const [brand, setBrand] = useState(SAVED_BRAND);
  const [selectedSize, setSelectedSize] = useState(SAVED_SIZE);
  const [tvOffsetX, setTvOffsetX] = useState(SAVED.tvOffsetX ?? "");

  // migration: legacy designs stored mountType; articulating mapped to FA
  const [mountSystem, setMountSystem] = useState(
    SAVED.mountSystem === "fa" || SAVED.mountSystem === "sanus"
      ? SAVED.mountSystem
      : (SAVED.mountType === "articulating" ? "fa" : "sanus"));
  const [sanusStyle, setSanusStyle] = useState(["fixed", "tilt", "fullmotion"].includes(SAVED.sanusStyle) ? SAVED.sanusStyle : "fixed");
  const [sanusMountModel, setSanusMountModel] = useState(SANUS_MOUNTS[SAVED.sanusMountModel] ? SAVED.sanusMountModel : "auto");
  const [tvWeight, setTvWeight] = useState(SAVED.tvWeight ?? "");
  const [showBackBox, setShowBackBox] = useState(SAVED.showBackBox ?? true);
  const [backBoxModel, setBackBoxModel] = useState(BACK_BOXES[canonBoxKey(SAVED.backBoxModel)] ? canonBoxKey(SAVED.backBoxModel) : "FA-WB26");
  const [autoRecommendBox, setAutoRecommendBox] = useState(SAVED.autoRecommendBox ?? true);
  const [showOutlet, setShowOutlet] = useState(SAVED.showOutlet ?? true);
  const [showLowVolt, setShowLowVolt] = useState(SAVED.showLowVolt ?? true);
  const [showVesa, setShowVesa] = useState(SAVED.showVesa ?? true);
  const [showBoxDims, setShowBoxDims] = useState(SAVED.showBoxDims ?? true);
  const [showTvDims, setShowTvDims] = useState(SAVED.showTvDims ?? true);
  const [showTapeOut, setShowTapeOut] = useState(SAVED.showTapeOut ?? false);
  const [showTravel, setShowTravel] = useState(SAVED.showTravel ?? true);
  const [bracketTravel, setBracketTravel] = useState(SAVED.bracketTravel ?? "1.5");
  const [fullWords, setFullWords] = useState(SAVED.fullWords ?? false);

  const [mountHeightOverride, setMountHeightOverride] = useState(SAVED.mountHeightOverride ?? "");
  const [heightRef, setHeightRef] = useState(SAVED.heightRef === "bottom" ? "bottom" : "center");
  const [showAllSizes, setShowAllSizes] = useState(SAVED.showAllSizes ?? false);
  const [projectName, setProjectName] = useState(SAVED.projectName ?? "");
  const [clientName, setClientName] = useState(SAVED.clientName ?? "");
  const [revision, setRevision] = useState(SAVED.revision ?? "01");
  const [dispUnits, setDispUnits] = useState(["dec", "frac", "ftin"].includes(SAVED.dispUnits) ? SAVED.dispUnits : "dec");

  const [viewportW, setViewportW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [activePanel, setActivePanel] = useState("drawing");
  const [showDiag, setShowDiag] = useState(false);
  const [renderAudit, setRenderAudit] = useState({ overlaps: 0, clipped: 0, checked: 0 });
  const [importSummary, setImportSummary] = useState(null);
  const [sweep, setSweep] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // --- reference underlay + markup ---
  // `underlay` holds calibration in state; the bitmap is merged in from
  // IndexedDB on mount (localStorage can't hold a page render).
  const [underlay, setUnderlay] = useState(null);
  const [underlayNote, setUnderlayNote] = useState(null);
  const [markup, setMarkup] = useState(Array.isArray(SAVED.markup) ? SAVED.markup : []);
  const [tool, setTool] = useState("off");   // "off" | "move" | one of MARKUP_TOOLS
  const [textScale, setTextScale] = useState(TEXT_SCALES.some(t => t.v === SAVED.textScale) ? SAVED.textScale : 1);
  const [trace, setTrace] = useState(SAVED.trace !== false);  // ink tuned for tracing over a scan
  const [showData, setShowData] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [startHidden, setStartHidden] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [catalogRev, setCatalogRev] = useState(0);   // bumped when the catalog is edited
  const [mkColor, setMkColor] = useState(MARKUP_COLORS.includes(SAVED.mkColor) ? SAVED.mkColor : MARKUP_COLORS[0]);
  const [mkWidth, setMkWidth] = useState(MARKUP_WIDTHS.includes(SAVED.mkWidth) ? SAVED.mkWidth : 2);
  const [draft, setDraft] = useState(null);  // stroke in progress
  const [calib, setCalib] = useState(null);  // { mode: "two" | "box", pts: [] }
  const [calibAsk, setCalibAsk] = useState(null);
  const [textAsk, setTextAsk] = useState(null);
  const [askValue, setAskValue] = useState("");
  const dragRef = useRef(null);
  const underlayFileRef = useRef(null);
  // Pending picks and the in-progress stroke live in refs, not state: a fast
  // tap or flick can fire down/move/up inside a single React batch, where a
  // stale closure would silently drop the gesture. State mirrors them for
  // rendering only.
  const calibPtsRef = useRef([]);
  const draftRef = useRef(null);
  const [sel, setSel] = useState([]);      // indices into markup (multi-select)
  const [snapOn, setSnapOn] = useState(SAVED.snapOn !== false);
  const [snapHit, setSnapHit] = useState(null);   // live "why it jumped" guides
  const [lasso, setLasso] = useState(null);       // rubber-band rectangle
  const [cropping, setCropping] = useState(false);
  const editRef = useRef(null);            // in-flight move/reshape

  // restore the saved bitmap once, then re-attach the saved calibration
  useEffect(() => {
    if (!SAVED.underlay) return;
    let dead = false;
    idbGet("current").then(rec => {
      if (dead || !rec || !rec.src) return;
      setUnderlay({ opacity: 0.75, visible: true, ...SAVED.underlay,
                    src: rec.src, natW: rec.natW, natH: rec.natH,
                    name: rec.name, page: rec.page, pages: rec.pages });
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = viewportW < 768;
  const isTablet = viewportW >= 768 && viewportW < 1024;

  useEffect(() => {
    try {
      const { src, ...underlayMeta } = underlay || {};
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        markup, mkColor, mkWidth, trace, snapOn, textScale,
        underlay: underlay ? underlayMeta : null,
        wallW, wallH, hasFireplace, fbOpeningH, fbOpeningW, fbOffsetX, hasMantel,
        mantelH, mantelDepth, viewDist, useViewDist, brand, selectedSize, tvOffsetX,
        mountSystem, sanusStyle, sanusMountModel, tvWeight,
        showBackBox, backBoxModel, autoRecommendBox, showOutlet,
        showLowVolt, showVesa, showBoxDims, showTvDims, showTapeOut, showTravel,
        bracketTravel, fullWords, mountHeightOverride, heightRef, showAllSizes,
        projectName, clientName, revision, dispUnits,
      }));
    } catch { /* storage unavailable — run without persistence */ }
  }, [markup, mkColor, mkWidth, trace, snapOn, textScale, underlay,
      wallW, wallH, hasFireplace, fbOpeningH, fbOpeningW, fbOffsetX, hasMantel,
      mantelH, mantelDepth, viewDist, useViewDist, brand, selectedSize, tvOffsetX,
      mountSystem, sanusStyle, sanusMountModel, tvWeight,
      showBackBox, backBoxModel, autoRecommendBox, showOutlet,
      showLowVolt, showVesa, showBoxDims, showTvDims, showTapeOut, showTravel,
      bracketTravel, fullWords, mountHeightOverride, heightRef, showAllSizes,
      projectName, clientName, revision, dispUnits]);

  const resetAll = () => {
    try { window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}
    idbDel("current").catch(() => {}).then(() => window.location.reload());
  };

  // ----- engine wiring (thin memos around pure functions) -----
  const selfTest = useMemo(() => runSelfTests(), []);
  const fmt = (v) => fmtIn(v, dispUnits);

  const fbOffsetIn = parseFloat(fbOffsetX) || 0;
  const tvOffsetIn = parseFloat(tvOffsetX) || 0;
  const travelIn = parseFloat(bracketTravel) || 0;
  const engineInputs = { brand, wallW, wallH, hasFireplace, hasMantel, mantelH, fbOpeningH, useViewDist, viewDist, catalogRev };

  // NOTE: catalogRev is a dependency of every memo below that touches the
  // catalog tables — editing data in the Data screen has to repaint the
  // drawing, and these memos would otherwise hold stale dimensions.
  const recommendations = useMemo(() => computeRecommendations({ brand, ...engineInputs }),
    [brand, wallW, wallH, hasFireplace, hasMantel, mantelH, fbOpeningH, useViewDist, viewDist, catalogRev]);

  const recommendedCenterH = useMemo(() => computeRecommendedCenterH({ selectedSize, ...engineInputs }),
    [selectedSize, brand, hasFireplace, hasMantel, mantelH, fbOpeningH, useViewDist, viewDist, catalogRev]);

  const centerH = useMemo(() => computeCenterH({ mountHeightOverride, heightRef, recommendedCenterH, selectedSize, brand }),
    [mountHeightOverride, heightRef, recommendedCenterH, selectedSize, brand, catalogRev]);

  const recommendedBox = useMemo(() => recommendBackBox(selectedSize, mountSystem, brand), [selectedSize, mountSystem, brand, catalogRev]);
  const recommendedMount = useMemo(() => recommendSanusMount(selectedSize, sanusStyle, brand), [selectedSize, sanusStyle, brand, catalogRev]);
  const sanusMount = useMemo(() => {
    if (mountSystem !== "sanus") return null;
    if (sanusMountModel === "auto") return recommendedMount;
    const m = SANUS_MOUNTS[sanusMountModel];
    if (!m) return recommendedMount;
    const spec = selectedSize ? (VESA_DATA[brand]?.[selectedSize] || null) : null;
    return {
      key: sanusMountModel, ...m,
      sizeOk: !selectedSize || (selectedSize >= m.tvMin && selectedSize <= m.tvMax),
      vesaOk: vesaFitsMount(spec, m),
      styleFallback: false,
    };
  }, [mountSystem, sanusMountModel, recommendedMount, selectedSize, brand, catalogRev]);
  const tvWeightLbs = parseFloat(tvWeight) || 0;
  const effectiveBoxModel = autoRecommendBox && recommendedBox ? recommendedBox : backBoxModel;
  const vesaSpec = selectedSize ? (VESA_DATA[brand]?.[selectedSize] || null) : null;

  const tvCL = computeTvCL({ wallW, hasFireplace, fbOffsetIn, tvOffsetIn });

  const layout = useMemo(() => computeLayout({ selectedSize, brand, centerH, tvCL, showBackBox, effectiveBoxModel, mountSystem, sanusMount }),
    [selectedSize, brand, centerH, tvCL, showBackBox, effectiveBoxModel, mountSystem, sanusMount, catalogRev]);

  const placementIssues = useMemo(() => computePlacementIssues({ layout, wallW, wallH, hasFireplace, fbOpeningW, fbOffsetIn }),
    [layout, wallW, wallH, hasFireplace, fbOpeningW, fbOffsetIn]);

  // engine-computed display values (UI does no arithmetic)
  const recommendedDisplayH = heightRef === "bottom" && selectedSize
    ? recommendedCenterH - tvDimsFor(brand, selectedSize).h / 2 : recommendedCenterH;
  const equivalentH = selectedSize
    ? (heightRef === "bottom" ? recommendedCenterH : convertOverride(recommendedCenterH, "bottom", brand, selectedSize))
    : null;
  const specPanel = selectedSize ? (TV_OVERRIDES[brand]?.[selectedSize] || null) : null;
  const effWeightLbs = tvWeightLbs > 0 ? tvWeightLbs : (specPanel?.weightLbs || 0);

  // ----- schematic: screen (navy blueprint) + print (white blueline) -----
  const schemState = {
    wallW, wallH, hasFireplace, fbOpeningW, fbOpeningH, fbOffsetIn, hasMantel,
    mantelH, mantelDepth, brand, selectedSize, layout, heightRef, mountSystem,
    showVesa, showOutlet, showLowVolt, showBoxDims, showTvDims, showTapeOut,
    showTravel, travelIn, fullWords, projectName, clientName, revision,
    dispUnits, isMobile, isTablet, viewportW, underlay, markup, trace, catalogRev, textScale,
  };
  const screenSchem = useMemo(() => buildSchematic(schemState, SCREEN_PALETTE),
    [wallW, wallH, hasFireplace, fbOpeningW, fbOpeningH, fbOffsetIn, hasMantel, mantelH, mantelDepth,
     brand, selectedSize, layout, heightRef, mountSystem, showVesa, showOutlet, showLowVolt,
     showBoxDims, showTvDims, showTapeOut, showTravel, travelIn, fullWords,
     projectName, clientName, revision, dispUnits, isMobile, isTablet, viewportW, underlay, markup, trace, catalogRev, textScale]);
  const printSchem = useMemo(() => buildSchematic({ ...schemState, isMobile: false, isTablet: false, viewportW: 1280 }, PRINT_PALETTE),
    [wallW, wallH, hasFireplace, fbOpeningW, fbOpeningH, fbOffsetIn, hasMantel, mantelH, mantelDepth,
     brand, selectedSize, layout, heightRef, mountSystem, showVesa, showOutlet, showLowVolt,
     showBoxDims, showTvDims, showTapeOut, showTravel, travelIn, fullWords,
     projectName, clientName, revision, dispUnits, underlay, markup, trace, catalogRev, textScale]);

  const svgRef = useRef(null);
  const printRef = useRef(null);
  const fileRef = useRef(null);

  // render audit: measure every real text bbox; overlaps/out-of-bounds → flag
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const id = setTimeout(() => {
      try {
        const texts = Array.from(svg.querySelectorAll("text"));
        const rects = texts.map(t => { const b = t.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
        let overlaps = 0, clipped = 0;
        const W = screenSchem.svgW, H = screenSchem.svgH;
        rects.forEach((r, i) => {
          if (r.x < -1 || r.x + r.w > W + 1 || r.y < -1 || r.y + r.h > H + 1) clipped++;
          for (let j = i + 1; j < rects.length; j++) {
            const q = rects[j];
            if (r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h) overlaps++;
          }
        });
        setRenderAudit({ overlaps, clipped, checked: rects.length });
        if (overlaps || clipped) console.warn(`[render audit] ${overlaps} overlaps, ${clipped} clipped labels`);
      } catch { /* getBBox unavailable mid-layout — skip this pass */ }
    }, 150);
    return () => clearTimeout(id);
  }, [screenSchem]);

  // ----- reference underlay: import, calibrate, annotate -----------------
  const pdfBufRef = useRef(null);   // kept so the page picker can re-render

  const stashUnderlay = (rec) => {
    idbSet("current", { src: rec.src, natW: rec.natW, natH: rec.natH, name: rec.name, page: rec.page, pages: rec.pages })
      .catch(() => setUnderlayNote("Imported, but too large to save offline — it won't survive a reload"));
  };

  const adoptRaster = (raster, name, page) => {
    const fit = fitUnderlay(raster.natW, raster.natH, wallW, wallH);
    const rec = { src: raster.src, natW: raster.natW, natH: raster.natH, name, page,
                  pages: raster.pages, ...fit, opacity: 0.75, visible: true, fitSheet: false };
    setUnderlay(rec);
    stashUnderlay(rec);
    setTool("off");
    setUnderlayNote(`${name}${raster.pages > 1 ? ` · page ${page}/${raster.pages}` : ""} — now calibrate the scale`);
  };

  const importUnderlay = async (file) => {
    setUnderlayNote("Reading…");
    try {
      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
        const buf = await file.arrayBuffer();
        pdfBufRef.current = new Uint8Array(buf);
        const raster = await rasterizePdfPage(pdfBufRef.current.slice().buffer, 1);
        adoptRaster(raster, file.name, 1);
      } else {
        pdfBufRef.current = null;
        const raster = await rasterizeImageFile(file);
        adoptRaster(raster, file.name, 1);
      }
    } catch (err) {
      setUnderlayNote(err && err.message ? err.message : "Could not import that file");
    }
  };

  // Page switching keeps the current calibration — a multi-page set is normally
  // plotted at one scale, so re-calibrating every page would be busywork.
  const gotoPage = async (n) => {
    if (!pdfBufRef.current || !underlay) return;
    setUnderlayNote("Rendering page " + n + "…");
    try {
      const raster = await rasterizePdfPage(pdfBufRef.current.slice().buffer, n);
      const keep = raster.natW === underlay.natW && raster.natH === underlay.natH;
      const fit = keep ? {} : fitUnderlay(raster.natW, raster.natH, wallW, wallH);
      const rec = { ...underlay, src: raster.src, natW: raster.natW, natH: raster.natH,
                    page: n, pages: raster.pages, ...fit };
      setUnderlay(rec);
      stashUnderlay(rec);
      setUnderlayNote(keep ? `Page ${n}/${raster.pages} — calibration kept`
                           : `Page ${n}/${raster.pages} — different page size, re-calibrate`);
    } catch (err) {
      setUnderlayNote(err && err.message ? err.message : "Could not render that page");
    }
  };

  const clearUnderlay = () => {
    setUnderlay(null); setCalib(null); setTool("off"); setUnderlayNote(null);
    pdfBufRef.current = null;
    idbDel("current").catch(() => {});
  };

  // --- screen <-> wall-inch mapping (all interaction happens in inches) ---
  const svgPt = (e) => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: (e.clientX - r.left) * (screenSchem.svgW / r.width),
             y: (e.clientY - r.top) * (screenSchem.svgH / r.height) };
  };
  const toIn = (p) => ({ x: (p.x - screenSchem.wallX) / screenSchem.scale,
                         y: (screenSchem.floorY - p.y) / screenSchem.scale });
  const toPx = (q) => ({ x: screenSchem.wallX + q.x * screenSchem.scale,
                         y: screenSchem.floorY - q.y * screenSchem.scale });

  const interactive = tool !== "off" || !!calib || cropping;
  // A grab radius that feels the same at any drawing scale.
  const grabIn = () => 9 / Math.max(screenSchem.scale, 0.001);

  const patchSel = (fn) => setMarkup(ms => ms.map((m, i) => (sel.includes(i) ? fn(m) : m)));
  const deleteSel = () => { setMarkup(ms => ms.filter((_, i) => !sel.includes(i))); setSel([]); };
  const solo = sel.length === 1 ? markup[sel[0]] : null;   // handles only make sense on one item

  // Snap a point unless the user has turned snapping off (or holds Alt).
  const snap = (q, other, e) => {
    if (!snapOn || (e && e.altKey)) { setSnapHit(null); return q; }
    const r = snapPoint(q, snapAnchors(layout, wallW, wallH), grabIn(), other);
    setSnapHit(r.hitX || r.hitY ? { x: r.hitX, y: r.hitY, at: r } : null);
    return { x: r.x, y: r.y };
  };

  const applyTwoPoint = () => {
    const v = parseLenIn(askValue);
    if (!underlay || !calibAsk || !(v > 0)) { setUnderlayNote('Enter a length like 96, 8\' or 8\' 6"'); return; }
    const next = calibrateTwoPoint(underlay, calibAsk.p1, calibAsk.p2, v);
    if (next) setUnderlay(next);
    setUnderlayNote(next ? `Calibrated — that span now reads ${fmtIn(v, dispUnits)}` : "Pick two separated points");
    setCalibAsk(null); setCalib(null); calibPtsRef.current = []; setAskValue(""); setTool("off");
  };

  const applyBoxCalib = (a, b) => {
    if (!underlay || !selectedSize) { setCalib(null); return; }
    const realW = tvDimsFor(brand, selectedSize).w;
    const target = layout ? { x: layout.tvCL, y: layout.centerH } : null;
    const next = calibrateToBox(underlay, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, realW, target);
    if (next) {
      setUnderlay(next);
      setUnderlayNote(`Snapped to the ${selectedSize}" panel — ${fmtIn(realW, dispUnits)} across`);
    }
    setCalib(null); calibPtsRef.current = []; setTool("off");
  };

  const onPtrDown = (e) => {
    if (!interactive) return;
    const p = svgPt(e); if (!p) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const q = toIn(p);
    if (calib) {
      if (calib.mode === "box") {
        dragRef.current = { box: true };
        calibPtsRef.current = [q, q];
        setCalib(c => c && ({ ...c, pts: [q, q] }));
      }
      else {
        const pts = [...calibPtsRef.current, q].slice(-2);
        calibPtsRef.current = pts;
        setCalib(c => c && ({ ...c, pts, hover: null }));
        if (pts.length === 2) { setCalibAsk({ p1: pts[0], p2: pts[1] }); setAskValue(""); }
      }
      return;
    }
    if (tool === "move") { dragRef.current = { start: q, ox: underlay?.ox ?? 0, oy: underlay?.oy ?? 0 }; return; }
    if (cropping) { dragRef.current = { crop: true, a: q, b: q }; setLasso({ a: q, b: q }); return; }
    if (tool === "select") {
      const tol = grabIn();
      // a handle on a single selected item beats everything else
      if (solo) {
        const h = handlesFor(solo).find(pt => Math.hypot(q.x - pt.x, q.y - pt.y) <= tol * 1.3);
        if (h) { editRef.current = { mode: "handle", ix: h.ix, idx: sel[0] }; return; }
      }
      const hit = hitMarkup(markup, q, tol);
      if (hit < 0) {
        // empty space starts a rubber-band rather than doing nothing
        if (!e.shiftKey) setSel([]);
        editRef.current = { mode: "lasso", a: q, add: e.shiftKey ? sel : [] };
        setLasso({ a: q, b: q });
        return;
      }
      const next = e.shiftKey
        ? (sel.includes(hit) ? sel.filter(i => i !== hit) : [...sel, hit])
        : (sel.includes(hit) ? sel : [hit]);
      setSel(next);
      editRef.current = { mode: "body", idx: next, last: q };
      return;
    }
    if (tool === "text") { setTextAsk({ pt: q }); setAskValue(""); return; }
    const q0 = snap(q, null, e);
    const started = { id: `m${markup.length}-${Math.round(q0.x * 100)}`, type: tool, color: mkColor, w: mkWidth, pts: [q0, q0] };
    draftRef.current = started;
    setDraft(started);
  };

  const onPtrMove = (e) => {
    if (!interactive) return;
    const p = svgPt(e); if (!p) return;
    const q = toIn(p);
    if (calib) {
      if (calib.mode === "box" && dragRef.current && dragRef.current.box) {
        const a0 = calibPtsRef.current[0] || q;
        calibPtsRef.current = [a0, q];
        setCalib(c => c && ({ ...c, pts: [a0, q] }));
      }
      else if (calib.mode === "two" && calib.pts.length === 1) setCalib(c => c && ({ ...c, hover: q }));
      return;
    }
    if (dragRef.current && dragRef.current.crop) { dragRef.current.b = q; setLasso({ a: dragRef.current.a, b: q }); return; }
    if (tool === "select") {
      const ed = editRef.current;
      if (!ed) return;
      if (ed.mode === "lasso") { ed.b = q; setLasso({ a: ed.a, b: q }); return; }
      if (ed.mode === "handle") {
        const m0 = markup[ed.idx];
        const other = m0 && m0.pts.length === 2 ? m0.pts[1 - ed.ix] : null;
        const qs = snap(q, m0 && m0.type !== "rect" && m0.type !== "mask" ? other : null, e);
        setMarkup(ms => ms.map((m, i) => (i === ed.idx ? moveHandle(m, ed.ix, qs) : m)));
      } else {
        const dx = q.x - ed.last.x, dy = q.y - ed.last.y;
        ed.last = q;
        setMarkup(ms => ms.map((m, i) => (ed.idx.includes(i) ? translateMarkup(m, dx, dy) : m)));
      }
      return;
    }
    if (tool === "move" && dragRef.current && underlay) {
      const d = dragRef.current;
      setUnderlay(u => u && ({ ...u, ox: d.ox + (q.x - d.start.x), oy: d.oy + (q.y - d.start.y) }));
      return;
    }
    const cur = draftRef.current;
    if (!cur) return;
    const qs = cur.type === "pen" ? q : snap(q, cur.type === "rect" || cur.type === "mask" ? null : cur.pts[0], e);
    const next = cur.type === "pen" ? { ...cur, pts: [...cur.pts, q] } : { ...cur, pts: [cur.pts[0], qs] };
    draftRef.current = next;
    setDraft(next);
  };

  const onPtrUp = () => {
    if (calib && calib.mode === "box" && dragRef.current && dragRef.current.box) {
      dragRef.current = null;
      const [a, b] = calibPtsRef.current || [];
      calibPtsRef.current = [];
      if (a && b && Math.abs(b.x - a.x) > 0.5) applyBoxCalib(a, b);
      else setCalib(c => c && ({ ...c, pts: [] }));
      return;
    }
    if (dragRef.current && dragRef.current.crop) {
      const l = dragRef.current; dragRef.current = null; setLasso(null); setCropping(false);
      if (l && underlay) {
        const x = Math.min(l.a.x, l.b.x), y = Math.min(l.a.y, l.b.y);
        const w = Math.abs(l.b.x - l.a.x), h = Math.abs(l.b.y - l.a.y);
        if (w > 1 && h > 1) { setUnderlay(u => u && ({ ...u, crop: { x, y, w, h } })); setUnderlayNote("Sheet cropped — everything outside the box is hidden"); }
      }
      return;
    }
    if (tool === "select") {
      const ed = editRef.current;
      if (ed && ed.mode === "lasso" && ed.b) {
        const x1 = Math.min(ed.a.x, ed.b.x), x2 = Math.max(ed.a.x, ed.b.x);
        const y1 = Math.min(ed.a.y, ed.b.y), y2 = Math.max(ed.a.y, ed.b.y);
        const inside = [];
        markup.forEach((m, i) => {
          if (!m || !m.pts || !m.pts.length) return;
          if (m.pts.some(pt => pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2)) inside.push(i);
        });
        setSel([...new Set([...(ed.add || []), ...inside])]);
      }
      setLasso(null); setSnapHit(null); editRef.current = null; dragRef.current = null; return;
    }
    setSnapHit(null);
    dragRef.current = null;
    const cur = draftRef.current;
    if (!cur) return;
    draftRef.current = null;
    const done = cur.type === "pen" ? { ...cur, pts: simplifyPts(cur.pts) } : cur;
    setDraft(null);
    if (done.type === "pen" ? done.pts.length > 1 : markupSpan(done) > 0.5) setMarkup(m => [...m, done]);
  };

  const undoMarkup = () => { setMarkup(m => m.slice(0, -1)); setSel([]); };

  // Delete / Escape while a markup item is picked. Ignored while typing.
  useEffect(() => {
    if (tool !== "select") return;
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "Escape") { setSel([]); setLasso(null); setCropping(false); editRef.current = null; }
      else if ((e.key === "Delete" || e.key === "Backspace") && sel.length) { e.preventDefault(); deleteSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, sel]);

  // ----- exports (always from the print/blueline render) -----
  const exportName = (ext) => {
    const base = (projectName.trim() || "tv-layout").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "tv-layout";
    return `${base}-${selectedSize ? selectedSize + "in" : "wall"}.${ext}`;
  };

  const exportSVG = () => {
    if (!printRef.current) return;
    const svgData = new XMLSerializer().serializeToString(printRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportName("svg");
    a.click();
    URL.revokeObjectURL(url);
  };

  const designState = {
    wallW, wallH, hasFireplace, fbOpeningH, fbOpeningW, fbOffsetX, hasMantel,
    mantelH, mantelDepth, viewDist, useViewDist, brand, selectedSize, tvOffsetX,
    mountSystem, sanusStyle, sanusMountModel, tvWeight,
    showBackBox, backBoxModel, autoRecommendBox, showOutlet,
    showLowVolt, showVesa, showBoxDims, showTvDims, showTapeOut, showTravel,
    bracketTravel, fullWords, mountHeightOverride, heightRef, showAllSizes,
    projectName, clientName, revision, dispUnits,
    markup,
    // calibration only — the bitmap itself stays in IndexedDB, so a shared
    // JSON re-imports the annotations and scale but not the drawing
    underlay: underlay ? (({ src, ...meta }) => meta)(underlay) : null,
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(buildExportJSON(designState, layout), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportName("json");
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDXF = () => {
    if (!layout) return;
    const dxf = buildDXF({
      wallW, wallH, hasFireplace, fbOpeningW, fbOpeningH, fbOffsetIn, hasMantel,
      mantelH, mantelDepth, brand, selectedSize, dispUnits,
      showVesa, showOutlet, showLowVolt, showBoxDims, showTapeOut,
      heightRef, projectName, clientName, revision, markup,
    }, layout);
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportName("dxf");
    a.click();
    URL.revokeObjectURL(url);
  };

  // The deliverable trio in one click: data, submittal sheet, CAD geometry.
  const exportPack = () => { exportJSON(); exportDXF(); exportPDF(); };

  // Apply extracted fields (native or foreign) with the same validation the
  // boot loader uses. Only sets what was found — never resets the rest.
  const applyImport = (extracted) => {
    const f = extracted.fields;
    const notes = [...extracted.notes];
    let brandNext = brand;
    if (f.brand && BRANDS.includes(f.brand)) { brandNext = f.brand; setBrand(f.brand); }
    if (f.selectedSize != null && typeof f.selectedSize === "number") {
      const sizes = TV_CATALOG[brandNext];
      const sz = sizes.includes(f.selectedSize) ? f.selectedSize
        : sizes.reduce((best, s) => Math.abs(s - f.selectedSize) < Math.abs(best - f.selectedSize) ? s : best, sizes[0]);
      if (sz !== f.selectedSize) notes.push(`size ${f.selectedSize}" snapped to nearest ${brandNext} catalog size ${sz}"`);
      setSelectedSize(sz);
    }
    const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
    if (num(f.wallW) != null) setWallW(f.wallW);
    if (num(f.wallH) != null) setWallH(f.wallH);
    if (typeof f.hasFireplace === "boolean") setHasFireplace(f.hasFireplace);
    if (num(f.fbOpeningW) != null) setFbOpeningW(f.fbOpeningW);
    if (num(f.fbOpeningH) != null) setFbOpeningH(f.fbOpeningH);
    if (typeof f.fbOffsetX === "string" || num(f.fbOffsetX) != null) setFbOffsetX(String(f.fbOffsetX));
    if (typeof f.hasMantel === "boolean") setHasMantel(f.hasMantel);
    if (num(f.mantelH) != null) setMantelH(f.mantelH);
    if (num(f.mantelDepth) != null) setMantelDepth(f.mantelDepth);
    if (num(f.viewDist) != null) setViewDist(f.viewDist);
    if (typeof f.useViewDist === "boolean") setUseViewDist(f.useViewDist);
    if (typeof f.tvOffsetX === "string" || num(f.tvOffsetX) != null) setTvOffsetX(String(f.tvOffsetX));
    if (f.mountSystem === "sanus" || f.mountSystem === "fa") setMountSystem(f.mountSystem);
    else if (f.mountType === "articulating") setMountSystem("fa");
    else if (f.mountType === "flat") setMountSystem("sanus");
    if (["fixed", "tilt", "fullmotion"].includes(f.sanusStyle)) setSanusStyle(f.sanusStyle);
    if (SANUS_MOUNTS[f.sanusMountModel]) setSanusMountModel(f.sanusMountModel);
    if (typeof f.tvWeight === "string") setTvWeight(f.tvWeight);
    if (typeof f.showBackBox === "boolean") setShowBackBox(f.showBackBox);
    if (BACK_BOXES[canonBoxKey(f.backBoxModel)]) setBackBoxModel(canonBoxKey(f.backBoxModel));
    if (typeof f.autoRecommendBox === "boolean") setAutoRecommendBox(f.autoRecommendBox);
    if (typeof f.showOutlet === "boolean") setShowOutlet(f.showOutlet);
    if (typeof f.showLowVolt === "boolean") setShowLowVolt(f.showLowVolt);
    if (typeof f.showVesa === "boolean") setShowVesa(f.showVesa);
    if (typeof f.fullWords === "boolean") setFullWords(f.fullWords);
    if (typeof f.mountHeightOverride === "string") setMountHeightOverride(f.mountHeightOverride);
    if (f.heightRef === "center" || f.heightRef === "bottom") setHeightRef(f.heightRef);
    if (typeof f.projectName === "string") setProjectName(f.projectName);
    if (typeof f.clientName === "string") setClientName(f.clientName);
    if (typeof f.revision === "string") setRevision(f.revision);
    if (["dec", "frac", "ftin"].includes(f.dispUnits)) setDispUnits(f.dispUnits);
    setImportSummary({ matched: extracted.matched, ignored: extracted.ignored, notes, native: extracted.native });
  };

  const importJSONFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const ex = extractImportedDesign(data);
        if (!ex.native && ex.matched.length === 0) {
          setImportSummary({ matched: [], ignored: ex.ignored, notes: ["No TV-relevant fields found in this file"], native: false });
          return;
        }
        applyImport(ex);
      } catch (err) {
        setImportSummary({ matched: [], ignored: 0, notes: [`Could not parse JSON: ${err.message}`], native: false });
      }
    };
    reader.readAsText(file);
  };

  // Every entry point — the IMPORT menu, a drag-drop, the start panel — lands
  // here. A drawing and a data file are different jobs, so we route on type
  // rather than making the user pre-declare which one they have.
  const looksLikeDrawing = (f) => /\.(pdf|png|jpe?g|webp|gif|heic|heif)$/i.test(f.name) || /^image\//.test(f.type) || f.type === "application/pdf";
  const looksLikeData = (f) => /\.json$/i.test(f.name) || f.type === "application/json";
  const routeFiles = (list) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    const drawing = files.find(looksLikeDrawing);
    const data = files.find(looksLikeData);
    if (drawing) importUnderlay(drawing);
    if (data) importJSONFile(data);
    if (!drawing && !data) {
      setImportSummary({ matched: [], ignored: files.length, native: false,
        notes: [`Not something this app can read: ${files.map(f => f.name).join(", ")}`,
                "Drop a PDF or image to trace over, or a JSON design / survey file"] });
    }
    setStartHidden(true);
  };

  const exportPNG = () => {
    if (!printRef.current) return;
    const svgData = new XMLSerializer().serializeToString(printRef.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = printSchem.svgW * 2;
      canvas.height = printSchem.svgH * 2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { URL.revokeObjectURL(url); return; }
        const purl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = purl;
        a.download = exportName("png");
        a.click();
        URL.revokeObjectURL(purl);
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const exportPDF = () => {
    if (!printRef.current || !selectedSize || !layout) return;
    const svgData = new XMLSerializer().serializeToString(printRef.current);
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const sideTxt = (x) => {
      const d = x - layout.tvCL;
      if (Math.abs(d) < 0.05) return "on TV centerline";
      return `${fmt(Math.abs(d))} ${d < 0 ? "left" : "right"} of TV centerline`;
    };
    const specRows = [
      ["TV", `${brand} ${selectedSize}"`],
      ["TV Width", fmt(layout.tvW)],
      ["TV Height", fmt(layout.tvH)],
      ["Center to floor", fmt(layout.centerH)],
      ["Bottom to floor", fmt(layout.tvBottom)],
      ["TV centerline", `${fmt(layout.tvCL)} from left wall edge`],
      ["Mount", layout.mount ? (layout.mount.system === "fa" ? "Future Automation articulating bracket" : `Sanus Black ${layout.mount.model} (${layout.mount.name})`) : "TBD"],
    ];
    if (layout.mount?.system === "sanus") {
      specRows.push(["Mount depth", `${fmt(layout.mount.depth)} off wall${layout.mount.ext ? `, extends to ${fmt(layout.mount.ext)}` : ""}`]);
    }
    if (specPanel) {
      if (specPanel.weightLbs) specRows.push(["Panel weight", `${specPanel.weightLbs} lbs (spec sheet)`]);
      if (specPanel.d && layout.mount?.system === "sanus") specRows.push(["Total off wall", `≈ ${fmt(layout.mount.depth + specPanel.d)} (mount + panel)`]);
    }
    if (layout.box) {
      specRows.push(["Back box", `${layout.box.brand} ${layout.box.label}`]);
      specRows.push(["Box dimensions", `${layout.box.w}" x ${layout.box.h}" x ${layout.box.d}"D`]);
    }
    if (showBoxDims && layout.box) {
      specRows.push(["Box bottom edge", `${fmt(layout.box.btm)} AFF`]);
      const bd = layout.box.btm - layout.tvBottom;
      specRows.push(["Box bottom vs TV bottom", `${fmt(Math.abs(bd))} ${bd >= 0 ? "above" : "below"} TV bottom`]);
      if (hasFireplace && hasMantel) specRows.push(["Box bottom above mantel", fmt(layout.box.btm - mantelH)]);
    }
    if (showTapeOut) {
      specRows.push(["Tape: top edge", `${fmt(layout.tvTop)} AFF`]);
      specRows.push(["Tape: bottom edge", `${fmt(layout.tvBottom)} AFF`]);
      specRows.push(["Tape: left edge", `${fmt(layout.tvLeft)} from left wall`]);
      specRows.push(["Tape: right edge", `${fmt(layout.tvRight)} from left wall`]);
    }
    if (showOutlet) specRows.push(["Power outlet", `${fmt(layout.outlet.aff)} AFF, ${sideTxt(layout.outlet.x)}`]);
    if (showLowVolt) specRows.push(["Low-voltage feed", `${fmt(layout.lv.aff)} AFF, ${sideTxt(layout.lv.x)}`]);
    if (layout.vesa) {
      specRows.push(["VESA pattern", `${layout.vesa.spec.w_mm} x ${layout.vesa.spec.h_mm} mm`]);
      specRows.push(["VESA screw", layout.vesa.spec.screw]);
    }
    specRows.push(["Wall dimensions", `${fmt(wallW)} W x ${fmt(wallH)} H`]);
    if (hasFireplace) {
      specRows.push(["Fireplace opening", `${fmt(fbOpeningW)} W x ${fmt(fbOpeningH)} H`]);
      if (fbOffsetIn !== 0) specRows.push(["Fireplace offset", `${fmt(Math.abs(fbOffsetIn))} ${fbOffsetIn < 0 ? "left" : "right"} of wall center`]);
      if (hasMantel) specRows.push(["Mantel top", `${fmt(mantelH)} from floor`]);
    }
    const parts = buildPartsList({ layout, showOutlet, showLowVolt });
    const docTitle = projectName.trim() ? `${projectName.trim()} — ${brand} ${selectedSize}"` : `TellaVision — ${brand} ${selectedSize}"`;
    const metaHtml = "Front Elevation · REV " + (revision || "01") + (clientName.trim() ? "<br/>" + clientName.trim() : "") + "<br/>" + today;
    const specRowsHtml = specRows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");
    const partsHtml = parts.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");
    const legendHtml = ABBREVIATIONS.map(([a, f]) => `<span><strong>${a}</strong> ${f}</span>`).join("");
    const vesaNote = layout.vesa && layout.vesa.spec.note ? `<p style="margin:8px 0 0 0;"><strong>${brand} ${selectedSize}":</strong> ${layout.vesa.spec.note}</p>` : "";
    const bbNote = layout.box && layout.box.note ? `<p style="margin:8px 0 0 0;"><strong>Back box:</strong> ${layout.box.note}</p>` : "";
    const ratingNote = layout.box && layout.box.underRated ? `<p style="margin:8px 0 0 0;"><strong>Check rating:</strong> ${layout.box.label} is rated ${layout.box.tvMin}"–${layout.box.tvMax}" — selected ${selectedSize}".</p>` : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${docTitle}</title><style>
@page { size: letter; margin: 0.5in; }
body { font-family: 'Space Grotesk', -apple-system, sans-serif; color: #102A43; margin: 0; padding: 24px; background: white; }
.header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #102A43; padding-bottom: 12px; margin-bottom: 22px; }
.header h1 { margin: 0; font-size: 21px; letter-spacing: -0.3px; }
.header .meta { font-size: 10px; letter-spacing: 1.5px; color: #5C7186; text-transform: uppercase; text-align: right; line-height: 1.6; }
.schematic-wrap { text-align: center; margin-bottom: 0; padding: 14px; background: #FBFCFE; border: 1px solid #C9D6E2; }
.schematic-wrap svg { max-width: 100%; height: auto; }
.legend-strip { display: flex; flex-wrap: wrap; gap: 3px 14px; margin: 0 0 22px; padding: 7px 12px; border: 1px solid #C9D6E2; border-top: none; background: #FBFCFE; font-family: 'IBM Plex Mono', 'Courier New', monospace; font-size: 8px; letter-spacing: 0.5px; text-transform: uppercase; color: #5C7186; }
.legend-strip strong { color: #102A43; }
.section-label { font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: #102A43; font-weight: 700; padding-bottom: 6px; border-bottom: 1px solid #C9D6E2; margin-bottom: 10px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-bottom: 22px; }
.spec-table { width: 100%; border-collapse: collapse; }
.spec-table td { padding: 6px 4px; border-bottom: 1px solid #E4EBF2; font-size: 11.5px; font-family: 'IBM Plex Mono', 'Courier New', monospace; }
.spec-table td:first-child { color: #5C7186; }
.spec-table td:last-child { text-align: right; font-weight: 600; color: #102A43; }
.notes-box { background: #F4F7FA; border: 1px solid #8FA8BE; padding: 12px; font-size: 11px; line-height: 1.55; }
.notes-box h3 { margin: 0 0 8px 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #1D3A57; }
.footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #C9D6E2; font-size: 9px; color: #5C7186; letter-spacing: 1px; text-transform: uppercase; display: flex; justify-content: space-between; }
@media print { body { padding: 0; } .no-print { display: none; } }
.print-btn { position: fixed; top: 12px; right: 12px; padding: 12px 20px; background: #102A43; color: white; border: none; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; font-weight: 600; }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="header"><div><div style="font-size:9px;letter-spacing:2.5px;color:#5C7186;text-transform:uppercase;margin-bottom:4px;">AV INSTALLATION DRAWING</div><h1>${docTitle}</h1></div><div class="meta">${metaHtml}</div></div>
<div class="schematic-wrap">${svgData}</div>
<div class="legend-strip">${legendHtml}</div>
<div class="grid2">
<div><div class="section-label">Specifications</div><table class="spec-table">${specRowsHtml}</table></div>
<div>
<div class="section-label">Rough-In Parts</div><table class="spec-table">${partsHtml}</table>
<div class="section-label" style="margin-top:16px;">Installation Notes</div>
<div class="notes-box"><h3>Field verification</h3><p style="margin:0 0 8px 0;">Verify TV VESA pattern and dimensions against the manufacturer spec sheet before drilling. Values are calculated from published specifications and may vary by model variant.</p>${vesaNote}${bbNote}${ratingNote}</div>
</div>
</div>
<div class="footer"><span>Generated ${today} · REV ${revision || "01"}</span><span>NOT TO SCALE — DIMENSIONS GOVERN</span></div>
<script>window.addEventListener("load", function() { setTimeout(function() { window.print(); }, 500); });</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    else alert("Please allow pop-ups to export PDF");
  };

  // ----- handlers -----
  const switchHeightRef = (toRef) => {
    if (heightRef === toRef) return;
    setHeightRef(toRef);
    setMountHeightOverride(prev => {
      const v = parseFloat(prev);
      if (isNaN(v) || !selectedSize) return "";
      const conv = convertOverride(v, toRef, brand, selectedSize);
      return conv == null ? "" : conv.toFixed(1);
    });
  };

  const allTestsPass = selfTest.passed === selfTest.total;
  const auditClean = renderAudit.overlaps === 0 && renderAudit.clipped === 0;

  // ----- shared UI fragments -----
  const setupPanel = (
    <>
      <div className="stage">
        <span className="stage-name">START</span>
        <span className="stage-note">what you are working from</span>
      </div>
      <Sec icon="doc" title="Project" defaultOpen={!(SAVED.projectName)} summary={[projectName, clientName].filter(Boolean).join(" — ")}>
        <Field label="Project / Address"><input className="inp" type="text" placeholder="e.g. Smith Residence" value={projectName} onChange={e => setProjectName(e.target.value)}/></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
          <Field label="Client"><input className="inp" type="text" placeholder="optional" value={clientName} onChange={e => setClientName(e.target.value)}/></Field>
          <Field label="Rev"><input className="inp" type="text" value={revision} onChange={e => setRevision(e.target.value)}/></Field>
        </div>
      </Sec>

      <Sec icon="doc" title="Reference Drawing" defaultOpen={!!underlay}
           summary={underlay ? `${underlay.name || "imported"}${underlay.pages > 1 ? ` p${underlay.page}/${underlay.pages}` : ""}` : "none"}>
        <button className="btn ghost" style={{ width: "100%" }}
                onClick={() => underlayFileRef.current && underlayFileRef.current.click()}>
          {underlay ? "REPLACE PDF / IMAGE" : "IMPORT PDF / IMAGE"}
        </button>
        <input ref={underlayFileRef} type="file" accept="application/pdf,.pdf,image/*" style={{ display: "none" }}
               onChange={e => { const f = e.target.files && e.target.files[0]; if (f) importUnderlay(f); e.target.value = ""; }}/>
        {underlayNote && <div className="hint" style={{ marginTop: 8, color: "var(--acc)" }}>{underlayNote}</div>}
        {underlay && (
          <>
            {underlay.pages > 1 && (
              <Field label={`Page (${underlay.pages} total)`} hint={pdfBufRef.current ? null : "Re-import the PDF to switch pages after a reload"}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button className="chip" disabled={!pdfBufRef.current || underlay.page <= 1} onClick={() => gotoPage(underlay.page - 1)}>PREV</button>
                  <span style={{ fontFamily: "var(--fm)", fontSize: 11, minWidth: 46, textAlign: "center" }}>{underlay.page} / {underlay.pages}</span>
                  <button className="chip" disabled={!pdfBufRef.current || underlay.page >= underlay.pages} onClick={() => gotoPage(underlay.page + 1)}>NEXT</button>
                </div>
              </Field>
            )}
            <Field label="Calibrate scale">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className={`chip ${calib?.mode === "two" ? "on" : ""}`} onClick={() => startCalib("two")}>2-POINT</button>
                <button className={`chip ${calib?.mode === "box" ? "on" : ""}`} onClick={() => startCalib("box")}>SNAP TO TV</button>
                <button className={`chip ${tool === "move" ? "on" : ""}`} onClick={() => pickTool("move")}>MOVE</button>
              </div>
            </Field>
            <Field label={`Fine scale — ${(underlay.natW / underlay.ppi).toFixed(1)}" wide`}
                   hint="Nudge after calibrating; anchored on the drawing's centre">
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="chip" onClick={() => setUnderlay(u => u && rescaleUnderlay(u, 0.99, { x: u.ox + underlayInW(u) / 2, y: u.oy - underlayInH(u) / 2 }))}>−1%</button>
                <input type="range" min="-20" max="20" step="1" value={0} style={{ flex: 1 }}
                       onChange={e => { const k = 1 + (+e.target.value) / 200; setUnderlay(u => u && rescaleUnderlay(u, k, { x: u.ox + underlayInW(u) / 2, y: u.oy - underlayInH(u) / 2 })); e.target.value = 0; }}/>
                <button className="chip" onClick={() => setUnderlay(u => u && rescaleUnderlay(u, 1.01, { x: u.ox + underlayInW(u) / 2, y: u.oy - underlayInH(u) / 2 }))}>+1%</button>
              </div>
            </Field>
            <Field label={`Opacity — ${Math.round((underlay.opacity ?? 0.75) * 100)}%`}>
              <input type="range" min="10" max="100" step="5" value={Math.round((underlay.opacity ?? 0.75) * 100)}
                     style={{ width: "100%" }}
                     onChange={e => setUnderlay(u => u && ({ ...u, opacity: (+e.target.value) / 100 }))}/>
            </Field>
            <Check on={underlay.visible !== false} onClick={() => setUnderlay(u => u && ({ ...u, visible: u.visible === false }))}>Show reference drawing</Check>
            <Check on={trace} onClick={() => setTrace(!trace)}>Trace ink — dark lines, hollow TV</Check>
            <Check on={!!underlay.fitSheet} onClick={() => setUnderlay(u => u && ({ ...u, fitSheet: !u.fitSheet }))}>Show whole sheet (shrinks the schematic)</Check>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button className="chip" title="Start calibration over — discards the current scale"
                      onClick={() => setUnderlay(u => u && ({ ...u, ...fitUnderlay(u.natW, u.natH, wallW, wallH) }))}>RESET SCALE</button>
              <button className="chip" onClick={clearUnderlay}>REMOVE</button>
            </div>
          </>
        )}
      </Sec>

      <div className="stage">
        <span className="stage-name">THE WALL</span>
        <span className="stage-note">the surface it goes on</span>
      </div>
      <Sec icon="wall" title="Wall" summary={`${wallW}" × ${wallH}"`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Width (in)"><input className="inp" type="number" value={wallW} onChange={e => setWallW(+e.target.value || 0)}/></Field>
          <Field label="Height (in)"><input className="inp" type="number" value={wallH} onChange={e => setWallH(+e.target.value || 0)}/></Field>
        </div>
      </Sec>

      <Sec icon="fire" title="Fireplace" summary={hasFireplace ? (hasMantel ? "yes + mantel" : "yes") : "none"}>
        <Check on={hasFireplace} onClick={() => setHasFireplace(!hasFireplace)}>Wall has fireplace</Check>
        {hasFireplace && (
          <div style={{ paddingLeft: 4, marginTop: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Opening W"><input className="inp" type="number" value={fbOpeningW} onChange={e => setFbOpeningW(+e.target.value || 0)}/></Field>
              <Field label="Opening H"><input className="inp" type="number" value={fbOpeningH} onChange={e => setFbOpeningH(+e.target.value || 0)}/></Field>
            </div>
            <Field label="Offset from wall center (in)" hint="+ right / − left — TV follows fireplace center">
              <input className="inp" type="number" placeholder="0 = centered" value={fbOffsetX} onChange={e => setFbOffsetX(e.target.value)}/>
            </Field>
            <Check on={hasMantel} onClick={() => setHasMantel(!hasMantel)}>Has mantel</Check>
            {hasMantel && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
                <Field label="Mantel top H"><input className="inp" type="number" value={mantelH} onChange={e => setMantelH(+e.target.value || 0)}/></Field>
                <Field label="Thickness"><input className="inp" type="number" value={mantelDepth} onChange={e => setMantelDepth(+e.target.value || 0)}/></Field>
              </div>
            )}
          </div>
        )}
      </Sec>

      <div className="stage">
        <span className="stage-name">THE TV</span>
        <span className="stage-note">what you are hanging</span>
      </div>
      <Sec icon="tv" title="Brand" summary={brand}>
        <Seg options={BRANDS.map(b => ({ value: b, label: b }))} value={brand} onChange={(b) => { setBrand(b); setSelectedSize(null); }}/>
      </Sec>

      <Sec icon="eye" title="Viewing" summary={useViewDist ? `${(viewDist / 12).toFixed(1)} ft` : "off"}>
        <Check on={useViewDist} onClick={() => setUseViewDist(!useViewDist)}>Factor viewing distance</Check>
        {useViewDist && (
          <Field label="Distance to seating (in)" hint={`${(viewDist / 12).toFixed(1)} ft — sizing guide only`}>
            <input className="inp" type="number" value={viewDist} onChange={e => setViewDist(+e.target.value || 0)}/>
          </Field>
        )}
      </Sec>

      <div className="stage">
        <span className="stage-name">THE HARDWARE</span>
        <span className="stage-note">what holds it up</span>
      </div>
      <Sec icon="mount" title="Mount" summary={mountSystem === "fa" ? "Future Automation" : `Sanus ${sanusStyle === "fullmotion" ? "full motion" : sanusStyle}`}>
        <Seg options={[{ value: "sanus", label: "Sanus Black" }, { value: "fa", label: "Future Automation" }]} value={mountSystem} onChange={setMountSystem}/>
        {mountSystem === "fa" && (
          <div className="hint" style={{ marginTop: 6, marginBottom: 14 }}>
            FA articulating bracket + WB back box. The box location dictates the TV position — see Back Box.
          </div>
        )}
        {mountSystem === "sanus" && (
          <>
            <div style={{ marginTop: 8 }}>
              <Seg options={[{ value: "fixed", label: "Fixed" }, { value: "tilt", label: "Tilt" }, { value: "fullmotion", label: "Full Motion" }]} value={sanusStyle} onChange={(v) => { setSanusStyle(v); setSanusMountModel("auto"); }}/>
            </div>
            {selectedSize && sanusMount && (
              <div className="rec-box">
                <div className="rec-tag">{sanusMountModel === "auto" ? "RECOMMENDED" : "SELECTED"}{sanusMount.styleFallback ? " — NO " + sanusStyle.toUpperCase() + " THIS SIZE, XL TILT SHOWN" : ""}</div>
                <div style={{ fontWeight: 600 }}>Sanus Black {sanusMount.model}</div>
                <div>{sanusMount.name} · {sanusMount.tvMin}"–{sanusMount.tvMax}" · {sanusMount.capLbs} lbs</div>
                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 3 }}>
                  VESA {sanusMount.vesaMinW ?? "?"}×{sanusMount.vesaMinH ?? "?"}–{sanusMount.vesaMaxW}×{sanusMount.vesaMaxH} · plate {sanusMount.plateW}{sanusMount.plateWMax ? `–${sanusMount.plateWMax}` : ""}" × {sanusMount.plateH}{sanusMount.plateHMax ? `–${sanusMount.plateHMax}` : ""}"{sanusMount.tilt ? ` · tilt ${sanusMount.tilt}°` : ""}{sanusMount.swivel ? ` · swivel ${sanusMount.swivel}°` : ""}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: "var(--acc)" }}>
                  DEPTH {fmt(sanusMount.depth)} off wall{sanusMount.ext ? ` — extends to ${fmt(sanusMount.ext)}` : ""}
                  {specPanel?.d ? ` · TOTAL ≈ ${fmt(sanusMount.depth + specPanel.d)} incl. panel` : ""}
                </div>
                {specPanel?.weightLbs && (
                  <div style={{ fontSize: 10, marginTop: 3, opacity: 0.85 }}>
                    Panel: {specPanel.weightLbs} lbs (spec) — {specPanel.model}
                  </div>
                )}
                <div style={{ fontSize: 9, opacity: 0.6, marginTop: 3 }}>List ${sanusMount.list}</div>
              </div>
            )}
            {selectedSize && !sanusMount && (
              <div className="warn-box">
                <div className="warn-title">NO SANUS BLACK MOUNT</div>
                No Black Series mount covers {selectedSize}" (catalog spans 37"–110"). Spec Future Automation or a custom solution.
              </div>
            )}
            {selectedSize && sanusMount && !sanusMount.sizeOk && (
              <div className="warn-box"><div className="warn-title">SIZE OUT OF RANGE</div>{sanusMount.model} is rated {sanusMount.tvMin}"–{sanusMount.tvMax}" — selected {selectedSize}".</div>
            )}
            {selectedSize && sanusMount && !sanusMount.vesaOk && vesaSpec && (
              (vesaSpec.w_mm < (sanusMount.vesaMinW ?? 0) || vesaSpec.h_mm < (sanusMount.vesaMinH ?? 0)) ? (
                <div className="warn-box">
                  <div className="warn-title">VESA BELOW MOUNT MINIMUM</div>
                  TV pattern {vesaSpec.w_mm}×{vesaSpec.h_mm} is smaller than {sanusMount.model}&apos;s minimum {sanusMount.vesaMinW}×{sanusMount.vesaMinH}. It will not bolt up without an adapter plate.
                </div>
              ) : (
                <div className="note-box"><strong>VESA check:</strong> TV pattern {vesaSpec.w_mm}×{vesaSpec.h_mm} exceeds {sanusMount.model} max {sanusMount.vesaMaxW}×{sanusMount.vesaMaxH}.</div>
              )
            )}
            {selectedSize && sanusMount && effWeightLbs > 0 && effWeightLbs > sanusMount.capLbs && (
              <div className="warn-box"><div className="warn-title">OVER WEIGHT RATING</div>TV {effWeightLbs} lbs{tvWeightLbs > 0 ? "" : " (from spec sheet)"} exceeds {sanusMount.model} capacity of {sanusMount.capLbs} lbs.</div>
            )}
            <Field label="Manual selection">
              <select className="inp" value={sanusMountModel} onChange={e => setSanusMountModel(e.target.value)}>
                <option value="auto">Auto-recommend</option>
                <optgroup label="Fixed">
                  {SANUS_STYLE_ORDER.fixed.map(k => <option key={k} value={k}>{SANUS_MOUNTS[k].model} — {SANUS_MOUNTS[k].name}</option>)}
                </optgroup>
                <optgroup label="Tilt">
                  {SANUS_STYLE_ORDER.tilt.map(k => <option key={k} value={k}>{SANUS_MOUNTS[k].model} — {SANUS_MOUNTS[k].name}</option>)}
                </optgroup>
                <optgroup label="Full Motion">
                  {SANUS_STYLE_ORDER.fullmotion.map(k => <option key={k} value={k}>{SANUS_MOUNTS[k].model} — {SANUS_MOUNTS[k].name}</option>)}
                </optgroup>
              </select>
            </Field>
            <Field label="TV weight (lbs, optional)" hint="From the TV spec sheet — checked against the mount rating">
              <input className="inp" type="number" placeholder="for 98″+ panels" value={tvWeight} onChange={e => setTvWeight(e.target.value)}/>
            </Field>
          </>
        )}
        <Field label={`Height reference`}>
          <Seg options={[{ value: "center", label: "From Center" }, { value: "bottom", label: "From Bottom" }]} value={heightRef} onChange={switchHeightRef}/>
        </Field>
        <div className="stat"><span>Recommended {heightRef}</span><strong>{fmt(recommendedDisplayH)}</strong></div>
        {selectedSize && equivalentH != null && (
          <div className="stat dim"><span>{heightRef === "bottom" ? "Center equivalent" : "Bottom equivalent"}</span><strong>{fmt(equivalentH)}</strong></div>
        )}
        <Field label={`Override — to ${heightRef} (in)`}>
          <input className="inp" type="number" placeholder={recommendedDisplayH.toFixed(1)} value={mountHeightOverride} onChange={e => setMountHeightOverride(e.target.value)}/>
        </Field>
        <Field label={`Horizontal offset from ${hasFireplace ? "fireplace" : "wall"} center (in)`}
               hint={`+ right / − left${layout ? ` — TV CL at ${fmt(layout.tvCL)} from left` : ""}`}>
          <input className="inp" type="number" placeholder="0 = centered" value={tvOffsetX} onChange={e => setTvOffsetX(e.target.value)}/>
        </Field>
        {placementIssues.length > 0 && (
          <div className="warn-box">
            <div className="warn-title">PLACEMENT OUT OF RANGE</div>
            {placementIssues.map((iss, i) => <div key={i}>• {iss}</div>)}
          </div>
        )}
      </Sec>

      <Sec icon="box" title="Back Box" summary={showBackBox ? (layout?.box?.label || "on") : "off"}>
        <Check on={showBackBox} onClick={() => setShowBackBox(!showBackBox)}>Include back box</Check>
        {showBackBox && (
          <>
            <Check on={autoRecommendBox} onClick={() => setAutoRecommendBox(!autoRecommendBox)}>Auto-recommend for TV size</Check>
            {selectedSize && recommendedBox && autoRecommendBox && (
              <div className="rec-box">
                <div className="rec-tag">RECOMMENDED</div>
                <div style={{ fontWeight: 600 }}>{BACK_BOXES[recommendedBox].brand}</div>
                <div>{BACK_BOXES[recommendedBox].label}</div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 3 }}>
                  {BACK_BOXES[recommendedBox].w}" × {BACK_BOXES[recommendedBox].h}" × {BACK_BOXES[recommendedBox].d}"D — {BACK_BOXES[recommendedBox].bracket}
                </div>
                {BACK_BOXES[recommendedBox].note && <div style={{ fontSize: 10, opacity: 0.85, marginTop: 3, fontStyle: "italic" }}>{BACK_BOXES[recommendedBox].note}</div>}
              </div>
            )}
            {!autoRecommendBox && (
              <Field label="Manual selection">
                <select className="inp" value={backBoxModel} onChange={e => setBackBoxModel(e.target.value)}>
                  <optgroup label="Future Automation — WB Range">
                    {Object.entries(BACK_BOXES).filter(([, v]) => v.brand === "Future Automation").map(([k, v]) => (
                      <option key={k} value={k}>{v.label} ({v.bracket})</option>
                    ))}
                  </optgroup>
                  <optgroup label="SnapAV Strong — VersaBox">
                    {Object.entries(BACK_BOXES).filter(([, v]) => v.brand === "SnapAV Strong").map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </optgroup>
                </select>
              </Field>
            )}
            {layout?.box?.underRated && (
              <div className="note-box">
                <strong>Check rating:</strong> {layout.box.label} is rated for {layout.box.tvMin}"–{layout.box.tvMax}" TVs — selected {selectedSize}". Verify bracket compatibility.
              </div>
            )}
            {mountSystem === "fa" && layout?.box?.brand === "Future Automation" && (
              <>
                <Check on={showTravel} onClick={() => setShowTravel(!showTravel)}>Show bracket vertical range</Check>
                {showTravel && (
                  <Field label="Bracket travel (± in)" hint="FA PS-series hook adjustment — verify with the mount spec sheet">
                    <input className="inp" type="number" value={bracketTravel} onChange={e => setBracketTravel(e.target.value)}/>
                  </Field>
                )}
              </>
            )}
          </>
        )}
      </Sec>


      {selectedSize && (
        <Sec icon="bolt" title="VESA" summary={vesaSpec ? `${vesaSpec.w_mm}×${vesaSpec.h_mm}` : "no data"}>
          {!vesaSpec && (
            <div className="note-box" style={{ marginTop: 0 }}>
              <strong>No VESA data for this panel</strong> — pattern not published yet{TV_OVERRIDES[brand]?.[selectedSize] ? ` (${TV_OVERRIDES[brand][selectedSize].model})` : ""}. Pull it from the TV's spec sheet before rough-in.
            </div>
          )}
          {vesaSpec && (
            <div className="vesa-box">
              <div className="rec-tag">{brand.toUpperCase()} {selectedSize}" · 2024/25</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{vesaSpec.w_mm} × {vesaSpec.h_mm} mm</div>
              <div style={{ fontSize: 10, marginTop: 2 }}>{mmToIn(vesaSpec.w_mm).toFixed(2)}" × {mmToIn(vesaSpec.h_mm).toFixed(2)}" — {vesaSpec.screw} screw</div>
              {vesaSpec.voffset_pct !== 0 && <div style={{ fontSize: 10, marginTop: 3 }}>Pattern {Math.abs(vesaSpec.voffset_pct)}% {vesaSpec.voffset_pct < 0 ? "below" : "above"} TV center</div>}
              {vesaSpec.note && <div style={{ fontSize: 10, marginTop: 3, fontStyle: "italic" }}>{vesaSpec.note}</div>}
              <div style={{ fontSize: 9, marginTop: 6, paddingTop: 6, borderTop: "1px dashed currentColor", opacity: 0.8 }}>Verify with spec sheet before drilling</div>
            </div>
          )}
        </Sec>
      )}
    </>
  );

  const sizeStrip = (
    <div className="size-strip-wrap">
      <div className="size-strip-head">
        <span className="strip-title">{showAllSizes ? `ALL ${brand.toUpperCase()} SIZES` : `RECOMMENDED — ${brand.toUpperCase()}`}</span>
        <button className={`chip ${showAllSizes ? "on" : ""}`} onClick={() => setShowAllSizes(!showAllSizes)}>SHOW ALL</button>
      </div>
      <div className="size-strip">
        {(showAllSizes ? TV_CATALOG[brand] : recommendations).map(sz => {
          const fitIssues = computeFitIssues(sz, engineInputs);
          const isRec = recommendations.includes(sz);
          const active = selectedSize === sz;
          return (
            <div key={sz}
                 className={`size-card ${active ? "on" : ""} ${!isRec ? "warn" : ""}`}
                 onClick={() => setSelectedSize(sz)}
                 title={fitIssues[0] || "Recommended fit"}>
              <div className="size-num">{sz}</div>
              <div className="size-sub">{!isRec ? "CHECK FIT" : "INCH"}</div>
            </div>
          );
        })}
        {(showAllSizes ? TV_CATALOG[brand] : recommendations).length === 0 && (
          <div className="hint" style={{ padding: 12 }}>No sizes fit these dimensions — adjust the wall or enable SHOW ALL.</div>
        )}
      </div>
      {selectedSize && !recommendations.includes(selectedSize) && (
        <div className="warn-box" style={{ marginTop: 8 }}>
          <div className="warn-title">NOT A RECOMMENDED FIT</div>
          {computeFitIssues(selectedSize, engineInputs).map((iss, i) => <div key={i}>• {iss}</div>)}
          {computeFitIssues(selectedSize, engineInputs).length === 0 && <div>Outside typical proportional guidelines for this wall.</div>}
        </div>
      )}
    </div>
  );

  // display toggles live next to the drawing they affect; PWR/LV also feed
  // the parts list and PDF spec rows, same as they always did
  // Set-once options live behind the gear rather than in a permanent strip.
  // On a tablet the SHOW strip plus a 3-row markup bar ate more vertical space
  // than the drawing itself; these are things you set per job and forget.
  const SettingsRow = ({ label, hint, children }) => (
    <div className="set-row">
      <div>
        <div className="set-label">{label}</div>
        {hint && <div className="set-hint">{hint}</div>}
      </div>
      <div className="set-ctl">{children}</div>
    </div>
  );

  const settingsPanel = showSettings && (
    <div className="ask-wrap" onClick={() => setShowSettings(false)}>
      <div className="setp" onClick={e => e.stopPropagation()}>
        <div className="dhead" style={{ padding: "0 0 12px" }}>
          <div>
            <div className="rec-tag">SETTINGS</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>What appears on the drawing</div>
          </div>
          <button className="btn" onClick={() => setShowSettings(false)}>DONE</button>
        </div>

        <div className="set-group">ANNOTATIONS</div>
        <SettingsRow label="Power outlet" hint="Recessed outlet — drawing, parts list, PDF">
          <Check on={showOutlet} onClick={() => setShowOutlet(!showOutlet)}>PWR</Check>
        </SettingsRow>
        <SettingsRow label="Low voltage" hint="LV feed — drawing, parts list, PDF">
          <Check on={showLowVolt} onClick={() => setShowLowVolt(!showLowVolt)}>LV</Check>
        </SettingsRow>
        <SettingsRow label="VESA pattern" hint="Bolt pattern and screw size on the TV">
          <Check on={showVesa} onClick={() => setShowVesa(!showVesa)}>VESA</Check>
        </SettingsRow>
        <SettingsRow label="TV dimensions" hint="Width x height dimension line above the panel">
          <Check on={showTvDims} onClick={() => setShowTvDims(!showTvDims)}>TV DIMS</Check>
        </SettingsRow>
        {showBackBox && (
          <SettingsRow label="Back box dimensions" hint="Rough-in dims from the box bottom edge">
            <Check on={showBoxDims} onClick={() => setShowBoxDims(!showBoxDims)}>BOX DIMS</Check>
          </SettingsRow>
        )}
        <SettingsRow label="Tape-out lines" hint="The four lines an installer snaps on the real wall">
          <Check on={showTapeOut} onClick={() => setShowTapeOut(!showTapeOut)}>TAPE-OUT</Check>
        </SettingsRow>

        <div className="set-group">LABELS</div>
        <SettingsRow label="Spell out abbreviations" hint="ABOVE FLOOR instead of AFF, on the drawing and the PDF">
          <Check on={fullWords} onClick={() => setFullWords(!fullWords)}>FULL WORDS</Check>
        </SettingsRow>
        <SettingsRow label="Show legend" hint="What the abbreviations mean">
          <Check on={showLegend} onClick={() => setShowLegend(!showLegend)}>LEGEND</Check>
        </SettingsRow>
        <SettingsRow label="Text size" hint="Type size for every dimension and callout on the drawing and the PDF">
          <Seg small options={TEXT_SCALES.map(t => ({ value: String(t.v), label: t.label }))}
               value={String(textScale)} onChange={(v) => setTextScale(parseFloat(v))}/>
        </SettingsRow>
        <SettingsRow label="Units" hint="How every dimension is written">
          <Seg small options={[{ value: "dec", label: ".0" }, { value: "frac", label: "1/8" }, { value: "ftin", label: "FT-IN" }]} value={dispUnits} onChange={setDispUnits}/>
        </SettingsRow>

        <div className="set-group">DRAWING</div>
        <SettingsRow label="Snapping" hint="Snap to wall, floor, TV edges and box edges. Hold Alt to override.">
          <Check on={snapOn} onClick={() => setSnapOn(!snapOn)}>SNAP</Check>
        </SettingsRow>
      </div>
    </div>
  );

  const legendPanel = showLegend && (
    <div className="legend-box">
      <div className="rec-tag">ABBREVIATIONS</div>
      <div className="legend-grid">
        {ABBREVIATIONS.map(([a, full]) => (
          <div key={a} className="legend-row"><span className="legend-abbr">{a}</span><span>{full}</span></div>
        ))}
      </div>
    </div>
  );

  const statusBar = (
    <div className="status-bar">
      <div className="status-vals">
        {layout ? (
          <>
            <span className="sv"><em>CL</em> {fmt(layout.tvCL)}</span>
            <span className="sv"><em>CTR</em> {fmt(layout.centerH)}</span>
            <span className="sv"><em>BTM</em> {fmt(layout.tvBottom)}</span>
            {showTapeOut && <span className="sv"><em>TOP</em> {fmt(layout.tvTop)}</span>}
            {showBoxDims && layout.box && <span className="sv"><em>BOX BTM</em> {fmt(layout.box.btm)}</span>}
            {layout.mount?.system === "sanus" && <span className="sv"><em>DEPTH</em> {fmt(layout.mount.depth)}{layout.mount.ext ? `–${fmt(layout.mount.ext)}` : ""}</span>}
            {showOutlet && <span className="sv"><em>PWR</em> {fmt(layout.outlet.aff)}</span>}
            {layout.vesa && <span className="sv"><em>VESA</em> {layout.vesa.spec.w_mm}×{layout.vesa.spec.h_mm} {layout.vesa.spec.screw}</span>}
            {layout.box && <span className="sv"><em>BOX</em> {layout.box.label}</span>}
          </>
        ) : (
          <span className="sv dim-sv">SELECT A TV SIZE</span>
        )}
      </div>
      <div className="status-right">
        <button className={`diag-badge ${allTestsPass && auditClean ? "ok" : "bad"}`} onClick={() => setShowDiag(!showDiag)}
                title="Self-test + render audit — click for diagnostics">
          {allTestsPass ? "✓" : "✕"} {selfTest.passed}/{selfTest.total}
        </button>
      </div>
    </div>
  );

  const diagPanel = showDiag && (
    <div className="diag-panel">
      <div className="diag-head">
        <span>DIAGNOSTICS</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="chip" onClick={() => setSweep(runStressSweep())} title="Render every configuration offscreen and audit for collisions">SWEEP</button>
          <button className="chip" onClick={() => {
            const report = [
              `TELLAVISION DIAGNOSTICS — REV ${revision || "01"} — ${new Date().toISOString()}`,
              `TellaVision v${APP_VERSION}`,
              `Self-tests: ${selfTest.passed}/${selfTest.total} ${allTestsPass ? "PASS" : "FAIL"}`,
              `Render audit: ${renderAudit.overlaps} overlaps, ${renderAudit.clipped} clipped (${renderAudit.checked} labels)`,
              sweep ? `Stress sweep: ${sweep.failures.length} failing configs / ${sweep.total}` : `Stress sweep: not run`,
              ``,
              ...selfTest.results.map(r => `[${r.group}] ${r.pass ? "PASS" : "FAIL"} — ${r.name}${r.detail && !r.pass ? ` :: ${r.detail}` : ""}`),
              ...(sweep && sweep.failures.length ? [``, ...sweep.failures.map(f => `[sweep] FAIL — ${f.name}: ${f.overlaps} overlaps, ${f.clipped} clipped :: ${f.pairs.join(" | ")}`)] : []),
              ``,
              `State: ${JSON.stringify({ wallW, wallH, hasFireplace, fbOpeningW, fbOpeningH, fbOffsetX, hasMantel, mantelH, brand, selectedSize, tvOffsetX, mountSystem, sanusStyle, sanusMountModel, effectiveBoxModel, mountHeightOverride, heightRef, dispUnits })}`,
              `Env: ${navigator.userAgent} · viewport ${viewportW}px · scale ${screenSchem.scale.toFixed(3)} px/in`,
            ].join("\n");
            try { navigator.clipboard.writeText(report); } catch {}
          }}>COPY REPORT</button>
          <button className="chip" onClick={() => setShowDiag(false)}>CLOSE</button>
        </div>
      </div>
      <div className="diag-row head-row"><span>Render audit</span><span className={auditClean ? "p" : "f"}>{renderAudit.overlaps} overlaps · {renderAudit.clipped} clipped · {renderAudit.checked} labels</span></div>
      {sweep && (
        <>
          <div className="diag-row head-row"><span>Stress sweep</span><span className={sweep.failures.length === 0 ? "p" : "f"}>{sweep.failures.length} failing / {sweep.total} configs</span></div>
          {sweep.failures.slice(0, 8).map((f, i) => (
            <div key={i} className="diag-row"><span>{f.name}</span><span className="f">{f.pairs.join(" | ")}</span></div>
          ))}
        </>
      )}
      {["golden", "format", "interop", "invariant"].map(g => (
        <div key={g}>
          <div className="diag-group">{g.toUpperCase()}</div>
          {selfTest.results.filter(r => r.group === g).map((r, i) => (
            <div key={i} className="diag-row">
              <span>{r.name}</span>
              <span className={r.pass ? "p" : "f"}>{r.pass ? "PASS" : `FAIL ${r.detail}`}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const exportBtns = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <div className="menu-wrap">
        <button className="btn" onClick={() => setShowExport(!showExport)} disabled={!selectedSize}>
          <Icon name="download" size={11}/> EXPORT ▾
        </button>
        {showExport && (
          <>
            <div className="menu-backdrop" onClick={() => setShowExport(false)}/>
            <div className="menu">
              <button className="menu-item primary" onClick={() => { setShowExport(false); exportPack(); }}>
                ★ FULL PACK<span className="menu-sub">PDF + JSON + DXF in one shot</span>
              </button>
              <div className="menu-sep"/>
              <button className="menu-item" onClick={() => { setShowExport(false); exportPDF(); }}>
                PDF<span className="menu-sub">submittal sheet — specs + parts</span>
              </button>
              <button className="menu-item" onClick={() => { setShowExport(false); exportJSON(); }}>
                JSON<span className="menu-sub">design + computed values for other apps</span>
              </button>
              <button className="menu-item" onClick={() => { setShowExport(false); exportDXF(); }}>
                DXF<span className="menu-sub">Visio / AutoCAD / Bluebeam — true scale, layered</span>
              </button>
              <div className="menu-sep"/>
              <button className="menu-item" onClick={() => { setShowExport(false); exportPNG(); }}>
                PNG<span className="menu-sub">blueline raster image</span>
              </button>
              <button className="menu-item" onClick={() => { setShowExport(false); exportSVG(); }}>
                SVG<span className="menu-sub">blueline vector image</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // The way IN. Two labelled choices rather than one guess-the-type button:
  // a reference drawing is a backdrop you trace, a data file rewrites your
  // fields — different enough that the user should pick knowingly.
  const startBtns = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <div className="menu-wrap">
        <button className="btn ghost" onClick={() => setShowImport(!showImport)} title="Bring in a drawing to trace, or data from another app">
          <Icon name="doc" size={11}/> IMPORT ▾
        </button>
        {showImport && (
          <>
            <div className="menu-backdrop" onClick={() => setShowImport(false)}/>
            <div className="menu">
              <button className="menu-item" onClick={() => { setShowImport(false); underlayFileRef.current && underlayFileRef.current.click(); }}>
                REFERENCE DRAWING<span className="menu-sub">PDF or image — trace and scale over it</span>
              </button>
              <button className="menu-item" onClick={() => { setShowImport(false); fileRef.current && fileRef.current.click(); }}>
                DESIGN / SURVEY DATA<span className="menu-sub">JSON from TellaVision or another Field Kit app</span>
              </button>
              <div className="menu-sep"/>
              <div className="menu-note">…or drag a file straight onto the drawing</div>
            </div>
          </>
        )}
      </div>
      <button className="btn ghost icon-btn" onClick={() => setShowSettings(true)}
              title="Settings — what appears on the drawing: annotations, labels, units, snapping"
              aria-label="Settings">⚙</button>
      <button className={`btn ghost ${overlayCount() > 0 ? "flagged" : ""}`} onClick={() => setShowData(true)}
              title="Edit the product and measurement tables this app calculates from">
        DATA{overlayCount() > 0 ? ` (${overlayCount()})` : ""}
      </button>
      <button className="btn ghost" onClick={resetAll} title="Clear saved design">RESET</button>
      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
             onChange={e => { const f = e.target.files && e.target.files[0]; if (f) importJSONFile(f); e.target.value = ""; }}/>
    </div>
  );

  // Shown only on a genuinely empty app — you use this daily, so it gets out of
  // the way the moment there is a drawing or a size.
  const startPanel = !startHidden && !selectedSize && !underlay && (
    <div className="startp">
      <div>
        <div className="rec-tag">START A LAYOUT</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>How do you want to begin?</div>
        <div className="hint">Bring in what you already have, or just start typing wall dimensions.</div>
      </div>
      <div className="startp-row">
        <button className="startc" onClick={() => underlayFileRef.current && underlayFileRef.current.click()}>
          <strong>Reference drawing</strong>
          <span>Import the architect's elevation as a PDF or photo, scale it, and lay the TV over it.</span>
        </button>
        <button className="startc" onClick={() => fileRef.current && fileRef.current.click()}>
          <strong>Design or survey data</strong>
          <span>Pull wall, brand and size straight from a SiteWalk / survey JSON, or reopen a saved design.</span>
        </button>
        <button className="startc" onClick={() => setStartHidden(true)}>
          <strong>Start blank</strong>
          <span>Set the wall by hand and pick a TV. Everything else follows from there.</span>
        </button>
      </div>
    </div>
  );

  const importBanner = importSummary && (
    <div className="import-note">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="rec-tag" style={{ marginBottom: 4 }}>{importSummary.native ? "DESIGN IMPORTED" : `IMPORT — ${importSummary.matched.length} FIELD${importSummary.matched.length === 1 ? "" : "S"} MATCHED, ${importSummary.ignored} IGNORED`}</div>
        {importSummary.matched.length > 0 && !importSummary.native && (
          <div style={{ fontSize: 11 }}>{importSummary.matched.join(" · ")}</div>
        )}
        {importSummary.notes.map((n, i) => <div key={i} style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>• {n}</div>)}
      </div>
      <button className="chip" onClick={() => setImportSummary(null)}>DISMISS</button>
    </div>
  );

  // ----- markup toolbar (sits directly over the drawing) -----
  const TOOL_LABEL = { move: "MOVE", select: "SELECT", mask: "BLANK", pen: "PEN", line: "LINE", arrow: "ARROW", rect: "BOX", text: "TEXT", measure: "MEASURE" };
  const pickTool = (t) => { calibPtsRef.current = []; draftRef.current = null; editRef.current = null; setSel([]); setLasso(null); setCropping(false); setCalib(null); setDraft(null); setTool(cur => (cur === t ? "off" : t)); };
  const startCalib = (mode) => {
    if (!underlay) return;
    if (mode === "box" && !selectedSize) { setUnderlayNote("Pick a TV size first — snap scales from the panel width"); return; }
    setTool("off"); setDraft(null); calibPtsRef.current = []; setCalib({ mode, pts: [] });
    setUnderlayNote(mode === "two"
      ? "Click both ends of a dimension you know, then type its real length"
      : "Drag a box across the TV shown on the drawing");
  };

  const markupBar = (
    <div className="mk-bar">
      <button className={`chip ${tool === "off" && !calib ? "on" : ""}`} onClick={() => { setTool("off"); setCalib(null); calibPtsRef.current = []; }} title="Stop drawing — restores normal scrolling">OFF</button>
      {MARKUP_TOOLS.filter(t => t !== "mask" || underlay).map(t => (
        <button key={t} className={`chip ${tool === t ? "on" : ""}`} onClick={() => pickTool(t)}
                title={t === "mask" ? "Paint over part of the reference drawing so the schematic reads clearly" : undefined}>
          {TOOL_LABEL[t]}
        </button>
      ))}
      <span className="mk-sep"/>
      {/* Colour and weight sit inline on a wide screen. A tablet's main column
          is only ~460px, so there they collapse into one style button and the
          bar stays a single row. */}
      {!isMobile && !isTablet ? (
        <>
          {MARKUP_COLORS.map(c => (
            <button key={c} className={`mk-sw ${(solo ? solo.color : mkColor) === c ? "on" : ""}`} style={{ background: c }}
                    onClick={() => { setMkColor(c); if (sel.length) patchSel(m => ({ ...m, color: c })); }}
                    title={sel.length ? "Recolour the selection" : c} aria-label={`colour ${c}`}/>
          ))}
          {MARKUP_WIDTHS.map(w => (
            <button key={w} className={`chip ${(solo ? solo.w : mkWidth) === w ? "on" : ""}`}
                    onClick={() => { setMkWidth(w); if (sel.length) patchSel(m => ({ ...m, w })); }}>
              {w === 1 ? "THIN" : w === 2 ? "MED" : "BOLD"}
            </button>
          ))}
        </>
      ) : (
        <div className="menu-wrap">
          <button className="chip style-btn" onClick={() => setShowStyle(v => !v)} title="Pen colour and weight">
            <span className="mk-sw sm" style={{ background: solo ? solo.color : mkColor }}/>
            {(solo ? solo.w : mkWidth) === 1 ? "THIN" : (solo ? solo.w : mkWidth) === 2 ? "MED" : "BOLD"} ▾
          </button>
          {showStyle && (
            <>
              <div className="menu-backdrop" onClick={() => setShowStyle(false)}/>
              <div className="menu" style={{ padding: 10 }}>
                <div className="menu-note" style={{ padding: "0 0 6px" }}>{sel.length ? "Restyle the selection" : "Pen style"}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {MARKUP_COLORS.map(c => (
                    <button key={c} className={`mk-sw ${(solo ? solo.color : mkColor) === c ? "on" : ""}`} style={{ background: c }}
                            onClick={() => { setMkColor(c); if (sel.length) patchSel(m => ({ ...m, color: c })); }} aria-label={`colour ${c}`}/>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {MARKUP_WIDTHS.map(w => (
                    <button key={w} className={`chip ${(solo ? solo.w : mkWidth) === w ? "on" : ""}`}
                            onClick={() => { setMkWidth(w); if (sel.length) patchSel(m => ({ ...m, w })); }}>
                      {w === 1 ? "THIN" : w === 2 ? "MED" : "BOLD"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <span className="mk-sep"/>
      {sel.length > 0 && <button className="chip on" onClick={deleteSel} title="Delete the selection (or press Delete)">DELETE {sel.length > 1 ? `(${sel.length})` : ""}</button>}
      <button className="chip" onClick={undoMarkup} disabled={!markup.length}>UNDO</button>
      <button className="chip" onClick={() => { setMarkup([]); setSel([]); }} disabled={!markup.length}>CLEAR</button>
      {underlay && (
        <>
          <span className="mk-sep"/>
          <div className="menu-wrap">
            <button className={`chip ${(cropping || tool === "move" || calib) ? "on" : ""}`}
                    onClick={() => setShowPdfMenu(v => !v)} title="Scale, position and clean up the reference drawing">PDF ▾</button>
            {showPdfMenu && (
              <>
                <div className="menu-backdrop" onClick={() => setShowPdfMenu(false)}/>
                <div className="menu">
                  <button className="menu-item" onClick={() => { setShowPdfMenu(false); startCalib("box"); }}>
                    SNAP TO TV<span className="menu-sub">box the drawn panel — scales and positions at once</span>
                  </button>
                  <button className="menu-item" onClick={() => { setShowPdfMenu(false); startCalib("two"); }}>
                    2-POINT SCALE<span className="menu-sub">click a known dimension, type its true length</span>
                  </button>
                  <div className="menu-sep"/>
                  <button className="menu-item" onClick={() => { setShowPdfMenu(false); pickTool("move"); }}>
                    MOVE DRAWING<span className="menu-sub">drag the sheet into position</span>
                  </button>
                  <button className="menu-item" onClick={() => { setShowPdfMenu(false); setCropping(true); setTool("off"); setCalib(null); }}>
                    CROP SHEET<span className="menu-sub">show only the part of the wall that matters</span>
                  </button>
                  {underlay.crop && (
                    <button className="menu-item" onClick={() => { setShowPdfMenu(false); setUnderlay(u => u && ({ ...u, crop: null })); }}>
                      REMOVE CROP<span className="menu-sub">show the whole sheet again</span>
                    </button>
                  )}
                  <div className="menu-sep"/>
                  <button className="menu-item" onClick={() => { setShowPdfMenu(false); setTrace(t => !t); }}>
                    {trace ? "✓ " : ""}TRACE INK<span className="menu-sub">dark lines on white, hollow TV</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  // ----- inline prompts (window.prompt is unreliable in installed PWAs) -----
  const askDialog = (calibAsk || textAsk) && (
    <div className="ask-wrap" onClick={() => { setCalibAsk(null); setTextAsk(null); setCalib(null); calibPtsRef.current = []; }}>
      <div className="ask" onClick={e => e.stopPropagation()}>
        <div className="rec-tag">{calibAsk ? "TRUE LENGTH OF THAT SPAN" : "ANNOTATION TEXT"}</div>
        <input className="inp" autoFocus type="text" value={askValue}
               placeholder={calibAsk ? `e.g. 96, 8' or 8' 6 1/2"` : "e.g. VERIFY IN FIELD"}
               onChange={e => setAskValue(e.target.value)}
               onKeyDown={e => {
                 if (e.key === "Enter") {
                   if (calibAsk) applyTwoPoint();
                   else { const v = askValue.trim(); if (v) setMarkup(m => [...m, { id: `t${m.length}`, type: "text", color: mkColor, w: mkWidth, pts: [textAsk.pt], text: v }]); setTextAsk(null); setAskValue(""); }
                 } else if (e.key === "Escape") { setCalibAsk(null); setTextAsk(null); setCalib(null); calibPtsRef.current = []; }
               }}/>
        {calibAsk && <div className="hint" style={{ marginTop: 6 }}>Feet and inches both work — 96 · 8' · 8' 6 1/2"</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => { setCalibAsk(null); setTextAsk(null); setCalib(null); calibPtsRef.current = []; setAskValue(""); }}>CANCEL</button>
          <button className="btn" onClick={() => {
            if (calibAsk) applyTwoPoint();
            else { const v = askValue.trim(); if (v) setMarkup(m => [...m, { id: `t${m.length}`, type: "text", color: mkColor, w: mkWidth, pts: [textAsk.pt], text: v }]); setTextAsk(null); setAskValue(""); }
          }}>APPLY</button>
        </div>
      </div>
    </div>
  );

  // live overlay: the stroke under the user's finger and the calibration pick
  const frame = { wallX: screenSchem.wallX, floorY: screenSchem.floorY, scale: screenSchem.scale, fmt };
  const calibOverlay = calib && (() => {
    const els = [];
    const pts = calib.pts || [];
    if (calib.mode === "box" && pts.length === 2) {
      const a = toPx(pts[0]), b = toPx(pts[1]);
      els.push(<rect key="cb" x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)}
        width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)}
        fill="rgba(74,158,255,0.12)" stroke="#4A9EFF" strokeWidth="1.5" strokeDasharray="5 3"/>);
      els.push(<text key="cbt" x={(a.x + b.x) / 2} y={Math.min(a.y, b.y) - 7} textAnchor="middle" fill="#4A9EFF"
        fontSize="11" fontWeight="600" fontFamily="'IBM Plex Mono', monospace">
        {selectedSize ? `${selectedSize}" PANEL` : "PICK A TV SIZE FIRST"}</text>);
    }
    if (calib.mode === "two") {
      const live = pts.length === 1 && calib.hover ? [pts[0], calib.hover] : pts;
      live.forEach((q, i) => {
        const c = toPx(q);
        els.push(<circle key={`cp${i}`} cx={c.x} cy={c.y} r="5" fill="none" stroke="#4A9EFF" strokeWidth="2"/>);
        els.push(<line key={`cx${i}`} x1={c.x - 9} y1={c.y} x2={c.x + 9} y2={c.y} stroke="#4A9EFF" strokeWidth="1"/>);
        els.push(<line key={`cy${i}`} x1={c.x} y1={c.y - 9} x2={c.x} y2={c.y + 9} stroke="#4A9EFF" strokeWidth="1"/>);
      });
      if (live.length === 2) {
        const a = toPx(live[0]), b = toPx(live[1]);
        els.push(<line key="cl" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4A9EFF" strokeWidth="1.5" strokeDasharray="5 3"/>);
      }
    }
    return els;
  })();

  const selOverlay = (() => {
    const els = [];
    const P0 = (pt) => toPx(pt);
    // every selected item gets a halo; grab handles only when exactly one is picked
    sel.forEach((idx, n) => {
      const m = markup[idx];
      if (!m || !m.pts || !m.pts.length) return;
      if (m.type === "rect" || m.type === "mask") {
        const c = rectCorners(m.pts[0], m.pts[m.pts.length - 1]).map(P0);
        els.push(<polygon key={`h${n}`} points={c.map(p => `${p.x},${p.y}`).join(" ")} fill="none"
          stroke="#3ECFE0" strokeWidth="1.5" strokeDasharray="5 3"/>);
      } else if (m.type === "text") {
        const p = P0(m.pts[0]);
        els.push(<circle key={`h${n}`} cx={p.x} cy={p.y} r="11" fill="none" stroke="#3ECFE0" strokeWidth="1.5" strokeDasharray="5 3"/>);
      } else {
        els.push(<polyline key={`h${n}`} points={m.pts.map(P0).map(p => `${p.x},${p.y}`).join(" ")} fill="none"
          stroke="#3ECFE0" strokeWidth={(m.w || 2) + 5} strokeOpacity="0.28" strokeLinecap="round" strokeLinejoin="round"/>);
      }
    });
    if (solo) {
      handlesFor(solo).forEach((h, i) => {
        const p = P0(h);
        els.push(<rect key={`g${i}`} x={p.x - 5} y={p.y - 5} width="10" height="10" rx="2"
          fill="#0D1B2A" stroke="#3ECFE0" strokeWidth="2"/>);
      });
    }
    // rubber-band: selection lasso, or the crop window being dragged
    if (lasso) {
      const a = P0(lasso.a), b = P0(lasso.b);
      els.push(<rect key="lasso" x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)}
        width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)}
        fill={cropping ? "rgba(255,209,102,0.10)" : "rgba(62,207,224,0.10)"}
        stroke={cropping ? "#FFD166" : "#3ECFE0"} strokeWidth="1.5" strokeDasharray="6 4"/>);
      if (cropping) {
        els.push(<text key="lassot" x={(a.x + b.x) / 2} y={Math.min(a.y, b.y) - 7} textAnchor="middle"
          fill="#FFD166" fontSize="11" fontWeight="600" fontFamily="'IBM Plex Mono', monospace">CROP SHEET</text>);
      }
    }
    // why it jumped: a guide through whatever anchor the snap grabbed
    if (snapHit) {
      const g = { stroke: "#FFD166", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.9 };
      if (snapHit.x) {
        const px = toPx({ x: snapHit.x.v, y: 0 }).x;
        els.push(<line key="sgx" x1={px} y1={screenSchem.wallY - 10} x2={px} y2={screenSchem.floorY + 10} {...g}/>);
        els.push(<text key="sgxt" x={px + 4} y={screenSchem.wallY - 14} fill="#FFD166" fontSize="9"
          fontFamily="'IBM Plex Mono', monospace">{snapHit.x.why.toUpperCase()}</text>);
      }
      if (snapHit.y) {
        const py = toPx({ x: 0, y: snapHit.y.v }).y;
        els.push(<line key="sgy" x1={screenSchem.wallX - 10} y1={py} x2={screenSchem.wallX + wallW * screenSchem.scale + 10} y2={py} {...g}/>);
        els.push(<text key="sgyt" x={screenSchem.wallX + 4} y={py - 4} fill="#FFD166" fontSize="9"
          fontFamily="'IBM Plex Mono', monospace">{snapHit.y.why.toUpperCase()}</text>);
      }
    }
    return els.length ? els : null;
  })();

  const canvas = (
    <div className="canvas-panel">
      {markupBar}
      <svg ref={svgRef} width={screenSchem.svgW} height={screenSchem.svgH}
           viewBox={`0 0 ${screenSchem.svgW} ${screenSchem.svgH}`}
           xmlns="http://www.w3.org/2000/svg"
           style={{ display: "block", maxWidth: "100%", height: "auto", margin: "0 auto",
                    touchAction: interactive ? "none" : "auto",
                    cursor: calib ? "crosshair"
                          : tool === "move" ? "grab"
                          : cropping ? "crosshair"
                          : tool === "select" ? (sel.length ? "move" : "default")
                          : tool !== "off" ? "crosshair" : "default" }}
           onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerCancel={onPtrUp}
           preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid-scr" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={screenSchem.P.grid} strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={screenSchem.P.canvas}/>
        <rect width="100%" height="100%" fill="url(#grid-scr)"/>
        <text x={screenSchem.svgW - 16} y={18} textAnchor="end" fontSize="9" fill={screenSchem.P.title} fontFamily="'IBM Plex Mono', monospace" letterSpacing="2">FRONT ELEVATION</text>
        <text x={16} y={18} fontSize="9" fill={screenSchem.P.title} fontFamily="'IBM Plex Mono', monospace" letterSpacing="2">{selectedSize ? `${brand.toUpperCase()} ${selectedSize}"` : "SELECT TV SIZE"}</text>
        {screenSchem.elements}
        {draft && renderMarkupEls([draft], { ...frame, keyPrefix: "draft" })}
        {selOverlay}
        {calibOverlay}
      </svg>
    </div>
  );

  // hidden blueline render — what exports serialize
  const printSvg = (
    <div style={{ position: "absolute", left: -100000, top: 0, width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
      <svg ref={printRef} width={printSchem.svgW} height={printSchem.svgH}
           viewBox={`0 0 ${printSchem.svgW} ${printSchem.svgH}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-prt" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={PRINT_PALETTE.grid} strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={PRINT_PALETTE.canvas}/>
        <rect width="100%" height="100%" fill="url(#grid-prt)"/>
        <text x={printSchem.svgW - 16} y={18} textAnchor="end" fontSize="9" fill={PRINT_PALETTE.title} fontFamily="'IBM Plex Mono', monospace" letterSpacing="2">FRONT ELEVATION</text>
        <text x={16} y={18} fontSize="9" fill={PRINT_PALETTE.title} fontFamily="'IBM Plex Mono', monospace" letterSpacing="2">{selectedSize ? `${brand.toUpperCase()} ${selectedSize}"` : ""}</text>
        {printSchem.elements}
      </svg>
    </div>
  );

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        :root {
          --ink: #0B1622; --ink2: #0D1B2A; --panel: #112236; --panel2: #16293F;
          --line: rgba(232,238,245,0.10); --line2: rgba(232,238,245,0.18);
          --txt: #E8EEF5; --txt2: #8DA3B8; --txt3: #5C7186;
          --acc: #3ECFE0; --warn: #FF5C4D; --ok: #4ADE80; --amber: #FFD166;
          --fd: 'Space Grotesk', sans-serif; --fm: 'IBM Plex Mono', monospace;
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: var(--ink); }
        .app { height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; background: var(--ink); color: var(--txt); font-family: var(--fd); }
        .hdr { display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; border-bottom: 1px solid var(--line); flex-wrap: wrap; gap: 10px; }
        .hdr h1 { font-size: 17px; font-weight: 700; letter-spacing: 0.3px; margin: 0; }
        .hdr .sub { font-family: var(--fm); font-size: 9px; letter-spacing: 2px; color: var(--txt3); margin-top: 2px; }
        .hdr-proj { font-family: var(--fm); font-size: 11px; color: var(--txt2); }
        .sec-title { font-family: var(--fm); font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--txt2); font-weight: 600; padding-bottom: 7px; border-bottom: 1px solid var(--line); margin-bottom: 12px; display: flex; align-items: center; gap: 7px; }
        .sec-clk { cursor: pointer; user-select: none; -webkit-user-select: none; }
        .sec-clk:hover { color: var(--txt); }
        .sec-sum { flex: 1; min-width: 0; text-align: right; color: var(--txt3); letter-spacing: 0.5px; text-transform: none; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sec-chev { color: var(--txt3); transition: transform .15s; flex-shrink: 0; }
        .sec-chev.closed { transform: rotate(-90deg); }
        .lbl { font-family: var(--fm); font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--txt3); margin-bottom: 5px; }
        .hint { font-family: var(--fm); font-size: 10px; color: var(--txt3); margin-top: 4px; line-height: 1.5; }
        .inp { width: 100%; padding: 9px 11px; border: 1px solid var(--line2); background: var(--ink2); font-family: var(--fm); font-size: 15px; color: var(--txt); outline: none; border-radius: 4px; min-height: 42px; transition: border-color .15s; -webkit-appearance: none; appearance: none; }
        .inp:focus { border-color: var(--acc); }
        select.inp { background-image: linear-gradient(45deg, transparent 50%, var(--txt2) 50%), linear-gradient(135deg, var(--txt2) 50%, transparent 50%); background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%; background-size: 5px 5px; background-repeat: no-repeat; padding-right: 28px; }
        .chk-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; cursor: pointer; font-size: 13.5px; min-height: 40px; user-select: none; -webkit-user-select: none; color: var(--txt); }
        .chk { width: 18px; height: 18px; border: 1.4px solid var(--line2); border-radius: 4px; background: var(--ink2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; color: var(--ink); }
        .chk.on { background: var(--acc); border-color: var(--acc); }
        .seg { display: flex; background: var(--ink2); border: 1px solid var(--line2); border-radius: 5px; padding: 3px; gap: 3px; }
        .seg-btn { flex: 1; padding: 8px 10px; border: none; background: transparent; color: var(--txt2); font-family: var(--fm); font-size: 11px; letter-spacing: 0.5px; cursor: pointer; border-radius: 3px; transition: all .15s; min-height: 34px; }
        .seg-btn.on { background: var(--panel2); color: var(--txt); box-shadow: inset 0 0 0 1px var(--line2); }
        .seg.small .seg-btn { padding: 4px 8px; font-size: 9px; min-height: 24px; }
        .stat { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; font-family: var(--fm); color: var(--txt2); gap: 8px; }
        .stat strong { color: var(--txt); font-weight: 600; }
        .stat.dim { opacity: 0.6; }
        .warn-box { margin-top: 10px; padding: 9px 11px; background: rgba(255,92,77,0.08); border: 1px solid rgba(255,92,77,0.5); border-radius: 4px; color: #FFB4AC; font-family: var(--fm); font-size: 11px; line-height: 1.55; }
        .warn-title { font-size: 9px; letter-spacing: 2px; color: var(--warn); margin-bottom: 4px; font-weight: 700; }
        .note-box { margin-top: 8px; padding: 8px 10px; background: rgba(255,209,102,0.07); border: 1px solid rgba(255,209,102,0.4); border-radius: 4px; color: #F0D9A0; font-family: var(--fm); font-size: 10px; line-height: 1.5; }
        .rec-box { margin-top: 8px; padding: 9px 11px; background: var(--panel2); border: 1px solid var(--line2); border-radius: 4px; font-family: var(--fm); font-size: 11px; line-height: 1.5; color: var(--txt); }
        .rec-tag { font-size: 8px; letter-spacing: 2px; color: var(--acc); margin-bottom: 3px; font-weight: 700; }
        .vesa-box { margin-top: 8px; padding: 9px 11px; background: rgba(255,209,102,0.06); border: 1px solid rgba(255,209,102,0.35); border-radius: 4px; font-family: var(--fm); font-size: 11px; line-height: 1.5; color: #F0D9A0; }
        .vesa-box .rec-tag { color: var(--amber); }
        .size-strip-wrap { width: 100%; }
        .size-strip-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .strip-title { font-family: var(--fm); font-size: 10px; letter-spacing: 2px; color: var(--txt2); font-weight: 600; }
        .size-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
        .size-card { min-width: 68px; padding: 10px 8px; border: 1px solid var(--line2); border-radius: 5px; background: var(--panel); cursor: pointer; text-align: center; transition: all .15s; flex-shrink: 0; }
        .size-card:hover { border-color: var(--acc); }
        .size-card.on { background: var(--acc); border-color: var(--acc); color: var(--ink); }
        .size-card.warn { border-style: dashed; opacity: 0.75; }
        .size-card.warn .size-sub { color: var(--warn); }
        .size-card.on .size-sub { color: var(--ink); opacity: 0.7; }
        .size-num { font-family: var(--fd); font-size: 20px; font-weight: 700; line-height: 1; }
        .size-sub { font-family: var(--fm); font-size: 7px; letter-spacing: 1.5px; margin-top: 4px; color: var(--txt3); }
        .chip { padding: 4px 10px; border: 1px solid var(--line2); background: transparent; color: var(--txt2); font-family: var(--fm); font-size: 9px; letter-spacing: 1px; cursor: pointer; border-radius: 3px; transition: all .15s; }
        .chip.on, .chip:hover:not(:disabled) { border-color: var(--acc); color: var(--acc); }
        .chip:disabled { opacity: 0.3; cursor: not-allowed; }

        /* markup toolbar — sits directly over the drawing so tools are a thumb away */
        .mk-bar { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; padding: 0 0 9px; margin-bottom: 9px; border-bottom: 1px solid var(--line); }
        .mk-bar .chip { min-height: 30px; }
        .mk-sep { width: 1px; align-self: stretch; background: var(--line2); margin: 2px 4px; }
        .mk-sw { width: 22px; height: 22px; border-radius: 3px; border: 2px solid var(--line2); cursor: pointer; padding: 0; }
        .mk-sw.on { border-color: var(--acc); box-shadow: 0 0 0 2px var(--ink2), 0 0 0 3px var(--acc); }
        /* ---- narrative flow: stage headings, start panel, drop target ---- */
        .stage { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
                 margin: 20px 0 8px; padding-bottom: 5px; border-bottom: 1px solid var(--line); }
        .stage:first-child { margin-top: 2px; }
        .stage-name { font-family: var(--fm); font-size: 9px; letter-spacing: 2.5px; font-weight: 700; color: var(--acc); }
        .stage-note { font-size: 9.5px; color: var(--txt2); opacity: 0.75; }
        .menu-note { padding: 8px 12px; font-size: 9.5px; color: var(--txt2); opacity: 0.8; }
        .startp { border: 1px solid var(--line2); border-radius: 6px; padding: 14px; margin-bottom: 12px; background: var(--ink2); }
        .startp-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-top: 12px; }
        .startc { text-align: left; padding: 11px 12px; border: 1px solid var(--line2); border-radius: 5px;
                  background: transparent; cursor: pointer; transition: all .15s; display: block; }
        .startc:hover { border-color: var(--acc); background: rgba(62,207,224,0.05); }
        .startc strong { display: block; color: var(--txt); font-size: 12px; margin-bottom: 3px; }
        .startc span { display: block; color: var(--txt2); font-size: 10px; line-height: 1.45; }
        .main-col.dropping { outline: 2px dashed var(--acc); outline-offset: -6px; border-radius: 6px; }

        .btn.icon-btn { padding: 9px 12px; font-size: 14px; line-height: 1; }
        .style-btn { display: inline-flex; align-items: center; gap: 6px; }
        .mk-sw.sm { width: 13px; height: 13px; border-width: 1px; }

        /* ---- settings panel ---- */
        .setp { background: var(--ink2); border: 1px solid var(--line2); border-radius: 8px; padding: 16px;
                width: min(460px, 100%); max-height: 86vh; overflow-y: auto; }
        .set-group { font-family: var(--fm); font-size: 8.5px; letter-spacing: 2.5px; font-weight: 700; color: var(--acc);
                     margin: 16px 0 4px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }
        .set-group:first-of-type { margin-top: 6px; }
        .set-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 9px 0; border-bottom: 1px solid var(--line); }
        .set-row:last-child { border-bottom: none; }
        .set-label { font-size: 12px; color: var(--txt); }
        .set-hint { font-size: 10px; color: var(--txt2); margin-top: 2px; line-height: 1.4; }
        .set-ctl { flex-shrink: 0; }

        /* ---- catalog data screen ---- */
        .btn.ghost.flagged { border-color: var(--amber); color: var(--amber); }
        .dwrap { position: fixed; inset: 0; z-index: 1000; background: var(--ink); display: flex; flex-direction: column; }
        .dhead { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap;
                 padding: 14px 18px; border-bottom: 1px solid var(--line); }
        .dbody { flex: 1; min-height: 0; display: grid; grid-template-columns: 190px 1fr; }
        .dnav { border-right: 1px solid var(--line); padding: 10px; overflow-y: auto; }
        .dnav-item { display: flex; justify-content: space-between; align-items: center; gap: 6px; width: 100%; text-align: left;
                     padding: 9px 10px; margin-bottom: 3px; background: transparent; border: 1px solid transparent;
                     color: var(--txt2); font-family: var(--fm); font-size: 10px; letter-spacing: 1px; cursor: pointer; border-radius: 4px; }
        .dnav-item:hover { color: var(--txt); }
        .dnav-item.on { background: var(--ink2); border-color: var(--acc); color: var(--acc); }
        .dmain { padding: 14px 18px; overflow: auto; min-width: 0; display: flex; flex-direction: column; }
        .dscroll { overflow: auto; flex: 1; min-height: 0; border: 1px solid var(--line); border-radius: 6px; }
        .dgrid { border-collapse: collapse; width: 100%; font-family: var(--fm); font-size: 11px; }
        .dgrid th { position: sticky; top: 0; z-index: 1; background: var(--ink2); text-align: left; padding: 8px 8px;
                    font-size: 9px; letter-spacing: 1px; color: var(--txt2); border-bottom: 1px solid var(--line); white-space: nowrap; }
        .dgrid td { padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        .dgrid tr.rowbad td { background: rgba(255,92,77,0.07); }
        .dunit { opacity: 0.55; text-transform: none; letter-spacing: 0; }
        .dkey { color: var(--txt); font-weight: 600; white-space: nowrap; }
        .dcell { width: 92px; padding: 5px 6px; background: var(--ink); border: 1px solid var(--line2); border-radius: 3px;
                 color: var(--txt); font-family: var(--fm); font-size: 11px; }
        .dcell.wide { width: 100%; min-width: 260px; }
        .dcell:focus { border-color: var(--acc); outline: none; }
        .dcell.bad { border-color: var(--warn); color: var(--warn); }
        .derr { color: var(--warn); font-size: 9.5px; margin-top: 3px; }
        .dact { white-space: nowrap; display: flex; gap: 4px; }
        .dtag { display: inline-block; margin-left: 6px; padding: 1px 5px; border-radius: 3px; font-size: 8px; letter-spacing: 1px; font-weight: 700; }
        .dtag.edited { background: var(--amber); color: var(--ink); }
        .dtag.added { background: var(--acc); color: var(--ink); }
        .dtag.bad { background: var(--warn); color: #fff; }
        @media (max-width: 760px) {
          .dbody { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
          .dnav { display: flex; gap: 6px; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--line); }
          .dnav-item { width: auto; white-space: nowrap; }
        }
        .ask-wrap { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 900; padding: 20px; }
        .ask { background: var(--ink2); border: 1px solid var(--acc); border-radius: 6px; padding: 16px; width: min(340px, 100%); }
        .canvas-panel { background: var(--ink2); border: 1px solid var(--line); border-radius: 6px; padding: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .import-note { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; background: rgba(62,207,224,0.07); border: 1px solid rgba(62,207,224,0.4); border-radius: 5px; font-family: var(--fm); color: #B8E8EF; line-height: 1.5; }
        .menu-wrap { position: relative; }
        .menu-backdrop { position: fixed; inset: 0; z-index: 79; }
        .menu { position: absolute; right: 0; top: calc(100% + 6px); min-width: 290px; background: var(--panel); border: 1px solid var(--line2); border-radius: 6px; padding: 6px; z-index: 80; box-shadow: 0 14px 44px rgba(0,0,0,0.55); }
        .menu-item { display: block; width: 100%; text-align: left; padding: 9px 12px; background: transparent; border: none; color: var(--txt); font-family: var(--fm); font-size: 11.5px; letter-spacing: 0.5px; cursor: pointer; border-radius: 4px; }
        .menu-item:hover { background: var(--panel2); }
        .menu-item.primary { color: var(--acc); font-weight: 700; }
        .menu-sub { display: block; font-size: 9px; color: var(--txt3); letter-spacing: 0.3px; margin-top: 2px; font-weight: 400; }
        .menu-sep { height: 1px; background: var(--line); margin: 5px 4px; }
        .status-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 5px; flex-wrap: wrap; }
        .status-vals { display: flex; gap: 14px; flex-wrap: wrap; font-family: var(--fm); font-size: 11px; }
        .sv { color: var(--txt); white-space: nowrap; }
        .sv em { font-style: normal; color: var(--txt3); font-size: 9px; letter-spacing: 1px; margin-right: 3px; }
        .dim-sv { color: var(--txt3); letter-spacing: 1.5px; font-size: 10px; }
        .status-right { display: flex; gap: 8px; align-items: center; }
        .diag-badge { font-family: var(--fm); font-size: 10px; padding: 4px 9px; border-radius: 3px; border: 1px solid; cursor: pointer; background: transparent; }
        .diag-badge.ok { color: var(--ok); border-color: rgba(74,222,128,0.5); }
        .diag-badge.bad { color: var(--warn); border-color: rgba(255,92,77,0.6); }
        .diag-panel { position: fixed; right: 14px; bottom: 14px; width: min(520px, calc(100vw - 28px)); max-height: 60vh; overflow-y: auto; background: var(--panel); border: 1px solid var(--line2); border-radius: 6px; padding: 12px; z-index: 60; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
        .diag-head { display: flex; justify-content: space-between; align-items: center; font-family: var(--fm); font-size: 10px; letter-spacing: 2px; color: var(--txt2); margin-bottom: 10px; }
        .diag-group { font-family: var(--fm); font-size: 9px; letter-spacing: 2px; color: var(--txt3); margin: 10px 0 4px; }
        .diag-row { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; font-family: var(--fm); font-size: 10px; color: var(--txt2); border-bottom: 1px solid var(--line); }
        .diag-row.head-row { color: var(--txt); }
        .diag-row .p { color: var(--ok); }
        .diag-row .f { color: var(--warn); }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border: 1px solid var(--acc); background: var(--acc); color: var(--ink); font-family: var(--fm); font-size: 10px; letter-spacing: 1.5px; font-weight: 600; cursor: pointer; border-radius: 4px; min-height: 38px; transition: all .15s; }
        .btn:hover:not(:disabled) { filter: brightness(1.1); }
        .btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .btn.ghost { background: transparent; color: var(--txt2); border-color: var(--line2); }
        .btn.ghost:hover:not(:disabled) { color: var(--txt); border-color: var(--txt2); filter: none; }
        .tab-bar { display: flex; border-bottom: 1px solid var(--line); background: var(--ink2); position: sticky; top: 0; z-index: 10; }
        .tab { flex: 1; padding: 13px 8px; border: none; background: transparent; border-bottom: 2px solid transparent; font-family: var(--fm); font-size: 10px; letter-spacing: 2px; cursor: pointer; color: var(--txt3); font-weight: 600; }
        .tab.on { color: var(--txt); border-bottom-color: var(--acc); }
        .sidebar { border-right: 1px solid var(--line); padding: 20px; overflow-y: auto; background: var(--ink); }
        .main-col { padding: 18px; display: flex; flex-direction: column; gap: 14px; min-width: 0; overflow-y: auto; }
        .toggle-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .strip-sep { width: 1px; height: 16px; background: var(--line2); margin: 0 4px; }
        .legend-box { padding: 10px 12px; background: var(--panel); border: 1px solid var(--line2); border-radius: 5px; }
        .legend-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 2px 18px; margin-top: 6px; }
        .legend-row { display: flex; gap: 8px; font-family: var(--fm); font-size: 10.5px; color: var(--txt2); padding: 2px 0; }
        .legend-abbr { color: var(--acc); font-weight: 700; min-width: 68px; flex-shrink: 0; }
        .mini-preview { position: sticky; top: -20px; z-index: 30; margin: -20px -20px 16px; padding: 10px 14px 7px; background: var(--ink); border-bottom: 1px solid var(--line2); cursor: pointer; }
        .mini-preview svg { display: block; width: 100%; height: auto; max-height: 130px; }
        .mini-tag { font-family: var(--fm); font-size: 8px; letter-spacing: 1.5px; color: var(--txt3); text-align: center; margin-top: 4px; }
        input[type="number"] { -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <header className="hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div>
            <h1>TELL·A·VISION</h1>
            <div className="sub">BLUEPRINT EDITION · v{APP_VERSION} · REV {revision || "01"} · FRONT ELEVATION</div>
          </div>
          {!isMobile && startBtns}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {projectName && <span className="hdr-proj">{projectName}{clientName ? ` — ${clientName}` : ""}</span>}
          {!isMobile && exportBtns}
        </div>
      </header>

      {isMobile && (
        <div className="tab-bar">
          <button className={`tab ${activePanel === "setup" ? "on" : ""}`} onClick={() => setActivePanel("setup")}>SETUP</button>
          <button className={`tab ${activePanel === "drawing" ? "on" : ""}`} onClick={() => setActivePanel("drawing")}>DRAWING</button>
          <button className={`tab ${activePanel === "specs" ? "on" : ""}`} onClick={() => setActivePanel("specs")}>SPECS</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (isTablet ? "290px 1fr" : "320px 1fr"), flex: 1, minHeight: 0 }}>
        <aside className="sidebar" style={{ display: isMobile && activePanel !== "setup" ? "none" : "block" }}>
          {isMobile && layout && (
            <div className="mini-preview" onClick={() => setActivePanel("drawing")}>
              <svg viewBox={`0 0 ${screenSchem.svgW} ${screenSchem.svgH}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill={screenSchem.P.canvas}/>
                {screenSchem.elements}
              </svg>
              <div className="mini-tag">LIVE PREVIEW — TAP FOR FULL DRAWING</div>
            </div>
          )}
          {setupPanel}
        </aside>

        <main className={`main-col ${dragOver ? "dropping" : ""}`}
              style={{ display: isMobile && activePanel !== "drawing" ? "none" : "flex" }}
              onDragOver={e => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
              onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
              onDrop={e => { e.preventDefault(); setDragOver(false); routeFiles(e.dataTransfer && e.dataTransfer.files); }}>
          {importBanner}
          {startPanel}
          {sizeStrip}
          {legendPanel}
          {canvas}
          {askDialog}
          {statusBar}
          {isMobile && <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>{startBtns}{exportBtns}</div>}
        </main>

        {isMobile && activePanel === "specs" && (
          <div className="main-col">
            <div className="sec-title" style={{ marginTop: 0 }}><Icon name="doc"/> SPEC SUMMARY</div>
            {layout ? (
              <div className="rec-box" style={{ marginTop: 0 }}>
                <div className="stat"><span>TV</span><strong>{brand} {selectedSize}"</strong></div>
                <div className="stat"><span>TV Width</span><strong>{fmt(layout.tvW)}</strong></div>
                <div className="stat"><span>TV Height</span><strong>{fmt(layout.tvH)}</strong></div>
                <div className="stat"><span>Center AFF</span><strong>{fmt(layout.centerH)}</strong></div>
                <div className="stat"><span>Bottom AFF</span><strong>{fmt(layout.tvBottom)}</strong></div>
                <div className="stat"><span>TV CL from left</span><strong>{fmt(layout.tvCL)}</strong></div>
                {showTapeOut && <div className="stat"><span>Top AFF</span><strong>{fmt(layout.tvTop)}</strong></div>}
                {showBoxDims && layout.box && <div className="stat"><span>Box bottom AFF</span><strong>{fmt(layout.box.btm)}</strong></div>}
                {showOutlet && <div className="stat"><span>Outlet AFF</span><strong>{fmt(layout.outlet.aff)}</strong></div>}
                {showLowVolt && <div className="stat"><span>LV AFF</span><strong>{fmt(layout.lv.aff)}</strong></div>}
                {layout.vesa && <div className="stat"><span>VESA</span><strong>{layout.vesa.spec.w_mm}×{layout.vesa.spec.h_mm} {layout.vesa.spec.screw}</strong></div>}
                {layout.box && <div className="stat"><span>Back box</span><strong>{layout.box.label}</strong></div>}
              </div>
            ) : <div className="hint">Select a TV size on the DRAWING tab.</div>}
            {layout && (
              <>
                <div className="sec-title"><Icon name="box"/> ROUGH-IN PARTS</div>
                <div className="rec-box" style={{ marginTop: 0 }}>
                  {buildPartsList({ layout, showOutlet, showLowVolt }).map((r, i) => (
                    <div key={i} className="stat"><span>{r[0]}</span><strong>{r[1]}</strong></div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {settingsPanel}
      {showData && <DataScreen onClose={() => setShowData(false)} onChange={() => setCatalogRev(r => r + 1)}/>}
      {printSvg}
      {diagPanel}
    </div>
  );
}
