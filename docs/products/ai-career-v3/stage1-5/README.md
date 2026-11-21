# AI Career 3.0 — этап 1.5: перенос на mironovich.pro (без реальной оплаты)

Статус: интеграционная ветка `feature/ai-career-commercial` (PR #81, черновик, **не сливать** до приёмки).
`salesEnabled=false`, `legalApproved=false`, реальные платежи выключены, уроки остаются в `review`.

## 1. Архитектура

```
Посетитель ──HTTPS──▶ mironovich.pro (сервис сайта, как сейчас)
                        │  /, /products/…, документы — отдаёт сам сайт
                        │  /career, /admin, /api/career/*, /career-app/_next/*
                        ▼  (middleware: rewrite + x-career-proxy, x-forwarded-host, x-career-client-ip)
                      ai-career-app (отдельный сервис Railway, БЕЗ публичного домена)
                        │  отвечает только запросам с секретом прокси (+ /healthz)
                        ▼
                      PostgreSQL mironovich_career (отдельная пустая база)
```

* Сайт не хранит доступов к базе приложения. Цена на сайте берётся из `GET /api/career/shop/public-quote`
  (таймаут 2 с, ISR 60 с); если приложение недоступно — сайт показывает запасную цену запуска и продолжает работать.
* Если приложение упало, ломаются только пути `/career`, `/admin`, `/api/career/*` — все страницы сайта работают.
* Без `CAREER_APP_UPSTREAM` на сайте middleware ничего не меняет, кнопка «Войти» не показывается (сегодняшний production).
* Вход — шестизначный код из письма, без пароля. Регистрация открыта; новый аккаунт без доступа до оплаты или приглашения.
  Администратор задаётся списком `CAREER_V3_ADMIN_EMAILS` (damironovich@mail.ru).
* Cookies: `__Host-career_session`, `__Host-career_login` (Secure, HttpOnly, SameSite=Lax, Path=/).
  CSRF: проверка Origin/Sec-Fetch-Site на всех изменяющих запросах. Все ответы кабинета — `X-Robots-Tag: noindex`,
  `robots.txt` закрывает `/career`, `/admin`, `/api/`, `/career-app/`, `/preview-`.
* Цена: единый источник — таблица цены в базе приложения: AUTO 1 993 → 3 990 → 5 900 ₽ (10–10–20), MANUAL — любая из трёх.
  Её читают сайт, админка и будущая Robokassa.

## 2. Профили

| Профиль | Почта | Оплата | Назначение |
|---|---|---|---|
| `commercial-staging` | preview-outbox (`/preview-mail`) | эмулятор Robokassa | staging, проект `mironovich-commercial-staging` |
| `commercial` | только SMTP | **нет** (любая переменная Robokassa запрещена конфигом) | production |

Миграции: `001`–`012` общие, `migrations/career-commercial/013_commercial_real_users.sql` — только для коммерческих баз
(снимает ограничения «только синтетические данные» в новой схеме). Демо-базы, пользователи и прогресс не затрагиваются.

## 3. Настройки Railway для production (выполняет владелец, вне этого PR)

Проект `mironovich-career-production`, окружение `production`.

**База** `ai-career-db`: PostgreSQL 16, база `mironovich_career`, том с бэкапами. Новая и пустая — никаких данных из демо.

**Сервис `ai-career-app`** (из той же ветки/коммита, без публичного домена):

| Переменная | Значение |
|---|---|
| `CAREER_V3_DEMO` | `1` |
| `CAREER_V3_DEMO_PROFILE` | `commercial` |
| `CAREER_V3_DEMO_ORIGIN`, `NEXT_PUBLIC_SITE_URL` | `https://mironovich.pro` |
| `CAREER_V3_DEMO_DATABASE_URL` | ссылка на переменную базы (`${{ai-career-db.DATABASE_URL}}`) |
| `CAREER_V3_DEMO_SESSION_SECRET` | случайная строка ≥ 64 символов (генерируется в Railway) |
| `CAREER_V3_OTP_SECRET` | случайная строка ≥ 48 символов |
| `CAREER_PROXY_SECRET` | случайная строка ≥ 32 символов, отличная от секрета сессии |
| `CAREER_V3_MAIL` | `smtp` |
| `CAREER_V3_SMTP_HOST`, `CAREER_V3_SMTP_PORT`, `CAREER_V3_SMTP_USER`, `CAREER_V3_SMTP_FROM` | данные почтового сервера; отправитель `info@mironovich.pro` |
| `CAREER_V3_SMTP_PASSWORD` | только в Railway (sealed), не в репозитории и не в чате |
| `CAREER_V3_ADMIN_EMAILS` | `damironovich@mail.ru` |
| `PORT` | `8080` |

Start: `node --experimental-strip-types --no-warnings scripts/career/demo-admin.mjs migrate && npx next start -H :: -p $PORT`,
healthcheck `/healthz`. Для домена отправителя нужны SPF/DKIM/DMARC для mironovich.pro.

**Сервис сайта** (существующий) — добавить только две переменные:

```
CAREER_APP_UPSTREAM=http://${{ai-career-app.RAILWAY_PRIVATE_DOMAIN}}:8080
CAREER_PROXY_SECRET=${{ai-career-app.CAREER_PROXY_SECRET}}
```

Сайт и приложение должны быть в одном проекте Railway (приватная сеть). Если сайт живёт в другом проекте —
приложение и база создаются в проекте сайта, либо нужна отдельная настройка сети.

## 4. Перенос на production

1. Приёмка staging (`https://mironovich-site-staging-staging.up.railway.app`), зелёный CI PR #81.
2. Слить PR #81 в `main` (решение владельца). На production без `CAREER_APP_UPSTREAM` поведение сайта не меняется.
3. Создать базу и `ai-career-app` по таблице выше, дождаться `/healthz` и строки «Коммерческая схема готова» в логах.
4. Проверить отправку тестового письма на свой адрес.
5. Добавить сайту две переменные → редеплой сайта. Проверить: «Войти» → `/career` → код → вход администратора → `/admin`.
6. Реальная оплата — отдельный этап (Robokassa, юридическое согласование, `salesEnabled`).

## 5. Что может сломаться

* SMTP: неверные данные или нет SPF/DKIM — письма с кодом не доходят или попадают в спам → вход невозможен.
* Секрет прокси различается на сайте и в приложении — `/career` отвечает 404.
* Приложение не стартует (миграция, переменные) — `/career` отвечает 502/504, остальной сайт работает.
* Первый запуск сайта после добавления переменных — кэш цены (ISR 60 с) может показать запасную цену до минуты.
* Публичный домен у `ai-career-app` — конфиг отказывается запускаться (защита от обхода прокси).

## 6. Откат

* Мгновенно: удалить `CAREER_APP_UPSTREAM` у сайта и передеплоить — кнопка «Войти» исчезает, пути кабинета отдают 404 сайта.
* Приложение: Railway → Deployments → Redeploy предыдущей сборки.
* Код: revert merge-коммита PR #81 в `main`.
* База: миграции аддитивные, `013` применяется только к коммерческой базе; перед каждой миграцией — бэкап тома.
  Демо-контуры и их базы этим этапом не меняются.
