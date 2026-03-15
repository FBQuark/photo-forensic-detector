/*
converted the code to work with auth context
and spiffed up the UI a little bit - Joe
*/

"use client";

import { useState } from "react";
import Link from "next/link";
import { account } from "@/lib/appwrite";
import {useAuth} from "@/context/AuthContext"

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const {signup} = useAuth();

//method to handle sign up
  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); //prevents browser from refreshing on submission
    try{
        const fullName = `${firstName} ${lastName}`; //combines the first and last name into one text field
        await signup({email, password, fullName}); //sends info to auth for it to handle signuo
        setMessage("Account Created Successfully");
        }catch (error:any){
            setMessage(error?.message || "Sign Up Failed") //communicate to the user any errors
            }

    /*if (loading) return;

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
    }*/
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-300"> {/*centers the card and changes the background color*/}
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md"> {/*what gives the card effect*/}
          <h1 className="text-black text-center text-2xl mb-5">Sign Up</h1>

          <form onSubmit={handleSignup} className="text-black flex flex-col gap-4">
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

            {/*button will submit form due to being of type submit */}
            <button type="submit" className="w-full bg-gray-700 text-white py-2 rounded-md hover:bg-gray-400 transition-colors">
              Create Account
            </button>
          </form>

          {message && <p>{message}</p>}

          <p className="text-black text-center">
            Already have an account? <Link href="/" className="text-blue-500">Log in</Link>
          </p>
      </div>
    </div>
  );
}