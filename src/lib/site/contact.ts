// The contact form's shape (round 4): set per contact section, falling back to the older
// site-wide settings for sections made before that. Shared by the canvas, the live form and the API.
import type { Locale } from "@/i18n/locales";
import type { Block, ContactForm } from "./types";

/** Default field names, in the site's language (the canvas shows them before any are changed). */
export const CONTACT_WORDS: Record<
  Locale,
  { name: string; email: string; message: string; projectType: string; budget: string; deadline: string; sent: string }
> = {
  en: {
    name: "Your name",
    email: "Your email",
    message: "Message",
    projectType: "Project type",
    budget: "Budget",
    deadline: "Deadline",
    sent: "Thanks! Your message is on its way.",
  },
  ar: {
    name: "اسمك",
    email: "بريدك الإلكتروني",
    message: "الرسالة",
    projectType: "نوع المشروع",
    budget: "الميزانية",
    deadline: "الموعد النهائي",
    sent: "شكرًا! رسالتك في الطريق.",
  },
};

/** Site-wide contact settings from before round 4. */
export interface LegacyContactFields {
  projectType: boolean;
  budget: boolean;
  deadline: boolean;
  customQuestion: string;
}

export function contactFormOf(b: Extract<Block, { type: "contact" }>, legacy?: LegacyContactFields | null): ContactForm {
  if (b.form) return b.form;
  return {
    projectType: !!legacy?.projectType,
    budget: !!legacy?.budget,
    deadline: !!legacy?.deadline,
    custom: legacy?.customQuestion ?? "",
    labels: { name: "", email: "", message: "" },
    success: "",
    layout: "stacked",
  };
}
