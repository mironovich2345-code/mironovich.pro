# Модуль 1 «Безопасность работы с ИИ» — материалы #42

**Задача:** [#42](https://github.com/mironovich2345-code/mironovich.pro/issues/42) · **Версия:** 1.0.0 · **Дата:** 18.11.2026
**Статус:** черновик на проверке владельца проекта. Все четыре урока — `status: "review"`, `canBePublished: false`, `reviewedOn: null`. Слоты в [curriculum.json](../../../content/career/v3/curriculum.json) остаются `planned` и ссылаются на черновики через `draftLessonId`.

## 1. Что входит

| Материал | Файл-источник | Для покупателя |
| --- | --- | --- |
| Пособие «Безопасность использования ИИ на работе»: 10 глав, 8 кейсов, итоги, источники | [guide.md](../../../content/career/v3/materials/safety/guide.md) | [PDF A4, 26 стр.](../../../content/career/v3/materials/safety/pdf/safety-guide-a4.pdf) · [PDF для телефона, 62 стр.](../../../content/career/v3/materials/safety/pdf/safety-guide-mobile.pdf) |
| Чек-лист безопасного использования ИИ | [01-checklist.md](../../../content/career/v3/materials/safety/01-checklist.md) | [PDF](../../../content/career/v3/materials/safety/pdf/safety-checklist-a4.pdf) |
| Матрица допустимости данных (14 категорий × 3 режима) | [02-data-matrix.md](../../../content/career/v3/materials/safety/02-data-matrix.md) | [PDF](../../../content/career/v3/materials/safety/pdf/safety-data-matrix-a4.pdf) |
| Пять безопасных промптов с примерами заполнения | [03-prompts.md](../../../content/career/v3/materials/safety/03-prompts.md) | [PDF](../../../content/career/v3/materials/safety/pdf/safety-prompts-a4.pdf) |
| Обращение к руководителю: короткое, полное, заполненный пример, ответы на возражения | [04-manager-request.md](../../../content/career/v3/materials/safety/04-manager-request.md) | [PDF](../../../content/career/v3/materials/safety/pdf/safety-manager-request-a4.pdf) |
| Практикум: 4 задания на вымышленных данных + образцы решений | [05-practicum.md](../../../content/career/v3/materials/safety/05-practicum.md) | [PDF](../../../content/career/v3/materials/safety/pdf/safety-practicum-a4.pdf) |
| Контрольный тест: 12 ситуационных вопросов, ответы и объяснения | [06-test.md](../../../content/career/v3/materials/safety/06-test.md) — генерируется из уроков | [PDF](../../../content/career/v3/materials/safety/pdf/safety-test-a4.pdf) |
| Рабочая тетрадь: все инструменты одним файлом | — | [PDF A4, 29 стр.](../../../content/career/v3/materials/safety/pdf/safety-workbook-a4.pdf) |
| Учебный набор данных для практикума | [synthetic-practice-data.csv](../../../content/career/v3/materials/safety/synthetic-practice-data.csv) | CSV |
| Экранные уроки для кабинета по [lesson.schema.json](../../../content/career/v3/schemas/lesson.schema.json) | [SAF-01](../../../content/career/v3/lessons/SAF-01.json) · [SAF-02](../../../content/career/v3/lessons/SAF-02.json) · [SAF-03](../../../content/career/v3/lessons/SAF-03.json) · [SAF-04](../../../content/career/v3/lessons/SAF-04.json) | ЛК (#48) |
| Реестр источников с датой проверки и статусом | [sources.json](../../../content/career/v3/materials/safety/sources.json) | — |

Файлы лежат в `content/`, а не в `public/`: сайт их не раздаёт. Выдача из кабинета — задача #48.

## 2. Как устроены уроки

| Урок | Тема | Кейсы | Практика | Инструменты |
| --- | --- | --- | --- | --- |
| SAF-01 | Какие данные нельзя передавать ИИ | 1 (данные CRM), 6 (анализ CRM) | Задание 1: разметка карточки | Матрица данных, промпты 1–2 |
| SAF-02 | Правила работодателя и режимы ИИ | 2 (запись звонка), 5 (письмо клиенту) | Задание 4: обращение к руководителю | Короткое и полное обращение |
| SAF-03 | Почему ИИ ошибается и как проверять | 4 (цены и скидки), 7 (ошибочный ответ) | Задание 2: найти 8 ошибок в КП | Промпты 4–5, чек-лист проверки |
| SAF-04 | Решения за человеком, эксперимент, свой чек-лист | 3 (КП), 8 (ИИ-ассистент) | Задание 3: эксперимент на вымышленных данных | Чек-лист, промпт 3, карточка эксперимента |

Тексты промптов и шаблонов в JSON **дословно совпадают** с рабочей тетрадью, а `06-test.md` генерируется из `quiz` уроков. Расхождения ловит тест `tests/ai-career-v3-safety-module.test.mjs`.

## 3. Сборка PDF

```bash
node scripts/career/build-safety-materials.mjs           # все PDF + 06-test.md
node scripts/career/build-safety-materials.mjs --test-md  # только 06-test.md
```

Нужны Chromium через Playwright (инструмент разработчика, не зависимость проекта) и `pdftotext` (poppler) для номеров страниц в оглавлении. Шрифты Inter и Roboto Condensed берутся из `assets/blog-covers/fonts`. Сборка падает, если текст выходит за поля, шрифт не загрузился или номера страниц оглавления не совпали при повторной вёрстке. В телефонной версии таблицы превращаются в карточки.

## 4. Проверка 18.11.2026

- `node scripts/career/validate-v3-content.mjs` — PASS (схема, ссылки на задачи роли, файлы скачивания, реестр источников).
- `tests/ai-career-v3-safety-module.test.mjs` — 8/8: полнота, синхронность шаблонов и теста, шесть частей каждого кейса, ссылки только из реестра, отсутствие реальных контактов, страницы, заголовки и кликабельные ссылки PDF.
- PDF: все шрифты встроены (`pdffonts`), A4 595×842 pt и телефон 312×556 pt, 19 кликабельных источников в пособии, кликабельное оглавление с номерами страниц.

## 5. Источники и что не подтверждено

19 источников в [sources.json](../../../content/career/v3/materials/safety/sources.json), у каждого — URL, дата проверки и поддерживаемое утверждение. Тексты прочитаны в первоисточнике, кроме оговорённых ниже.

- **Законы РФ** (152-ФЗ, 98-ФЗ, 38-ФЗ, ТК РФ, ГК РФ) сверены по интернет-версии КонсультантПлюс, редакция от 26.07.2026. **Сверка с официальным опубликованием не выполнена**: publication.pravo.gov.ru был недоступен. В ст. 12 152-ФЗ есть не вступившие в силу изменения.
- **Moffatt v. Air Canada**: полный текст решения вернул 403, использован только общий вывод, подтверждённый вторичными источниками. Цифр из дела в пособии нет.
- **OpenAI**: страницы вернули 403. Утверждений о правилах OpenAI в материале нет.
- Статистики об эффекте ИИ в материалах нет. Все цифры в кейсах вымышленные и обозначены как учебные.

## 6. Что проверить владельцу до `approved`

1. **Юридически:** формулировки о персональных данных, трансграничной передаче, коммерческой тайне, рекламе (ст. 18 38-ФЗ применительно к B2B-письмам), увольнении (ТК РФ, ст. 81), оферте (ГК РФ, ст. 435/437). Пособие намеренно не даёт юридических заключений.
2. **Содержательно:** реалистичность кейсов для трёх подтипов продаж; объём (основной текст ≈ 13 стр. A4, кейсы ≈ 9 стр., что больше ориентира «~10 стр.»).
3. **Тест:** правильные варианты местами длиннее неверных — нужна редактура дистракторов.
4. **Даты:** `nextReviewOn` = 2027-05-18 — пересмотреть правила поставщиков ИИ и редакции законов.
5. **После проверки:** заполнить `quality.reviewer` и `reviewedOn`, перевести `factualClaimsChecked` в `true`, затем `status: "approved"` и `canBePublished: true`. Валидатор не даст опубликовать урок без этого.
