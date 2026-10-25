/**
 * Paalam on Telegram: message the bot like a person, with text, a voice note or a photo,
 * and the same Argon and Gems answer. Each chat is one Bridge, so it remembers.
 * Uses long polling (no public webhook needed), so it works on a laptop and on Cloud Run.
 * Turned on by TELEGRAM_BOT_TOKEN; off otherwise.
 */
import { config } from "./config.js";
import type { Evidence, Run } from "./types.js";

const API = () => `https://api.telegram.org/bot${config.telegram.token}`;

type Submit = (text: string, evidence: Evidence[], opts: { threadId: string; simple: boolean; near?: { lat: number; lng: number } }) => Promise<Run>;

/** Chats that asked for simple mode with /simple: short calm answers plus a spoken reply. */
const simpleChats = new Set<number>();
/** The last location a chat shared, used for its next messages. */
const lastPlace = new Map<number, { lat: number; lng: number }>();

async function call(method: string, body: Record<string, unknown> | FormData) {
  const init: RequestInit = body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const res = await fetch(`${API()}/${method}`, init);
  const r = await res.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Telegram ${method}: ${r.description ?? res.status}`);
  return r.result;
}

const say = (chat: number, text: string) => call("sendMessage", { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }).catch((e) => console.warn(String(e)));

async function download(fileId: string) {
  const f = await call("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegram.token}/${f.file_path}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The answer as one Telegram message: each Gem's reply, then the steps that need a tap. */
function render(run: Run) {
  if (run.stage === "error") return `Sorry, that didn't work: ${run.error ?? "unknown error"}. Please try again, or call 112 if it's an emergency.`;
  const parts: string[] = [];
  if (run.reply) parts.push(run.reply);
  for (const r of run.results) {
    const body = r.reply || r.summary;
    if (body) parts.push(body);
    if (r.plan) parts.push(r.plan.sections.map((s) => `${s.heading}\n${s.items.map((i) => `• ${i}`).join("\n")}`).join("\n\n"));
    const steps = r.actions
      .filter((a) => a.status === "awaiting")
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4)
      .map((a) => (a.kind === "call" && a.payload?.number ? `📞 ${a.title}: ${a.payload.number}` : `→ ${a.title}`));
    if (steps.length) parts.push(steps.join("\n"));
    const unverified = r.facts.filter((f) => f.verification !== "verified").length;
    if (unverified) parts.push(`(${unverified} detail${unverified === 1 ? "" : "s"} could not be verified; treat with care)`);
  }
  if (config.publicUrl) parts.push(`Full details and approvals: ${config.publicUrl}/#/bridge/${run.threadId}`);
  return parts.join("\n\n") || "I couldn't find anything to act on. Tell me a bit more?";
}

async function speakTo(chat: number, text: string, speak: (text: string) => Promise<string | null>) {
  const audio = await speak(text).catch(() => null);
  if (!audio) return;
  const form = new FormData();
  form.set("chat_id", String(chat));
  form.set("audio", new Blob([Buffer.from(audio, "base64")], { type: "audio/mpeg" }), "paalam.mp3");
  form.set("title", "Paalam");
  await call("sendAudio", form).catch((e) => console.warn(String(e)));
}

async function handle(msg: any, submit: Submit, speak: (text: string) => Promise<string | null>) {
  const chat: number = msg.chat.id;
  const text: string = msg.text ?? msg.caption ?? "";
  if (msg.location) {
    lastPlace.set(chat, { lat: msg.location.latitude, lng: msg.location.longitude });
    return say(chat, "Got your location. I'll use it for your next messages.");
  }
  if (/^\/start\b/.test(text))
    return say(chat, "Vanakkam! I'm Paalam. Send me what's happening: type it, send a voice note in any language, or a photo of a notice, prescription or forward. I'll check it and tell you what to do.\n\n/simple: short spoken answers (for elders)\n/full: normal answers\nShare your location (📎 → Location) for help nearby.\n\nIn an emergency, call 112 first.");
  if (/^\/simple\b/.test(text)) {
    simpleChats.add(chat);
    return say(chat, "Simple mode on: short, calm answers, read aloud.");
  }
  if (/^\/full\b/.test(text)) {
    simpleChats.delete(chat);
    return say(chat, "Normal answers again.");
  }

  const evidence: Evidence[] = [];
  const voice = msg.voice ?? msg.audio;
  if (voice) evidence.push({ id: "E1", kind: "audio", name: "voice-note.ogg", mimeType: voice.mime_type ?? "audio/ogg", data: (await download(voice.file_id)).toString("base64") });
  if (msg.photo?.length) {
    const biggest = msg.photo[msg.photo.length - 1];
    evidence.push({ id: `E${evidence.length + 1}`, kind: "image", name: "photo.jpg", mimeType: "image/jpeg", data: (await download(biggest.file_id)).toString("base64") });
  }
  if (msg.document && /^(image\/|application\/pdf)/.test(msg.document.mime_type ?? "")) {
    const kind = msg.document.mime_type === "application/pdf" ? "pdf" : "image";
    evidence.push({ id: `E${evidence.length + 1}`, kind, name: msg.document.file_name ?? "document", mimeType: msg.document.mime_type, data: (await download(msg.document.file_id)).toString("base64") });
  }
  if (!text && !evidence.length) return say(chat, "I can read text, voice notes, photos and PDFs.");

  await call("sendChatAction", { chat_id: chat, action: "typing" }).catch(() => {});
  await say(chat, "Checking this now…");
  const simple = simpleChats.has(chat);
  const near = lastPlace.get(chat);
  const run = await submit(text, evidence, { threadId: `tg-${chat}`, simple, ...(near ? { near } : {}) });
  const answer = render(run);
  await say(chat, answer);
  if (simple && run.stage === "done") await speakTo(chat, [run.reply, ...run.results.map((r) => r.reply || r.summary)].filter(Boolean).join(" "), speak);
}

/** Starts polling Telegram for messages. Safe to call when no token is set: it does nothing. */
export function startTelegram(submit: Submit, speak: (text: string) => Promise<string | null>) {
  if (!config.telegram.token) return false;
  let offset = 0;
  const loop = async () => {
    for (;;) {
      try {
        const updates: any[] = await call("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });
        for (const u of updates) {
          offset = u.update_id + 1;
          if (u.message) void handle(u.message, submit, speak).catch((e) => say(u.message.chat.id, `Sorry, something went wrong: ${(e as Error).message}`));
        }
      } catch (e) {
        console.warn(String(e));
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };
  void loop();
  return true;
}
