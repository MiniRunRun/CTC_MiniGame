// Screen effects (后期效果), drawn after the 3D scene. Only mounted when effect.mode !== "none".
//
// Dream 梦境 (from the user's reference image: melted shapes, pink halos, white background, rainbow fringes):
//   1. render the scene into a texture (RenderPass)
//   2. blur it a lot (separable Gaussian, horizontal + vertical, a few rounds) → shapes melt, edges get halos
//   3. gradient map: brightness → a 5-color ramp (optionally repeated = contour rings),
//      sampled 3 times with small offsets for color fringes, plus film grain. Writes sRGB straight to the screen.
// Uses three.js' own EffectComposer; no extra library.
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { usePlant } from "../state/store";
import { HASH, PINGPONG, rampN } from "./glsl";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** 9-tap Gaussian along `dir` (in UV units per tap). */
const BlurShader = {
  uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main() {
  float w[5] = float[](0.2270, 0.1945, 0.1216, 0.0541, 0.0162);
  vec4 c = texture2D(tDiffuse, vUv) * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture2D(tDiffuse, vUv + dir * float(i)) * w[i];
    c += texture2D(tDiffuse, vUv - dir * float(i)) * w[i];
  }
  gl_FragColor = c;
}`,
};

const RampShader = {
  uniforms: {
    tDiffuse: { value: null },
    ramp: { value: Array.from({ length: 5 }, () => new THREE.Vector3()) },
    contrast: { value: 1 },
    offset: { value: 0 },
    repeat: { value: 1 },
    aberration: { value: 0 },
    grain: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform vec3 ramp[5];
uniform float contrast, offset, repeat, aberration, grain, time;
varying vec2 vUv;
${HASH}
${PINGPONG}
${rampN("ramp", "5.0")}

// Brightness (perceptual, 0–1) → position on the ramp.
float level(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  float l = pow(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0), 1.0 / 2.2);
  l = clamp((l - 0.5) * contrast + 0.5 + offset, 0.0, 1.0);
  return pingpong(l, repeat); // repeat as 0→1→0… so neighbouring rings blend instead of jumping
}

void main() {
  // Colour fringes: red and blue read the image slightly shifted away from the centre.
  vec2 d = (vUv - 0.5) * aberration * 0.025;
  vec3 col = vec3(rampColor(level(vUv + d)).r, rampColor(level(vUv)).g, rampColor(level(vUv - d)).b);
  col += (hash21(vUv * 1000.0 + time) - 0.5) * grain * 0.15;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0); // already sRGB: the ramp colours are given in sRGB
}`,
};

const BLUR_ROUNDS = 3;

export default function Effects() {
  const { gl, scene, camera, size } = useThree();
  const fx = usePlant((s) => s.spec.effect);

  const chain = useMemo(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const blurs: ShaderPass[] = [];
    for (let i = 0; i < BLUR_ROUNDS * 2; i++) {
      const p = new ShaderPass(BlurShader);
      blurs.push(p);
      composer.addPass(p);
    }
    const ramp = new ShaderPass(RampShader);
    composer.addPass(ramp);
    return { composer, blurs, ramp };
  }, [gl, scene, camera]);

  useEffect(() => () => chain.composer.dispose(), [chain]);

  useEffect(() => {
    chain.composer.setPixelRatio(gl.getPixelRatio());
    chain.composer.setSize(size.width, size.height);
  }, [chain, gl, size]);

  // Settings → uniforms.
  useEffect(() => {
    // Blur radius grows with the slider; it's relative to screen height so it looks the same at any size.
    const stepPx = fx.blur * size.height * 0.012;
    chain.blurs.forEach((p, i) => {
      const s = stepPx * (1 + Math.floor(i / 2) * 0.5); // later rounds reach further
      p.uniforms.dir.value.set(i % 2 === 0 ? s / size.width : 0, i % 2 === 0 ? 0 : s / size.height);
      p.enabled = fx.blur > 0;
    });
    const u = chain.ramp.uniforms;
    const c = new THREE.Color();
    fx.ramp.forEach((hex, i) => {
      c.setStyle(hex, THREE.SRGBColorSpace);
      const srgb = c.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
      u.ramp.value[i].set(srgb.r, srgb.g, srgb.b);
    });
    u.contrast.value = fx.contrast;
    u.offset.value = fx.offset;
    u.repeat.value = fx.repeat;
    u.aberration.value = fx.aberration;
    u.grain.value = fx.grain;
  }, [chain, fx, size]);

  // Priority 1 = we draw the frame instead of react-three-fiber's default render.
  useFrame((state) => {
    chain.ramp.uniforms.time.value = state.clock.elapsedTime % 100;
    chain.composer.render();
  }, 1);

  return null;
}
