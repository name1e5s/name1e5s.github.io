import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { sortPosts } from "../lib/blog";
import { buildRssFeed } from "../lib/feed";

export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection("blog")).slice(0, 10);
  const xml = buildRssFeed({ posts });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
