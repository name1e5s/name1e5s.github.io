import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "../../../config";
import { getTagMap, sortPosts, sortPostsByDate } from "../../../lib/blog";
import { buildRssFeed } from "../../../lib/feed";

export async function getStaticPaths() {
  const posts = sortPosts(await getCollection("blog"));
  const tags = getTagMap(posts);

  return Array.from(tags.keys()).map((tag) => ({
    params: { tag },
    props: { tagName: tag },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const tagName = props.tagName as string;
  const posts = sortPosts(await getCollection("blog"));
  const tags = getTagMap(posts);
  const tagPosts = sortPostsByDate(tags.get(tagName) ?? []).slice(0, 10);

  const xml = buildRssFeed({
    posts: tagPosts,
    title: `${SITE.title} - ${tagName}`,
    subtitle: `Recent blog posts tagged with '${tagName}'`,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
