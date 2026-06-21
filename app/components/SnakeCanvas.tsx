"use client";

import { useEffect, useRef } from "react";

// ─── Snake configuration ────────────────────────────────────────────────────
interface SnakeCfg {
  color: string;
  glow: string;
  segments: number;   // body length in points
  speed: number;      // px per frame
  turnAmp: number;    // max turn amplitude (radians per frame)
  turnFreq: number;   // how fast the turn oscillates (radians per frame)
  thickness: number;  // head thickness in px
  phase: number;      // sine phase offset so each snake curves differently
}

const CFGS: SnakeCfg[] = [
  { color: "#00AAFF", glow: "rgba(0,170,255,0.9)",   segments: 80, speed: 2.0, turnAmp: 0.040, turnFreq: 0.018, thickness: 3,   phase: 0.0 },
  { color: "#9B5CF6", glow: "rgba(155,92,246,0.9)",  segments: 70, speed: 1.7, turnAmp: 0.035, turnFreq: 0.022, thickness: 3,   phase: 2.1 },
  { color: "#00AAFF", glow: "rgba(0,170,255,0.85)",  segments: 65, speed: 2.4, turnAmp: 0.045, turnFreq: 0.015, thickness: 2.5, phase: 4.2 },
  { color: "#9B5CF6", glow: "rgba(155,92,246,0.85)", segments: 60, speed: 1.9, turnAmp: 0.038, turnFreq: 0.020, thickness: 2.5, phase: 1.3 },
  { color: "#00AAFF", glow: "rgba(0,170,255,0.8)",   segments: 55, speed: 2.2, turnAmp: 0.050, turnFreq: 0.025, thickness: 2,   phase: 3.5 },
  { color: "#9B5CF6", glow: "rgba(155,92,246,0.8)",  segments: 50, speed: 2.6, turnAmp: 0.042, turnFreq: 0.017, thickness: 2,   phase: 5.0 },
];

const REPULSION_RADIUS = 130; // px — how close mouse must be to deflect snake
const REPULSION_STRENGTH = 0.08; // max extra turn added when mouse is at center

interface Pt { x: number; y: number; }

interface Snake {
  cfg: SnakeCfg;
  body: Pt[];       // body[0] = head
  angle: number;    // current heading in radians
  time: number;     // internal clock for sine steering
}

function makeSnake(cfg: SnakeCfg, W: number, H: number, idx: number): Snake {
  // Spread start positions so snakes don't all overlap
  const x = W * (0.2 + (idx * 0.15) % 0.7);
  const y = H * (0.2 + (idx * 0.18) % 0.65);
  const angle = (idx * Math.PI * 2) / CFGS.length;
  const body: Pt[] = Array.from({ length: cfg.segments }, () => ({ x, y }));
  return { cfg, body, angle, time: cfg.phase * 60 };
}

export default function SnakeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    let snakes: Snake[] = [];

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    resize();
    window.addEventListener("resize", resize);

    // Init snakes after we know W/H
    snakes = CFGS.map((cfg, i) => makeSnake(cfg, W, H, i));

    // Mouse tracking — only position, no click/scroll needed
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    // ─── Main loop ──────────────────────────────────────────────────────────
    const tick = () => {
      ctx.clearRect(0, 0, W, H);

      const { x: mx, y: my } = mouseRef.current;

      for (const snake of snakes) {
        const { cfg, body } = snake;
        snake.time++;

        // ── 1. Autonomous steering: sine wave on heading ──────────────────
        //    Creates natural S-curve slithering
        snake.angle += cfg.turnAmp * Math.sin(snake.time * cfg.turnFreq);

        // ── 2. Mouse repulsion ────────────────────────────────────────────
        const head = body[0];
        const dx = head.x - mx;
        const dy = head.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPULSION_RADIUS) {
          // How strong: stronger when closer (0 at edge, 1 at center)
          const strength = (1 - dist / REPULSION_RADIUS) * REPULSION_STRENGTH;
          // Cross product z-component tells us which side mouse is on
          // heading vector: (cos(angle), sin(angle))
          // to-mouse vector: (-dx, -dy) (pointing FROM head TO mouse)
          const cross = Math.cos(snake.angle) * (-dy) - Math.sin(snake.angle) * (-dx);
          // cross > 0 → mouse is to the left of heading → turn right (increase angle)
          // cross < 0 → mouse is to the right → turn left (decrease angle)
          snake.angle += cross > 0 ? strength : -strength;
        }

        // ── 3. Move head forward in current direction ─────────────────────
        const newHead: Pt = {
          x: head.x + Math.cos(snake.angle) * cfg.speed,
          y: head.y + Math.sin(snake.angle) * cfg.speed,
        };

        // Wrap around screen edges (snake re-enters from opposite side)
        if (newHead.x < -50) newHead.x = W + 40;
        if (newHead.x > W + 50) newHead.x = -40;
        if (newHead.y < -50) newHead.y = H + 40;
        if (newHead.y > H + 50) newHead.y = -40;

        // Shift body: drop last segment, prepend new head
        body.pop();
        body.unshift(newHead);

        // ── 4. Draw tapered glowing body ──────────────────────────────────
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const n = body.length;
        for (let i = 0; i < n - 1; i++) {
          const t = i / (n - 1);              // 0=head … 1=tail
          const opacity = Math.pow(1 - t, 1.6);
          const width = cfg.thickness * (1 - t * 0.92);

          ctx.beginPath();
          ctx.moveTo(body[i].x, body[i].y);
          ctx.lineTo(body[i + 1].x, body[i + 1].y);
          ctx.strokeStyle = cfg.color;
          ctx.globalAlpha = opacity;
          ctx.lineWidth = width;
          ctx.shadowColor = cfg.glow;
          ctx.shadowBlur = 10 * opacity;
          ctx.stroke();
        }

        // Bright glowing head dot
        ctx.beginPath();
        ctx.arc(body[0].x, body[0].y, cfg.thickness * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = cfg.color;
        ctx.globalAlpha = 1;
        ctx.shadowColor = cfg.glow;
        ctx.shadowBlur = 16;
        ctx.fill();

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  );
}
