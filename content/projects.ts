import type { ServiceSlug } from "@/config/services";

/**
 * Portfolio. Add an entry only after the owner has confirmed it may be published:
 * no client names, screenshots or numbers without that confirmation.
 *
 * While this list is empty, /projects is noindex, stays out of the sitemap and
 * is not linked from navigation (see projectsPublished in config/site.ts).
 */

export type ProjectStatus = "done" | "in_progress" | "demo";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; hint: string }[] = [
  { value: "done", label: "Реализовано", hint: "Решение запущено и используется." },
  { value: "in_progress", label: "В разработке", hint: "Работа идёт сейчас — указан текущий этап, а не обещанный итог." },
  { value: "demo", label: "Демонстрация", hint: "Сделано для показа подхода, не для клиента." },
];

export type Project = {
  publication: "draft" | "published";
  publicationApproval?: string;
  image?: { src: string; alt: string; approved: boolean; sourceFile: string; sourceCommit: string; caption?: string };
  /** URL of the case page: /projects/<slug> — latin, lowercase, hyphens */
  slug: string;
  title: string;
  status: ProjectStatus;
  direction: ServiceSlug;
  /** Sphere of business without the client's name, e.g. «Сеть фитнес-клубов» */
  context?: string;
  task: string;
  built: string;
  /** Only when relevant and confirmed */
  tech?: string[];
  /** Current stage — for in_progress */
  stage?: string;
  /** Only a confirmed result; omit otherwise and nothing is shown */
  result?: string;
  /** Live demo link — for demos only */
  demoUrl?: string;
  /** Optional detailed case; when present, /projects/<slug> is generated */
  caseStudy?: { publishDate?: string; sections: { heading: string; text: string }[] };
};

/** One catalogue. Drafts never reach route generation, navigation or sitemap. */
export const projectEntries: Project[] = [
 {slug:"eatlyy",title:"EATLYY — ИИ-дневник питания",status:"in_progress",publication:"published",publicationApproval:"Владелец разрешил название, фирменный стиль и реальные кадры EATLYY 2026-11-11.",image:{src:"/projects/eatlyy.png",alt:"EATLYY: выбор веса порции, кадр из разрешённого лендинга",approved:true,sourceFile:"eatly-landing/screen-2.png",sourceCommit:"71361583e6d8354e3ace2203b4743351a3270575",caption:"Реальный кадр интерфейса из разрешённого лендинга EATLYY. КБЖУ на изображении — пример интерфейса, не обещание точности анализа."},direction:"development",context:"Питание · инструменты тренера и клиента",task:"Упростить ведение дневника питания и связь клиента с тренером.",built:"В исходниках подтверждены запись питания, анализ текста и фото через ИИ, дневная статистика и API работы тренера с клиентами. Есть Mini App и отдельный лендинг.",stage:"Показана функциональность исходников и интерфейса; эксплуатационные и коммерческие показатели не подтверждены.",result:"Созданы клиентские сценарии дневника и серверные модули анализа и работы с тренером. Никакие данные о доходе, аудитории или медицинской эффективности не заявляются.",caseStudy:{publishDate:"2026-11-11",sections:[{heading:"Задача",text:"Сделать фиксацию питания менее трудоёмкой и дать тренеру инструменты работы с данными клиента по разрешённой связи. Это отдельный продукт, не прототип агрегатора фитнес-тренеров."},{heading:"Что реализовали",text:"Код содержит анализ еды по тексту и фото, хранение записей питания, статистику, Mini App, связь тренера и клиента, просмотр тренером данных клиента с проверками доступа. Наличие кода не доказывает медицинскую точность, доступность внешнего API или готовность всех сопутствующих функций. В рамках подготовки кейса OpenAI и внешние сервисы не запускались."},{heading:"Сроки",text:"Доступная история основного репозитория: 19 марта — 25 мая 2026; лендинга: 23–26 апреля 2026. Это даты Git-активности, а не подтверждённый срок разработки. Фактическая продолжительность не установлена."},{heading:"Результат",text:"Подтверждены прикладной код дневника, ИИ-анализа и инструментов тренера/клиента, а также реальные изображения интерфейса. Нет подтверждённых данных о количестве пользователей, выручке или эффективности питания — такие показатели не публикуются."},{heading:"Демонстрация",text:"Использован разрешённый кадр screen-2.png из eatly-landing, коммит 71361583e6d8354e3ace2203b4743351a3270575. Изображение без изменений; реальные имена, контакты и корпоративные сведения отсутствуют."}]}},
 {slug:"club-ops",title:"CLUB OPS — операционное управление фитнес-клубом",status:"in_progress",publication:"published",publicationApproval:"Владелец разрешил CLUB OPS и обезличенные интерфейсы 2026-11-11; только синтетические данные.",image:{src:"/projects/club-ops.png",alt:"CLUB OPS: обезличенная демонстрация таблицы план/факт с синтетическими данными",approved:true,sourceFile:"src/components/BudgetFactTable.tsx",sourceCommit:"028ff58be0a68aec6468cc2947b2f2c08971783c",caption:"Изолированная демонстрация исходного компонента на синтетических данных. Не production и не финансовые показатели клиента."},direction:"development",context:"Фитнес · операционная система",task:"Объединить бюджетирование, расходы, расчёты с сотрудниками и управленческий контроль в одном приложении.",built:"В исходниках присутствуют бюджеты, сотрудники, аналитика и финансовые сценарии. Карта готовности отдельно помечает расходы, зарплаты, возвраты и инкассацию как частично готовые.",stage:"Требуется закрытие отмеченных финансовых и эксплуатационных ограничений.",result:"Созданы прикладные модули и тесты финансовой логики. Промышленная готовность и экономический эффект не подтверждены.",caseStudy:{publishDate:"2026-11-11",sections:[{heading:"Задача",text:"Уменьшить разрозненность операционных данных: бюджеты, расходы, сотрудники, зарплаты и управленческая аналитика."},{heading:"Что реализовали",text:"Код и карта готовности подтверждают бюджетирование, сотрудников, аналитику, ролевые сценарии согласований и расчёты. Это не равнозначно завершённой эксплуатации: карта описывает ограничения зарплатных выплат, финансовых контуров, возвратов и устойчивости хранения файлов. Интеграции ОФД требуют live-проверки; их не называем подтверждённым внедрением."},{heading:"Сроки",text:"Доступная история Git: 26 мая — 5 августа 2026. Это диапазон коммитов репозитория, а не подтверждённая длительность разработки."},{heading:"Результат",text:"Создано приложение с финансовыми и операционными модулями и исходниками тестов. В этой работе тесты CLUB OPS не перезапускались и внешние интеграции не включались. Выручка, экономия и число внедрений неизвестны."},{heading:"Демонстрация",text:"Показан изолированный браузерный рендер исходных компонентов PageHeader и BudgetFactTable с синтетическими данными. Это демонстрация представления, без БД и внешних интеграций, не кадр production. Реальные финансовые данные, компании и сотрудники не использованы."}]}},
 {slug:"corporate-learning",title:"Корпоративная платформа обучения для сети фитнес-клубов",status:"in_progress",publication:"draft",direction:"development",context:"Обучение · корпоративная система",task:"Организовать обучение, тестирование и адаптацию сотрудников с доступом к знаниям по ролям.",built:"В коде есть академия с серверными данными, тестирование, прогресс, база знаний, рейтинги и административные инструменты. Права доступа проверяются серверными модулями.",stage:"Публичный кейс и корпоративные кадры требуют разрешения правообладателя.",result:"Подтверждены исходники модулей и тестов. Производственная готовность ИИ-ассистента в этой проверке не установлена.",caseStudy:{sections:[{heading:"Задача",text:"Собрать обучение, проверку знаний и адаптацию в одном интерфейсе, разграничив доступ к материалам и администрированию."},{heading:"Что реализовали",text:"Присутствуют серверная академия, опубликованные уроки, прогресс и тестирование, профиль и адаптация, база знаний и ролевые ограничения, рейтинги и административная часть. Наличие исходников не подтверждает полноту фактического корпоративного наполнения."},{heading:"Сроки",text:"Доступная Git-активность: 4 августа — 23 сентября 2026. Фактические сроки разработки и внедрения владелец не подтвердил."},{heading:"Результат",text:"Есть прикладной код обучения, управления контентом, доступа и тестов. Для ИИ-ассистента подтверждены серверный код чата, работы с источниками, доступа и unit tests; интеграционные DB/HTTP/OpenAI-сценарии отмечены как skips. Это реализация в исходниках, но не подтверждение производственной готовности или эксплуатации. Никакие корпоративные документы или данные сотрудников не включены."},{heading:"Демонстрация",text:"Кандидаты находятся в docs/screenshots/v0.1/. Не копируются и не публикуются до разрешения правообладателя и проверки персональных/корпоративных сведений. Альтернатива — отдельно разрешённое демо с синтетическими данными."}]}}
];
export function canPublishProject(p: Project): boolean {
 return p.publication === "published" && Boolean(p.publicationApproval?.trim()) && Boolean(p.caseStudy?.publishDate && /^\d{4}-\d{2}-\d{2}$/.test(p.caseStudy.publishDate)) && Boolean(p.image?.approved && p.image.src.startsWith("/projects/") && /^[a-f0-9]{40}$/.test(p.image.sourceCommit));
}
export const projects: Project[] = projectEntries.filter(canPublishProject);

export const projectsWithCase = () => projects.filter((p) => p.caseStudy);
export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);
