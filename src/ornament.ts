// Decorative ASCII canvas ornament for the header's empty right side.

type ToneKey = "accent" | "amber" | "muted";
type Token = { t: string; tone: ToneKey; w: number };
type Rgb = [number, number, number];
type Palette = { accent: string; amber: string; muted: string; head: string };

const RAIN_SHARE = 0.9;
const RAIN_DENSITY = 0.88;
const ALPHA_STEPS = 8;
const TRAIL_MIN = 8;
const TRAIL_MAX = 17;
const SPEED_MIN = 4.5;
const SPEED_MAX = 12;

const VENUES = [
  "AAAI", "AAMAS", "ACL", "ACM MM", "ACM SIGGRAPH", "AISTATS",
  "ASPLOS", "BMVC", "COLT", "CONEXT", "CVPR", "DAC",
  "DCC", "EACL", "ECAI", "ECCV", "ECOOP", "EMNLP",
  "EUROSYS", "FAST", "GECCO", "HOTOS", "HPCA", "HPDC",
  "ICAPS", "ICCAD", "ICCV", "ICDAR", "ICDCS", "ICFP",
  "ICLR", "ICME", "ICML", "ICS", "IEEE VIS", "IEEE VR",
  "IEEE/ACM CGO", "IJCAI", "IMC", "INFOCOM", "INTERSPEECH", "IPDPS",
  "IPSN", "ISCA", "ISMAR", "ITC", "KR", "MICRO",
  "MIDDLEWARE", "MMSYS", "MOBICOM", "MOBIHOC", "MOBISYS", "MSWIM",
  "NAACL", "NEURIPS", "OOPSLA", "OSDI", "PLDI", "PODC",
  "POPL", "PPSN", "RTAS", "RTSS", "SC", "SENSYS",
  "SIGCOMM", "SIGMETRICS", "SIGOPS ATC", "SOSP", "UAI", "WACV",
  "MLSYS", "EMSOFT",
];

const FLAVOR = [
  "ARXIV", "CALL FOR PAPERS", "CAMERA-READY", "REBUTTAL", "SUPPLEMENTARY",
  "OVERLEAF", "DOUBLE-BLIND", "MAJOR REVISION", "MINOR REVISION", "AUTHOR RESPONSE",
  "META-REVIEW", "AREA CHAIR", "PROGRAM COMMITTEE", "CONFLICT OF INTEREST",
  "PAGE LIMIT", "APPENDIX", "ANONYMIZED", "OPENREVIEW", "ARTIFACT EVALUATION",
  "ETHICS STATEMENT", "BROADER IMPACT", "REPRODUCIBILITY", "BIBTEX",
  "PROCEEDINGS", "SPOTLIGHT", "ORAL", "POSTER", "SHEPHERDING",
  "WEAK ACCEPT", "WEAK REJECT", "STRONG ACCEPT", "STRONG REJECT", "BORDERLINE",
  "DESK REJECT", "REVIEWER #2", "CONFIDENCE: 5", "LACKS NOVELTY", "INCREMENTAL",
  "OUT OF SCOPE", "CITE MY WORK", "NOT MY AREA", "SEE RELATED WORK",
  "HAVE YOU TRIED...", "MISSING BASELINE",
  "SOTA", "SOTA?", "NOVELTY?", "ABLATION", "p < 0.05", "BEATS BASELINE",
  "SCALING LAWS", "EMERGENT ABILITIES", "CHERRY-PICKED", "NEGATIVE RESULT",
  "FUTURE WORK", "LIMITATIONS", "DUE TO SPACE", "HYPERPARAMETERS",
  "DEADLINE", "AOE 23:59", "EXTENDED DEADLINE", "FINAL CALL",
  "ABSTRACT DEADLINE", "T-MINUS 3 DAYS",
];

const DUE = new Set([
  "DEADLINE", "AOE 23:59", "EXTENDED DEADLINE", "FINAL CALL", "ABSTRACT DEADLINE",
  "T-MINUS 3 DAYS", "CALL FOR PAPERS", "CAMERA-READY",
]);

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rgb = (c: Rgb) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function parseRgb(value: string): Rgb {
  const nums = value.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return [128, 128, 128];
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const accent = parseRgb(cs.getPropertyValue("--accent"));
  const muted = parseRgb(cs.getPropertyValue("--muted"));
  const amber = parseRgb(cs.getPropertyValue("--favorite"));
  const ink = parseRgb(cs.getPropertyValue("--ink"));
  return {
    accent: rgb(accent),
    muted: rgb(muted),
    amber: rgb(amber),
    head: rgb(mix(accent, ink, 0.45)),
  };
}

function buildPool(share: number): Token[] {
  const venue: Token[] = VENUES.map((t) => ({ t, tone: "accent", w: 0 }));
  const other: Token[] = FLAVOR.map((t) => ({ t, tone: DUE.has(t) ? "amber" : "muted", w: 0 }));
  const rep = Math.max(1, Math.round((other.length * share) / (1 - share) / venue.length));
  const pool: Token[] = [];
  for (let i = 0; i < rep; i++) pool.push(...venue.map((e) => ({ ...e })));
  pool.push(...other);
  return pool;
}

export type OrnamentHandle = {
  refreshColors: () => void;
  relayout: () => void;
  destroy: () => void;
};

export function mountOrnament(
  canvas: HTMLCanvasElement,
  options: {
    pauseButton?: HTMLButtonElement;
    paused?: boolean;
    onPausedChange?: (paused: boolean) => void;
  } = {},
): OrnamentHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { refreshColors() {}, relayout() {}, destroy() {} };
  const context = ctx;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pauseButton = options.pauseButton ?? null;
  let paused = Boolean(options.paused);
  let palette = readPalette();

  const RAIN_POOL = buildPool(RAIN_SHARE);
  const SOURCE: string[] = [];
  const TONES: (ToneKey | null)[] = [];
  for (const e of shuffled(RAIN_POOL).concat(shuffled(RAIN_POOL))) {
    for (const ch of e.t) {
      SOURCE.push(ch);
      TONES.push(e.tone);
    }
    SOURCE.push(" ", " ", " ");
    TONES.push(null, null, null);
  }
  const FONT_PX = 16;
  const FONT = `${FONT_PX}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const CHAR_H = Math.round(FONT_PX * 1.16);
  const FRAME_RATE = Math.ceil(Math.max(SPEED_MAX, (ALPHA_STEPS * SPEED_MAX) / TRAIL_MIN));
  const FRAME_MS = 1000 / FRAME_RATE;

  let cssW = 0;
  let cssH = 0;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let timer = 0;
  let last = 0;
  const glyphCache = new Map<string, HTMLCanvasElement>();

  function clearGlyphCache() {
    glyphCache.clear();
  }

  type Col = { start: number; trail: number; speed: number; head: number };
  let charW = 0;
  let cols = 0;
  let rows = 0;
  let columns: (Col | null)[] = [];
  let rowEdges: number[] = [];

  function glyphSprite(ch: string, tone: ToneKey | "head", alpha: number): HTMLCanvasElement {
    const bucket = Math.max(1, Math.min(ALPHA_STEPS, Math.round(alpha * ALPHA_STEPS)));
    const key = `${ch}|${tone}|${bucket}|${dpr}|${charW.toFixed(2)}`;
    const cached = glyphCache.get(key);
    if (cached) return cached;

    const sprite = document.createElement("canvas");
    sprite.width = Math.max(1, Math.ceil(charW * dpr));
    sprite.height = Math.max(1, Math.ceil(CHAR_H * dpr));
    const sctx = sprite.getContext("2d");
    if (sctx) {
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.font = FONT;
      sctx.textBaseline = "top";
      sctx.globalAlpha = bucket / ALPHA_STEPS;
      sctx.fillStyle = tone === "head" ? palette.head : palette[tone];
      sctx.fillText(ch, 0, 0);
    }
    glyphCache.set(key, sprite);
    return sprite;
  }

  function makeColumn(startBelow: boolean): Col {
    return {
      start: (Math.random() * (SOURCE.length - rows - 5)) | 0,
      trail: rand(TRAIL_MIN, TRAIL_MAX),
      speed: rand(SPEED_MIN, SPEED_MAX),
      head: startBelow ? rand(-rows * 1.4, -2) : rand(-rows, rows),
    };
  }

  function layoutRain() {
    context.textBaseline = "top";
    charW = context.measureText("M").width;
    cols = Math.ceil(cssW / charW) + 1;
    rows = Math.ceil(cssH / CHAR_H) + 1;
    const fade = Math.max(1, rows * 0.16);
    rowEdges = Array.from(
      { length: rows },
      (_, rIdx) => smoothstep(0, fade, rIdx) * smoothstep(0, fade * 1.3, rows - rIdx),
    );
    columns = [];
    for (let c = 0; c < cols; c++) {
      columns.push(Math.random() < RAIN_DENSITY ? makeColumn(false) : null);
    }
  }

  function drawRain() {
    context.clearRect(0, 0, cssW, cssH);
    context.font = FONT;
    context.textBaseline = "top";
    for (let c = 0; c < cols; c++) {
      const x = c * charW;
      const hMask = smoothstep(0, 2.5, c);
      if (hMask <= 0.001) continue;
      const col = columns[c];
      if (!col) continue;
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        const dist = col.head - rIdx;
        if (dist < 0 || dist > col.trail) continue;
        const si = col.start + rIdx;
        const ch = SOURCE[si];
        if (!ch || ch === " ") continue;
        const fall = 1 - dist / col.trail;
        const edge = rowEdges[rIdx] ?? 0;
        const a = Math.min(1, fall * fall) * edge * hMask * 0.92;
        if (a <= 0.01) continue;
        const tone = dist < 0.9 ? "head" : TONES[si] ?? "muted";
        context.drawImage(glyphSprite(ch, tone, a), x, rIdx * CHAR_H, charW, CHAR_H);
      }
    }
  }

  function advanceRain(dt: number) {
    for (let c = 0; c < cols; c++) {
      const col = columns[c];
      if (!col) continue;
      col.head += col.speed * dt;
      if (col.head - col.trail > rows) columns[c] = makeColumn(true);
    }
  }

  function layout() {
    const header = canvas.parentElement;
    const hero = header ? header.querySelector(".hero") : null;
    if (header && hero) {
      const hb = header.getBoundingClientRect();
      const eb = hero.getBoundingClientRect();
      const top = Math.max(0, eb.top - hb.top);
      const left = Math.max(0, eb.right - hb.left);
      const height = hb.height - top;
      const width = Math.max(0, hb.right - eb.right);
      canvas.style.top = `${top}px`;
      canvas.style.left = `${left}px`;
      canvas.style.right = "auto";
      canvas.style.height = `${height}px`;
      canvas.style.width = `${width}px`;
      if (pauseButton) {
        pauseButton.style.left = `${left + 6}px`;
        pauseButton.style.top = `${top + height - 28}px`;
      }
    }
    const r = canvas.getBoundingClientRect();
    cssW = r.width;
    cssH = r.height;
    if (cssW < 2 || cssH < 2) return;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.font = FONT;
    layoutRain();
  }

  function stopTimer() {
    clearTimeout(timer);
    timer = 0;
  }

  function scheduleFrame() {
    stopTimer();
    timer = window.setTimeout(frame, FRAME_MS);
  }

  function frame() {
    if (document.hidden) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    advanceRain(dt);
    drawRain();
    scheduleFrame();
  }

  function start() {
    stopTimer();
    layout();
    if (cssW < 2 || cssH < 2) return;
    if (reduced) {
      for (let c = 0; c < cols; c++) {
        const col = columns[c];
        if (col) col.head = rand(2, rows - 2);
      }
    }
    drawRain();
    applyRunState();
  }

  let tabVisible = !document.hidden;
  let inViewport = true;

  function applyRunState() {
    stopTimer();
    if (paused || reduced || !tabVisible || !inViewport) return;
    if (cssW < 2 || cssH < 2) return;
    last = performance.now();
    scheduleFrame();
  }

  function syncPauseButton() {
    if (pauseButton) {
      pauseButton.textContent = paused ? "▶" : "⏸";
      pauseButton.classList.toggle("is-paused", paused);
      pauseButton.setAttribute(
        "aria-label",
        paused ? "Resume background animation" : "Pause background animation",
      );
    }
  }

  function setPaused(value: boolean) {
    if (value === paused) {
      syncPauseButton();
      return;
    }
    paused = value;
    syncPauseButton();
    options.onPausedChange?.(paused);
    applyRunState();
  }

  const onPauseClick = () => setPaused(!paused);
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(start, 120);
  };
  const onVisibilityChange = () => {
    tabVisible = !document.hidden;
    applyRunState();
  };
  const io = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      inViewport = entry ? entry.isIntersecting : true;
      applyRunState();
    },
    { rootMargin: "32px" },
  );
  let resizeT = 0;

  canvas.addEventListener("click", onPauseClick);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  io.observe(canvas);
  syncPauseButton();
  start();

  return {
    refreshColors() {
      palette = readPalette();
      clearGlyphCache();
      if (reduced) start();
    },
    relayout: start,
    destroy() {
      stopTimer();
      clearTimeout(resizeT);
      io.disconnect();
      canvas.removeEventListener("click", onPauseClick);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
