import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SiteRender } from "@/components/site/SiteRender";
import type { Locale } from "@/i18n/locales";
import { kindByKey, LIBRARY } from "@/lib/site/blocks";
import { themes } from "@/lib/site/starter";
import type { Block, SiteDraft, ThemePreset } from "@/lib/site/types";

// Every section template in the library, each drawn on its own (round 12 audit). Not linked;
// /kitchen-sink/templates?theme=night shows them in another theme.

export const metadata: Metadata = { title: "Section templates", robots: { index: false } };

export default async function TemplatesSheet({ params, searchParams }: PageProps<"/[locale]/marketing/kitchen-sink/templates">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;
  const preset = (typeof sp.theme === "string" && sp.theme in themes ? sp.theme : "gallery") as ThemePreset;
  const keys = LIBRARY.flatMap((g) => g.keys);
  return (
    <div className="flex flex-col gap-10 bg-[#E8E8E2] p-6">
      {keys.map((key) => {
        const kind = kindByKey(key);
        if (!kind) return null;
        const site: SiteDraft = {
          language: locale,
          title: locale === "ar" ? "نور عادل" : "Nour Adel",
          tagline: "",
          theme: themes[preset],
          pages: [{ id: "p", slug: "", title: "", type: "custom", showInNav: false, blocks: [kind.make(locale) as Block] }],
        };
        return (
          <section key={key} data-template={key} className="mx-auto w-[1200px] overflow-hidden bg-white shadow">
            <div className="bg-[#1A1C16] px-3 py-1.5 font-mono text-[13px] text-white">{key}</div>
            <SiteRender site={site} pageId="p" editing bare />
          </section>
        );
      })}
    </div>
  );
}
