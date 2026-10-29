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

export async function LegalDoc({
  locale,
  doc,
  path,
}: {
  locale: Locale;
  doc: "terms" | "privacy" | "policy";
  path: string;
}) {
  const t = await getTranslations("legal");
  const d = t.raw(doc) as Doc;
  return (
    <MarketingPage locale={locale} path={path} title={d.title} sub={d.intro} narrow>
      <p className="m-0 mb-10 text-[15px] opacity-70">{d.updated}</p>
      <ol className="m-0 flex list-none flex-col gap-10 p-0">
        {d.sections.map((s, i) => (
          <li key={i} id={`s${i + 1}`} className="flex flex-col gap-3">
            <h2 className="mk-title m-0 text-[24px]">
              {i + 1}. {s.h}
            </h2>
            {s.p.map((p, j) => (
              <p key={j} className="m-0 text-[17px] leading-[1.65] opacity-85">
                {p}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </MarketingPage>
  );
}
