"use client";

import { useEffect, useRef } from "react";

const SNAKE_COUNT_DESKTOP = 6;
const SNAKE_COUNT_MOBILE = 4;
const SPEED = 1.3;
const MAX_HISTORY = 120;
const MOUSE_AVOID_RADIUS = 65;
const COLORS = ["#a855f7", "#3b82f6"];

export default function SnakeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;

    class Snake {
      x: number; y: number;
      vx: number; vy: number;
      history: { x: number; y: number }[];
      distanceToTurn: number;
      distanceTraveled: number;
      color: string;

      constructor() {
        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.history = [];
        this.distanceToTurn = 0;
        this.distanceTraveled = 0;
        this.color = "";
        this.reset();
      }

      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        this.vx = d[0] * SPEED;
        this.vy = d[1] * SPEED;
        this.history = [];
        this.distanceToTurn = 250 + Math.random() * 200;
        this.distanceTraveled = 0;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      }

      turn(forced = false) {
        const horizontal = this.vx !== 0;
        const { x: mx, y: my } = mouseRef.current;

        if (forced) {
          if (horizontal) {
            this.vx = 0;
            this.vy = my > this.y ? -SPEED : SPEED;
          } else {
            this.vy = 0;
            this.vx = mx > this.x ? -SPEED : SPEED;
          }
          this.distanceToTurn = 100;
        } else {
          if (horizontal) {
            this.vx = 0;
            this.vy = Math.random() > 0.5 ? SPEED : -SPEED;
          } else {
            this.vy = 0;
            this.vx = Math.random() > 0.5 ? SPEED : -SPEED;
          }
          this.distanceToTurn = 250 + Math.random() * 200;
        }
        this.distanceTraveled = 0;
      }

      move() {
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > MAX_HISTORY) this.history.shift();

        const { x: mx, y: my } = mouseRef.current;
        const dist = Math.sqrt((this.x - mx) ** 2 + (this.y - my) ** 2);
        if (dist < MOUSE_AVOID_RADIUS) this.turn(true);

        this.x += this.vx;
        this.y += this.vy;
        this.distanceTraveled += SPEED;

        if (this.distanceTraveled >= this.distanceToTurn) this.turn();

        // Wrap around
        if (this.x < 0)  { this.x = W; this.history = []; }
        else if (this.x > W) { this.x = 0; this.history = []; }
        if (this.y < 0)  { this.y = H; this.history = []; }
        else if (this.y > H) { this.y = 0; this.history = []; }
      }

      draw() {
        if (this.history.length < 2) return;
        ctx.beginPath();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
          ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
      }
    }

    let snakes: Snake[] = [];

    const init = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const count = W < 1025 ? SNAKE_COUNT_MOBILE : SNAKE_COUNT_DESKTOP;
      snakes = Array.from({ length: count }, () => new Snake());
    };

    init();
    window.addEventListener("resize", init);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => { mouseRef.current = { x: -1000, y: -1000 }; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      for (const snake of snakes) {
        snake.move();
        snake.draw();
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent), linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent), linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    />
  );
}
