import type { Express } from "express";

/**
 * A practice form for the browser demo. It is plainly Paalam's own page, not a
 * copy of any government site, and a submission goes nowhere.
 */
const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Practice form: report a suspicious message (Paalam demo)</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;background:#f4f4f6;color:#16161c;margin:0;padding:32px 16px}
main{max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e3e8;border-radius:16px;padding:24px 26px}
.banner{background:#fdf3e2;color:#8a4b06;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:18px}
h1{font-size:20px;margin:0 0 4px} p.sub{color:#5b5d68;margin:0 0 18px;font-size:14px}
label{display:block;font-weight:600;font-size:13px;margin:14px 0 4px}
input,select,textarea{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d4d4da;border-radius:10px;font:inherit}
textarea{min-height:90px} .check{display:flex;gap:8px;align-items:center;font-weight:500}.check input{width:auto}
button{margin-top:18px;padding:10px 18px;border:0;border-radius:10px;background:#16161c;color:#fff;font-weight:600;font-size:15px}
</style></head><body><main>
<div class="banner">Practice form for the Paalam demo. This is not a government website and nothing you submit here is sent anywhere.</div>
${body}
</main></body></html>`;

export function practiceRoutes(app: Express) {
  app.get("/practice/complaint", (_req, res) => {
    res.type("html").send(
      page(`<h1>Report a suspicious message</h1><p class="sub">Practice version of a cybercrime-style complaint form.</p>
<form method="post" action="/practice/complaint">
<label for="name">Your name</label><input id="name" name="name" required>
<label for="phone">Mobile number</label><input id="phone" name="phone" inputmode="tel">
<label for="category">Type of incident</label><select id="category" name="category" required>
<option value="">Choose…</option><option>Phishing link</option><option>Fake relief or scheme</option><option>Fake job offer</option><option>Fraudulent call</option><option>Other</option></select>
<label for="url">Suspicious link or number</label><input id="url" name="url">
<label for="when">When did you receive it?</label><input id="when" name="when" type="date">
<label for="details">What happened?</label><textarea id="details" name="details" required></textarea>
<label for="otp">OTP sent to your phone</label><input id="otp" name="otp" autocomplete="one-time-code">
<label class="check"><input type="checkbox" id="confirm" name="confirm" required> I confirm the details are true</label>
<button type="submit">Submit complaint</button></form>`),
    );
  });
  app.post("/practice/complaint", (_req, res) => {
    res.type("html").send(page(`<h1>Practice submission received</h1><p class="sub">Reference PRACTICE-${Date.now().toString(36).toUpperCase()}. Nothing was sent anywhere: this is the Paalam demo form.</p>`));
  });
}
