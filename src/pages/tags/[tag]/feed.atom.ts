import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getTagMap, sortPosts, sortPostsByDate } from "../../../lib/blog";
import { buildAtomFeed } from "../../../lib/feed";
import { SITE } from "../../../config";

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

  const xml = buildAtomFeed({
    posts: tagPosts,
    feedPath: `/tags/${encodeURIComponent(tagName)}/feed.atom`,
    title: `${SITE.title} - ${tagName}`,
    subtitle: `Recent blog posts tagged with '${tagName}'`,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
