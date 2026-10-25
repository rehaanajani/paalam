import { config, live } from "../config.js";
import { bearer } from "../google.js";
import { postJSON } from "./http.js";

const local: [string, RegExp, (m: string) => string][] = [
  ["Aadhaar", /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, (m) => `XXXX XXXX ${m.replace(/\D/g, "").slice(-4)}`],
  ["PAN", /\b[A-Z]{5}\d{4}[A-Z]\b/g, () => "XXXXX0000X"],
  ["phone", /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, (m) => `+91 XXXXX ${m.replace(/\D/g, "").slice(-5, -3)}XXX`],
  ["card", /\b(?:\d[ -]?){13,16}\b/g, () => "XXXX XXXX XXXX XXXX"],
  ["OTP", /\b(?:otp|OTP)[:\s]*\d{4,8}\b/g, () => "OTP ••••"],
];

/** Cloud DLP when the service account is set, otherwise the local Indian-ID patterns. */
export async function redact(text: string): Promise<{ text: string; found: string[]; engine: string }> {
  if (live.dlp) {
    try {
      const infoTypes = ["PHONE_NUMBER", "EMAIL_ADDRESS", "CREDIT_CARD_NUMBER", "INDIA_AADHAAR_INDIVIDUAL", "INDIA_PAN_INDIVIDUAL", "PERSON_NAME"].map((name) => ({ name }));
      const r = await postJSON(
        `https://dlp.googleapis.com/v2/projects/${config.gemini.project}/content:deidentify`,
        {
          item: { value: text },
          inspectConfig: { infoTypes, minLikelihood: "POSSIBLE" },
          deidentifyConfig: { infoTypeTransformations: { transformations: [{ primitiveTransformation: { replaceWithInfoTypeConfig: {} } }] } },
        },
        await bearer(),
      );
      const found = [...new Set<string>((r.overview?.transformationSummaries ?? []).filter((s: any) => s.transformedBytes > 0).map((s: any) => s.infoType?.name))];
      return { text: r.item?.value ?? text, found, engine: "Cloud DLP" };
    } catch (e) {
      console.warn("DLP failed, using local redaction:", (e as Error).message);
    }
  }
  const found: string[] = [];
  let out = text;
  for (const [name, re, mask] of local) {
    out = out.replace(re, (m) => {
      found.push(name);
      return mask(m);
    });
  }
  return { text: out, found: [...new Set(found)], engine: "local patterns" };
}
