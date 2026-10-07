import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import tokens from "../../../../../design/tokens.json";
import { plansConfig, lowestMonthlyPrice, limitsFor } from "@/config/plans";
import { AvailablePill, Badge, Chip } from "@/components/ui/Badge";
import { Button, IconButton, buttonClasses } from "@/components/ui/Button";
import { Checkbox, Radio, Segmented, Slider, Toggle } from "@/components/ui/Controls";
import { Input, Select } from "@/components/ui/Field";
import { Icon, iconNames } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Card, CardTitle, EmptyState, Eyebrow, Highlight, NavItem, Tile } from "@/components/ui/Surfaces";
import type { Locale } from "@/i18n/locales";
import { OverlayDemos } from "./Interactive";

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/kitchen-sink">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "kitchen" });
  return { title: t("metaTitle"), robots: { index: false } };
}

function Section({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? "md:col-span-2 xl:col-span-3" : undefined}>
      <Card className="h-full">
        <CardTitle>{title}</CardTitle>
        {children}
      </Card>
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-muted text-[12px]">{children}</p>;
}

export default async function KitchenSink({ params }: PageProps<"/[locale]/marketing/kitchen-sink">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("kitchen");
  const tc = await getTranslations("common");
  const otherHref = locale === "ar" ? "/kitchen-sink" : "/ar/kitchen-sink";
  const free = limitsFor("free");

  return (
    <main className="bg-mist min-h-dvh px-4 py-8 md:px-14 md:py-12">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[820px]">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1 className="font-heading font-heading-weight mt-1 mb-1.5 text-[40px] leading-[1.1] tracking-[-0.02em] md:text-[48px]">
              {t("title")}
            </h1>
            <p className="text-ink-soft text-[16px]">{t("intro")}</p>
          </div>
          <a href={otherHref} lang={locale === "ar" ? "en" : "ar"} className={buttonClasses("outline", "md")}>
            <Icon name="language" size={18} />
            {tc("otherLanguage")}
          </a>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Logo */}
          <Section title={t("logo")}>
            <div className="bg-paper flex flex-col items-center gap-6 rounded-md py-6">
              <Logo lang="en" size={44} />
              <Logo lang="ar" size={52} />
              <div className="bg-lime flex w-full items-center justify-center gap-6 rounded-md py-4">
                <Logo lang="en" size={32} short onLime />
              </div>
            </div>
          </Section>

          {/* Type */}
          <Section title={t("type")}>
            <div className="flex flex-col gap-3">
              <p className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">
                {t("typeDisplay")}
              </p>
              <p className="font-heading font-heading-weight text-[24px] leading-tight">{t("typeSection")}</p>
              <p className="font-heading font-heading-weight text-title">
                <Highlight>{t("typeTitle")}</Highlight>
              </p>
              <p className="text-body">{t("typeBody")}</p>
              <p className="text-label text-muted tracking-[0.08em] uppercase">{t("typeLabel")}</p>
            </div>
          </Section>

          {/* Colours, read straight from design/tokens.json */}
          <Section title={t("colours")}>
            <div className="grid grid-cols-2 gap-2">
              {tokens.color.tokens.map((c) => (
                <div key={c.name} className="flex items-center gap-2.5">
                  <span className="border-line size-10 flex-none rounded-md border" style={{ background: c.value }} />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[13px] font-semibold">{c.name}</span>
                    <span dir="ltr" className="text-muted text-[12px]">
                      {c.value}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Buttons */}
          <Section title={t("buttons")}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button icon="publish" size="lg">
                  {t("publish")}
                </Button>
                <Button icon="upload" variant="lime" size="lg">
                  {t("upload")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon="preview" variant="outline" size="lg">
                  {t("preview")}
                </Button>
                <Button icon="add" variant="ghost" size="sm">
                  {t("addPage")}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">{t("small")}</Button>
                <Button size="md">{t("default")}</Button>
                <Button size="lg">{t("large")}</Button>
                <Button disabled>{t("disabled")}</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <IconButton icon="undo" label={t("undo")} />
                <IconButton icon="redo" label={t("redo")} />
                <IconButton icon="desktop" label={t("desktop")} variant="mist" />
                <IconButton icon="tablet" label={t("tablet")} variant="ghost" />
                <IconButton icon="mobile" label={t("mobile")} variant="active" />
              </div>
            </div>
          </Section>

          {/* Badges */}
          <Section title={t("badges")}>
            <div className="flex flex-wrap gap-2">
              <Badge variant="live">{t("live")}</Badge>
              <Badge variant="password">{t("password")}</Badge>
              <Badge variant="draft">{t("draft")}</Badge>
              <Badge variant="hidden">{t("hidden")}</Badge>
              <Badge variant="neutral">{t("sample")}</Badge>
              <Badge variant="brand">{t("brand")}</Badge>
              <Badge variant="pro">{t("pro")}</Badge>
            </div>
            <div>
              <AvailablePill>{t("available")}</AvailablePill>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip selected>{t("all")}</Chip>
              <Chip>{t("characterDesign")}</Chip>
              <Chip>{t("storyboard")}</Chip>
            </div>
          </Section>

          {/* Controls */}
          <Section title={t("controls")}>
            <div className="flex flex-col gap-4">
              <Toggle label={t("toggleLabel")} defaultChecked />
              <Toggle label={t("toggleOff")} />
              <div className="flex flex-wrap gap-5">
                <Checkbox label={t("checkboxOn")} defaultChecked />
                <Checkbox label={t("checkbox")} />
              </div>
              <fieldset className="flex flex-wrap gap-5">
                <legend className="sr-only">{t("visibility")}</legend>
                <Radio name="visibility" label={t("radioPublic")} defaultChecked />
                <Radio name="visibility" label={t("radioPassword")} />
                <Radio name="visibility" label={t("radioHidden")} />
              </fieldset>
              <Segmented
                label={t("editorTabs")}
                options={[
                  { value: "blocks", label: t("blocks") },
                  { value: "style", label: t("style") },
                  { value: "pages", label: t("pages") },
                ]}
              />
              <Slider label={t("slider")} min={0} max={24} defaultValue={12} unit="px" />
            </div>
          </Section>

          {/* Inputs */}
          <Section title={t("inputs")}>
            <div className="flex flex-col gap-4">
              <Input
                label={t("inputLabel")}
                placeholder={t("inputPlaceholder")}
                hint={t("inputHint")}
                icon="link"
                suffix=".fannan.net"
                dir="ltr"
              />
              <Input
                label={t("inputErrorLabel")}
                defaultValue="ahmed"
                error={t("inputError")}
                suffix=".fannan.net"
                dir="ltr"
              />
              <Input icon="search" placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} />
              <Select
                label={t("selectLabel")}
                options={(["animation", "character", "storyboard", "illustration"] as const).map((k) => ({
                  value: k,
                  label: t(`selectOptions.${k}`),
                }))}
              />
            </div>
          </Section>

          {/* Tiles and navigation */}
          <Section title={t("tiles")}>
            <div className="flex flex-col gap-2">
              <Tile icon="grid" label={t("grid")} />
              <Tile icon="masonry" label={t("masonry")} />
              <Tile icon="reel" label={t("reel")} selected badge={<Badge variant="brand">{t("brand")}</Badge>} />
            </div>
            <div className="bg-mist mt-2 flex flex-col gap-1 rounded-md p-2">
              <NavItem icon="dashboard" label={t("dashboard")} href="#" active />
              <NavItem icon="projects" label={t("projects")} href="#" />
              <NavItem icon="stats" label={t("stats")} href="#" />
            </div>
          </Section>

          {/* Cards and artwork */}
          <Section title={t("cards")}>
            <div className="grid grid-cols-[1.4fr_1fr_1fr] items-end gap-2.5">
              {[
                { ratio: "16 / 9", label: t("aspect169"), bg: "#5B3A2E" },
                { ratio: "4 / 3", label: t("aspect43"), bg: "#4E5B2E" },
                { ratio: "1 / 1", label: t("aspect11"), bg: "#2E2E2E" },
              ].map((a) => (
                <div key={a.ratio} className="flex flex-col gap-1.5">
                  <div className="rounded-md" style={{ aspectRatio: a.ratio, background: a.bg }} />
                  <span className="text-muted text-[11px]">{a.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="border-line bg-paper text-muted flex h-16 flex-1 items-center rounded-lg border px-4 text-[12px]">
                {t("cardTitle")}
              </div>
              <div className="bg-paper text-muted shadow-float flex h-16 flex-1 items-center rounded-lg px-4 text-[12px]">
                Popover
              </div>
            </div>
            <Note>{t("cardText")}</Note>
          </Section>

          {/* Overlays */}
          <Section title={t("overlays")}>
            <OverlayDemos />
          </Section>

          {/* Empty state */}
          <Section title={t("empty")}>
            <EmptyState icon="messages" title={t("emptyTitle")} text={t("emptyText")} action={t("emptyAction")} />
          </Section>

          {/* Plans from config */}
          <Section title={t("config")}>
            <ul className="flex flex-col gap-2 text-[14px]">
              <li className="flex items-center gap-2.5">
                <span className="hl-bar h-[5px] w-2.5" />
                {t("freeProjects", { count: free.projects ?? 0 })}
              </li>
              {plansConfig.plans.pro.durations.map((d) => (
                <li key={d.months} className="flex items-center gap-2.5">
                  <span className="hl-bar h-[5px] w-2.5" />
                  <span>{t("months", { count: d.months })}</span>
                  <span dir="ltr" className="text-ink-soft ms-auto tabular-nums">
                    {d.EGP.toLocaleString("en")} EGP · ${d.USD}
                  </span>
                </li>
              ))}
              <li className="pt-1 font-semibold">
                {t("proFrom", { price: `${lowestMonthlyPrice("EGP")} EGP / $${lowestMonthlyPrice("USD")}` })}
              </li>
            </ul>
            <Note>{t("configNote")}</Note>
          </Section>

          {/* Icons */}
          <Section title={`${t("icons")} · ${iconNames.length}`} wide>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
              {iconNames.map((name) => (
                <div
                  key={name}
                  className="border-line bg-paper text-muted flex h-24 flex-col items-center justify-center gap-2.5 rounded-md border px-1 text-center text-[11px]"
                >
                  <span className="text-ink">
                    <Icon name={name} size={24} />
                  </span>
                  <span dir="ltr">{name}</span>
                </div>
              ))}
            </div>
            <Note>{t("iconsNote")}</Note>
          </Section>
        </div>
      </div>
    </main>
  );
}
