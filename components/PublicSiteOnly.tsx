"use client";
import { usePathname } from "next/navigation";

/** Prototype owns its chrome and never mounts analytics, attribution or consent storage. */
export default function PublicSiteOnly({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === "/prototype/business-map" || path.startsWith("/prototype/business-map/") ? null : children;
}
