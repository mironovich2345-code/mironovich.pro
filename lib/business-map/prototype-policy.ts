/** Hard development-only boundary. A flag can never open the prototype in production. */
export function prototypeAvailable(nodeEnv: string | undefined, enabled: string | undefined): boolean {
  return nodeEnv === "development" && enabled === "1";
}
