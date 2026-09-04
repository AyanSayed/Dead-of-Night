import { ROLE_CATEGORIES, ALIGNMENT_COLORS } from "../data/roles";

function Roles({ onBack }) {
  return (
    <div className="page-bg page-bg--lore lore-screen">
      <div className="lore-content glass-panel">
        <button className="back-btn" onClick={onBack}>
          &larr; Back
        </button>

        <h1>Roles</h1>
        <p>
          Classic roles are always in play. Other sets are randomized based
          on group size.
        </p>

        {ROLE_CATEGORIES.map((group) => (
          <section key={group.category} style={{ marginTop: "28px" }}>
            <h2 className="role-group-title">{group.category}</h2>
            <div style={{ display: "grid", gap: "12px" }}>
              {group.roles.map((role) => (
                <div
                  key={role.name}
                  className="role-card"
                  style={{
                    border: `1px solid ${ALIGNMENT_COLORS[role.alignment]}`,
                  }}
                >
                  <strong style={{ color: ALIGNMENT_COLORS[role.alignment] }}>
                    {role.name}
                  </strong>
                  {role.hasNightAction && (
                    <span className="role-action">
                      (night action: {role.actionLabel})
                    </span>
                  )}
                  <p>{role.description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default Roles;
