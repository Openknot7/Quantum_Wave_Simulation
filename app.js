const { useState, useEffect, useRef } = React;

/* ================= FFT UTILITIES ================= */
function fft(re, im) {   
    const n = re.length;
    if (n <= 1) return;
    const er = new Array(n / 2), ei = new Array(n / 2);
    const or = new Array(n / 2), oi = new Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
        er[i] = re[2 * i]; ei[i] = im[2 * i];
        or[i] = re[2 * i + 1]; oi[i] = im[2 * i + 1];
    }
    fft(er, ei);
    fft(or, oi);
    for (let k = 0; k < n / 2; k++) {
        const t = -2 * Math.PI * k / n;
        const c = Math.cos(t), s = Math.sin(t);
        const tr = c * or[k] - s * oi[k];
        const ti = s * or[k] + c * oi[k];
        re[k] = er[k] + tr;
        im[k] = ei[k] + ti;
        re[k + n / 2] = er[k] - tr;
        im[k + n / 2] = ei[k] - ti;
    }
}

function ifft(re, im) {
    for (let i = 0; i < im.length; i++) im[i] *= -1;
    fft(re, im);
    const n = re.length;
    for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] = -im[i] / n;
    }
}

/* ================= PARAMETERS ================= */
const INITIAL_PARAMS = {
    nx: 512, dx: 0.05, dt: 0.002, hbar: 1, m: 1,
    k0: 5, x0: -6, sigma: 0.7,
    barrierHeight: 40, barrierWidth: 1.5, barrierPos: 0,
    speed: 2
};

const IOS_STYLES = `
    input[type="range"] { -webkit-appearance: none; width: 100%; background: transparent; margin: 10px 0; }
    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 24px; width: 24px; border-radius: 50%; background: #22d3ee; cursor: pointer; margin-top: -10px; }
    input[type="range"]::-webkit-slider-runnable-track { width: 100%; height: 5px; background: #334155; border-radius: 2px; }
    canvas { touch-action: none; -webkit-user-select: none; }
`;

/* ================= MAIN COMPONENT ================= */
const QuantumWaveSimulation = () => {
    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);
    const animationRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [params, setParams] = useState(INITIAL_PARAMS);
    const [dimensions, setDimensions] = useState({ width: 300, height: 300 });

    const paramsRef = useRef(params);
    const stateRef = useRef({ psi_r: null, psi_i: null, V: null, time: 0 });

    useEffect(() => { paramsRef.current = params; }, [params]);

    useEffect(() => {
        const handleResize = () => {
            if (wrapperRef.current) {
                const width = wrapperRef.current.offsetWidth;
                const height = Math.min(window.innerHeight * 0.5, 400); 
                setDimensions({ width, height });
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Re-initialize when parameters change
    useEffect(() => { initialize(); }, [
        params.k0, 
        params.sigma, 
        params.x0, 
        params.barrierHeight, 
        params.barrierWidth, 
        params.barrierPos 
    ]);
    
    useEffect(() => { draw(); }, [dimensions]);

    function initialize() {
        const { nx, dx, k0, x0, sigma, barrierHeight, barrierWidth, barrierPos } = paramsRef.current;
        const psi_r = new Array(nx), psi_i = new Array(nx), V = new Array(nx);
        const xStart = -10;
        let norm_val = 0;

        for (let i = 0; i < nx; i++) {
            const x = xStart + i * dx;
            const g = Math.exp(-Math.pow(x - x0, 2) / (2 * Math.pow(sigma, 2)));
            psi_r[i] = g * Math.cos(k0 * x);
            psi_i[i] = g * Math.sin(k0 * x);
            norm_val += Math.pow(psi_r[i], 2) + Math.pow(psi_i[i], 2);
            
            // Barrier Logic
            V[i] = (x > barrierPos - barrierWidth / 2 && x < barrierPos + barrierWidth / 2) ? barrierHeight : 0;
            
            // Absorbing boundary conditions (edges)
            const w = 40, eta = 0.02;
            if (i < w) V[i] += -eta * Math.pow(w - i, 2);
            if (i > nx - w) V[i] += -eta * Math.pow(i - (nx - w), 2);
        }

        const norm = Math.sqrt(norm_val * dx);
        for (let i = 0; i < nx; i++) { psi_r[i] /= norm; psi_i[i] /= norm; }
        stateRef.current = { psi_r, psi_i, V, time: 0 };
        draw();
    }

    function evolve() {
        const { nx, dx, dt, hbar, m } = paramsRef.current;
        const { psi_r, psi_i, V } = stateRef.current;
        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph), s = Math.sin(ph), r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im; psi_i[i] = s * r + c * im;
        }
        fft(psi_r, psi_i);
        for (let i = 0; i < nx; i++) {
            const k = (i < nx / 2) ? (2 * Math.PI * i) / (nx * dx) : (2 * Math.PI * (i - nx)) / (nx * dx);
            const ph = -hbar * k * k * dt / (2 * m);
            const c = Math.cos(ph), s = Math.sin(ph), r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im; psi_i[i] = s * r + c * im;
        }
        ifft(psi_r, psi_i);
        for (let i = 0; i < nx; i++) {
            const ph = -V[i] * dt / (2 * hbar);
            const c = Math.cos(ph), s = Math.sin(ph), r = psi_r[i], im = psi_i[i];
            psi_r[i] = c * r - s * im; psi_i[i] = s * r + c * im;
        }
        stateRef.current.time += dt;
    }

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas || !stateRef.current.psi_r) return;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const { width, height } = dimensions;
        const { psi_r, psi_i, V, time } = stateRef.current;
        const { nx } = paramsRef.current;

        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, width, height);

        let maxP = 0;
        const prob = new Array(nx);
        for (let i = 0; i < nx; i++) {
            prob[i] = Math.pow(psi_r[i], 2) + Math.pow(psi_i[i], 2);
            if (prob[i] > maxP) maxP = prob[i];
        }
        maxP = Math.max(maxP, 0.5);

        /* --- DRAW BARRIER --- */
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        // We use a fixed Max Height (100) for scaling so the visual barrier grows/shrinks
        const FIXED_MAX_HEIGHT_SCALE = 120; 
        
        for (let i = 0; i < nx; i++) {
            if (V[i] > 0) {
                const x = (i / nx) * width;
                // Fix: Divide by fixed scale instead of dynamic barrierHeight
                const h = (Math.abs(V[i]) / FIXED_MAX_HEIGHT_SCALE) * height;
                ctx.fillRect(x, height - h, Math.max(1, width / nx + 1), h);
            }
        }

        /* --- DRAW WAVE --- */
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < nx; i++) {
            const x = (i / nx) * width;
            const y = height - 10 - (prob[i] / maxP) * (height * 0.8);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Time: ${time.toFixed(2)}`, 15, 25);
    }

    useEffect(() => {
        const animate = () => {
            for (let i = 0; i < paramsRef.current.speed; i++) evolve();
            draw();
            animationRef.current = requestAnimationFrame(animate);
        };
        if (isPlaying) animationRef.current = requestAnimationFrame(animate);
        else cancelAnimationFrame(animationRef.current);
        return () => cancelAnimationFrame(animationRef.current);
    }, [isPlaying]);

   
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent">
                        Quantum Tunneling
                    </h2>
                    <p className="text-slate-400 text-sm">
                        Real-time Wave Packet Simulation
                    </p>
                </div>

                {/* Canvas Container */}
                <div 
                    ref={wrapperRef} 
                    className="relative w-full rounded-xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
                    style={{ boxShadow: '0 0 40px -10px rgba(34, 211, 238, 0.15)' }} // Subtle glow
                >
                    <canvas 
                        ref={canvasRef} 
                        className="block w-full h-full"
                        style={{ width: dimensions.width, height: dimensions.height }}
                    />
                    
                    {/* Overlay Stat */}
                    <div className="absolute top-4 right-4 text-xs font-mono text-cyan-400 bg-slate-900/50 px-2 py-1 rounded border border-cyan-500/50 backdrop-blur-sm">
                        T = {stateRef.current.time.toFixed(2)}
                    </div>
                </div>

                {/* Controls Container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    
                    {/* Button Group */}
                    <div className="flex gap-4 items-center justify-center md:col-span-2 pb-4 border-b border-slate-700/50">
                        <button 
                            onClick={() => setIsPlaying(!isPlaying)} 
                            className={`btn px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg ${
                                isPlaying 
                                ? 'bg-slate-800 text-red-400 border border-red-500/50 hover:bg-slate-700' 
                                : 'bg-gradient-to-r text-slate-900 hover:opacity-90'
                            }`}
                        >
                            {isPlaying ? "Pause Simulation" : "Start Simulation"}
                        </button>
                        
                        <button 
                            onClick={() => { setIsPlaying(false); initialize(); }} 
                            className="btn px-6 py-2.5 rounded-full font-medium text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent transition-all"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-6">
                        <ControlRow label="Energy (k0)" val={params.k0} min={1} max={15} step={0.5} 
                            onChange={v => setParams(p => ({...p, k0: parseFloat(v)}))} />
                        
                        <ControlRow label="Barrier Position" val={params.barrierPos} min={-5} max={10} step={0.5} 
                            onChange={v => setParams(p => ({...p, barrierPos: parseFloat(v)}))} />
                    </div>

                    <div className="space-y-6">
                        <ControlRow label="Barrier Height" val={params.barrierHeight} min={0} max={100} step={5} 
                            onChange={v => setParams(p => ({...p, barrierHeight: parseFloat(v)}))} />

                        <ControlRow label="Barrier Width" val={params.barrierWidth} min={0.5} max={5} step={0.1} 
                            onChange={v => setParams(p => ({...p, barrierWidth: parseFloat(v)}))} />
                    </div>
                </div>
            </div>
        </div>
    );
};


const ControlRow = ({ label, val, min, max, step, onChange }) => (
    <div className="group">
        <div className="flex justify-between items-center mb-2 text-sm font-medium">
            <span className="text-slate-400 group-hover:text-cyan-300 transition-colors">{label}</span>
            <span className="font-mono text-cyan-400 text-xs bg-cyan-900/20 px-2 py-0.5 rounded border border-cyan-500/30">
                {val}
            </span>
        </div>
        <input 
            type="range" 
            className="range-slider" 
            min={min} 
            max={max} 
            step={step} 
            value={val} 
            onChange={e => onChange(e.target.value)} 
        />
    </div>
);
   

/* ================= RENDER TO DOM ================= */
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<QuantumWaveSimulation />);
