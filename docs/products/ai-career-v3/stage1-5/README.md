# AI Career 3.0 — этап 1.5: перенос на mironovich.pro (без реальной оплаты)

Статус: интеграционная ветка `feature/ai-career-commercial` (PR #81, черновик, **не сливать** до приёмки).
`salesEnabled=false`, `legalApproved=false`, реальные платежи выключены, уроки остаются в `review`.

## 1. Архитектура

```
Посетитель ──HTTPS──▶ Cloudflare ──▶ Railway edge ──▶ сервис «mironovich.pro» (проект handsome-warmth / production)
                        │  /, /products/…, документы — отдаёт сам сайт
                        │  /career, /admin, /api/career/*, /career-app/_next/*
                        ▼  (middleware: rewrite + x-career-proxy, x-forwarded-host, x-career-client-ip)
                      ai-career-app (новый сервис в ТОМ ЖЕ проекте handsome-warmth / production, БЕЗ публичного домена)
                        │  отвечает только запросам с секретом прокси (+ /healthz)
                        ▼
                      ai-career-db: PostgreSQL mironovich_career (новая пустая база, только *.railway.internal)
```

* Сайт не хранит доступов к базе приложения. Цена на сайте берётся из `GET /api/career/shop/public-quote`
  (таймаут 2 с, ISR 60 с); если приложение недоступно — сайт показывает запасную цену запуска и продолжает работать.
* Если приложение упало, ломаются только пути `/career`, `/admin`, `/api/career/*` — все страницы сайта работают.
* Без `CAREER_APP_UPSTREAM` на сайте middleware ничего не меняет, кнопка «Войти» не показывается (сегодняшний production).
  Кнопка входа входит в статические страницы, поэтому добавление или удаление переменной действует после пересборки —
  Railway пересобирает сервис при каждом изменении переменных.
* Вход — шестизначный код из письма, без пароля. Регистрация открыта; новый аккаунт без доступа до оплаты или приглашения.
  Администратор задаётся списком `CAREER_V3_ADMIN_EMAILS` (damironovich@mail.ru).
* Cookies: `__Host-career_session`, `__Host-career_login` (Secure, HttpOnly, SameSite=Lax, Path=/).
  CSRF: проверка Origin/Sec-Fetch-Site на всех изменяющих запросах. Все ответы кабинета — `X-Robots-Tag: noindex`,
  `robots.txt` закрывает `/career`, `/admin`, `/api/`, `/career-app/`, `/preview-`.
* Цена: единый источник — таблица цены в базе приложения: AUTO 1 993 → 3 990 → 5 900 ₽ (10–10–20), MANUAL — любая из трёх.
  Её читают сайт, админка и будущая Robokassa.

## 2. Профили

| Профиль | Railway | Почта | Оплата |
|---|---|---|---|
| `commercial-staging` | проект `mironovich-commercial-staging`, среда `staging`, сервис `ai-career-app` | preview-outbox (`/preview-mail`) | эмулятор Robokassa |
| `commercial` | проект `handsome-warmth` (ID `7139f66b-111b-48ad-b8fc-ce40b2da3e9c`), среда `production`, сервис `ai-career-app` | только SMTP | **нет** — любая переменная Robokassa запрещена |

Почему один проект с сайтом: приватная сеть Railway (`*.railway.internal`) не связывает разные проекты, а приложению
нужен адрес, недоступный из интернета. Строгая проверка профиля `commercial` (`lib/server/career-demo/config.ts`):

* имя проекта `handsome-warmth` **и** его ID (переименованный чужой проект не пройдёт); среда `production`; сервис `ai-career-app`;
* запуск в сервисе сайта `mironovich.pro` запрещён; у сервиса приложения не должно быть публичного домена;
* адрес — только `https://mironovich.pro`; база — только `mironovich_career` на `*.railway.internal` (не публичный TCP-прокси);
* секреты сайта (`OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `COMMERCE_DATABASE_URL`) в приложении запрещены;
* среда `production` по-прежнему запрещена всем остальным профилям, включая `commercial-staging`.

При любой ошибке конфигурации приложение закрыто (404 на всё, кроме `/healthz`), миграции не выполняются.
Общих (shared) переменных в handsome-warmth сейчас нет — проверено, приложению ничего не передаётся от сайта.

Миграции: `001`–`012` общие, `migrations/career-commercial/013_commercial_real_users.sql` — только для коммерческих баз
(снимает ограничения «только синтетические данные» в новой схеме). Каждая миграция проверяет имя базы и настройку сеанса
`mironovich.career_demo=commercial`; на любой другой базе 013 останавливается с ошибкой `CAREER_COMMERCIAL_DATABASE_REQUIRED`.
Демо-базы, пользователи и прогресс не затрагиваются.

## 3. IP посетителя и лимиты кодов

Лимиты на запрос кода: 5 писем в час на адрес, 20 в час и 60 в сутки на IP, 300 в час на весь сервис.
Источник IP — `lib/server/client-ip.ts`:

* Измерено на staging: Railway edge **перезаписывает** `X-Real-IP` и `X-Forwarded-For` адресом соединения; присланные
  посетителем значения до сервиса не доходят. `CF-Connecting-IP` и прочие заголовки проходят без изменений.
* mironovich.pro работает через Cloudflare (`server: cloudflare`), поэтому в production `X-Real-IP` — адрес узла Cloudflare.
  Только если он входит в официальные диапазоны Cloudflare, берётся `CF-Connecting-IP` (его Cloudflare сам перезаписывает).
  Запрос мимо Cloudflare напрямую в Railway получает свой реальный адрес, поддельный `CF-Connecting-IP` игнорируется.
* `X-Forwarded-For` не читается вообще. Сайт передаёт приложению `x-career-client-ip`; приложение доверяет ему только
  вместе с секретом прокси, иначе все такие запросы попадают в одну общую «корзину» `unknown`.
* Без этой правки все посетители production делили бы один IP Cloudflare — 20 кодов в час на всех.

## 4. Почта

SMTP читает только `ai-career-app`: письмо с кодом отправляется из `/api/career/demo/otp-*`, а этот путь сайт целиком
проксирует в приложение. Сайту SMTP-переменные **не нужны** и не должны задаваться. Проверка конфигурации приложения
требует `CAREER_V3_SMTP_HOST`, `CAREER_V3_SMTP_USER`, `CAREER_V3_SMTP_PASSWORD`, `CAREER_V3_SMTP_FROM`
(отправитель `info@mironovich.pro`), порт 465 или 587. Пароль вводится только в Railway, в репозитории и чатах его нет.

## 5. Настройки Railway для production (выполняет владелец после слияния)

Всё — в проекте **handsome-warmth**, среда **production**. Сервис сайта `mironovich.pro` до шага 5 не трогается.

**1) База `ai-career-db`** — образ `postgres:16-alpine` (как на staging), том `/var/lib/postgresql/data`, без публичного TCP-прокси:

```
POSTGRES_USER=career
POSTGRES_PASSWORD=${{secret(40)}}
POSTGRES_DB=mironovich_career
PGDATA=/var/lib/postgresql/data/pgdata
```

**2) Сервис `ai-career-app`** — тот же репозиторий и ветка, что у сайта; Build `npm run build`;
Start `node --experimental-strip-types --no-warnings scripts/career/demo-admin.mjs migrate && npx next start -H :: -p $PORT`;
Healthcheck `/healthz`; **публичный домен не создавать**.

| Переменная | Значение |
|---|---|
| `CAREER_V3_DEMO` | `1` |
| `CAREER_V3_DEMO_PROFILE` | `commercial` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `CAREER_V3_DEMO_ORIGIN`, `NEXT_PUBLIC_SITE_URL` | `https://mironovich.pro` |
| `CAREER_V3_DEMO_DATABASE_URL` | `postgresql://${{ai-career-db.POSTGRES_USER}}:${{ai-career-db.POSTGRES_PASSWORD}}@${{ai-career-db.RAILWAY_PRIVATE_DOMAIN}}:5432/mironovich_career` |
| `CAREER_V3_DEMO_SESSION_SECRET` | `${{secret(64)}}` |
| `CAREER_V3_OTP_SECRET` | `${{secret(48)}}` |
| `CAREER_PROXY_SECRET` | `${{secret(48)}}` |
| `CAREER_V3_MAIL` | `smtp` |
| `CAREER_V3_SMTP_HOST` / `_PORT` / `_USER` / `_FROM` | данные почты; `_FROM` = `AI Career <info@mironovich.pro>` |
| `CAREER_V3_SMTP_PASSWORD` | пароль приложения почты — вводит владелец в Railway |
| `CAREER_V3_ADMIN_EMAILS` | `damironovich@mail.ru` |

Ссылки `${{ai-career-db.…}}` работают только внутри одного проекта — это и есть причина размещения в handsome-warmth.
Это та же схема ссылок, что работает на staging. Не задавать: `DATABASE_URL`, любые `CAREER_V3_ROBOKASSA*`,
`CAREER_V3_PREVIEW_OUTBOX_KEY`, переменные сайта (OpenAI, Telegram) — приложение откажется запускаться.

**3) Проверка приложения:** деплой зелёный по `/healthz`; в логах строка «Коммерческая схема готова» и
«Роль администратора подтверждена для адресов из CAREER_V3_ADMIN_EMAILS: 1». Если в логах «Демо закрыто — команда не выполнена»,
там перечислены причины (без значений секретов); сервер в этом случае не запускается, деплой падает на healthcheck,
а Railway оставляет предыдущую рабочую сборку.

**4) Почта:** SPF/DKIM/DMARC для mironovich.pro у почтового провайдера.

**5) Сайт `mironovich.pro`** — добавить ровно две переменные (Railway пересоберёт сайт):

```
CAREER_APP_UPSTREAM=http://${{ai-career-app.RAILWAY_PRIVATE_DOMAIN}}:8080
CAREER_PROXY_SECRET=${{ai-career-app.CAREER_PROXY_SECRET}}
```

Если ссылка не разрешилась (сервиса нет) — секрет пустой, сайт работает как сегодня.

## 6. Перенос на production

1. Приёмка staging, зелёный CI PR #81 → слияние PR #81 в `main` (решение владельца).
   Сайт пересобирается из `main`, но без `CAREER_APP_UPSTREAM` ведёт себя как сегодня (проверено тестом на отдельной сборке).
2. Шаги 1–4 раздела 5. Сайт всё ещё не меняется.
3. Шаг 5: две переменные сайта. После пересборки — «Войти» → `/career` → код в почте → вход; damironovich@mail.ru → `/admin`.
4. Проверить на production лимит кодов: обычный вход работает с разных устройств/сетей (IP посетителя берётся из Cloudflare).
5. Реальная оплата — отдельный этап (Robokassa, юридическое согласование, `salesEnabled`).

## 7. Что может сломаться

* SMTP: неверные данные или нет SPF/DKIM — письма не доходят или в спаме → вход невозможен (сайт работает).
* Секрет прокси не совпал / ссылка не разрешилась — `/career` отвечает 404, остальной сайт работает.
* Приложение не стартует (ошибка конфигурации, миграции) — `/career` 502/504, остальной сайт работает.
* Cloudflare сменит диапазоны IP — посетители через новые узлы будут делить IP узла (жёстче лимит, не обход).
  Список в `lib/server/client-ip.ts` сверять с https://www.cloudflare.com/ips/ перед запуском.
* Сразу после подключения кэш цены (ISR 60 с) может до минуты показывать цену запуска.
* Существующая форма заявок сайта (`lib/rate-limit.ts`, не часть этапа) тоже видит IP Cloudflare — отдельная задача.

## 8. Откат

* Сайт: удалить `CAREER_APP_UPSTREAM` у сервиса `mironovich.pro` → Railway пересоберёт сайт (время обычного деплоя),
  кнопка «Войти» исчезнет, пути кабинета — 404 сайта. Быстрее: Deployments → Redeploy предыдущей сборки сайта.
* Приложение: Deployments → Redeploy предыдущей сборки, или удалить сервис `ai-career-app` (сайт не зависит от него).
* Код: revert merge-коммита PR #81 в `main`.
* База: миграции аддитивные, 013 работает только с `mironovich_career`; перед каждой миграцией — бэкап тома `ai-career-db`.
  Удаление сервиса базы не затрагивает сайт и демо-контуры.
