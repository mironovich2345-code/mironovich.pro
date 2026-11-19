"use client";
// Shared building blocks for the AI Career 3.0 cabinet: cream surface, near-black type,
// restrained red accent. Muted text uses #55524D (≈7:1 on cream) instead of the site's stone grey.
import type { ReactNode } from "react";

export const PROFESSION = "sales_manager";

export class ApiError extends Error {
  status: number;
  errors: { questionId: string; code: string; message: string }[];
  constructor(status: number, message: string, errors: ApiError["errors"] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, body === undefined
    ? { cache: "no-store" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let value: Record<string, unknown> = {};
  try { value = await r.json(); } catch { /* empty body */ }
  if (!r.ok) throw new ApiError(r.status, String(value.error ?? "Сервис временно недоступен"), (value.errors as ApiError["errors"]) ?? []);
  return value as T;
}
/** v2 endpoints reused for tester admission, sign-in and the synthetic test order. */
export const v2 = <T = Record<string, unknown>>(path: string, body?: unknown) => call<T>("/api/career/" + path, body);
/** v3 engine endpoints for the pilot profession. */
export const v3 = <T = Record<string, unknown>>(path: string, body?: unknown) => call<T>(`/api/career/v3/${PROFESSION}/${path}`, body);

export const muted = "text-[#55524D]";
export const card = "rounded-lg border border-graphite/15 bg-white/60 p-5 sm:p-6";
export const field = "min-h-11 w-full rounded-md border border-graphite/40 bg-white px-3 py-2 text-graphite";

export function Button({ children, variant = "primary", ...rest }: { children: ReactNode; variant?: "primary" | "secondary" | "quiet" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-graphite text-cream border border-graphite hover:bg-[#2a2a30]",
    secondary: "bg-transparent text-graphite border border-graphite/60 hover:border-signal",
    quiet: "bg-transparent text-graphite underline underline-offset-4 decoration-graphite/40 hover:decoration-signal px-1",
  }[variant];
  return (
    <button type="button" {...rest}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const style = tone === "error" ? "border-signal bg-white" : tone === "warn" ? "border-signal/70 bg-[#FBF6EC]" : "border-graphite/25 bg-white/70";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border-l-4 ${style} p-4 text-[15px] leading-relaxed`}>
      {children}
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id ? id + "-h" : undefined} className="mt-8">
      <h2 id={id ? id + "-h" : undefined} className="text-xl font-bold leading-snug sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full border border-signal px-3 py-0.5 text-[13px] font-semibold text-signal">{children}</span>;
}
