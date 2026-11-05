// Pearl look (珍珠风格化): a "matcap" painted on a canvas.
// A matcap is a picture of a lit ball. MeshMatcapMaterial colors every surface point by looking up the spot
// on that ball that faces the same way, so whatever light we paint here is how the whole plant looks.
// No scene lights are used: the light is "painted", which gives a stylized, illustration-like result.
//
// Painting order for each pixel of the ball (normal n, light direction L, d = n·L):
//   shadow → body (by d) → glow band just outside the highlight → highlight → white core,
//   then the glow color on the rim (edges facing away from the camera).
import * as THREE from "three";
import type { LookSpec } from "../plant/spec";

const SIZE = 256;

export function paintMatcap(look: LookSpec, size = SIZE): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  const hex = (h: string) => new THREE.Color(h); // three stores these in linear space; mixed there, written back as sRGB
  const shadow = hex(look.shadow), body = hex(look.body), glow = hex(look.glow), hi = hex(look.highlight);
  const white = new THREE.Color(1, 1, 1);
  const c = new THREE.Color();
  const out = new THREE.Color();

  // Light comes from the front, tilted toward lightAngle (90° = top of the screen).
  const a = THREE.MathUtils.degToRad(look.lightAngle);
  const L = new THREE.Vector3(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.8).normalize();

  const s = look.highlightSize;
  const w = 0.03 + look.softness * 0.25; // width of every color transition
  const edge = 1 - s; // d above this = inside the highlight
  const smooth = THREE.MathUtils.smoothstep;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = ((px + 0.5) / size) * 2 - 1;
      const ny = 1 - ((py + 0.5) / size) * 2;
      const r2 = nx * nx + ny * ny;
      const i = (py * size + px) * 4;
      if (r2 > 1) {
        img.data[i + 3] = 0;
        continue;
      }
      const nz = Math.sqrt(1 - r2);
      const d = nx * L.x + ny * L.y + nz * L.z;

      c.copy(shadow).lerp(body, smooth(d, -0.4, 0.35));
      c.lerp(glow, smooth(d, edge - 0.35 - w, edge - 0.05) * 0.9); // glow band around the highlight
      c.lerp(hi, smooth(d, edge - w * 0.5, edge + w * 0.5)); // highlight
      c.lerp(white, smooth(d, 1 - s * 0.3 - w * 0.2, 1 - s * 0.12) * 0.85); // bright core
      c.lerp(glow, Math.pow(1 - nz, 2.2) * look.rim); // rim

      out.copy(c).convertLinearToSRGB();
      img.data[i] = Math.round(THREE.MathUtils.clamp(out.r, 0, 1) * 255);
      img.data[i + 1] = Math.round(THREE.MathUtils.clamp(out.g, 0, 1) * 255);
      img.data[i + 2] = Math.round(THREE.MathUtils.clamp(out.b, 0, 1) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function makeMatcapTexture(look: LookSpec): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(paintMatcap(look));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
