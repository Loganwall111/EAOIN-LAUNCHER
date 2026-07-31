// EAOIN — Wake Up Sequence Integration
// Import this component after the cinematic boot finishes and the player spawns

import WakeUpSequence from './WakeUpSequence';
import './WakeUpStyles.css';

interface Props {
  onWakeUpComplete: () => void;
}

export default function WakeUpIntegration({ onWakeUpComplete }: Props) {
  return <WakeUpSequence onComplete={onWakeUpComplete} />;
}

// Usage example in your main game entry:
// <WakeUpIntegration onWakeUpComplete={() => startGameplay()} />
