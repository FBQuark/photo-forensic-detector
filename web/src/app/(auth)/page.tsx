/*
converted the code to work with the auth context
spiffed up the UI a little bit - Joe
*/
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext"

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const { signin, signout, session } = useAuth();

/*  async function handleLogin(e: React.SubmitEvent<HTMLFormElement>) {
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
  }*/

//method to handle the user submitting login form/information
 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); //prevents the browser from refreshing on submission
    try{
        await signin({email, password}); //send the signin info to auth to handle it
        setMessage("Login Successful");
        } catch (error : any){
            setMessage(error?.message || "Login Failed"); //communicates with the user any errors that happen
            }
  };

//method to handle the user signing out of their account
const handleSignout = async () => {
    try {
        await signout(); //send the signout command to auth to handle it
        setMessage("Logged Out");
        } catch(error : any){
            setMessage(error?.message || "Logout Failed"); //communicate with the user any errors that happen
            }
    }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-300"> {/*centers the card and changes the background color*/}
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md"> {/*what gives the card effect*/}
          <h1 className="text-black text-center text-2xl mb-5">Login Page</h1>

          <form onSubmit={handleSubmit} className="text-black flex flex-col gap-4">
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
            <button type="submit" className="w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-400 transition-colors">
              Login
            </button>
          </form>

        {/*moved sign out button out of the form so clicking it won't trigger form submission
            and only shows logout button if a session exists*/}
        {session && (
            <button onClick={handleSignout} className="w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-400 transition-colors mt-1">
                Logout
            </button>
            )}

          {message && <p>{message}</p>}

          <p className="text-black text-center">
            Don't have an account? <Link href="/signup" className="text-blue-500">Sign up</Link>
          </p>
        </div>
    </div>
  );
}