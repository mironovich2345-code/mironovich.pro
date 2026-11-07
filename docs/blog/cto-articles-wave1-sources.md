# Источники и проверка фактов: волна CTO-статей

Дата проверки: 7 ноября 2026 года. Использованы технические первоисточники официальных репозиториев. Большие фрагменты не копировались; ссылки размещены рядом с соответствующими утверждениями в статьях.

## Использованные источники

| Источник | Что подтверждает и чего не подтверждает | Статьи |
|---|---|---|
| [logging](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Logging_Cheat_Sheet.md) | Журналирование событий, исключение чувствительных данных, проверка журналов | 1, 8, 10 |
| [prompt-injection](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.md) | Недоверие к внешним инструкциям, ограничение прав и подтверждение значимых действий | 2 |
| [evals](https://github.com/openai/evals/blob/main/README.md) | Проверка моделей и систем на собственных наборах; это не доказательство бизнес-окупаемости | 2, 10 |
| [asvs](https://github.com/OWASP/ASVS/blob/master/README.md) | Открытые проверяемые требования безопасности веб-приложений; применимый набор и версию согласуют отдельно | 3, 5, 6 |
| [webhooks](https://github.com/github/docs/blob/main/content/webhooks/about-webhooks.md) | Различие событийной доставки и опроса API на примере GitHub, без обещаний совместимости CRM | 4 |
| [api-practices](https://github.com/github/docs/blob/main/content/rest/using-the-rest-api/best-practices-for-using-the-rest-api.md) | Порядок работы с API и лимитами; конкретные значения GitHub не переносятся на чужие программы | 4 |
| [organizations](https://github.com/github/docs/blob/main/content/organizations/collaborating-with-groups-in-organizations/best-practices-for-organizations.md) | Непрерывность владения и распределение ролей на GitHub; не юридическое определение CTO | 6, 7, 9 |
| [backups](https://github.com/github/docs/blob/main/content/repositories/archiving-a-github-repository/backing-up-a-repository.md) | Состав копии репозитория и ограничения вариантов резервирования; данные приложения требуют отдельной проверки | 7, 8 |
| [secrets](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Secrets_Management_Cheat_Sheet.md) | Минимальные права, управляемый доступ, жизненный цикл секретов; передача без общих паролей и открытых каналов | 4, 7 |

Проверка public URL: все девять ссылок — HTTP 200. Исходники получены с raw.githubusercontent.com. Документы в ветках main/master могут изменяться: перед production-публикацией перепроверить ссылки и формулировки. Там, где используется ASVS, текст рекомендует согласовать версию и применимый набор, а не обещает сертификат или полную проверку стандарта.

## Непроверенные стартовые материалы

- [korus](https://data.korusconsulting.ru/press-center/news/issledovanie-korus-konsalting-70-rossiyskikh-kompaniy-ne-mogut-otsenit-ekonomicheskiy-effekt-ot-vned/): доступ из среды заблокирован прокси (`403 Forbidden`); утверждения и цифры не использованы.
- [comindware](https://www.cnews.ru/news/line/2026-01-15_comindware_barery_avtomatizatsii): доступ из среды заблокирован прокси (`403 Forbidden`); утверждения и цифры не использованы.
- [solar](https://ai.cnews.ru/news/line/2026-06-03_risk_utechki_dannyh_glavnyj): доступ из среды заблокирован прокси (`403 Forbidden`); утверждения и цифры не использованы.
- [bpmsoft](https://corp.cnews.ru/news/line/2026-05-07_trendy_tsifrovizatsii_biznesa): доступ из среды заблокирован прокси (`403 Forbidden`); утверждения и цифры не использованы.
- [google](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): доступ из среды заблокирован прокси (`403 Forbidden`); утверждения и цифры не использованы.
- [yandex](https://www.yandex.ru/support/webmaster/ru/yandex-indexing/rank): доступ из среды заблокирован прокси (`403 Forbidden`); утверждения и цифры не использованы.

## Числовые примеры и границы выводов

- Статья 1: условные 3 сотрудника × 20 операций × 3 минуты / 60 × 22 дня = 66 часов; при принятой для примера стоимости часа 600 ₽ — 39 600 ₽/мес. При гипотезе 50% автоматизации — 33 часа стоимостью 19 800 ₽, без обещания денежной экономии.
- Статья 10: тот же исходный условный процесс; 33 часа снятой работы минус 8 дополнительных часов проверки = 25 часов стоимостью 15 000 ₽ при том же допущении. Дополнительные счета и реальное изменение выплат учитываются отдельно. Это не тариф, клиентский результат или рассчитанная окупаемость.
- Другие сценарии явно обозначены как условные. Рыночные тарифы, сроки ответа, поисковые частоты и гарантированные результаты не приводятся.
- Технические источники не доказывают экономический эффект, поддержку API конкретной CRM или полезность внешнего CTO для любой компании. Эти границы прямо обозначены в текстах.

## Контрольные суммы прочитанных исходников

Контрольные суммы фиксируют локально проверенные версии текста для редакционного аудита; сами сторонние материалы в репозиторий не копируются.

- `logging`: SHA-256 `55ed0b4e9b2a68dba0f5a26c817a20760632d91b315aa42bb33ecfe36cc7195d`.
- `prompt-injection`: SHA-256 `b70dea7fd522a6535315c7d3b0bc38be7fed915edf31392cf6f1d95137a76a7b`.
- `evals`: SHA-256 `f0b50bd53e2fbc81be774a6bfb0cf20997aa7509bd22925ae779a87d57c7c914`.
- `asvs`: SHA-256 `0140389ca679b4e5c677862f75c3377b643194a94cd26da3fd88f6d0f5b96770`.
- `webhooks`: SHA-256 `87920fbfef71b38fa48bdc240495d296b7c6abd8796491193762dbafec74b6df`.
- `api-practices`: SHA-256 `7e553b6f693b5e28abdde4c9634df5174edede713eb425d4b01f361867d8cc6e`.
- `organizations`: SHA-256 `858388f44b3c5e9fdc9a4c2c77306e7da96e0e9da110d0e772ceac9d7787934a`.
- `backups`: SHA-256 `358488bfe2fc48e237ba6b5a367a1b523515b65640945439f800e8546f2801ef`.
- `secrets`: SHA-256 `5bbd4a4fb6a68ccc974f55efffb3b19a095c2563fb366a66f929a5495bca171d`.
