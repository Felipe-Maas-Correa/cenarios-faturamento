"use client";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/firebase";

export function Analytics() {
  useEffect(() => {
    initAnalytics().catch(() => {});
  }, []);
  return null;
}
