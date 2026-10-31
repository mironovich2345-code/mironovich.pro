import type { ServiceSlug } from "./services";

/**
 * The five blog categories. An article's `category` frontmatter must be one of
 * these slugs. Each category points at the service its readers most likely need,
 * which drives the service block at the end of an article.
 */

export type CategorySlug =
  | "avtomatizaciya"
  | "razrabotka-prilozheniy"
  | "ii-dlya-biznesa"
  | "obuchenie-sotrudnikov"
  | "effektivnost-biznesa";

export type BlogCategory = {
  slug: CategorySlug;
  name: string;
  /** Short label for chips */
  short: string;
  /** Meta description and the intro under the H1 */
  description: string;
  /** What the category covers — shown on its page, plain explanatory text */
  about: string;
  /** Service an article in this category links to, unless the article overrides it */
  service: ServiceSlug | null;
};

export const blogCategories: readonly BlogCategory[] = [
  {
    slug: "avtomatizaciya",
    name: "Автоматизация бизнес-процессов",
    short: "Автоматизация",
    description: "Разборы автоматизации отчётности, интеграций CRM и сервисов, обработки заявок и повторяющихся операций.",
    about:
      "Как понять, какие процессы стоит автоматизировать, как связать сервисы между собой и где автоматизация не нужна. Практика, ограничения и типичные ошибки.",
    service: "automation",
  },
  {
    slug: "razrabotka-prilozheniy",
    name: "Разработка приложений",
    short: "Приложения",
    description: "Внутренние приложения, личные кабинеты, дашборды и Telegram Mini Apps: когда они нужны и как к ним подойти.",
    about:
      "Когда таблиц и чатов уже мало, а готовые сервисы не подходят: как выбрать формат, с чего начать разработку и как не сделать лишнего.",
    service: "apps",
  },
  {
    slug: "ii-dlya-biznesa",
    name: "ИИ для бизнеса",
    short: "ИИ",
    description: "Где ИИ действительно помогает в рабочих процессах, а где нужен человек: применение, ограничения, проверка результата.",
    about:
      "Трезвый взгляд на ИИ в работе компании: конкретные задачи, где он экономит время, риски и то, как встроить проверку человеком.",
    service: "automation",
  },
  {
    slug: "obuchenie-sotrudnikov",
    name: "Обучение сотрудников",
    short: "Обучение",
    description: "Адаптация новичков, базы знаний, тестирование и системы обучения, которые не держатся на одном человеке.",
    about:
      "Как выстроить обучение и адаптацию так, чтобы знания принадлежали компании: маршрут новичка, база знаний, проверка результата и контроль прогресса.",
    service: "training",
  },
  {
    slug: "effektivnost-biznesa",
    name: "Эффективность бизнеса",
    short: "Эффективность",
    description: "Темы руководителя: где бизнес теряет время, как описать процесс и как сделать работу прозрачной.",
    about:
      "Вопросы, которые возникают до выбора технологии: где теряется время, как описать процесс, как контролировать работу без микроменеджмента.",
    service: null,
  },
];

export const isCategorySlug = (v: string): v is CategorySlug => blogCategories.some((c) => c.slug === v);
export const categoryBySlug = (slug: CategorySlug) => blogCategories.find((c) => c.slug === slug)!;

/** A category page is indexed and listed in the sitemap only with at least this many published articles. */
export const MIN_POSTS_TO_INDEX_CATEGORY = 3;

export const categoryHref = (slug: CategorySlug) => "/blog/category/" + slug;
