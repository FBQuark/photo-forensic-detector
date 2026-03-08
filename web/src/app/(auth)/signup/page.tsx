"use client";

import { useState } from "react";
import Link from "next/link";
import { ID } from "appwrite";
import { account } from "@/lib/appwrite";

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const fullName = `${firstName} ${lastName}`;

      const user = await account.create({
        userId: ID.unique(),
        email: email,
        password: password,
        name: fullName
      });

      setMessage("Account created successfully.");

      console.log(user);

    } catch (error: any) {
      setMessage(error?.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Sign Up</h1>

      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <br />

        <input
          type="text"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <br />

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <br />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <br />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <br />

        <button type="submit" disabled={loading}>
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      {message && <p>{message}</p>}

      <p>
        Already have an account? <Link href="/">Log in</Link>
      </p>
    </div>
  );
}