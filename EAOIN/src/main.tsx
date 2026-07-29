import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/aaa-menu.css';
import './styles/eaoin-ui.css';
import './styles/concept-overhaul.css';
import './styles/startup-error.css';
import './styles/developer-app-panel.css';
// Loaded LAST: hud-layout.css owns the final position of every in-game panel
// and resolves the overlaps between the older HUD stylesheets.
import './styles/hud-layout.css';

console.log('EAOIN Ultimate Sandbox Engine v0.01 — Boot Sequence Initiated');
console.log('Engine Architecture: ECS + Chunk Streaming + Deferred Rendering');
console.log('Target: Production-quality voxel sandbox RPG');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
