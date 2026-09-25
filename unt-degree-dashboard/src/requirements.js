// UNT BAAS (Bachelor of Applied Arts & Sciences) requirement map.
//
// Each block claims the courses whose Notion "Requirement" text starts with one of
// its `match` prefixes. `needed` is the hours the audit asks for. Confirm the
// totals against the official UNT degree audit; they are editable here only.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DegreeRequirements = factory();
})(typeof self !== "undefined" ? self : this, function () {
  return {
    degree: "Bachelor of Applied Arts & Sciences",
    school: "University of North Texas",
    totalHours: 120,
    advancedHours: 42, // 3000/4000-level hours required for the degree
    blocks: [
      // University Core
      { id: "comm", group: "University Core", label: "Communication", needed: 6,
        match: ["Communication: English Composition"] },
      { id: "math", group: "University Core", label: "Mathematics", needed: 3,
        match: ["Mathematics: University Core"] },
      { id: "lps", group: "University Core", label: "Life & Physical Sciences", needed: 6,
        match: ["Life & Physical Sciences"] },
      { id: "lpc", group: "University Core", label: "Language, Philosophy & Culture", needed: 3,
        match: ["Language, Philosophy & Culture"] },
      { id: "arts", group: "University Core", label: "Creative Arts", needed: 3,
        match: ["Creative Arts"] },
      { id: "amhist", group: "University Core", label: "American History", needed: 6,
        match: ["American History"] },
      { id: "gov", group: "University Core", label: "Government / Political Science", needed: 6,
        match: ["Government/Political Science"] },
      { id: "sbs", group: "University Core", label: "Social & Behavioral Science", needed: 3,
        match: ["Social & Behavioral Science"] },

      // BAAS major
      { id: "unifying", group: "BAAS Major", label: "Part I · Unifying courses", needed: 6,
        match: ["Applied Arts & Sciences Part I"] },
      { id: "baas4100", group: "BAAS Major", label: "Part II · BAAS 4100", needed: 3,
        match: ["Applied Arts & Sciences Part II"] },
      { id: "pdc-health", group: "BAAS Major", label: "Concentration · Health Studies", needed: 9,
        match: ["Professional Development Concentration — Health Studies"] },
      { id: "pdc-data", group: "BAAS Major", label: "Concentration · Data Analytics", needed: 9,
        match: ["Professional Development Concentration — Data Analytics"] },
      { id: "pdc-consumer", group: "BAAS Major", label: "Concentration · Consumer Behavior", needed: 12,
        match: ["Professional Development Concentration — Consumer Behavior"] },
      { id: "occ", group: "BAAS Major", label: "Part III · Occupational Specialization", needed: 21,
        match: ["Applied Arts & Sciences Part III"] },
    ],
    // Courses with no matching block count here, toward the 120-hour minimum.
    electivesLabel: "Electives & other applied hours",
  };
});
