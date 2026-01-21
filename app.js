const { useState, useEffect, useRef } = React;

const Play = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
);

const Pause = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
);

const RotateCcw = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"></polyline>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
    </svg>
);

const Settings = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6"></path>
        <path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24"></path>
        <path d="M1 12h6m6 0h6"></path>
        <path d="m4.93 19.07 4.24-4.24m5.66-5.66 4.24-4.24"></path>
    </svg>
);

// INITIAL DEFAULTS 
const INITIAL_PARAMS = {
    nx: 400,
    dx: 0.05,
    dt: 0.002,
    hbar: 1,
    m: 1,
    k0: 3,
    x0: -6,
    sigma: 0.5,
    barrierHeight: 40,
    barrierWidth: 1.5,
    barrierPos: 0,
    speed: 1
};

const QuantumWaveSimulation = () => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const [params, setParams] = useState(INITIAL_PARAMS);

    const stateRef = useRef({
        psi_r: null,
        psi_i: null,
        V: null,
        time: 0
    });

    const paramsRef = useRef(params);

    useEffect(() => {
        paramsRef.current = params;
    }, [params]);

    useEffect(() => {
        initialize();
        draw();
    }, [params.k0, params.sigma, params.nx, params.x0, params.dx]);

    useEffect(() => {
        const { nx, dx, barrierHeight, barrierWidth, barrierPos } = params;
        const V = new Array(nx);
        const startX = -10;

        for (let i = 0; i < nx; i++) {
            const x = startX + i * dx;
            if (x > barrierPos - barrierWidth / 2 && x < barrierPos + barrierWidth / 2) {
                V[i] = barrierHeight;
            } else {
                V[i] = 0;
            }
        }

        if (stateRef.current) {
            stateRef.current.V = V;
            draw();
        }
    }, [params.barrierHeight, params.barrierPos, params.barrierWidth]);

    const initialize = () => {
        const { nx, dx, k0, x0, sigma, barrierHeight, barrierWidth, barrierPos } = params;
        const psi_r = new Array(nx);
        const psi_i = new Array(nx);
        const V = new Array(nx);
        const startX = -10;

        let norm = 0;
        for (let i = 0; i < nx; i++) {
            const x = startX + i * dx;
            const gauss = Math.exp(-Math.pow(x - x0, 2) / (2 * sigma * sigma));
            psi_r[i] = gauss * Math.cos(k0 * x);
            psi_i[i] = gauss * Math.sin(k0 * x);
            norm += psi_r[i] * psi_r[i] + psi_i[i] * psi_i[i];

            if (x > barrierPos - barrierWidth / 2 && x < barrierPos + barrierWidth / 2) {
                V[i] = barrierHeight;
            } else {
                V[i] = 0;
            }
        }

        norm = Math.sqrt(norm * dx);
        for (let i = 0; i < nx; i++) {
            psi_r[i] /= norm;
            psi_i[i] /= norm;
        }

        stateRef.current = { psi_r, psi_i, V, time: 0 };
    };

    const evolve = () => {
        const currentParams = paramsRef.current;
        const { nx, dx, dt, hbar, m } = currentParams;
        const { psi_r, psi_i, V } = stateRef.current;

        // Symplectic Staggered Integration
        for (let i = 1; i < nx - 1; i++) {
            const laplacian_r = psi_r[i + 1] - 2 * psi_r[i] + psi_r[i - 1];
            const H_psi_r = (-hbar * hbar / (2 * m)) * (laplacian_r / (dx * dx)) + V[i] * psi_r[i];
            psi_i[i] -= (dt / hbar) * H_psi_r;
        }
        psi_i[0] = psi_i[nx - 1] = 0;

        for (let i = 1; i < nx - 1; i++) {
            const laplacian_i = psi_i[i + 1] - 2 * psi_i[i] + psi_i[i - 1];
            const H_psi_i = (-hbar * hbar / (2 * m)) * (laplacian_i / (dx * dx)) + V[i] * psi_i[i];
            psi_r[i] += (dt / hbar) * H_psi_i;
        }
        psi_r[0] = psi_r[nx - 1] = 0;

        stateRef.current.time += dt;
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);

        const { psi_r, psi_i, V } = stateRef.current;
        const { nx } = paramsRef.current;

        if (!psi_r) return;

        const prob = new Array(nx);
        let maxP = 0;
        for (let i = 0; i < nx; i++) {
            prob[i] = psi_r[i] * psi_r[i] + psi_i[i] * psi_i[i];
            if (prob[i] > maxP) maxP = prob[i];
        }

        const displayMax = Math.max(maxP, 0.4);
        const maxV = 60;

        // Draw Axis
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();

        ctx.fillStyle = '#9CA3AF';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';

        const ticks = [-10, -5, 0, 5, 10];
        ticks.forEach(t => {
            const xPos = ((t + 10) / 20) * width;
            ctx.fillText(t.toString(), xPos, height - 10);
            ctx.beginPath();
            ctx.moveTo(xPos, height - 25);
            ctx.lineTo(xPos, height - 20);
            ctx.stroke();
        });

        // Draw Barrier
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        for (let i = 0; i < nx; i++) {
            if (V[i] > 0) {
                const xPixel = (i / nx) * width;
                const barH = (V[i] / maxV) * height * 0.8;
                ctx.fillRect(xPixel, height - 30 - barH, width / nx + 1, barH);
            }
        }

        // Draw Wave (CYAN Update)
        ctx.beginPath();
        ctx.strokeStyle = '#22d3ee'; // Cyan-400
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22d3ee'; // Cyan glow
        ctx.shadowBlur = 10;

        for (let i = 0; i < nx; i++) {
            const xPixel = (i / nx) * width;
            const yPixel = height - 30 - (prob[i] / displayMax) * (height - 60);

            if (i === 0) ctx.moveTo(xPixel, yPixel);
            else ctx.lineTo(xPixel, yPixel);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cyan Gradient Fill
        const gradient = ctx.createLinearGradient(0, height - 30, 0, 0);
        gradient.addColorStop(0, 'rgba(34, 211, 238, 0)'); // Cyan-400 transparent
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0.4)'); // Cyan-400 semi-transparent
        ctx.fillStyle = gradient;

        ctx.lineTo(width, height - 30);
        ctx.lineTo(0, height - 30);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#F3F4F6';
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Time: ${stateRef.current.time.toFixed(2)}`, 20, 30);
    };

    const animate = () => {
        const currentParams = paramsRef.current;
        if (currentParams.speed && currentParams.speed > 0) {
            for (let i = 0; i < currentParams.speed; i++) {
                evolve();
            }
        } else {
            evolve();
        }
        draw();
        animationRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            draw();
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying]);

    const handleReset = () => {
        setIsPlaying(false);
        setParams(INITIAL_PARAMS);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8 flex flex-col items-center justify-center font-sans text-gray-100">
            <div className="w-full max-w-5xl">
                <div className="text-center mb-8">
                    {/* Header Visiblity Fix: Lighter gradient, larger text, brighter shadow */}
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-indigo-300 mb-4 filter drop-shadow-lg tracking-tight pb-2">
                        Quantum Wave Simulation
                    </h1>
                    <p className="text-gray-400 font-medium">1D Schrödinger Equation with Tunable Potential Barrier</p>
                </div>

                <div className="bg-gray-800 bg-opacity-80 backdrop-filter backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-gray-700">

                    <div className="relative rounded-xl overflow-hidden shadow-inner border border-gray-900 bg-gray-900 mb-6">
                        <canvas
                            ref={canvasRef}
                            width={1000}
                            height={400}
                            className="w-full h-auto block"
                        />
                    </div>

                    <div className="flex justify-center gap-6 mb-8">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`flex items-center gap-3 px-8 py-3 rounded-full font-bold transition-all transform hover:scale-105 shadow-lg ${isPlaying
                                    ? 'bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-400'
                                    : 'bg-cyan-600 hover:bg-cyan-700 ring-2 ring-cyan-400'
                                }`}
                        >
                            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                            <span>{isPlaying ? 'PAUSE' : 'START SIMULATION'}</span>
                        </button>

                        <button
                            onClick={handleReset}
                            className="flex items-center gap-3 px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-lg border border-gray-600"
                        >
                            <RotateCcw size={24} />
                            <span>RESET</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-800">
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-700 pb-2">Wave Packet</h3>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-300">Initial Momentum (k₀)</label>
                                    <span className="text-xs text-cyan-300 font-mono bg-gray-800 px-2 py-0.5 rounded">{params.k0}</span>
                                </div>
                                <input
                                    type="range"
                                    min="3"
                                    max="15"
                                    step="0.5"
                                    value={params.k0}
                                    onChange={(e) => setParams({ ...params, k0: parseFloat(e.target.value) })}
                                    className="range-slider"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-300">Packet Width (σ)</label>
                                    <span className="text-xs text-cyan-300 font-mono bg-gray-800 px-2 py-0.5 rounded">{params.sigma}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={params.sigma}
                                    onChange={(e) => setParams({ ...params, sigma: parseFloat(e.target.value) })}
                                    className="range-slider"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-red-400 border-b border-gray-700 pb-2">Potential Barrier</h3>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-300">Barrier Position (x)</label>
                                    <span className="text-xs text-red-300 font-mono bg-gray-800 px-2 py-0.5 rounded">{params.barrierPos}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-8"
                                    max="8"
                                    step="0.5"
                                    value={params.barrierPos}
                                    onChange={(e) => setParams({ ...params, barrierPos: parseFloat(e.target.value) })}
                                    className="range-slider"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>-8</span>
                                    <span>0</span>
                                    <span>+8</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-300">Barrier Height (V₀)</label>
                                    <span className="text-xs text-red-300 font-mono bg-gray-800 px-2 py-0.5 rounded">{params.barrierHeight}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={params.barrierHeight}
                                    onChange={(e) => setParams({ ...params, barrierHeight: parseFloat(e.target.value) })}
                                    className="range-slider"
                                />
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-700 flex items-center gap-6">
                            <div className="flex-1">
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-300">Simulation Speed</label>
                                    <span className="text-xs text-indigo-300 font-mono bg-gray-800 px-2 py-0.5 rounded">{params.speed}x</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-gray-500">Slow</span>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="1"
                                        value={params.speed}
                                        onChange={(e) => setParams({ ...params, speed: parseInt(e.target.value) })}
                                        className="range-slider flex-1"
                                    />
                                    <span className="text-xs text-gray-500">Fast</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center text-sm text-gray-400 space-y-2">
                    <p>• The <span className="text-cyan-400 font-semibold">cyan</span> wave shows the probability density |ψ|² of finding the particle</p>
                    <p>• The <span className="text-red-400 font-semibold">red</span> barrier represents a potential energy barrier</p>
                    <p>• Watch quantum tunneling as the wave packet passes through the barrier</p>
                </div>
            </div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QuantumWaveSimulation />
    </React.StrictMode>
);
