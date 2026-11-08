"use client";
import type { ReactNode } from "react";
import type { GuidedInput } from "@/lib/tools/guided";
import CostWhyCalculator from "./CostWhyCalculator";

/** Stable public adapter. Legacy priorities remain off; no automatic OpenAI calls.
 * PR #9 can provide its separately gated component through the client result slot. */
export default function GuidedCalculator(props: {
 mode: "labor-cost" | "automation-cost";
 openAiAvailable?: boolean;
 resultExtension?: (input: GuidedInput) => ReactNode;
}) {
 return <CostWhyCalculator mode={props.mode} resultExtension={props.resultExtension} />;
}
