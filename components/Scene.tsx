"use client";

import { useEffect, useRef } from "react";
import { EARLY_ACCESS_STATE } from "@/lib/earlyAccess";

/**
 * One 3D scene holding both the dot shell and the token logos, sharing a
 * single camera. That sharing is the point: the tokens are not a separate
 * screen that replaces the sphere, they sit inside it from the start, so
 * flying the camera forward reveals them rather than cutting to them.
 *
 * Projection is scale = persp / (persp + z - dolly). Raising `dolly` walks the
 * camera into the shell: near points swell and slide past, far ones spread out
 * into a starfield.
 *
 * Logos live in public/tokens/. Each appears once at full size (PRIMARY) and
 * repeats smaller and further back (ECHO); the split is enforced by the two
 * lists, not by whoever edits the coordinates.
 */

// ---------------------------------------------------------------- dots

const DOT_DENSITY = 4600 / (1440 * 900); // dots per px², bigger + sparser than before
const MIN_DOTS = 1800;
const MAX_DOTS = 9000;

const WHITE = [236, 240, 230] as const;
const LIME = [200, 255, 0] as const;
const LIME_SHARE = 0.3; // 70% white / 30% brand, picked at random per dot

const ENTRANCE_MS = 2100;
const STAGGER_MS = 900;

interface Dot {
  // unit position on the shell
  ux: number;
  uy: number;
  uz: number;
  // where it flies in from, in units of R
  sx: number;
  sy: number;
  sz: number;
  size: number;
  bright: number;
  lime: boolean;
  delay: number;
  phase: number;
}

function makeDots(n: number): Dot[] {
  const out: Dot[] = new Array(n);
  for (let i = 0; i < n; i++) {
    // uniform on sphere: u = cos(lat) uniform avoids clustering at the poles
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));

    // entry vector: a random direction well outside the frame, so they
    // converge from every angle rather than from one edge
    const su = Math.random() * 2 - 1;
    const st = Math.random() * Math.PI * 2;
    const sr = Math.sqrt(Math.max(0, 1 - su * su));
    const dist = 3.2 + Math.random() * 3.4;

    out[i] = {
      ux: r * Math.cos(t),
      uy: u,
      uz: r * Math.sin(t),
      sx: sr * Math.cos(st) * dist,
      sy: su * dist,
      sz: sr * Math.sin(st) * dist,
      size: 1.15 + Math.random() * 1.35,
      bright: 0.5 + Math.random() * 0.5,
      lime: Math.random() < LIME_SHARE,
      delay: Math.random() * STAGGER_MS,
      phase: Math.random() * Math.PI * 2,
    };
  }
  return out;
}

// -------------------------------------------------------------- tokens

const LOGOS = ["eth", "weth", "cbbtc", "hype", "robinhood", "cashcat", "ansem"] as const;
type LogoId = (typeof LOGOS)[number];

interface Placed {
  id: LogoId;
  x: number; // final on-screen position, % of viewport
  y: number;
  size: number; // final on-screen diameter in px, once zoomed in
}

/** One of each, large and near the camera. */
const PRIMARY: Placed[] = [
  { id: "eth", x: 14, y: 22, size: 54 },
  { id: "robinhood", x: 85, y: 18, size: 50 },
  { id: "cbbtc", x: 19, y: 74, size: 52 },
  { id: "hype", x: 81, y: 77, size: 46 },
  { id: "weth", x: 7, y: 49, size: 44 },
  { id: "cashcat", x: 93, y: 47, size: 42 },
  { id: "ansem", x: 50, y: 8, size: 40 },
];

/** Repeats: deliberately smaller, set further back. */
const ECHO: Placed[] = [
  { id: "eth", x: 37, y: 91, size: 22 },
  { id: "eth", x: 71, y: 21, size: 16 },
  { id: "weth", x: 27, y: 33, size: 20 },
  { id: "weth", x: 74, y: 89, size: 24 },
  { id: "cbbtc", x: 4, y: 30, size: 18 },
  { id: "cbbtc", x: 95, y: 67, size: 20 },
  { id: "hype", x: 33, y: 95, size: 22 },
  { id: "hype", x: 96, y: 31, size: 16 },
  { id: "robinhood", x: 12, y: 63, size: 24 },
  { id: "robinhood", x: 61, y: 96, size: 20 },
  { id: "cashcat", x: 3, y: 85, size: 18 },
  { id: "cashcat", x: 88, y: 6, size: 22 },
  { id: "ansem", x: 45, y: 88, size: 26 },
  { id: "ansem", x: 23, y: 9, size: 18 },
  { id: "eth", x: 66, y: 4, size: 18 },
];

const SMALLEST_PRIMARY = Math.min(...PRIMARY.map((t) => t.size));
const LARGEST_ECHO = Math.max(...ECHO.map((t) => t.size));
if (process.env.NODE_ENV !== "production" && LARGEST_ECHO >= SMALLEST_PRIMARY) {
  console.warn(
    `Scene: an echo (${LARGEST_ECHO}px) is not smaller than the smallest primary (${SMALLEST_PRIMARY}px).`,
  );
}

const SIZE_MIN = Math.min(...ECHO.map((t) => t.size));
const SIZE_MAX = Math.max(...PRIMARY.map((t) => t.size));

const PLACED = [...PRIMARY, ...ECHO];

// camera constants
const PERSP_K = 3.2; // perspective distance, in units of R
const DOLLY_K = 1.9; // how far the camera travels on open, in units of R

export default function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const tokenRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    let raf = 0;
    let running = true;

    // camera / interaction state
    let dolly = 0;
    let dollyTarget = 0;
    let yaw = 0;
    let yawTarget = 0;
    let pitch = 0;
    let pitchTarget = 0;
    let mx = -9999;
    let my = -9999;
    let hasMouse = false;

    const start = performance.now();

    function geometry() {
      // leaves headroom under the copy above and the stats below
      const R = Math.min(w * 0.42, h * 0.3);
      return { R, cx: w / 2, cy: h * 0.62 };
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const want = Math.round(DOT_DENSITY * w * h);
      const n = Math.max(MIN_DOTS, Math.min(MAX_DOTS, want));
      if (dots.length === 0 || Math.abs(n - dots.length) > 500) dots = makeDots(n);
    }

    resize();
    window.addEventListener("resize", resize);

    function onMove(e: PointerEvent) {
      mx = e.clientX;
      my = e.clientY;
      hasMouse = true;
      // the shell turns to face the pointer
      yawTarget = ((e.clientX - w / 2) / w) * 0.9;
      pitchTarget = ((e.clientY - h * 0.62) / h) * 0.7;
    }
    function onLeave() {
      hasMouse = false;
      mx = -9999;
      my = -9999;
      yawTarget = 0;
      pitchTarget = 0;
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    function onZoom(e: Event) {
      dollyTarget = (e as CustomEvent<boolean>).detail ? 1 : 0;
    }
    window.addEventListener(EARLY_ACCESS_STATE, onZoom);

    function draw(now: number) {
      if (!ctx) return;
      const { R, cx, cy } = geometry();
      const persp = R * PERSP_K;
      const elapsed = now - start;

      // ease camera + orientation toward their targets
      dolly += (dollyTarget - dolly) * (dollyTarget > dolly ? 0.055 : 0.09);
      yaw += (yawTarget - yaw) * 0.045;
      pitch += (pitchTarget - pitch) * 0.045;

      const d = dolly * R * DOLLY_K;
      const spin = reduced ? 0.4 : now * 0.00004;

      const ay = spin + yaw;
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);

      const magnetR = R * 0.42;
      const nearFade = R * 0.9;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < dots.length; i++) {
        const p = dots[i];

        // entrance: fly in from off-screen, ease-out cubic, staggered
        let t = 1;
        if (!reduced) {
          const raw = (elapsed - p.delay) / ENTRANCE_MS;
          t = raw <= 0 ? 0 : raw >= 1 ? 1 : 1 - Math.pow(1 - raw, 3);
        }

        const breathe = 1 + Math.sin(now * 0.00025 + p.phase) * 0.012;

        // rotate the shell position: yaw about Y, then pitch about X
        let x = p.ux * cosY - p.uz * sinY;
        let z = p.ux * sinY + p.uz * cosY;
        let y = p.uy;
        const y2 = y * cosX - z * sinX;
        z = y * sinX + z * cosX;
        y = y2;

        x *= R * breathe;
        y *= R * breathe;
        z *= R * breathe;

        if (t < 1) {
          const k = 1 - t;
          x += (p.sx * R - x) * k;
          y += (p.sy * R - y) * k;
          z += (p.sz * R - z) * k;
        }

        const denom = persp + z - d;
        if (denom < 30) continue; // behind or on top of the camera
        const s = persp / denom;

        let px = cx + x * s;
        let py = cy + y * s;

        // dots near the pointer are pulled toward it
        let pull = 0;
        if (hasMouse && t > 0.9) {
          const dx = mx - px;
          const dy = my - py;
          const dist = Math.hypot(dx, dy);
          if (dist < magnetR && dist > 0.001) {
            pull = (1 - dist / magnetR) ** 2;
            px += dx * pull * 0.55;
            py += dy * pull * 0.55;
          }
        }

        if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;

        const depth = (z / (R * breathe) + 1) * 0.5; // 0 far, 1 near
        const near = Math.min(1, denom / nearFade); // fade as it passes camera
        const alpha =
          t * p.bright * (0.2 + depth * 0.8) * near * (1 + pull * 0.9);
        if (alpha <= 0.01) continue;

        const size = Math.max(0.8, p.size * (0.6 + depth * 0.7) * s);
        const [cr, cg, cb] = p.lime ? LIME : WHITE;
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.min(1, alpha).toFixed(3)})`;
        ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);
      }

      ctx.globalCompositeOperation = "source-over";

      // --- tokens, same camera ---
      const dFull = R * DOLLY_K;
      for (let i = 0; i < PLACED.length; i++) {
        const el = tokenRefs.current[i];
        if (!el) continue;
        const tk = PLACED[i];

        // Depth is chosen from final size: bigger reads as nearer.
        const norm = (tk.size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN);
        const zw = R * (0.15 + 0.85 * (1 - norm));

        // Back-compute the world position that lands this token exactly on its
        // designed screen spot once the camera has finished its travel.
        const sFinal = persp / (persp + zw - dFull);
        const xw = ((tk.x / 100) * w - cx) / sFinal;
        const yw = ((tk.y / 100) * h - cy) / sFinal;
        const baseSize = tk.size / sFinal;

        // Tokens deliberately do NOT take the shell's spin. Their world
        // position is back-computed from a fixed target on screen, so rotating
        // them would carry them off that target as the spin accumulates.
        // Instead they get a depth-scaled parallax nudge from the pointer,
        // which keeps them feeling part of the space without drifting.
        const z = zw;
        const denom = persp + z - d;
        if (denom < 40) {
          el.style.opacity = "0";
          continue;
        }
        const s = persp / denom;
        const par = (1 - norm * 0.55) * R * 0.16;
        const px = cx + xw * s + yaw * par;
        const py = cy + yw * s + pitch * par;
        const size = baseSize * s;

        // Near-invisible at rest: several logos have dark or photographic
        // backgrounds, so anything higher reads as a grey smudge rather than a
        // hint. The reveal is carried by the camera move.
        const op = (0.055 + 0.945 * dolly) * Math.min(1, denom / nearFade);

        el.style.opacity = String(Math.max(0, Math.min(1, op)));
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.transform = `translate3d(${px - size / 2}px, ${py - size / 2}px, 0)`;
      }

      if (running) raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener(EARLY_ACCESS_STATE, onZoom);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div ref={layerRef} className="absolute inset-0">
        {PLACED.map((t, i) => (
          <div
            key={`${t.id}-${i}`}
            ref={(el) => {
              tokenRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 will-change-transform"
            style={{ opacity: 0 }}
          >
            <img
              src={`/tokens/${t.id}.svg`}
              alt=""
              className="block h-full w-full rounded-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
