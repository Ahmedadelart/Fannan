import type { PageDraft } from "./types";

/** Menu items that are not pages of their own: outside links, dropdowns and projects. */
export const hasOwnPage = (p: Pick<PageDraft, "type">) => p.type !== "link" && p.type !== "folder" && p.type !== "project";
