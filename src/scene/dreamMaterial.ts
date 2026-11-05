// Dream material (梦境材质): the part's Color ramp drawn as a glowing, melting gradient inside each part.
// (The screen version is Effects.tsx. Difference: a material can only color the pixels its own part covers, so it
//  can't blur across parts or spill onto the background. The halo shell below fakes that spill.)
//
// Per pixel:  t = spot on the part's ramp from Material → Color "By" (glsl.ts partRaw: along / up / facing / noise /
//                 piece; "Part" falls back to facing = 0 where the surface faces the camera, 1 at the silhouette)
//             t += flow × moving noise           (melted, wobbly bands)
//             t  → the Color's repeat (ping-pong) (contour rings)
//             r, g, b read the ramp at t ± fringe (rainbow edges)
// Halo shell: a second, slightly enlarged copy of the petal drawn behind/around it, transparent, brightest where
// it faces the camera and fading to nothing at its edge → a soft glow that reaches past the petal outline.
//
// Works with InstancedMesh: three.js adds USE_INSTANCING and the instanceMatrix attribute to ShaderMaterials,
// and the <project_vertex>/<defaultnormal_vertex> chunks apply it.
import * as THREE from "three";
import type { ColorSpec, DreamSpec } from "../plant/spec";
import { PART_COLOR } from "./glsl";
import { partColorUniforms } from "./partColor";

const vertexShader = /* glsl */ `
#include <common>
attribute float aAlong;  // base → tip (see partColor.ts)
attribute vec2 aPiece;   // piece start, spot across the piece
uniform vec3 uCenter;    // halo shell grows around this point
uniform float uInflate;  // halo shell size (0 for the part itself)
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObj;
varying vec3 vObjN;
varying float vAlong;
varying vec2 vPiece;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  transformed = uCenter + (transformed - uCenter) * (1.0 + uInflate);
  #include <project_vertex>
  vNormalV = normalize(transformedNormal);
  vViewPos = -mvPosition.xyz;
  vObj = position;
  vObjN = objectNormal;
  vAlong = aAlong;
  vPiece = aPiece;
}`;

const fragmentShader = /* glsl */ `
uniform float uFringe, uFlow, uTime, uEdge, uOpacity;
uniform float uHalo;      // 1 = this is the halo shell pass
uniform vec3 uHaloColor;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObj;
varying vec3 vObjN;
varying float vAlong;
varying vec2 vPiece;
${PART_COLOR}
void main() {
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(vViewPos);
  float facing = abs(dot(n, v)); // 1 = faces the camera, 0 = edge-on (abs: petals are seen from both sides)

  if (uHalo > 0.5) {
    gl_FragColor = vec4(uHaloColor, pow(facing, 2.0) * uOpacity);
    #include <colorspace_fragment>
    return;
  }

  float t = partRaw(vAlong, vPiece, normalize(vObjN), vObj, facing);
  t += uFlow * (noise3(vObj * uPcScale * 1.7 + vec3(0.0, uTime, uTime * 0.6)) - 0.5);

  float d = uFringe * 0.08;
  vec3 col = vec3(partColor(t - d).r, partColor(t).g, partColor(t + d).b);
  float alpha = uEdge > 0.0 ? smoothstep(0.0, uEdge, facing) : 1.0;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export interface DreamPartInfo {
  /** The part's Color (ramp + what drives it). */
  color: ColorSpec;
  /** Size of the part (its length), for the noise scale. */
  size: number;
  doubleSide?: boolean;
  /** Center to grow the halo shell around; set together with halo = true. */
  center?: THREE.Vector3;
  halo?: boolean;
}

export function makeDreamMaterial(d: DreamSpec, part: DreamPartInfo): THREE.ShaderMaterial {
  const halo = !!part.halo;
  const fade = !halo && d.edge > 0;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: part.doubleSide || halo ? THREE.DoubleSide : THREE.FrontSide,
    transparent: halo || fade,
    depthWrite: !(halo || fade), // see-through surfaces shouldn't hide what's behind them
    toneMapped: false, // keep the ramp colors exactly as picked
    uniforms: {
      ...partColorUniforms(part.color, part.size),
      uCenter: { value: part.center ?? new THREE.Vector3() },
      uInflate: { value: halo ? d.halo : 0 },
      uFringe: { value: d.fringe },
      uFlow: { value: d.flow },
      uTime: { value: 0 },
      uEdge: { value: d.edge },
      uOpacity: { value: d.haloOpacity },
      uHalo: { value: halo ? 1 : 0 },
      uHaloColor: { value: new THREE.Color(d.haloColor) }, // linear; colorspace_fragment converts back
    },
  });
}

/** Geometry center for the halo shell. */
export function geometryCenter(g: THREE.BufferGeometry): THREE.Vector3 {
  g.computeBoundingBox();
  return g.boundingBox!.getCenter(new THREE.Vector3());
}
