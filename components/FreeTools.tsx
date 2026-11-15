import Link from "next/link";
import ToolCard from "./ToolCard";
import { tools } from "@/config/tools";

export default function FreeTools() {
  return (
    <section
      id="free-tools"
      className="bg-graphite px-[22px] py-14 min-[560px]:py-20"
    >
      <div className="mx-auto max-w-[1080px]">
        <h2 className="m-0 mb-5 font-display text-[clamp(30px,5vw,50px)] font-extrabold uppercase leading-tight text-cream">
          Бесплатные инструменты
        </h2>
        <p className="mb-8 max-w-[58ch] text-[16px] leading-relaxed text-cream/80">
          Оцените время и стоимость ручной работы до разговора о внедрении.
          Стоимость рабочего времени не равна денежной экономии.
        </p>
        <div className="grid gap-5 min-[760px]:grid-cols-2">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[14px] text-stone">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center underline underline-offset-4"
          >
            Каталог инструментов →
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-[44px] items-center underline underline-offset-4"
          >
            Цифровые продукты в подготовке →
          </Link>
        </div>
      </div>
    </section>
  );
}
