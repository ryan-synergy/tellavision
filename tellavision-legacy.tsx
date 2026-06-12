import { useState, useMemo, useRef, useEffect } from "react";

const TV_CATALOG = {
  Sony:    [42, 43, 48, 50, 55, 65, 75, 77, 85, 98, 100],
  Samsung: [32, 43, 50, 55, 65, 75, 77, 83, 85, 98, 100, 115],
  LG:      [42, 48, 55, 65, 77, 83, 97],
};

const BACK_BOXES = {
  "FA-WB16-2S": { brand: "Future Automation", line: "WB", w: 25.3, h: 16.3, d: 3.8, label: "WB16-2S", bracket: "PS40", tvMin: 32, tvMax: 43 },
  "FA-WB21":    { brand: "Future Automation", line: "WB", w: 21.9, h: 14.8, d: 3.8, label: "WB21",    bracket: "PS40", tvMin: 40, tvMax: 55 },
  "FA-WB21-2S": { brand: "Future Automation", line: "WB", w: 21.9, h: 14.8, d: 3.8, label: "WB21-2S (twin stud)", bracket: "PS40", tvMin: 40, tvMax: 55 },
  "FA-WB26":    { brand: "Future Automation", line: "WB", w: 26.9, h: 14.8, d: 3.8, label: "WB26",    bracket: "PS40/PS55", tvMin: 50, tvMax: 65 },
  "FA-WB26-2S": { brand: "Future Automation", line: "WB", w: 26.9, h: 14.8, d: 3.8, label: "WB26-2S (twin stud)", bracket: "PS40/PS55", tvMin: 50, tvMax: 65 },
  "FA-WB31":    { brand: "Future Automation", line: "WB", w: 31.9, h: 14.8, d: 3.8, label: "WB31",    bracket: "PS40/PS55/PS65", tvMin: 60, tvMax: 75 },
  "FA-WB31-2S": { brand: "Future Automation", line: "WB", w: 31.9, h: 14.8, d: 3.8, label: "WB31-2S (twin stud)", bracket: "PS40/PS55/PS65", tvMin: 60, tvMax: 75 },
  "FA-WB80":    { brand: "Future Automation", line: "WB", w: 36.0, h: 20.0, d: 5.5, label: "WB80",    bracket: "PS80", tvMin: 75, tvMax: 98 },
  "SB-RBX-8":     { brand: "SnapAV Strong", line: "VersaBox",     w: 14.0, h: 8.0,  d: 3.9, label: "VersaBox 8x14",     bracket: "Razor", tvMin: 32, tvMax: 65 },
  "SB-RBX-14":    { brand: "SnapAV Strong", line: "VersaBox",     w: 14.0, h: 14.0, d: 3.9, label: "VersaBox 14x14",    bracket: "Razor", tvMin: 50, tvMax: 85 },
  "SB-RBX-PRO-8": { brand: "SnapAV Strong", line: "VersaBox Pro", w: 14.0, h: 8.0,  d: 3.9, label: "VersaBox Pro 8x14", bracket: "Razor", tvMin: 32, tvMax: 65 },
  "SB-RBX-PRO-14":{ brand: "SnapAV Strong", line: "VersaBox Pro", w: 14.0, h: 14.0, d: 3.9, label: "VersaBox Pro 14x14",bracket: "Razor", tvMin: 50, tvMax: 85 },
  "SB-RBX-PRO-XL":{ brand: "SnapAV Strong", line: "VersaBox Pro", w: 20.0, h: 14.0, d: 3.9, label: "VersaBox Pro XL 14x20", bracket: "Razor", tvMin: 65, tvMax: 98, note: "Fits Samsung One Connect 8K" },
};

const recommendBackBox = (tvSize, mountType, brand) => {
  if (!tvSize) return null;
  const samsung8K = brand === "Samsung" && tvSize >= 65;
  if (mountType === "articulating") {
    if (tvSize <= 43) return "FA-WB16-2S";
    if (tvSize <= 55) return "FA-WB21";
    if (tvSize <= 65) return "FA-WB26";
    if (tvSize <= 75) return "FA-WB31";
    return "FA-WB80";
  }
  if (samsung8K) return "SB-RBX-PRO-XL";
  if (tvSize <= 55) return "SB-RBX-PRO-8";
  if (tvSize > 85) return "SB-RBX-PRO-XL";
  return "SB-RBX-PRO-14";
};

const VESA_DATA = {
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
    115:{ w_mm: 800, h_mm: 600, screw: "M8", voffset_pct: 0, note: "QN90F - confirm with spec sheet" },
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

const tvDims = (size) => {
  const w = size * 0.872 + 1.2;
  const h = size * 0.490 + 1.2;
  return { w, h };
};

// Gap between TV bottom edge and mantel top / firebox opening top, in inches.
// recommendedCenterH, the size filter, and the fit warnings must all agree on these.
const CLEARANCE = { mantel: 8, noMantel: 10 };

const STORAGE_KEY = "tv-wall-planner-v1";
const loadSaved = () => {
  try {
    if (typeof window === "undefined") return {};
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const SAVED = loadSaved();
const SAVED_BRAND = ["Sony", "Samsung", "LG"].includes(SAVED.brand) ? SAVED.brand : "Sony";
const SAVED_SIZE = TV_CATALOG[SAVED_BRAND].includes(SAVED.selectedSize) ? SAVED.selectedSize : null;

const Icon = ({ name, size = 14 }) => {
  const s = size;
  const stroke = "currentColor";
  const sw = 1.4;
  const paths = {
    wall: <rect x="2" y="2" width={s-4} height={s-4} fill="none" stroke={stroke} strokeWidth={sw}/>,
    fire: <path d={`M${s/2} 3 C${s/2-2} ${s/2}, ${s-4} ${s/2}, ${s/2+1} ${s-3} C${s/2-3} ${s-4}, ${s/2-4} ${s/2+1}, ${s/2} 3 Z`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>,
    eye: <><path d={`M2 ${s/2} Q${s/2} 2, ${s-2} ${s/2} Q${s/2} ${s-2}, 2 ${s/2} Z`} fill="none" stroke={stroke} strokeWidth={sw}/><circle cx={s/2} cy={s/2} r="1.6" fill={stroke}/></>,
    tv: <><rect x="2" y="3" width={s-4} height={s-7} fill="none" stroke={stroke} strokeWidth={sw}/><line x1={s/2-3} y1={s-2} x2={s/2+3} y2={s-2} stroke={stroke} strokeWidth={sw}/></>,
    mount: <><rect x="3" y={s/2-1} width={s-6} height="2" fill="none" stroke={stroke} strokeWidth={sw}/><line x1="2" y1="3" x2="2" y2={s-3} stroke={stroke} strokeWidth={sw}/><line x1={s-2} y1="3" x2={s-2} y2={s-3} stroke={stroke} strokeWidth={sw}/></>,
    box: <><rect x="2.5" y="3.5" width={s-5} height={s-7} fill="none" stroke={stroke} strokeWidth={sw}/><line x1="2.5" y1={s/2} x2={s-2.5} y2={s/2} stroke={stroke} strokeWidth={sw} strokeDasharray="1.5 1"/></>,
    plug: <><rect x={s/2-3} y="3" width="6" height={s-6} rx="1" fill="none" stroke={stroke} strokeWidth={sw}/><circle cx={s/2-1} cy={s/2} r="0.8" fill={stroke}/><circle cx={s/2+1} cy={s/2} r="0.8" fill={stroke}/></>,
    bolt: <path d={`M${s/2+1} 2 L3 ${s/2+1} L${s/2-1} ${s/2+1} L${s/2-2} ${s-2} L${s-3} ${s/2-1} L${s/2+1} ${s/2-1} Z`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>,
    arrow: <path d={`M3 ${s/2} L${s-3} ${s/2} M${s-6} ${s/2-3} L${s-3} ${s/2} L${s-6} ${s/2+3}`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>,
    download: <path d={`M${s/2} 2 L${s/2} ${s-5} M${s/2-3} ${s/2+1} L${s/2} ${s-5} L${s/2+3} ${s/2+1} M3 ${s-2} L${s-3} ${s-2}`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>,
    check: <path d={`M3 ${s/2} L${s/2-1} ${s-4} L${s-3} 4`} fill="none" stroke={stroke} strokeWidth={sw+0.4} strokeLinecap="round" strokeLinejoin="round"/>,
  };
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{display:"inline-block", verticalAlign:"middle"}}>{paths[name]}</svg>;
};

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

  const [mountType, setMountType] = useState(SAVED.mountType === "articulating" ? "articulating" : "flat");
  const [showBackBox, setShowBackBox] = useState(SAVED.showBackBox ?? true);
  const [backBoxModel, setBackBoxModel] = useState(BACK_BOXES[SAVED.backBoxModel] ? SAVED.backBoxModel : "FA-WB26");
  const [autoRecommendBox, setAutoRecommendBox] = useState(SAVED.autoRecommendBox ?? true);
  const [showOutlet, setShowOutlet] = useState(SAVED.showOutlet ?? true);
  const [showLowVolt, setShowLowVolt] = useState(SAVED.showLowVolt ?? true);
  const [showVesa, setShowVesa] = useState(SAVED.showVesa ?? true);

  const [mountHeightOverride, setMountHeightOverride] = useState(SAVED.mountHeightOverride ?? "");
  const [heightRef, setHeightRef] = useState(SAVED.heightRef === "bottom" ? "bottom" : "center");
  const [showAllSizes, setShowAllSizes] = useState(SAVED.showAllSizes ?? false);
  const [projectName, setProjectName] = useState(SAVED.projectName ?? "");
  const [clientName, setClientName] = useState(SAVED.clientName ?? "");

  const [viewportW, setViewportW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [activePanel, setActivePanel] = useState("schematic");
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = viewportW < 768;
  const isTablet = viewportW >= 768 && viewportW < 1024;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        wallW, wallH, hasFireplace, fbOpeningH, fbOpeningW, fbOffsetX, hasMantel,
        mantelH, mantelDepth, viewDist, useViewDist, brand, selectedSize, tvOffsetX,
        mountType, showBackBox, backBoxModel, autoRecommendBox, showOutlet,
        showLowVolt, showVesa, mountHeightOverride, heightRef, showAllSizes,
        projectName, clientName,
      }));
    } catch { /* storage unavailable (private mode etc.) — run without persistence */ }
  }, [wallW, wallH, hasFireplace, fbOpeningH, fbOpeningW, fbOffsetX, hasMantel,
      mantelH, mantelDepth, viewDist, useViewDist, brand, selectedSize, tvOffsetX,
      mountType, showBackBox, backBoxModel, autoRecommendBox, showOutlet,
      showLowVolt, showVesa, mountHeightOverride, heightRef, showAllSizes,
      projectName, clientName]);

  const resetAll = () => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    window.location.reload();
  };

  const svgRef = useRef(null);

  const recommendations = useMemo(() => {
    const sizes = TV_CATALOG[brand];
    const maxByWall = wallW * 0.65;
    const minByWall = wallW * 0.35;
    let candidates = sizes.filter(sz => {
      const { w } = tvDims(sz);
      if (hasFireplace && hasMantel) {
        const available = wallH - mantelH - CLEARANCE.mantel;
        return w <= maxByWall && w >= minByWall && tvDims(sz).h <= available;
      }
      if (hasFireplace && !hasMantel) {
        const available = wallH - fbOpeningH - CLEARANCE.noMantel;
        return w <= maxByWall && w >= minByWall && tvDims(sz).h <= available;
      }
      return w <= maxByWall && w >= minByWall;
    });
    if (useViewDist) {
      const ideal = viewDist / 1.6;
      candidates.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
    }
    return candidates.slice(0, 4);
  }, [brand, wallW, wallH, hasFireplace, hasMantel, mantelH, fbOpeningH, viewDist, useViewDist]);

  const recommendedCenterH = useMemo(() => {
    if (!selectedSize) return 42;
    const { h: tvH } = tvDims(selectedSize);
    if (hasFireplace && hasMantel) return mantelH + CLEARANCE.mantel + tvH / 2;
    if (hasFireplace && !hasMantel) return fbOpeningH + CLEARANCE.noMantel + tvH / 2;
    let base = 42;
    if (useViewDist && viewDist > 144) base = 44;
    if (useViewDist && viewDist > 192) base = 46;
    return base;
  }, [selectedSize, hasFireplace, hasMantel, mantelH, fbOpeningH, viewDist, useViewDist]);

  const centerH = useMemo(() => {
    if (!mountHeightOverride) return recommendedCenterH;
    const val = parseFloat(mountHeightOverride);
    if (isNaN(val)) return recommendedCenterH;
    if (heightRef === "bottom" && selectedSize) {
      const { h: tvH } = tvDims(selectedSize);
      return val + tvH / 2;
    }
    return val;
  }, [mountHeightOverride, heightRef, recommendedCenterH, selectedSize]);

  const recommendedDisplayH = useMemo(() => {
    if (heightRef === "bottom" && selectedSize) {
      const { h: tvH } = tvDims(selectedSize);
      return recommendedCenterH - tvH / 2;
    }
    return recommendedCenterH;
  }, [heightRef, recommendedCenterH, selectedSize]);

  const tvBottomH = useMemo(() => {
    if (!selectedSize) return 0;
    const { h: tvH } = tvDims(selectedSize);
    return centerH - tvH / 2;
  }, [centerH, selectedSize]);

  const recommendedBox = useMemo(() => recommendBackBox(selectedSize, mountType, brand), [selectedSize, mountType, brand]);
  const effectiveBoxModel = autoRecommendBox && recommendedBox ? recommendedBox : backBoxModel;

  const vesaSpec = useMemo(() => {
    if (!selectedSize) return null;
    return VESA_DATA[brand]?.[selectedSize] || null;
  }, [brand, selectedSize]);

  // Signed horizontal offsets in inches (+ = right). Stored as strings so the
  // user can type a leading "-" without the input snapping back to 0.
  const fbOffsetIn = parseFloat(fbOffsetX) || 0;
  const tvOffsetIn = parseFloat(tvOffsetX) || 0;
  // TV centerline measured from the left wall edge. With a fireplace the TV
  // follows the firebox centerline by default; tvOffsetIn shifts from there.
  const tvCenterFromLeft = wallW / 2 + (hasFireplace ? fbOffsetIn : 0) + tvOffsetIn;

  // Everything positioned in INCHES (X from left wall edge, heights AFF =
  // above finished floor). The schematic, spec summary, and PDF all read from
  // this one source so a number on screen always matches the drawing.
  const layout = useMemo(() => {
    if (!selectedSize) return null;
    const { w: tvW, h: tvH } = tvDims(selectedSize);
    const tvCL = tvCenterFromLeft;
    const tvLeft = tvCL - tvW / 2;
    const tvRight = tvCL + tvW / 2;
    const tvTop = centerH + tvH / 2;
    const tvBottom = centerH - tvH / 2;

    let vesa = null;
    if (vesaSpec) {
      vesa = {
        w: vesaSpec.w_mm / 25.4,
        h: vesaSpec.h_mm / 25.4,
        // negative voffset_pct = pattern biased low on the panel
        aff: centerH + (vesaSpec.voffset_pct / 100) * tvH,
      };
    }

    let box = null;
    if (showBackBox) {
      const bb = BACK_BOXES[effectiveBoxModel];
      const anchorAFF = vesa ? vesa.aff : centerH;
      let cx;
      if (mountType === "articulating" && bb.brand === "Future Automation") {
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
      box = { ...bb, model: effectiveBoxModel, cx, aff: anchorAFF, extendsOff, underRated };
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

    return { tvW, tvH, tvCL, tvLeft, tvRight, tvTop, tvBottom, vesa, box, outlet, lv };
  }, [selectedSize, tvCenterFromLeft, centerH, vesaSpec, showBackBox, effectiveBoxModel, mountType]);

  const placementIssues = useMemo(() => {
    if (!layout) return [];
    const issues = [];
    if (layout.tvBottom < 0) issues.push(`TV bottom is ${(-layout.tvBottom).toFixed(1)}" below the floor`);
    if (layout.tvTop > wallH) issues.push(`TV top is ${(layout.tvTop - wallH).toFixed(1)}" above the wall`);
    if (layout.tvLeft < 0) issues.push(`TV extends ${(-layout.tvLeft).toFixed(1)}" past the left wall edge`);
    if (layout.tvRight > wallW) issues.push(`TV extends ${(layout.tvRight - wallW).toFixed(1)}" past the right wall edge`);
    return issues;
  }, [layout, wallH, wallW]);

  const schematic = useMemo(() => {
    const safeWallW = Math.max(wallW || 1, 1);
    const safeWallH = Math.max(wallH || 1, 1);
    const pad = isMobile ? 56 : 72;
    // Right padding must always leave room for the wall-height "H" label
    // (drawn at wallX + wallPxW + 32, ~48px wide). Extra room added for
    // VESA / back-box callouts when those are visible.
    const wallHeightLabelPad = 88;
    const hasCallouts = selectedSize && (showVesa || showBackBox || showOutlet || showLowVolt);
    const rightPad = Math.max(pad, wallHeightLabelPad) + (hasCallouts ? 140 : 0);
    const maxW = isMobile ? Math.max(viewportW - 60, 280) : (isTablet ? Math.max(viewportW - 360, 460) : 680);
    const maxH = isMobile ? 360 : (isTablet ? 480 : 520);
    const scale = Math.min(maxW / safeWallW, maxH / safeWallH);
    // The mount-height dimension (bg pill at wallX − 52, ~92px total) sits left
    // of the wall — left padding must cover it or the label clips off the SVG.
    const leftPad = selectedSize ? Math.max(pad, 96) : pad;
    const svgW = safeWallW * scale + leftPad + rightPad;
    const hasTitleBlock = !!(projectName || clientName);
    const svgH = safeWallH * scale + pad * 2 + (hasTitleBlock ? 16 : 0);

    const wallX = leftPad;
    const wallY = pad;
    const wallPxW = safeWallW * scale;
    const wallPxH = safeWallH * scale;
    const floorY = wallY + wallPxH;

    const elements = [];

    elements.push(<rect key="wall" x={wallX} y={wallY} width={wallPxW} height={wallPxH} fill="#f5f3ee" stroke="#2a2620" strokeWidth="1.5"/>);
    elements.push(<line key="floor" x1={wallX - 20} y1={floorY} x2={wallX + wallPxW + 20} y2={floorY} stroke="#2a2620" strokeWidth="2"/>);
    for (let i = 0; i < 12; i++) {
      const x = wallX - 18 + i * ((wallPxW + 36) / 12);
      elements.push(<line key={`hatch-${i}`} x1={x} y1={floorY} x2={x + 6} y2={floorY + 8} stroke="#2a2620" strokeWidth="0.8"/>);
    }

    if (hasFireplace) {
      const fbW = fbOpeningW * scale;
      const fbH = fbOpeningH * scale;
      const fbX = wallX + (wallPxW - fbW) / 2 + fbOffsetIn * scale;
      const fbY = floorY - fbH;
      elements.push(<rect key="fb" x={fbX} y={fbY} width={fbW} height={fbH} fill="#e8e3d8" stroke="#2a2620" strokeWidth="1"/>);
      const inset = 6;
      elements.push(<rect key="fbop" x={fbX + inset} y={fbY + inset} width={fbW - inset*2} height={fbH - inset*2} fill="#1a1612" stroke="#2a2620" strokeWidth="0.8"/>);
      if (hasMantel) {
        const mH = mantelDepth * scale;
        const mY = floorY - mantelH * scale;
        const mantelOverhang = 12 * scale;
        elements.push(<rect key="mantel" x={fbX - mantelOverhang} y={mY} width={fbW + mantelOverhang*2} height={mH} fill="#d4cdb8" stroke="#2a2620" strokeWidth="1"/>);
      }
    }

    if (layout) {
      const { tvW, tvH } = layout;
      const tvPxW = tvW * scale;
      const tvPxH = tvH * scale;
      const tvX = wallX + layout.tvLeft * scale;
      const tvCenterY = floorY - centerH * scale;
      const tvY = tvCenterY - tvPxH / 2;

      const vesaCenterX = wallX + layout.tvCL * scale;
      let vesaCenterY = tvCenterY;
      let vesaPxW = 0;
      let vesaPxH = 0;
      if (layout.vesa) {
        vesaPxW = layout.vesa.w * scale;
        vesaPxH = layout.vesa.h * scale;
        vesaCenterY = floorY - layout.vesa.aff * scale;
      }

      elements.push(<rect key="tv" x={tvX} y={tvY} width={tvPxW} height={tvPxH} fill="#1a1612" stroke="#2a2620" strokeWidth="1.5"/>);
      elements.push(<rect key="tvscreen" x={tvX + 3} y={tvY + 3} width={tvPxW - 6} height={tvPxH - 6} fill="#252119" stroke="none"/>);
      // TV size label - top-left corner of screen, small and unobtrusive
      elements.push(<text key="tvlabel" x={tvX + 8} y={tvY + 16} textAnchor="start" fill="#c4bda8" fontSize="10" fontFamily="var(--font-display)" letterSpacing="1" fontWeight="500">{brand.toUpperCase()} {selectedSize}"</text>);

      let bbX = 0, bbY = 0, bbPxW = 0, bbPxH = 0, bbValid = false, bbExtendsOff = false;
      if (layout.box) {
        bbPxW = layout.box.w * scale;
        bbPxH = layout.box.h * scale;
        bbX = wallX + (layout.box.cx - layout.box.w / 2) * scale;
        bbY = floorY - (layout.box.aff + layout.box.h / 2) * scale;
        bbValid = true;
        bbExtendsOff = layout.box.extendsOff;
        const bbColor = bbExtendsOff ? "#e64a3a" : "#3da8c4";
        elements.push(<rect key="bb" x={bbX} y={bbY} width={bbPxW} height={bbPxH} fill={bbColor} fillOpacity="0.15" stroke={bbColor} strokeWidth="1.8" strokeDasharray="8 4"/>);
      }

      if (vesaSpec) {
        let mountPxW, mountPxH;
        if (mountType === "flat") {
          mountPxW = vesaPxW + 2 * scale;
          mountPxH = 3.5 * scale;
        } else {
          mountPxW = vesaPxW + 3 * scale;
          mountPxH = vesaPxH + 2 * scale;
        }
        const mountX = vesaCenterX - mountPxW / 2;
        const mountY = vesaCenterY - mountPxH / 2;
        // Mount bracket: dotted line, neutral gray, low contrast (background element)
        elements.push(<rect key="mount" x={mountX} y={mountY} width={mountPxW} height={mountPxH} fill="none" stroke="#7a7268" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>);
      }

      if (showVesa && vesaSpec) {
        const vesaLeft = vesaCenterX - vesaPxW / 2;
        const vesaTop = vesaCenterY - vesaPxH / 2;
        const holeR = 3.5;
        // VESA pattern - brighter, more contrast against dark TV
        elements.push(<rect key="vesa-rect" x={vesaLeft} y={vesaTop} width={vesaPxW} height={vesaPxH} fill="none" stroke="#ffc233" strokeWidth="1.5" strokeDasharray="3 2" opacity="1"/>);
        const holes = [
          [vesaLeft, vesaTop],
          [vesaLeft + vesaPxW, vesaTop],
          [vesaLeft, vesaTop + vesaPxH],
          [vesaLeft + vesaPxW, vesaTop + vesaPxH],
        ];
        holes.forEach(([hx, hy], i) => {
          // Outer ring (bright yellow) + inner solid dot (darker yellow) for visibility on black
          elements.push(<circle key={`hole-${i}`} cx={hx} cy={hy} r={holeR} fill="#ffc233" stroke="#1a1612" strokeWidth="1.5"/>);
          elements.push(<circle key={`hole-inner-${i}`} cx={hx} cy={hy} r={holeR - 1.8} fill="#1a1612"/>);
        });
        // Offset indicator if VESA is offset from TV center
        if (vesaSpec.voffset_pct !== 0) {
          const tvGeomCenterY = tvY + tvPxH / 2;
          elements.push(<line key="vesa-cl" x1={tvX + 4} y1={tvGeomCenterY} x2={tvX + tvPxW - 4} y2={tvGeomCenterY} stroke="#ffc233" strokeWidth="0.6" strokeDasharray="1 4" opacity="0.5"/>);
        }
        // VESA label OUTSIDE the TV on top-right with leader line
        const vesaLabelX = tvX + tvPxW + 16;
        const vesaLabelY = tvY + 24;
        // Leader line from upper-right VESA hole to label
        elements.push(<line key="vesa-leader" x1={vesaLeft + vesaPxW} y1={vesaTop} x2={vesaLabelX - 4} y2={vesaLabelY - 4} stroke="#ffc233" strokeWidth="0.8" opacity="0.7"/>);
        // Label background pill
        const vesaLabelText = `VESA ${vesaSpec.w_mm}×${vesaSpec.h_mm}`;
        const vesaLabelW = vesaLabelText.length * 6.5 + 12;
        elements.push(<rect key="vesa-labelbg" x={vesaLabelX} y={vesaLabelY - 12} width={vesaLabelW} height={16} fill="#ffc233" stroke="#2a2620" strokeWidth="0.8" rx="2"/>);
        elements.push(<text key="vesa-label" x={vesaLabelX + 6} y={vesaLabelY - 1} textAnchor="start" fill="#2a2620" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="0.5">{vesaLabelText}</text>);
        elements.push(<text key="vesa-label2" x={vesaLabelX + 6} y={vesaLabelY + 12} textAnchor="start" fill="#6a5a1a" fontSize="9" fontFamily="var(--font-mono)" fontWeight="500">{vesaSpec.screw} screw</text>);
      }

      if (layout.box) {
        // Place label outside TV on the right, below VESA label area
        const bbLabelX = tvX + tvPxW + 16;
        const bbLabelY = tvY + 60;
        // Leader line from back box right edge to label
        elements.push(<line key="bb-leader" x1={bbX + bbPxW} y1={bbY + bbPxH/2} x2={bbLabelX - 4} y2={bbLabelY - 4} stroke={bbExtendsOff ? "#e64a3a" : "#3da8c4"} strokeWidth="0.8" opacity="0.7"/>);
        // Label background pill
        const bbLabelText = layout.box.label;
        const bbLabelW = Math.max(bbLabelText.length * 6 + 12, 90);
        const bgColor = bbExtendsOff ? "#e64a3a" : "#3da8c4";
        elements.push(<rect key="bb-labelbg" x={bbLabelX} y={bbLabelY - 12} width={bbLabelW} height={16} fill={bgColor} stroke="#2a2620" strokeWidth="0.8" rx="2"/>);
        elements.push(<text key="bblabel" x={bbLabelX + 6} y={bbLabelY - 1} textAnchor="start" fill="#ffffff" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="0.3">{bbLabelText}</text>);
        elements.push(<text key="bblabel2" x={bbLabelX + 6} y={bbLabelY + 12} textAnchor="start" fill={bgColor} fontSize="9" fontFamily="var(--font-mono)" fontWeight="500">{layout.box.brand}</text>);
        if (bbExtendsOff) {
          elements.push(<text key="bbwarn" x={bbLabelX + 6} y={bbLabelY + 24} textAnchor="start" fill="#e64a3a" fontSize="8" fontFamily="var(--font-mono)" fontWeight="600">! EXTENDS BEYOND TV</text>);
        }
      }

      if (showOutlet || showLowVolt) {
        // Rough-in callout text: height AFF + lateral offset from the TV centerline
        const sideOf = (x) => {
          const d = x - layout.tvCL;
          if (Math.abs(d) < 0.05) return "ON TV CL";
          return `${Math.abs(d).toFixed(1)}" ${d < 0 ? "LT" : "RT"} OF CL`;
        };
        if (showOutlet) {
          const ox = wallX + layout.outlet.x * scale;
          const oy = floorY - layout.outlet.aff * scale;
          // Outlet - bright green for high visibility
          elements.push(<rect key="outlet" x={ox - 7} y={oy - 5} width={14} height={10} fill="#ffffff" stroke="#2a8a3a" strokeWidth="1.4"/>);
          elements.push(<circle key="o1" cx={ox - 2.5} cy={oy} r="1.2" fill="#2a8a3a"/>);
          elements.push(<circle key="o2" cx={ox + 2.5} cy={oy} r="1.2" fill="#2a8a3a"/>);
          const oLabelX = tvX + tvPxW + 16;
          const oLabelY = tvY + 96;
          elements.push(<line key="o-leader" x1={ox + 7} y1={oy} x2={oLabelX - 4} y2={oLabelY - 4} stroke="#2a8a3a" strokeWidth="0.8" opacity="0.7"/>);
          const oText = `PWR ${layout.outlet.aff.toFixed(1)}" AFF`;
          elements.push(<rect key="o-labelbg" x={oLabelX} y={oLabelY - 12} width={Math.max(oText.length * 6.2 + 12, 90)} height={16} fill="#2a8a3a" stroke="#2a2620" strokeWidth="0.8" rx="2"/>);
          elements.push(<text key="o-label" x={oLabelX + 6} y={oLabelY - 1} textAnchor="start" fill="#ffffff" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="0.3">{oText}</text>);
          elements.push(<text key="o-label2" x={oLabelX + 6} y={oLabelY + 12} textAnchor="start" fill="#2a8a3a" fontSize="9" fontFamily="var(--font-mono)" fontWeight="500">{sideOf(layout.outlet.x)}</text>);
        }
        if (showLowVolt) {
          const lx = wallX + layout.lv.x * scale;
          const ly = floorY - layout.lv.aff * scale;
          // LV - bright orange for high visibility
          elements.push(<rect key="lv" x={lx - 6} y={ly - 5} width={12} height={10} fill="#ffffff" stroke="#c4651a" strokeWidth="1.4"/>);
          elements.push(<text key="lvl" x={lx} y={ly + 3} textAnchor="middle" fill="#c4651a" fontSize="7" fontFamily="var(--font-mono)" fontWeight="700">LV</text>);
          const lLabelX = tvX + tvPxW + 16;
          const lLabelY = tvY + 132;
          elements.push(<line key="lv-leader" x1={lx + 6} y1={ly} x2={lLabelX - 4} y2={lLabelY - 4} stroke="#c4651a" strokeWidth="0.8" opacity="0.7"/>);
          const lText = `LV ${layout.lv.aff.toFixed(1)}" AFF`;
          elements.push(<rect key="lv-labelbg" x={lLabelX} y={lLabelY - 12} width={Math.max(lText.length * 6.2 + 12, 90)} height={16} fill="#c4651a" stroke="#2a2620" strokeWidth="0.8" rx="2"/>);
          elements.push(<text key="lv-label" x={lLabelX + 6} y={lLabelY - 1} textAnchor="start" fill="#ffffff" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="0.3">{lText}</text>);
          elements.push(<text key="lv-label2" x={lLabelX + 6} y={lLabelY + 12} textAnchor="start" fill="#c4651a" fontSize="9" fontFamily="var(--font-mono)" fontWeight="500">{sideOf(layout.lv.x)}</text>);
        }
      }

      // Height dimension - large readable
      const dimX = wallX - 32;
      const refY = heightRef === "bottom" ? (tvY + tvPxH) : tvCenterY;
      const refValue = heightRef === "bottom" ? tvBottomH : centerH;
      const refLabel = heightRef === "bottom" ? "BOTTOM" : "CENTER";
      elements.push(<line key="dh1" x1={dimX} y1={floorY} x2={dimX} y2={refY} stroke="#2a2620" strokeWidth="1"/>);
      elements.push(<line key="dh1a" x1={dimX - 4} y1={floorY} x2={dimX + 4} y2={floorY} stroke="#2a2620" strokeWidth="1"/>);
      elements.push(<line key="dh1b" x1={dimX - 4} y1={refY} x2={dimX + 4} y2={refY} stroke="#2a2620" strokeWidth="1"/>);
      const dhMidY = (floorY + refY)/2;
      elements.push(<rect key="dh1bg" x={dimX - 52} y={dhMidY - 10} width={46} height={20} fill="#faf8f3" stroke="none" rx="2"/>);
      elements.push(<text key="dh1t" x={dimX - 8} y={dhMidY + 4} textAnchor="end" fill="#2a2620" fontSize="14" fontWeight="600" fontFamily="var(--font-mono)">{refValue.toFixed(1)}"</text>);
      elements.push(<text key="dh1l" x={dimX - 8} y={dhMidY + 16} textAnchor="end" fill="#8a7d5e" fontSize="8" fontFamily="var(--font-mono)" letterSpacing="1">TO {refLabel}</text>);

      if (heightRef === "bottom") {
        elements.push(<line key="reftick" x1={tvX - 12} y1={tvY + tvPxH} x2={tvX} y2={tvY + tvPxH} stroke="#a83232" strokeWidth="1.5"/>);
        elements.push(<line key="reftick2" x1={tvX + tvPxW} y1={tvY + tvPxH} x2={tvX + tvPxW + 12} y2={tvY + tvPxH} stroke="#a83232" strokeWidth="1.5"/>);
      } else {
        elements.push(<line key="reftick" x1={tvX - 12} y1={tvCenterY} x2={tvX} y2={tvCenterY} stroke="#a83232" strokeWidth="1.5"/>);
        elements.push(<line key="reftick2" x1={tvX + tvPxW} y1={tvCenterY} x2={tvX + tvPxW + 12} y2={tvCenterY} stroke="#a83232" strokeWidth="1.5"/>);
      }

      const dimY = tvY - 18;
      elements.push(<line key="dw1" x1={tvX} y1={dimY} x2={tvX + tvPxW} y2={dimY} stroke="#2a2620" strokeWidth="1"/>);
      elements.push(<line key="dw1a" x1={tvX} y1={dimY - 4} x2={tvX} y2={dimY + 4} stroke="#2a2620" strokeWidth="1"/>);
      elements.push(<line key="dw1b" x1={tvX + tvPxW} y1={dimY - 4} x2={tvX + tvPxW} y2={dimY + 4} stroke="#2a2620" strokeWidth="1"/>);
      const dwMidX = tvX + tvPxW/2;
      elements.push(<rect key="dw1bg" x={dwMidX - 32} y={dimY - 18} width={64} height={16} fill="#faf8f3" stroke="none" rx="2"/>);
      elements.push(<text key="dw1t" x={dwMidX} y={dimY - 6} textAnchor="middle" fill="#2a2620" fontSize="13" fontWeight="600" fontFamily="var(--font-mono)">{tvW.toFixed(1)}" W</text>);

      // TV centerline: dash-dot drafting line above the TV plus a dimension
      // from the left wall edge so the installer can locate the mount laterally
      const clPx = wallX + layout.tvCL * scale;
      elements.push(<line key="cl-line" x1={clPx} y1={wallY + 2} x2={clPx} y2={tvY - 2} stroke="#a83232" strokeWidth="0.9" strokeDasharray="9 3 2 3" opacity="0.8"/>);
      const clDimY = wallY - 14;
      elements.push(<line key="cl-dim" x1={wallX} y1={clDimY} x2={clPx} y2={clDimY} stroke="#a83232" strokeWidth="1"/>);
      elements.push(<line key="cl-dima" x1={wallX} y1={clDimY - 4} x2={wallX} y2={clDimY + 4} stroke="#a83232" strokeWidth="1"/>);
      elements.push(<line key="cl-dimb" x1={clPx} y1={clDimY - 4} x2={clPx} y2={clDimY + 4} stroke="#a83232" strokeWidth="1"/>);
      const clMidX = (wallX + clPx) / 2;
      elements.push(<rect key="cl-dimbg" x={clMidX - 46} y={clDimY - 16} width={92} height={13} fill="#faf8f3" stroke="none" rx="2"/>);
      elements.push(<text key="cl-dimt" x={clMidX} y={clDimY - 6} textAnchor="middle" fill="#a83232" fontSize="10" fontWeight="600" fontFamily="var(--font-mono)" letterSpacing="0.5">{layout.tvCL.toFixed(1)}" TO TV CL</text>);
    }

    const wdY = floorY + 32;
    elements.push(<line key="ww" x1={wallX} y1={wdY} x2={wallX + wallPxW} y2={wdY} stroke="#2a2620" strokeWidth="1"/>);
    elements.push(<line key="wwa" x1={wallX} y1={wdY - 4} x2={wallX} y2={wdY + 4} stroke="#2a2620" strokeWidth="1"/>);
    elements.push(<line key="wwb" x1={wallX + wallPxW} y1={wdY - 4} x2={wallX + wallPxW} y2={wdY + 4} stroke="#2a2620" strokeWidth="1"/>);
    elements.push(<text key="wwt" x={wallX + wallPxW/2} y={wdY + 18} textAnchor="middle" fill="#2a2620" fontSize="13" fontWeight="600" fontFamily="var(--font-mono)">{safeWallW}" WALL WIDTH</text>);

    const whX = wallX + wallPxW + 32;
    elements.push(<line key="wh" x1={whX} y1={wallY} x2={whX} y2={floorY} stroke="#2a2620" strokeWidth="1"/>);
    elements.push(<line key="wha" x1={whX - 4} y1={wallY} x2={whX + 4} y2={wallY} stroke="#2a2620" strokeWidth="1"/>);
    elements.push(<line key="whb" x1={whX - 4} y1={floorY} x2={whX + 4} y2={floorY} stroke="#2a2620" strokeWidth="1"/>);
    elements.push(<text key="wht" x={whX + 8} y={(wallY + floorY)/2 + 4} fill="#2a2620" fontSize="13" fontWeight="600" fontFamily="var(--font-mono)">{safeWallH}" H</text>);

    // Title block so exported drawings identify the job on their own
    if (projectName || clientName) {
      const tbText = [projectName, clientName].filter(Boolean).join("  •  ");
      const tbDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      elements.push(<text key="tb" x={20} y={svgH - 10} textAnchor="start" fill="#8a7d5e" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1">{tbText.toUpperCase()}  •  {tbDate}</text>);
    }

    return { elements, svgW, svgH };
  }, [wallW, wallH, hasFireplace, fbOpeningH, fbOpeningW, fbOffsetIn, hasMantel, mantelH, mantelDepth, selectedSize, layout, centerH, tvBottomH, heightRef, showOutlet, showLowVolt, showVesa, vesaSpec, mountType, projectName, clientName, viewportW, isMobile, isTablet]);

  const exportName = (ext) => {
    const base = (projectName.trim() || "tv-layout").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "tv-layout";
    return `${base}-${selectedSize ? selectedSize + "in" : "wall"}.${ext}`;
  };

  const exportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportName("svg");
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = schematic.svgW * 2;
      canvas.height = schematic.svgH * 2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#faf8f3";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
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
    if (!svgRef.current || !selectedSize) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const tvDim = tvDims(selectedSize);
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    
    const sideTxt = (x) => {
      const d = x - layout.tvCL;
      if (Math.abs(d) < 0.05) return 'on TV centerline';
      return `${Math.abs(d).toFixed(1)}" ${d < 0 ? 'left' : 'right'} of TV centerline`;
    };
    const specRows = [
      ['TV', `${brand} ${selectedSize}"`],
      ['TV Width', `${tvDim.w.toFixed(1)}"`],
      ['TV Height', `${tvDim.h.toFixed(1)}"`],
      ['Center to floor', `${centerH.toFixed(1)}"`],
      ['Bottom to floor', `${tvBottomH.toFixed(1)}"`],
      ['TV centerline', `${layout.tvCL.toFixed(1)}" from left wall edge`],
      ['Mount type', mountType === "flat" ? "Flat" : "Articulating"],
    ];
    if (showBackBox) {
      const bb = BACK_BOXES[effectiveBoxModel];
      specRows.push(['Back box', `${bb.brand} ${bb.label}`]);
      specRows.push(['Box dimensions', `${bb.w}" x ${bb.h}" x ${bb.d}"D`]);
    }
    if (showOutlet) specRows.push(['Power outlet', `${layout.outlet.aff.toFixed(1)}" AFF, ${sideTxt(layout.outlet.x)}`]);
    if (showLowVolt) specRows.push(['Low-voltage feed', `${layout.lv.aff.toFixed(1)}" AFF, ${sideTxt(layout.lv.x)}`]);
    if (vesaSpec) {
      specRows.push(['VESA pattern', `${vesaSpec.w_mm} x ${vesaSpec.h_mm} mm`]);
      specRows.push(['VESA screw', vesaSpec.screw]);
    }
    specRows.push(['Wall dimensions', `${wallW}" W x ${wallH}" H`]);
    if (hasFireplace) {
      specRows.push(['Fireplace opening', `${fbOpeningW}" W x ${fbOpeningH}" H`]);
      if (hasMantel) specRows.push(['Mantel top', `${mantelH}" from floor`]);
    }

    const docTitle = projectName.trim() ? `${projectName.trim()} - ${brand} ${selectedSize}"` : `TV Wall Layout - ${brand} ${selectedSize}"`;
    const metaHtml = 'Front Elevation' + (clientName.trim() ? '<br/>' + clientName.trim() : '') + '<br/>' + today;
    const specRowsHtml = specRows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const vesaNote = vesaSpec && vesaSpec.note ? `<p style="margin: 8px 0 0 0;"><strong>${brand} ${selectedSize}":</strong> ${vesaSpec.note}</p>` : '';
    const bbNote = showBackBox && BACK_BOXES[effectiveBoxModel].note ? `<p style="margin: 8px 0 0 0;"><strong>Back box:</strong> ${BACK_BOXES[effectiveBoxModel].note}</p>` : '';

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>' + docTitle + '</title><style>@page { size: letter; margin: 0.5in; } body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; color: #2a2620; margin: 0; padding: 24px; background: white; } .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2a2620; padding-bottom: 12px; margin-bottom: 24px; } .header h1 { margin: 0; font-size: 22px; letter-spacing: -0.3px; } .header .meta { font-size: 10px; letter-spacing: 2px; color: #8a7d5e; text-transform: uppercase; text-align: right; } .schematic-wrap { text-align: center; margin-bottom: 24px; padding: 16px; background: #faf8f3; border: 1px solid #d4cdb8; } .schematic-wrap svg { max-width: 100%; height: auto; } .section-label { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #2a2620; font-weight: 700; padding-bottom: 6px; border-bottom: 1px solid #d4cdb8; margin-bottom: 12px; } .spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; } .spec-table { width: 100%; border-collapse: collapse; } .spec-table td { padding: 8px 4px; border-bottom: 1px solid #eae5d4; font-size: 12px; font-family: Courier New, monospace; } .spec-table td:first-child { color: #6b6354; } .spec-table td:last-child { text-align: right; font-weight: 600; color: #2a2620; } .notes-box { background: #fdf6e3; border: 1px solid #d4a84a; padding: 12px; font-size: 11px; line-height: 1.5; } .notes-box h3 { margin: 0 0 8px 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #8a6a1a; } .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #d4cdb8; font-size: 9px; color: #8a7d5e; letter-spacing: 1px; text-transform: uppercase; display: flex; justify-content: space-between; } @media print { body { padding: 0; } .no-print { display: none; } } .print-btn { position: fixed; top: 12px; right: 12px; padding: 12px 20px; background: #2a2620; color: white; border: none; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; font-weight: 600; }</style></head><body><button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button><div class="header"><div><div style="font-size: 9px; letter-spacing: 3px; color: #8a7d5e; text-transform: uppercase; margin-bottom: 4px;">AV DESIGN INSTRUMENT</div><h1>' + docTitle + '</h1></div><div class="meta">' + metaHtml + '</div></div><div class="schematic-wrap">' + svgData + '</div><div class="spec-grid"><div><div class="section-label">Specifications</div><table class="spec-table">' + specRowsHtml + '</table></div><div><div class="section-label">Installation Notes</div><div class="notes-box"><h3>Field verification</h3><p style="margin: 0 0 8px 0;">Always verify TV actual VESA pattern and dimensions against the manufacturer spec sheet before drilling. Measurements shown are calculated from published specifications and may vary by model variant.</p>' + vesaNote + bbNote + '</div></div></div><div class="footer"><span>Generated ' + today + '</span><span>TV Wall Layout Planner</span></div><script>window.addEventListener("load", function() { setTimeout(function() { window.print(); }, 500); });</script></body></html>';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      alert('Please allow pop-ups to export PDF');
    }
  };

  // Install panel content shared between desktop sidebar and tablet inline placement
  const installPanel = (
    <>
      <div className="section-title"><Icon name="mount"/> Mount Type</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button className={`pill ${mountType === "flat" ? "active" : ""}`} onClick={() => setMountType("flat")} style={{flex: 1}}>Flat</button>
        <button className={`pill ${mountType === "articulating" ? "active" : ""}`} onClick={() => setMountType("articulating")} style={{flex: 1}}>Articulating</button>
      </div>
      <div style={{fontSize: 11, color: "#6b6354", lineHeight: 1.5, marginBottom: 20, fontStyle: "italic"}}>
        {mountType === "flat" 
          ? "Low-profile, tight to wall. Best for straight-on viewing." 
          : "Full-motion. Pulls out and swivels. Recommended for fireplace installs (tilt down) or off-axis seating."}
      </div>

      <div className="section-title"><Icon name="tv"/> VESA Pattern</div>
      <div className="checkbox-row" onClick={() => setShowVesa(!showVesa)}>
        <div className={`check-box ${showVesa ? "checked" : ""}`}>
          {showVesa && <Icon name="check" size={12}/>}
        </div>
        <span>Show VESA on schematic</span>
      </div>
      {showVesa && selectedSize && vesaSpec && (
        <div style={{
          marginTop: 10, padding: "10px 12px",
          background: "#fdf6e3",
          border: "1px solid #d4a84a",
          fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6,
          color: "#5c4a1a"
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 2, color: "#8a6a1a", marginBottom: 4 }}>
            {brand.toUpperCase()} {selectedSize}" - 2024/25
          </div>
          <div style={{fontWeight: 500, fontSize: 13, color: "#2a2620"}}>
            {vesaSpec.w_mm} x {vesaSpec.h_mm} mm
          </div>
          <div style={{ fontSize: 10, marginTop: 2 }}>
            {(vesaSpec.w_mm / 25.4).toFixed(2)}" x {(vesaSpec.h_mm / 25.4).toFixed(2)}" - Screw: {vesaSpec.screw}
          </div>
          {vesaSpec.voffset_pct !== 0 && (
            <div style={{ fontSize: 10, marginTop: 4, color: "#8a6a1a" }}>
              Pattern offset {Math.abs(vesaSpec.voffset_pct)}% {vesaSpec.voffset_pct < 0 ? "below" : "above"} TV center
            </div>
          )}
          {vesaSpec.note && (
            <div style={{ fontSize: 10, marginTop: 4, fontStyle: "italic", color: "#6a5a2a" }}>
              Note: {vesaSpec.note}
            </div>
          )}
          <div style={{ fontSize: 9, marginTop: 6, paddingTop: 6, borderTop: "1px dashed #d4a84a", color: "#8a6a1a" }}>
            Always verify with TV's spec sheet before drilling
          </div>
        </div>
      )}
      {showVesa && selectedSize && !vesaSpec && (
        <div style={{marginTop: 10, fontSize: 11, color: "#8a7d5e", fontStyle: "italic"}}>
          VESA data not available for this configuration - refer to manufacturer spec sheet.
        </div>
      )}

      <div className="section-title" style={{marginTop: 24}}><Icon name="bolt"/> Mount Height</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button className={`pill ${heightRef === "center" ? "active" : ""}`} onClick={() => {
          if (heightRef === "center") return;
          setHeightRef("center");
          // Convert the override so the TV stays put: center = bottom + tvH/2
          setMountHeightOverride(prev => {
            const v = parseFloat(prev);
            if (isNaN(v) || !selectedSize) return "";
            return (v + tvDims(selectedSize).h / 2).toFixed(1);
          });
        }} style={{flex: 1}}>From Center</button>
        <button className={`pill ${heightRef === "bottom" ? "active" : ""}`} onClick={() => {
          if (heightRef === "bottom") return;
          setHeightRef("bottom");
          setMountHeightOverride(prev => {
            const v = parseFloat(prev);
            if (isNaN(v) || !selectedSize) return "";
            return (v - tvDims(selectedSize).h / 2).toFixed(1);
          });
        }} style={{flex: 1}}>From Bottom</button>
      </div>
      <div className="stat-line">
        <span>Recommended {heightRef === "bottom" ? "bottom" : "center"}</span>
        <strong>{recommendedDisplayH.toFixed(1)}"</strong>
      </div>
      {selectedSize && (
        <div className="stat-line" style={{opacity: 0.6}}>
          <span>{heightRef === "bottom" ? "Center equivalent" : "Bottom equivalent"}</span>
          <strong>{heightRef === "bottom" ? recommendedCenterH.toFixed(1) : (recommendedCenterH - tvDims(selectedSize).h/2).toFixed(1)}"</strong>
        </div>
      )}
      <div style={{marginTop: 10}}>
        <div className="label" style={{marginBottom: 4}}>Override - to {heightRef} (in)</div>
        <input className="input" type="number" placeholder={`${recommendedDisplayH.toFixed(1)}`} value={mountHeightOverride} onChange={e => setMountHeightOverride(e.target.value)}/>
      </div>
      <div style={{marginTop: 10}}>
        <div className="label" style={{marginBottom: 4}}>Horizontal offset from {hasFireplace ? "fireplace" : "wall"} center (in)</div>
        <input className="input" type="number" placeholder="0 = centered" value={tvOffsetX} onChange={e => setTvOffsetX(e.target.value)}/>
        <div style={{fontSize: 10, color: "#8a7d5e", marginTop: 4, fontFamily: "var(--font-mono)"}}>
          + right / − left{selectedSize && layout ? ` — TV CL at ${layout.tvCL.toFixed(1)}" from left` : ""}
        </div>
      </div>
      {placementIssues.length > 0 && (
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: "#fce8e3", border: "1px solid #d4504a",
          color: "#7a2a1a",
          fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 2, color: "#a83232", marginBottom: 3, fontWeight: 600 }}>
            PLACEMENT OUT OF RANGE
          </div>
          {placementIssues.map((iss, i) => <div key={i}>• {iss}</div>)}
        </div>
      )}

      <div className="section-title" style={{marginTop: 24}}><Icon name="box"/> Back Box</div>
      <div className="checkbox-row" onClick={() => setShowBackBox(!showBackBox)}>
        <div className={`check-box ${showBackBox ? "checked" : ""}`}>
          {showBackBox && <Icon name="check" size={12}/>}
        </div>
        <span>Include back box</span>
      </div>
      {showBackBox && (
        <>
          <div className="checkbox-row" onClick={() => setAutoRecommendBox(!autoRecommendBox)}>
            <div className={`check-box ${autoRecommendBox ? "checked" : ""}`}>
              {autoRecommendBox && <Icon name="check" size={12}/>}
            </div>
            <span>Auto-recommend for TV size</span>
          </div>
          {selectedSize && recommendedBox && (
            <div style={{
              marginTop: 8, padding: "8px 10px",
              background: autoRecommendBox ? "#2a2620" : "#eae5d4",
              color: autoRecommendBox ? "#faf8f3" : "#2a2620",
              fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5,
              border: "1px solid #2a2620"
            }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 2, opacity: 0.7, marginBottom: 3 }}>RECOMMENDED</div>
              <div style={{fontWeight: 500}}>{BACK_BOXES[recommendedBox].brand}</div>
              <div>{BACK_BOXES[recommendedBox].label}</div>
              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 3 }}>
                {BACK_BOXES[recommendedBox].w}" x {BACK_BOXES[recommendedBox].h}" x {BACK_BOXES[recommendedBox].d}"D - {BACK_BOXES[recommendedBox].bracket}
              </div>
              {BACK_BOXES[recommendedBox].note && (
                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3, fontStyle: "italic" }}>{BACK_BOXES[recommendedBox].note}</div>
              )}
            </div>
          )}
          {!autoRecommendBox && (
            <>
              <div className="label" style={{marginTop: 10, marginBottom: 4}}>Manual selection</div>
              <select className="input" value={backBoxModel} onChange={e => setBackBoxModel(e.target.value)}>
                <optgroup label="Future Automation - WB Range">
                  {Object.entries(BACK_BOXES).filter(([k,v]) => v.brand === "Future Automation").map(([k, v]) => (
                    <option key={k} value={k}>{v.label} ({v.bracket})</option>
                  ))}
                </optgroup>
                <optgroup label="SnapAV Strong - VersaBox">
                  {Object.entries(BACK_BOXES).filter(([k,v]) => v.brand === "SnapAV Strong").map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </optgroup>
              </select>
            </>
          )}
          {layout?.box?.underRated && (
            <div style={{
              marginTop: 8, padding: "8px 10px",
              background: "#fdf6e3", border: "1px solid #d4a84a",
              color: "#6a5a1a",
              fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.5
            }}>
              <strong style={{color: "#8a6a1a"}}>Check rating:</strong> {layout.box.label} is rated for {layout.box.tvMin}"–{layout.box.tvMax}" TVs — selected {selectedSize}". Verify bracket compatibility with the manufacturer.
            </div>
          )}
        </>
      )}

      <div className="section-title" style={{marginTop: 24}}><Icon name="plug"/> Electrical</div>
      <div className="checkbox-row" onClick={() => setShowOutlet(!showOutlet)}>
        <div className={`check-box ${showOutlet ? "checked" : ""}`}>
          {showOutlet && <Icon name="check" size={12}/>}
        </div>
        <span>Show recessed outlet</span>
      </div>
      <div className="checkbox-row" onClick={() => setShowLowVolt(!showLowVolt)}>
        <div className={`check-box ${showLowVolt ? "checked" : ""}`}>
          {showLowVolt && <Icon name="check" size={12}/>}
        </div>
        <span>Show low-voltage feed</span>
      </div>

      {selectedSize && (
        <div style={{ marginTop: 28, padding: 14, background: "#2a2620", color: "#faf8f3" }}>
          <div className="meta-text" style={{color: "#a89c7a", marginBottom: 10}}>SPEC SUMMARY</div>
          <div className="stat-line" style={{color: "#d4cdb8"}}>
            <span>TV</span><strong style={{color: "#faf8f3"}}>{brand} {selectedSize}"</strong>
          </div>
          <div className="stat-line" style={{color: "#d4cdb8"}}>
            <span>TV Width</span><strong style={{color: "#faf8f3"}}>{tvDims(selectedSize).w.toFixed(1)}"</strong>
          </div>
          <div className="stat-line" style={{color: "#d4cdb8"}}>
            <span>TV Height</span><strong style={{color: "#faf8f3"}}>{tvDims(selectedSize).h.toFixed(1)}"</strong>
          </div>
          <div className="stat-line" style={{color: "#d4cdb8"}}>
            <span>Center to floor</span><strong style={{color: "#faf8f3"}}>{centerH.toFixed(1)}"</strong>
          </div>
          <div className="stat-line" style={{color: "#d4cdb8"}}>
            <span>Bottom to floor</span><strong style={{color: "#faf8f3"}}>{tvBottomH.toFixed(1)}"</strong>
          </div>
          {layout && (
            <div className="stat-line" style={{color: "#d4cdb8"}}>
              <span>TV CL from left</span><strong style={{color: "#faf8f3"}}>{layout.tvCL.toFixed(1)}"</strong>
            </div>
          )}
          <div className="stat-line" style={{color: "#d4cdb8"}}>
            <span>Mount</span><strong style={{color: "#faf8f3"}}>{mountType === "flat" ? "Flat" : "Articulating"}</strong>
          </div>
          {showBackBox && (
            <div className="stat-line" style={{color: "#d4cdb8"}}>
              <span>Back box</span><strong style={{color: "#faf8f3", fontSize: 10}}>{BACK_BOXES[effectiveBoxModel].label}</strong>
            </div>
          )}
          {vesaSpec && (
            <div className="stat-line" style={{color: "#d4cdb8"}}>
              <span>VESA</span><strong style={{color: "#faf8f3"}}>{vesaSpec.w_mm}x{vesaSpec.h_mm} {vesaSpec.screw}</strong>
            </div>
          )}
          {layout && showOutlet && (
            <div className="stat-line" style={{color: "#d4cdb8"}}>
              <span>Outlet</span><strong style={{color: "#faf8f3"}}>{layout.outlet.aff.toFixed(1)}" AFF</strong>
            </div>
          )}
          {layout && showLowVolt && (
            <div className="stat-line" style={{color: "#d4cdb8"}}>
              <span>LV feed</span><strong style={{color: "#faf8f3"}}>{layout.lv.aff.toFixed(1)}" AFF</strong>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f3", color: "#2a2620", fontFamily: "var(--font-body)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        :root {
          --font-display: 'Unbounded', sans-serif;
          --font-body: 'Inter', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; }
        .label { font-family: var(--font-display); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #6b6354; font-weight: 500; }
        .section-title { font-family: var(--font-display); font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #2a2620; font-weight: 600; padding-bottom: 8px; border-bottom: 1px solid #d4cdb8; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .input { width: 100%; padding: 10px 12px; border: 1px solid #c4bda8; background: #faf8f3; font-family: var(--font-mono); font-size: 16px; color: #2a2620; outline: none; transition: border-color 0.15s; -webkit-appearance: none; appearance: none; border-radius: 0; min-height: 44px; }
        .input:focus { border-color: #2a2620; }
        select.input { background-image: linear-gradient(45deg, transparent 50%, #2a2620 50%), linear-gradient(135deg, #2a2620 50%, transparent 50%); background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; padding-right: 28px; }
        .checkbox-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; cursor: pointer; font-size: 14px; min-height: 44px; user-select: none; -webkit-user-select: none; }
        .check-box { width: 20px; height: 20px; border: 1.4px solid #2a2620; background: #faf8f3; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .check-box.checked { background: #2a2620; color: #faf8f3; }
        .pill { padding: 10px 16px; border: 1px solid #2a2620; background: transparent; font-family: var(--font-mono); font-size: 11px; letter-spacing: 1px; cursor: pointer; transition: all 0.15s; text-transform: uppercase; min-height: 40px; border-radius: 0; color: #2a2620; }
        .pill.active { background: #2a2620; color: #faf8f3; }
        .pill:hover:not(.active) { background: #eae5d4; }
        .size-card { padding: 14px 8px; border: 1px solid #c4bda8; background: #faf8f3; cursor: pointer; transition: all 0.15s; text-align: center; font-family: var(--font-display); font-weight: 500; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
        .size-card:hover { border-color: #2a2620; }
        .size-card.active { background: #2a2620; color: #faf8f3; border-color: #2a2620; }
        .size-card.not-recommended { background: #faf6f0; border-style: dashed; border-color: #c8b8a0; color: #8a7d5e; }
        .size-card.not-recommended:hover { border-color: #a83232; background: #fcefea; }
        .size-card.not-recommended.active { background: #7a2a1a; border-style: solid; border-color: #7a2a1a; color: #faf8f3; }
        .size-card .size-num { font-size: 22px; line-height: 1; }
        .size-card .size-unit { font-size: 9px; letter-spacing: 2px; opacity: 0.7; margin-top: 4px; }
        .panel { background: #ffffff; border: 1px solid #d4cdb8; padding: 18px; }
        .btn-export { padding: 12px 20px; border: 1px solid #2a2620; background: #2a2620; color: #faf8f3; font-family: var(--font-display); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-weight: 500; min-height: 44px; }
        .btn-export:hover { background: #1a1612; }
        .btn-export:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-export.secondary { background: transparent; color: #2a2620; }
        .btn-export.secondary:hover:not(:disabled) { background: #eae5d4; }
        .stat-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; font-family: var(--font-mono); color: #6b6354; gap: 8px; }
        .stat-line strong { color: #2a2620; font-weight: 500; text-align: right; word-break: break-word; }
        .meta-text { font-family: var(--font-display); letter-spacing: 4px; font-size: 10px; text-transform: uppercase; color: #8a7d5e; }
        .tab-btn { flex: 1; padding: 14px 8px; border: none; background: transparent; border-bottom: 2px solid transparent; font-family: var(--font-display); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; color: #8a7d5e; font-weight: 500; }
        .tab-btn.active { color: #2a2620; border-bottom-color: #2a2620; }
        .svg-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .svg-wrap svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
        input[type="number"] { -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <header style={{ borderBottom: "1px solid #d4cdb8", padding: isMobile ? "14px 16px" : "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="meta-text" style={{ marginBottom: 4, fontSize: isMobile ? 8 : 10 }}>AV DESIGN INSTRUMENT</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 18 : 26, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>
            TV Wall Layout Planner
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="meta-text" style={{ fontSize: isMobile ? 8 : 10 }}>{isMobile ? "REV.01" : "REV.01 / FRONT ELEVATION"}</div>
          <button
            className="pill"
            style={{ minHeight: 30, padding: "6px 12px", fontSize: 9 }}
            onClick={resetAll}
            title="Clear saved design and start over"
          >Reset</button>
        </div>
      </header>

      {isMobile && (
        <div style={{ display: "flex", borderBottom: "1px solid #d4cdb8", background: "#fdfbf6", position: "sticky", top: 0, zIndex: 10 }}>
          <button className={`tab-btn ${activePanel === "inputs" ? "active" : ""}`} onClick={() => setActivePanel("inputs")}>Wall</button>
          <button className={`tab-btn ${activePanel === "schematic" ? "active" : ""}`} onClick={() => setActivePanel("schematic")}>Plan</button>
          <button className={`tab-btn ${activePanel === "install" ? "active" : ""}`} onClick={() => setActivePanel("install")}>Install</button>
        </div>
      )}

      {/* Pinned mini-preview on iPhone when NOT on the Plan tab — lets you see schematic update as you change options */}
      {isMobile && selectedSize && activePanel !== "schematic" && (
        <div 
          onClick={() => setActivePanel("schematic")}
          style={{ 
            position: "sticky", 
            top: 48,
            zIndex: 9, 
            background: "#faf8f3", 
            borderBottom: "1px solid #d4cdb8",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
          }}
        >
          <div style={{ 
            flex: "0 0 auto",
            width: 96, 
            height: 72, 
            background: "#fdfbf6", 
            border: "1px solid #d4cdb8",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <svg 
              width="100%" 
              height="100%" 
              viewBox={`0 0 ${schematic.svgW} ${schematic.svgH}`} 
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="100%" height="100%" fill="#faf8f3"/>
              {schematic.elements}
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="meta-text" style={{ fontSize: 8, marginBottom: 2 }}>LIVE PREVIEW</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "#2a2620", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {brand} {selectedSize}"
            </div>
            <div style={{ fontSize: 10, color: "#6b6354", fontFamily: "var(--font-mono)" }}>
              {heightRef === "bottom" ? tvBottomH.toFixed(1) : centerH.toFixed(1)}" to {heightRef}
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#8a7d5e", letterSpacing: 1, textTransform: "uppercase", flexShrink: 0 }}>
            Tap →
          </div>
        </div>
      )}

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: isMobile ? "1fr" : (isTablet ? "300px 1fr" : "320px 1fr 290px"), 
        gap: 0, 
        minHeight: isMobile ? "auto" : "calc(100vh - 80px)" 
      }}>
        
        <aside style={{ 
          borderRight: isMobile ? "none" : "1px solid #d4cdb8", 
          padding: isMobile ? 16 : (isTablet ? 20 : 24), 
          overflowY: "auto",
          display: isMobile && activePanel !== "inputs" ? "none" : "block"
        }}>
          
          <div className="section-title"><Icon name="arrow"/> Project</div>
          <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
            <div>
              <div className="label" style={{marginBottom: 6}}>Project / Address</div>
              <input className="input" type="text" placeholder="e.g. Smith Residence" value={projectName} onChange={e => setProjectName(e.target.value)}/>
            </div>
            <div>
              <div className="label" style={{marginBottom: 6}}>Client</div>
              <input className="input" type="text" placeholder="optional" value={clientName} onChange={e => setClientName(e.target.value)}/>
            </div>
          </div>

          <div className="section-title"><Icon name="wall"/> Wall Dimensions</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div>
              <div className="label" style={{marginBottom: 6}}>Width (in)</div>
              <input className="input" type="number" value={wallW} onChange={e => setWallW(+e.target.value || 0)}/>
            </div>
            <div>
              <div className="label" style={{marginBottom: 6}}>Height (in)</div>
              <input className="input" type="number" value={wallH} onChange={e => setWallH(+e.target.value || 0)}/>
            </div>
          </div>

          <div className="section-title"><Icon name="fire"/> Fireplace</div>
          <div className="checkbox-row" onClick={() => setHasFireplace(!hasFireplace)}>
            <div className={`check-box ${hasFireplace ? "checked" : ""}`}>
              {hasFireplace && <Icon name="check" size={12}/>}
            </div>
            <span>Wall has fireplace</span>
          </div>
          {hasFireplace && (
            <div style={{ paddingLeft: 24, marginTop: 8, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div className="label" style={{marginBottom: 4}}>Opening W</div>
                  <input className="input" type="number" value={fbOpeningW} onChange={e => setFbOpeningW(+e.target.value || 0)}/>
                </div>
                <div>
                  <div className="label" style={{marginBottom: 4}}>Opening H</div>
                  <input className="input" type="number" value={fbOpeningH} onChange={e => setFbOpeningH(+e.target.value || 0)}/>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div className="label" style={{marginBottom: 4}}>Offset from wall center (in)</div>
                <input className="input" type="number" placeholder="0 = centered" value={fbOffsetX} onChange={e => setFbOffsetX(e.target.value)}/>
                <div style={{fontSize: 10, color: "#8a7d5e", marginTop: 4, fontFamily: "var(--font-mono)"}}>
                  + right / − left — TV follows fireplace center
                </div>
              </div>
              <div className="checkbox-row" onClick={() => setHasMantel(!hasMantel)}>
                <div className={`check-box ${hasMantel ? "checked" : ""}`}>
                  {hasMantel && <Icon name="check" size={12}/>}
                </div>
                <span>Has mantel</span>
              </div>
              {hasMantel && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <div>
                    <div className="label" style={{marginBottom: 4}}>Mantel top H</div>
                    <input className="input" type="number" value={mantelH} onChange={e => setMantelH(+e.target.value || 0)}/>
                  </div>
                  <div>
                    <div className="label" style={{marginBottom: 4}}>Thickness</div>
                    <input className="input" type="number" value={mantelDepth} onChange={e => setMantelDepth(+e.target.value || 0)}/>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="section-title" style={{marginTop: 20}}><Icon name="eye"/> Viewing</div>
          <div className="checkbox-row" onClick={() => setUseViewDist(!useViewDist)}>
            <div className={`check-box ${useViewDist ? "checked" : ""}`}>
              {useViewDist && <Icon name="check" size={12}/>}
            </div>
            <span>Factor viewing distance</span>
          </div>
          {useViewDist && (
            <div style={{ marginTop: 8 }}>
              <div className="label" style={{marginBottom: 4}}>Distance to seating (in)</div>
              <input className="input" type="number" value={viewDist} onChange={e => setViewDist(+e.target.value || 0)}/>
              <div style={{fontSize: 10, color: "#8a7d5e", marginTop: 4, fontFamily: "var(--font-mono)"}}>
                {(viewDist/12).toFixed(1)} ft - vibe check only
              </div>
            </div>
          )}

          <div className="section-title" style={{marginTop: 24}}><Icon name="tv"/> Brand</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Sony", "Samsung", "LG"].map(b => (
              <button key={b} className={`pill ${brand === b ? "active" : ""}`} onClick={() => { setBrand(b); setSelectedSize(null); }}>{b}</button>
            ))}
          </div>
        </aside>

        <main style={{ 
          padding: isMobile ? 12 : (isTablet ? 20 : 24), 
          display: isMobile && activePanel !== "schematic" ? "none" : "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          gap: 16, 
          background: "#faf8f3",
          minWidth: 0
        }}>
          
          <div className="panel" style={{ width: "100%", maxWidth: 820 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div className="section-title" style={{margin: 0, borderBottom: "none", paddingBottom: 0}}>
                <Icon name="arrow"/> {showAllSizes ? `All ${brand} Sizes` : `Recommended - ${brand}`}
              </div>
              {selectedSize && (
                <div className="meta-text" style={{color: "#2a2620"}}>SELECTED: {selectedSize}"</div>
              )}
            </div>
            
            <div className="checkbox-row" onClick={() => setShowAllSizes(!showAllSizes)} style={{ paddingTop: 0, paddingBottom: 10, marginBottom: 4 }}>
              <div className={`check-box ${showAllSizes ? "checked" : ""}`}>
                {showAllSizes && <Icon name="check" size={12}/>}
              </div>
              <span style={{ fontSize: 12 }}>Show all sizes (including non-recommended)</span>
            </div>

            {(() => {
              const allSizes = TV_CATALOG[brand];
              const recommendedSet = new Set(recommendations);
              const displaySizes = showAllSizes ? allSizes : recommendations;
              
              if (displaySizes.length === 0) {
                return (
                  <div style={{fontSize: 13, color: "#8a7d5e", padding: "20px 0", textAlign: "center"}}>
                    No sizes fit these dimensions. Try adjusting wall measurements or enable "Show all sizes".
                  </div>
                );
              }
              
              // Determine why a size isn't recommended
              const whyNotRecommended = (sz) => {
                const { w, h } = tvDims(sz);
                const maxByWall = wallW * 0.65;
                const minByWall = wallW * 0.35;
                if (w > maxByWall) return "Too wide for wall";
                if (w < minByWall) return "Too small for wall";
                if (hasFireplace && hasMantel) {
                  const available = wallH - mantelH - CLEARANCE.mantel;
                  if (h > available) return "Too tall for mantel clearance";
                }
                if (hasFireplace && !hasMantel) {
                  const available = wallH - fbOpeningH - CLEARANCE.noMantel;
                  if (h > available) return "Too tall for firebox clearance";
                }
                return null;
              };
              
              const cols = showAllSizes ? Math.min(displaySizes.length, isMobile ? 4 : 6) : Math.min(displaySizes.length, 4);
              
              return (
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: `repeat(${cols}, 1fr)`, 
                  gap: 8 
                }}>
                  {displaySizes.map(sz => {
                    const isRecommended = recommendedSet.has(sz);
                    const reason = !isRecommended ? whyNotRecommended(sz) : null;
                    const isActive = selectedSize === sz;
                    return (
                      <div 
                        key={sz} 
                        className={`size-card ${isActive ? "active" : ""} ${!isRecommended ? "not-recommended" : ""}`} 
                        onClick={() => setSelectedSize(sz)}
                        title={reason || "Recommended fit"}
                      >
                        <div className="size-num">{sz}</div>
                        <div className="size-unit">INCH</div>
                        {!isRecommended && !isActive && (
                          <div style={{ 
                            fontSize: 7, 
                            color: "#a83232", 
                            marginTop: 4, 
                            letterSpacing: 1, 
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            textTransform: "uppercase"
                          }}>
                            CHECK FIT
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {selectedSize && !recommendations.includes(selectedSize) && (
              <div style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#fce8e3",
                border: "1px solid #d4504a",
                fontSize: 11,
                lineHeight: 1.5,
                color: "#7a2a1a",
                fontFamily: "var(--font-mono)"
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 2, color: "#a83232", marginBottom: 3, fontWeight: 600 }}>
                  NOT RECOMMENDED FIT
                </div>
                {(() => {
                  const { w, h } = tvDims(selectedSize);
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
                  return issues.length > 0 ? issues.map((iss, i) => <div key={i}>• {iss}</div>) : <div>Outside typical proportional guidelines for this wall.</div>;
                })()}
              </div>
            )}
          </div>

          <div className="panel svg-wrap" style={{ background: "#faf8f3", padding: isMobile ? 8 : 16, width: "100%", maxWidth: schematic.svgW + 32 }}>
            <svg ref={svgRef} width={schematic.svgW} height={schematic.svgH} viewBox={`0 0 ${schematic.svgW} ${schematic.svgH}`} xmlns="http://www.w3.org/2000/svg" style={{display: "block"}} preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8e3d8" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="#faf8f3"/>
              <rect width="100%" height="100%" fill="url(#grid)"/>
              <text x={schematic.svgW - 20} y={20} textAnchor="end" fontSize="9" fill="#8a7d5e" fontFamily="'JetBrains Mono', monospace" letterSpacing="2">FRONT ELEVATION</text>
              <text x={20} y={20} fontSize="9" fill="#8a7d5e" fontFamily="'JetBrains Mono', monospace" letterSpacing="2">{selectedSize ? `${brand.toUpperCase()} ${selectedSize}"` : "SELECT TV SIZE"}</text>
              {schematic.elements}
            </svg>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn-export" onClick={exportPNG} disabled={!selectedSize}>
              <Icon name="download" size={11}/> Export PNG
            </button>
            <button className="btn-export secondary" onClick={exportSVG} disabled={!selectedSize}>
              <Icon name="download" size={11}/> Export SVG
            </button>
            <button className="btn-export secondary" onClick={exportPDF} disabled={!selectedSize}>
              <Icon name="download" size={11}/> Export PDF
            </button>
          </div>

          {isTablet && (
            <div style={{ width: "100%", maxWidth: 820, background: "#fdfbf6", border: "1px solid #d4cdb8", padding: 20, marginTop: 8 }}>
              {installPanel}
            </div>
          )}
        </main>

        {!isTablet && (
          <aside style={{ 
            borderLeft: isMobile ? "none" : "1px solid #d4cdb8", 
            padding: isMobile ? 16 : 24, 
            overflowY: "auto", 
            background: "#fdfbf6",
            display: isMobile ? (activePanel === "install" ? "block" : "none") : "block"
          }}>
            {installPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
