"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [session, router]);

  if (!session) return null;

  return <>{children}</>;
}