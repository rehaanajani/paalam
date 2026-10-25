/**
 * Ported from Socius's avatarMotion. One shared pointer listener and one animation
 * frame loop for every Gem face. Each frame writes `--mx`/`--my` (where its eyes
 * look, -1…1) and `--pull` (how strongly it leans toward a nearby pointer, 0…1).
 * CSS turns those into transforms. The loop sleeps when nothing moves, and nothing
 * runs under reduced motion.
 */
const tracked = new Set<HTMLElement>();
const looks = new WeakMap<HTMLElement, { x: number; y: number; p: number }>();
const IDLE_MS = 2600;
let pointer = { x: 0, y: 0, at: 0, inside: false };
let frame = 0,
  idleTimer = 0,
  listening = false,
  watching = false;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function kick() {
  if (!frame) frame = requestAnimationFrame(tick);
}
function onMove(e: PointerEvent) {
  pointer = { x: e.clientX, y: e.clientY, at: performance.now(), inside: true };
  kick();
}
function onLeave(e: PointerEvent | FocusEvent) {
  if ("relatedTarget" in e && e.relatedTarget) return;
  pointer.inside = false;
  kick();
}
function setWatching(next: boolean) {
  if (watching === next) return;
  watching = next;
  document.documentElement.classList.toggle("gems-watching", next);
}

function tick(now: number) {
  frame = 0;
  const live = pointer.inside && now - pointer.at < IDLE_MS;
  if (live) setWatching(true);
  const els = [...tracked];
  const rects = els.map((el) => el.getBoundingClientRect());
  let moving = false;
  els.forEach((el, i) => {
    const r = rects[i]!;
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
    let tx = 0,
      ty = 0,
      tp = 0;
    if (live) {
      const dx = pointer.x - (r.left + r.width / 2),
        dy = pointer.y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      const k = 1 / (d + r.width * 0.7);
      tx = dx * k;
      ty = dy * k;
      const reach = Math.max(r.width * 3, 120);
      tp = Math.max(0, 1 - d / reach) ** 2;
    }
    const look = looks.get(el) ?? { x: 0, y: 0, p: 0 };
    const ease = live ? 0.2 : 0.1;
    look.x += (tx - look.x) * ease;
    look.y += (ty - look.y) * ease;
    look.p += (tp - look.p) * ease;
    if (Math.abs(tx - look.x) > 0.003 || Math.abs(ty - look.y) > 0.003 || Math.abs(tp - look.p) > 0.003) moving = true;
    else Object.assign(look, { x: tx, y: ty, p: tp });
    looks.set(el, look);
    el.style.setProperty("--mx", look.x.toFixed(3));
    el.style.setProperty("--my", look.y.toFixed(3));
    el.style.setProperty("--pull", look.p.toFixed(3));
  });
  if (moving) kick();
  else if (!live) setWatching(false);
  clearTimeout(idleTimer);
  if (live) idleTimer = window.setTimeout(kick, IDLE_MS - (now - pointer.at));
}

function listen(on: boolean) {
  if (listening === on) return;
  listening = on;
  const method = on ? "addEventListener" : "removeEventListener";
  window[method]("pointermove", onMove as EventListener, { passive: true });
  document.documentElement[method]("pointerleave", onLeave as EventListener);
  window[method]("blur", onLeave as EventListener);
  if (!on) {
    cancelAnimationFrame(frame);
    clearTimeout(idleTimer);
    frame = 0;
    setWatching(false);
  }
}

/** Starts following the pointer with this face; returns the cleanup. */
export function trackGem(el: HTMLElement) {
  if (reducedMotion()) return () => {};
  tracked.add(el);
  listen(true);
  kick();
  return () => {
    tracked.delete(el);
    if (!tracked.size) listen(false);
  };
}
