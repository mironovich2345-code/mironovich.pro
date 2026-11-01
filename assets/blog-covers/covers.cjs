/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Article covers 1200×630 (blog cards, article pages, Open Graph).
 *
 *   node assets/blog-covers/covers.cjs            # all covers
 *   node assets/blog-covers/covers.cjs <slug>…    # selected covers
 *
 * Each cover is an HTML page with an inline SVG scheme specific to its topic,
 * rendered in Chromium (Playwright) with the site's own fonts from ./fonts
 * (Roboto Condensed, Inter, JetBrains Mono — SIL OFL) and saved as an optimised
 * PNG to public/blog/covers/<slug>.png.
 *
 * Shared system: light background (cream), black condensed uppercase headline,
 * red accent (#D92D2D), mono labels; the right half is a different scheme for
 * every topic. Schemes are illustrative — no invented figures, prices or cases.
 * Requires Playwright with Chromium (preinstalled in the dev environment).
 */
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const fsx = require("node:fs");
const font = (f) => "data:font/" + (f.endsWith(".ttf") ? "ttf" : "woff2") + ";base64," + fsx.readFileSync(path.join(__dirname, "fonts", f)).toString("base64");

const C = { bg: "#F2EFE8", ink: "#0E0E11", red: "#D92D2D", stone: "#7A766F", line: "#0E0E11", paper: "#FFFFFF", soft: "#E4E0D6" };

const css = `
@font-face{font-family:RC;src:url(${font("RobotoCondensed-cyrillic.woff2")}) format("woff2");font-weight:100 900;unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:RC;src:url(${font("RobotoCondensed-latin.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:IN;src:url(${font("Inter-cyrillic.woff2")}) format("woff2");font-weight:100 900;unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:IN;src:url(${font("Inter-latin.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:MO;src:url(${font("JetBrainsMono-Medium.ttf")}) format("truetype");font-weight:500}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden;background:${C.bg};color:${C.ink}}
body{position:relative;font-family:IN,sans-serif}
.top{position:absolute;left:64px;right:64px;top:44px;display:flex;justify-content:space-between;font:500 14px/1 MO,monospace;letter-spacing:.18em;text-transform:uppercase}
.top b{color:${C.red};font-weight:500}
.left{position:absolute;left:64px;top:104px;width:560px;height:430px;display:flex;flex-direction:column;justify-content:center}
h1{font:800 72px/.92 RC,sans-serif;text-transform:uppercase;letter-spacing:-.01em;color:${C.ink}}
h1 i{font-style:normal;color:${C.red}}
.sub{margin-top:22px;font:500 21px/1.35 IN,sans-serif;color:#3A3833;max-width:500px}
.right{position:absolute;left:656px;top:96px;width:480px;height:448px}
.bottom{position:absolute;left:64px;right:64px;bottom:34px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid ${C.ink};padding-top:14px;font:500 13px/1 MO,monospace;letter-spacing:.18em;text-transform:uppercase}
.bottom span:last-child::before{content:"";display:inline-block;width:8px;height:8px;background:${C.red};margin-right:10px;vertical-align:1px}
svg text{font-family:IN,sans-serif}
.rc{font-family:RC,sans-serif;font-weight:800;text-transform:uppercase}
.mo{font-family:MO,monospace;letter-spacing:.12em;text-transform:uppercase}
`;

// helpers for SVG
const T = (x, y, s, { size = 16, w = 500, fill = C.ink, cls = "", anchor = "start" } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" class="${cls}">${s}</text>`;

const COVERS = {
  // 1. Priority matrix: frequency × clarity of rules
  "kakie-processy-avtomatizirovat": {
    label: "Автоматизация / 01",
    title: "Какие процессы автоматизировать первыми<i>?</i>",
    sub: "Частые операции с понятными правилами — лучший старт",
    alt: "Матрица выбора процесса для автоматизации: по горизонтали понятность правил, по вертикали частота; квадрант «часто и понятно» отмечен как «автоматизировать первым»",
    svg: () => `
      <svg width="480" height="448" viewBox="0 0 480 448">
        <line x1="56" y1="12" x2="56" y2="392" stroke="${C.ink}" stroke-width="2"/>
        <line x1="56" y1="392" x2="472" y2="392" stroke="${C.ink}" stroke-width="2"/>
        <path d="M50 22 L56 10 L62 22" fill="none" stroke="${C.ink}" stroke-width="2"/>
        <path d="M460 386 L472 392 L460 398" fill="none" stroke="${C.ink}" stroke-width="2"/>
        <text transform="translate(30 210) rotate(-90)" font-size="13" fill="${C.ink}" text-anchor="middle" class="mo">Частота</text>
        ${T(264, 426, "Понятность правил", { size: 13, cls: "mo", anchor: "middle" })}
        <rect x="68" y="22" width="190" height="176" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="5 5"/>
        <rect x="270" y="22" width="196" height="176" fill="${C.red}"/>
        <rect x="68" y="210" width="190" height="172" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="5 5"/>
        <rect x="270" y="210" width="196" height="172" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="5 5"/>
        ${T(284, 56, "Автоматизировать", { size: 19, cls: "rc", fill: "#fff" })}
        ${T(284, 78, "первым", { size: 19, cls: "rc", fill: "#fff" })}
        ${[["Отчёты", 114], ["Перенос данных", 142], ["Обработка заявок", 170]].map(([s, y]) => `<circle cx="292" cy="${y - 5}" r="5" fill="#fff"/>${T(306, y, s, { size: 15, fill: "#fff", w: 500 })}`).join("")}
        ${T(84, 56, "Сначала описать", { size: 18, cls: "rc" })}
        ${T(84, 78, "правила", { size: 18, cls: "rc" })}
        ${T(84, 108, "Часто, но решения", { size: 14, fill: C.stone })}
        ${T(84, 126, "принимают «по опыту»", { size: 14, fill: C.stone })}
        ${T(286, 244, "Позже", { size: 18, cls: "rc" })}
        ${T(286, 272, "Редко, правила", { size: 14, fill: C.stone })}
        ${T(286, 290, "понятны —", { size: 14, fill: C.stone })}
        ${T(286, 308, "эффект меньше", { size: 14, fill: C.stone })}
        ${T(84, 244, "Не начинать", { size: 18, cls: "rc" })}
        ${T(84, 272, "Редко и каждый раз", { size: 14, fill: C.stone })}
        ${T(84, 290, "по-разному", { size: 14, fill: C.stone })}
      </svg>`,
  },

  // 2. Estimate without figures
  "stoimost-vnedreniya-ii-v-biznes": {
    label: "ИИ для бизнеса / 01",
    title: "Сколько стоит внедрение ИИ<i>?</i>",
    sub: "Единой цены нет — есть статьи расходов, которые можно оценить до старта",
    alt: "Смета внедрения ИИ без цифр: пилот, подготовка данных, интеграции, интерфейс, оплата модели, поддержка; итог зависит от задачи",
    svg: () => {
      const rows = ["Пилот на ваших данных", "Подготовка данных", "Интеграции с системами", "Интерфейс", "Оплата модели", "Поддержка и качество"];
      const y0 = 92, step = 44;
      return `
      <svg width="480" height="448" viewBox="0 0 480 448">
        <path d="M40 8 H440 V400 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 l-20 14 l-20 -14 Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
        ${T(68, 48, "Смета внедрения ИИ", { size: 15, cls: "mo" })}
        <line x1="68" y1="66" x2="412" y2="66" stroke="${C.ink}" stroke-width="2"/>
        ${rows.map((r, i) => `<text id="r${i}" x="68" y="${y0 + i * step}" font-size="17" font-weight="500" fill="${C.ink}">${r}</text><line data-after="r${i}" x1="68" y1="${y0 + i * step - 5}" x2="378" y2="${y0 + i * step - 5}" stroke="${C.stone}" stroke-width="2" stroke-dasharray="2 6"/>${T(400, y0 + i * step + 1, "?", { size: 24, cls: "rc", fill: C.red, anchor: "end" })}`).join("")}
        <line x1="68" y1="350" x2="412" y2="350" stroke="${C.ink}" stroke-width="2"/>
        ${T(68, 382, "Итого", { size: 22, cls: "rc" })}
        ${T(412, 382, "зависит от задачи", { size: 17, w: 600, fill: C.red, anchor: "end" })}
      </svg>`;
    },
  },

  // 3. Assistant flow: question → knowledge base → answer with source → human check
  "ii-assistent-dlya-biznesa": {
    label: "ИИ для бизнеса / 02",
    title: "ИИ-ассистент для бизнеса<i>.</i>",
    sub: "Отвечает по базе знаний компании, ссылается на источник — а важное проверяет человек",
    alt: "Схема работы ИИ-ассистента: вопрос сотрудника, поиск по базе знаний, ответ со ссылкой на источник и проверка человеком",
    svg: () => `
      <svg width="480" height="448" viewBox="0 0 480 448">
        <rect x="4" y="6" width="320" height="64" rx="14" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
        ${T(24, 32, "Сотрудник", { size: 12, cls: "mo", fill: C.stone })}
        ${T(24, 56, "Как оформить возврат товара?", { size: 17, w: 600 })}
        ${[0, 1, 2].map((i) => `<rect x="${12 + i * 8}" y="${120 - i * 8}" width="112" height="132" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>`).join("")}
        ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="40" y1="${124 + i * 18}" x2="${i % 2 ? 110 : 124}" y2="${124 + i * 18}" stroke="${C.soft}" stroke-width="6"/>`).join("")}
        ${T(78, 276, "База знаний", { size: 12, cls: "mo", anchor: "middle" })}
        <line x1="146" y1="178" x2="210" y2="178" stroke="${C.ink}" stroke-width="2"/>
        <path d="M202 171 l10 7 l-10 7" fill="none" stroke="${C.ink}" stroke-width="2"/>
        <circle cx="270" cy="178" r="54" fill="${C.red}"/>
        ${T(270, 190, "ИИ", { size: 36, cls: "rc", fill: "#fff", anchor: "middle" })}
        <line x1="270" y1="232" x2="270" y2="290" stroke="${C.ink}" stroke-width="2"/>
        <path d="M263 282 l7 10 l7 -10" fill="none" stroke="${C.ink}" stroke-width="2"/>
        <rect x="150" y="298" width="326" height="92" rx="14" fill="${C.ink}"/>
        ${T(172, 324, "Ответ", { size: 12, cls: "mo", fill: "#B9B5AC" })}
        ${T(172, 350, "Заявка оформляется по шаблону", { size: 16, w: 500, fill: "#fff" })}
        <rect x="172" y="362" width="184" height="20" fill="none" stroke="${C.red}" stroke-width="1.5"/>
        ${T(180, 377, "источник: регламент", { size: 11, cls: "mo", fill: "#fff" })}
        <circle cx="26" cy="424" r="18" fill="none" stroke="${C.ink}" stroke-width="2"/>
        <path d="M17 424 l6 6 l12 -13" fill="none" stroke="${C.red}" stroke-width="3"/>
        ${T(54, 430, "Важное проверяет человек", { size: 15, w: 600 })}
      </svg>`,
  },

  // 4. Price drivers as sliders
  "stoimost-razrabotki-prilozheniya-dlya-biznesa": {
    label: "Приложения / 01",
    title: "Сколько стоит приложение для бизнеса<i>?</i>",
    sub: "Цена складывается из решений: формат, функции, интеграции, дизайн и поддержка",
    alt: "Панель с регуляторами факторов стоимости приложения: формат, функции и роли, интеграции, дизайн, поддержка — от простого к сложному",
    svg: () => {
      const rows = [["Формат", "веб · Mini App · мобильное", 0.35], ["Функции и роли", "экраны, правила, доступы", 0.6], ["Интеграции", "CRM, учёт, оплата", 0.75], ["Дизайн", "компоненты · свой стиль", 0.3], ["Поддержка", "хостинг, сервисы, развитие", 0.5]];
      return `
      <svg width="480" height="448" viewBox="0 0 480 448">
        <rect x="4" y="4" width="472" height="440" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
        ${T(28, 40, "Что двигает цену", { size: 13, cls: "mo" })}
        ${T(330, 40, "проще", { size: 11, cls: "mo", fill: C.stone })}${T(452, 40, "сложнее", { size: 11, cls: "mo", fill: C.stone, anchor: "end" })}
        ${rows.map(([n, d, v], i) => {
          const y = 90 + i * 72, x0 = 300, x1 = 452, k = x0 + (x1 - x0) * v;
          return `${T(28, y, n, { size: 21, cls: "rc" })}${T(28, y + 22, d, { size: 13, fill: C.stone })}
            <line x1="${x0}" y1="${y - 6}" x2="${x1}" y2="${y - 6}" stroke="${C.soft}" stroke-width="6" stroke-linecap="round"/>
            <line x1="${x0}" y1="${y - 6}" x2="${k}" y2="${y - 6}" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>
            <circle cx="${k}" cy="${y - 6}" r="11" fill="${C.red}" stroke="${C.paper}" stroke-width="3"/>`;
        }).join("")}
      </svg>`;
    },
  },

  // 5. Three options on a spectrum
  "crm-pod-zadachi-ili-gotovaya-sistema": {
    label: "Приложения / 02",
    title: "Своя CRM или готовая<i>?</i>",
    sub: "Три варианта: готовая, готовая с доработками или своя система под процесс",
    alt: "Три варианта CRM на шкале от быстрого старта к гибкости под процесс: готовая система, готовая с доработками, собственная система",
    svg: () => {
      const card = (x, title, icon) => `
        <rect x="${x}" y="40" width="144" height="250" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
        <g transform="translate(${x + 22} 66)">${icon}</g>
        ${title.map((t, i) => T(x + 16, 228 + i * 24, t, { size: 21, cls: "rc" })).join("")}`;
      const box = `<rect x="10" y="30" width="80" height="70" fill="none" stroke="${C.ink}" stroke-width="3"/><path d="M10 30 L30 10 H110 L90 30 M90 100 L110 80 V10" fill="none" stroke="${C.ink}" stroke-width="3"/>`;
      const plug = `${box}<rect x="60" y="66" width="44" height="34" fill="${C.red}"/><line x1="72" y1="66" x2="72" y2="56" stroke="${C.red}" stroke-width="5"/><line x1="92" y1="66" x2="92" y2="56" stroke="${C.red}" stroke-width="5"/>`;
      const plan = `<rect x="4" y="6" width="100" height="100" fill="none" stroke="${C.ink}" stroke-width="3"/>${[1, 2, 3].map((i) => `<line x1="${4 + i * 25}" y1="6" x2="${4 + i * 25}" y2="106" stroke="${C.soft}" stroke-width="2"/><line x1="4" y1="${6 + i * 25}" x2="104" y2="${6 + i * 25}" stroke="${C.soft}" stroke-width="2"/>`).join("")}<path d="M16 90 L42 58 L62 72 L92 22" fill="none" stroke="${C.red}" stroke-width="5"/>`;
      return `
      <svg width="480" height="448" viewBox="0 0 480 448">
        ${card(4, ["Готовая"], box)}${card(168, ["Готовая +", "доработка"], plug)}${card(332, ["Своя", "система"], plan)}
        <line x1="20" y1="350" x2="460" y2="350" stroke="${C.ink}" stroke-width="3"/>
        <path d="M30 340 l-12 10 l12 10" fill="none" stroke="${C.ink}" stroke-width="3"/>
        <path d="M450 340 l12 10 l-12 10" fill="none" stroke="${C.red}" stroke-width="3"/>
        <line x1="240" y1="350" x2="460" y2="350" stroke="${C.red}" stroke-width="3"/>
        ${T(20, 386, "Быстрый старт", { size: 15, w: 600 })}
        ${T(460, 386, "Гибкость под процесс", { size: 15, w: 600, fill: C.red, anchor: "end" })}
        ${T(20, 420, "Главный сигнал смены варианта — учёт в параллельных таблицах", { size: 13, fill: C.stone })}
      </svg>`;
    },
  },

  // 6. Phone with a Mini App
  "telegram-mini-app-dlya-biznesa": {
    label: "Приложения / 03",
    title: "Telegram Mini Apps для бизнеса<i>.</i>",
    sub: "Приложение внутри мессенджера: без установки, с уведомлениями от бота",
    alt: "Макет телефона с мини-приложением внутри мессенджера: каталог, кнопка оформления заказа и подписи — вход без регистрации, уведомления от бота, оплата по правилам Telegram",
    svg: () => `
      <svg width="480" height="448" viewBox="0 0 480 448">
        <g transform="translate(-30 0)"><rect x="150" y="2" width="196" height="444" rx="30" fill="${C.ink}"/>
        <rect x="162" y="16" width="172" height="416" rx="20" fill="${C.paper}"/>
        <rect x="222" y="22" width="52" height="8" rx="4" fill="${C.ink}"/>
        <circle cx="186" cy="56" r="12" fill="${C.red}"/>
        ${T(206, 52, "Бот компании", { size: 12, w: 700 })}${T(206, 67, "мини-приложение", { size: 10, fill: C.stone })}
        <line x1="162" y1="80" x2="334" y2="80" stroke="${C.soft}" stroke-width="2"/>
        ${[0, 1].map((r) => [0, 1].map((c) => `<rect x="${176 + c * 76}" y="${94 + r * 106}" width="68" height="96" fill="${C.soft}"/><rect x="${176 + c * 76}" y="${94 + r * 106}" width="68" height="54" fill="${(r + c) % 2 ? C.ink : "#C9C4B8"}"/><rect x="${182 + c * 76}" y="${158 + r * 106}" width="44" height="6" fill="${C.ink}"/><rect x="${182 + c * 76}" y="${172 + r * 106}" width="30" height="6" fill="${C.red}"/>`).join("")).join("")}
        <rect x="176" y="316" width="144" height="40" fill="${C.soft}"/>
        ${T(186, 341, "Запись на 14:00", { size: 12, w: 600 })}
        <rect x="176" y="372" width="144" height="44" fill="${C.red}"/>
        ${T(248, 399, "Оформить", { size: 15, cls: "rc", fill: "#fff", anchor: "middle" })}</g>
        ${[["Вход без", "регистрации", 60, "l"], ["Уведомления", "от бота", 200, "l"], ["Интерфейс", "как у приложения", 120, "r"], ["Оплата по", "правилам Telegram", 380, "r"]].map(([a, b, y, s]) => s === "l"
          ? `<line x1="98" y1="${y}" x2="130" y2="${y}" stroke="${C.red}" stroke-width="2"/><circle cx="130" cy="${y}" r="4" fill="${C.red}"/>${T(94, y - 4, a, { size: 13, w: 600, anchor: "end" })}${T(94, y + 13, b, { size: 13, anchor: "end", fill: C.stone })}`
          : `<line x1="306" y1="${y}" x2="344" y2="${y}" stroke="${C.red}" stroke-width="2"/><circle cx="306" cy="${y}" r="4" fill="${C.red}"/>${T(350, y - 4, a, { size: 13, w: 600 })}${T(350, y + 13, b, { size: 13, fill: C.stone })}`).join("")}
      </svg>`,
  },

  // 7. Staircase of stages, platform last
  "kak-postroit-sistemu-obucheniya-s-nulya": {
    label: "Обучение / 02",
    title: "Система обучения с&nbsp;нуля<i>.</i>",
    sub: "Сначала процесс, потом система — и только потом платформа",
    alt: "Лестница из пяти этапов построения системы обучения: роли, маршрут, контент, проверка, аналитика; на вершине — выбор платформы",
    svg: () => {
      const steps = ["Роли", "Маршрут", "Контент", "Проверка", "Аналитика"];
      const w = 88, h = 62;
      return `
      <svg width="480" height="448" viewBox="0 0 480 448">
        ${steps.map((s, i) => {
          const x = 8 + i * w, y = 400 - (i + 1) * h;
          return `<rect x="${x}" y="${y}" width="${w}" height="${(i + 1) * h}" fill="${i === 4 ? C.ink : C.paper}" stroke="${C.ink}" stroke-width="2"/>
            ${T(x + 10, y + 26, String(i + 1).padStart(2, "0"), { size: 12, cls: "mo", fill: i === 4 ? "#B9B5AC" : C.red })}
            ${T(x + 8, y + 50, s, { size: 15, cls: "rc", fill: i === 4 ? "#fff" : C.ink })}`;
        }).join("")}
        <line x1="8" y1="400" x2="472" y2="400" stroke="${C.ink}" stroke-width="3"/>
        <line x1="372" y1="88" x2="372" y2="16" stroke="${C.ink}" stroke-width="3"/>
        <path d="M372 16 H478 L464 34 L478 52 H372 Z" fill="${C.red}"/>
        ${T(380, 40, "Платформа", { size: 14, cls: "rc", fill: "#fff" })}
        ${T(8, 436, "Инструмент выбирают последним — под готовую логику обучения", { size: 13, fill: C.stone })}
      </svg>`;
    },
  },

  // 8. 30-day calendar with checkpoints
  "adaptaciya-novyh-sotrudnikov-pervye-30-dney": {
    label: "Обучение / 06",
    title: "Адаптация: первые 30 дней<i>.</i>",
    sub: "У каждого этапа — цель и контрольная точка",
    alt: "Календарь первых 30 дней работы нового сотрудника с контрольными точками: день 1 — знакомство, конец первой недели — база, третья неделя — практика, день 30 — итоговая встреча",
    svg: () => {
      const cw = 60, ch = 52, x0 = 36, y0 = 34;
      const marks = { 1: "fill", 5: "ring", 19: "ring", 30: "fill" };
      let cells = "";
      for (let d = 1; d <= 30; d++) {
        const col = (d - 1) % 7, row = Math.floor((d - 1) / 7), x = x0 + col * cw, y = y0 + row * ch;
        const m = marks[d];
        const week = row <= 0 ? 0 : row <= 2 ? 1 : 2;
        const tone = ["#FFFFFF", "#F8F6F1", "#EFECE4"][week];
        cells += `<rect x="${x}" y="${y}" width="${cw - 6}" height="${ch - 6}" fill="${m === "fill" ? C.red : tone}" stroke="${m === "ring" ? C.red : C.ink}" stroke-width="${m === "ring" ? 3 : 1}"/>`;
        cells += T(x + 8, y + 22, d, { size: 15, w: 700, fill: m === "fill" ? "#fff" : C.ink });
      }
      return `
      <svg width="480" height="448" viewBox="0 0 480 448">
        ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, i) => T(x0 + i * cw + 2, 22, d, { size: 11, cls: "mo", fill: C.stone })).join("")}
        ${cells}
        ${[["1", "знакомство и план", "fill"], ["5", "база: проверка знаний", "ring"], ["19", "практика: встреча", "ring"], ["30", "итоги и цели", "fill"]].map(([d, s, k], i) => {
          const x = 36 + (i % 2) * 220, y = 330 + Math.floor(i / 2) * 44;
          return `<rect x="${x}" y="${y}" width="28" height="28" fill="${k === "fill" ? C.red : "#fff"}" stroke="${C.red}" stroke-width="${k === "fill" ? 1 : 3}"/>${T(x + 14, y + 19, d, { size: 12, w: 700, fill: k === "fill" ? "#fff" : C.ink, anchor: "middle" })}${T(x + 38, y + 19, s, { size: 13, w: 500 })}`;
        }).join("")}
      </svg>`;
    },
  },

  // 9. Team progress dashboard
  "avtomatizaciya-obucheniya-sotrudnikov": {
    label: "Обучение / 07",
    title: "Автоматизация обучения<i>.</i>",
    sub: "Назначение, тесты, напоминания и контроль — без ручной рутины руководителя",
    alt: "Интерфейс контроля обучения: прогресс сотрудников по этапам, отметка о просрочке и автоматическое напоминание",
    svg: () => {
      const rows = [["Сотрудник А", 1, "готово"], ["Сотрудник Б", 0.7, "тесты"], ["Сотрудник В", 0.45, "практика"], ["Сотрудник Г", 0.2, "просрочено"]];
      return `
      <svg width="480" height="448" viewBox="0 0 480 448">
        <rect x="4" y="4" width="472" height="356" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
        ${T(28, 40, "Прогресс обучения", { size: 13, cls: "mo" })}
        ${["Маршрут", "Материалы", "Тесты", "Практика"].map((s, i) => T(212 + i * 64, 72, s, { size: 9, cls: "mo", fill: C.stone, anchor: "middle" })).join("")}
        ${rows.map(([n, v, st], i) => {
          const y = 112 + i * 60, late = st === "просрочено";
          return `${T(28, y + 6, n, { size: 16, w: 600 })}
            <rect x="180" y="${y - 8}" width="256" height="16" fill="${C.soft}"/>
            <rect x="180" y="${y - 8}" width="${256 * v}" height="16" fill="${late ? C.red : C.ink}"/>
            ${[1, 2, 3].map((k) => `<line x1="${180 + k * 64}" y1="${y - 8}" x2="${180 + k * 64}" y2="${y + 8}" stroke="${C.paper}" stroke-width="2"/>`).join("")}
            ${T(436, y + 30, st, { size: 11, cls: "mo", fill: late ? C.red : C.stone, anchor: "end" })}`;
        }).join("")}
        <rect x="4" y="380" width="472" height="64" fill="${C.ink}"/>
        <path d="M40 398 a12 12 0 0 1 24 0 v10 l5 7 h-34 l5 -7 Z" fill="${C.red}"/><circle cx="52" cy="421" r="4" fill="${C.red}"/>
        ${T(84, 410, "Напоминание отправлено", { size: 15, w: 600, fill: "#fff" })}
        ${T(84, 430, "сотруднику и руководителю", { size: 13, fill: "#B9B5AC" })}
      </svg>`;
    },
  },
};

const page = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="top"><span>${c.label}</span><span>MIRONOVICH<b>.</b></span></div>
  <div class="left"><h1 id="h">${c.title}</h1><p class="sub">${c.sub}</p></div>
  <div class="right">${c.svg()}</div>
  <div class="bottom"><span>Данил Миронович</span><span>mironovich.pro</span></div>
</body></html>`;

async function main() {
  const only = process.argv.slice(2);
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const fs = require("node:fs");
  const out = path.join(ROOT, "public", "blog", "covers");
  fs.mkdirSync(out, { recursive: true });
  const report = [];
  for (const [slug, c] of Object.entries(COVERS)) {
    if (only.length && !only.includes(slug)) continue;
    await p.setContent(page(c), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => document.querySelectorAll("line[data-after]").forEach((l) => {
      const t = document.getElementById(l.dataset.after); const b = t.getBBox(); l.setAttribute("x1", String(b.x + b.width + 10));
    }));
    // fit the headline: largest size (≤ 72px) at which it fits 560×(430 − subtitle) without breaking a word
    const fit = await p.evaluate(() => {
      const h = document.getElementById("h"), box = h.parentElement;
      let size = 72;
      const ok = () => h.scrollWidth <= box.clientWidth && box.scrollHeight <= box.clientHeight &&
        [...h.childNodes].every(() => true);
      const wordsFit = () => {
        // no single word wider than the column
        const r = document.createRange(); let max = 0;
        for (const w of h.textContent.split(/\s+/)) { const s = document.createElement("span"); s.textContent = w; s.style.whiteSpace = "nowrap"; h.appendChild(s); max = Math.max(max, s.getBoundingClientRect().width); s.remove(); }
        void r; return max <= box.clientWidth;
      };
      while (size > 40 && !(ok() && wordsFit())) { size -= 2; h.style.fontSize = size + "px"; }
      const sub = h.nextElementSibling;
      // every text of the scheme must stay inside the 480×448 panel
      const svg = document.querySelector(".right svg");
      const S = svg.getBoundingClientRect();
      const clipped = [...svg.querySelectorAll("text")].filter((t) => { const b = t.getBoundingClientRect(); return b.left < S.left - 0.5 || b.top < S.top - 0.5 || b.right > S.right + 0.5 || b.bottom > S.bottom + 0.5; }).map((t) => t.textContent);
      return { clipped, size, lines: Math.round(h.getBoundingClientRect().height / (size * 0.92)), overflow: box.scrollHeight > box.clientHeight || sub.getBoundingClientRect().right > box.getBoundingClientRect().right + 1 };
    });
    const file = path.join(out, slug + ".png");
    await p.screenshot({ path: file, type: "png" });
    report.push({ slug, ...fit, alt: c.alt });
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, "covers-alt.json"), JSON.stringify(Object.fromEntries(Object.entries(COVERS).map(([k, v]) => [k, v.alt])), null, 2) + "\n");
  for (const r of report) console.log(r.slug.padEnd(48), "headline", r.size + "px", r.lines, "lines", r.overflow ? "OVERFLOW" : "ok", r.clipped.length ? "CLIPPED: " + r.clipped.join(" | ") : "scheme ok");
}

main().catch((e) => { console.error(e); process.exit(1); });
