"use client";

import { consentRequired, openConsentSettings } from "@/lib/consent";

/** Footer entry to change or withdraw analytics consent; only in the consent-required mode. */
export default function ConsentSettingsButton({ className }: { className?: string }) {
  if (!consentRequired) return null;
  return (
    <li>
      <button type="button" onClick={openConsentSettings} className={className + " text-left"}>
        Настройки аналитики
      </button>
    </li>
  );
}
