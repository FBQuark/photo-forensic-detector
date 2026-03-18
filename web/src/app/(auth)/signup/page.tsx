/*
converted the code to work with auth context
and spiffed up the UI a little bit - Joe
*/

"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const { signup } = useAuth();

  //method to handle sign up
  async function handleSignup(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault(); //prevents browser from refreshing on submission
    try {
      const fullName = `${firstName} ${lastName}`; //combines the first and last name into one text field
      await signup({ email, password, fullName }); //sends info to auth for it to handle signuo
      setMessage("Account Created Successfully");
    } catch (error: any) {
      setMessage(error?.message || "Sign Up Failed"); //communicate to the user any errors
    }
  }

  return (
    <div className="min-h-screen flex flex-row">
      <div className="w-1/4 md:w-1/3 lg:w-2/5 bg-gray-700 flex flex-col items-center justify-center gap-8 p-8">
        <h2 className="text-white text-3xl font-bold text-center leading-snug">
          Photo Forensic Detector
        </h2>
        <p className="text-gray-300 text-center text-sm">
          Detect suspicious information in images.
        </p>
        <div className="flex flex-col gap-6 items-center">
          <img
            src="/images/camera.png"
            alt="Camera"
            className="w-24 h-24 object-contain"
          />
          <img
            src="/images/magnifying-glass.png"
            alt="Magnifying Glass"
            className="w-24 h-24 object-contain"
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-300">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-gray-700 font-bold text-center text-2xl mb-5">
            Sign Up
          </h1>

          <form
            onSubmit={handleSignup}
            className="text-black flex flex-col gap-4"
          >
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="border border-gray-400 rounded-md p-2"
            />

            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="border border-gray-400 rounded-md p-2"
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border border-gray-400 rounded-md p-2"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border border-gray-400 rounded-md p-2"
            />

            <button
              type="submit"
              className="w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Create Account
            </button>
          </form>

          {message && <p>{message}</p>}

          <p className="text-black text-center">
            Already have an account?{" "}
            <Link href="/" className="text-gray-700 font-bold">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
