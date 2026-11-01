# Preview-деплой ветки на Railway

Временная копия сайта из ветки `claude/busy-carson-4j9hr7` для просмотра в
браузере. Production (`main`, домен mironovich.pro) не затрагивается.

## Что поддерживает проект

| Возможность | Как |
|---|---|
| Закрыть от поиска | `SITE_NOINDEX=1` (именно `1`, не `true`): `robots.txt` → `Disallow: /`, каждый ответ — `X-Robots-Tag: noindex, nofollow` |
| Новые юридические тексты с пометкой «Проект документа» | `LEGAL_PREVIEW=1` |
| Показать cookie-баннер без аналитики | `NEXT_PUBLIC_CONSENT_PREVIEW=1` при **незаданном** ID Метрики: баннер и «Настройки аналитики» работают, загружать нечего |
| Не собирать заявки | Не задавать `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`: форма проверяет поля, а при отправке показывает «Не получилось доставить заявку…» — ничего не сохраняется и не пересылается |
| Не собирать аналитику | Не задавать `NEXT_PUBLIC_YANDEX_METRICA_ID` |
| Не обойти защиту production | Сборка с адресом `*.up.railway.app` и окружением не `production` — не production; все переменные выше production-сборка не пропустит (`release-guard.md`) |

Почему не «PR Environments» Railway: они копируют переменные production
(токен бота, ID Метрики) — preview начал бы собирать настоящие заявки и
аналитику. Нужна отдельная **пустая** среда в том же проекте.

## Действия в Railway (≈ 10 минут)

Названия пунктов могут немного отличаться — ориентируйтесь на смысл.

1. Railway → проект с сайтом (`handsome-warmth`) → переключатель окружений
   вверху (`production`) → **New Environment** → **Empty Environment** →
   имя `preview`. **Не выбирать Duplicate / Fork production.**
2. Убедиться, что вверху выбрано `preview`. **Create / New → GitHub Repo →
   `mironovich2345-code/mironovich.pro`**.
3. Открыть созданный сервис → **Settings → Source → Branch**:
   `claude/busy-carson-4j9hr7`.
4. **Settings → Networking → Generate Domain** — скопировать адрес вида
   `https://….up.railway.app`. Свой домен **не подключать**.
5. **Variables → Raw Editor**, вставить (подставив адрес из п. 4):

   ```
   NEXT_PUBLIC_SITE_URL=https://ВАШ-АДРЕС.up.railway.app
   SITE_NOINDEX=1
   LEGAL_PREVIEW=1
   NEXT_PUBLIC_CONSENT_PREVIEW=1
   ```

   **Не добавлять:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
   `NEXT_PUBLIC_YANDEX_METRICA_ID`, `NEXT_PUBLIC_GA_ID`, `RATE_LIMIT_CLIENT_IP`.
6. **Deploy** (или «Apply changes» / «Deploy» для изменений). Если первая
   сборка запустилась до шага 5 и упала с `[release-guard] production-сборка
   остановлена` — это ожидаемо (адреса ещё не было): после шага 5 нажать
   **Redeploy**.
7. Дождаться **Active**. В **Build Logs** должна быть строка:
   `[release-guard] цель сборки: не production (NEXT_PUBLIC_SITE_URL=https://…up.railway.app; RAILWAY_ENVIRONMENT_NAME=preview)`.

Production при этом не меняется: другое окружение, свои переменные, свой
домен. Новые push в ветку будут пересобирать только preview.

## Что проверить на preview

| Что | Ожидание |
|---|---|
| `https://…/robots.txt` | `Disallow: /` |
| Главная, `/services`, три услуги, `/about`, `/blog`, статья | Открываются, новый дизайн |
| Cookie-баннер | Внизу; «Разрешить» и «Отклонить» закрывают его; «Настройки аналитики» в подвале открывают снова. Аналитика не загружается |
| Мобильное меню (телефон) | «Меню» → список на весь экран под шапкой; ссылка закрывает меню |
| Favicon | Графитовый квадрат, белая «M» с красной точкой (на телефоне — «На экран Домой») |
| Форма `/contact` | Пустая отправка — ошибки у полей. С выдуманными данными без персональных («Проверка», `@preview_check`) — «Не получилось доставить заявку…». **Реальные данные не вводить** |
| `/privacy`, `/consent` | Пометка «Проект документа — не опубликован» |

## Удалить после просмотра

Railway → окружение `preview` → **Settings → Danger → Delete Environment**.
Production не затрагивается.
