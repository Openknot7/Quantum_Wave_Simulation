# Quantum Wave Simulation

A real-time, browser-based visualizer for the 1D Time-Dependent Schrödinger Equation. This simulation demonstrates how a quantum wave packet evolves over time and interacts with a potential energy barrier (Quantum Tunneling).

## 🚀 Features

* **Real-time Physics Engine:** Solves the Schrödinger equation using the Split-Step Fourier method (or Finite Difference approximation in this implementation).
* **Interactive Controls:** Play, Pause, and Reset the simulation instantly.
* **Dynamic Parameters:** Adjust the following in real-time:
    * **Wave Number ($k_0$):** Controls the momentum/speed of the particle.
    * **Packet Width ($\sigma$):** Controls the spread of the wave packet (Heisenberg Uncertainty Principle).
    * **Barrier Height & Position:** Create different tunneling scenarios.
* **Visualizations:**
    * **Cyan Curve:** Probability Density $|\psi(x,t)|^2$.
    * **Red Block:** Potential Energy Barrier $V(x)$.

## 🛠️ Technology Stack

* **HTML5:** Structure and Canvas API.
* **CSS3:** Styling, Flexbox/Grid layout, and responsive design.
* **JavaScript (ES6+):** Physics logic and DOM manipulation.
* **Dependencies:** None (Pure Vanilla JS).

## 📂 File Structure

```text
/quantum-simulation
│
├── index.html    # The main entry point and UI structure
├── style.css     # Styling for the dark mode UI
├── script.js     # The physics engine and animation loop
└── README.md     # Project documentation
```

# 📐 PHYSICS BACKGROUND

The simulation numerically solves the time-dependent Schrödinger equation:

$$
i\hbar \frac{\partial \psi(x,t)}{\partial t} = \left[-\frac{\hbar^2}{2m}\frac{\partial^2}{\partial x^2} + V(x)\right]\psi(x,t)
$$
- **ψ(x,t)** — wave function  
- **|ψ(x,t)|²** — probability density (visualized on screen)  
- **V(x)** — potential barrier  
- **m** — particle mass  
- **ℏ** — (reduced Planck constant) $$\approx 6.582119569 \times 10^{-16} \text{ eV}\cdot\text{s}$$, $$\ 1.054571817 \times 10^{-34} \text{ J}\cdot\text{s}$$

This equation governs the evolution of a quantum particle in space and time. Let's break it down intuitively.

---

### 1. The "Energy Balance" (Right Side)

The part inside the brackets represents the **total energy** of the particle. It has two components:

- **Kinetic Energy (The Movement)**:  
  The term with the second derivative, $\frac{\partial^2}{\partial x^2}$, measures how "curvy" the wave is.  
  - More "wiggles" (higher frequency) → more kinetic energy → faster particle movement.

- **Potential Energy (The Obstacle)**:  
  The $V(x)$ term represents the **red barrier** in your simulation.  
  - Think of it as a "tax" or cost for entering a region of space.  
  - The particle slows down or partially reflects when it hits this barrier.

---

### 2. The "Time Machine" (Left Side)

The left side of the equation, $i\hbar \frac{\partial}{\partial t}$, is a set of instructions:

> "Based on the energy calculated on the right, update the wave's shape for the next tiny slice of time."

It essentially tells the simulation **how the wave should evolve** step by step.

---

### 3. The "Human-Readable" Logic

If we translate the math into words, the equation says:

> "To predict what the particle will look like a millisecond from now, check how fast it is moving (kinetic energy) and whether it’s hitting a barrier (potential energy). Use these to push the wave forward into the future."

---

### 4. Key Takeaways for the Simulation

- **Quantum Tunneling**:  
  In classical physics, a particle that doesn't have enough energy to cross a hill stops.  
  In quantum mechanics, because the particle is a wave, **a small portion can 'leak' through the barrier**, which is why you see a faint cyan wave on the other side of the red block.

- **Dispersion**:  
  The wave packet naturally spreads out over time.  
  - Without external forces, a quantum particle’s probability distribution becomes wider and flatter.  
  - This reflects the uncertainty in the particle’s position as time progresses.

## 🧠 Understanding the "Weird" Physics

If you look at the Schrödinger Equation, it contains symbols that seem unusual in a standard physics context. Here is how they translate to this simulation:

### 1. Why are there two arrays? (The $i$)
In the equation, you see the imaginary unit $i$. This tells us that quantum particles aren't just single numbers; they are **complex waves**. 
* In the code, this is why we use `psi_r` (Real part) and `psi_i` (Imaginary part).
* Think of the wave as a corkscrew moving through space—it "rotates" as it moves. The two arrays track that rotation.



### 2. The Scale of the World (The $\hbar$)
The symbol $\hbar$ (Planck's Constant) represents the scale of the quantum world. 
* In the real universe, this is a tiny number ($1.054 \times 10^{-34}$). 
* In our simulation `params`, we set it to `1`. This "scales up" the quantum effects so we can actually see them on a computer screen.

### 3. The "Dance" of the Wave
When you click **Play**, you are watching the equation dictate the movement of the particle. Pay attention to these two behaviors:

* **Interference Ripples:** When the wave hits the red barrier, it doesn't just stop. It bounces back and crashes into itself. This creates a "ripple" or "strobe" pattern known as **Interference**.
* **Superposition:** The equation calculates two things at once: the part of the wave that is reflected (bounced) and the part that is transmitted (passed through). What you see is the **Superposition** (the sum) of both possibilities happening simultaneously.

* ## 🎯 Conclusion: From Equations to Intuition

Quantum mechanics is often described as "counter-intuitive" because we cannot see the subatomic world with our naked eyes. The goal of this simulation is to bridge that gap. By transforming the **Schrödinger Equation** from a static line of calculus into a living, breathing visualization, we move from rote memorization to physical intuition.

### Why This Matters
The behaviors you see in this simulation—tunneling, dispersion, and interference—are not just theoretical curiosities. They are the fundamental principles that power the modern world:
* **Semiconductors:** The transistors in your computer rely on controlling the flow of quantum particles.
* **Flash Memory:** Your USB drives and SSDs use "Quantum Tunneling" to store data.
* **Medical Imaging:** Technologies like MRI and PET scans are built entirely on the math visualized here.



### Final Thought
While the math is "weird" and the world of the very small is chaotic, it follows a strict set of rules. This project is a small window into that hidden reality. We encourage you to play with the settings, push the boundaries of the wave packet, and observe how changing a single variable can completely alter the fate of a particle.

**Happy Simulating!** 🚀
