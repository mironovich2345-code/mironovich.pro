import { careerConfig, CareerError, UUID_PATTERN } from "./config.ts";
export const careerFetcher: typeof fetch = async (input, init) => {
  const config = careerConfig();
  if (config.mode === "yookassa")
    return fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
  const target = new URL(process.env.CAREER_PROVIDER_FIXTURE_URL || "");
  if (
    target.protocol !== "http:" ||
    target.hostname !== "127.0.0.1" ||
    target.username ||
    target.password
  )
    throw new CareerError(503, "Неправильный локальный fixture");
  const original = new URL(String(input));
  if (
    original.origin !== "https://api.yookassa.ru" ||
    !/^\/v3\/(payments|refunds)(\/[a-f0-9-]+)?$/.test(original.pathname)
  )
    throw new CareerError(503, "Недопустимый fixture запрос");
  return fetch(new URL(original.pathname, target.origin), {
    ...init,
    signal: AbortSignal.timeout(10000),
  });
};
export async function completeLocalFixture(paymentId: string) {
  const config = careerConfig();
  if (config.mode !== "fixture" || !config.local)
    throw new CareerError(404, "Недоступно");
  if (!UUID_PATTERN.test(paymentId))
    throw new CareerError(400, "Неверный платёж");
  const u = new URL(process.env.CAREER_PROVIDER_FIXTURE_URL || "");
  if (u.protocol !== "http:" || u.hostname !== "127.0.0.1")
    throw new CareerError(503, "Неверный fixture");
  const r = await fetch(new URL("/fixture/complete/" + paymentId, u.origin), {
    method: "POST",
    headers: {
      "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET || "",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok)
    throw new CareerError(503, "Fixture не подтвердил тестовый платёж");
}
