import { Slot, Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AuthLayout() {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}