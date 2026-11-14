import { workHours, timeValue } from "../tools/work-economics.ts";
/** Exact rational decimal arithmetic, including repeating calendar factors. No rounding in formulas. */
export class Decimal {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint, d = 1n) {
    if (d === 0n) throw new RangeError("Деление на ноль");
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n, b = d;
    while (b) { const r = a % b; a = b; b = r; }
    this.n = n / (a || 1n); this.d = d / (a || 1n);
  }
  static from(value: number | string | Decimal): Decimal {
    if (value instanceof Decimal) return value;
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
    if (!match) throw new RangeError("Нужно конечное десятичное число");
    const scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
    const n = BigInt((match[1] || "") + match[2] + (match[3] ?? ""));
    return scale >= 0 ? new Decimal(n, 10n ** BigInt(scale)) : new Decimal(n * 10n ** BigInt(-scale));
  }
  add(v: number | Decimal): Decimal { const b = Decimal.from(v); return new Decimal(this.n * b.d + b.n * this.d, this.d * b.d); }
  sub(v: number | Decimal): Decimal { return this.add(Decimal.from(v).mul(-1)); }
  mul(v: number | Decimal): Decimal { const b = Decimal.from(v); return new Decimal(this.n * b.n, this.d * b.d); }
  div(v: number | Decimal): Decimal { const b = Decimal.from(v); return new Decimal(this.n * b.d, this.d * b.n); }
  cmp(v: number | Decimal): number { const b = Decimal.from(v), diff = this.n * b.d - b.n * this.d; return diff < 0n ? -1 : diff > 0n ? 1 : 0; }
  min(v: Decimal): Decimal { return this.cmp(v) <= 0 ? this : v; }
  number(): number {
    const numerator = Number(this.n), denominator = Number(this.d);
    if (Number.isFinite(numerator) && Number.isFinite(denominator)) return numerator / denominator;
    // Avoid Infinity/Infinity for valid very small JSON decimal inputs. Exact stays authoritative.
    const n = (this.n < 0n ? -this.n : this.n).toString(), d = this.d.toString();
    const significand = (s: string) => Number(`${s[0]}.${s.slice(1, 18)}`);
    return Number(`${this.n < 0n ? "-" : ""}${significand(n) / significand(d)}e${n.length - d.length}`);
  }
  /** Half up for nonnegative business quantities; used only at presentation boundary. */
  round(step: number): number {
    if (this.n < 0n) return -this.mul(-1).round(step);
    const unit = Decimal.from(step), q = this.div(unit);
    return new Decimal((2n * q.n + q.d) / (2n * q.d)).mul(unit).number();
  }
  exact(): string { return `${this.n}/${this.d}`; }
}
export const dec = Decimal.from;
export const hours = (operations: Decimal, minutes: Decimal, periods: Decimal) => workHours(operations, minutes, periods, (a, b) => a.mul(b), a => a.div(60));
export const timeCost = (h: Decimal, rate: Decimal) => timeValue(h, rate, (a, b) => a.mul(b));
