// Ported from Socius's browser network boundary. Every address the browser or
// read_url is asked for is checked first, and every request the page makes is
// checked again, so a page can't reach this server, the LAN or cloud metadata.
import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // includes cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, prefix, "ipv6");

export function privateAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) return blocked.check(address, "ipv4");
  if (v !== 6) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  return mapped ? blocked.check(mapped, "ipv4") : blocked.check(address, "ipv6");
}

const LOCAL_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|ts\.net|home\.arpa)$/i;

export class NavigationBlocked extends Error {}
/** The domain has no DNS record at all: often a scam domain that's new, fake or already taken down. */
export class NoSuchDomain extends NavigationBlocked {}

/** Paalam's own practice pages are the one local address the browser may open. */
let practiceHost = "";
export const allowPractice = (port: number) => (practiceHost = `localhost:${port}`);
const isPractice = (u: URL) => !!practiceHost && u.host === practiceHost && u.pathname.startsWith("/practice/");

/** Checks a URL before any request is made. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NavigationBlocked("That isn't a valid web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new NavigationBlocked("Only http and https pages can be opened.");
  if (url.username || url.password) throw new NavigationBlocked("Addresses with embedded credentials are refused.");
  if (isPractice(url)) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) ? privateAddress(host) : LOCAL_NAMES.test(host) || !host.includes("."))
    throw new NavigationBlocked("Local and private-network addresses can't be opened.");
  return url;
}

const verdicts = new Map<string, boolean>();
/** Resolves the host and allows it only when every answer is public (a mixed answer is a rebinding attempt). */
export async function publicHost(url: URL): Promise<boolean> {
  if (isPractice(url)) return true;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const hit = verdicts.get(host);
  if (hit !== undefined) return hit;
  let ok = false;
  if (isIP(host)) ok = !privateAddress(host);
  else if (!LOCAL_NAMES.test(host) && host.includes("."))
    try {
      const all = await lookup(host, { all: true, verbatim: true });
      ok = all.length > 0 && !all.some((a) => privateAddress(a.address));
    } catch (e) {
      if (/ENOTFOUND|ENODATA/.test(String((e as any)?.code))) throw new NoSuchDomain(`${host} doesn't exist (no DNS record). Scam domains are often new, fake or already taken down`);
      ok = false;
    }
  verdicts.set(host, ok);
  return ok;
}

/** Collapses whitespace and clips text for a model. */
export function clipText(text: string, max: number) {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
