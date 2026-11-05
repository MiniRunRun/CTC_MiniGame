// Dream material (梦境材质): the "Dream" look computed inside each part, not on the whole screen.
// (The screen version is Effects.tsx. Difference: a material can only color the pixels its own part covers, so it
//  can't blur across parts or spill onto the background. The halo shell below fakes that spill.)
//
// Per pixel:  t = ramp position from the chosen input
//               facing → 0 where the surface faces the camera, 1 at the silhouette edge (Fresnel)
//               length → 0 at the petal base, 1 at the tip
//               noise  → a smooth 3D noise pattern
//             t += flow × moving noise         (melted, wobbly bands)
//             t  → ping-pong repeat             (contour rings)
//             r, g, b read the ramp at t ± fringe (rainbow edges)
// Halo shell: a second, slightly enlarged copy of the petal drawn behind/around it, transparent, brightest where
// it faces the camera and fading to nothing at its edge → a soft glow that reaches past the petal outline.
//
// Works with InstancedMesh: three.js adds USE_INSTANCING and the instanceMatrix attribute to ShaderMaterials,
// and the <project_vertex>/<defaultnormal_vertex> chunks apply it.
import * as THREE from "three";
import type { DreamSpec } from "../plant/spec";
import { HASH, NOISE, PINGPONG, ramp5 } from "./glsl";

const vertexShader = /* glsl */ `
#include <common>
uniform float uAxisLen;  // > 0: "length" input = position along +X (or radial for fused) ÷ this
uniform float uRadial;   // 1 = measure length outward from the axis (fused flowers)
uniform vec3 uCenter;    // halo shell grows around this point
uniform float uInflate;  // halo shell size (0 for the part itself)
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObj;
varying float vAlong;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  transformed = uCenter + (transformed - uCenter) * (1.0 + uInflate);
  #include <project_vertex>
  vNormalV = normalize(transformedNormal);
  vViewPos = -mvPosition.xyz;
  vObj = position;
  vAlong = uAxisLen > 0.0 ? (uRadial > 0.5 ? length(position.xz) : position.x) / uAxisLen : -1.0;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uRamp[5];
uniform int uInput;       // 0 facing, 1 length, 2 noise
uniform float uRepeat, uFringe, uFlow, uTime, uScale, uEdge, uOpacity;
uniform float uHalo;      // 1 = this is the halo shell pass
uniform vec3 uHaloColor;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObj;
varying float vAlong;

${HASH}
${NOISE}
${PINGPONG}
${ramp5("uRamp")}
void main() {
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(vViewPos);
  float facing = abs(dot(n, v)); // 1 = faces the camera, 0 = edge-on (abs: petals are seen from both sides)

  if (uHalo > 0.5) {
    gl_FragColor = vec4(uHaloColor, pow(facing, 2.0) * uOpacity);
    #include <colorspace_fragment>
    return;
  }

  float t;
  if (uInput == 1 && vAlong >= 0.0) t = vAlong;
  else if (uInput == 2) t = noise3(vObj * uScale);
  else t = 1.0 - facing;
  t += uFlow * (noise3(vObj * uScale * 1.7 + vec3(0.0, uTime, uTime * 0.6)) - 0.5);

  float d = uFringe * 0.08;
  vec3 col = vec3(rampColor(pingpong(clamp(t - d, 0.0, 1.0), uRepeat)).r,
                  rampColor(pingpong(clamp(t, 0.0, 1.0), uRepeat)).g,
                  rampColor(pingpong(clamp(t + d, 0.0, 1.0), uRepeat)).b);
  float alpha = uEdge > 0.0 ? smoothstep(0.0, uEdge, facing) : 1.0;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export interface DreamPartInfo {
  /** Size of the part, for the "length" input and the noise scale (petal length; 0 = part has no length axis). */
  axisLen: number;
  radial?: boolean;
  doubleSide?: boolean;
  /** Center to grow the halo shell around; set together with halo = true. */
  center?: THREE.Vector3;
  halo?: boolean;
}

const INPUT = { facing: 0, length: 1, noise: 2 } as const;

export function makeDreamMaterial(d: DreamSpec, part: DreamPartInfo): THREE.ShaderMaterial {
  const toLinear = (hex: string) => new THREE.Color(hex); // three keeps colors linear; colorspace_fragment converts back
  const halo = !!part.halo;
  const fade = !halo && d.edge > 0;
  const size = part.axisLen > 0 ? part.axisLen : 0.15;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: part.doubleSide || halo ? THREE.DoubleSide : THREE.FrontSide,
    transparent: halo || fade,
    depthWrite: !(halo || fade), // see-through surfaces shouldn't hide what's behind them
    toneMapped: false, // keep the ramp colors exactly as picked
    uniforms: {
      uAxisLen: { value: part.axisLen },
      uRadial: { value: part.radial ? 1 : 0 },
      uCenter: { value: part.center ?? new THREE.Vector3() },
      uInflate: { value: halo ? d.halo : 0 },
      uRamp: { value: d.ramp.map(toLinear) },
      uInput: { value: INPUT[d.input] },
      uRepeat: { value: d.repeat },
      uFringe: { value: d.fringe },
      uFlow: { value: d.flow },
      uTime: { value: 0 },
      uScale: { value: 2.5 / size }, // a few noise blobs per part, whatever its size
      uEdge: { value: d.edge },
      uOpacity: { value: d.haloOpacity },
      uHalo: { value: halo ? 1 : 0 },
      uHaloColor: { value: toLinear(d.haloColor) },
    },
  });
}

/** Geometry center for the halo shell. */
export function geometryCenter(g: THREE.BufferGeometry): THREE.Vector3 {
  g.computeBoundingBox();
  return g.boundingBox!.getCenter(new THREE.Vector3());
}
