"use client";

import { useEffect, useRef } from "react";

// ─── Eye positions in the NATIVE portrait image (pixels) ─────────────────────
// Image native dimensions: 1500 × 820
const IMAGE_W = 1500;
const IMAGE_H = 820;

const EYES = [
  { cx: 562, cy: 303 },   // viewer-left eye
  { cx: 932, cy: 303 },   // viewer-right eye
];

const IRIS_R    = 29;   // iris radius in native px
const PUPIL_R   = 14;   // pupil radius in native px
const MAX_SHIFT = 8;    // max iris shift in native px
const LERP      = 0.07; // easing (lower = smoother/slower)

interface EyeState { sx: number; sy: number; }

export default function EyeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -1, y: -1 });
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;

    const states: EyeState[] = EYES.map(() => ({ sx: 0, sy: 0 }));

    // Replicate object-fit: cover / object-position: center
    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const scale = Math.max(W / IMAGE_W, H / IMAGE_H);
      scaleX = scaleY = scale;
      offsetX = (W - IMAGE_W * scale) / 2;
      offsetY = (H - IMAGE_H * scale) / 2;
      if (mouseRef.current.x < 0) mouseRef.current = { x: W / 2, y: H / 2 };
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: W / 2, y: H / 2 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    // Convert native image px → canvas viewport px
    const toCanvas = (nx: number, ny: number) => ({
      x: nx * scaleX + offsetX,
      y: ny * scaleY + offsetY,
    });

    function drawEye(nativeCx: number, nativeCy: number, state: EyeState) {
      const center   = toCanvas(nativeCx, nativeCy);
      const irisR    = IRIS_R    * scaleX;
      const pupilR   = PUPIL_R   * scaleX;
      const maxShift = MAX_SHIFT * scaleX;

      const { x: mx, y: my } = mouseRef.current;
      const dx   = mx - center.x;
      const dy   = my - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = Math.min(dist, maxShift * 8) / (maxShift * 8);
      const tx   = (dx / dist) * maxShift * pull;
      const ty   = (dy / dist) * maxShift * pull;

      state.sx += (tx - state.sx) * LERP;
      state.sy += (ty - state.sy) * LERP;

      const ex = center.x + state.sx;
      const ey = center.y + state.sy;

      ctx.save();

      // ── Iris ──
      const irisGrad = ctx.createRadialGradient(ex, ey - irisR * 0.1, 0, ex, ey, irisR);
      irisGrad.addColorStop(0,    "rgba(170,185,210,0.55)");
      irisGrad.addColorStop(0.5,  "rgba(130,150,190,0.45)");
      irisGrad.addColorStop(0.85, "rgba(70,90,140,0.35)");
      irisGrad.addColorStop(1,    "rgba(20,30,70,0.20)");

      ctx.beginPath();
      ctx.arc(ex, ey, irisR, 0, Math.PI * 2);
      ctx.fillStyle   = irisGrad;
      ctx.shadowColor = "rgba(180,200,255,0.35)";
      ctx.shadowBlur  = irisR * 0.6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // ── Limbal ring ──
      ctx.beginPath();
      ctx.arc(ex, ey, irisR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(15,25,60,0.60)";
      ctx.lineWidth   = irisR * 0.13;
      ctx.stroke();

      // ── Pupil ──
      const pupilGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, pupilR);
      pupilGrad.addColorStop(0, "rgba(0,0,0,0.98)");
      pupilGrad.addColorStop(1, "rgba(5,5,10,0.90)");
      ctx.beginPath();
      ctx.arc(ex, ey, pupilR, 0, Math.PI * 2);
      ctx.fillStyle = pupilGrad;
      ctx.fill();

      // ── Main catch-light ──
      const hlX = ex - irisR * 0.28;
      const hlY = ey - irisR * 0.30;
      const hlG = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, irisR * 0.20);
      hlG.addColorStop(0, "rgba(255,255,255,0.88)");
      hlG.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(hlX, hlY, irisR * 0.20, 0, Math.PI * 2);
      ctx.fillStyle = hlG;
      ctx.fill();

      // ── Secondary catch-light ──
      ctx.beginPath();
      ctx.arc(ex + irisR * 0.22, ey + irisR * 0.25, irisR * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fill();

      ctx.restore();
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      EYES.forEach((eye, i) => drawEye(eye.cx, eye.cy, states[i]));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <>
      {/* Portrait background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/portrait.jpg"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            filter: "grayscale(100%) brightness(0.72) contrast(1.08)",
            userSelect: "none",
          }}
        />
        {/* Gradient overlay — blends edges into the dark background */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 80% at 50% 45%, transparent 40%, #0d0d16 100%),
            linear-gradient(to bottom, #0d0d16 0%, transparent 18%, transparent 75%, #0d0d16 100%),
            linear-gradient(to right,  #0d0d16 0%, transparent 15%, transparent 85%, #0d0d16 100%)
          `,
        }} />
      </div>

      {/* Eye-tracking canvas overlay */}
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }}
      />
    </>
  );
}
