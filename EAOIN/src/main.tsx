import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/aaa-menu.css';

console.log('EAOIN Ultimate Sandbox Engine v0.01 — Boot Sequence Initiated');
console.log('Engine Architecture: ECS + Chunk Streaming + Deferred Rendering');
console.log('Target: Production-quality voxel sandbox RPG');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
