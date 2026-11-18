import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";
import { validateLesson, validateSafetyModule } from "../scripts/career/validate-v3-content.mjs";
import { renderMarkdown, parseFrontMatter, buildTestMarkdown } from "../scripts/career/build-safety-materials.mjs";

const load = p => JSON.parse(readFileSync(p, "utf8"));
const MAT = "content/career/v3/materials/safety/";
const role = load("content/career/v3/roles/sales-manager.json");
const schema = load("content/career/v3/schemas/lesson.schema.json");
const catalog = load("content/career/v3/curriculum.json");
const registry = load(MAT + "sources.json");
const lessons = ["SAF-01", "SAF-02", "SAF-03", "SAF-04"].map(id => load(`content/career/v3/lessons/${id}.json`));
const fresh = x => structuredClone(x);
const md = f => readFileSync(MAT + f, "utf8");
const codeBlocks = f => [...md(f).matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1]);
const MD_FILES = ["guide.md", "01-checklist.md", "02-data-matrix.md", "03-prompts.md", "04-manager-request.md", "05-practicum.md", "06-test.md", "07-rules-memo.md"];
const claims = load(MAT + "legal-claims.json");

test("four safety lessons pass the schema and the module gate, and stay unpublished drafts", () => {
  for (const l of lessons) assert.deepEqual(validateLesson(l, role, schema), [], l.id);
  assert.deepEqual(validateSafetyModule(lessons, catalog, registry), []);
  for (const l of lessons) {
    assert.equal(l.status, "review");
    assert.equal(l.quality.canBePublished, false);
    assert.equal(l.quality.reviewedOn, null);
    assert.equal(l.security.allowEmployerData, false);
  }
  const slots = catalog.slots.filter(s => s.moduleId === "safety");
  assert.ok(slots.every(s => s.status === "planned" && s.publishedLessonId === null && s.draftLessonId === s.id));
  assert.equal(catalog.usableForPaidUser, false);
});

test("module contains the required depth: 8 cases, 4 practice tasks, 12 questions, 5 prompts", () => {
  const all = k => lessons.flatMap(l => l.content[k]);
  assert.equal(all("workedExamples").length, 8);
  assert.equal(all("exercises").length, 4);
  assert.equal(all("quiz").length, 12);
  assert.equal(all("templates").filter(t => t.kind === "prompt").length, 5);
  const positions = all("quiz").map(q => q.correctId);
  for (const p of ["a", "b", "c"]) assert.equal(positions.filter(x => x === p).length, 4, "answer position " + p);
  for (const q of all("quiz")) {
    const right = q.options.find(o => o.id === q.correctId).text.length;
    const wrong = q.options.filter(o => o.id !== q.correctId).map(o => o.text.length);
    const ratio = right / (wrong.reduce((a, b) => a + b) / wrong.length);
    assert.ok(ratio >= 0.8 && ratio <= 1.2, `${q.id}: length ratio ${ratio.toFixed(2)}`);
  }
});

test("promoting, breaking downloads or citing unregistered sources fails validation", () => {
  const promoted = fresh(lessons[0]);
  promoted.quality.canBePublished = true;
  assert.match(validateLesson(promoted, role, schema).join("; "), /unreviewed lesson cannot be published/);

  const approved = fresh(lessons[0]);
  approved.status = "approved"; approved.quality.canBePublished = true;
  assert.match(validateLesson(approved, role, schema).join("; "), /published lesson requires/);

  const broken = fresh(lessons[1]);
  broken.downloads[0].repositoryPath = MAT + "pdf/missing-file.pdf";
  assert.match(validateLesson(broken, role, schema).join("; "), /download file missing/);

  const escape = fresh(lessons[1]);
  escape.downloads[0].repositoryPath = "../outside/secret.pdf";
  assert.match(validateLesson(escape, role, schema).join("; "), /download file missing/);

  const badTask = fresh(lessons[2]);
  badTask.audience.taskIds.push("T99");
  assert.match(validateLesson(badTask, role, schema).join("; "), /unknown task/);

  const unsourced = fresh(lessons);
  unsourced[3].sources[0].url = "https://example.com/not-in-registry";
  assert.match(validateSafetyModule(unsourced, catalog, registry).join("; "), /must match sources.json/);

  const predictable = fresh(lessons);
  for (const l of predictable) for (const q of l.content.quiz) {
    // move every correct answer to position "b"
    const right = q.options.find(o => o.id === q.correctId);
    const atB = q.options.find(o => o.id === "b");
    [right.text, atB.text] = [atB.text, right.text];
    q.correctId = "b";
  }
  assert.match(validateSafetyModule(predictable, catalog, registry).join("; "), /answer position b used 12 times/);

  const telltale = fresh(lessons);
  const q = telltale[0].content.quiz[0];
  q.options.find(o => o.id === q.correctId).text += " — это единственный вариант, который соответствует закону, правилам компании и здравому смыслу";
  assert.match(validateSafetyModule(telltale, catalog, registry).join("; "), /correct option length/);
});

test("copyable templates in the lessons are identical to the downloadable workbook files", () => {
  const templates = lessons.flatMap(l => l.content.templates);
  const prompts = codeBlocks("03-prompts.md");
  const manager = codeBlocks("04-manager-request.md");
  assert.equal(prompts.length, 5);
  for (const body of prompts) assert.ok(templates.some(t => t.kind === "prompt" && t.body === body), "prompt not in lessons: " + body.slice(0, 40));
  for (const body of manager) assert.ok(templates.some(t => t.kind === "script" && t.body === body), "manager template not in lessons");
  assert.equal(md("06-test.md"), buildTestMarkdown(lessons), "06-test.md is stale: run node scripts/career/build-safety-materials.mjs --test-md");
});

test("guide covers all ten topics and every case has the six required parts", () => {
  const guide = md("guide.md");
  for (let n = 1; n <= 11; n++) assert.match(guide, new RegExp(`^## ${n}\\. `, "m"), "chapter " + n);
  const cases = guide.split(/^### Кейс /m).slice(1);
  assert.equal(cases.length, 8);
  for (const c of cases) for (const part of ["**Исходная ситуация.**", "**Распространённая ошибка.**", "**Возможные последствия.**",
    "**Безопасный вариант.**", "**Пример результата.**", "**Критерии проверки.**"]) assert.ok(c.includes(part), "case " + c.slice(0, 20) + " lacks " + part);
});

test("every external link in the materials is https and backed by the dated source registry", () => {
  const registered = new Set(registry.sources.map(s => s.url));
  const used = new Set();
  for (const f of MD_FILES) for (const [, url] of md(f).matchAll(/\]\((https?:[^)\s]+)\)/g)) {
    assert.match(url, /^https:\/\//, f);
    if (url.includes("research.example")) continue; // deliberately fake link inside the "find the errors" exercise
    assert.ok(registered.has(url), `${f}: link not in sources.json — ${url}`);
    used.add(url);
  }
  for (const s of registry.sources) {
    assert.ok(used.has(s.url), "registered source never cited in materials: " + s.id);
    assert.equal(s.checkedOn, "2026-11-18");
  }
  assert.ok(registry.notConfirmed.length >= 1, "unconfirmed sources must be disclosed");
});

test("materials contain only synthetic contact data and parse with the PDF renderer", () => {
  for (const f of [...MD_FILES, "synthetic-practice-data.csv"]) {
    const text = md(f);
    for (const [phone] of text.matchAll(/\+7[\s(]*\d{3}[)\s-]*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g)) assert.match(phone, /\(000\)/, f + ": " + phone);
    for (const [mail] of text.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) assert.match(mail, /@example\.(com|org)$/, f + ": " + mail);
  }
  for (const f of MD_FILES) {
    const { meta, body } = parseFrontMatter(md(f));
    assert.match(meta.status, /Черновик на проверке/);
    assert.ok(renderMarkdown(body).length > 1000, f);
  }
});

async function pdfInfo(path) {
  const doc = await PDFDocument.load(readFileSync(path), { updateMetadata: false });
  const uris = new Set(); let internal = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i, PDFDict);
      const action = a.lookupMaybe(PDFName.of("A"), PDFDict);
      const uri = action?.get(PDFName.of("URI"));
      if (uri) uris.add(uri.toString()); else if (a.get(PDFName.of("Dest")) || action) internal++;
    }
  }
  return { pages: doc.getPageCount(), uris: uris.size, internal, title: doc.getTitle() };
}

test("downloadable PDFs exist, are paginated, titled and keep clickable sources and TOC links", async () => {
  for (const l of lessons) for (const d of l.downloads) assert.ok(existsSync(d.repositoryPath), d.repositoryPath);
  const guide = await pdfInfo(MAT + "pdf/safety-guide-a4.pdf");
  assert.ok(guide.pages >= 18 && guide.pages <= 32, "A4 guide pages: " + guide.pages);
  assert.equal(guide.title, "Безопасность использования ИИ на работе");
  assert.equal(guide.uris, registry.sources.length, "every registered source is a clickable link in the guide");
  assert.ok(guide.internal >= 20, "clickable TOC entries: " + guide.internal);
  const mobile = await pdfInfo(MAT + "pdf/safety-guide-mobile.pdf");
  assert.ok(mobile.pages > guide.pages, "phone layout has more, smaller pages");
  assert.equal(mobile.uris, guide.uris);
  const workbook = await pdfInfo(MAT + "pdf/safety-workbook-a4.pdf");
  assert.ok(workbook.pages >= 15 && workbook.internal >= 6);
  for (const f of ["checklist", "data-matrix", "prompts", "manager-request", "practicum", "test"])
    assert.ok((await pdfInfo(MAT + `pdf/safety-${f}-a4.pdf`)).pages >= 2, f);
  const memo = await pdfInfo(MAT + "pdf/safety-rules-memo-a4.pdf");
  assert.ok(memo.pages >= 1 && memo.pages <= 2, "memo must fit 1–2 A4 pages, got " + memo.pages);
});

test("legal statements are registered, sourced and interpretations are flagged in the guide", () => {
  const known = new Set(registry.sources.map(x => x.id));
  const statuses = Object.keys(claims.statuses);
  assert.deepEqual(statuses.sort(), ["illustration", "interpretation", "norm_text"]);
  for (const c of claims.claims) {
    assert.ok(statuses.includes(c.status), c.id);
    assert.ok(c.sourceIds.length && c.sourceIds.every(id => known.has(id)), c.id + " cites unknown source");
  }
  const interpretations = claims.claims.filter(c => c.status === "interpretation").length;
  const guide = md("guide.md");
  const flagged = (guide.match(/^> \[!legal\]\s*$/gm) || []).length;
  assert.equal(flagged, interpretations, "every interpretation needs a «Юридическая оговорка» block in the guide");
  assert.match(guide, /\[!legal\] Это не юридическая консультация/);
  for (const s of registry.sources.filter(x => /consultant\.ru/.test(x.url))) assert.match(s.edition, /^ред\. от \d{2}\.\d{2}\.\d{4}/, s.id);
});

test("the Air Canada example is framed as a foreign illustration without universal conclusions", () => {
  const ac = registry.sources.find(x => x.id === "SRC-CRT-AIR-CANADA");
  assert.equal(ac.status, "partially_confirmed");
  for (const text of [md("guide.md"), JSON.stringify(lessons)]) {
    assert.doesNotMatch(text, /принцип универсален|не снимает с компании ответственности/i);
  }
  const guide = md("guide.md");
  assert.match(guide, /Полный текст решения при подготовке пособия получить не удалось/);
  assert.match(guide, /\*\*не означает\*\*, что любой спор в России решится так же/);
  assert.doesNotMatch(guide, /Air Canada[^\n]*\d+\s*(\$|долл|CAD)/);
});

test("the one-page memo has exactly ten rules and the same disclaimer", () => {
  const { meta, body } = parseFrontMatter(md("07-rules-memo.md"));
  assert.equal(meta.layout, "memo");
  assert.equal((body.match(/^\d+\. \*\*/gm) || []).length, 10);
  assert.match(body, /не юридическая консультация/i);
  for (const l of lessons) assert.ok(l.downloads.some(d => d.id === "DL-SAF-RULES-MEMO"), l.id);
});

test("Russian quotes are balanced in every source: «…» outside, „…“ inside", () => {
  const sources = [...MD_FILES.map(f => [f, md(f)]), ...lessons.map(l => [l.id, JSON.stringify(l)])];
  for (const [name, text] of sources) {
    for (const [open, close] of [["«", "»"], ["„", "“"]]) {
      let depth = 0;
      for (const ch of text) {
        if (ch === open) { depth++; assert.ok(depth <= 1, `${name}: nested ${open} without closing ${close}`); }
        else if (ch === close) { depth--; assert.ok(depth >= 0, `${name}: ${close} without opening ${open}`); }
      }
      assert.equal(depth, 0, `${name}: unbalanced ${open}…${close}`);
    }
  }
});

// Regression for the CI failure on 5bd2cef ("heading not found in PDF text"): TOC page numbers
// used to be found by matching pdftotext lines, which broke on a clean runner. They now come
// from the PDF's named destinations, so wrapping, hyphenation and line endings do not matter.
test("TOC page numbers come from PDF destinations and survive wrapped headings", async () => {
  const { documentHtml, headingPages } = await import("../scripts/career/build-safety-materials.mjs");
  const guide = parseFrontMatter(md("guide.md"));
  for (const [file, format] of [["safety-guide-a4.pdf", "a4"], ["safety-guide-mobile.pdf", "mobile"]]) {
    const { headings } = documentHtml([guide], format);
    const listed = headings.filter(h => h.level === 2 || h.toc);
    const pages = await headingPages(MAT + "pdf/" + file, headings);
    assert.equal(Object.keys(pages).length, listed.length, file);
    const order = listed.map(h => pages[h.id]);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), file + ": headings must appear in document order");
    assert.ok(order[0] >= 3, file + ": first chapter must follow the cover and TOC");
    // headings that wrap onto two lines on the phone layout are still located
    assert.ok(listed.some(h => h.text.length > 45), "fixture must include long, wrapping headings");
    // the TOC printed in the PDF carries exactly these numbers
    const printed = documentHtml([guide], format, pages).html;
    for (const h of listed) assert.ok(printed.includes(`href="#${h.id}"`), h.id);
  }
  await assert.rejects(
    headingPages(MAT + "pdf/safety-guide-a4.pdf", [{ level: 2, id: "s0-999", text: "Несуществующий раздел" }]),
    /no destination for heading: Несуществующий раздел/);
  await assert.rejects(headingPages(MAT + "pdf/safety-checklist-a4.pdf", [{ level: 2, id: "s0-1", text: "x" }]), /no named destinations|no destination/);
});
