import { useState, useCallback } from 'react';
import MainMenu from './ui/MainMenu';
import GameCanvas from './engine/GameCanvas';
import HUD from './ui/HUD';

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [worldSeed, setWorldSeed] = useState('eaoin_seed_2026');

  const startGame = useCallback((seed?: string) => {
    if (seed) setWorldSeed(seed);
    setGameStarted(true);
  }, []);

  const exitToMenu = useCallback(() => {
    setGameStarted(false);
  }, []);

  return (
    <div className="eaoin-app">
      {!gameStarted ? (
        <MainMenu onStart={startGame} currentSeed={worldSeed} />
      ) : (
        <>
          <GameCanvas seed={worldSeed} onExit={exitToMenu} />
          <HUD />
        </>
      )}
    </div>
  );
}
