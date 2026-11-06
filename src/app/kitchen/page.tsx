"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { KitchenWorkspace } from "@/components/kitchen/KitchenWorkspace";

export default function KitchenPage() {
  const router = useRouter();

  return (
    <KitchenWorkspace onNavigateHome={() => router.push("/")} />
  );
}
