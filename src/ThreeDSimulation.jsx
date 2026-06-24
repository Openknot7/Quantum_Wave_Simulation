import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  clamp01,
  energyFromWaveNumber,
  normalEnergy,
  rectangularTransmission,
  tunnelingKappa,
} from './physics.js';

const QUALITY_PROFILES = {
  lowPower: {
    id: 'lowPower',
    label: 'Low power',
    particleCount: 700,
    maxPixelRatio: 0.55,
    antialias: false,
    sphereSegments: [16, 10],
    wireSegments: [10, 6],
  },
  performance: {
    id: 'performance',
    label: 'Performance',
    particleCount: 1400,
    maxPixelRatio: 0.7,
    antialias: false,
    sphereSegments: [20, 12],
    wireSegments: [12, 8],
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    particleCount: 3200,
    maxPixelRatio: 1,
    antialias: false,
    sphereSegments: [30, 20],
    wireSegments: [18, 10],
  },
  quality: {
    id: 'quality',
    label: 'Quality',
    particleCount: 6800,
    maxPixelRatio: 1.5,
    antialias: true,
    sphereSegments: [44, 28],
    wireSegments: [24, 14],
  },
};

const VERTEX_SHADER = `
  attribute float aAccept;
  attribute float aLobe;

  uniform float uTime;
  uniform float uSpread;
  uniform float uAngle;
  uniform float uBarrierHalf;
  uniform float uGeometry;
  uniform float uOrbital;
  uniform float uTransmission;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float progress = mod(position.x * 18.0 + uTime * 1.45, 18.0) - 9.0;
    float transverseY = position.y * uSpread;
    float transverseZ = position.z * uSpread;

    if (uOrbital > 0.5 && uOrbital < 1.5) {
      transverseY = sign(aLobe - 0.5) * (0.65 + abs(transverseY));
      transverseZ *= 0.58;
    } else if (uOrbital >= 1.5) {
      float lobe = floor(aLobe * 4.0);
      float signY = lobe < 2.0 ? -1.0 : 1.0;
      float signZ = mod(lobe, 2.0) < 1.0 ? -1.0 : 1.0;
      transverseY = signY * (0.55 + abs(transverseY) * 0.72);
      transverseZ = signZ * (0.55 + abs(transverseZ) * 0.72);
    }

    float accepted = step(aAccept, uTransmission);
    float reflected = 0.0;
    float inside = 0.0;
    vec3 worldPosition = vec3(progress, transverseY, transverseZ);

    if (uGeometry > 0.5) {
      float radiusSquared = 5.5225;
      float impactSquared = transverseY * transverseY + transverseZ * transverseZ;
      float intersects = step(impactSquared, radiusSquared);
      float contactDistance = sqrt(max(0.0, radiusSquared - impactSquared));
      float contact = -contactDistance;
      reflected = intersects * (1.0 - accepted) * step(contact, progress);

      if (reflected > 0.5) {
        worldPosition.x = contact - (progress - contact);
      } else {
        inside = intersects * step(abs(progress), contactDistance);
      }
    } else {
      float cosine = cos(uAngle);
      float sine = sin(uAngle);
      float contact = (transverseY * sine - uBarrierHalf) / max(0.2, cosine);
      reflected = (1.0 - accepted) * step(contact, progress);

      if (reflected > 0.5) {
        float distance = progress - contact;
        worldPosition.x = -uBarrierHalf - distance * cosine;
        worldPosition.y = contact * sine + transverseY * cosine + distance * sine;
      } else {
        worldPosition.x = progress * cosine - transverseY * sine;
        worldPosition.y = progress * sine + transverseY * cosine;
        inside = step(abs(worldPosition.x), uBarrierHalf);
      }
    }

    if (inside > 0.5) {
      vColor = vec3(1.0, 0.58, 0.16);
      vAlpha = 0.92;
    } else if (reflected > 0.5) {
      vColor = vec3(1.0, 0.22, 0.45);
      vAlpha = 0.76;
    } else {
      vColor = vec3(0.12, 0.78, 0.92);
      vAlpha = 0.8;
    }

    vec4 viewPosition = modelViewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(0.32 * uPixelRatio * (220.0 / max(1.0, -viewPosition.z)), 1.0, 8.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    if (dot(offset, offset) > 0.25) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

function orbitalOverlap(orbital, angleDegrees) {
  const angle = (angleDegrees * Math.PI) / 180;
  if (orbital === 'p') return 0.2 + 0.8 * Math.abs(Math.cos(angle));
  if (orbital === 'd') return 0.25 + 0.75 * Math.cos(2 * angle) ** 2;
  return 1;
}

function modelStats(params, time) {
  const energy = energyFromWaveNumber(params.k0);
  const perpendicularEnergy = params.geometry === 'sphere'
    ? energy
    : normalEnergy(energy, params.angle);
  const baseTransmission = rectangularTransmission(
    perpendicularEnergy,
    params.barrierHeight,
    params.barrierWidth,
  );
  const overlap = orbitalOverlap(params.orbital, params.angle);
  const transmission = clamp01(baseTransmission * overlap);
  return {
    time,
    energy,
    perpendicularEnergy,
    transmission,
    reflection: 1 - transmission,
    kappa: tunnelingKappa(perpendicularEnergy, params.barrierHeight),
    overlap,
    angle: params.angle,
  };
}

function gaussian(seedA, seedB) {
  return Math.sqrt(-2 * Math.log(Math.max(0.0001, seedA))) * Math.cos(2 * Math.PI * seedB);
}

function createParticleGeometry(particleCount) {
  const positions = new Float32Array(particleCount * 3);
  const acceptance = new Float32Array(particleCount);
  const lobes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i += 1) {
    const seedA = Math.random();
    const seedB = Math.random();
    const seedC = Math.random();
    const index = i * 3;
    positions[index] = Math.random();
    positions[index + 1] = gaussian(seedA, seedB);
    positions[index + 2] = gaussian(seedC, seedA);
    acceptance[i] = Math.random();
    lobes[i] = seedB;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAccept', new THREE.BufferAttribute(acceptance, 1));
  geometry.setAttribute('aLobe', new THREE.BufferAttribute(lobes, 1));
  geometry.attributes.position.setUsage(THREE.StaticDrawUsage);
  geometry.attributes.aAccept.setUsage(THREE.StaticDrawUsage);
  geometry.attributes.aLobe.setUsage(THREE.StaticDrawUsage);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 22);
  return geometry;
}

function resolveProfile(requestedProfile, viewportWidth) {
  if (requestedProfile !== 'auto') {
    return QUALITY_PROFILES[requestedProfile] || QUALITY_PROFILES.performance;
  }

  const processorCount = navigator.hardwareConcurrency || 4;
  const deviceMemory = navigator.deviceMemory || 4;
  const constrainedDevice = viewportWidth < 720 || processorCount <= 4 || deviceMemory <= 4;
  return constrainedDevice ? QUALITY_PROFILES.performance : QUALITY_PROFILES.balanced;
}

function orbitalCode(orbital) {
  if (orbital === 'p') return 1;
  if (orbital === 'd') return 2;
  return 0;
}

function estimateRenderMemoryMiB(renderer, particleCount) {
  const framebufferBytes = renderer.domElement.width * renderer.domElement.height * 12;
  const particleBytes = particleCount * 5 * Float32Array.BYTES_PER_ELEMENT;
  return (framebufferBytes + particleBytes) / (1024 * 1024);
}

export default function ThreeDSimulation({ isPlaying, params, resetToken, onStats }) {
  const viewportRef = useRef(null);
  const performanceLabelRef = useRef(null);
  const runtimeRef = useRef(null);
  const paramsRef = useRef(params);
  const playingRef = useRef(isPlaying);
  const onStatsRef = useRef(onStats);
  const requestedProfile = params.renderQuality || 'auto';

  paramsRef.current = params;
  playingRef.current = isPlaying;
  onStatsRef.current = onStats;

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return undefined;

    let activeProfile = resolveProfile(requestedProfile, host.clientWidth);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d13);
    scene.fog = new THREE.FogExp2(0x090d13, 0.035);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(11, 7.5, 12);

    const renderer = new THREE.WebGLRenderer({
      antialias: activeProfile.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 7;
    controls.maxDistance = 28;
    controls.target.set(0, 0, 0);

    const floor = new THREE.GridHelper(24, 24, 0x31505a, 0x1a272d);
    floor.position.y = -3.4;
    scene.add(floor);

    const axisMaterial = new THREE.LineBasicMaterial({
      color: 0x60747d,
      transparent: true,
      opacity: 0.4,
    });
    const axisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-10, 0, 0),
      new THREE.Vector3(10, 0, 0),
    ]);
    scene.add(new THREE.Line(axisGeometry, axisMaterial));

    const barrierGroup = new THREE.Group();
    scene.add(barrierGroup);

    const uniforms = {
      uTime: { value: 0 },
      uSpread: { value: paramsRef.current.sigma },
      uAngle: { value: (paramsRef.current.angle * Math.PI) / 180 },
      uBarrierHalf: { value: paramsRef.current.barrierWidth / 2 },
      uGeometry: { value: paramsRef.current.geometry === 'sphere' ? 1 : 0 },
      uOrbital: { value: orbitalCode(paramsRef.current.orbital) },
      uTransmission: { value: 0 },
      uPixelRatio: { value: 1 },
    };

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
      precision: 'mediump',
    });
    const particles = new THREE.Points(
      createParticleGeometry(activeProfile.particleCount),
      particleMaterial,
    );
    particles.frustumCulled = false;
    scene.add(particles);

    const runtime = {
      renderer,
      controls,
      barrierGroup,
      particles,
      particleMaterial,
      activeProfile,
      time: 0,
      lastFrame: performance.now(),
      lastStats: 0,
      frameWindowStart: performance.now(),
      frameCount: 0,
      fps: 0,
      slowWindows: 0,
      animation: null,
      disposed: false,
      barrierKey: '',
      viewportWidth: 1,
      viewportHeight: 1,
    };
    runtimeRef.current = runtime;

    const profileName = () => (
      requestedProfile === 'auto'
        ? `Auto / ${runtime.activeProfile.label}`
        : runtime.activeProfile.label
    );

    const updatePerformanceLabel = () => {
      if (!performanceLabelRef.current) return;
      const fpsText = playingRef.current && runtime.fps >= 1
        ? `${Math.round(runtime.fps)} FPS`
        : 'Idle';
      performanceLabelRef.current.textContent =
        `${fpsText} | ${profileName()} | ${runtime.activeProfile.particleCount.toLocaleString()} particles`;
    };

    const emitStats = () => {
      onStatsRef.current({
        ...modelStats(paramsRef.current, runtime.time),
        fps: playingRef.current ? runtime.fps : 0,
        particleCount: runtime.activeProfile.particleCount,
        renderMemory: estimateRenderMemoryMiB(renderer, runtime.activeProfile.particleCount),
        renderProfile: profileName(),
      });
      updatePerformanceLabel();
    };

    const clearBarrier = () => {
      while (barrierGroup.children.length) {
        const child = barrierGroup.children[0];
        barrierGroup.remove(child);
        child.geometry?.dispose();
        child.material?.dispose();
      }
    };

    const rebuildBarrier = () => {
      const current = paramsRef.current;
      const barrierKey = `${current.geometry}:${current.barrierWidth}:${runtime.activeProfile.id}`;
      if (barrierKey === runtime.barrierKey) return;
      runtime.barrierKey = barrierKey;
      clearBarrier();

      const material = new THREE.MeshBasicMaterial({
        color: 0xf2b84b,

        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      floor.visible = runtime.activeProfile.id !== 'lowPower';

      if (current.geometry === 'sphere') {
        const [widthSegments, heightSegments] = runtime.activeProfile.sphereSegments;
        const [wireWidthSegments, wireHeightSegments] = runtime.activeProfile.wireSegments;
        barrierGroup.add(new THREE.Mesh(
          new THREE.SphereGeometry(2.35, widthSegments, heightSegments),
          material,
        ));
        if (runtime.activeProfile.id !== 'lowPower') barrierGroup.add(new THREE.LineSegments(
          new THREE.WireframeGeometry(
            new THREE.SphereGeometry(2.37, wireWidthSegments, wireHeightSegments),
          ),
          new THREE.LineBasicMaterial({
            color: 0xf4c86d,
            transparent: true,
            opacity: 0.2,
          }),
        ));
      } else {
        const slabGeometry = new THREE.BoxGeometry(current.barrierWidth, 7.2, 7.2);
        barrierGroup.add(new THREE.Mesh(slabGeometry, material));
        if (runtime.activeProfile.id !== 'lowPower') barrierGroup.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(slabGeometry),
          new THREE.LineBasicMaterial({
            color: 0xf4c86d,
            transparent: true,
            opacity: 0.56,
          }),
        ));
      }
    };

    const applyProfile = (nextProfile) => {
      if (nextProfile.id === runtime.activeProfile.id) return;
      const previousGeometry = particles.geometry;
      particles.geometry = createParticleGeometry(nextProfile.particleCount);
      previousGeometry.dispose();
      runtime.activeProfile = nextProfile;
      runtime.barrierKey = '';
      rebuildBarrier();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, nextProfile.maxPixelRatio));
      renderer.setSize(runtime.viewportWidth, runtime.viewportHeight, false);
      uniforms.uPixelRatio.value = renderer.getPixelRatio();
      updatePerformanceLabel();
    };

    const syncParameters = () => {
      const current = paramsRef.current;
      const stats = modelStats(current, runtime.time);
      uniforms.uTime.value = runtime.time;
      uniforms.uSpread.value = current.sigma;
      uniforms.uAngle.value = (current.angle * Math.PI) / 180;
      uniforms.uBarrierHalf.value = current.barrierWidth / 2;
      uniforms.uGeometry.value = current.geometry === 'sphere' ? 1 : 0;
      uniforms.uOrbital.value = orbitalCode(current.orbital);
      uniforms.uTransmission.value = stats.transmission;
      rebuildBarrier();
    };

    const resize = () => {
      runtime.viewportWidth = Math.max(1, host.clientWidth);
      runtime.viewportHeight = Math.min(560, Math.max(380, runtime.viewportWidth * 0.54));
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        runtime.activeProfile.maxPixelRatio,
      );
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(runtime.viewportWidth, runtime.viewportHeight, false);
      uniforms.uPixelRatio.value = pixelRatio;
      camera.aspect = runtime.viewportWidth / runtime.viewportHeight;
      camera.updateProjectionMatrix();
      runtime.requestFrame?.();
    };

    const recordPerformance = (timestamp) => {
      runtime.frameCount += 1;
      const elapsed = timestamp - runtime.frameWindowStart;
      if (elapsed < 1000) return;

      runtime.fps = (runtime.frameCount * 1000) / elapsed;
      runtime.frameCount = 0;
      runtime.frameWindowStart = timestamp;

      if (requestedProfile === 'auto') {
        const belowTarget = runtime.activeProfile.id === 'balanced'
          ? runtime.fps < 48
          : runtime.activeProfile.id === 'performance' && runtime.fps < 30;
        runtime.slowWindows = belowTarget ? runtime.slowWindows + 1 : 0;

        if (runtime.slowWindows >= 2) {
          const nextProfile = runtime.activeProfile.id === 'balanced'
            ? QUALITY_PROFILES.performance
            : QUALITY_PROFILES.lowPower;
          applyProfile(nextProfile);
          runtime.slowWindows = 0;
          runtime.frameCount = 0;
          runtime.frameWindowStart = timestamp;
        }
      }

      emitStats();
    };

    const animate = (timestamp) => {
      runtime.animation = null;
      if (runtime.disposed) return;

      const delta = Math.min(0.05, (timestamp - runtime.lastFrame) / 1000);
      runtime.lastFrame = timestamp;
      if (playingRef.current) runtime.time += delta * paramsRef.current.speed;
      uniforms.uTime.value = runtime.time;

      renderer.render(scene, camera);
      recordPerformance(timestamp);

      if (timestamp - runtime.lastStats > 250) {
        emitStats();
        runtime.lastStats = timestamp;
      }

      if (playingRef.current) runtime.requestFrame();
    };

    runtime.requestFrame = () => {
      if (runtime.disposed || runtime.animation !== null) return;
      runtime.animation = requestAnimationFrame(animate);
    };
    runtime.syncParameters = syncParameters;
    runtime.emitStats = emitStats;

    controls.addEventListener('change', runtime.requestFrame);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    syncParameters();
    emitStats();
    runtime.requestFrame();

    return () => {
      runtime.disposed = true;
      if (runtime.animation !== null) cancelAnimationFrame(runtime.animation);
      observer.disconnect();
      controls.removeEventListener('change', runtime.requestFrame);
      controls.dispose();
      clearBarrier();
      particles.geometry.dispose();
      particleMaterial.dispose();
      axisGeometry.dispose();
      axisMaterial.dispose();
      floor.geometry.dispose();
      if (Array.isArray(floor.material)) floor.material.forEach((material) => material.dispose());
      else floor.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      runtimeRef.current = null;
    };
  }, [requestedProfile]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.time = 0;
    runtime.syncParameters();
    runtime.emitStats();
    runtime.requestFrame();
  }, [params.k0, params.sigma, params.barrierHeight, params.barrierWidth, params.angle, params.geometry, params.orbital, resetToken, onStats]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.lastFrame = performance.now();
    runtime.frameWindowStart = performance.now();
    runtime.frameCount = 0;
    if (!isPlaying) runtime.fps = 0;
    runtime.emitStats();
    runtime.requestFrame();
  }, [isPlaying]);

  return (
    <div
      className="canvas-frame three-canvas"
      ref={viewportRef}
      role="img"
      aria-label="Interactive three-dimensional quantum scattering visualization"
    >
      <span className="three-performance" ref={performanceLabelRef}>Preparing renderer...</span>
    </div>
  );
}