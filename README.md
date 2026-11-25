# Asrama ITS — Communal Hall & Canteen 3D

An interactive, fully procedural 3D architectural reconstruction of the **Asrama ITS Communal Hall & Canteen** built with **Three.js** and **Vite** for *Grafika Komputer* (Computer Graphics).

Every surface, texture, structure, prop, person, and surrounding campus detail is generated deterministically in code at load time—no external `.glb` models or texture image assets are required.

---

## Features

- **Detailed L-Shaped Architecture (`1 unit = 1 meter`)**
  - **Wing A (Main Hall):** Open *lesehan* study hall with an asymmetric pitched roof, skylight truss, west window-grid gable, south orange perimeter beam, weathered orange-red divider wall, 2nd-floor mezzanine with balcony bay, glass-walled *Kantor Pelayanan Asrama* office, and three detailed canteen booths (**ExSoe**, **WARAS**, and **KEDAI MINUMAN**).
  - **Wing B (Steel Dining Pavilion):** Clerestory pavilion housing steel picnic tables, a curved white switchback staircase connecting to the mezzanine, and under-stair storage.
  - **Lived-In Details & Campus Surroundings:** Procedural signage (*PERHATIAN* boards, canteen rules), wall-mounted oscillating fans, printing station, stall clutter (fridges, cooking gear, hanging sachet strips), architectural wear/conduit/stains, posed & walking students, lounging dormitory cats, colorful trash bins, wind-swaying tropical foliage, neighbouring dormitory blocks, parked vehicles, and flying birds.
- **100% Procedural Textures & Materials**
  - Seeded Mulberry32 PRNG and fbm noise generate diffuse, bump, and roughness canvas textures with metric-scale UVs (`1 UV unit = 1 m`) so tiles and walls align consistently across geometry.
- **Dynamic Sky & Time-of-Day System (`05:30` – `21:00`)**
  - Custom GLSL sky dome featuring atmospheric horizon haze, sun disc & halo, drifting fbm cumulus clouds, and twinkling night stars.
  - Real-time PMREM environment map baking for physically based reflections on glass, steel, and glazed ceramic tiles.
  - Smooth transitions for sun/moon shadows, fog, exposure, fluorescent stall lights, pendant globes, and driveway street lamps, with quick presets (**Morning**, **Noon**, **Afternoon**, **Golden hour**, **Night**).
- **Post-Processing & Glazed Floor Reflections**
  - Planar `Reflector` overlay with a custom Fresnel-weighted shader simulating the hall's glossy ceramic floor.
  - Selectable quality tiers (**Ultra**, **High**, **Medium**, **Low**) driving MSAA half-float HDR rendering, Ground-Truth Ambient Occlusion (`GTAOPass`), `UnrealBloomPass`, and ACES Filmic tone mapping—with automatic step-down if frame rate drops below 21 FPS.
- **Static Batching & Animation**
  - `mergeStaticMeshes()` bakes and merges thousands of static sub-meshes per material into unified draw calls while preserving dynamic animated objects (`animation.js`) and vertex-shader wind foliage (`wind.js`).
- **Dual Exploration Modes**
  - **Orbit Mode** with smooth transitions across **9 curated camera presets**.
  - **First-Person Walk Mode** at eye level with pointer-lock or drag-to-look, running, elevation lift, subtle head bob, and automatic floor/exterior ground height following.

---

## Folder Structure

```text
Grafkom/
├── praktikum-threejs-06/       # Vite + Three.js web application
│   ├── index.html              # App shell, HUD, time-of-day & quality controls
│   ├── package.json            # Dependencies (three ^0.186.1, vite ^8.3.5)
│   └── src/
│       ├── main.js             # Entry point, renderer, UI, walk mode, render loop
│       ├── style.css           # HUD and overlay styling
│       └── scene/              # Modular 3D scene builders & rendering utilities
└── .claude/
    └── launch.json             # Dev server launch configuration (port 5173)
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended) and `npm`

### Install & Run

```bash
cd praktikum-threejs-06
npm install
npm run dev
```

Or run directly from the root `Grafkom/` directory:

```bash
npm --prefix praktikum-threejs-06 install
npm --prefix praktikum-threejs-06 run dev
```

Then open the local URL printed by Vite (default: `http://localhost:5173`).

### Production Build & Preview

```bash
cd praktikum-threejs-06
npm run build
npm run preview
```

---

## Controls & Shortcuts

### General & Orbit Mode

| Input | Action |
| --- | --- |
| **Left-drag** | Orbit camera |
| **Right-drag** | Pan camera |
| **Scroll wheel** | Zoom in / out |
| **`1` – `9`** | Smoothly fly to camera preset (`1. Overview` through `9. Cat Nap`) |
| **`R`** | Reset camera to Preset 1 (Overview) |
| **`N`** | Toggle between Afternoon (`15:30`) and Night (`19:30`) |
| **`F`** | Enter / exit First-Person Walk Mode |

### First-Person Walk Mode (`F`)

| Input | Action |
| --- | --- |
| **`W` `A` `S` `D`** / **`↑` `↓`** | Move forward, back, and strafe |
| **Mouse** (pointer lock or click-drag) / **`←` `→`** | Look / turn around |
| **`Alt` + `↑` `↓`** | Tilt view up / down |
| **`Shift`** | Run faster |
| **`E` / `Q`** | Raise / lower eye elevation |
| **`F` or `Esc`** | Exit Walk Mode |

---

## Scene Architecture (`src/scene/`)

| Module | Responsibility |
| --- | --- |
| `layoutSpec.js` | Single source of truth for spatial coordinates, dimensions, stalls, furniture placements, and the 9 camera presets |
| `materials.js` | Procedural PBR material library (canvas textures, bump/roughness maps, metric UV flags, night-glow registration) |
| `noise.js` | Seeded PRNG (`createRng`), fbm noise, and canvas helpers for deterministic builds |
| `geomUtils.js` | Metric triplanar UV unwrapping (`applyMetricUV`) and geometry/material shorthand helpers |
| `building.js` | Structural shell: slabs, columns, asymmetric roof, skylight truss, mezzanine, curved staircase, office, Wing B pavilion, and lamps |
| `furniture.js` | Red divider wall, canteen bench tables, low wooden *lesehan* tables, steel picnic tables, and office furniture |
| `stalls.js` | The three north-wall food booths (*ExSoe*, *WARAS*, *KEDAI MINUMAN*) with mosaic-tiled counters and signage |
| `stallClutter.js` | Stall interiors and trade props: strip lights, fridges, cookware, shelves, hanging sachet strips, fruit, and stools |
| `props.js` | Printing station, wall display cabinet, warning/*PERHATIAN* signs, fire extinguishers, oscillating wall fans, potted plants, table accessories, and lounging cat |
| `details.js` | Architectural realism: gutters, exposed conduit, floodlights, column stickers, floor stains/tape, and housekeeping clutter |
| `people.js` | Stylized students and vendors (cross-legged at *lesehan* tables, seated on benches, serving behind counters, and walking loops) |
| `outdoor.js` | Immediate driveways, curbs, perimeter lawns, grouped colorful trash bins, trees, and shrubs |
| `surroundings.js` | Broader campus context: neighbouring dormitory blocks, boundary wall, parked vehicles, street lamps, wind-blown grass, distant trees, and birds |
| `wind.js` | Soft-normal `foliageBlob()` generator and vertex-shader wind sway compatible with statically batched meshes |
| `atmosphere.js` | Procedural GLSL sky shader, PMREM IBL updates, sun/moon directional lighting, fog, and exposure curves |
| `reflection.js` | Planar `Reflector` with custom Fresnel-weighted compositing for glazed ceramic floor reflections |
| `pipeline.js` | `EffectComposer` setup (`RenderPass`, `GTAOPass`, `UnrealBloomPass`, `OutputPass`) and quality tier presets |
| `optimize.js` | World-space static geometry batching (`mergeStaticMeshes`) to dramatically reduce draw calls |
| `animation.js` | Per-frame animator registry and `markDynamic()` tagging for moving objects |

---

## Quality Tiers

| Tier | Max DPR | MSAA | GTAO (Samples) | Bloom | Floor Reflection |
| --- | :---: | :---: | :---: | :---: | :---: |
| **Ultra** | `2.0` | `4×` | On (`16`) | On | On |
| **High** *(default)* | `1.5` | `4×` | On (`12`) | On | On |
| **Medium** | `1.25` | `4×` | Off | On | On |
| **Low** | `1.0` | Off | Off | Off | Off (direct render) |

---

## Developer Console Debug Hook

At runtime, `main.js` exposes `window.__SCENE_DEBUG__` with direct access to `scene`, `camera`, `controls`, `renderer`, `atmosphere`, `pipeline`, `materials`, `mergeStats`, `fps`, `frameInfo`, and helper methods (`goToPreset`, `setTime`, `setQuality`, `enterWalk`, `exitWalk`, `renderFrame`).

---

## Tech Stack

- **[Three.js](https://threejs.org/)** (`^0.186.1`) — WebGL rendering, `OrbitControls`, `Reflector`, post-processing (`EffectComposer`, `GTAOPass`, `UnrealBloomPass`, `OutputPass`)
- **[Vite](https://vite.dev/)** (`^8.3.5`) — Development server and bundler
- **Vanilla JavaScript (ES Modules) & GLSL** — Zero framework overhead
