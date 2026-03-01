import type { CollectionEntry } from "astro:content";

export type PageEntry = CollectionEntry<"pages">;

const EXCLUDED_PAGE_IDS = new Set(["404"]);

function normalizePageId(pageId: string): string {
  return pageId.replace(/^\/+|\/+$/g, "");
}

export function isIndexablePage(page: Pick<PageEntry, "id">): boolean {
  return !EXCLUDED_PAGE_IDS.has(page.id);
}

export function getPagePath(pageId: string): string {
  const normalized = normalizePageId(pageId);
  if (!normalized) {
    throw new Error(`Could not generate page path for page id: ${pageId}`);
  }

  return `/${normalized}/`;
}

export function getPageMarkdownPath(pageId: string): string {
  const normalized = normalizePageId(pageId);
  if (!normalized) {
    throw new Error(`Could not generate page markdown path for page id: ${pageId}`);
  }

  return `/${normalized}.md`;
}
