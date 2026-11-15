"use client";

import React, { useEffect } from "react";
import { RestaurantProvider } from "@/context/RestaurantContext";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.update();
          console.log("Keivo POS PWA SW registered & checked for update:", reg.scope);
        })
        .catch((err) => console.log("Keivo POS SW registration error:", err));
    }
  }, []);

  return <RestaurantProvider>{children}</RestaurantProvider>;
}
