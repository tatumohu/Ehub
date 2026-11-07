export async function safeFetchJson<T = any>(url: string, options?: RequestInit, fallback: T = [] as any): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return fallback;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

export async function safeJson<T = any>(res: Response | null | undefined, fallback: T = null as any): Promise<T> {
  if (!res) return fallback;
  try {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}
