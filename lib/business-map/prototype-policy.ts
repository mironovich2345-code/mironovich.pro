/** Explicit environment boundary. Production Railway always wins over every opt-in. */
export type PrototypeMode = "development" | "preview" | null;

export function prototypeMode(
  nodeEnv: string | undefined,
  enabled: string | undefined,
  railwayEnvironment: string | undefined,
  noindex: string | undefined,
): PrototypeMode {
  if (railwayEnvironment?.trim().toLowerCase() === "production") return null;
  if (nodeEnv === "development" && enabled === "1" && !railwayEnvironment) return "development";
  if (nodeEnv === "production" && railwayEnvironment === "preview" && enabled === "1" && noindex === "1") return "preview";
  return null;
}

export function prototypeAvailable(
  nodeEnv: string | undefined,
  enabled: string | undefined,
  railwayEnvironment?: string,
  noindex?: string,
): boolean {
  return prototypeMode(nodeEnv, enabled, railwayEnvironment, noindex) !== null;
}
