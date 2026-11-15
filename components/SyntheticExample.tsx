"use client";
import { useId, useState } from "react";
import type { SolutionSlug } from "@/config/solutions";
import { solutionExamples, syntheticLabel } from "@/config/solution-examples";

export default function SyntheticExample({
  solution,
}: {
  solution: SolutionSlug;
}) {
  const [selected, setSelected] = useState(0),
    id = useId();
  const examples = solutionExamples[solution],
    example = examples[selected];
  return (
    <details
      data-synthetic="true"
      data-nosnippet=""
      className="group mt-8 border border-graphite/25 bg-white/40"
    >
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium text-graphite [&::-webkit-details-marker]:hidden">
        Учебный пример на вымышленных данных{" "}
        <span aria-hidden className="text-xl text-maroon group-open:rotate-180">
          ↓
        </span>
      </summary>
      <div
        role="region"
        aria-label="Учебная демонстрация"
        className="border-t border-graphite/20 p-5 min-[560px]:p-7"
      >
        <p className="sticky top-[72px] z-10 m-0 mb-6 border-l-2 border-signal bg-cream py-3 pl-4 text-[14px] font-semibold leading-relaxed text-maroon">
          {syntheticLabel}
        </p>
        {examples.length > 1 ? (
          <>
            <label
              htmlFor={id}
              className="mb-2 block text-[13px] text-graphite"
            >
              Учебный сценарий
            </label>
            <select
              id={id}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="mb-5 min-h-[48px] w-full max-w-full border border-graphite/30 bg-cream px-3 text-[15px] text-graphite"
            >
              {examples.map((e, i) => (
                <option key={e.name} value={i}>
                  {e.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <h3 className="m-0 mb-5 text-[18px] font-semibold text-graphite">
            {example.name}
          </h3>
        )}
        <div aria-live="polite">
          <dl className="m-0 divide-y divide-graphite/15 border-y border-graphite/15">
            {example.rows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-2 py-4 min-[640px]:grid-cols-2 min-[640px]:gap-8"
              >
                <dt className="text-[14px] text-graphite/75">{label}</dt>
                <dd className="m-0 font-display text-[24px] font-bold leading-tight text-graphite">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mb-0 mt-5 text-[14px] leading-relaxed text-graphite/80">
            {example.explanation}
          </p>
        </div>
      </div>
    </details>
  );
}
