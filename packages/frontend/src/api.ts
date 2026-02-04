const API = "/api";

function headers(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const r = await fetch(API + path, { headers: headers() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch(API + path, {
      method: "POST",
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    const r = await fetch(API + path, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};
