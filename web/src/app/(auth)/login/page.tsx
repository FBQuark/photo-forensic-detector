/*
converted the code to work with the auth context
spiffed up the UI a little bit - Joe
*/
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const { signin, signout, session } = useAuth();

  //method to handle the user submitting login form/information
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault(); //prevents the browser from refreshing on submission
    try {
      await signin({ email, password }); //send the signin info to auth to handle it
      setMessage("Login Successful");
    } catch (error: any) {
      setMessage(error?.message || "Login Failed"); //communicates with the user any errors that happen
    }
  };

  //method to handle the user signing out of their account
  return (
    <div className="min-h-screen flex flex-row">
      {" "}
      <div className="w-1/4 md:w-1/3 lg:w-2/5 bg-gray-700 flex flex-col items-center justify-center gap-8 p-8">
        <h2 className="text-white text-3xl font-bold text-center leading-snug">
          Photo Forensic Detector
        </h2>{" "}
        <p className="text-gray-300 text-center text-sm">
          Detect suspicious information in images.
        </p>
        <div className="flex flex-col gap-6 items-center">
          {" "}
          <img
            src="/images/camera.png"
            alt="Camera"
            className="w-24 h-24 object-contain"
          />{" "}
          <img
            src="/images/magnifying-glass.png"
            alt="Magnifying Glass"
            className="w-24 h-24 object-contain"
          />{" "}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-300">
        {" "}
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          {" "}
          <h1 className="text-gray-700 font-bold text-center text-2xl mb-5">
            Login Page
          </h1>{" "}
          <form
            onSubmit={handleSubmit}
            className="text-black flex flex-col gap-4"
          >
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

            {/*form submission will trigger sign in*/}
            <button
              type="submit"
              className="w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Login
            </button>
          </form>
          {/*moved sign out button out of the form so clicking it won't trigger form submission
              and only shows logout button if a session exists*/}
          {message && <p>{message}</p>}
          <p className="text-black text-center">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-gray-700 font-bold">
              Sign up
            </Link>{" "}
          </p>
        </div>
      </div>
    </div>
  );
}
