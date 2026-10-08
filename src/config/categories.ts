// Project categories, grouped by field (phase 8A: every kind of artist, not only animation).
// Labels live in messages/{en,ar}.json → projects.categories and projects.categoryGroups.
export const CATEGORY_GROUPS = [
  { id: "animation", items: ["2d-animation", "3d-animation", "motion", "storyboard", "character-design", "background", "direction"] },
  { id: "illustration", items: ["illustration", "comics", "concept-art"] },
  { id: "design", items: ["graphic-design", "branding", "ui-ux", "packaging", "product-design", "type-design"] },
  { id: "photo", items: ["photography", "film"] },
  { id: "space", items: ["architecture", "interior", "visualization"] },
  { id: "fashion", items: ["fashion", "jewelry", "textile"] },
  { id: "art", items: ["painting", "sculpture", "calligraphy", "ceramics", "street-art", "crafts"] },
  { id: "games", items: ["3d", "game-art"] },
  { id: "sound", items: ["music", "sound", "performance"] },
  { id: "words", items: ["writing"] },
  { id: "other", items: ["personal", "other"] },
] as const;

export type CategoryId = (typeof CATEGORY_GROUPS)[number]["items"][number];
