import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import {
  Activity,
  Atom,
  Box,
  CircleDot,
  Gauge,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Waves,
} from 'lucide-react';
import OneDSimulation from './OneDSimulation.jsx';
import TwoDSimulation from './TwoDSimulation.jsx';
import { energyFromWaveNumber, formatPercent } from './physics.js';

const ThreeDSimulation = lazy(() => import('./ThreeDSimulation.jsx'));

const DEFAULTS = {
  '1d': {
    k0: 5.5,
    x0: -6.5,
    sigma: 0.7,
    barrierHeight: 38,
    barrierWidth: 1.25,
    barrierPos: 0,
    speed: 3,
  },
  '2d': {
    k0: 7,
    sigma: 1.05,
    barrierHeight: 23,
    barrierWidth: 0.65,
    angle: 25,
    impact: 0,
    geometry: 'plane',
    speed: 1,
  },
  '3d': {
    k0: 7,
    sigma: 0.85,
    barrierHeight: 26,
    barrierWidth: 0.7,
    angle: 18,
    geometry: 'slab',
    orbital: 's',
    renderQuality: 'auto',
    speed: 1,
  },
};

const MODES = [
  { id: '1d', label: '1D', detail: 'Head-on', icon: Waves },
  { id: '2d', label: '2D', detail: 'Angular', icon: Layers3 },
  { id: '3d', label: '3D', detail: 'Scattering', icon: Box },
];

const PRESETS = {
  '1d': [
    { id: 'tunnel', label: 'Tunnel', params: DEFAULTS['1d'] },
    {
      id: 'reflect',
      label: 'Reflect',
      params: { ...DEFAULTS['1d'], k0: 4, sigma: 0.75, barrierHeight: 68, barrierWidth: 1.8 },
    },
    {
      id: 'free',
      label: 'Free',
      params: { ...DEFAULTS['1d'], k0: 6.5, sigma: 0.65, barrierHeight: 0 },
    },
  ],
  '2d': [
    { id: 'normal', label: 'Normal', params: { ...DEFAULTS['2d'], angle: 0 } },
    { id: 'oblique', label: 'Oblique', params: DEFAULTS['2d'] },
    {
      id: 'ring',
      label: 'Ring',
      params: { ...DEFAULTS['2d'], geometry: 'ring', angle: 0, barrierHeight: 26, barrierWidth: 0.7 },
    },
  ],
  '3d': [
    { id: 's-wave', label: 's orbital', params: DEFAULTS['3d'] },
    {
      id: 'p-wave',
      label: 'p orbital',
      params: { ...DEFAULTS['3d'], orbital: 'p', angle: 38 },
    },
    {
      id: 'sphere',
      label: 'Sphere',
      params: { ...DEFAULTS['3d'], geometry: 'sphere', orbital: 's', angle: 0, barrierWidth: 1.5 },
    },
  ],
};

const MODE_COPY = {
  '1d': {
    eyebrow: 'One-dimensional dynamics',
    meta: ['Split-step Fourier solver', '512 spatial samples'],
    title: 'Head-on barrier interaction',
    paragraphs: [
      <>The electron is confined to the <span className="formula">x</span>-axis, so it can only propagate forward or backward.</>,
      <>For <span className="formula">E &lt; V0</span>, the wave amplitude decays inside the barrier as <span className="formula">exp(-kappa x)</span>.</>,
      <>For an opaque rectangular barrier, the transmission trend is <span className="formula">T ~ exp(-2 kappa L)</span>.</>,
    ],
  },
  '2d': {
    eyebrow: 'Two-dimensional dynamics',
    meta: ['Angular scattering field', 'x-y probability density'],
    title: 'Angles and transverse momentum',
    paragraphs: [
      <>Motion has two components. For a planar barrier, momentum parallel to the surface is conserved.</>,
      <>The barrier acts on the normal energy <span className="formula">E_perp = E cos^2(theta)</span>, so oblique incidence usually lowers transmission.</>,
      <>Curved barriers produce interference and resonant spatial patterns that do not exist in a one-dimensional line.</>,
    ],
  },
  '3d': {
    eyebrow: 'Three-dimensional dynamics',
    meta: ['Three.js scattering model', 'x-y-z probability cloud'],
    title: 'Spatial scattering and orbital overlap',
    paragraphs: [
      <>The wave occupies three spatial coordinates and can reflect, transmit, and scatter through a volume.</>,
      <>For outgoing spherical waves, amplitude falls asymptotically as <span className="formula">1/r</span> before barrier attenuation is included.</>,
      <>Transmission also depends on incidence direction and how an <span className="formula">s</span>, <span className="formula">p</span>, or <span className="formula">d</span> orbital overlaps the barrier.</>,
    ],
  },
};

function initialStats(mode, params) {
  const energy = energyFromWaveNumber(params.k0);
  if (mode === '1d') {
    return { time: 0, norm: 1, center: params.x0, leftRegion: 1, rightRegion: 0, energy };
  }
  return {
    time: 0,
    energy,
    perpendicularEnergy: energy,
    transmission: 0,
    reflection: 1,
    kappa: 0,
    angle: params.angle,
    overlap: 1,
  };
}

export default function QuantumWaveSimulation() {
  const [mode, setMode] = useState('1d');
  const [paramsByMode, setParamsByMode] = useState(DEFAULTS);
  const [activePresets, setActivePresets] = useState({ '1d': 'tunnel', '2d': 'oblique', '3d': 's-wave' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState(() => initialStats('1d', DEFAULTS['1d']));

  const params = paramsByMode[mode];
  const modeCopy = MODE_COPY[mode];
  const onStats = useCallback((nextStats) => setStats(nextStats), []);

  const diagnostics = useMemo(() => {
    if (mode === '1d') {
      const ratio = params.barrierHeight > 0 ? stats.energy / params.barrierHeight : Infinity;
      return [
        ['Norm', stats.norm?.toFixed(3) ?? '--'],
        ['Mean x', stats.center?.toFixed(2) ?? '--'],
        ['Left region', formatPercent(stats.leftRegion ?? 0)],
        ['Right region', formatPercent(stats.rightRegion ?? 0)],
        ['Energy', stats.energy?.toFixed(2) ?? '--'],
        ['E / V0', Number.isFinite(ratio) ? ratio.toFixed(2) : 'open'],
      ];
    }

    const common = [
      ['Transmission', formatPercent(stats.transmission ?? 0)],
      ['Reflection', formatPercent(stats.reflection ?? 0)],
      ['Normal E', stats.perpendicularEnergy?.toFixed(2) ?? '--'],
      ['Total E', stats.energy?.toFixed(2) ?? '--'],
    ];
    if (mode === '2d') {
      return [
        ...common,
        ['Decay kappa', stats.kappa?.toFixed(2) ?? '--'],
        ['Incidence', `${params.angle.toFixed(0)} deg`],
      ];
    }
    return [
      ...common,
      ['Frame rate', stats.fps >= 1 ? `${Math.round(stats.fps)} fps` : 'Idle'],
      ['Particles', stats.particleCount?.toLocaleString() ?? '--'],
      ['Est. GPU', stats.renderMemory ? `${stats.renderMemory.toFixed(1)} MiB` : '--'],
      ['Profile', stats.renderProfile ?? 'Auto'],
    ];
  }, [mode, params, stats]);

  const setParam = (key, value) => {
    const nextValue = typeof params[key] === 'number' ? Number(value) : value;
    setActivePresets((current) => ({ ...current, [mode]: 'custom' }));
    setParamsByMode((current) => ({
      ...current,
      [mode]: { ...current[mode], [key]: nextValue },
    }));
  };

  const selectMode = (nextMode) => {
    if (nextMode === mode) return;
    setIsPlaying(false);
    setMode(nextMode);
    setStats(initialStats(nextMode, paramsByMode[nextMode]));
    setResetToken((value) => value + 1);
  };

  const applyPreset = (preset) => {
    setIsPlaying(false);
    setActivePresets((current) => ({ ...current, [mode]: preset.id }));
    setParamsByMode((current) => ({ ...current, [mode]: { ...preset.params } }));
    setResetToken((value) => value + 1);
  };

  const reset = () => {
    setIsPlaying(false);
    setResetToken((value) => value + 1);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">{modeCopy.eyebrow}</p>
          <h1>Quantum tunneling laboratory</h1>
        </div>
        <div className="header-actions" aria-label="Simulation controls">
          <button
            className={`action-button ${isPlaying ? 'danger' : 'primary'}`}
            type="button"
            onClick={() => setIsPlaying((current) => !current)}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            <span>{isPlaying ? 'Pause' : 'Run'}</span>
          </button>
          <button className="action-button secondary" type="button" onClick={reset}>
            <RotateCcw size={18} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      <nav className="dimension-switch" aria-label="Spatial dimension">
        {MODES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={mode === item.id ? 'dimension-option active' : 'dimension-option'}
              key={item.id}
              type="button"
              onClick={() => selectMode(item.id)}
              aria-pressed={mode === item.id}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </button>
          );
        })}
      </nav>

      <main className="simulation-layout">
        <section className="viewport-shell" aria-label={`${mode.toUpperCase()} wave visualization`}>
          <div className="viewport-meta">
            <span>{modeCopy.meta[0]}</span>
            <span>{mode === '3d' ? `${params.renderQuality} render profile` : modeCopy.meta[1]}</span>
          </div>
          {mode === '1d' && (
            <OneDSimulation
              isPlaying={isPlaying}
              params={params}
              resetToken={resetToken}
              onStats={onStats}
            />
          )}
          {mode === '2d' && (
            <TwoDSimulation
              isPlaying={isPlaying}
              params={params}
              resetToken={resetToken}
              onStats={onStats}
            />
          )}
          {mode === '3d' && (
            <Suspense fallback={<div className="canvas-loading">Loading 3D renderer...</div>}>
              <ThreeDSimulation
                isPlaying={isPlaying}
                params={params}
                resetToken={resetToken}
                onStats={onStats}
              />
            </Suspense>
          )}
        </section>

        <aside className="control-panel" aria-label="Simulation parameters">
          <section className="panel-section">
            <div className="section-heading">
              <Activity size={18} />
              <span>Diagnostics</span>
            </div>
            <div className="metric-grid">
              {diagnostics.map(([label, value]) => (
                <Metric key={label} label={label} value={value} />
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <CircleDot size={18} />
              <span>Scenario</span>
            </div>
            <div className="preset-row">
              {PRESETS[mode].map((preset) => (
                <button
                  className={activePresets[mode] === preset.id ? 'preset active' : 'preset'}
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section parameter-section">
            <div className="section-heading">
              <SlidersHorizontal size={18} />
              <span>Parameters</span>
            </div>
            <ModeParameters mode={mode} params={params} setParam={setParam} />
          </section>

          <section className="panel-section compact">
            <div className="section-heading">
              <Gauge size={18} />
              <span>Run state</span>
            </div>
            <div className="state-line">
              <span className={isPlaying ? 'state-dot running' : 'state-dot'} />
              <span>{isPlaying ? 'Running' : 'Paused'}</span>
              <span className="mono">t={stats.time?.toFixed(2) ?? '0.00'}</span>
            </div>
          </section>
        </aside>
      </main>

      <section className="physics-note" aria-labelledby="physics-note-title">
        <div className="physics-note-heading">
          <Atom size={21} />
          <div>
            <p className="eyebrow">Physical interpretation</p>
            <h2 id="physics-note-title">{modeCopy.title}</h2>
          </div>
        </div>
        <div className="physics-note-copy">
          {modeCopy.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>
    </div>
  );
}

function ModeParameters({ mode, params, setParam }) {
  return (
    <>
      <ParameterControl
        label="Wave number"
        value={params.k0}
        min={1}
        max={15}
        step={0.25}
        display={params.k0.toFixed(2)}
        onChange={(value) => setParam('k0', value)}
      />
      <ParameterControl
        label={mode === '1d' ? 'Packet width' : 'Beam spread'}
        value={params.sigma}
        min={0.35}
        max={2.2}
        step={0.05}
        display={params.sigma.toFixed(2)}
        onChange={(value) => setParam('sigma', value)}
      />
      <ParameterControl
        label="Barrier height"
        value={params.barrierHeight}
        min={0}
        max={100}
        step={1}
        display={params.barrierHeight.toFixed(0)}
        onChange={(value) => setParam('barrierHeight', value)}
      />
      <ParameterControl
        label="Barrier width"
        value={params.barrierWidth}
        min={0.25}
        max={4}
        step={0.05}
        display={params.barrierWidth.toFixed(2)}
        onChange={(value) => setParam('barrierWidth', value)}
      />

      {mode === '1d' && (
        <ParameterControl
          label="Barrier center"
          value={params.barrierPos}
          min={-4}
          max={8}
          step={0.1}
          display={params.barrierPos.toFixed(1)}
          onChange={(value) => setParam('barrierPos', value)}
        />
      )}

      {mode !== '1d' && (
        <ParameterControl
          label={mode === '2d' ? 'Incidence angle' : 'Polar angle'}
          value={params.angle}
          min={0}
          max={75}
          step={1}
          display={`${params.angle.toFixed(0)} deg`}
          onChange={(value) => setParam('angle', value)}
        />
      )}

      {mode === '2d' && (
        <>
          <ParameterControl
            label="Impact offset"
            value={params.impact}
            min={-2.5}
            max={2.5}
            step={0.1}
            display={params.impact.toFixed(1)}
            onChange={(value) => setParam('impact', value)}
          />
          <SelectControl
            label="Barrier geometry"
            value={params.geometry}
            options={[['plane', 'Planar wall'], ['ring', 'Circular ring']]}
            onChange={(value) => setParam('geometry', value)}
          />
        </>
      )}

      {mode === '3d' && (
        <>
          <SelectControl
            label="Barrier geometry"
            value={params.geometry}
            options={[['slab', 'Volume slab'], ['sphere', 'Spherical volume']]}
            onChange={(value) => setParam('geometry', value)}
          />
          <SelectControl
            label="Orbital symmetry"
            value={params.orbital}
            options={[['s', 's orbital'], ['p', 'p orbital'], ['d', 'd orbital']]}
            onChange={(value) => setParam('orbital', value)}
          />
          <SelectControl
            label="Render profile"
            value={params.renderQuality}
            options={[
              ['auto', 'Auto (adaptive)'],
              ['lowPower', 'Low power (700 / 0.55x)'],
              ['performance', 'Performance (1.4K / 0.7x)'],
              ['balanced', 'Balanced (3.2K / 1x)'],
              ['quality', 'Quality (6.8K / 1.5x)'],
            ]}
            onChange={(value) => setParam('renderQuality', value)}
          />
        </>
      )}

      <ParameterControl
        label="Simulation speed"
        value={params.speed}
        min={0.5}
        max={4}
        step={0.5}
        display={`${params.speed.toFixed(1)}x`}
        onChange={(value) => setParam('speed', value)}
      />
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ParameterControl({ label, value, min, max, step, display, onChange }) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className="parameter-control">
      <span className="control-label">
        <span>{label}</span>
        <strong>{display}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ '--range-progress': `${progress}%` }}
      />
    </label>
  );
}

function SelectControl({ label, value, options, onChange }) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}