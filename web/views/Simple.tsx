import { useEffect, useRef, useState } from "react";
import { Mic, Phone, RotateCcw, Square, Volume2 } from "lucide-react";
import { api, startRecording } from "../api";
import { Gem } from "../components/Gem";
import { readAloud, stopReading, type SimplePrefs } from "../elder";
import type { ActionCard, Run } from "../types";

const words = {
  "ta-IN": { hint: "பொத்தானைத் தொட்டு, என்ன நடந்தது என்று சொல்லுங்கள்", talk: "பேசுங்கள்", listening: "கேட்கிறேன்… முடிந்ததும் மீண்டும் தொடுங்கள்", thinking: "யோசிக்கிறேன்…", again: "மீண்டும் கேளுங்கள்", sos: "அவசர உதவி 112", family: "குடும்பத்தை அழை", type: "அல்லது இங்கே எழுதுங்கள்", send: "அனுப்பு", call: "அழை" },
  "hi-IN": { hint: "बटन दबाइए और बताइए क्या हुआ", talk: "बोलिए", listening: "सुन रहा हूँ… पूरा होने पर फिर दबाएँ", thinking: "सोच रहा हूँ…", again: "फिर से सुनें", sos: "आपातकाल 112", family: "परिवार को कॉल करें", type: "या यहाँ लिखिए", send: "भेजें", call: "कॉल" },
  "en-IN": { hint: "Tap the button and tell me what happened", talk: "Talk", listening: "Listening… tap again when you're done", thinking: "Thinking…", again: "Hear it again", sos: "Emergency 112", family: "Call family", type: "or type here", send: "Send", call: "Call" },
};
const langs: [SimplePrefs["lang"], string][] = [["ta-IN", "தமிழ்"], ["en-IN", "English"], ["hi-IN", "हिन्दी"]];

/** Everything a run has said so far, in order: Argon's direct reply, then each Gem's. */
const repliesOf = (run: Run) => [...(run.reply ? [run.reply] : []), ...run.results.map((r) => r.reply || r.summary).filter(Boolean)];

/** Where the phone is, if it says within a few seconds: matters most in an emergency. */
const here = () =>
  new Promise<GeolocationCoordinates | null>((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { timeout: 4000, maximumAge: 120000 });
  });

/**
 * Simple mode: one big button to talk, the answer in large type read aloud, and
 * emergency calls one tap away. For elders and anyone who'd rather not read a chat.
 */
export function Simple({ prefs, onPrefs, onExit }: { prefs: SimplePrefs; onPrefs: (p: SimplePrefs) => void; onExit: () => void }) {
  const t = words[prefs.lang];
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [run, setRun] = useState<Run | null>(null);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const rec = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const spoken = useRef(0);
  const threadId = useRef<string | undefined>(undefined);

  useEffect(() => () => stopReading(), []);

  // Follow the run and read each new answer aloud as it arrives.
  useEffect(() => {
    if (!run || run.stage === "done" || run.stage === "error") return;
    const poll = setInterval(async () => {
      const r = await api<Run>(`runs/${run.id}`).catch(() => null);
      if (!r) return;
      setRun(r);
      const said = repliesOf(r);
      if (said.length > spoken.current) {
        void readAloud(said.slice(spoken.current).join(" "), prefs.lang);
        spoken.current = said.length;
      }
      if (r.stage === "done" || r.stage === "error") {
        setState("idle");
        if (r.stage === "error") setErr(r.error ?? "Something went wrong");
      }
    }, 1200);
    return () => clearInterval(poll);
  }, [run?.id, run?.stage, prefs.lang]);

  async function send(text: string, files: File[]) {
    setState("thinking");
    setErr("");
    stopReading();
    spoken.current = 0;
    const form = new FormData();
    form.set("text", text);
    files.forEach((f) => form.append("files", f));
    form.set("simple", "1");
    form.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (threadId.current) form.set("threadId", threadId.current);
    const at = await here();
    if (at) {
      form.set("lat", String(at.latitude));
      form.set("lng", String(at.longitude));
    }
    try {
      const r = await api<{ id: string; threadId: string }>("runs", { method: "POST", body: form });
      threadId.current = r.threadId;
      setRun(await api<Run>(`runs/${r.id}`));
    } catch (e) {
      setErr((e as Error).message);
      setState("idle");
    }
  }

  async function talk() {
    if (state === "thinking") return;
    if (state === "listening" && rec.current) {
      const file = await rec.current.stop();
      rec.current = null;
      return send("", [file]);
    }
    try {
      stopReading();
      rec.current = await startRecording();
      setState("listening");
    } catch {
      setErr("The microphone is blocked. Allow it in the browser, or type below.");
    }
  }

  // A verified number from a Gem becomes a big call button. The tap is the approval.
  const calls = (run?.results ?? []).flatMap((r) => r.actions).filter((a) => a.kind === "call" && a.payload?.number && a.status === "awaiting");
  function call(a: ActionCard) {
    window.location.href = `tel:${String(a.payload.number).replace(/[^\d+]/g, "")}`;
    void api(`runs/${run!.id}/actions/${a.id}`, { json: { approve: true } }).catch(() => {});
  }

  const replies = run ? repliesOf(run) : [];
  return (
    <div className="simple">
      <header className="simple-top">
        <span className="simple-brand">
          <Gem argon size={34} name="simple" /> Paalam
        </span>
        <div className="simple-langs" role="group" aria-label="Language">
          {langs.map(([code, label]) => (
            <button key={code} type="button" aria-pressed={prefs.lang === code} onClick={() => onPrefs({ ...prefs, lang: code })}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="simple-exit" onClick={onExit}>
          Full app
        </button>
      </header>

      <div className="simple-calls">
        <a className="simple-sos" href="tel:112">
          <Phone size={26} /> {t.sos}
        </a>
        {prefs.family && (
          <a className="simple-family" href={`tel:${prefs.family.replace(/[^\d+]/g, "")}`}>
            <Phone size={24} /> {prefs.familyName || t.family}
          </a>
        )}
      </div>

      <button type="button" className={`simple-talk ${state}`} onClick={talk} disabled={state === "thinking"} aria-label={state === "listening" ? "Stop and send" : t.talk}>
        {state === "listening" ? <Square size={64} /> : <Mic size={72} />}
        <span>{state === "listening" ? t.listening : state === "thinking" ? t.thinking : t.talk}</span>
      </button>
      {!run && state === "idle" && <p className="simple-hint">{t.hint}</p>}

      {err && <p className="simple-err">{err}</p>}

      {replies.length > 0 && (
        <section className="simple-answer" aria-live="polite">
          {replies.map((r, i) => (
            <p key={i}>{r}</p>
          ))}
          <button type="button" onClick={() => void readAloud(replies.join(" "), prefs.lang)}>
            <Volume2 size={24} /> {t.again}
          </button>
        </section>
      )}

      {calls.length > 0 && (
        <div className="simple-calls">
          {calls.map((a) => (
            <button key={a.id} type="button" className="simple-family" onClick={() => call(a)}>
              <Phone size={24} /> {t.call}: {a.title}
            </button>
          ))}
        </div>
      )}

      <form
        className="simple-type"
        onSubmit={(e) => {
          e.preventDefault();
          if (!typed.trim() || state !== "idle") return;
          void send(typed.trim(), []);
          setTyped("");
        }}
      >
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.type} aria-label={t.type} />
        <button type="submit" disabled={!typed.trim() || state !== "idle"}>
          {t.send}
        </button>
        {run && (
          <button type="button" className="simple-new" aria-label="Start over" title="Start over" onClick={() => { stopReading(); setRun(null); threadId.current = undefined; }}>
            <RotateCcw size={20} />
          </button>
        )}
      </form>
    </div>
  );
}
