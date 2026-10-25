/** A plain, readable poster drawn without any model: the fallback when no image model is available. */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function wrap(text: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > max) {
      if (line) out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

export function posterSvg(headline: string, lines: string[]) {
  const head = wrap(headline, 22).slice(0, 3);
  const body = lines.flatMap((l) => wrap(l, 38).map((t, i) => (i === 0 ? `• ${t}` : `  ${t}`))).slice(0, 14);
  const h = 260 + head.length * 70 + body.length * 46;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8df7"/><stop offset=".5" stop-color="#8f6fe0"/><stop offset="1" stop-color="#d96f9a"/></linearGradient></defs>
<rect width="1080" height="${h}" fill="#0d0f1a"/><rect x="0" y="0" width="1080" height="16" fill="url(#g)"/>
<text x="70" y="120" font-family="Noto Sans Tamil, Noto Sans, Inter, sans-serif" font-size="30" fill="#f2a65a" font-weight="700" letter-spacing="3">⚠ PLEASE READ</text>
${head.map((t, i) => `<text x="70" y="${200 + i * 70}" font-family="Noto Sans Tamil, Noto Sans, Inter, sans-serif" font-size="60" font-weight="800" fill="#ffffff">${esc(t)}</text>`).join("")}
${body.map((t, i) => `<text x="70" y="${230 + head.length * 70 + i * 46}" font-family="Noto Sans Tamil, Noto Sans, Inter, sans-serif" font-size="34" fill="#d6d8e6">${esc(t)}</text>`).join("")}
<text x="70" y="${h - 40}" font-family="Inter, sans-serif" font-size="22" fill="#6c7187">Made with Paalam · check before you forward</text>
</svg>`;
}
