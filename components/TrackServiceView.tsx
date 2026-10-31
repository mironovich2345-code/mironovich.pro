"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import type { ServiceSlug } from "@/config/services";

/** Sends service_view once per visit of a service page. */
export default function TrackServiceView({ service }: { service: ServiceSlug }) {
  useEffect(() => {
    track("service_view", { service });
  }, [service]);
  return null;
}
