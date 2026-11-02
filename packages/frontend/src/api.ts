const API = "/api";

function headers(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(API + path, { ...init, headers: headers() });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export const api = {
  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return send<T>(path, { signal });
  },
  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return send<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return send<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return send<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      signal,
    });
  },
};
