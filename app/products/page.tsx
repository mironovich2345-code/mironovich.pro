import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import { publicStorefrontProducts } from "@/content/products";
import { pageMetadata, breadcrumbList } from "@/lib/seo";
import { jsonLd } from "@/lib/jsonld";
export const metadata:Metadata=pageMetadata({title:"Продукты: интерактивные инструменты об ИИ — MIRONOVICH",description:"Цифровой продукт для сотрудников: персональная диагностика и 30 шагов развития с ИИ. Цена растёт по этапам; приём платежей подключается.",path:"/products"});
const crumbs=[{name:"Главная",href:"/"},{name:"Продукты",href:"/products"}];
export default function Products(){return <main id="main" className="bg-graphite px-[22px] pb-20 pt-8"><div className="mx-auto max-w-[1080px]"><Breadcrumbs items={crumbs}/><h1 className="mb-6 mt-10 font-display text-[clamp(38px,7vw,76px)] font-extrabold uppercase leading-none">Продукты<span className="text-signal">.</span></h1><p className="mb-12 max-w-[65ch] text-lg leading-relaxed text-stone">На этой странице представлен только цифровой продукт для сотрудников. Стоимость растёт по этапам: 1 993 ₽ для первых 10 покупателей, 3 990 ₽ для следующих 10, затем 5 900 ₽. Онлайн-оплата пока не включена. Консультации и разработка для бизнеса обсуждаются индивидуально и не продаются здесь.</p><div className="grid gap-12 min-[760px]:grid-cols-2">{publicStorefrontProducts.map(p=><ProductCard key={p.slug} product={p}/>)}</div></div><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(breadcrumbList(crumbs))}}/></main>;}
