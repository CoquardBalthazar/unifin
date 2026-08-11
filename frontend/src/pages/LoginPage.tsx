import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../hooks/useAuth";

import { Eye, EyeOff } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { markLoggedIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    // guard — belt
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    // Logic
    try {
      await login(email, password);
      markLoggedIn();
      navigate("/", { replace: true }); // programmatic nav — useNavigate, not <Link>, since it's inside a handler + replace to remove Login from the URL array (cannot navigate back to it once logged in)
    } catch (err) {
      setError(
        err instanceof Error && err.message === "INVALID_CREDENTIALS"
          ? "Invalid email or password."
          : "Could not reach the server. Is the backend running?",
      );
    } finally {
      setIsSubmitting(false); // runs on BOTH paths — never forget one
    }
  }
  // ------ Tailwind CSS notes ------
  // grid min-h-screen place-items-center — the two-class centering idiom. place-items-center sets align-items + justify-items at once. Replaces the old flex-with-two-properties dance
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-serif text-3xl font-bold text-ink">Unifin</h1>
        <p className="mt-1 text-sm text-ink-muted">Personal bank tracker</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink-muted"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-border-strong px-3 py-2 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink-muted"
            >
              Password
            </label>

            {/* relative wrapper = the positioning context for the absolute button */}
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border-strong px-3 py-2 pr-10 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting} // ← disable the submit if issubmitting true
            className="w-full rounded bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}
