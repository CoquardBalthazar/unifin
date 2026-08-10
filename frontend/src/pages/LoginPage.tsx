import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { markLoggedIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await login(email, password);
      markLoggedIn();
      navigate("/"); // programmatic nav — useNavigate, not <Link>, since it's inside a handler
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <main className="flex flex-col gap-3 p-4">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-white"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
