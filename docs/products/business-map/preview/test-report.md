# Проверка защищённого Preview

Дата: 14 ноября 2026. Исходный коммит: `3a6129dd6b4973fd0dc20ddaab0ba335a029aae2`. Проверки приложения и HTTP-harness выполнены на Node 22.23.5, npm 11.9.0, Next.js 15.5.28.

| Проверка | Результат |
| --- | --- |
| `npm test` | **278/278**, без пропусков: 268 предыдущих + 10 тестов доступа |
| `npm run lint` | Успешно, без предупреждений ESLint |
| `npm run typecheck` | Успешно |
| `npm run build` | Успешно; production-сборка с флагами Preview и отдельным тестовым origin |
| `node scripts/check-business-map-preview.mjs` | **77 HTTP-проверок** существующего production build; credentials в отчёт не включены |
| `git diff --check` | Успешно |

В сборке не было credentials. Для HTTP-проверок они генерировались в памяти и передавались только в окружение локальных дочерних серверов. Тот же build проверен с новой парой credentials без пересборки и с RAILWAY_ENVIRONMENT_NAME=production. Значения тестовых и реальных credentials не сохранены в репозиторий.

## Unit/regression

- Прежний локальный dev с одним флагом работает без credentials и noindex.
- Нужны все четыре точных флага Preview; отсутствующие и похожие строковые значения не открывают доступ.
- Верные credentials дают allow, неверные/отсутствующие/неверная схема — challenge.
- Незаданные, пустые, слишком короткие или невалидные переменные credentials дают hidden.
- Обработаны Base64-ошибки, UTF-8, `:` в пароле, oversized headers, чувствительность значений к пробелам.
- Проверены **300 сочетаний** Node mode / production-названия Railway / двух флагов: даже корректная Authorization не открывает prototype.
- Railway preview с NODE_ENV=development не использует локальное исключение без авторизации.
- Узнаются прямые, вложенные, закодированные, JSON/RSC и Next data пути; no-store-политика задана явно.

## HTTP black box

Машинный результат: `http-check.json`. Harness запускает и останавливает только локальные серверы на loopback; не обращается к Railway и не выполняет деплой.

Подтверждено:

- HTML: 401 без пароля/с неверным; 200 с правильным, без отражения credentials в ответе.
- 15 URL JS/CSS/shared chunks: 401 без Authorization и без Referer; 200 после входа; условные запросы с ETag не обходят проверку.
- RSC, prefetch, segment-prefetch и Next data alias закрыты до входа. Авторизованные RSC/prefetch отвечают 200 с content-type text/x-component.
- Поддельные x-middleware-subrequest, x-middleware-invoke и заголовок grant не открывают документ.
- HEAD и корень preview-сервиса требуют Basic; вход не меняет анонимный результат последующего запроса.
- `/api/lead` и `/api/tools/recommendation` заблокированы после авторизации — внешняя доставка и ИИ не вызываются.
- Без configured credentials закрыты и HTML, и static asset; healthcheck отвечает 503.
- Смена runtime-credentials делает прежнюю пару недействительной, новую — действительной на прежнем build.
- Preview без SITE_NOINDEX закрывает документ и bundle.
- Railway production при всех включённых opt-in и корректных credentials даёт 404 для документа и RSC; главная и оба калькулятора остаются 200 без Authorization.
- Проверенные приватные ответы имеют no-store, не имеют public/immutable. Next.js заменяет Vary для HTML/RSC своим набором; запрет кэширования проверен напрямую по Cache-Control и CDN-Cache-Control, а не по одному Vary.

Обычные production страницы и API исходниками не изменены. Дополнительные credentials не нужны им в production. Реальные заявки во время проверок не отправлялись.

## Обычный браузер

В локальном Chromium открыта production-сборка с Preview-профилем. Браузер показал стандартный Basic Auth; после одного ввода синтетической тестовой пары загрузились стили и JavaScript. При фактической ширине **375 CSS px** переключение на демо «Три процесса» изменило карту на 3/5, то есть hydration и интерактивность после защиты ассетов работают.

Снимок после входа: `authenticated-375.png`; в нём нет username/password, полей ввода пароля или credential-bearing URL. Для этой проверки сервер и credentials были временными, только loopback; реальные Railway secrets не использовались. Локальный запуск из среды CUA оказался недоступен, поэтому тестовый процесс запускался обычным execution tool; настройки браузера и его ограничения не менялись.

Физический телефон/Safari и внешний Railway HTTPS-домен не проверялись, поскольку задача исключает деплой. На реальном Preview владелец выполняет короткую проверку из README.

## Сохранённые ограничения

- Все бизнес-данные только в памяти вкладки, повторное открытие/перезагрузка сбрасывает их.
- Не добавлены БД, регистрация, платежи, ИИ или серверное хранение анкеты.
- Basic credentials могут удерживаться самим браузером. Сброс карты не является выходом из HTTP Basic; рекомендуется отдельное приватное окно.
- Приватным является весь отдельный Preview origin. Main, production configuration и PR №9 не менялись; никакой Railway mutation/deploy не выполнялся.
