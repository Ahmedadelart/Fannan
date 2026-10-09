"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { arabicFonts, headingFonts, siteFontVars } from "@/components/site/fonts";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { imageSources } from "@/lib/media";
import { IMAGE_ACCEPT, uploadFile, type Uploaded } from "@/components/editor/upload";
import { disciplineById, disciplineLabel, searchDisciplines } from "@/config/disciplines";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { buildFromGuide, GUIDE_STEPS, tidyPages, type GuideAnswers, type GuideStep } from "@/lib/site/guide";
import { presetIds, themes } from "@/lib/site/starter";
import type { HeaderSettings, SiteDraft } from "@/lib/site/types";
import { buildSite, saveGuide } from "./actions";
import { GuidePages } from "./GuidePages";
import { GuideInside, GuideProjects } from "./GuideProjects";
import { GuidePageByPage } from "./GuidePageByPage";
import { bigButton, backButton, Kicker, Problem, Question, toSiteMedia } from "./ui";

export interface GuideInitial {
  step: number;
  answers: GuideAnswers;
  /** The site has been edited before: building replaces its pages (a backup is kept). */
  rerun: boolean;
  language: Locale;
  title: string;
  address: string;
  header?: HeaderSettings;
  media: Record<string, SiteMedia>;
  projects: GalleryProject[];
  social: Array<{ network: string; url: string }>;
  projectLimit: number | null;
}

/** Steps people can leave out; the others have sensible answers already. */
const SKIPPABLE: GuideStep[] = ["look", "projects", "inside", "pages2"];

export function GuideFlow({ initial }: { initial: GuideInitial }) {
  const t = useTranslations("guide");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [step, setStep] = useState(initial.step);
  const [answers, setAnswersState] = useState<GuideAnswers>(() => ({
    ...initial.answers,
    // Projects deleted since last time drop out.
    projects: initial.answers.projects.filter((p) => initial.projects.some((x) => x.id === p.id)),
    social: initial.answers.social?.length ? initial.answers.social : initial.social,
  }));
  const [projects, setProjects] = useState<GalleryProject[]>(initial.projects);
  const [media, setMedia] = useState<Record<string, SiteMedia>>(initial.media);
  const [pageAt, setPageAt] = useState(0);
  const [building, setBuilding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedState, setSavedState] = useState<"idle" | "saving" | "saved">("idle");
  const latest = useRef(answers);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const save = useCallback(async (s: number, a: GuideAnswers) => {
    setSavedState("saving");
    const r = await saveGuide(s, a).catch(() => null);
    setSavedState(r?.ok ? "saved" : "idle");
  }, []);

  const setAnswers = useCallback(
    (fn: (a: GuideAnswers) => GuideAnswers) => {
      setAnswersState((a) => {
        const next = fn(a);
        latest.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(stepRef.current, latest.current), 1500);
    },
    [save],
  );

  const addMedia = useCallback((m: Uploaded) => setMedia((all) => ({ ...all, [m.id]: toSiteMedia(m) })), []);

  const go = (next: number) => {
    const s = Math.max(0, Math.min(GUIDE_STEPS.length - 1, next));
    setProblem(null);
    setStep(s);
    if (timer.current) clearTimeout(timer.current);
    void save(s, latest.current);
    top.current?.scrollIntoView({ block: "start" });
  };

  const name = GUIDE_STEPS[step];
  const cards = useMemo(
    () =>
      projects.map((p) => {
        const a = answers.projects.find((x) => x.id === p.id);
        return a ? { ...p, card: { size: a.size, text: a.text } } : p;
      }),
    [projects, answers.projects],
  );
  const draft: SiteDraft = useMemo(
    () => buildFromGuide(answers, { language: initial.language, title: initial.title, projects, header: initial.header }),
    [answers, projects, initial.language, initial.title, initial.header],
  );
  const ownPages = tidyPages(answers.pages).filter((p) => p.kind !== "folder");
  const previewPage = name === "pages2" ? ownPages[Math.min(pageAt, ownPages.length - 1)]?.id : undefined;

  async function build() {
    setBuilding(true);
    setProblem(null);
    if (timer.current) clearTimeout(timer.current);
    const r = await buildSite(latest.current).catch(() => null);
    if (!r?.ok) {
      setBuilding(false);
      return setProblem(t("buildFailed"));
    }
    router.push("/editor?ready=1");
  }

  const nav = (
    <div className="flex flex-wrap items-center gap-3.5 pt-2">
      {name !== "build" && (
        <button
          type="button"
          className={bigButton}
          onClick={() => {
            if (name === "what" && !answers.discipline.trim()) return setProblem(t("what.needed"));
            if (name === "name" && answers.logo.mode === "name" && !answers.logo.name.trim()) return setProblem(t("name.needed"));
            // Page by page: Next goes through the pages first.
            if (name === "pages2" && pageAt < ownPages.length - 1) {
              setPageAt(pageAt + 1);
              return top.current?.scrollIntoView({ block: "start" });
            }
            go(step + 1);
          }}
          data-testid="guide-next"
        >
          {t("next")}
        </button>
      )}
      {step > 0 && (
        <button
          type="button"
          className={backButton}
          onClick={() => {
            if (name === "pages2" && pageAt > 0) return setPageAt(pageAt - 1);
            go(step - 1);
          }}
        >
          {t("back")}
        </button>
      )}
      {SKIPPABLE.includes(name) && (
        <button type="button" className={backButton} onClick={() => go(step + 1)} data-testid="guide-skip">
          {t("skip")}
        </button>
      )}
      {step >= 3 && name !== "build" && (
        <button
          type="button"
          className="text-primary ms-auto text-[15px] font-semibold hover:underline"
          onClick={() => go(GUIDE_STEPS.length - 1)}
          data-testid="guide-build-now"
        >
          {t("buildNow")}
        </button>
      )}
    </div>
  );

  return (
    <div className={cx("bg-surface text-ink flex min-h-dvh flex-col", siteFontVars)} ref={top}>
      {/* Top bar: where you are, and a way out that keeps your answers. */}
      <header className="border-line bg-paper sticky top-0 z-30 flex flex-col gap-2 border-b px-5 pt-3 pb-2.5 md:px-8">
        <div className="flex items-center gap-3">
          <Logo lang={locale} size={24} />
          <span className="text-muted text-[13px] font-semibold" data-testid="guide-step">
            {t("stepOf", { step: step + 1, total: GUIDE_STEPS.length })} · {t(`${name}.short`)}
          </span>
          <span className="text-muted ms-auto hidden text-[12px] sm:inline" aria-live="polite">
            {savedState === "saving" ? t("saving") : savedState === "saved" ? t("saved") : ""}
          </span>
          <a
            href="/editor"
            onClick={() => void save(step, latest.current)}
            className="text-ink hover:bg-mist rounded-pill px-3 py-1.5 text-[14px] font-semibold"
            data-testid="guide-later"
          >
            {t("later")}
          </a>
        </div>
        <div
          className="bg-mist h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={GUIDE_STEPS.length}
          aria-valuenow={step + 1}
          aria-label={t("progress")}
        >
          <div className="bg-primary h-full rounded-full transition-[width] duration-500" style={{ width: `${((step + 1) / GUIDE_STEPS.length) * 100}%` }} />
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row-reverse">
        {/* The site as it will be built, updated with every answer. */}
        <aside aria-label={t("preview")} className="bg-mist px-5 py-4 lg:sticky lg:top-[74px] lg:h-[calc(100dvh-74px)] lg:flex-[1_1_46%] lg:overflow-auto lg:px-10 lg:py-10">
          <span className="text-muted mb-2 hidden text-[12px] font-semibold tracking-[0.08em] uppercase lg:block">{t("preview")}</span>
          <div className="border-line bg-paper mx-auto w-full max-w-[640px] overflow-hidden rounded-[16px] border shadow-[0_20px_48px_rgba(20,20,20,0.08)]">
            <div className="border-line text-muted flex h-8 items-center gap-2 border-b px-3.5 text-[12px]">
              <span className="size-[8px] rounded-full bg-[#D8D8D4]" />
              <span className="size-[8px] rounded-full bg-[#D8D8D4]" />
              <span className="size-[8px] rounded-full bg-[#D8D8D4]" />
              <span dir="ltr" className="ms-2 truncate">
                {initial.address}
              </span>
            </div>
            <ScaledSite width={1200} height={1500} className="max-lg:max-h-[180px]" label={t("previewOf", { address: initial.address })}>
              <SiteRender site={draft} pageId={previewPage} media={media} projects={cards} social={answers.social} editing />
            </ScaledSite>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-6 px-5 py-8 md:px-10 lg:flex-[1_1_54%] lg:px-14 lg:py-12">
          {name === "what" && <WhatStep answers={answers} setAnswers={setAnswers} />}
          {name === "name" && <NameStep answers={answers} setAnswers={setAnswers} media={media} addMedia={addMedia} />}
          {name === "look" && <LookStep answers={answers} setAnswers={setAnswers} draft={draft} media={media} projects={cards} />}
          {name === "pages" && <GuidePages answers={answers} setAnswers={setAnswers} language={initial.language} />}
          {name === "projects" && (
            <GuideProjects
              answers={answers}
              setAnswers={setAnswers}
              projects={projects}
              setProjects={setProjects}
              media={media}
              addMedia={addMedia}
              limit={initial.projectLimit}
            />
          )}
          {name === "inside" && <GuideInside answers={answers} projects={projects} setProjects={setProjects} addMedia={addMedia} />}
          {name === "pages2" && (
            <GuidePageByPage
              answers={answers}
              setAnswers={setAnswers}
              at={Math.min(pageAt, ownPages.length - 1)}
              setAt={setPageAt}
              draft={draft}
              media={media}
              addMedia={addMedia}
              projects={cards}
            />
          )}
          {name === "build" && (
            <BuildStep answers={answers} projects={projects} rerun={initial.rerun} building={building} onBuild={build} onEdit={go} />
          )}
          {problem && <Problem>{problem}</Problem>}
          {nav}
        </main>
      </div>
    </div>
  );
}

/* ---------- 1. What do you do? ---------- */

type StepProps = { answers: GuideAnswers; setAnswers: (fn: (a: GuideAnswers) => GuideAnswers) => void };

function WhatStep({ answers, setAnswers }: StepProps) {
  const t = useTranslations("guide.what");
  const locale = useLocale() as Locale;
  const d = disciplineById(answers.discipline);
  const [query, setQuery] = useState(d ? disciplineLabel(d, locale) : answers.discipline);
  const found = searchDisciplines(d && query === disciplineLabel(d, locale) ? "" : query);
  // The chosen one stays first, so it's always visible as picked.
  const chips = d ? [d, ...found.filter((c) => c.id !== d.id)].slice(0, found.length || 1) : found;
  return (
    <section className="flex flex-col gap-5">
      <Kicker>{t("kicker")}</Kicker>
      <Question>{t("title")}</Question>
      <p className="text-muted m-0 text-[16px]">{t("hint")}</p>
      <input
        className="border-outline bg-paper focus:border-primary h-[56px] w-full rounded-[16px] border px-[18px] text-[18px] outline-none"
        aria-label={t("label")}
        value={query}
        maxLength={80}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          const exact = searchDisciplines(v, 1)[0];
          const matches = exact && [exact.en, exact.ar].some((l) => l.toLowerCase() === v.trim().toLowerCase());
          setAnswers((a) => ({ ...a, discipline: matches ? exact.id : v.trim() }));
        }}
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("label")}>
        {chips.map((c) => {
          const on = c.id === answers.discipline;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setAnswers((a) => ({ ...a, discipline: c.id }));
                setQuery(disciplineLabel(c, locale));
              }}
              className={cx(
                "rounded-pill h-[38px] px-3.5 text-[14px] font-semibold",
                on ? "bg-secondary-container text-on-secondary-container" : "border-line bg-paper hover:bg-mist border",
              )}
            >
              {disciplineLabel(c, locale)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- 2. Your name on the site ---------- */

const LOGO_FONTS: Array<NonNullable<HeaderSettings["logoFont"]>> = [
  "bricolage",
  "space-grotesk",
  "fraunces",
  "syne",
  "instrument-serif",
  "plex-arabic",
  "marhey",
  "readex",
  "alexandria",
];

function fontStyle(f: NonNullable<HeaderSettings["logoFont"]>) {
  return f in headingFonts
    ? { fontFamily: headingFonts[f as keyof typeof headingFonts].family, fontWeight: headingFonts[f as keyof typeof headingFonts].weight }
    : { fontFamily: arabicFonts[f as keyof typeof arabicFonts].family, fontWeight: 700 };
}

function NameStep({
  answers,
  setAnswers,
  media,
  addMedia,
}: StepProps & { media: Record<string, SiteMedia>; addMedia: (m: Uploaded) => void }) {
  const t = useTranslations("guide.name");
  const tp = useTranslations("projects");
  const logo = answers.logo;
  const setLogo = (patch: Partial<GuideAnswers["logo"]>) => setAnswers((a) => ({ ...a, logo: { ...a.logo, ...patch } }));
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const picture = logo.mediaId ? media[logo.mediaId] : null;
  const src = picture ? imageSources(picture, 400)?.src : null;

  async function upload(file: File) {
    setBusy(true);
    setProblem(null);
    const r = await uploadFile("_library", file);
    setBusy(false);
    if (!r.ok) return setProblem(tp.has(`errors.${r.error}`) ? tp(`errors.${r.error}`, { image: 30, pdf: 50 }) : tp("errors.error"));
    addMedia(r.media);
    setLogo({ mediaId: r.media.id, mode: "image" });
  }

  return (
    <section className="flex flex-col gap-5">
      <Kicker>{t("kicker")}</Kicker>
      <Question>{t("title")}</Question>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("title")}>
        {(["name", "image"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={logo.mode === mode}
            onClick={() => setLogo({ mode })}
            className={cx(
              "flex flex-col items-start gap-3 rounded-[24px] border-2 p-4 text-start",
              logo.mode === mode ? "border-primary bg-secondary-container/40" : "border-line bg-paper hover:bg-mist",
            )}
          >
            <span className="bg-mist flex h-[84px] w-full items-center justify-center overflow-hidden rounded-[16px]">
              {mode === "name" ? (
                <span className="truncate px-3 text-[28px]" style={fontStyle(logo.font ?? "bricolage")}>
                  {logo.name || "Aa"}
                </span>
              ) : src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="max-h-[64px] max-w-[80%] object-contain" />
              ) : (
                <Icon name="upload" size={24} />
              )}
            </span>
            <span className="text-[16px] font-semibold">{t(mode === "name" ? "useName" : "haveLogo")}</span>
            <span className="text-muted text-[13px]">{t(mode === "name" ? "useNameHint" : "haveLogoHint")}</span>
          </button>
        ))}
      </div>

      {logo.mode === "name" ? (
        <>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("nameLabel")}
            <input
              className="border-outline bg-paper focus:border-primary h-[52px] rounded-[16px] border px-4 text-[18px] outline-none"
              value={logo.name}
              maxLength={60}
              onChange={(e) => setLogo({ name: e.target.value })}
              data-testid="guide-name"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">{t("font")}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("font")}>
              {LOGO_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={(logo.font ?? null) === f}
                  aria-label={f in headingFonts ? headingFonts[f as keyof typeof headingFonts].label : arabicFonts[f as keyof typeof arabicFonts].label}
                  onClick={() => setLogo({ font: f })}
                  className={cx(
                    "flex h-[72px] items-center justify-center overflow-hidden rounded-[16px] border-2 px-2",
                    logo.font === f ? "border-primary bg-secondary-container/40" : "border-line bg-paper hover:bg-mist",
                  )}
                >
                  <span className="truncate text-[22px]" style={fontStyle(f)}>
                    {logo.name || "Aa"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={bigButton} onClick={() => input.current?.click()} disabled={busy}>
              <Icon name="upload" size={18} />
              {busy ? t("uploading") : picture ? t("replace") : t("upload")}
            </button>
            <input
              ref={input}
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              aria-label={t("upload")}
              data-testid="guide-logo-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </div>
          {src && (
            // The logo on light and dark, so people can see it works on both.
            <div className="grid grid-cols-2 gap-2">
              {["#FFFFFF", "#141414"].map((bg) => (
                <span key={bg} className="border-line flex h-[90px] items-center justify-center rounded-[16px] border" style={{ background: bg }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="max-h-[56px] max-w-[80%] object-contain" />
                </span>
              ))}
            </div>
          )}
          <p className="text-muted m-0 text-[13px]">{t("logoTip")}</p>
          {problem && <Problem>{problem}</Problem>}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("tagline")}
        <input
          className="border-outline bg-paper focus:border-primary h-[48px] rounded-[16px] border px-4 text-[16px] outline-none"
          value={logo.tagline}
          maxLength={120}
          placeholder={t("taglinePlaceholder")}
          onChange={(e) => setLogo({ tagline: e.target.value })}
        />
      </label>
    </section>
  );
}

/* ---------- 3. The look ---------- */

const ACCENTS = ["#E5432F", "#F28C28", "#E8B931", "#2E9E6A", "#7A4FD6", "#D6457C", "#141414"];

function LookStep({
  answers,
  setAnswers,
  draft,
  media,
  projects,
}: StepProps & { draft: SiteDraft; media: Record<string, SiteMedia>; projects: GalleryProject[] }) {
  const t = useTranslations("guide.look");
  const te = useTranslations("editor.style");
  return (
    <section className="flex flex-col gap-5">
      <Kicker>{t("kicker")}</Kicker>
      <Question>{t("title")}</Question>
      <p className="text-muted m-0 text-[16px]">{t("hint")}</p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3" role="radiogroup" aria-label={t("title")}>
        {presetIds.map((id) => {
          const on = answers.preset === id;
          const theme = { ...themes[id], logoMediaId: draft.theme.logoMediaId };
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAnswers((a) => ({ ...a, preset: id, accent: null }))}
              className={cx(
                "flex flex-col gap-2 overflow-hidden rounded-[20px] border-2 p-1.5 text-start",
                on ? "border-primary" : "border-line hover:border-outline",
              )}
            >
              <span className="block overflow-hidden rounded-[14px]">
                <ScaledSite width={1200} height={760}>
                  <SiteRender site={{ ...draft, theme }} media={media} projects={projects} editing />
                </ScaledSite>
              </span>
              <span className="px-1.5 pb-1 text-[14px] font-semibold">{te(`presetNames.${id}`)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">{t("accent")}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={!answers.accent}
            onClick={() => setAnswers((a) => ({ ...a, accent: null }))}
            className={cx("rounded-pill h-9 px-3 text-[13px] font-semibold", !answers.accent ? "bg-secondary-container" : "border-line border")}
          >
            {t("themeAccent")}
          </button>
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={answers.accent === c}
              onClick={() => setAnswers((a) => ({ ...a, accent: c }))}
              className={cx("size-9 rounded-full border-2", answers.accent === c ? "border-ink" : "border-transparent")}
              style={{ background: c }}
            />
          ))}
          <input
            type="color"
            aria-label={t("accent")}
            value={answers.accent ?? themes[answers.preset].colors.accent}
            onChange={(e) => setAnswers((a) => ({ ...a, accent: e.target.value.toUpperCase() }))}
            className="h-9 w-12 cursor-pointer rounded-[8px] border-0 bg-transparent"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. Review and build ---------- */

function BuildStep({
  answers,
  projects,
  rerun,
  building,
  onBuild,
  onEdit,
}: {
  answers: GuideAnswers;
  projects: GalleryProject[];
  rerun: boolean;
  building: boolean;
  onBuild: () => void;
  onEdit: (step: number) => void;
}) {
  const t = useTranslations("guide.build");
  const tl = useTranslations("editor.style");
  const locale = useLocale() as Locale;
  const d = disciplineById(answers.discipline);
  const pages = tidyPages(answers.pages);
  const rows: Array<[string, ReactNode, number]> = [
    [t("what"), d ? disciplineLabel(d, locale) : answers.discipline, 0],
    [t("name"), answers.logo.mode === "image" ? t("logo") : answers.logo.name, 1],
    [t("look"), tl(`presetNames.${answers.preset}`), 2],
    [
      t("pages"),
      pages.map((p) => (p.parentId ? `↳ ${p.title}` : p.title)).join(" · "),
      3,
    ],
    [t("projects"), projects.filter((p) => answers.projects.some((x) => x.id === p.id)).map((p) => p.title).join(" · ") || "—", 4],
  ];
  return (
    <section className="flex flex-col gap-5">
      <Kicker>{t("kicker")}</Kicker>
      <Question>{t("title")}</Question>
      <ul className="border-line bg-paper m-0 flex list-none flex-col rounded-[24px] border p-0" data-testid="guide-summary">
        {rows.map(([label, value, s]) => (
          <li key={label} className="border-line flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
            <span className="text-muted w-[110px] flex-none text-[13px] font-semibold">{label}</span>
            <span className="min-w-0 flex-1 text-[15px] break-words">{value}</span>
            <button type="button" className="text-primary text-[13px] font-semibold hover:underline" onClick={() => onEdit(s)}>
              {t("change")}
            </button>
          </li>
        ))}
      </ul>
      {rerun && (
        <p className="bg-secondary-container/60 m-0 flex items-start gap-2 rounded-[16px] p-3.5 text-[14px]" data-testid="guide-rerun">
          <Icon name="help" size={18} />
          {t("rerun")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={cx(bigButton, "h-[60px] px-9 text-[18px]")} onClick={onBuild} disabled={building} data-testid="guide-build">
          {building ? t("building") : t("button")}
        </button>
        <span className="text-muted text-[13px]">{t("after")}</span>
      </div>
    </section>
  );
}
