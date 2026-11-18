// Minimal JSON Schema checker for the v3 content schemas (type, required, additionalProperties,
// enum, const, pattern, minLength, minItems, minimum/maximum, format=date, anyOf).
// Mirrors scripts/career/validate-v3-content.mjs#schemaCheck; tests keep both in agreement.

type Rule = Record<string, unknown>;
const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return false;
  return new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value;
}

export function schemaIssues(rule: Rule, value: unknown, loc: string, issues: string[] = []): string[] {
  if (Array.isArray(rule.anyOf)) {
    const ok = (rule.anyOf as Rule[]).some((candidate) => schemaIssues(candidate, value, loc, []).length === 0);
    if (!ok) issues.push(loc + ": no valid anyOf branch");
    return issues;
  }
  const type = rule.type;
  if (type === "null" && value !== null) issues.push(loc + ": expected null");
  if (type === "boolean" && typeof value !== "boolean") issues.push(loc + ": expected boolean");
  if (type === "integer" && !Number.isInteger(value)) issues.push(loc + ": expected integer");
  if (type === "string" && typeof value !== "string") issues.push(loc + ": expected string");
  if (type === "array" && !Array.isArray(value)) issues.push(loc + ": expected array");
  if (type === "object" && !isObject(value)) issues.push(loc + ": expected object");
  if (rule.const !== undefined && value !== rule.const) issues.push(loc + ": bad constant");
  if (Array.isArray(rule.enum) && !rule.enum.includes(value)) issues.push(loc + ": invalid enum");
  if (type === "string" && typeof value === "string") {
    if (typeof rule.minLength === "number" && value.trim().length < rule.minLength) issues.push(loc + ": too short");
    if (typeof rule.pattern === "string" && !new RegExp(rule.pattern).test(value)) issues.push(loc + ": invalid pattern");
    if (rule.format === "date" && !isIsoDate(value)) issues.push(loc + ": bad date");
  }
  if (type === "integer" && typeof value === "number") {
    if (typeof rule.minimum === "number" && value < rule.minimum) issues.push(loc + ": below minimum");
    if (typeof rule.maximum === "number" && value > rule.maximum) issues.push(loc + ": above maximum");
  }
  if (type === "array" && Array.isArray(value)) {
    if (typeof rule.minItems === "number" && value.length < rule.minItems) issues.push(loc + ": missing required items");
    if (isObject(rule.items)) value.forEach((item, i) => schemaIssues(rule.items as Rule, item, `${loc}[${i}]`, issues));
  }
  if (type === "object" && isObject(value)) {
    for (const key of (rule.required as string[] | undefined) ?? [])
      if (!Object.hasOwn(value, key)) issues.push(`${loc}.${key}: missing`);
    const props = (rule.properties as Record<string, Rule> | undefined) ?? {};
    for (const [key, val] of Object.entries(value)) {
      if (!(key in props)) {
        if (rule.additionalProperties === false) issues.push(`${loc}.${key}: unknown property`);
      } else schemaIssues(props[key], val, `${loc}.${key}`, issues);
    }
  }
  return issues;
}
