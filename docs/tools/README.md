# Инструменты MIRONOVICH.PRO v3

Текущий сценарий: стоимость повторяющейся работы → почему процесс стоит проверить → консультация.
Оба URL сохранены: `/tools/labor-cost`, `/tools/automation-cost`. Часы, ₽/месяц и ₽/год видны сразу.
Стоимость времени не называется экономией; неизвестные данные не заменяются нулями или зарплатой.

- [UX-предложение, до/после, реализация и результаты тестов v3](cost-why-v3/README.md)
- [Совместимость с отдельным Draft PR #9](cost-why-v3/README.md#совместимость-с-pr-9)

Контракт/модель — `lib/tools/cost-why.ts`, ввод — `cost-why-draft.ts`, перенос — `cost-why-storage.ts`.
UI — `CostWhyCalculator` и `CostWhyResult` за публичным адаптером `GuidedCalculator`.
Заявка получает валидированные исходные данные и пересчитывается сервером. Результат доступен
без формы. Старые формулы, Task IDs, GUIDED_VERSION и контракты v1/v2 сохранены.

Локально: Node 22, `npm ci`, `npm run dev`. Проверки: `npm test`, `npm run lint`,
`npm run typecheck`, `npm run build`. Актуальный UI-скрипт — `scripts/test-cost-why-browser.py`,
со строго локальной заглушкой доставки; инструкции и ограничения — в отчёте v3.

Исторические материалы:

- [Исследование 12 сценариев](manual-work-automation-research.md)
- [Контракт/ограничения ИИ-приоритетов v2](ai-recommendations.md)
- [Юридическое дополнение для ИИ, не опубликовано](openai-privacy-review.md)
- [Проверки v2](testing-v2.md)
- [Серверная доступность v2](availability-release.md)
- [Исходное предложение индивидуального ИИ-разбора](individual-ai-next-stage.md)

Прежний `scripts/test-tools-browser.mjs` описывает исторический интерфейс v2.
Индивидуальный ИИ-консультант — отдельный [Draft PR #9](https://github.com/mironovich2345-code/mironovich.pro/pull/9),
не объединённый автоматически. OpenAI, Railway и production в этом этапе не включаются.
