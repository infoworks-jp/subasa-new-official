import {
  ACESFilmicToneMapping,
  Color,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Timer,
  Vector2,
} from 'https://esm.sh/three@0.183.2';
import { RenderPipeline, WebGPURenderer } from 'https://esm.sh/three@0.183.2/webgpu';
import { pass, uniform } from 'https://esm.sh/three@0.183.2/tsl';
import {
  attachPointerSplats,
  FluidSimulation,
  fluidOverlay,
  simpleDistortion,
} from 'https://esm.sh/three-fluid-fx@0.1.0/tsl?deps=three@0.183.2';

const stage = document.getElementById('fluidTextStage');
if (!(stage instanceof HTMLElement)) throw new Error('Missing #fluidTextStage');

const slidePath = stage.dataset.slide || 'assets/susukino-top.webp';
const logoPath = stage.dataset.logo || 'assets/tsubasa-logo.svg';

if (!('gpu' in navigator)) {
  stage.classList.add('webgpu-unavailable');
  throw new Error('WebGPU unavailable: three-fluid-fx TSL requires WebGPU');
}

const CAMERA_FOV = 45;
const CAMERA_Z = 6.4;
const FIXED_FLUID_DT = 1 / 60;
const MAX_FLUID_SUBSTEPS = 4;

const renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(new Color('#050303'), 1);
renderer.domElement.id = 'fluidTextCanvas';
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.inset = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.touchAction = 'none';
stage.replaceChildren(renderer.domElement);
await renderer.init();

const scene = new Scene();
const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
camera.position.set(0, 0, CAMERA_Z);
camera.updateMatrixWorld(true);

const loader = new TextureLoader();
const [slideTexture, logoTexture] = await Promise.all([
  loader.loadAsync(slidePath),
  loader.loadAsync(logoPath),
]);
slideTexture.colorSpace = SRGBColorSpace;
slideTexture.minFilter = LinearFilter;
slideTexture.magFilter = LinearFilter;
logoTexture.colorSpace = SRGBColorSpace;
logoTexture.minFilter = LinearFilter;
logoTexture.magFilter = LinearFilter;

const bgMaterial = new MeshBasicMaterial({ map: slideTexture, toneMapped: false });
const bgMesh = new Mesh(new PlaneGeometry(1, 1), bgMaterial);
bgMesh.position.z = 0;
scene.add(bgMesh);

const logoMaterial = new MeshBasicMaterial({
  map: logoTexture,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});
const logoMesh = new Mesh(new PlaneGeometry(1, 1), logoMaterial);
logoMesh.position.z = 0.12;
scene.add(logoMesh);

const fluid = new FluidSimulation(renderer, {
  profile: 'balanced',
  splatRadius: 14 * 0.001,
  splatForce: 7,
  pressureIterations: 10,
  curlStrength: 0.18,
  velocityDissipation: 0.99,
  densityDissipation: 0.94,
  pressureDissipation: 0.8,
  enableVorticity: false,
  bfecc: true,
  reflectWalls: false,
});
fluid.enableDye = true;
fluid.dyeDissipation = 0.965;

const distortionIntensity = uniform(0.52);
const overlayIntensity = uniform(0.68);
const overlayOpacity = uniform(0.38);
const overlayVelocityScale = uniform(1.0);
const elapsedTime = uniform(0);
const dyeTexel = uniform(new Vector2(1 / 512, 1 / 512));
const cursorColor = uniform(new Color(0.88, 0.95, 1));
const vibrance = uniform(0.42);

const scenePass = pass(scene, camera);
let output = simpleDistortion(scenePass, fluid.densityNode, distortionIntensity);
output = fluidOverlay(
  'artInk',
  output,
  fluid.densityNode,
  fluid.dyeNode,
  fluid.velocityNode,
  {
    intensity: overlayIntensity,
    opacity: overlayOpacity,
    time: elapsedTime,
    texel: dyeTexel,
    cursorColor,
    vibrance,
    velocityScale: overlayVelocityScale,
  },
);

const pipeline = new RenderPipeline(renderer);
pipeline.outputNode = output;
pipeline.needsUpdate = true;

const detachPointerSplats = attachPointerSplats(renderer.domElement, fluid, {
  coloredStrokes: true,
});

function getWorldViewport() {
  const height = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
  return { height, width: height * camera.aspect };
}

function textureAspect(texture) {
  const image = texture.image;
  const w = image?.naturalWidth || image?.videoWidth || image?.width || 1;
  const h = image?.naturalHeight || image?.videoHeight || image?.height || 1;
  return w / h;
}

function fitCover(mesh, texture, viewport) {
  const imageAspect = textureAspect(texture);
  const viewportAspect = viewport.width / viewport.height;
  let width = viewport.width;
  let height = viewport.height;
  if (imageAspect > viewportAspect) width = viewport.height * imageAspect;
  else height = viewport.width / imageAspect;
  mesh.scale.set(width, height, 1);
}

function fitLogo(viewport) {
  const aspect = textureAspect(logoTexture);
  const mobile = stage.clientWidth <= 700;
  const targetHeight = viewport.height * (mobile ? 0.70 : 0.76);
  const targetWidth = targetHeight * aspect;
  const maxWidth = viewport.width * (mobile ? 0.62 : 0.48);
  const scale = targetWidth > maxWidth ? maxWidth / targetWidth : 1;
  logoMesh.scale.set(targetWidth * scale, targetHeight * scale, 1);
  logoMesh.position.set(0, mobile ? -0.02 : 0, 0.12);
}

function syncDyeTexel() {
  const image = fluid.dyeTexture.image;
  const w = image.width ?? 512;
  const h = image.height ?? 512;
  dyeTexel.value.set(1 / w, 1 / h);
}

function resize() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.set(0, 0, CAMERA_Z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  fluid.resize(width, height);
  syncDyeTexel();
  const viewport = getWorldViewport();
  fitCover(bgMesh, slideTexture, viewport);
  fitLogo(viewport);
}

resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

const clock = new Timer();
let fluidAccumulator = 0;
let frame = 0;

renderer.setAnimationLoop(() => {
  clock.update();
  const frameDt = Math.min(
    Math.max(clock.getDelta(), 1e-6),
    FIXED_FLUID_DT * MAX_FLUID_SUBSTEPS,
  );
  elapsedTime.value = clock.getElapsed();
  fluidAccumulator += frameDt;
  let substeps = 0;
  while (fluidAccumulator >= FIXED_FLUID_DT && substeps < MAX_FLUID_SUBSTEPS) {
    fluid.step(FIXED_FLUID_DT);
    fluidAccumulator -= FIXED_FLUID_DT;
    substeps += 1;
  }
  if (substeps === MAX_FLUID_SUBSTEPS) fluidAccumulator = 0;
  pipeline.render();
  frame += 1;
  window.__tsubasaFluid = {
    frame,
    engine: 'three-fluid-fx',
    renderer: 'WebGPU',
    slide: slidePath,
    logo: logoPath,
    distortion: true,
    pointer: true,
  };
});

window.addEventListener('pagehide', () => {
  renderer.setAnimationLoop(null);
  window.removeEventListener('resize', resize);
  window.visualViewport?.removeEventListener('resize', resize);
  detachPointerSplats?.();
  bgMaterial.dispose();
  logoMaterial.dispose();
  bgMesh.geometry.dispose();
  logoMesh.geometry.dispose();
  slideTexture.dispose();
  logoTexture.dispose();
  fluid.dispose?.();
  renderer.dispose();
}, { once: true });
