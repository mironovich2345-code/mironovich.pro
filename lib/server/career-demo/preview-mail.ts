import { createHmac } from "node:crypto";
export const PREVIEW_MAIL_COOKIE = "career_preview_mail";
export const previewMailToken = (secret: string, key: string) => createHmac("sha256", secret).update("preview-mail:" + key).digest("hex");
