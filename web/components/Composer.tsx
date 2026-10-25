import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, FileText, Image as ImageIcon, LocateFixed, Mic, Plus, Square, X, Music } from "lucide-react";
import { startRecording } from "../api";

type Recording = Awaited<ReturnType<typeof startRecording>>;

/** The chaos pane: type, talk, drop photos and documents, all at once. */
export function Composer({ busy, onSend, placeholder }: { busy: boolean; onSend: (text: string, files: File[], near?: { lat: number; lng: number }) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rec, setRec] = useState<Recording | null>(null);
  const [secs, setSecs] = useState(0);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs(Math.round((Date.now() - rec.startedAt) / 1000)), 250);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const add = (list: FileList | File[] | null) => list && setFiles((f) => [...f, ...Array.from(list)].slice(0, 8));

  async function toggleMic() {
    setErr("");
    if (rec) {
      const file = await rec.stop();
      setRec(null);
      setFiles((f) => [...f, file]);
      return;
    }
    try {
      setRec(await startRecording());
      setSecs(0);
    } catch {
      setErr("Microphone blocked. Allow it in the browser to record a voice note.");
    }
  }

  function locate() {
    if (near) return setNear(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setNear({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setErr("Couldn't get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function send() {
    if (busy || rec || (!text.trim() && !files.length)) return;
    onSend(text.trim(), files, near ?? undefined);
    setText("");
    setFiles([]);
  }

  const keys = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const icon = (f: File) => (f.type.startsWith("image/") ? <ImageIcon size={14} /> : f.type.startsWith("audio/") ? <Music size={14} /> : <FileText size={14} />);

  return (
    <div
      className={`composer ${drag ? "drag" : ""} ${rec ? "listening" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        add(e.dataTransfer.files);
      }}
    >
      {(files.length > 0 || near) && (
        <div className="attachments">
          {files.map((f, i) => (
            <span className="chip" key={`${f.name}-${i}`}>
              {icon(f)}
              <span className="chip-name">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            </span>
          ))}
          {near && (
            <span className="chip loc">
              <LocateFixed size={14} />
              {near.lat.toFixed(4)}, {near.lng.toFixed(4)}
            </span>
          )}
        </div>
      )}
      <textarea
        ref={area}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={keys}
        onPaste={(e) => add(e.clipboardData.files.length ? e.clipboardData.files : null)}
        placeholder={rec ? "Listening…" : (placeholder ?? "Paste the messy message, describe what's happening, or drop photos and documents…")}
        disabled={busy}
      />
      <div className="composer-tools">
        <input ref={input} type="file" multiple hidden accept="image/*,audio/*,application/pdf,text/plain" onChange={(e) => add(e.target.files)} />
        <button type="button" className="composer-plus" title="Add photos, documents or audio" onClick={() => input.current?.click()} disabled={busy}>
          <Plus size={18} />
        </button>
        <button type="button" className={`composer-mic ${near ? "on-loc" : ""}`} title="Share my location" onClick={locate} disabled={busy || locating}>
          <LocateFixed size={17} />
        </button>
        {err && <span className="composer-err">{err}</span>}
        <span className="grow" />
        <button type="button" className={`composer-mic ${rec ? "on" : ""}`} title={rec ? "Stop recording" : "Record a voice note"} onClick={toggleMic} disabled={busy}>
          {rec ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
        </button>
        {rec && <span className="rec-time">{secs}s</span>}
        <button type="button" className="send" onClick={send} disabled={busy || !!rec || (!text.trim() && !files.length)} aria-label="Send to Paalam">
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}
