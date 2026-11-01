# Переменные Railway — чек-лист

Только названия, назначение и формат. Значения не пересылать.
`NEXT_PUBLIC_*` встраиваются **при сборке**: после изменения — Redeploy, не restart.

## Production

| Переменная | Обязательно | Формат | Назначение | Если не задана / неверна |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **да** | `https://mironovich.pro`, без слэша в конце | canonical, OG, sitemap, robots, JSON-LD | Подставится `https://mironovich.pro` |
| `TELEGRAM_BOT_TOKEN` | **да** | токен от @BotFather, серверная | доставка заявок | Форма честно показывает ошибку доставки (503) и ссылку на Telegram |
| `TELEGRAM_CHAT_ID` | **да** | число (может быть с минусом для групп), серверная | чат для заявок | То же |
| `NEXT_PUBLIC_YANDEX_METRICA_ID` | да (счётчик подключён) | только цифры, 5–12 | Яндекс Метрика | Счётчик **молча не загрузится** — проверить формат |
| `NEXT_PUBLIC_GA_ID` | **не используется** | — | GA4 отключён 01.11.2026 | Новая версия переменную не читает. Удаление (решение владельца, в любой момент) сразу отключит GA4 и на действующем сайте — см. «Откат» |
| `NEXT_PUBLIC_TELEGRAM_URL` | рекомендуется | `https://t.me/mironovich_pro` | Ссылка на Telegram | Код и так использует этот адрес; см. «Откат» ниже — почему лучше задать |
| `NEXT_PUBLIC_INSTAGRAM_URL` | рекомендуется | `https://www.instagram.com/mironovich.pro/` | Ссылка на Instagram | То же |
| `LEAD_TIMEZONE` | нет | IANA, например `Europe/Moscow` | Дата в сообщении бота | `Europe/Moscow` |
| `NEXT_PUBLIC_ANALYTICS_CONSENT` | **не нужна** | — | Прежний переключатель баннера | Новая версия не читает: при ID Метрики баннер и согласие обязательны всегда. Можно удалить |
| `NEXT_PUBLIC_LEAD_FORM_EXTENDED` | **не задавать** | пусто или `1` | Поля «Компания» и «Направление» | Выключены |
| `NEXT_PUBLIC_CONSENT_PREVIEW` | **не задавать** в production | пусто или `1` | Показ баннера без счётчика — только для preview (`preview.md`) | Production-сборка с ней остановится |
| `RATE_LIMIT_CLIENT_IP` | **только после проверки на staging** (`rate-limit.md`) | пусто, `x-real-ip` или `x-forwarded-for` | Какой заголовок считать адресом клиента для лимита 5/мин | Пусто — безопасный режим: только общий лимит 10/мин. Другое значение — production-сборка остановится |
| `SITE_NOINDEX` | **не задавать** в production | пусто или `1` | Закрывает сайт от поисковиков | — |
| `LEGAL_PREVIEW` | **не задавать** в production | пусто или `1` | Показывает проекты политики и согласия с пометкой «Проект» | — |
| `NODE_ENV` | не трогать | — | Railway / Next задают сами | — |

Проверка перед релизом: в Railway → production → Variables есть все строки «да»,
нет `SITE_NOINDEX`, `LEGAL_PREVIEW`, `NEXT_PUBLIC_LEAD_FORM_EXTENDED`,
а `NEXT_PUBLIC_TELEGRAM_URL` / `NEXT_PUBLIC_INSTAGRAM_URL` — либо не заданы, либо
содержат подтверждённые адреса (не `t.me/mironovich` и не `instagram.com/mironovich`).

Node.js: закреплён **22.x** (`package.json` → `engines`), Railway выбирает версию по этому полю. Фактические версии Node.js и npm печатаются первой строкой сборки (`[build] …`).

## Staging

См. `docs/release/telegram-test.md`, шаг 2: `NEXT_PUBLIC_SITE_URL` (адрес
staging), `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` **тестового** бота,
`SITE_NOINDEX=1`. Без ID счётчиков. Для просмотра проектов политики и согласия —
`LEGAL_PREVIEW=1`.

## Откат и совместимость переменных

| Переменная | Новая версия | Прежняя версия (`24bf9eb`) |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SITE_URL`, ID счётчиков, `LEAD_TIMEZONE` | используются | используются так же |
| `NEXT_PUBLIC_TELEGRAM_URL` / `NEXT_PUBLIC_INSTAGRAM_URL` | необязательны (адреса в коде) | **без них прежняя версия показывает старые `t.me/mironovich` и `instagram.com/mironovich`** |
| `NEXT_PUBLIC_LEAD_FORM_EXTENDED`, `SITE_NOINDEX`, `LEGAL_PREVIEW`, `RATE_LIMIT_CLIENT_IP` | новые | игнорируются |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ANALYTICS_CONSENT` | не читаются | `NEXT_PUBLIC_GA_ID` прежней версией используется: **удаление сейчас отключит GA4 и на действующем сайте** (Railway пересоберёт `main`, прежний код без ID GA4 не загружает). Откат после релиза тогда тоже будет без GA4 — это совпадает с решением отключить его |

Поэтому рекомендуется **задать** `NEXT_PUBLIC_TELEGRAM_URL` и
`NEXT_PUBLIC_INSTAGRAM_URL` подтверждёнными адресами: новая версия их примет,
а если когда-то придётся пересобрать прежнюю — она тоже покажет правильные
контакты. Новых обязательных переменных нет, удалять ничего при откате не нужно.
