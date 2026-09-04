function Rules({ onBack, onShowRoles }) {
  return (
    <div className="page-bg page-bg--lore lore-screen">
      <div className="lore-content glass-panel">
        <button className="back-btn" onClick={onBack}>
          &larr; Back
        </button>

        <h1>How to Play</h1>

        <h2>Round structure</h2>
        <ol>
          <li>
            <strong>Night</strong> — roles with a night action act privately
            (Mafia pick a kill, Doctor protects, etc).
          </li>
          <li>
            <strong>Day</strong> — results are announced and players discuss.
          </li>
          <li>
            <strong>Vote</strong> — players vote to eliminate someone;
            majority vote is removed from the game.
          </li>
        </ol>
        <p>The cycle repeats until one side's win condition is met.</p>

        <h2>Win conditions</h2>
        <ul>
          <li>Town wins when all Mafia-aligned players are eliminated.</li>
          <li>Mafia wins when they equal or outnumber the remaining town.</li>
          <li>
            Neutral roles (Jester, Executioner, etc.) have their own
            individual win condition.
          </li>
        </ul>

        <button className="btn-primary" onClick={onShowRoles} style={{ marginTop: '24px' }}>
          View all roles &rarr;
        </button>
      </div>
    </div>
  );
}

export default Rules;
