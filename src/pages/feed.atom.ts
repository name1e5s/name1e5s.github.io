import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { buildAtomFeed } from "../lib/feed";
import { sortPosts } from "../lib/blog";

export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection("blog")).slice(0, 10);
  const xml = buildAtomFeed({ posts, feedPath: "/feed.atom" });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
