export async function fetchWithSession(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const requestInit: RequestInit = { ...init, credentials: "include" };
  const response = await fetch(input, requestInit);
  if (response.status !== 401) return response;

  const refreshResponse = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!refreshResponse.ok) return response;

  return fetch(input, requestInit);
}
