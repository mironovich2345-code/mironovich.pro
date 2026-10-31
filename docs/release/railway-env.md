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
| `NEXT_PUBLIC_GA_ID` | да (подключён) | `G-` + латиница/цифры, например `G-ABC123XYZ` | GA4 | Счётчик **молча не загрузится**; старый формат `UA-…` не поддерживается |
| `NEXT_PUBLIC_TELEGRAM_URL` | рекомендуется | `https://t.me/mironovich_pro` | Ссылка на Telegram | Код и так использует этот адрес; см. «Откат» ниже — почему лучше задать |
| `NEXT_PUBLIC_INSTAGRAM_URL` | рекомендуется | `https://www.instagram.com/mironovich.pro/` | Ссылка на Instagram | То же |
| `LEAD_TIMEZONE` | нет | IANA, например `Europe/Moscow` | Дата в сообщении бота | `Europe/Moscow` |
| `NEXT_PUBLIC_ANALYTICS_CONSENT` | **не задавать** до утверждения | пусто или `required` | Баннер согласия на аналитику | Пусто — счётчики грузятся сразу (как сейчас) |
| `NEXT_PUBLIC_LEAD_FORM_EXTENDED` | **не задавать** | пусто или `1` | Поля «Компания» и «Направление» | Выключены |
| `SITE_NOINDEX` | **не задавать** в production | пусто или `1` | Закрывает сайт от поисковиков | — |
| `NODE_ENV` | не трогать | — | Railway / Next задают сами | — |

Проверка перед релизом: в Railway → production → Variables есть все строки «да»,
нет `SITE_NOINDEX`, `NEXT_PUBLIC_LEAD_FORM_EXTENDED`, `NEXT_PUBLIC_ANALYTICS_CONSENT`,
а `NEXT_PUBLIC_TELEGRAM_URL` / `NEXT_PUBLIC_INSTAGRAM_URL` — либо не заданы, либо
содержат подтверждённые адреса (не `t.me/mironovich` и не `instagram.com/mironovich`).

Node.js: Next 15.5 требует **18.18 или новее** (проверено на 22.x).

## Staging

См. `docs/release/telegram-test.md`, шаг 2: `NEXT_PUBLIC_SITE_URL` (адрес
staging), `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` **тестового** бота,
`SITE_NOINDEX=1`. Без ID счётчиков.

## Откат и совместимость переменных

| Переменная | Новая версия | Прежняя версия (`24bf9eb`) |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SITE_URL`, ID счётчиков, `LEAD_TIMEZONE` | используются | используются так же |
| `NEXT_PUBLIC_TELEGRAM_URL` / `NEXT_PUBLIC_INSTAGRAM_URL` | необязательны (адреса в коде) | **без них прежняя версия показывает старые `t.me/mironovich` и `instagram.com/mironovich`** |
| `NEXT_PUBLIC_ANALYTICS_CONSENT`, `NEXT_PUBLIC_LEAD_FORM_EXTENDED`, `SITE_NOINDEX` | новые | игнорируются |

Поэтому рекомендуется **задать** `NEXT_PUBLIC_TELEGRAM_URL` и
`NEXT_PUBLIC_INSTAGRAM_URL` подтверждёнными адресами: новая версия их примет,
а если когда-то придётся пересобрать прежнюю — она тоже покажет правильные
контакты. Новых обязательных переменных нет, удалять ничего при откате не нужно.
