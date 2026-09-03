import { useState } from 'react';

// The three-line "hamburger" button, fixed to the side of the screen.
// Tapping it slides in a drawer with links to the Dashboard, Rules and
// Roles pages. `activeView` just highlights whichever one is current.
function Sidebar({ onShowDashboard, onShowRules, onShowRoles, activeView }) {
  const [open, setOpen] = useState(false);

  function go(action) {
    action();
    setOpen(false);
  }

  return (
    <>
      <button
        className="hamburger-btn"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        className={`sidebar-backdrop ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(false)}
      />

      <nav className={`sidebar-drawer ${open ? 'is-open' : ''}`}>
        <div className="sidebar-title">MAFIA</div>

        <button
          className={`sidebar-link ${activeView === 'dashboard' ? 'is-active' : ''}`}
          onClick={() => go(onShowDashboard)}
        >
          Dashboard
        </button>
        <button
          className={`sidebar-link ${activeView === 'rules' ? 'is-active' : ''}`}
          onClick={() => go(onShowRules)}
        >
          Rules
        </button>
        <button
          className={`sidebar-link ${activeView === 'roles' ? 'is-active' : ''}`}
          onClick={() => go(onShowRoles)}
        >
          Roles
        </button>

        <button className="sidebar-close" onClick={() => setOpen(false)}>
          Close ✕
        </button>
      </nav>
    </>
  );
}

export default Sidebar;
