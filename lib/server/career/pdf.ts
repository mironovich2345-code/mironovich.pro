import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { CareerResult } from "../../career-diagnostic.ts";
export async function careerPdf(result: CareerResult): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("Учебный отчёт MIRONOVICH");
  pdf.setAuthor("MIRONOVICH.PRO synthetic sandbox");
  const aiPilot = result.engine === "openai";
  const font = await pdf.embedFont(
    await readFile(resolve("public/fonts/career/DejaVuSans.ttf")),
    { subset: true },
  );
  let page = pdf.addPage([595, 842]),
    y = 790;
  function line(text: string, size = 11) {
    const words = text.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(next, size) > 495 && current) {
        draw(current, size);
        current = word;
      } else current = next;
    }
    if (current) draw(current, size);
    y -= 5;
  }
  function draw(text: string, size: number) {
    if (y < 55) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    page.drawText(text, { x: 50, y, size, font, color: rgb(0.08, 0.1, 0.15) });
    y -= size + 5;
  }
  line(aiPilot ? "УЧЕБНЫЙ ИИ-АНАЛИЗ · ВЫМЫШЛЕННЫЕ ДАННЫЕ" : "СИНТЕТИЧЕСКИЙ ТЕСТОВЫЙ ОТЧЁТ", 16);
  line("Как стать ценнее для компании с помощью ИИ", 14);
  line(result.disclaimer);
  for (const t of result.tasks) {
    line(t.title, 13);
    line(t.steps);
    line(t.recommendation);
    line("Учебная оценка пригодности: " + t.score + " из 3.");
  }
  line("Три направления развития", 14);
  result.directions.forEach((x) => line(x));
  line("План из 30 шагов", 14);
  result.plan.forEach((d) => {
    line(`Шаг ${d.day}. ${d.theme}: ${d.action}`);
    line(`Результат: ${d.evidence}`);
  });
  for (const p of pdf.getPages())
    p.drawText(aiPilot ? "Учебные данные · ИИ-пилот · Не для реальных данных" : "Синтетический тест · Не настоящий ИИ-анализ", {
      x: 50,
      y: 25,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  return Buffer.from(await pdf.save());
}
