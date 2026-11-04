// Drawing pad (自由绘画): the player draws an outline; it becomes the part's 3D shape.
// Shows the current shape (preset or drawn) as a filled silhouette, base at the bottom, tip at the top.
// Each finished stroke is converted with strokesToProfile() and sent to onDraw right away.
// Several strokes add up (e.g. one per side) until Clear.
import { useEffect, useRef } from "react";
import { strokesToProfile, type Point } from "../plant/profile";

const W = 240; // CSS pixels; the canvas is drawn at devicePixelRatio for sharpness
const H = 150;
const PAD = 10;

interface DrawPadProps {
  /** Half-width (fraction of length) at v, for the silhouette preview. */
  width: (v: number) => number;
  color: string;
  onDraw: (profile: number[]) => void;
}

export default function DrawPad({ width, color, onDraw }: DrawPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Center line (the mirror axis) and base line.
    const axis = W / 2;
    const len = H - PAD * 2;
    const base = H - PAD;
    ctx.strokeStyle = "#3a3d44";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(axis, PAD);
    ctx.lineTo(axis, base);
    ctx.stroke();
    ctx.setLineDash([]);

    // Silhouette of the current shape: right side up from the base, left side back down.
    const steps = 80;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const v = i / steps;
      ctx.lineTo(axis + width(v) * len, base - v * len);
    }
    for (let i = steps; i >= 0; i--) {
      const v = i / steps;
      ctx.lineTo(axis - width(v) * len, base - v * len);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // The player's own strokes, on top.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      ctx.beginPath();
      s.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  };

  // Redraw whenever the shape or its color changes.
  useEffect(redraw);

  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Keep receiving moves if the pen leaves the pad mid-stroke. Can throw for unusual pointers; drawing still works.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    drawing.current = true;
    strokes.current.push([toPoint(e)]);
    redraw();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    strokes.current[strokes.current.length - 1].push(toPoint(e));
    redraw();
  };
  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const profile = strokesToProfile(strokes.current, W / 2);
    if (profile) onDraw(profile);
    redraw();
  };

  const clear = () => {
    strokes.current = [];
    redraw();
  };

  return (
    <div className="drawpad">
      <canvas
        ref={canvasRef}
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Drawing pad: draw an outline, base at the bottom, tip at the top"
      />
      <div className="drawpad-bar">
        <span className="hint">Draw ✎ base ↓ tip ↑ · mirrored</span>
        <button type="button" className="ghost" onClick={clear}>Clear 清除</button>
      </div>
    </div>
  );
}
