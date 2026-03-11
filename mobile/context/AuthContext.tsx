import { useContext, createContext, useState, useEffect} from "react";
import {Text} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; //safeareaview ensures that no UI elements are hidden underneath things like the dynamic island and such 
import { account } from "@/lib/appwrite";
import { Models, ID } from "react-native-appwrite";

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
        account.deleteSession({
            sessionId: 'current'});
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
                <SafeAreaView>
                    <Text>loading...</Text>
                </SafeAreaView>
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