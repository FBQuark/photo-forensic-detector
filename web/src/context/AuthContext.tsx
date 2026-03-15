/*
Just converted the mobile code to web version - Joe
*/

"use client";

import { useContext, createContext, useState, useEffect} from "react";
import { account } from "@/lib/appwrite";
import { Models, ID } from "appwrite";

type AuthContextType = {
  session: true | null;
  user: Models.User<Models.Preferences> | null;
  signin: (args: { email: string; password: string }) => Promise<void>;
  signup:(args: {email: string, password:string, fullName:string}) => Promise<void>;
  signout: () => Promise<void>;
};
type AuthProviderProps = {
  children: React.ReactNode;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }: AuthProviderProps) => {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<true | null>(null);
    const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        checkAuth()
    }

    const checkAuth = async () => {
        try{
            const responseUser = await(account.get())
            setUser(responseUser)
            setSession(true)
        }catch(error){
            console.log(error)
        }
        setLoading(false)
    };

    const signin = async({email, password}: { email: string; password: string }) => {
        setLoading(true);
        try{
            await account.createEmailPasswordSession({email, password});
            const responseUser = await account.get()
            setUser(responseUser)
            setSession(true)
        }catch(error){
            console.log(error)
        }
        setLoading(false);
    };

    const signout = async() => {
        setLoading(true)
        await account.deleteSession({sessionId: 'current'});
        setSession(null)
        setUser(null)
        setLoading(false)
    };

    const signup = async ({
        email,
        password,
        fullName,
    }: {
        email:string;
        password:string;
        fullName:string;
    }) => {
        setLoading(true);
        try {
            await account.create({
                userId: ID.unique(),
                email,
                password,
                name: fullName
            });
        } catch(error){
            console.log(error)
        }
        setLoading(false)
    };

    const contextData = {session, user, signin, signout, signup};
    return (
        <AuthContext.Provider value={contextData}>
            {loading ? (
                <div className="min-h-screen bg-gray-300 flex items-center justify-center">
                    <p className="text-black text-xl">Loading...</p>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
};

export {useAuth, AuthContext, AuthProvider};