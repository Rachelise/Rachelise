// Degree progress model: turns raw Notion "Degree Audit" rows into the numbers
// the dashboard shows. Pure functions only, so it runs in the browser and in
// `node --test` alike.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DegreeModel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const STATUS_ORDER = ["Completed", "In Progress", "Planned", "Not Started"];
  const NON_COUNTING_REQUIREMENTS = [
    "Credit Not Contributing Toward Degree",
    "Duplicate/Repeated Course",
  ];
  const NON_COUNTING_GRADES = ["W", "F"];
  const GRADE_POINTS = { A: 4, "A-": 3.67, "B+": 3.33, B: 3, "B-": 2.67, "C+": 2.33, C: 2, "C-": 1.67, D: 1, F: 0 };
  const UNT_TERM = /^(Spring|Summer|Fall) (\d{4})/;

  function statusRank(status) {
    const i = STATUS_ORDER.indexOf(status);
    return i === -1 ? STATUS_ORDER.length : i;
  }

  // Splits rows into the ones that count toward the degree and the ones that
  // don't (withdrawals, failed or repeated attempts, rows marked not needed,
  // and duplicate rows of the same course).
  function partition(courses) {
    const counted = [];
    const excluded = [];
    const seen = new Map();

    const ranked = courses.slice().sort((a, b) => Number(!a.requirement) - Number(!b.requirement));
    for (const c of ranked) {
      if (/^\[NOT NEEDED\]/i.test(c.name)) {
        excluded.push({ course: c, reason: "Marked not needed" });
        continue;
      }
      if (
        NON_COUNTING_REQUIREMENTS.includes(c.requirement) ||
        NON_COUNTING_GRADES.includes(c.grade) ||
        !(c.credits > 0)
      ) {
        excluded.push({ course: c, reason: "Does not count toward degree" });
        continue;
      }
      const key = c.status === "Completed" || c.status === "In Progress"
        ? [c.code, c.term, c.status].join("|")
        : [c.code, c.requirement, c.name].join("|");
      if (seen.has(key)) {
        excluded.push({ course: c, reason: "Duplicate row", duplicateOf: seen.get(key) });
        continue;
      }
      seen.set(key, c);
      counted.push(c);
    }
    return { counted, excluded };
  }

  // "Part I" must not match "Part II": the prefix has to end at a word boundary.
  function matchesPrefix(text, prefix) {
    const t = text || "";
    return t.startsWith(prefix) && !/^[A-Za-z0-9]/.test(t.slice(prefix.length));
  }

  function displayCode(course) {
    return /\d/.test(course.code || "") ? course.code : course.name;
  }

  function byStatus(list) {
    const out = { Completed: 0, "In Progress": 0, Planned: 0 };
    for (const c of list) {
      const s = c.status === "Not Started" ? "Planned" : c.status;
      out[s] = (out[s] || 0) + (c.credits || 0);
    }
    return out;
  }

  // Course level from the first course number in the code: "ADTA 4340" -> 4.
  // Codes that list alternatives use the first one; codes without a 4-digit
  // number (older transfer codes such as "ENGL 101") count as lower-level.
  function courseLevel(code) {
    const m = /\b(\d)\d{3}\b/.exec(code || "");
    return m ? Number(m[1]) : 1;
  }

  function isAdvanced(course) {
    return courseLevel(course.code) >= 3;
  }

  function isUntCourse(course) {
    return UNT_TERM.test(course.term || "");
  }

  function gpa(list) {
    let points = 0;
    let hours = 0;
    for (const c of list) {
      if (c.status !== "Completed" || !(c.grade in GRADE_POINTS)) continue;
      points += GRADE_POINTS[c.grade] * c.credits;
      hours += c.credits;
    }
    return hours ? { gpa: points / hours, hours } : { gpa: null, hours: 0 };
  }

  // Assigns counted courses to requirement blocks. A block fills in status order
  // (completed first); hours beyond what a block needs spill into electives,
  // since they still count toward the 120-hour total.
  function assignBlocks(counted, requirements) {
    const blocks = requirements.blocks.map((b) => ({ ...b, courses: [], overflow: [] }));
    const electives = [];
    for (const c of counted) {
      const block = blocks.find((b) => b.match.some((p) => matchesPrefix(c.requirement, p)));
      if (block) block.courses.push(c);
      else electives.push(c);
    }
    for (const b of blocks) {
      b.courses.sort((x, y) => statusRank(x.status) - statusRank(y.status));
      let filled = 0;
      const kept = [];
      for (const c of b.courses) {
        if (filled >= b.needed) b.overflow.push(c);
        else {
          kept.push(c);
          filled += c.credits;
        }
      }
      b.courses = kept;
      electives.push(...b.overflow);
      const s = byStatus(kept);
      b.completed = s.Completed;
      b.inProgress = s["In Progress"];
      b.planned = s.Planned;
      b.unplanned = Math.max(0, b.needed - b.completed - b.inProgress - b.planned);
      b.state = b.completed >= b.needed ? "done"
        : b.completed + b.inProgress >= b.needed ? "in-progress"
        : b.unplanned > 0 ? "gap"
        : "planned";
    }
    const e = byStatus(electives);
    const needed = Math.max(0, requirements.totalHours - blocks.reduce((n, b) => n + b.needed, 0));
    const unplanned = Math.max(0, needed - e.Completed - e["In Progress"] - e.Planned);
    return {
      blocks,
      electives: {
        id: "electives",
        group: "Electives",
        label: requirements.electivesLabel,
        needed,
        courses: electives,
        completed: e.Completed,
        inProgress: e["In Progress"],
        planned: e.Planned,
        unplanned,
        state: e.Completed >= needed ? "done" : unplanned > 0 ? "gap" : "planned",
      },
    };
  }

  // Sort key for a term label: "2016-2017" (transfer academic year),
  // "Spring 2026", "Fall 2026 (8W1)".
  function termKey(term) {
    const ay = /^(\d{4})-(\d{4})$/.exec(term || "");
    if (ay) return Number(ay[1]) + 0.7;
    const m = UNT_TERM.exec(term || "");
    if (m) return Number(m[2]) + { Spring: 0.1, Summer: 0.4, Fall: 0.7 }[m[1]];
    return Infinity;
  }

  function creditsByTerm(counted) {
    const map = new Map();
    for (const c of counted) {
      if (c.status !== "Completed" && c.status !== "In Progress") continue;
      const term = (c.term || "Unknown").replace(/\s*\(.*\)$/, "");
      const row = map.get(term) || { term, key: termKey(term), completed: 0, inProgress: 0, unt: isUntCourse(c) };
      if (c.status === "Completed") row.completed += c.credits;
      else row.inProgress += c.credits;
      map.set(term, row);
    }
    return [...map.values()].sort((a, b) => a.key - b.key);
  }

  function nextTerm(term, includeSummer) {
    const seq = includeSummer ? ["Spring", "Summer", "Fall"] : ["Spring", "Fall"];
    const i = seq.indexOf(term.season);
    if (i === -1 || i === seq.length - 1) return { season: seq[0], year: term.year + 1 };
    return { season: seq[i + 1], year: term.year };
  }

  // Lays the remaining hours over future terms at a steady pace, starting the
  // term after `current` (in-progress hours finish in `current`).
  function projectTerms(remainingHours, hoursPerTerm, includeSummer, current) {
    const terms = [];
    let left = remainingHours;
    let t = { season: current.season, year: current.year };
    while (left > 0 && hoursPerTerm > 0 && terms.length < 40) {
      t = nextTerm(t, includeSummer);
      const hours = Math.min(hoursPerTerm, left);
      terms.push({ label: `${t.season} ${t.year}`, hours });
      left -= hours;
    }
    return terms;
  }

  function currentTerm(counted, today) {
    const ip = counted.find((c) => c.status === "In Progress" && UNT_TERM.test(c.term || ""));
    if (ip) {
      const m = UNT_TERM.exec(ip.term);
      return { season: m[1], year: Number(m[2]) };
    }
    const d = today || new Date();
    const month = d.getUTCMonth();
    return { season: month < 5 ? "Spring" : month < 8 ? "Summer" : "Fall", year: d.getUTCFullYear() };
  }

  function dataChecks(courses, partitioned, summary) {
    const checks = [];
    for (const x of partitioned.excluded) {
      if (x.reason === "Duplicate row") {
        checks.push({ level: "warn", course: x.course, text: `Duplicate row for ${displayCode(x.course)} (${x.course.term || "planned"}). Only one copy is counted.` });
      } else if (x.reason === "Marked not needed") {
        checks.push({ level: "info", course: x.course, text: `${x.course.code} is marked not needed and is ignored. You can delete it in Notion.` });
      }
    }
    for (const c of partitioned.counted) {
      if (!c.requirement) {
        checks.push({ level: "warn", course: c, text: `${c.code} has no Requirement, so it counts only as an elective.` });
      }
      if (/verify/i.test(c.notes || "")) {
        checks.push({ level: "warn", course: c, text: `${c.code}: note asks to verify against the official UNT audit.` });
      }
    }
    if (summary.unassigned > 0) {
      checks.push({
        level: "critical",
        text: `Your plan reaches ${summary.total - summary.unassigned} of ${summary.total} hours. Add ${summary.unassigned} more hours (for example a free elective), or check the audit for transfer hours that are not in Notion.`,
      });
    }
    const advPlanned = summary.advanced.completed + summary.advanced.inProgress + summary.advanced.planned;
    if (advPlanned < summary.advanced.needed) {
      checks.push({ level: "critical", text: `Planned advanced hours reach ${advPlanned} of ${summary.advanced.needed}.` });
    }
    return checks;
  }

  function summarize(courses, requirements, options) {
    const opts = { hoursPerTerm: 12, includeSummer: false, today: undefined, ...options };
    const partitioned = partition(courses);
    const { counted } = partitioned;
    const status = byStatus(counted);
    const planTotal = status.Completed + status["In Progress"] + status.Planned;
    const unassigned = Math.max(0, requirements.totalHours - planTotal);
    const advancedCourses = counted.filter(isAdvanced);
    const adv = byStatus(advancedCourses);
    const { blocks, electives } = assignBlocks(counted, requirements);
    const current = currentTerm(counted, opts.today);
    const remaining = status.Planned + unassigned;
    const projection = projectTerms(remaining, opts.hoursPerTerm, opts.includeSummer, current);

    const summary = {
      total: requirements.totalHours,
      completed: status.Completed,
      inProgress: status["In Progress"],
      planned: status.Planned,
      unassigned,
      remaining: requirements.totalHours - status.Completed,
      percentComplete: status.Completed / requirements.totalHours,
      advanced: {
        needed: requirements.advancedHours,
        completed: adv.Completed,
        inProgress: adv["In Progress"],
        planned: adv.Planned,
      },
      gpa: {
        unt: gpa(counted.filter(isUntCourse)),
        transfer: gpa(counted.filter((c) => !isUntCourse(c))),
        all: gpa(counted),
      },
      currentTerm: `${current.season} ${current.year}`,
      projection,
      graduationTerm: projection.length ? projection[projection.length - 1].label : `${current.season} ${current.year}`,
    };

    return {
      summary,
      blocks,
      electives,
      counted,
      excluded: partitioned.excluded,
      terms: creditsByTerm(counted),
      checks: dataChecks(courses, partitioned, summary),
    };
  }

  return {
    partition,
    matchesPrefix,
    assignBlocks,
    summarize,
    projectTerms,
    courseLevel,
    isAdvanced,
    isUntCourse,
    gpa,
    termKey,
    creditsByTerm,
  };
});
