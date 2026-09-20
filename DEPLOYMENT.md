# Деплой MIRONOVICH

Пошагово: от локальной проверки до проиндексированного сайта на своём домене.
Ничего из этого не выполнено автоматически — GitHub, Railway и DNS остаются за вами.

---

## 1. Локальная проверка перед пушем

> **Первый запуск:** `package-lock.json` в репозиторий не включён — его
> невозможно сгенерировать без установленного npm. Один раз выполните
> `npm install`, затем закоммитьте появившийся `package-lock.json`:
> после этого работают и `npm ci`, и воспроизводимые сборки на Railway.

```bash
npm install          # первый раз — создаст package-lock.json
npm audit
npm run typecheck
npm run build
```

Нужен Node.js 18.18+ (`node -v`). Все четыре команды должны пройти без ошибок.

## 2. GitHub

```bash
git init
git add .
git commit -m "Initial MIRONOVICH website"
git branch -M main
git remote add origin git@github.com:<username>/mironovich.git
git push -u origin main
```

Репозиторий можно держать приватным — Railway работает и с приватными.
Перед пушем убедиться, что `.env.local` не попал в индекс: `git status`
не должен его показывать (он в `.gitignore`).

## 3. Railway

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub repo**.
2. Выбрать репозиторий. Если проект лежит не в корне — Settings → Root Directory.
3. Railway определяет Next.js сам: `npm ci` → `npm run build` → `npm start`.
   Вручную при необходимости: Settings → Build Command `npm run build`,
   Start Command `npm start`.
4. Первый деплой запустится сразу — он может упасть без переменных, это нормально.

Порт настраивать не нужно: Railway передаёт `PORT`, `next start` его читает.

## 4. Environment variables

Railway → Variables → добавить:

```
NEXT_PUBLIC_SITE_URL=https://mironovich.pro
TELEGRAM_BOT_TOKEN=<из шага 8>
TELEGRAM_CHAT_ID=<из шага 8>
```

Опционально: `NEXT_PUBLIC_TELEGRAM_URL`, `NEXT_PUBLIC_INSTAGRAM_URL`,
`NEXT_PUBLIC_YANDEX_METRICA_ID`, `NEXT_PUBLIC_GA_ID`, `LEAD_TIMEZONE`.

Важно: `NEXT_PUBLIC_*` вшиваются в бандл **на этапе сборки**. После их
изменения нужен новый деплой (Redeploy), а не restart.

`NEXT_PUBLIC_SITE_URL` указывать сразу production-адресом, иначе в canonical,
sitemap и OG попадёт адрес `*.up.railway.app`.

## 5. Домен mironovich.pro

1. Railway → Settings → Networking → **Custom Domain** → `mironovich.pro`.
2. Railway выдаст CNAME-цель — прописать её у регистратора домена.
   Если регистратор не поддерживает CNAME на корне (apex), использовать его
   ALIAS/ANAME-запись либо перевести DNS на Cloudflare.
3. Дождаться распространения DNS: `dig mironovich.pro +short`.
4. После привязки — Redeploy, чтобы подхватился `NEXT_PUBLIC_SITE_URL`.

## 6. www → основной домен

Добавить вторым доменом `www.mironovich.pro` и настроить **редирект 301** на
`mironovich.pro` (на уровне DNS-провайдера или Cloudflare Redirect Rules).
Два домена с одинаковым контентом без редиректа размывают индексацию.

Проверка: `curl -sI https://www.mironovich.pro | head -n 3` → `301`.

## 7. HTTPS

Railway выпускает сертификат автоматически после привязки домена. Проверить:

- `https://mironovich.pro` открывается без предупреждений;
- `http://` редиректит на `https://`;
- приходит заголовок `Strict-Transport-Security` (прописан в `next.config.mjs`).

HSTS с `preload` действует два года — это нормально для постоянного домена.

## 8. Telegram bot

1. В Telegram открыть [@BotFather](https://t.me/BotFather) → `/newbot`,
   задать имя и username.
2. BotFather выдаёт **только токен** → `TELEGRAM_BOT_TOKEN`.
   Chat id он не показывает — его нужно получить отдельно.
3. Открыть чат со своим ботом и отправить `/start`. Без этого бот не имеет
   права написать вам первым, и заявки не дойдут.
4. Открыть в браузере:
   `https://api.telegram.org/bot<ТОКЕН>/getUpdates`
   Взять `result[0].message.chat.id` → `TELEGRAM_CHAT_ID`.
   Если `result` пустой — сообщение боту не дошло, повторить шаг 3.
5. Для группы: добавить бота в группу, написать там любое сообщение, взять
   оттуда же `chat.id` (у групп он отрицательный).
6. Внести обе переменные в Railway → Redeploy.

## 9. Тест формы

На живом домене отправить тестовую заявку и проверить:

- сообщение пришло в Telegram и содержит блок `ИСТОЧНИК`;
- на странице появился блок «Заявка отправлена»;
- при пустых `TELEGRAM_*` success **не** показывается, а видно сообщение об
  ошибке с прямой ссылкой на Telegram;
- валидация не пускает пустые поля и требует согласие;
- поле «Телефон или Telegram» принимает и `+7 999 000-00-00`, и `@username`.

## 10. Яндекс Метрика

1. metrika.yandex.ru → создать счётчик на `mironovich.pro`.
2. Номер счётчика → `NEXT_PUBLIC_YANDEX_METRICA_ID` в Railway → Redeploy.
3. Создать цели типа «JavaScript-событие» с идентификаторами:
   `lead_submit_success`, `form_start`, `cta_click`,
   `telegram_fallback_click`, `lead_submit_error`.
4. Проверить в отчёте «Сводка», что визиты пошли.

Пока переменная пустая, скрипт не загружается и домен Метрики не открывается в CSP.

## 11. Яндекс Вебмастер

1. webmaster.yandex.ru → добавить сайт.
2. Подтвердить права (проще всего — через привязанную Метрику или DNS TXT).
3. Индексирование → Файлы Sitemap → `https://mironovich.pro/sitemap.xml`.
4. Переобход страниц → добавить `/` и `/about`.

## 12. Google Search Console

1. search.google.com/search-console → добавить ресурс «Домен» `mironovich.pro`.
2. Подтвердить через DNS TXT-запись.
3. Sitemaps → добавить `https://mironovich.pro/sitemap.xml`.
4. Проверка URL → `https://mironovich.pro/` → «Запросить индексирование».

## 13. Sitemap и robots

Генерируются Next.js из `NEXT_PUBLIC_SITE_URL`, править руками не нужно.
Проверить на живом домене:

- `/sitemap.xml` — две записи: `/` и `/about`;
- `/robots.txt` — `Allow: /`, `Disallow: /api/`, строка `Sitemap:` с production-адресом;
- `/privacy` и `/consent` отдают `noindex, follow`.

Если в sitemap оказался `up.railway.app` — в production не задана
`NEXT_PUBLIC_SITE_URL` или после её добавления не было нового деплоя.

## 14. Финальная проверка OG

Прогнать `https://mironovich.pro` через:

- Telegram — просто отправить ссылку себе;
- opengraph.xyz или metatags.io;
- Facebook Sharing Debugger (умеет сбрасывать кеш).

Ожидаемо: картинка 1200×630, заголовок
«MIRONOVICH — автоматизация, AI и цифровые продукты для бизнеса», описание про
внутренние приложения и автоматизацию. Для `/about` — «Данил Миронович — MIRONOVICH».

JSON-LD: validator.schema.org → WebSite + Person на главной,
ProfilePage + Person на `/about`, без ошибок.

## 15. Instagram UTM

По одной ссылке на аккаунт — `utm_content` показывает, какой профиль привёл заявку:

```
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_pro
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_now
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_fit
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_ru
https://mironovich.pro/?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=mironovich_of
```

Эти ссылки ставятся в био. Для сторис и рилсов удобно менять `utm_campaign`
(`stories`, `reels`), оставляя аккаунт в `utm_content`.

Источник запоминается при первом заходе и не теряется при переходах по сайту,
поэтому в заявке видно исходный профиль, а не последнюю страницу.

---

## Launch checklist

### Локально
- [ ] `node -v` ≥ 18.18
- [ ] `npm ci` прошёл
- [ ] `npm audit` без критичных уязвимостей
- [ ] `npm run typecheck` чистый
- [ ] `npm run build` чистый

### GitHub
- [ ] `git init` → commit → push выполнены
- [ ] `.env.local` не в репозитории
- [ ] `.env.example` в репозитории
- [ ] секретов в истории коммитов нет

### Railway
- [ ] проект создан из GitHub repo
- [ ] сборка проходит
- [ ] переменные заведены в Variables
- [ ] `NEXT_PUBLIC_SITE_URL=https://mironovich.pro`
- [ ] `TELEGRAM_BOT_TOKEN` **без** префикса `NEXT_PUBLIC_`
- [ ] после добавления переменных сделан Redeploy

### Домен
- [ ] `mironovich.pro` привязан и открывается
- [ ] `www.mironovich.pro` редиректит 301
- [ ] HTTPS-сертификат выпущен
- [ ] `http://` редиректит на `https://`

### Форма
- [ ] боту отправлен `/start`
- [ ] chat id получен через `getUpdates`
- [ ] тестовая заявка пришла в Telegram
- [ ] в сообщении есть блок `ИСТОЧНИК`
- [ ] success показывается только при подтверждённой доставке
- [ ] при ошибке видна резервная ссылка Telegram
- [ ] поле принимает и телефон, и `@username`

### Мобильные
- [ ] проверено на 390px: Hero, форма, FAQ
- [ ] sticky CTA виден только на мобильных
- [ ] sticky CTA уходит, когда форма на экране
- [ ] горизонтального скролла нет

### SEO
- [ ] `/sitemap.xml` отдаёт production-URL
- [ ] `/robots.txt` корректен
- [ ] `/privacy` и `/consent` — `noindex, follow`
- [ ] один H1 на странице
- [ ] OG-превью корректно в Telegram
- [ ] JSON-LD проходит validator.schema.org
- [ ] sitemap отправлен в Search Console
- [ ] sitemap отправлен в Вебмастер

### Аналитика
- [ ] счётчик Метрики создан, ID в Variables
- [ ] визиты видны в Метрике
- [ ] цели по событиям созданы
- [ ] в события не уходят персональные данные
- [ ] без ID внешние скрипты не загружаются

### Instagram
- [ ] пять UTM-ссылок проставлены в био аккаунтов
- [ ] переход по ссылке даёт нужный `utm_content` в заявке
