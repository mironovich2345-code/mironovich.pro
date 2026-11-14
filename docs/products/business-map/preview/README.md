# Business Map — защищённый Railway Preview

Ветка: `feature/business-map-preview`. База: `feature/business-map-ui`, `3a6129dd6b4973fd0dc20ddaab0ba335a029aae2`.

Подготовлена production-сборка для отдельного защищённого preview-сервиса. Railway, production, main и PR №9 этой задачей не изменяются; деплой не выполняется.

## Режимы доступа

| Среда | Условия | Результат |
| --- | --- | --- |
| Локальный dev | NODE_ENV=development, BUSINESS_MAP_PROTOTYPE=1, Railway environment не задан | Прежний доступ без пароля |
| Railway Preview | Все четыре флага из таблицы ниже + настроенные credentials | Basic Auth на всём отдельном preview-сервисе |
| Preview без credentials / с невалидной конфигурацией | Не выполнено хотя бы одно обязательное условие | 404 на приложении/ассетах; healthcheck 503 |
| Preview с неверным или отсутствующим Authorization | Конфигурация корректна, пользователь не вошёл | 401 и стандартный диалог Basic Auth |
| Railway production | RAILWAY_ENVIRONMENT_NAME=production | Прототип 404 при любых флагах и credentials |
| Обычная production-сборка без точной конфигурации Preview | Нет разрешённого профиля среды | Прототип 404; публичные страницы работают как раньше |

Сопоставление preview и флагов точное: `preview` и `1`, а не `Preview`, `true` или `1 `; для запрета production дополнительно распознаются регистр и внешние пробелы. Dev-сервер с Railway environment `preview` не может воспользоваться локальным исключением.

## Точные параметры сервиса Railway

Настраивать только отдельную среду **preview** и отдельный сервис, не production. Использовать пустую среду, без копирования production-переменных. Создание/настройка/публикация выполняются владельцем отдельно после просмотра ветки.

| Параметр | Значение |
| --- | --- |
| GitHub repository | `mironovich2345-code/mironovich.pro` |
| Source branch | `feature/business-map-preview` |
| Root directory | `/` |
| Node.js | `22.x` из package.json |
| Установка | `npm ci` (обычно выполняется Railway автоматически) |
| Build command | `npm run build` |
| Start command | `npm start -- --hostname 0.0.0.0` |
| Порт | `PORT`, предоставленный Railway; Next читает его автоматически |
| Healthcheck path | `/healthz` |
| Домен | Отдельный HTTPS-домен Preview, например Railway-generated `…up.railway.app` |
| Адрес для владельца | `https://<preview-домен>/prototype/business-map` |
| CDN / HTML cache | Не включать force caching; ответы имеют no-store |

### Переменные

| Переменная | Точное значение / ограничение | Когда нужна |
| --- | --- | --- |
| `NODE_ENV` | `production` | Production build и runtime; не запускать `next dev` на Railway |
| `RAILWAY_ENVIRONMENT_NAME` | `preview` | Автоматически задаётся Railway по имени среды; не подменять production этим значением |
| `BUSINESS_MAP_PROTOTYPE` | `1` | Build/runtime |
| `SITE_NOINDEX` | `1` | Build/runtime |
| `NEXT_PUBLIC_SITE_URL` | `https://<фактический-preview-домен>`, без завершающего `/` | До сборки: canonical/robots и существующий release guard |
| `BUSINESS_MAP_PREVIEW_USERNAME` | Приватная server-only переменная: 1–64 ASCII символа из `A–Z a–z 0–9 . _ -` | Runtime |
| `BUSINESS_MAP_PREVIEW_PASSWORD` | Приватная server-only переменная: 16–1024 символа, не из одних пробелов, без управляющих символов; рекомендуется независимо сгенерированная строка 24+ символов | Runtime |

Credentials вводятся владельцем **только в Variables preview-сервиса Railway**, желательно как sealed variables. Значения не пересылать в чат, не добавлять в `.env`, код, GitHub, команды запуска, URL, логи и screenshots. `.env.example` содержит только пустые имена. Код читает credentials при запросе; тест подтвердил смену runtime-credentials на том же build. Railway может автоматически инициировать redeploy при изменении Variables — в рамках этой задачи изменения Variables не выполнялись.

После создания публичного домена `NEXT_PUBLIC_SITE_URL` можно задать его фактическим HTTPS-адресом. Допустима Railway reference-переменная `https://${{RAILWAY_PUBLIC_DOMAIN}}`, если она уже разрешается для этого сервиса на этапе сборки. Адрес `mironovich.pro` здесь использовать нельзя: существующий release guard расценит такую сборку как production и остановит её из-за SITE_NOINDEX=1. Защита release guard не изменена и не обходится.

Не переносить в Preview: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_YANDEX_METRICA_ID`, production-интеграции и другие секреты публичного сайта. Не добавлять `LEGAL_PREVIEW` и `NEXT_PUBLIC_CONSENT_PREVIEW` без отдельной задачи: они не нужны для Business Map.

### Просмотр с телефона

1. Открыть **HTTPS**-адрес `/prototype/business-map` на отдельном preview-домене.
2. Браузер покажет стандартный запрос username/password. Ввести credentials, заданные владельцем в Railway Variables. Ничего не добавлять к URL.
3. Проверить приветственный экран и выбрать вымышленный демо-сценарий. На экране постоянно показано предупреждение о синтетических данных.
4. Редактировать карту и план можно до перезагрузки. Обновление очищает данные анкеты.

Basic Auth передаёт credentials в HTTP Authorization на том же origin и должен использоваться через HTTPS. Приложение не ставит auth-cookie и не хранит пароль в JavaScript или web storage. Сам браузер может удерживать Basic credentials в своей сессии: «Сбросить пример» очищает только карту, не является выходом из Basic Auth. Для ограниченного просмотра удобно отдельное приватное окно; после просмотра закрыть его. Прототип не является системой аккаунтов.

## Граница защиты

- `middleware.ts` проверяет весь preview-origin, включая HTML, RSC, `?_rsc`, prefetch, segment-prefetch, `/_next/data`, JS, CSS, шрифты, изображения и manifests. Matcher намеренно не исключает static assets и не проверяет Referer как доказательство доступа.
- Повторная проверка в серверной странице `/prototype/business-map` читает Authorization непосредственно. Нельзя открыть страницу поддельным заголовком «middleware уже разрешил».
- Единственное неавторизованное исключение Preview — GET/HEAD `/healthz`: только `ok` или `unavailable`, без приложения, формы и данных. При неготовой конфигурации статус 503.
- Preview не выполняет `/api/*`, POST и другие изменяющие запросы даже после входа. Публичная форма не доставит Telegram-заявку, API рекомендаций не вызывается. Production API и калькуляторы не изменены.
- Все ответы защищённого сервиса, включая ассеты и 401/404, получают private/no-store, CDN-Cache-Control и Surrogate-Control no-store, X-Robots-Tag noindex/nofollow/noarchive. Для страницы сохранён force-dynamic, общего auth-cache или cookie-сессии нет.
- Next.js дополняет/заменяет Vary для HTML/RSC. Запрет хранения обеспечивается проверенными no-store-заголовками, не предположением о том, что конкретный Vary переживёт обработку Next.
- Прототип остаётся изолированным через `PublicSiteOnly`: нет публичной аналитики, attribution, навигации к формам, внешних запросов анкеты. Данные компании и процессов — только React state вкладки.
- Это изоляция отдельной preview-копии сайта. Публичные пути основного production-сервиса не получают Basic Auth; `/prototype/business-map` там всегда закрыт.

При переходе к настоящему кабинету понадобится отдельная система доступа и хранения; общий Basic password Preview не заменяет принадлежность данных аккаунту. В текущей задаче нет БД, регистрации, платежей и ИИ.

## Проверка перед будущим ручным развёртыванием

- В Railway действительно выбрана среда `preview`, source branch правильная, production-service не меняется.
- Обе credentials заданы приватно только в Preview; секретов в build-аргументах и URL нет.
- Лог сборки показывает Node 22 и `[release-guard] цель сборки: не production`.
- `/healthz` даёт 200 без пароля; без корректной конфигурации — 503.
- Прототип без входа даёт 401, с неверным паролем не открывается, с верным — открывается и реагирует на демо-сценарии.
- Прямой URL JS/CSS без входа тоже даёт 401, а ответы после входа содержат no-store.
- Окружение `production` остаётся на прежней ветке/коммите и не получает новые переменные.

Локально это подтверждено production-сборкой и HTTP-проверками. Фактического Railway-деплоя и проверки на физическом телефоне не было.
