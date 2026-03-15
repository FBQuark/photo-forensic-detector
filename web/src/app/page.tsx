"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.replace("/home");
    } else {
      router.replace("/login");
    }
  }, [session, router]);

  return null;
}