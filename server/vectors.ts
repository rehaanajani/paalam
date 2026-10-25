/** Small vector and keyword helpers shared by knowledge search and similar-report matching. */

export const cosine = (a: number[], b: number[]) => {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const STOP = new Set("a an the and or of to in on at for with is are was were be it this that from by as not no yes you your our we they he she i my me".split(" "));
export const terms = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOP.has(w));

/** Keyword overlap score in 0…1, used when embeddings aren't available. */
export function overlap(query: string, doc: string) {
  const q = new Set(terms(query));
  if (!q.size) return 0;
  const d = new Set(terms(doc));
  let hit = 0;
  for (const t of q) if (d.has(t)) hit++;
  return hit / q.size;
}

/** Straight-line distance in km. */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371,
    r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r,
    dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
