import fs from "node:fs";
import path from "node:path";

/**
 * Dimensions of an image that lives in public/, read straight from the file
 * header (PNG, JPEG, WebP). next/image needs width/height for local files and
 * Open Graph wants them too; this avoids a dependency and avoids hand-typing
 * numbers into every article. Build-time only.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export type ImageInfo = { src: string; width: number; height: number; type: string };
type Size = { width: number; height: number } | null;

function png(b: Buffer): Size {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function webp(b: Buffer): Size {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (kind === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  return null;
}

function jpeg(b: Buffer): Size {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) {
      o++;
      continue;
    }
    const marker = b[o + 1];
    // SOF0–SOF15 carry the frame size; C4, C8 and CC share the range but do not
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(o + 5), width: b.readUInt16BE(o + 7) };
    }
    o += 2 + b.readUInt16BE(o + 2);
  }
  return null;
}

/** `src` is a site path such as /blog/scheme.png — the file must exist under public/. */
export function readImage(src: string): ImageInfo {
  if (!src.startsWith("/") || src.startsWith("//")) {
    throw new Error("путь к картинке «" + src + "» должен начинаться с / и указывать на файл в public/");
  }
  const ext = path.extname(src).toLowerCase();
  const type = TYPES[ext];
  if (!type) throw new Error("формат картинки «" + src + "» не поддерживается: нужен png, jpg или webp");

  const file = path.join(PUBLIC_DIR, src);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new Error("путь к картинке «" + src + "» выходит за пределы public/");
  if (!fs.existsSync(file)) throw new Error("картинки нет: public" + src);

  const buf = fs.readFileSync(file);
  const size = ext === ".png" ? png(buf) : ext === ".webp" ? webp(buf) : jpeg(buf);
  if (!size || !size.width || !size.height) throw new Error("не удалось определить размер картинки public" + src);
  return { src, ...size, type };
}
