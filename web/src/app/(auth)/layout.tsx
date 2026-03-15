"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.replace("/home");
    }
  }, [session, router]);

  if (session) return null;

  return <>{children}</>;
}