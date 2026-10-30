import apps from "./apps";
import automation from "./automation";
import training from "./training";
import type { ServicePageContent } from "./types";
import type { ServiceSlug } from "@/config/services";

export const servicePages: Record<ServiceSlug, ServicePageContent> = { automation, apps, training };

export type { ServicePageContent } from "./types";
