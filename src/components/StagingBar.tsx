import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

// Only on local and staging, where there's one address for all three surfaces.
// Plain <a> links on purpose: the switch happens in the proxy, before Next renders anything.
export async function StagingBar() {
  const h = await headers();
  if (h.get("x-fannan-switcher") !== "1") return null;
  const current = h.get("x-fannan-surface") ?? "marketing";
  const t = await getTranslations("staging");

  const links = [
    { to: "marketing", label: t("marketing") },
    { to: "app", label: t("app") },
    { to: "site:ahmed", label: t("site") },
  ];

  return (
    <nav
      aria-label={t("label")}
      className="border-line bg-mist flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[12px]"
    >
      <span className="bg-ink rounded-sm px-2 py-0.5 font-semibold text-white">{t("label")}</span>
      {links.map((l) => (
        <a
          key={l.to}
          href={`/__surface?to=${encodeURIComponent(l.to)}`}
          dir="ltr"
          aria-current={current === l.to ? "true" : undefined}
          className={
            current === l.to
              ? "rounded-pill bg-ink px-2.5 py-0.5 font-semibold text-white"
              : "rounded-pill border-line bg-paper border px-2.5 py-0.5 font-semibold hover:bg-white"
          }
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}
