function escapeHtml(text) {
  if (text == null || text === "") return "—";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function joinList(arr) {
  if (!arr || !arr.length) return "—";
  return arr.filter(Boolean).join(", ");
}

/** Each condition on its own line (safe HTML). */
function formatConditionsList(arr) {
  if (!arr || !arr.length) return "—";
  const items = arr
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  return `<ul class="reaction-condition-list">${items}</ul>`;
}

function buildNotes(r) {
  const parts = [];
  if (r.path_variant) parts.push(`Variant: ${r.path_variant}`);
  if (r.example) parts.push(`Example: ${r.example}`);
  if (r.observation) parts.push(`Observation: ${r.observation}`);
  if (r.notes) parts.push(r.notes);
  if (r.tier) parts.push(`Tier: ${r.tier}`);
  return parts.length ? parts.join(" · ") : "—";
}

/**
 * Structured reaction block: From | To | Reagents | Conditions | Mechanism | Notes
 */
export function renderReactionTable(r, labelFn) {
  const rows = [
    ["From", labelFn(r.from), false],
    ["To", labelFn(r.to), false],
    ["Reagents", joinList(r.reagents), false],
    ["Conditions", formatConditionsList(r.conditions), true],
    ["Mechanism", r.mechanism || "—", false],
    ["Notes", buildNotes(r), false],
  ];

  const body = rows
    .map(([field, value, isHtml]) => {
      const cell = isHtml ? value : escapeHtml(value);
      return `<tr><th scope="row">${escapeHtml(field)}</th><td>${cell}</td></tr>`;
    })
    .join("");

  return `<table class="reaction-table"><tbody>${body}</tbody></table>`;
}

export function renderNodeDetailPanel(n, reactionsOut, reactionsIn, labelFn, nodeId) {
  let html = `
    <h3>${escapeHtml(n.label)}</h3>
    <table class="reaction-table reaction-table--compact">
      <tbody>
        <tr><th scope="row">Example</th><td>${escapeHtml(n.example || "—")}</td></tr>
        <tr><th scope="row">Displayed formula</th><td>${escapeHtml(n.displayed_formula || "—")}</td></tr>
        <tr><th scope="row">Tier</th><td>${escapeHtml(n.tier || "—")}</td></tr>
        ${n.notes ? `<tr><th scope="row">Notes</th><td>${escapeHtml(n.notes)}</td></tr>` : ""}
      </tbody>
    </table>
    <div class="detail-actions">
      <button type="button" class="btn btn-ghost" data-set-from="${nodeId}">Set as From</button>
      <button type="button" class="btn btn-ghost" data-set-to="${nodeId}">Set as To</button>
    </div>
    <p class="detail-hint">Click an arrow on the map to open a full reaction table.</p>
  `;

  if (reactionsOut.length) {
    html += `<h4 class="detail-section">Reactions out</h4>`;
    for (const r of reactionsOut) {
      html += renderReactionTable(r, labelFn);
    }
  }
  if (reactionsIn.length) {
    html += `<h4 class="detail-section">Reactions in</h4>`;
    for (const r of reactionsIn) {
      html += renderReactionTable(r, labelFn);
    }
  }

  return html;
}

export function renderPathStepTable(r, stepNum, labelFn) {
  return `
    <div class="path-step-block">
      <h4 class="path-step-title">Step ${stepNum}</h4>
      ${renderReactionTable(r, labelFn)}
    </div>
  `;
}
