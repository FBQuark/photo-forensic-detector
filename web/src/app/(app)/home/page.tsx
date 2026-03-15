"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";


export default function HomePage() {
  const { user, signout } = useAuth();
  const [message, setMessage] = useState("");

  const handleSignout = async () => {
    try {
        await signout(); //send the signout command to auth to handle it
        setMessage("Logged Out");
        } catch(error : any){
            setMessage(error?.message || "Logout Failed"); //communicate with the user any errors that happen
            }
    }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-bold">
        Hello {user?.name || "User"}!
      </h1>
      <button onClick={handleSignout} className="w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-400 transition-colors mt-1">
                Logout
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}