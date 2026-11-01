#!/usr/bin/env python3
"""
Blog cover / infographic generator in the MIRONOVICH editorial style used by the
existing article images (public/blog/*.png): light background, condensed
uppercase headline, numbered orange markers, dark band with the takeaway.

    pip install pillow          # once
    python3 assets/blog-covers/generate.py            # all covers below
    python3 assets/blog-covers/generate.py <slug>     # one cover

Output: public/blog/<slug>.png, 2212×1659 (same size as the existing covers).
Used as the article's coverImage (blog card, Open Graph, JSON-LD) and inline.

Fonts (SIL Open Font License) live in ./fonts: Roboto Condensed and Inter are the
site's own fonts (Cyrillic and Latin subsets are separate files, so text is drawn
character by character with per-character fallback), JetBrains Mono for labels.

Text on the covers must stay factual: no invented figures, cases or prices.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = Path(__file__).resolve().parent / "fonts"

W, H = 2212, 1659
M = 111  # outer margin
BG = "#E8E5DF"
INK = "#141417"
ACCENT = "#FF7A2E"
LIGHT = "#F2EFE8"


def _font(name, size, weight=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    if weight is not None:
        f.set_variation_by_axes([weight])
    return f


class Face:
    """A font family split into Cyrillic and Latin subsets."""

    def __init__(self, family, size, weight):
        self.fonts = [_font(f"{family}-cyrillic.woff2", size, weight), _font(f"{family}-latin.woff2", size, weight)]
        self.missing = [self._sig(f, "\U0010FFFD") for f in self.fonts]
        self.size = size

    @staticmethod
    def _sig(f, ch):
        m = f.getmask(ch)
        return m.size, bytes(m)

    def pick(self, ch):
        if ch == " ":
            return self.fonts[1]
        for f, miss in zip(self.fonts, self.missing):
            if self._sig(f, ch) != miss:
                return f
        return self.fonts[1]

    def width(self, text, tracking=0.0):
        return sum(self.pick(c).getlength(c) + tracking * self.size for c in text)

    def draw(self, d, xy, text, fill, tracking=0.0):
        x, y = xy
        for c in text:
            f = self.pick(c)
            d.text((x, y), c, font=f, fill=fill)
            x += f.getlength(c) + tracking * self.size
        return x


class Mono:
    def __init__(self, size):
        self.font = _font("JetBrainsMono-Medium.ttf", size)
        self.size = size

    def width(self, text, tracking):
        return sum(self.font.getlength(c) + tracking * self.size for c in text)

    def draw(self, d, xy, text, fill, tracking=0.18):
        x, y = xy
        for c in text:
            d.text((x, y), c, font=self.font, fill=fill)
            x += self.font.getlength(c) + tracking * self.size


def wrap(face, text, max_w, tracking=0.0):
    words, lines, cur = text.replace(" — ", "\u00a0— ").split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if face.width(t, tracking) > max_w and cur:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines


def render(spec):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    label = Mono(30)

    # top labels
    label.draw(d, (M, 86), spec["label"].upper(), INK)
    right = "MIRONOVICH"
    label.draw(d, (W - M - label.width(right, 0.18), 86), right, INK)

    # headline: as large as fits the width, max 150px
    lines = [l.upper() for l in spec["headline"]]
    size = 150
    while size > 80:
        hf = Face("RobotoCondensed", size, 800)
        if max(hf.width(l, -0.01) for l in lines) <= W - 2 * M:
            break
        size -= 4
    y = 180
    for l in lines:
        hf.draw(d, (M - size * 0.03, y), l, INK, -0.01)
        y += int(size * 0.94)

    sub = Face("Inter", 42, 500)
    sub.draw(d, (M, y + 40), spec["subtitle"], INK)

    # numbered columns
    items = spec["items"]
    n = len(items)
    gap = 40
    col_w = (W - 2 * M - gap * (n - 1)) / n
    top = 640
    title_size = 56 if n <= 3 else 50
    tf = Face("RobotoCondensed", title_size, 800)
    df = Face("Inter", 34 if n <= 3 else 32, 400)
    for i, (title, desc) in enumerate(items):
        x = M + i * (col_w + gap)
        d.rectangle([x, top, x + col_w, top + 4], fill=INK)
        d.rectangle([x, top + 40, x + 88, top + 128], fill=ACCENT)
        nf = Face("RobotoCondensed", 46, 800)
        num = f"{i + 1:02d}"
        nf.draw(d, (x + (88 - nf.width(num)) / 2, top + 58), num, INK)
        ty = top + 158
        for tl in wrap(tf, title.upper(), col_w):
            tf.draw(d, (x, ty), tl, INK)
            ty += int(title_size * 0.98)
        ty += 22
        for dl in wrap(df, desc, col_w):
            df.draw(d, (x, ty), dl, INK)
            ty += int(df.size * 1.38)

    # dark band with the takeaway
    band = 1340
    d.rectangle([0, band, W, H], fill=INK)
    bf_accent = Face("Inter", 50, 600)
    bf_rest = Face("Inter", 50, 500)
    # lay out accent + rest as one paragraph with two colours
    # a dash never starts a line: glue it to the previous word with a no-break space
    glue = lambda t: t.replace(" — ", "\u00a0— ").split(" ")
    words = [(w, ACCENT, bf_accent) for w in glue(spec["accent"])] + [(w, LIGHT, bf_rest) for w in glue(spec["rest"])]
    x, y, line_h = M, band + 66, 66
    for w, color, face in words:
        ww = face.width(w)
        if x + ww > W - M:
            x, y = M, y + line_h
        face.draw(d, (x, y), w, color)
        x += ww + face.width(" ")
    label.draw(d, (M, H - 92), "ДАНИЛ МИРОНОВИЧ", LIGHT)
    site = "MIRONOVICH.PRO"
    label.draw(d, (W - M - label.width(site, 0.18), H - 92), site, LIGHT)
    return im


COVERS = {
    "kakie-processy-avtomatizirovat": dict(
        label="01 / Автоматизация",
        headline=["Какие процессы", "автоматизировать первыми"],
        subtitle="5 признаков подходящего процесса",
        items=[
            ("Часто повторяется", "Одни и те же шаги каждый раз"),
            ("Понятные правила", "Решение по условиям, а не по опыту"),
            ("Данные в цифре", "CRM, учёт, таблицы, почта"),
            ("Дорогая ошибка", "Ручной перенос, пересчёт, реквизиты"),
            ("Измеримый эффект", "Есть «до» и «после»"),
        ],
        accent="Сначала подходящий процесс, потом инструмент.",
        rest="Сложные и спорные задачи — вторыми.",
    ),
    "stoimost-vnedreniya-ii-v-biznes": dict(
        label="01 / ИИ для бизнеса",
        headline=["Сколько стоит", "внедрение ИИ"],
        subtitle="Из чего складывается бюджет",
        items=[
            ("Пилот", "Проверка на ваших реальных данных"),
            ("Данные", "Документы, примеры, разметка"),
            ("Интеграции", "CRM, почта, база знаний"),
            ("Модель", "Оплата запросов или свой сервер"),
            ("Поддержка", "Контроль качества и обновления"),
        ],
        accent="Единой цены нет.",
        rest="Есть статьи расходов, и их можно оценить до старта.",
    ),
    "ii-assistent-dlya-biznesa": dict(
        label="02 / ИИ для бизнеса",
        headline=["ИИ-ассистент", "для бизнеса"],
        subtitle="Что умеет и как внедрить",
        items=[
            ("Задача", "Одна частая и понятная"),
            ("Данные", "Проверить и обновить документы"),
            ("Провайдер", "Облако или свой сервер"),
            ("Проверка", "На реальных примерах"),
            ("Встраивание", "Там, где уже работают люди"),
        ],
        accent="ИИ готовит, человек проверяет.",
        rest="Особенно там, где ошибка стоит денег.",
    ),
    "stoimost-razrabotki-prilozheniya-dlya-biznesa": dict(
        label="01 / Приложения",
        headline=["Сколько стоит", "приложение для бизнеса"],
        subtitle="Что влияет на бюджет в 2026 году",
        items=[
            ("Формат", "Веб, Mini App или мобильное"),
            ("Функции", "Роли, экраны, правила"),
            ("Интеграции", "CRM, учёт, оплата"),
            ("Дизайн", "Компоненты или свой стиль"),
            ("Поддержка", "Хостинг, сервисы, развитие"),
        ],
        accent="Сравнивайте не цены, а состав работ.",
        rest="Просите оценку по этапам и список того, что не входит.",
    ),
    "crm-pod-zadachi-ili-gotovaya-sistema": dict(
        label="02 / Приложения",
        headline=["Своя CRM", "или готовая"],
        subtitle="Три варианта и как выбрать",
        items=[
            ("Готовая", "Типовой процесс и быстрый старт"),
            ("Готовая + доработка", "Основа готовая, отличия — интеграциями"),
            ("Своя система", "Нестандартный процесс и свои данные"),
        ],
        accent="Параллельные таблицы — главный сигнал,",
        rest="что система не подходит под процесс.",
    ),
    "telegram-mini-app-dlya-biznesa": dict(
        label="03 / Приложения",
        headline=["Telegram Mini Apps", "для бизнеса"],
        subtitle="Возможности, сценарии и стоимость",
        items=[
            ("Интерфейс", "Формы, каталоги, личный кабинет"),
            ("Вход", "Без установки и регистрации"),
            ("Бот", "Уведомления и статусы"),
            ("Оплата", "По правилам Telegram"),
            ("Сценарии", "Запись, заказы, задачи команды"),
        ],
        accent="Приложение там, где уже ваши клиенты.",
        rest="Если они пользуются Telegram.",
    ),
    "adaptaciya-novyh-sotrudnikov-pervye-30-dney": dict(
        label="06 / Адаптация",
        headline=["Адаптация:", "первые 30 дней"],
        subtitle="План по неделям",
        items=[
            ("До выхода", "Доступы, наставник, план"),
            ("День 1", "Знакомство и ориентация"),
            ("Неделя 1", "Обязательная база"),
            ("Недели 2–3", "Практика под присмотром"),
            ("Неделя 4", "Самостоятельно и итоги"),
        ],
        accent="У каждого этапа — цель и контрольная точка.",
        rest="Тогда адаптация не зависит от загрузки руководителя.",
    ),
    "avtomatizaciya-obucheniya-sotrudnikov": dict(
        label="07 / Обучение",
        headline=["Автоматизация", "обучения сотрудников"],
        subtitle="Что автоматизировать и что контролировать",
        items=[
            ("Маршрут", "Назначение по должности"),
            ("Материалы", "Выдача по шагам"),
            ("Тесты", "Автопроверка и пересдача"),
            ("Напоминания", "И эскалация руководителю"),
            ("Аналитика", "Прохождение, ошибки, сроки"),
        ],
        accent="Мерить результат, а не прохождение.",
        rest="Сотрудник может пройти все уроки и не научиться.",
    ),
}


def main():
    only = sys.argv[1:]
    for slug, spec in COVERS.items():
        if only and slug not in only:
            continue
        out = ROOT / "public" / "blog" / f"{slug}.png"
        render(spec).save(out, "PNG", optimize=True)
        print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
