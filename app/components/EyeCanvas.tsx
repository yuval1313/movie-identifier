"use client";

import { useEffect, useRef } from "react";

const IMG_W = 1500;
const IMG_H = 820;

// Eye socket centers + shape (ellipse: rx wider than tall, matching real eye anatomy)
const EYES = [
  { cx: 562, cy: 303, rx: 38, ry: 24 },
  { cx: 932, cy: 303, rx: 38, ry: 24 },
];

const MAX_SHIFT = 6;  // max iris travel in native px (subtle = realistic)
const LERP      = 0.055;

interface State { sx: number; sy: number; }

export default function EyeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -1, y: -1 });
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let W = 0, H = 0;
    let scale = 1, offX = 0, offY = 0;

    const states: State[] = EYES.map(() => ({ sx: 0, sy: 0 }));

    // One small offscreen canvas per eye — reused every frame
    const offscreens = EYES.map(() => document.createElement("canvas"));

    const img = new Image();
    img.src = "/portrait.jpg";

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      scale = Math.max(W / IMG_W, H / IMG_H);
      offX  = (W - IMG_W * scale) / 2;
      offY  = (H - IMG_H * scale) / 2;
      if (mouseRef.current.x < 0) mouseRef.current = { x: W / 2, y: H / 2 };

      // Size each offscreen to cover the eye ellipse + feather padding
      EYES.forEach((eye, i) => {
        const padX = (eye.rx + 12) * scale * 2;
        const padY = (eye.ry + 12) * scale * 2;
        offscreens[i].width  = Math.ceil(padX);
        offscreens[i].height = Math.ceil(padY);
      });
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: W / 2, y: H / 2 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    const draw = () => {
      if (!img.complete || img.naturalWidth === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const rendW = IMG_W * scale;
      const rendH = IMG_H * scale;

      // ── Layer 1: Static full portrait ─────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.filter = "grayscale(1) brightness(0.70) contrast(1.08)";
      ctx.drawImage(img, offX, offY, rendW, rendH);
      ctx.filter = "none";

      // Vignette to blend into page bg
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.9);
      vig.addColorStop(0,   "rgba(13,13,22,0)");
      vig.addColorStop(0.55,"rgba(13,13,22,0.10)");
      vig.addColorStop(1,   "rgba(13,13,22,0.92)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // ── Layer 2: Each eye — shifted portrait blended with soft feather ────
      const { x: mx, y: my } = mouseRef.current;

      EYES.forEach((eye, i) => {
        // Eye center in viewport px
        const vpCx = eye.cx * scale + offX;
        const vpCy = eye.cy * scale + offY;
        const vpRx = eye.rx * scale;
        const vpRy = eye.ry * scale;

        // Mouse direction → shift, clamped, eased
        const dx   = mx - vpCx;
        const dy   = my - vpCy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const maxS = MAX_SHIFT * scale;
        const pull = Math.min(dist, maxS * 10) / (maxS * 10);
        const tx   = (dx / dist) * maxS * pull;
        const ty   = (dy / dist) * maxS * pull;

        states[i].sx += (tx - states[i].sx) * LERP;
        states[i].sy += (ty - states[i].sy) * LERP;

        const { sx, sy } = states[i];

        // Offscreen canvas dimensions & origin
        const off   = offscreens[i];
        const oc    = off.getContext("2d")!;
        const padX  = off.width  / 2;   // half-width  = distance from center to edge
        const padY  = off.height / 2;

        oc.clearRect(0, 0, off.width, off.height);

        // Step A: Draw the SHIFTED portrait into the offscreen, translated so
        //         the eye center maps to the offscreen center
        oc.save();
        oc.filter = "grayscale(1) brightness(0.82) contrast(1.10)";
        oc.drawImage(
          img,
          offX + sx - vpCx + padX,   // x: shift portrait so eye center → padX
          offY + sy - vpCy + padY,   // y: same vertically
          rendW, rendH
        );
        oc.filter = "none";
        oc.restore();

        // Step B: Apply a soft elliptical feather mask using destination-in.
        //         Opaque at the center (eye stays visible), transparent at edge
        //         (blends seamlessly into the static portrait below).
        oc.save();
        oc.globalCompositeOperation = "destination-in";

        const grad = oc.createRadialGradient(padX, padY, vpRx * 0.35, padX, padY, Math.max(padX, padY));
        grad.addColorStop(0,    "rgba(0,0,0,1)");    // center: fully keep
        grad.addColorStop(0.55, "rgba(0,0,0,0.92)"); // mid: mostly keep
        grad.addColorStop(0.82, "rgba(0,0,0,0.30)"); // transition: soft fade
        grad.addColorStop(1,    "rgba(0,0,0,0)");    // edge: fully transparent

        // Clip the gradient to the eye ellipse so it doesn't bleed outside
        oc.beginPath();
        oc.ellipse(padX, padY, vpRx * 1.25, vpRy * 1.35, 0, 0, Math.PI * 2);
        oc.fillStyle = grad;
        oc.fill();
        oc.restore();

        // Step C: Composite the blended eye patch onto the main canvas
        ctx.drawImage(off, vpCx - padX, vpCy - padY);
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    img.onload = () => { rafRef.current = requestAnimationFrame(draw); };
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
