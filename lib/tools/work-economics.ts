/** The same H and C formulas for numeric legacy calculators and exact business-map decimals.
 * operations is TOTAL TEAM volume; callers convert per-person inputs explicitly.
 */
export function workHours<T>(operations: T, minutes: T, periods: T, mul: (a: T, b: T) => T, minutesToHours: (a: T) => T, legacyPeriodsFirst = false): T {
  const workload = mul(operations, minutes);
  // v2/v3 historically multiply periods before dividing; preserve Number rounding order.
  return legacyPeriodsFirst ? minutesToHours(mul(workload, periods)) : mul(minutesToHours(workload), periods);
}
export function timeValue<T>(hours: T, rate: T, mul: (a: T, b: T) => T): T { return mul(hours, rate); }
const multiply = (a: number, b: number) => a * b;
export const monthlyWorkHours = (teamOperations: number, minutes: number, periods: number, legacyPeriodsFirst = false) => workHours(teamOperations, minutes, periods, multiply, n => n / 60, legacyPeriodsFirst);
export const workTimeCost = (hours: number, rate: number) => timeValue(hours, rate, multiply);
