import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { api } from "../api";
import { enableNotifications, notificationState } from "../notify";
import { syncPhoneReminders } from "../mobile";

export interface Reminder {
  id: string;
  title: string;
  message: string;
  daily?: string;
  at?: string;
  nextAt: string;
  active: boolean;
}

const when = (r: Reminder) => {
  if (r.daily) return `Every day at ${r.daily}`;
  const d = new Date(r.at ?? r.nextAt);
  const today = d.toDateString() === new Date().toDateString();
  return `${today ? "Today" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/** The follow-ups a Gem set, each with an on/off switch. They were set without an approval because they only notify you. */
export function Reminders({ ids, threadId }: { ids: string[]; threadId: string }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [perm, setPerm] = useState(notificationState());
  useEffect(() => {
    api<Reminder[]>(`reminders?threadId=${threadId}`).then((all) => setItems(all.filter((r) => ids.includes(r.id))));
  }, [ids.join(","), threadId]);
  if (!items.length) return null;

  async function toggle(r: Reminder) {
    const next = await api<Reminder>(`reminders/${r.id}`, { method: "PATCH", json: { active: !r.active } });
    setItems((list) => list.map((x) => (x.id === r.id ? next : x)));
    void syncPhoneReminders().catch(() => {});
  }

  return (
    <div className="result-card reminders">
      <div className="result-head">
        <span>
          <BellRing size={14} /> Follow-ups
        </span>
        {perm === "default" && (
          <button type="button" className="ghost small-btn" onClick={async () => setPerm(await enableNotifications())}>
            Allow notifications
          </button>
        )}
        {perm === "denied" && <span className="small muted">Notifications are blocked in this browser</span>}
      </div>
      <ul>
        {items.map((r) => (
          <li key={r.id} className={r.active ? "" : "off"}>
            <div>
              <b>{r.title}</b>
              <span className="small muted">
                {when(r)} · {r.message}
              </span>
            </div>
            <button type="button" className={`switch ${r.active ? "on" : ""}`} role="switch" aria-checked={r.active} aria-label={r.active ? "Turn off" : "Turn on"} onClick={() => toggle(r)}>
              {r.active ? <BellRing size={13} /> : <BellOff size={13} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
