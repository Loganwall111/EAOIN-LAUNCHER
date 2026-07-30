import React, { useEffect, useState } from 'react';

interface WakeUpSequenceProps {
  onComplete: () => void;
}

const DREAM_LINES = [
  "Hello… it’s been a long time.",
  "It’s been a while, huh?",
  "Well, maybe someday I can come to see you…",
  "But for now, the world is counting on you.",
  "It’s time for you to wake up.",
  "Oh, and remember… everything is wired together.",
  "It’s the world we live in."
];

export default function WakeUpSequence({ onComplete }: WakeUpSequenceProps) {
  const [phase, setPhase] = useState<'GALAXIES' | 'DREAM' | 'TITLE' | 'WAKE' | 'DONE'>('GALAXIES');
  const [dreamLineIndex, setDreamLineIndex] = useState(0);
  const [showTitle, setShowTitle] = useState(false);
  const [wakeProgress, setWakeProgress] = useState(0);

  // Galaxy rush + neuron loading cinematic
  useEffect(() => {
    if (phase !== 'GALAXIES') return;

    const galaxyTimer = setTimeout(() => {
      setPhase('DREAM');
    }, 6200);

    return () => clearTimeout(galaxyTimer);
  }, [phase]);

  // Dream lady narration (ethereal female voice)
  useEffect(() => {
    if (phase !== 'DREAM') return;

    let index = 0;
    setDreamLineIndex(0);

    const speak = (text: string) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.82;
        utterance.pitch = 1.08;
        utterance.volume = 0.92;

        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v =>
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('karen') ||
          v.name.toLowerCase().includes('samantha') ||
          v.name.toLowerCase().includes('zira')
        );
        if (femaleVoice) utterance.voice = femaleVoice;

        window.speechSynthesis.speak(utterance);
      }
    };

    const interval = setInterval(() => {
      if (index < DREAM_LINES.length) {
        setDreamLineIndex(index);
        speak(DREAM_LINES[index]);
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => setPhase('TITLE'), 1400);
      }
    }, 2150);

    speak(DREAM_LINES[0]);
    return () => clearInterval(interval);
  }, [phase]);

  // Game title reveal
  useEffect(() => {
    if (phase !== 'TITLE') return;
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
      setTimeout(() => setPhase('WAKE'), 2600);
    }, 800);
    return () => clearTimeout(titleTimer);
  }, [phase]);

  // Wake up animation (pulling hands from ground)
  useEffect(() => {
    if (phase !== 'WAKE') return;

    let progress = 0;
    const wakeInterval = setInterval(() => {
      progress += 4;
      setWakeProgress(Math.min(progress, 100));

      if (progress >= 100) {
        clearInterval(wakeInterval);
        setTimeout(() => {
          setPhase('DONE');
          onComplete();
        }, 900);
      }
    }, 80);

    return () => clearInterval(wakeInterval);
  }, [phase, onComplete]);

  if (phase === 'DONE') return null;

  return (
    <div className="wakeup-cinematic">
      {/* Galaxy rush loading cinematic */}
      {phase === 'GALAXIES' && (
        <div className="galaxy-rush">
          <div className="stars" />
          <div className="galaxies" />
          <div className="whispers">Whispers from the mind…</div>
          <div className="neuron-field" />
          <div className="aaa-loading-bar">
            <div className="bar-fill" style={{ width: '100%' }} />
          </div>
          <div className="loading-text">SYNCHRONIZING WITH THE WORLD…</div>
        </div>
      )}

      {/* Dream sequence with purple glowing lady */}
      {phase === 'DREAM' && (
        <div className="dream-sequence">
          <div className="purple-glow-lady" />
          <div className="dream-text">
            {DREAM_LINES[dreamLineIndex]}
          </div>
          <div className="dream-subtitle">The Lady in Violet</div>
        </div>
      )}

      {/* Game Title Reveal */}
      {phase === 'TITLE' && (
        <div className="title-reveal">
          <div className={`eaoin-title ${showTitle ? 'visible' : ''}`}>
            EAOIN
          </div>
          <div className="tagline">THIS WORLD AWAITS</div>
        </div>
      )}

      {/* Wake Up Sequence - First Person Hands */}
      {phase === 'WAKE' && (
        <div className="wake-up-scene">
          <div className="ground" />
          <div className="player-hands" style={{ transform: `translateY(${100 - wakeProgress}%)` }}>
            <div className="hand left" />
            <div className="hand right" />
          </div>
          <div className="horizon" />
          <div className="wake-text">You wake up…</div>
        </div>
      )}
    </div>
  );
}
