"use client";

import type { ReactNode } from "react";
import type { Contact } from "@/config/contacts";
import { track, type ContactLocation } from "@/lib/analytics";

/** External contact link (Telegram / Instagram) that reports contact_click — channel and place only. */
export default function ContactLink({
  contact,
  location,
  className,
  children,
}: {
  contact: Contact;
  location: ContactLocation;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={contact.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("contact_click", { channel: contact.channel, location })}
      className={className}
    >
      {children ?? contact.label}
    </a>
  );
}
