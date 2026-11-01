# Коротко: staging-тест Telegram и проверка переменных production

Всё выполняет владелец. Токены, chat_id и значения переменных никуда не
пересылать. Подробные версии: `telegram-test.md`, `railway-env.md`.

## 1. Staging-тест Telegram (≈ 25 минут)

**Подготовка**
1. @BotFather → `/newbot` → тестовый бот. Сохранить токен у себя.
2. Открыть бота → **Start**. Chat_id: `https://api.telegram.org/bot<ТОКЕН>/getUpdates`
   → `result[0].message.chat.id`.
3. Railway → переключатель окружений → **New Environment → Empty** →
   `staging`. **Не Duplicate production.**
4. В `staging`: **New → GitHub Repo → mironovich.pro**; Settings → Source →
   Branch `claude/busy-carson-4j9hr7`; Settings → Networking → **Generate Domain**
   (`*.up.railway.app`, свой домен не подключать).
5. Variables:
   `NEXT_PUBLIC_SITE_URL` = адрес staging · `TELEGRAM_BOT_TOKEN` = тестовый ·
   `TELEGRAM_CHAT_ID` = тестовый · `SITE_NOINDEX` = `1`.
   ID счётчиков **не задавать**.
6. Дождаться **Active**.

**Проверка** (все тексты начинать с «ТЕСТ», данные — свои)

| # | Действие | Ожидание | ✓/✗ |
|---|---|---|---|
| 1 | `/robots.txt` | `Disallow: /` | |
| 2 | `/contact` → заявка с галочкой | «Заявка отправлена»; в чате имя, контакт, задача, «Страница: /contact», «Согласие … получено» | |
| 3 | Приватное окно: `/services/apps?utm_source=test&utm_medium=manual&email=a@b.c` → заявка | `email` исчез из адреса; в чате Source test, Medium manual, «Страница: /services/apps» | |
| 4 | Без галочки → «Отправить» | Ошибка у галочки, в чат ничего | |
| 5 | 6 заявок за минуту | 6-я — ошибка и ссылка на Telegram; в чате ≤ 5 | |
| 6 | `TELEGRAM_CHAT_ID` = `1` → Redeploy → заявка | «Не получилось доставить…», **нет** «отправлена»; в Logs `[lead] telegram rejected the message` | |
| 7 | Вернуть chat_id → Redeploy → заявка | Доставлена | |

Прислать Claude только колонку ✓/✗ и тексты ошибок без токенов. После теста —
удалить тестовые сообщения; staging можно оставить.

## 2. Проверка production-переменных (≈ 5 минут, ничего не менять)

Railway → **production** → сервис → **Variables**. Значения не копировать,
только сверить:

| Переменная | Должно быть |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://mironovich.pro` (без `/` в конце) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | заданы (боевые) |
| `NEXT_PUBLIC_YANDEX_METRICA_ID` | только цифры |
| `NEXT_PUBLIC_GA_ID` | начинается с `G-` (если GA4 оставляем) |
| `NEXT_PUBLIC_TELEGRAM_URL` | не задана **или** `https://t.me/mironovich_pro` |
| `NEXT_PUBLIC_INSTAGRAM_URL` | не задана **или** `https://www.instagram.com/mironovich.pro/` |
| `SITE_NOINDEX`, `LEGAL_PREVIEW`, `NEXT_PUBLIC_LEAD_FORM_EXTENDED` | **отсутствуют** |
| `NEXT_PUBLIC_ANALYTICS_CONSENT` | отсутствует до юридического Go, затем `required` |

Дополнительно посмотреть (нужно для юриста, `docs/legal/data-flow.md`):
- сервис → **Settings → Region** — в каком регионе работает сайт;
- **Settings / Deploy** — версия Node.js ≥ 18.18;
- есть ли у сервиса HTTP-логи и какой срок их хранения.

Прислать Claude: «все строки совпадают» или какие нет (без значений) + регион.
