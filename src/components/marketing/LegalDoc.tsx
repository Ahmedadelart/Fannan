import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { MarketingPage } from "./Chrome";

// Terms, Privacy and Content policy. The text lives in messages/{en,ar}.json under "legal".

interface Doc {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{ h: string; p: string[] }>;
}

export async function legalTitle(locale: Locale, doc: "terms" | "privacy" | "policy") {
  const t = await getTranslations({ locale, namespace: "legal" });
  return (t.raw(doc) as Doc).title;
}

export async function LegalDoc({ locale, doc, path }: { locale: Locale; doc: "terms" | "privacy" | "policy"; path: string }) {
  const t = await getTranslations("legal");
  const d = t.raw(doc) as Doc;
  return (
    <MarketingPage locale={locale} path={path} title={d.title} sub={d.intro} narrow>
      <p className="text-muted mb-8 text-[14px]">{d.updated}</p>
      <ol className="flex flex-col gap-8">
        {d.sections.map((s, i) => (
          <li key={i} id={`s${i + 1}`} className="flex flex-col gap-2.5">
            <h2 className="font-heading font-heading-weight text-[24px] leading-tight">
              {i + 1}. {s.h}
            </h2>
            {s.p.map((p, j) => (
              <p key={j} className="text-ink-soft leading-relaxed">
                {p}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </MarketingPage>
  );
}
