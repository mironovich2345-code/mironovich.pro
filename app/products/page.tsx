import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import { products } from "@/content/products";
import { pageMetadata, breadcrumbList } from "@/lib/seo";
import { jsonLd } from "@/lib/jsonld";
export const metadata:Metadata=pageMetadata({title:"Продукты: интерактивные инструменты об ИИ — MIRONOVICH",description:"Будущие интерактивные продукты для специалистов и руководителей: навыки в эпоху ИИ и выбор задач для автоматизации. Оба материала готовятся.",path:"/products"});
const crumbs=[{name:"Главная",href:"/"},{name:"Продукты",href:"/products"}];
export default function Products(){return <main id="main" className="bg-graphite px-[22px] pb-20 pt-8"><div className="mx-auto max-w-[1080px]"><Breadcrumbs items={crumbs}/><h1 className="mb-6 mt-10 font-display text-[clamp(38px,7vw,76px)] font-extrabold uppercase leading-none">Продукты<span className="text-signal">.</span></h1><p className="mb-12 max-w-[65ch] text-lg leading-relaxed text-stone">Интерактивные продукты для работы с ИИ и осмысленной автоматизации. Пока они разрабатываются: можно изучить их назначение и планируемые возможности.</p><div className="grid gap-12 min-[760px]:grid-cols-2">{products.map(p=><ProductCard key={p.slug} product={p}/>)}</div></div><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(breadcrumbList(crumbs))}}/></main>;}
