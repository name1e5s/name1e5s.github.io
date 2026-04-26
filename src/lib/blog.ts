import type { CollectionEntry } from "astro:content";

export type PostEntry = CollectionEntry<"blog">;
export type LlmTag = PostEntry["data"]["llmTag"];

const FILE_DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})-/;
const LLM_TAG_EMOJI: Record<LlmTag, string> = {
  "hand-written": "✍️",
  "llm-assisted": "🪄",
  "llm-driven": "🤖",
};

function getBaseName(postId: string): string {
  const parts = postId.split("/");
  return parts[parts.length - 1] ?? postId;
}

function parseDateFromId(postId: string): Date | null {
  const baseName = getBaseName(postId);
  const match = FILE_DATE_RE.exec(baseName);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return date;
}

export function getPostDate(post: PostEntry): Date {
  if (post.data.pubDatetime && !Number.isNaN(post.data.pubDatetime.valueOf())) {
    return post.data.pubDatetime;
  }

  return parseDateFromId(post.id) ?? new Date(0);
}

export function toPostSlug(postId: string): string {
  const baseName = getBaseName(postId);
  const slug = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();

  if (!slug) {
    throw new Error(`Could not generate slug for post id: ${postId}`);
  }

  return slug;
}

export function buildSlugIndex(posts: PostEntry[]): Map<string, PostEntry> {
  const index = new Map<string, PostEntry>();

  for (const post of posts) {
    const slug = toPostSlug(post.id);
    const existing = index.get(slug);
    if (existing) {
      throw new Error(`Slug collision for "${slug}": "${existing.id}" and "${post.id}"`);
    }
    index.set(slug, post);
  }

  return index;
}

export function getPostPath(postId: string): string {
  return `/posts/${toPostSlug(postId)}/`;
}

export function getPostMarkdownPath(postId: string): string {
  return `/posts/${toPostSlug(postId)}.md`;
}

export function getLlmTagEmoji(llmTag: LlmTag): string {
  return LLM_TAG_EMOJI[llmTag];
}

export function sortPosts(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => getPostDate(b).valueOf() - getPostDate(a).valueOf());
}

export function getTagMap(posts: PostEntry[]): Map<string, PostEntry[]> {
  const map = new Map<string, PostEntry[]>();

  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      if (!map.has(tag)) {
        map.set(tag, []);
      }
      map.get(tag)!.push(post);
    }
  }

  return map;
}

export function getTagCloud(posts: PostEntry[], limit = 50): Array<{ name: string; count: number; size: number }> {
  const tags = Array.from(getTagMap(posts).entries()).map(([name, entries]) => {
    const count = entries.length;
    return {
      name,
      count,
      size: 100 + Math.log(count || 1) * 20,
    };
  });

  tags.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const sliced = limit ? tags.slice(0, limit) : tags;
  return sliced.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export function sortPostsByTitle(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => a.data.title.localeCompare(b.data.title, "en", { sensitivity: "base" }));
}

export function sortPostsByDate(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => getPostDate(b).valueOf() - getPostDate(a).valueOf());
}
