export async function login(email: string, password: string): Promise<string> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("Invalid credentials");

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
