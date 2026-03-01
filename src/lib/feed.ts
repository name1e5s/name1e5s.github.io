import type { CollectionEntry } from "astro:content";
import { SITE } from "../config";
import { getPostDate, getPostPath } from "./blog";

export type PostEntry = CollectionEntry<"blog">;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(value: Date): string {
  return new Date(value).toISOString();
}

function rssDate(value: Date): string {
  return new Date(value).toUTCString();
}

function postUrl(post: PostEntry): string {
  return new URL(getPostPath(post.id), SITE.url).toString();
}

function postSummary(post: PostEntry): string {
  return post.data.description ?? post.data.title;
}

function latestPostDate(posts: PostEntry[]): Date {
  return posts.length > 0 ? getPostDate(posts[0]) : new Date();
}

export function buildAtomFeed(options: {
  posts: PostEntry[];
  feedPath: string;
  title?: string;
  subtitle?: string;
}): string {
  const { posts, feedPath, title = SITE.title, subtitle = SITE.subtitle } = options;
  const updated = latestPostDate(posts);
  const feedUrl = new URL(feedPath, SITE.url).toString();

  const entries = posts
    .map((post) => {
      const url = postUrl(post);
      const published = isoDate(getPostDate(post));
      const content = escapeXml(postSummary(post));
      return `  <entry>\n    <id>${url}</id>\n    <title>${escapeXml(post.data.title)}</title>\n    <link href="${url}" />\n    <published>${published}</published>\n    <updated>${published}</updated>\n    <author>\n      <name>${escapeXml(SITE.author)}</name>\n    </author>\n    <content type="html">${content}</content>\n  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <id>${feedUrl}</id>\n  <title>${escapeXml(title)}</title>\n  <link href="${SITE.url}" />\n  <link href="${feedUrl}" rel="self" />\n  <description>${escapeXml(subtitle)}</description>\n  <language>en</language>\n  <updated>${isoDate(updated)}</updated>\n  <author>\n    <name>${escapeXml(SITE.author)}</name>\n  </author>\n${entries}\n</feed>\n`;
}

export function buildRssFeed(options: {
  posts: PostEntry[];
  title?: string;
  subtitle?: string;
}): string {
  const { posts, title = SITE.title, subtitle = SITE.subtitle } = options;
  const lastBuildDate = rssDate(latestPostDate(posts));

  const items = posts
    .map((post) => {
      const url = postUrl(post);
      return `    <item>\n      <title>${escapeXml(post.data.title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${rssDate(getPostDate(post))}</pubDate>\n      <description><![CDATA[${postSummary(post)}]]></description>\n    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0">\n  <channel>\n    <title>${escapeXml(title)}</title>\n    <link>${SITE.url}</link>\n    <description>${escapeXml(subtitle)}</description>\n    <language>en</language>\n    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n${items}\n  </channel>\n</rss>\n`;
}
