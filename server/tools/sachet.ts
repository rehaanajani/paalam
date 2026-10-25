/**
 * India's official disaster alerts from NDMA's SACHET system (the Common Alerting
 * Protocol feed that IMD, CWC and the state disaster authorities publish to). No key
 * needed. Alerts are matched to a place by the districts and state named in each
 * alert's area. Feed and alert files are cached so many Gems can ask at once.
 */

const FEED = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml";
const UA = { "user-agent": "Mozilla/5.0 Paalam/0.1 (+public alert reader)" };

export interface OfficialAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  area: string;
  issuer: string;
  instruction: string;
  sent: string;
  expires: string;
  url: string;
}

let feedCache: { at: number; items: { id: string; url: string; date: number; author: string }[] } | null = null;
const alertCache = new Map<string, OfficialAlert | null>();

async function text(url: string, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) throw new Error(`SACHET ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<(?:cap:)?${name}[^>]*>([\\s\\S]*?)</(?:cap:)?${name}>`))?.[1]?.trim() ?? "";

async function feed() {
  if (feedCache && Date.now() - feedCache.at < 5 * 60 * 1000) return feedCache.items;
  const xml = await text(FEED);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const it = m[1]!;
    const url = tag(it, "link");
    return { id: url.match(/identifier=(\d+)/)?.[1] ?? url, url, date: Date.parse(tag(it, "pubDate")) || 0, author: tag(it, "author").match(/\(([^)]*)\)/)?.[1] ?? "" };
  });
  feedCache = { at: Date.now(), items };
  return items;
}

async function alert(item: { id: string; url: string; author: string }): Promise<OfficialAlert | null> {
  if (alertCache.has(item.id)) return alertCache.get(item.id)!;
  try {
    const xml = await text(item.url, 8000);
    // Each alert carries one <info> block per language; use the English one.
    const infos = [...xml.matchAll(/<(?:cap:)?info>([\s\S]*?)<\/(?:cap:)?info>/g)].map((m) => m[1]!);
    const info = infos.find((i) => /en/i.test(tag(i, "language"))) ?? infos[0] ?? "";
    const a: OfficialAlert = {
      id: item.id,
      event: tag(info, "event"),
      headline: tag(info, "headline"),
      severity: tag(info, "severity"),
      urgency: tag(info, "urgency"),
      area: tag(info, "areaDesc"),
      issuer: item.author || tag(xml, "sender"),
      instruction: tag(info, "instruction"),
      sent: tag(xml, "sent"),
      expires: tag(info, "expires"),
      url: item.url,
    };
    alertCache.set(item.id, a);
    return a;
  } catch {
    return null;
  }
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !/^(india|district|districts|road|main|street|nagar|cross|near|tamil|nadu)$/.test(w));

/**
 * Official alerts in force for a place. `place` is a free-text address ("Velachery,
 * Chennai, Tamil Nadu"); `state` is the state name. Returns alerts naming the person's
 * district or city first, then others in the same state.
 */
export async function officialAlerts(place: string, state: string) {
  const items = (await feed()).filter((i) => Date.now() - i.date < 36 * 3600 * 1000).slice(0, 60);
  const alerts: OfficialAlert[] = [];
  for (let i = 0; i < items.length; i += 8) alerts.push(...((await Promise.all(items.slice(i, i + 8).map(alert))).filter(Boolean) as OfficialAlert[]));
  const live = alerts.filter((a) => !a.expires || Date.parse(a.expires) > Date.now());
  const st = state.toLowerCase();
  const local = words(place);
  const inState = live.filter((a) => a.area.toLowerCase().includes(st) || a.issuer.toLowerCase().includes(st));
  const here = inState.filter((a) => local.some((w) => a.area.toLowerCase().includes(w)));
  // Repeated bulletins for the same area and event: keep the newest.
  const dedupe = (list: OfficialAlert[]) => [...new Map(list.sort((a, b) => b.sent.localeCompare(a.sent)).map((a) => [`${a.event}|${a.area}`, a])).values()];
  return { here: dedupe(here), elsewhereInState: dedupe(inState.filter((a) => !here.includes(a))), checked: live.length };
}
