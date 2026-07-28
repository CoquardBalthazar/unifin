import React, { useState } from "react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log({ email, password });
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
