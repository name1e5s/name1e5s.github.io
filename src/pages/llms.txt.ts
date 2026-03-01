import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "../config";
import { getPostMarkdownPath, sortPosts } from "../lib/blog";
import { getPageMarkdownPath, isIndexablePage } from "../lib/pages";

function toAbsoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}

export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection("blog"));
  const pages = (await getCollection("pages"))
    .filter(isIndexablePage)
    .sort((a, b) => a.id.localeCompare(b.id, "en", { sensitivity: "base" }));

  const contactLines = [
    ["mail", SITE.mail],
    ["x", SITE.x],
    ["github", SITE.github],
  ]
    .filter(([, url]) => Boolean(url))
    .map(([label, url]) => `- [${label}](${url})`);

  const linkLines = [
    `* [blog](${toAbsoluteUrl("/llms.txt")})`,
    ...pages.map((page) => `* [${page.id}](${toAbsoluteUrl(getPageMarkdownPath(page.id))})`),
  ];

  const postLines = posts.map((post) => {
    const description = post.data.description?.trim() || post.data.title;
    return `* [${post.data.title}](${toAbsoluteUrl(getPostMarkdownPath(post.id))}): ${description}`;
  });

  const content = [
    `# ${SITE.title}`,
    "",
    `> ${SITE.subtitle}`,
    "",
    "## contact",
    "",
    ...contactLines,
    "",
    "## links",
    "",
    ...linkLines,
    "",
    "## blog",
    "",
    ...postLines,
    "",
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
