import "./setup.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { officialAlerts } from "../server/tools/sachet.js";

const now = Date.now();
const rss = `<rss><channel>
<item><link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=1</link><pubDate>${new Date(now - 3600e3).toUTCString()}</pubDate><author>imd (IMD Chennai)</author></item>
<item><link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=2</link><pubDate>${new Date(now - 3600e3).toUTCString()}</pubDate><author>imd (IMD Chennai)</author></item>
</channel></rss>`;
const cap = (event: string, area: string) => `<alert><sent>${new Date(now - 3600e3).toISOString()}</sent><info><language>en-IN</language><event>${event}</event><headline>${event} likely</headline><severity>Severe</severity><urgency>Immediate</urgency><expires>${new Date(now + 86400e3).toISOString()}</expires><area><areaDesc>${area}</areaDesc></area></info></alert>`;

test("official alerts are matched to the person's district", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const u = String(url);
    const body = u.endsWith("rss_india.xml") ? rss : u.endsWith("=1") ? cap("Heavy Rain", "Chennai, Chengalpattu, Tamil Nadu") : cap("Thunderstorm", "Madurai, Tamil Nadu");
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  try {
    const r = await officialAlerts("Velachery, Chennai, Tamil Nadu 600042", "Tamil Nadu");
    assert.deepEqual(r.here.map((a) => a.event), ["Heavy Rain"]);
    assert.deepEqual(r.elsewhereInState.map((a) => a.event), ["Thunderstorm"]);
    assert.equal(r.here[0]!.issuer, "IMD Chennai");
  } finally {
    globalThis.fetch = real;
  }
});
