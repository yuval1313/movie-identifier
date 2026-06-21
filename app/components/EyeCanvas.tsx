"use client";

import { useEffect, useRef } from "react";

// Two eyes centered on screen — positions as fraction of viewport (x, y)
const EYES = [
  { xRatio: 0.42, yRatio: 0.38 },
  { xRatio: 0.58, yRatio: 0.38 },
];

const LERP = 0.08; // easing speed

interface EyeState { sx: number; sy: number; }

export default function EyeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1, y: -1 });
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;

    const states: EyeState[] = EYES.map(() => ({ sx: 0, sy: 0 }));

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      // Reset mouse to center on resize
      if (mouseRef.current.x < 0) {
        mouseRef.current = { x: W / 2, y: H / 2 };
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: W / 2, y: H / 2 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    function drawEye(
      cx: number, cy: number,
      state: EyeState,
      irisR: number, pupilR: number, maxShift: number
    ) {
      const { x: mx, y: my } = mouseRef.current;

      // Direction from eye center to mouse, clamped to maxShift
      const dx   = mx - cx;
      const dy   = my - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = Math.min(dist, maxShift * 10) / (maxShift * 10);
      const tx   = (dx / dist) * maxShift * pull;
      const ty   = (dy / dist) * maxShift * pull;

      state.sx += (tx - state.sx) * LERP;
      state.sy += (ty - state.sy) * LERP;

      const ex = cx + state.sx;
      const ey = cy + state.sy;

      ctx.save();

      // ── Outer glow (ambient socket) ──
      const socketGrad = ctx.createRadialGradient(cx, cy, irisR * 0.5, cx, cy, irisR * 2.8);
      socketGrad.addColorStop(0,   "rgba(100,120,180,0.07)");
      socketGrad.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, irisR * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = socketGrad;
      ctx.fill();

      // ── Sclera (white of eye) ──
      const scleraGrad = ctx.createRadialGradient(cx, cy - irisR * 0.15, 0, cx, cy, irisR * 1.55);
      scleraGrad.addColorStop(0,   "rgba(230,235,255,0.18)");
      scleraGrad.addColorStop(0.7, "rgba(180,190,220,0.08)");
      scleraGrad.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, irisR * 1.55, 0, Math.PI * 2);
      ctx.fillStyle = scleraGrad;
      ctx.fill();

      // ── Iris ──
      const irisGrad = ctx.createRadialGradient(ex, ey - irisR * 0.1, 0, ex, ey, irisR);
      irisGrad.addColorStop(0,    "rgba(90,130,220,0.55)");
      irisGrad.addColorStop(0.45, "rgba(60,100,200,0.45)");
      irisGrad.addColorStop(0.85, "rgba(30,60,160,0.35)");
      irisGrad.addColorStop(1,    "rgba(10,20,80,0.20)");

      ctx.beginPath();
      ctx.arc(ex, ey, irisR, 0, Math.PI * 2);
      ctx.fillStyle = irisGrad;
      ctx.shadowColor = "rgba(80,140,255,0.5)";
      ctx.shadowBlur  = irisR * 0.9;
      ctx.fill();
      ctx.shadowBlur = 0;

      // ── Limbal ring ──
      ctx.beginPath();
      ctx.arc(ex, ey, irisR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(20,40,120,0.55)";
      ctx.lineWidth   = irisR * 0.12;
      ctx.stroke();

      // ── Pupil ──
      const pupilGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, pupilR);
      pupilGrad.addColorStop(0, "rgba(0,0,0,0.98)");
      pupilGrad.addColorStop(1, "rgba(5,5,15,0.92)");
      ctx.beginPath();
      ctx.arc(ex, ey, pupilR, 0, Math.PI * 2);
      ctx.fillStyle = pupilGrad;
      ctx.fill();

      // ── Catch-light (main) ──
      const hlX = ex - irisR * 0.3;
      const hlY = ey - irisR * 0.3;
      const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, irisR * 0.22);
      hlGrad.addColorStop(0, "rgba(255,255,255,0.90)");
      hlGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(hlX, hlY, irisR * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = hlGrad;
      ctx.fill();

      // ── Catch-light (secondary, small) ──
      const hl2X = ex + irisR * 0.25;
      const hl2Y = ey + irisR * 0.28;
      ctx.beginPath();
      ctx.arc(hl2X, hl2Y, irisR * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.fill();

      ctx.restore();
    }

    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      const irisR    = Math.min(W, H) * 0.045;
      const pupilR   = irisR * 0.48;
      const maxShift = irisR * 0.32;

      EYES.forEach((eye, i) => {
        const cx = eye.xRatio * W;
        const cy = eye.yRatio * H;
        drawEye(cx, cy, states[i], irisR, pupilR, maxShift);
      });

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
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  );
}
