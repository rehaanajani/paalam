import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { NavigationBlocked, checkUrl, clipText, publicHost } from "./net.js";

/**
 * Paalam's browser. Three levels, each safer than the last is powerful:
 *   readUrl  – fetch a page as text (no browser needed)
 *   browse   – open it in Chrome, read its text and its form fields, take a screenshot
 *   fillForm – fill a form a human approved, field by field, and STOP before submit
 * Submitting is a separate action that needs its own approval.
 */

const CHROME_PATHS = [
  process.env.PAALAM_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean) as string[];
const chromePath = () => CHROME_PATHS.find((p) => existsSync(p));
export const browserAvailable = () => !!chromePath();
/** Show the window on this computer (great for demos). Default: headless. */
const headful = () => process.env.PAALAM_BROWSER_HEADFUL === "1";

// Fields Paalam never types into, whatever a model or a payload says.
const FORBIDDEN_FIELD = /pass(word|code)?|\botp\b|one.?time|cvv|cvc|card.?(no|number)|credit|debit|upi.?pin|\bpin\b|mpin|net.?banking|security.?code|captcha/i;

// ── Screenshots are kept here and served by id, so they never bloat a run or reach a model ──
const shots = new Map<string, { png: Buffer; at: number }>();
export const getShot = (id: string) => shots.get(id)?.png;
function keepShot(png: Buffer) {
  const id = randomUUID().slice(0, 12);
  shots.set(id, { png, at: Date.now() });
  for (const [k, v] of shots) if (Date.now() - v.at > 60 * 60 * 1000) shots.delete(k);
  return id;
}

// ── One shared browser, one context per task ──
let browser: Browser | null = null;
async function open(): Promise<{ context: BrowserContext; page: Page }> {
  const path = chromePath();
  if (!path) throw new Error("No Chrome or Chromium found. Install Chrome, or set PAALAM_CHROME_PATH.");
  if (!browser?.isConnected()) {
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ executablePath: path, headless: !headful(), args: ["--no-first-run", "--disable-dev-shm-usage"] });
  }
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: "en-IN", acceptDownloads: false, serviceWorkers: "block" });
  // Every request the page makes is checked, not just the first URL.
  await context.route("**/*", async (route) => {
    try {
      const u = new URL(route.request().url());
      if ((u.protocol === "http:" || u.protocol === "https:") && (await publicHost(u))) return route.continue();
    } catch {
      /* fall through */
    }
    return route.abort("blockedbyclient");
  });
  return { context, page: await context.newPage() };
}

// ── Level 1: read a link as text ──
export async function readUrl(raw: string) {
  let url = checkUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    if (!(await publicHost(url))) throw new NavigationBlocked(`${url.host} resolves to a private address.`);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 Paalam/0.1 (+verification bot)", accept: "text/html,text/plain;q=0.9,*/*;q=0.5" } }).finally(() => clearTimeout(t));
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = checkUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!/text|html|json|xml/.test(type)) return { url: url.toString(), status: res.status, title: "", text: `(${type || "binary"} content, not read)` };
    const html = (await res.text()).slice(0, 600_000);
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
    const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1] ?? "";
    const text = html
      .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"');
    return { url: url.toString(), status: res.status, title, description, text: clipText(text, 3500) };
  }
  throw new NavigationBlocked("Too many redirects.");
}

// ── Level 2: open a page, read its text and form ──
export interface FormField {
  label: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  forbidden?: boolean;
}

async function readFields(page: Page): Promise<FormField[]> {
  // Sent as source text: the TS runner would otherwise inject helpers the page doesn't have.
  const fields = (await page.evaluate(`(() => {
    const labelOf = (el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]')?.textContent : null;
      const wrap = el.closest("label")?.textContent;
      return (byFor ?? wrap ?? el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.getAttribute("name") ?? "").replace(/\\s+/g, " ").trim();
    };
    return [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => {
        const t = (el.getAttribute("type") ?? "").toLowerCase();
        return !["hidden", "submit", "button", "reset", "image", "file"].includes(t) && el.offsetParent !== null;
      })
      .slice(0, 40)
      .map((el) => ({
        label: labelOf(el).slice(0, 80),
        name: el.getAttribute("name") ?? el.getAttribute("id") ?? "",
        type: el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : (el.getAttribute("type") ?? "text").toLowerCase(),
        required: el.hasAttribute("required"),
        ...(el.tagName === "SELECT" ? { options: [...el.options].map((o) => o.text.trim()).slice(0, 20) } : {}),
      }));
  })()`)) as FormField[];
  return fields.map((f) => (FORBIDDEN_FIELD.test(`${f.label} ${f.name}`) || f.type === "password" ? { ...f, forbidden: true } : f));
}

export async function browse(raw: string) {
  const url = checkUrl(raw);
  if (!(await publicHost(url))) throw new NavigationBlocked(`${url.host} resolves to a private address.`);
  const { context, page } = await open();
  try {
    const res = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    const title = await page.title();
    const text = clipText(await page.locator("body").innerText({ timeout: 3000 }).catch(() => ""), 2500);
    const fields = await readFields(page);
    const shotId = keepShot(await page.screenshot({ type: "jpeg", quality: 55 }));
    return { url: page.url(), status: res?.status() ?? 0, title, text, fields, shotId };
  } finally {
    await context.close();
  }
}

// ── Level 3: fill an approved form, never submit ──
export interface FillStep {
  field: string; // label, name or placeholder as browse() reported it
  value: string;
}

const held = new Map<string, { context: BrowserContext; page: Page; at: number }>();
setInterval(() => {
  for (const [k, v] of held) if (Date.now() - v.at > 15 * 60 * 1000) void v.context.close().then(() => held.delete(k));
}, 60_000).unref();

async function locate(page: Page, field: string) {
  const exact = page.getByLabel(field, { exact: true });
  if (await exact.count()) return exact.first();
  const loose = page.getByLabel(field);
  if (await loose.count()) return loose.first();
  const byName = page.locator(`[name="${field.replace(/"/g, '\\"')}"]`);
  if (await byName.count()) return byName.first();
  const byPlaceholder = page.getByPlaceholder(field);
  if (await byPlaceholder.count()) return byPlaceholder.first();
  return null;
}

export async function fillForm(raw: string, steps: FillStep[]) {
  const url = checkUrl(raw);
  if (!(await publicHost(url))) throw new NavigationBlocked(`${url.host} resolves to a private address.`);
  const { context, page } = await open();
  const filled: string[] = [];
  const refused: string[] = [];
  try {
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20000 });
    for (const step of steps.slice(0, 30)) {
      const el = await locate(page, step.field);
      if (!el) {
        refused.push(`${step.field}: not found`);
        continue;
      }
      const meta = { tag: await el.evaluate("n => n.tagName") as string, type: ((await el.getAttribute("type")) ?? "").toLowerCase(), name: (await el.getAttribute("name")) ?? "", auto: (await el.getAttribute("autocomplete")) ?? "" };
      if (meta.type === "password" || FORBIDDEN_FIELD.test(`${step.field} ${meta.name} ${meta.auto}`)) {
        refused.push(`${step.field}: Paalam never fills passwords, OTPs, PINs or card details`);
        continue;
      }
      if (meta.tag === "SELECT") await el.selectOption({ label: step.value }).catch(() => el.selectOption(step.value));
      else if (meta.type === "checkbox" || meta.type === "radio") {
        if (/^(true|yes|1|on|checked)$/i.test(step.value)) await el.check();
      } else await el.fill(step.value);
      filled.push(step.field);
    }
    const shotId = keepShot(await page.screenshot({ type: "jpeg", quality: 60, fullPage: true }));
    const holdId = randomUUID().slice(0, 12);
    held.set(holdId, { context, page, at: Date.now() });
    return { url: page.url(), filled, refused, shotId, holdId, visible: headful() };
  } catch (e) {
    await context.close();
    throw e;
  }
}

/** Presses the form's submit button on a page Paalam filled and is still holding. */
export async function submitForm(holdId: string) {
  const h = held.get(holdId);
  if (!h) throw new Error("That filled form is no longer open (it closes after 15 minutes). Fill it again.");
  const { page, context } = h;
  try {
    const button = page.getByRole("button", { name: /submit|send|file|register|apply|report/i }).or(page.locator('input[type="submit"], button[type="submit"]'));
    await button.first().click({ timeout: 5000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    const shotId = keepShot(await page.screenshot({ type: "jpeg", quality: 60 }));
    return { url: page.url(), title: await page.title(), shotId };
  } finally {
    held.delete(holdId);
    await context.close();
  }
}
