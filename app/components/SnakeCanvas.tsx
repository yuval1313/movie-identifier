"use client";

import { useEffect, useRef } from "react";

interface SnakeDef {
  color: string;
  glow: string;
  segments: number;
  speed: number;
  angleSpeed: number;
  angleOffset: number;
  radius: number;        // autonomous orbit radius
  cx: number; cy: number; // orbit center (0–1 normalized)
  thickness: number;     // max head thickness in px
}

const SNAKE_DEFS: SnakeDef[] = [
  { color: "#00AAFF", glow: "rgba(0,170,255,0.8)",   segments: 60, speed: 2.2, angleSpeed: 0.012, angleOffset: 0,    radius: 0.22, cx: 0.3,  cy: 0.35, thickness: 3 },
  { color: "#9B5CF6", glow: "rgba(155,92,246,0.8)",  segments: 55, speed: 1.9, angleSpeed: 0.009, angleOffset: 2.1,  radius: 0.18, cx: 0.7,  cy: 0.65, thickness: 3 },
  { color: "#00AAFF", glow: "rgba(0,170,255,0.75)",  segments: 50, speed: 2.5, angleSpeed: 0.014, angleOffset: 4.2,  radius: 0.15, cx: 0.55, cy: 0.5,  thickness: 2.5 },
  { color: "#9B5CF6", glow: "rgba(155,92,246,0.75)", segments: 45, speed: 2.0, angleSpeed: 0.011, angleOffset: 1.0,  radius: 0.20, cx: 0.2,  cy: 0.7,  thickness: 2.5 },
  { color: "#00AAFF", glow: "rgba(0,170,255,0.7)",   segments: 40, speed: 1.7, angleSpeed: 0.008, angleOffset: 3.5,  radius: 0.16, cx: 0.8,  cy: 0.25, thickness: 2 },
  { color: "#9B5CF6", glow: "rgba(155,92,246,0.7)",  segments: 35, speed: 2.8, angleSpeed: 0.016, angleOffset: 5.0,  radius: 0.12, cx: 0.45, cy: 0.8,  thickness: 2 },
];

interface Segment { x: number; y: number; }

interface Snake {
  def: SnakeDef;
  segs: Segment[];
  angle: number;
  targetX: number;
  targetY: number;
  headVx: number;
  headVy: number;
}

export default function SnakeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false });
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const snakes: Snake[] = [];

    // Initialize canvas size
    const resize = () => {
      const parent = canvas.parentElement!;
      W = parent.offsetWidth;
      H = parent.offsetHeight;
      canvas.width = W;
      canvas.height = H;
      // Re-init segment positions on resize
      snakes.forEach((s) => {
        const cx = s.def.cx * W;
        const cy = s.def.cy * H;
        s.segs = s.segs.map(() => ({ x: cx, y: cy }));
        s.targetX = cx;
        s.targetY = cy;
      });
    };

    // Build snake objects
    SNAKE_DEFS.forEach((def) => {
      const cx = def.cx * (canvas.parentElement?.offsetWidth ?? window.innerWidth);
      const cy = def.cy * (canvas.parentElement?.offsetHeight ?? window.innerHeight);
      const segs: Segment[] = Array.from({ length: def.segments }, () => ({ x: cx, y: cy }));
      snakes.push({ def, segs, angle: def.angleOffset, targetX: cx, targetY: cy, headVx: 0, headVy: 0 });
    });

    resize();
    window.addEventListener("resize", resize);

    // Mouse tracking
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const onMouseLeave = () => { mouseRef.current.active = false; };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    // Also track on the whole window so it works when hovering over other elements
    window.addEventListener("mousemove", onMouseMove);

    const FOLLOW_EASE = 0.06;   // head easing toward target
    const SEG_EASE = 0.28;       // how fast each segment follows the one ahead
    const MOUSE_ATTRACT = 0.35;  // 0 = no mouse pull, 1 = full follow

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      snakes.forEach((snake) => {
        const { def, segs } = snake;
        const mouse = mouseRef.current;

        // --- Head target: blend autonomous orbit + mouse attraction ---
        snake.angle += def.angleSpeed;
        const r = def.radius * Math.min(W, H);
        const autoX = def.cx * W + Math.cos(snake.angle) * r;
        const autoY = def.cy * H + Math.sin(snake.angle * 1.3) * r * 0.6;

        let tx: number, ty: number;
        if (mouse.active) {
          tx = autoX + (mouse.x - autoX) * MOUSE_ATTRACT;
          ty = autoY + (mouse.y - autoY) * MOUSE_ATTRACT;
        } else {
          tx = autoX;
          ty = autoY;
        }

        // Smooth head velocity (inertia)
        snake.headVx += (tx - segs[0].x) * FOLLOW_EASE;
        snake.headVy += (ty - segs[0].y) * FOLLOW_EASE;
        snake.headVx *= 0.82; // damping
        snake.headVy *= 0.82;
        segs[0].x += snake.headVx;
        segs[0].y += snake.headVy;

        // Each segment chases the one ahead with elastic delay
        for (let i = 1; i < segs.length; i++) {
          segs[i].x += (segs[i - 1].x - segs[i].x) * SEG_EASE;
          segs[i].y += (segs[i - 1].y - segs[i].y) * SEG_EASE;
        }

        // --- Draw snake as tapered glowing path ---
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Draw in chunks: each segment pair gets its own opacity + width
        for (let i = 0; i < segs.length - 1; i++) {
          const t = i / (segs.length - 1); // 0 = head, 1 = tail
          const opacity = Math.pow(1 - t, 1.4); // exponential fade
          const width = def.thickness * (1 - t * 0.9);

          ctx.beginPath();
          ctx.moveTo(segs[i].x, segs[i].y);
          ctx.lineTo(segs[i + 1].x, segs[i + 1].y);
          ctx.strokeStyle = def.color;
          ctx.globalAlpha = opacity * 0.95;
          ctx.lineWidth = width;
          ctx.shadowColor = def.glow;
          ctx.shadowBlur = 8 * opacity;
          ctx.stroke();
        }

        // Bright head dot
        ctx.beginPath();
        ctx.arc(segs[0].x, segs[0].y, def.thickness * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = def.color;
        ctx.globalAlpha = 1;
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = 14;
        ctx.fill();

        ctx.restore();
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
