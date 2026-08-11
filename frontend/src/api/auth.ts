export async function login(email: string, password: string): Promise<string> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    // 401 is the only status that actually means "credentials rejected".
    // Everything else is an infrastructure problem and must say so.
    if (res.status === 401) throw new Error("INVALID_CREDENTIALS");
    throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  }

  const { token } = await res.json();

  // Store token to Client local storage
  localStorage.setItem("token", token);
  return token;
}

export function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function logout() {
  localStorage.removeItem("token");
}
