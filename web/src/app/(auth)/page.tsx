"use client";

import { useState } from "react";
import Link from "next/link";
import { account } from "@/lib/appwrite";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const result = await account.createEmailPasswordSession({
        email,
        password
      });

      console.log(result);

      setMessage("Login successful.");

    } catch (error: any) {
      setMessage(error?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Login Page</h1>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
        <button
        onClick={async () => {
          try {
            await account.deleteSession(
              {
                sessionId: "current"
              });
            setMessage("Logged out.");
          } catch (error: any) {
            setMessage(error?.message || "Logout failed.");
          }
        }}
      >
        Logout
      </button>
      </form>

      {message && <p>{message}</p>}

      <p>
        Don't have an account? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}