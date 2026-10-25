/** Small fetch helpers with timeouts, so one slow API never stalls a run. */
export async function getJSON<T = any>(url: string, init: RequestInit = {}, ms = 9000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 180)}`);
    return (body ? JSON.parse(body) : {}) as T;
  } finally {
    clearTimeout(t);
  }
}

export const postJSON = <T = any>(url: string, body: unknown, headers: Record<string, string> = {}, ms?: number) =>
  getJSON<T>(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }, ms);
