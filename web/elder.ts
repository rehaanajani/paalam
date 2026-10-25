/**
 * Simple mode: a voice-first screen for elders. Saved on this device only, since it's
 * the phone in their hand that should open in simple mode, not every device.
 */
const KEY = "paalam.simple";

export interface SimplePrefs {
  on: boolean;
  /** language replies are read aloud in */
  lang: "ta-IN" | "en-IN" | "hi-IN";
  /** one family number for the big "Call family" button */
  family: string;
  familyName: string;
}

const defaults: SimplePrefs = { on: false, lang: "ta-IN", family: "", familyName: "" };

export function loadSimple(): SimplePrefs {
  let p = { ...defaults };
  try {
    p = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    // keep defaults
  }
  // A shared link like /?simple opens straight into simple mode on that phone.
  if (new URLSearchParams(location.search).has("simple")) {
    p.on = true;
    saveSimple(p);
  }
  return p;
}

export function saveSimple(p: SimplePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // private window: simple mode lasts until the tab closes
  }
}

let playing: HTMLAudioElement | null = null;

/** Reads text aloud in the chosen language: Cloud TTS through the server, else the browser's voice. */
export async function readAloud(text: string, lang: SimplePrefs["lang"]) {
  stopReading();
  try {
    const r = await fetch("/api/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, lang }) }).then((r) => r.json());
    if (r.audio) {
      playing = new Audio(`data:audio/mp3;base64,${r.audio}`);
      await playing.play();
      return;
    }
    browserVoice(r.text || text, lang);
  } catch {
    browserVoice(text, lang);
  }
}

function browserVoice(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export function stopReading() {
  playing?.pause();
  playing = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
