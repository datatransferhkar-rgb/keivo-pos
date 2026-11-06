"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { TableMonitorWorkspace } from "@/components/tables/TableMonitorWorkspace";

export default function TablesPage() {
  const router = useRouter();

  return (
    <TableMonitorWorkspace
      onNavigateHome={() => router.push("/")}
      onOpenPos={() => router.push("/pos")}
    />
  );
}
