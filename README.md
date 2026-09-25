# MIRONOVICH

Персональный сайт Данила Мироновича.
Цифровые продукты, автоматизация бизнес-процессов и AI для бизнеса.

---

## Стек

- **Next.js 15** (App Router, React 19) — серверный рендеринг, метаданные, robots и sitemap через metadata API
- **TypeScript** — строгий режим
- **Tailwind CSS 3** — токены темы в `tailwind.config.ts`
- **Framer Motion** — только появление блоков при скролле, с учётом `prefers-reduced-motion`
- **Route Handler** `/api/lead` — приём заявок и отправка в Telegram

Внешних сервисов, кроме Telegram и (опционально) аналитики, нет. Базы данных нет.

## Локальный запуск

> **Первый запуск:** `package-lock.json` в репозиторий не включён — его
> невозможно сгенерировать без установленного npm. Один раз выполните
> `npm install`, затем закоммитьте появившийся `package-lock.json`:
> после этого работают и `npm ci`, и воспроизводимые сборки на Railway.

```bash
npm install          # первый раз; далее достаточно npm ci
npm run dev          # http://localhost:3000
```

Проверки:

```bash
npm audit            # уязвимости зависимостей
npm run typecheck    # tsc --noEmit
npm run build        # прод-сборка
```

Нужен Node.js 18.18+ (проверить: `node -v`).

## Environment variables

```bash
cp .env.example .env.local
```

**Обязательные**

| Переменная | Зачем |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical, OpenGraph, robots, sitemap, JSON-LD |
| `TELEGRAM_BOT_TOKEN` | отправка заявок (только сервер) |
| `TELEGRAM_CHAT_ID` | куда отправлять заявки |

**Опциональные** — без них сайт работает как обычно

| Переменная | Поведение по умолчанию |
|---|---|
| `NEXT_PUBLIC_TELEGRAM_URL` | fallback из `config/site.ts`, `sameAs` в JSON-LD не выводится |
| `NEXT_PUBLIC_INSTAGRAM_URL` | то же |
| `NEXT_PUBLIC_YANDEX_METRICA_ID` | скрипт не загружается |
| `NEXT_PUBLIC_GA_ID` | скрипт не загружается |
| `LEAD_TIMEZONE` | `Europe/Moscow` |

Всё с префиксом `NEXT_PUBLIC_` попадает в клиентский бандл и публично видно.
Токен бота такого префикса не имеет — он читается только на сервере.

## Telegram

1. [@BotFather](https://t.me/BotFather) → `/newbot` → скопировать токен в `TELEGRAM_BOT_TOKEN`.
2. Открыть чат со своим ботом и отправить `/start` — без этого бот не сможет вам написать.
   BotFather выдаёт **только токен**, chat id он не показывает.
3. Открыть `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и взять
   `result[0].message.chat.id` → `TELEGRAM_CHAT_ID`.
   Для группы: добавить бота в группу, написать там сообщение, взять
   отрицательный `chat.id` оттуда.
4. Перезапустить приложение, чтобы переменные применились.

Форма показывает «Заявка отправлена» **только** когда Telegram подтвердил
доставку. При любой ошибке видно сообщение с прямой ссылкой на Telegram.

## Production build

```bash
npm ci
npm run build
npm start            # прод-сервер на :3000 (PORT переопределяется окружением)
```

## Структура проекта

```
app/
  layout.tsx            метаданные, OpenGraph, Twitter, шрифт Inter (cyrillic)
  page.tsx              сборка секций главной
  globals.css           резеты, focus-visible, prefers-reduced-motion
  about/page.tsx        /about — ProfilePage + Person JSON-LD
  blog/page.tsx         /blog — список опубликованных статей (Blog JSON-LD)
  blog/[slug]/page.tsx  /blog/<slug> — статья, BlogPosting JSON-LD, canonical, OG
  privacy/page.tsx      политика обработки данных (noindex, follow)
  consent/page.tsx      согласие на обработку данных (noindex, follow)
  api/lead/route.ts     приём заявки, honeypot, rate limit, отправка в Telegram
  robots.ts             robots.txt
  sitemap.ts            sitemap.xml — /, /about, /blog и опубликованные статьи
  manifest.ts           web app manifest
  icon.png              favicon 512
  apple-icon.png        apple touch icon 180
  favicon.ico           классический favicon
components/
  Hero · Pains · Services · About · CaseStudy (+DashboardMockup)
  Process · FirstReview · LeadForm (+ConsentDialog) · Faq
  SecondaryCta · StickyCta · Reveal
  SiteHeader (+MobileMenu) · Footer — подключены в layout.tsx, видны на всех страницах
  Markdown — рендер статей блога (серверный компонент)
  StructuredData · Analytics · CtaLink
config/
  site.ts               имя, описание, соцссылки из env, навигация
content/
  blog/                 статьи блога — по одному .md на статью (см. content/blog/README.md)
lib/
  analytics.ts          track(), список событий, ID провайдеров из env
  attribution.ts        first-touch UTM + referrer + landing page
  blog.ts               чтение и валидация статей, published/draft
  markdown.ts           небольшой Markdown-парсер без зависимостей
  jsonld.ts             безопасная сериализация JSON-LD
public/
  images/               фотографии (webp)
  yandex_*.html         подтверждение Яндекс.Вебмастера — не удалять
  zen_*.html            подтверждение Дзена — не удалять
  og.png                превью для мессенджеров, 1200×630
  icon-192.png icon-512.png  иконки для «на главный экран»
```

Порядок секций главной: Hero → 01 Когда могу быть полезен → 02 Что можно
сделать → 03 Обо мне → 04 Пример проекта → 05 Как я работаю → 06 Первый разбор
→ 07 Консультация (форма) → FAQ → Secondary CTA → футер.

## Блог

Статьи лежат в `content/blog/*.md`, без CMS и внешних зависимостей. Чтобы добавить
статью, достаточно положить туда файл с frontmatter — страница, карточка в `/blog`,
sitemap и структурированные данные появятся сами. Формат, поля и чек-лист —
в [content/blog/README.md](./content/blog/README.md).

- `status: published` — статья в списке, sitemap и индексе; `draft` — не попадает никуда,
  виден только в `npm run dev` по прямому адресу (с `noindex`).
- Картинки лежат в `public/blog/`. `coverImage` — превью на `/blog` и Open Graph статьи;
  в тексте картинка ставится строкой `![alt](/blog/file.png "подпись")` и рендерится через `next/image`.
  Размеры читаются из файла, поэтому вручную их указывать не нужно.
- Ошибка в frontmatter, Markdown или пути к картинке останавливает сборку с указанием файла.
- Страницы блога — server components, клиентский JS нужен только мобильному меню и CTA-ссылкам.

## Аналитика

Опциональна. Пока в env нет ни одного ID, ни один внешний скрипт не
загружается и в CSP не открывается ни один внешний домен — поэтому
cookie-баннера пока и нет.

Компоненты не знают, какая система подключена: они вызывают `track()` из
`lib/analytics.ts`. Чтобы позже добавить управление согласием, достаточно
закрыть условием два `<Script>` в `components/Analytics.tsx`.

| Событие | Когда | Параметры |
|---|---|---|
| `cta_click` | клик по CTA | `location`: `hero` · `sticky` · `first_review` · `secondary` · `header` · `about` · `article` · `blog` |
| `form_start` | первое взаимодействие с полем формы, один раз за сессию | — |
| `lead_submit_success` | Telegram подтвердил доставку | `utm_source`, `utm_medium`, `utm_campaign` |
| `lead_submit_error` | заявка не ушла | `reason`: `validation` · `network` · `delivery` |
| `telegram_fallback_click` | клик по резервной ссылке Telegram | — |

Имя, контакт и текст задачи в аналитику не передаются никогда.

## UTM и атрибуция

First-touch: записывается один раз при первом заходе в `localStorage`
(`mrnv_attr_v1`) и больше не перезаписывается, поэтому переходы по сайту
источник не теряют. Никакого fingerprinting — только UTM-параметры,
`document.referrer` и метка времени.

```json
{
  "utm_source": "instagram",
  "utm_medium": "social",
  "utm_campaign": "profile",
  "utm_content": "mironovich_pro",
  "utm_term": "unknown",
  "referrer": "https://l.instagram.com/",
  "landingPage": "/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_pro",
  "firstSeenAt": "2026-09-20T11:04:18.512Z"
}
```

Атрибуция уходит вместе с заявкой и попадает в сообщение бота отдельным блоком:

```
ИСТОЧНИК
Source: instagram
Medium: social
Campaign: profile
Content: mironovich_pro
Referrer: https://l.instagram.com/
Landing: /?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_pro
```

Если параметра нет — подставляется `direct` или `unknown`, заявка не ломается.
Пользователь этих полей в форме не видит.

### Ссылки для Instagram-аккаунтов

У каждого аккаунта свой `utm_content` — по нему видно, какой профиль привёл заявку.

```
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_pro
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_now
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_fit
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_ru
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_of
```

Для сторис и рилсов удобно менять `utm_campaign` (`stories`, `reels`),
оставляя аккаунт в `utm_content`.

## Деплой на Railway

1. Запушить репозиторий на GitHub.
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. Railway определит Next.js сам: `npm ci` → `npm run build` → `npm start`.
   Если нужно задать вручную: Settings → Build Command `npm run build`,
   Start Command `npm start`.
4. Variables → добавить переменные из `.env.example`
   (как минимум `NEXT_PUBLIC_SITE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
   `NEXT_PUBLIC_*` подставляются на этапе сборки — после их изменения нужен
   новый деплой, а не просто restart.
5. Settings → Networking → Generate Domain, проверить работу на `*.up.railway.app`.
6. Custom Domain → `mironovich.pro`, прописать выданный CNAME у регистратора.
7. Добавить `www.mironovich.pro` и настроить редирект на основной домен.

Порт слушать не нужно настраивать: Railway передаёт `PORT`, а `next start`
его читает.

Подробный пошаговый чек-лист запуска — в [DEPLOYMENT.md](./DEPLOYMENT.md).
