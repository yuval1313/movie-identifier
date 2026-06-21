"use client";

import { useEffect, useRef } from "react";

// ─── Native image dimensions ──────────────────────────────────────────────────
const IMG_W = 1500;
const IMG_H = 820;

// Eye socket centers in native image pixels + socket clip radius
const EYES = [
  { cx: 562, cy: 303, r: 34 },
  { cx: 932, cy: 303, r: 34 },
];

// Max amount the iris can shift (native px) — keeps movement inside socket
const MAX_SHIFT = 9;
const LERP      = 0.07;

interface State { sx: number; sy: number; }

export default function EyeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -1, y: -1 });
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let scale = 1, offX = 0, offY = 0;   // object-fit: cover math

    const states: State[] = EYES.map(() => ({ sx: 0, sy: 0 }));

    // Load the portrait once
    const img = new Image();
    img.src = "/portrait.jpg";

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      scale = Math.max(W / IMG_W, H / IMG_H);
      offX  = (W - IMG_W * scale) / 2;
      offY  = (H - IMG_H * scale) / 2;
      if (mouseRef.current.x < 0) mouseRef.current = { x: W / 2, y: H / 2 };
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: W / 2, y: H / 2 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    // Native → viewport
    const toVP = (nx: number, ny: number) => ({
      x: nx * scale + offX,
      y: ny * scale + offY,
    });

    const draw = () => {
      if (!img.complete || img.naturalWidth === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, W, H);

      const rendW = IMG_W * scale;
      const rendH = IMG_H * scale;

      // ── Layer 1: Full portrait, static (grayscale + dim) ─────────────────
      ctx.save();
      ctx.filter = "grayscale(1) brightness(0.68) contrast(1.08)";
      ctx.drawImage(img, offX, offY, rendW, rendH);
      ctx.filter = "none";

      // Edge vignette — blends into page background #0d0d16
      const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
      vignette.addColorStop(0,   "rgba(13,13,22,0)");
      vignette.addColorStop(0.6, "rgba(13,13,22,0.15)");
      vignette.addColorStop(1,   "rgba(13,13,22,0.88)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // ── Layer 2: Eye patches — actual iris pixels, slightly shifted ───────
      const { x: mx, y: my } = mouseRef.current;

      EYES.forEach((eye, i) => {
        const vp  = toVP(eye.cx, eye.cy);       // socket center in viewport
        const vpr = eye.r * scale;               // socket radius in viewport

        // Direction toward mouse, clamped to MAX_SHIFT (in viewport px)
        const dx   = mx - vp.x;
        const dy   = my - vp.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const maxS = MAX_SHIFT * scale;
        const pull = Math.min(dist, maxS * 8) / (maxS * 8);
        const tx   = (dx / dist) * maxS * pull;
        const ty   = (dy / dist) * maxS * pull;

        states[i].sx += (tx - states[i].sx) * LERP;
        states[i].sy += (ty - states[i].sy) * LERP;

        const { sx, sy } = states[i];

        // Clip to the eye socket circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, vpr * 1.05, 0, Math.PI * 2);
        ctx.clip();

        // Draw the SAME portrait image, shifted by (sx, sy) — the actual
        // iris & pupil pixels move naturally inside the clipped socket
        ctx.filter = "grayscale(1) brightness(0.82) contrast(1.12)";
        ctx.drawImage(img, offX + sx, offY + sy, rendW, rendH);
        ctx.filter = "none";

        // Subtle inner shadow at socket edge to ground the eye in the face
        const edgeGrad = ctx.createRadialGradient(
          vp.x, vp.y, vpr * 0.72,
          vp.x, vp.y, vpr * 1.05
        );
        edgeGrad.addColorStop(0,   "rgba(0,0,0,0)");
        edgeGrad.addColorStop(0.7, "rgba(0,0,0,0.08)");
        edgeGrad.addColorStop(1,   "rgba(0,0,0,0.45)");
        ctx.fillStyle = edgeGrad;
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, vpr * 1.05, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    img.onload  = () => { rafRef.current = requestAnimationFrame(draw); };
    if (img.complete) rafRef.current = requestAnimationFrame(draw);

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
