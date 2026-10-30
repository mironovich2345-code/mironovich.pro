type Tone = "dark" | "light" | "maroon";

const tones: Record<Tone, { label: string; note: string }> = {
  dark: { label: "text-signal", note: "text-stone" },
  light: { label: "text-maroon", note: "text-graphite/65" },
  maroon: { label: "text-cream", note: "text-stone" },
};

/** The «01 / Раздел» kicker row that opens every editorial section. */
export default function SectionLabel({
  index,
  label,
  note,
  tone = "dark",
}: {
  index: string;
  label: string;
  note?: string;
  tone?: Tone;
}) {
  const t = tones[tone];
  return (
    <div className="mb-10 flex items-end justify-between gap-6 min-[560px]:mb-14">
      <p className={"m-0 text-[11px] uppercase tracking-[0.22em] " + t.label}>
        {index} <span className="text-signal">/</span> {label}
      </p>
      {note && <p className={"m-0 hidden text-[11px] uppercase tracking-[0.22em] min-[560px]:block " + t.note}>{note}</p>}
    </div>
  );
}
