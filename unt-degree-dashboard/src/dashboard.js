// Renders the degree dashboard from window.DEGREE_DATA (written by
// scripts/sync-notion.mjs) using DegreeModel and DegreeRequirements.
(function () {
  const data = window.DEGREE_DATA || { courses: [] };
  const reqs = window.DegreeRequirements;
  const Model = window.DegreeModel;
  const $ = (id) => document.getElementById(id);

  const STORE_KEY = "baas-dashboard:v1";
  const state = { hoursPerTerm: 12, includeSummer: false, filter: "All" };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
  } catch (_) { /* storage unavailable: keep defaults */ }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ hoursPerTerm: state.hoursPerTerm, includeSummer: state.includeSummer, filter: state.filter }));
    } catch (_) { /* ignore */ }
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hrs = (n) => `${n} ${n === 1 ? "hr" : "hrs"}`;
  const STATUS_CLASS = { Completed: "done", "In Progress": "ip", Planned: "plan", "Not Started": "plan" };
  const STATE_LABEL = { done: "Done", "in-progress": "In progress", planned: "Planned", gap: "Needs a plan" };

  function courseTip(c) {
    return [c.name, `${c.code} · ${hrs(c.credits)}`, [c.status, c.grade && c.grade !== "N/A" && c.grade !== "IP" ? `grade ${c.grade}` : "", c.term].filter(Boolean).join(" · ")].join("\n");
  }

  function render() {
    const m = Model.summarize(data.courses, reqs, { hoursPerTerm: state.hoursPerTerm, includeSummer: state.includeSummer });
    const s = m.summary;
    renderHeader(s);
    renderHero(s);
    renderTiles(s);
    renderRequirements(m);
    renderHistory(m.terms);
    renderTodo(m);
    renderChecks(m);
  }

  function renderHeader(s) {
    $("school").textContent = reqs.school;
    $("degree").textContent = reqs.degree;
    $("subtitle").textContent = `Current term: ${s.currentTerm}. ${s.inProgress} hours in progress.`;
    const synced = data.syncedAt ? new Date(data.syncedAt) : null;
    $("sync").innerHTML = `Source: ${esc(data.source || "Notion")}<br>Synced ${synced ? esc(synced.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })) : "never"}`;
  }

  function renderHero(s) {
    $("hero-num").textContent = s.completed;
    $("hero-of").textContent = `of ${s.total} hours complete`;
    $("hero-pct").textContent = `${Math.round(s.percentComplete * 100)}% · ${s.remaining} to go`;

    const parts = [
      { cls: "done", label: "Completed", value: s.completed },
      { cls: "ip", label: "In progress", value: s.inProgress },
      { cls: "plan", label: "Planned", value: s.planned },
      { cls: "gap", label: "Not yet planned", value: s.unassigned },
    ].filter((p) => p.value > 0);
    $("track").setAttribute("aria-label", parts.map((p) => `${p.label} ${p.value} hours`).join(", ") + ` of ${s.total}`);
    $("track").innerHTML = parts
      .map((p) => `<div class="seg ${p.cls}" style="flex: 0 0 calc(${(p.value / s.total) * 100}% - 2px)" data-tip="${esc(`${p.label}\n${hrs(p.value)} (${Math.round((p.value / s.total) * 100)}%)`)}"></div>`)
      .join("");
    $("ticks").innerHTML = [0, 30, 60, 90, 120].map((t) => `<span style="left:${(t / s.total) * 100}%">${t}</span>`).join("");
    $("legend").innerHTML = parts
      .map((p) => `<span><i class="seg ${p.cls}" style="border-radius:3px"></i>${p.label}<span class="num">${p.value}</span></span>`)
      .join("");
  }

  function renderTiles(s) {
    const unt = s.gpa.unt;
    const tr = s.gpa.transfer;
    const advDone = s.advanced.completed;
    const advAll = advDone + s.advanced.inProgress + s.advanced.planned;
    const termCount = s.projection.length;
    $("tiles").innerHTML = `
      <div class="tile">
        <span class="label">Hours remaining</span>
        <span class="value num">${s.remaining}</span>
        <span class="note">${s.inProgress} in progress, ${s.planned} planned${s.unassigned ? `, ${s.unassigned} not yet planned` : ""}</span>
      </div>
      <div class="tile">
        <span class="label">UNT GPA</span>
        <span class="value num">${unt.gpa == null ? "–" : unt.gpa.toFixed(2)}</span>
        <span class="note">${unt.hours} graded UNT hours. Transfer work: ${tr.gpa == null ? "–" : tr.gpa.toFixed(2)} over ${tr.hours} hrs.</span>
      </div>
      <div class="tile">
        <span class="label">Advanced hours (3000–4000)</span>
        <span class="value num">${advDone} <span style="font-size:15px;font-weight:500;color:var(--ink-2)">of ${s.advanced.needed}</span></span>
        <span class="note">${s.advanced.inProgress} in progress. Plan reaches ${advAll}.</span>
      </div>
      <div class="tile">
        <span class="label">Projected graduation</span>
        <span class="value">${esc(s.graduationTerm)}</span>
        <span class="note">${termCount} more ${termCount === 1 ? "term" : "terms"} after ${esc(s.currentTerm)}</span>
        <div class="pace">
          <select id="pace" aria-label="Hours per term">
            ${[6, 9, 12, 15, 18].map((h) => `<option value="${h}"${h === state.hoursPerTerm ? " selected" : ""}>${h} hrs / term</option>`).join("")}
          </select>
          <label for="summer"><input type="checkbox" id="summer"${state.includeSummer ? " checked" : ""}> Summers</label>
        </div>
      </div>`;
    $("pace").addEventListener("change", (e) => { state.hoursPerTerm = Number(e.target.value); save(); render(); });
    $("summer").addEventListener("change", (e) => { state.includeSummer = e.target.checked; save(); render(); });
  }

  function meter(b) {
    const parts = [
      ["done", b.completed], ["ip", b.inProgress], ["plan", b.planned], ["gap", b.unplanned],
    ].filter(([, v]) => v > 0);
    const filled = parts.reduce((n, [, v]) => n + v, 0);
    if (filled < b.needed) parts.push(["empty", b.needed - filled]);
    const total = Math.max(b.needed, filled) || 1;
    const label = { done: "Completed", ip: "In progress", plan: "Planned", gap: "Not yet planned", empty: "Open" };
    return `<div class="meter">${parts
      .map(([cls, v]) => `<div class="seg ${cls}" style="flex: ${v / total} 1 0" data-tip="${esc(`${label[cls]}: ${hrs(v)}`)}"></div>`)
      .join("")}</div>`;
  }

  function reqRow(b) {
    const courses = b.courses
      .map((c) => `<a class="course-chip" href="${esc(c.url)}" target="_blank" rel="noopener" data-tip="${esc(courseTip(c))}"><i class="seg ${STATUS_CLASS[c.status] || "plan"}"></i>${esc(/\d/.test(c.code) ? c.code : c.name)}</a>`)
      .join("");
    return `<div class="req">
      <div>
        <div class="req-name">${esc(b.label)}</div>
      </div>
      <div class="req-hours num">${b.completed}/${b.needed} <span class="pill ${b.state}">${STATE_LABEL[b.state]}</span></div>
      ${meter(b)}
      ${courses ? `<div class="req-courses">${courses}</div>` : ""}
    </div>`;
  }

  function renderRequirements(m) {
    const groups = [];
    for (const b of m.blocks) {
      let g = groups.find((x) => x.name === b.group);
      if (!g) groups.push((g = { name: b.group, blocks: [] }));
      g.blocks.push(b);
    }
    groups[groups.length - 1].blocks.push(m.electives);
    $("req-grid").innerHTML = groups
      .map((g) => {
        const need = g.blocks.reduce((n, b) => n + b.needed, 0);
        const done = g.blocks.reduce((n, b) => n + Math.min(b.completed, b.needed), 0);
        return `<div class="req-group"><h3>${esc(g.name)} <span class="num">${done} of ${need} hrs</span></h3>${g.blocks.map(reqRow).join("")}</div>`;
      })
      .join("");
  }

  function shortTerm(t) {
    const ay = /^(\d{4})-(\d{4})$/.exec(t);
    if (ay) return `${ay[1].slice(2)}–${ay[2].slice(2)}`;
    const m = /^(Spring|Summer|Fall) (\d{4})/.exec(t);
    if (m) return `${{ Spring: "Sp", Summer: "Su", Fall: "Fa" }[m[1]]} ${m[2].slice(2)}`;
    return t;
  }

  function renderHistory(terms) {
    const W = 720, H = 260, padL = 30, padR = 8, padT = 50, padB = 44;
    const maxV = Math.max(3, ...terms.map((t) => t.completed + t.inProgress));
    const yMax = Math.ceil(maxV / 3) * 3;
    const y = (v) => padT + (H - padT - padB) * (1 - v / yMax);
    const band = (W - padL - padR) / Math.max(1, terms.length);
    const bw = Math.min(24, band * 0.6);
    const x = (i) => padL + band * i + band / 2;
    const ticks = [];
    for (let v = 0; v <= yMax; v += 3) ticks.push(v);

    const firstUnt = terms.findIndex((t) => t.unt);
    let svg = `<svg viewBox="0 0 ${W} ${H}" style="min-width:560px" role="img" aria-label="Credit hours earned per term">`;
    svg += `<g class="grid">${ticks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`).join("")}</g>`;
    svg += `<g class="axis">${ticks.map((v) => `<text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}</g>`;
    if (firstUnt > 0) {
      const dx = padL + band * firstUnt;
      svg += `<line class="divider" x1="${dx}" x2="${dx}" y1="${padT - 42}" y2="${H - padB + 30}"/>`;
      svg += `<text class="era" x="${padL}" y="${padT - 30}">Transfer credit (academic year)</text>`;
      svg += `<text class="era" x="${dx + 8}" y="${padT - 30}">UNT</text>`;
    }
    terms.forEach((t, i) => {
      const cx = x(i);
      const total = t.completed + t.inProgress;
      const tip = esc(`${t.term}\n${t.completed ? `${hrs(t.completed)} completed` : ""}${t.inProgress ? `${t.completed ? ", " : ""}${hrs(t.inProgress)} in progress` : ""}`);
      // Hit target spans the band so thin bars are easy to hover.
      svg += `<g class="bar" data-tip="${tip}"><rect x="${padL + band * i}" y="${padT}" width="${band}" height="${H - padT - padB}" fill="transparent"/>`;
      let base = 0;
      [["completed", "var(--done)"], ["inProgress", "var(--ip)"]].forEach(([k, color]) => {
        const v = t[k];
        if (!v) return;
        const top = base + v;
        const isTop = top === total;
        // A 2px surface gap separates stacked segments.
        const yy = y(top);
        const h = Math.max(0, y(base) - yy - (base > 0 ? 2 : 0));
        const r = isTop ? Math.min(4, h) : 0;
        const x0 = cx - bw / 2;
        const x1 = cx + bw / 2;
        svg += isTop
          ? `<path fill="${color}" d="M${x0},${yy + h} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x1 - r} Q${x1},${yy} ${x1},${yy + r} V${yy + h} Z"/>`
          : `<rect fill="${color}" x="${x0}" y="${yy}" width="${bw}" height="${h}"/>`;
        base = top;
      });
      svg += `<text x="${cx}" y="${y(total) - 6}" text-anchor="middle" style="fill:var(--ink-2);font:500 11px var(--mono)">${total}</text>`;
      svg += `<text x="${cx}" y="${H - padB + 18}" text-anchor="middle" style="fill:var(--ink-3);font:400 11px var(--mono)">${esc(shortTerm(t.term))}</text></g>`;
    });
    svg += `</svg>`;
    $("history").innerHTML = svg;
    $("history-table").innerHTML = `<thead><tr><th>Term</th><th class="hours">Completed</th><th class="hours">In progress</th></tr></thead><tbody>${terms
      .map((t) => `<tr><td>${esc(t.term)}</td><td class="hours num">${t.completed}</td><td class="hours num">${t.inProgress}</td></tr>`)
      .join("")}</tbody>`;
  }

  function renderTodo(m) {
    const blocks = [...m.blocks, m.electives];
    const rows = [];
    for (const b of blocks) {
      for (const c of b.courses) {
        if (c.status === "Completed") continue;
        rows.push({ group: b.group, block: b.label, course: c });
      }
      if (b.unplanned > 0) rows.push({ group: b.group, block: b.label, gap: b.unplanned });
    }
    const filters = ["All", ...new Set(blocks.map((b) => b.group))];
    if (!filters.includes(state.filter)) state.filter = "All";
    $("filters").innerHTML = filters
      .map((f) => `<button type="button" class="filter" aria-pressed="${f === state.filter}" data-filter="${esc(f)}">${esc(f)} <span class="num">${f === "All" ? rows.length : rows.filter((r) => r.group === f).length}</span></button>`)
      .join("");
    $("filters").querySelectorAll("button").forEach((btn) =>
      btn.addEventListener("click", () => { state.filter = btn.dataset.filter; save(); renderTodo(m); })
    );
    const shown = rows.filter((r) => state.filter === "All" || r.group === state.filter);
    const order = { "In Progress": 0, Planned: 1, "Not Started": 1 };
    shown.sort((a, b) => (a.gap ? 2 : order[a.course.status] ?? 1) - (b.gap ? 2 : order[b.course.status] ?? 1));
    $("todo").innerHTML = `<thead><tr><th>Course</th><th>Requirement</th><th class="hours">Hours</th><th>Status</th></tr></thead><tbody>${shown
      .map((r) => {
        if (r.gap) {
          return `<tr><td><strong>Not yet planned</strong><div class="muted">Pick a course, or confirm the hours on your UNT audit.</div></td><td>${esc(r.block)}</td><td class="hours num">${r.gap}</td><td><span class="pill gap">Needs a plan</span></td></tr>`;
        }
        const c = r.course;
        const pill = c.status === "In Progress" ? `<span class="pill in-progress">In progress</span>` : `<span class="pill planned">Planned</span>`;
        return `<tr>
          <td><a href="${esc(c.url)}" target="_blank" rel="noopener" class="code">${esc(/\d/.test(c.code) ? c.code : c.name)}</a><div class="muted">${esc(c.name)}${c.term ? ` · ${esc(c.term)}` : ""}</div></td>
          <td>${esc(r.block)}</td>
          <td class="hours num">${c.credits}</td>
          <td>${pill}</td>
        </tr>`;
      })
      .join("")}</tbody>`;
  }

  function renderChecks(m) {
    const order = { critical: 0, warn: 1, info: 2 };
    const label = { critical: "Gap", warn: "Check", info: "Cleanup" };
    const checks = m.checks.slice().sort((a, b) => order[a.level] - order[b.level]);
    $("checks").innerHTML = checks.length
      ? checks
          .map((c) => `<li class="check ${c.level}"><span class="tag">${label[c.level]}</span><span>${esc(c.text)}${c.course ? ` <a href="${esc(c.course.url)}" target="_blank" rel="noopener">Open in Notion</a>` : ""}</span></li>`)
          .join("")
      : `<li class="check info"><span class="tag">OK</span><span>No issues found.</span></li>`;
    $("excluded-summary").textContent = `${m.excluded.length} Notion rows not counted (withdrawals, repeats, duplicates)`;
    $("excluded").innerHTML = `<thead><tr><th>Course</th><th>Term</th><th>Grade</th><th>Why it's not counted</th></tr></thead><tbody>${m.excluded
      .slice()
      .sort((a, b) => Model.termKey(a.course.term) - Model.termKey(b.course.term))
      .map((x) => `<tr><td><span class="code">${esc(x.course.code)}</span><div class="muted">${esc(x.course.name)}</div></td><td>${esc(x.course.term || "–")}</td><td>${esc(x.course.grade || "–")}</td><td>${esc(x.reason)}</td></tr>`)
      .join("")}</tbody>`;
    $("footer").textContent = `Totals assume ${reqs.totalHours} hours with ${reqs.advancedHours} advanced for the ${reqs.degree}. Confirm against your official UNT degree audit; edit src/requirements.js if the audit differs.`;
  }

  // One tooltip for every element with data-tip.
  const tip = $("tooltip");
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el) { tip.hidden = true; return; }
    tip.innerHTML = el.dataset.tip.split("\n").filter(Boolean).map((l, i) => (i === 0 ? `<strong>${esc(l)}</strong>` : esc(l))).join("<br>");
    tip.hidden = false;
  });
  document.addEventListener("mousemove", (e) => {
    if (tip.hidden) return;
    const pad = 14;
    const r = tip.getBoundingClientRect();
    let left = e.clientX + pad;
    let top = e.clientY + pad;
    if (left + r.width > window.innerWidth - 8) left = e.clientX - r.width - pad;
    if (top + r.height > window.innerHeight - 8) top = e.clientY - r.height - pad;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
  document.addEventListener("mouseleave", () => { tip.hidden = true; });

  render();
})();
