# QA коммерческой переупаковки

15 ноября 2026. Ветка `feature/business-solutions-positioning`, база свежий `origin/main` @ `09fc3030ca4f47a7a481fe0894dc3a1d9692177b`. Проверялась локальная production-сборка, не production-сайт и не Railway. Работа выполнена в отдельном worktree; Business Map AI не использован как база.

## Результаты

| Проверка | Факт |
|---|---|
| `npm test` | **236/236**, failures/skipped = 0. Прежние расчётные тесты проходят; добавлены проверки цен, маршрутов/категорий, публикационных ограничений, demo gate и суммы 30 часов |
| `npm run lint` | Exit 0, без предупреждений ESLint |
| `npm run build` | Exit 0, статические каталог и пять solution-страниц |
| `npm run typecheck` | Exit 0 после генерации Next types |
| HTTP / SEO | **67 проверок**: 58 URL sitemap, два юридических URL и семь private/unknown URL. 60 ответов 200, 7 ответов 404. Canonical/description/OG и JSON-LD проверены |
| Браузер | **55 сценарных проверок**, Chromium 156.0.8078.79; ширины **320, 375, 768, 1024, 1440 CSS px**, высоты 812/1000 |
| Layout / доступность | **110 проверок layout**, без горизонтального переполнения документа/проверенных заголовков/карточек; **70 axe-сканирований**, WCAG 2 A/AA и 2.1 AA, нарушений 0. axe-core 4.14.0 |
| JavaScript / внешние обращения | Page errors = 0; внешние запросы браузера = 0. Модель, реальные демо-сервисы и Telegram не вызывались |
| Закрытые кейсы | Четыре draft URL → 404, отсутствуют в sitemap/карточках. Маркеров закрытого кейса в клиентских JS chunks — **0** |
| Скриншоты | **87**, реальные снимки локального интерфейса; список в checks.json |

Машинные свидетельства: [commands.json](qa/commands.json), [checks.json](qa/checks.json), [полный TAP](qa/unit-tests.tap), [lint](qa/lint-output.txt), [build](qa/build-output.txt), [typecheck](qa/typecheck-output.txt). Логи терминала нормализованы только по конечным пробелам/переносам. Новых зависимостей приложения нет; инструменты форматирования/axe/Playwright использованы вне package.json/lock.

## Что пройдено в браузере

На каждой ширине: точный Hero и две CTA, пять решений/цен, инструменты ниже; native «Другие услуги» через Enter/Space; мобильное меню или desktop disclosure, Escape, возврат фокуса и закрытие при переходе. Проверены переходы между solution-страницами через клиентский роутер с обновлением контекста формы, solution_view/cta_click со slug, якоря #contact и прежний #services. У каждой solution-страницы раскрывался учебный пример, переключались доступные сценарии, сохранялась подпись о синтетических данных. Для одиночного примера нет бессмысленного селектора.

Проверены CTO 150 000 ₽/до 30 часов и таблица распределения; `/services`, два разрешённых кейса, `/tools`, `/products` и `/contact`. У цифровых продуктов нет фиктивных кнопок оплаты; live demo-ссылок без подтверждения нет. Существующие service URL сохранены и проходят HTTP-проверку. Новые draft-кейсы и закрытый Business Map не доступны по прямому адресу.

Без согласия форма не выполняет POST и ставит фокус на checkbox. На 375 px выполнен настоящий запрос только к **локальному** API с удалёнными из окружения Telegram credentials: он вернул **503**, интерфейс показал ошибку/контакт для связи и сохранил форму. `delivered=true` не подменялся; «Заявка отправлена» не показывалась. В payload нет company/direction при выключенном extended режиме. Настоящая внешняя доставка остаётся владельческой проверкой, не считается пройденной.

## Найдено и исправлено

- Недостаточный контраст старого текста white/85 на красной ToolCard: 3,84:1 для 14 px. Сделан полный белый; формулы и данные инструментов не менялись.
- На 320 px длинные слова выходили за внутренний контейнер: заголовок аналитики 283/276 px, CTO 280/276 px, карточка продукта 279/276 px. Минимальные размеры шрифта скорректированы без изменения текста и статусов; финальный layout проходит.
- Несмотря на 404 draft-страниц, транзитивный импорт MobileMenu → config/site → content/projects переносил закрытый текст в layout JS. Клиентские примитивы выделены в config/routes; серверный реестр остаётся на сервере. В runner добавлена регрессия по фактическим собранным chunks.
- Проверка будущей demo-ссылки на полной странице кейса не должна терять дату/разрешение из-за удаления caseStudy ради скрытия self-link. Исходный Project сохраняется, отдельно выключается только ссылка на саму страницу.

Во время разработки исправлялись и селекторы самого QA: Next route announcer тоже имеет role=alert, поэтому проверка ошибки доставки ограничена формой. Ошибка строгого селектора не выдавалась за дефект доставки или успешный лид.

## Скриншоты для обзора

| Экран | 375 px | 1440 px |
|---|---|---|
| Первый экран | [мобильный](qa/screenshots/375-home.png) | [desktop](qa/screenshots/1440-home.png) |
| Решения и цены | [карточки](qa/screenshots/375-home-solutions.png) | [каталог](qa/screenshots/1440-solutions.png) |
| Академия | [страница](qa/screenshots/375-corporate-academy.png) | [страница](qa/screenshots/1440-corporate-academy.png) |
| KPI | [страница](qa/screenshots/375-employee-kpi.png) | [страница](qa/screenshots/1440-employee-kpi.png) |
| Аналитика | [страница](qa/screenshots/375-management-analytics.png) | [страница](qa/screenshots/1440-management-analytics.png) |
| Стандарты | [страница](qa/screenshots/375-branch-standards.png) | [страница](qa/screenshots/1440-branch-standards.png) |
| Lead Engine | [страница](qa/screenshots/375-lead-engine.png) | [страница](qa/screenshots/1440-lead-engine.png) |
| CTO и часы | [распределение](qa/screenshots/375-cto-hours.png) | [страница](qa/screenshots/1440-cto.png) |
| Другие услуги | [раскрытие](qa/screenshots/375-other-services.png) | [раскрытие](qa/screenshots/1440-other-services.png) |
| Синтетика с подписью | [аналитика](qa/screenshots/375-management-analytics-synthetic.png) | [стандарты](qa/screenshots/1440-branch-standards-synthetic.png) |
| Форма | [контакты](qa/screenshots/375-contact.png) | [контакты](qa/screenshots/1440-contact.png) |

Для 320/768/1024 есть тот же набор основных страниц: [полный список](qa/checks.json). OpenGraph — [PNG 1200×630](../../public/og/business-solutions.png), исходник [og.html](og.html), воспроизведение `python scripts/render-repositioning-og.py`.

## Ограничения и допуск

Технически ветка готова к коммерческому **обзору и демонстрации предложений**, без заявления о пяти готовых внедрениях. Реального исследования понимания за 10–15 секунд не было. Физический телефон/IME/Safari/экранный диктор не проверены; headless и axe не заменяют их. Новые страницы статические, тяжёлые зависимости/анимации/внешние шрифты не добавлены. Next оценивает First Load JS главной в 121 kB, solution detail в 123 kB; это build-метрики, **не** измеренные полевые LCP/INP/CLS и не сравнительный benchmark.

Реальные внешние приложения/подключения/результаты, права на Metro UP и корпоративные материалы, отдельное live demo CLUB OPS, эксплуатация Lead Engine, настоящая доставка Telegram и внешний поисковый кэш не подтверждены. Эти ограничения явно представлены на страницах/в [case-evidence](case-evidence.md), а действия владельца — в [release-checklist](release-checklist.md). Release guard сообщает о прежнем исключении юридического релиза от 01.11.2026, незаполненных новых проектах документов и общем лимите без проверки IP; правила не отключались и документы не переписывались.

## Повторить проверку

Node 22, Python Playwright, Chromium; AXE_SCRIPT указывает на установленный axe.min.js. В этой среде использованы Node 22.23.5 и `/usr/bin/chromium`. Python/axe не добавляются в runtime проекта.

```sh
npm ci
npm test
npm run lint
npm run build
npm run typecheck
AXE_SCRIPT=/path/to/axe.min.js python scripts/check-repositioning.py
```

При необходимости задать NODE_BINARY/CHROMIUM_PATH. Runner сам поднимает/останавливает локальный сервер, удаляет ключи доставки из его окружения и блокирует внешний браузерный трафик; не принимает production URL. Build не запускать одновременно с runner. При отсутствии AXE_SCRIPT отчёт честно помечает проверку SKIPPED — это не эквивалент текущему полному прогону.

Документы: [аудит](site-audit.md), [архитектура](commercial-architecture.md), [цены](pricing.md), [доказательства кейсов](case-evidence.md), [SEO](seo-migration.md), [релиз](release-checklist.md). Полный перечень файлов — [changed-files.txt](qa/changed-files.txt). Main, AI-ветка и production не изменены; merge и Railway-deploy не выполнялись.
