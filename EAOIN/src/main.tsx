import ReactDOM from 'react-dom/client';
import App from './App';
import { BUILD_STAMP } from './version';
import './styles/global.css';
import './styles/aaa-menu.css';
import './styles/eaoin-ui.css';
import './styles/concept-overhaul.css';
import './styles/startup-error.css';
import './styles/developer-app-panel.css';
import './styles/horizonos.css';
import './styles/launcher.css';
// Loaded LAST: hud-layout.css owns the final position of every in-game panel
// and resolves the overlaps between the older HUD stylesheets.
import './styles/hud-layout.css';

console.log(`EAOIN Ultimate Sandbox Engine v0.01 — Boot Sequence Initiated (build ${BUILD_STAMP})`);
console.log('Engine Architecture: ECS + Chunk Streaming + Deferred Rendering');
console.log('Target: Production-quality voxel sandbox RPG');

// Expose the base-aware panorama URL to the boot CSS. Vite builds `base` to the
// real site sub-path (e.g. `/workspace-…/` on GitHub Pages), but the boot
// stylesheet used a hard-coded absolute `/ui/…` path that 404s there, leaving
// the intro a black screen. Routing it through a CSS custom property resolved
// with BASE_URL fixes every boot background on any deployment.
document.documentElement.style.setProperty(
  '--cb-panorama',
  `url("${import.meta.env.BASE_URL}ui/menu-panorama.jpg")`
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
