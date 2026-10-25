export async function api<T = any>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetchOrExplain(`/api/${path}`, {
    ...rest,
    ...(json !== undefined ? { method: rest.method ?? "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body as T;
}

/** A network failure means the server is down; say that instead of "Failed to fetch". */
async function fetchOrExplain(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error("Can't reach Paalam's server. Is it running? (npm start)");
  }
}

/** Records the microphone and returns 16 kHz mono WAV: a format Gemini reads directly, and small. */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  const startedAt = Date.now();
  return {
    startedAt,
    async stop(): Promise<File> {
      await new Promise<void>((r) => {
        rec.onstop = () => r();
        rec.stop();
      });
      stream.getTracks().forEach((t) => t.stop());
      const raw = await new Blob(chunks).arrayBuffer();
      const decoded = await new AudioContext().decodeAudioData(raw);
      const rate = 16000;
      const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
      const src = off.createBufferSource();
      src.buffer = decoded;
      src.connect(off.destination);
      src.start();
      const pcm = (await off.startRendering()).getChannelData(0);
      return new File([wav(pcm, rate)], `voice-note-${new Date().toTimeString().slice(0, 5).replace(":", "")}.wav`, { type: "audio/wav" });
    },
    cancel() {
      rec.stop();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

function wav(pcm: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return buf;
}

/** Carries out the browser half of an approved action. */
export async function runClient(client?: { open?: string; tel?: string; copy?: string; audio?: string | null; speak?: { text: string; lang: string } }) {
  if (!client) return;
  if (client.copy) await navigator.clipboard?.writeText(client.copy).catch(() => {});
  if (client.open) window.open(client.open, "_blank", "noopener");
  if (client.tel) window.location.href = `tel:${client.tel}`;
  if (client.audio) await new Audio(`data:audio/mp3;base64,${client.audio}`).play().catch(() => {});
  else if (client.speak && "speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(client.speak.text);
    u.lang = client.speak.lang;
    u.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}
