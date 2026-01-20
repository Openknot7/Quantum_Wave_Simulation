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
📐## Physics Background

The simulation numerically solves the time-dependent Schrödinger equation:

![Time-Dependent Schrödinger Equation](assets/svg.svg)

**Where:**

- **ψ(x,t)** — wave function  
- **|ψ(x,t)|²** — probability density (visualized on screen)  
- **V(x)** — potential barrier  
- **m** — particle mass  
- **ℏ** — reduced Planck constant


  
  
