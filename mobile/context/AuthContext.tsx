import { useContext, createContext, useState, useEffect } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { account } from "@/lib/appwrite";
import { Models, ID } from "react-native-appwrite";

type AuthContextType = {
  session: boolean;
  user: Models.User<Models.Preferences> | null;
  signin: (args: { email: string; password: string }) => Promise<void>;
  signup: (args: { email: string; password: string; fullName: string }) => Promise<void>;
  signout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(false);
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const responseUser = await account.get();
      setUser(responseUser);
      setSession(true);
    } catch {
      setUser(null);
      setSession(false);
    } finally {
      setLoading(false);
    }
  };

  const signin = async ({ email, password }: { email: string; password: string }) => {
    setLoading(true);
    try {
      await account.createEmailPasswordSession(email, password);
      const responseUser = await account.get();

      setUser(responseUser);
      setSession(true);
    } catch (error: any) {
      throw new Error(error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const signup = async ({ email, password, fullName }: any) => {
    setLoading(true);
    try {
      await account.create(ID.unique(), email, password, fullName);
      await account.createEmailPasswordSession(email, password);

      const responseUser = await account.get();
      setUser(responseUser);
      setSession(true);
    } catch (error: any) {
      throw new Error(error?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const signout = async () => {
    setLoading(true);
    try {
      await account.deleteSession("current");
    } finally {
      setUser(null);
      setSession(false);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, signin, signout, signup }}>
      {loading ? (
        <SafeAreaView>
          <Text>Loading...</Text>
        </SafeAreaView>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};