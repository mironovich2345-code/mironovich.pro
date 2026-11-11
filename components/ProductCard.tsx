import Image from "next/image";
import Link from "next/link";
import type { DigitalProduct } from "@/content/products";
export default function ProductCard({product:p}:{product:DigitalProduct}) {
 return <article className="flex min-w-0 flex-col border-t border-cream/25 pt-6">
  <Link href={"/products/"+p.slug} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"><Image src={p.cover} width={960} height={640} alt={"Обложка будущего материала: "+p.title} className="h-auto w-full"/></Link>
  <p className="mb-3 mt-6 text-sm text-stone">{p.audience} · Готовится</p>
  <h2 className="m-0 text-balance font-display text-3xl font-extrabold uppercase leading-tight"><Link href={"/products/"+p.slug}>{p.title}</Link></h2>
  <p className="text-base leading-relaxed text-cream/80">{p.problem}</p><p className="text-sm leading-relaxed text-stone">{p.outcome}</p>
  <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5"><p className="m-0 text-lg">{p.plannedPrice} ₽ <span className="block text-sm text-stone">планируемая стоимость</span></p><Link href={"/products/"+p.slug} className="inline-flex min-h-[48px] items-center px-4 text-sm underline underline-offset-4">Что будет внутри →</Link></div>
 </article>;
}
