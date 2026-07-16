
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // Dedupe concurrent 401s so multiple simultaneous requests don't each
  // trigger their own refresh call.
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Drop-in replacement for fetch() against our own API routes. On a 401,
// attempts one silent refresh via /api/auth/refresh, then retries the
// original request once. If refresh itself fails, redirects to /login.
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return res;
  }

  return fetch(input, init);
}