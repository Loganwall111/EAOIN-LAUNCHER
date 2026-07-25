export default function HUD() {
  return (
    <div className="game-hud-overlay">
      <div className="hotbar">
        {['Grass', 'Dirt', 'Stone', 'Sand', 'Water', 'Wood', 'Leaves', 'Coal'].map((b, i) => (
          <div key={i} className={`slot ${i === 0 ? 'selected' : ''}`}>
            <span className="item-label">{b}</span>
          </div>
        ))}
      </div>
      <div className="status-bar">
        <span>Position: 0, 0, 0</span>
        <span>Biome: Plains</span>
        <span>Chunk: 0, 0</span>
      </div>
    </div>
  );
}
