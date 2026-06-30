/**
 * Slugify a German area name: lowercase, transliterate umlauts/ß, collapse
 * everything else to single hyphens. Mirrors the hardcoded seed slugs
 * (e.g. "Side-Projects" → "side-projects"). Kept out of the "use server" actions
 * file because only async functions may be exported from there.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** First free slug for this user given the base name, suffixing -2, -3, … */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || "area";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}
