"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import type { SolutionSlug } from "@/config/solutions";

export default function TrackSolutionView({
  solution,
}: {
  solution: SolutionSlug;
}) {
  useEffect(() => {
    track("solution_view", { solution });
  }, [solution]);
  return null;
}
