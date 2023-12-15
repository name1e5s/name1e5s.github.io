import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import getSortedPosts from "@utils/getSortedPosts";
import slugify from "@utils/slugify";
import { SITE } from "@config";

export async function GET() {
  const posts = await getCollection("blog");
  const sortedPosts = getSortedPosts(posts);
  return rss({
    title: SITE.title,
    description: SITE.desc,
    site: SITE.website,
    items: sortedPosts.map((p) => (
      {
      link: `posts/${slugify(p)}`,
      title: p.data.title,
      description: p.data.description,
      pubDate: new Date(p.data.pubDatetime),
    })),
  });
}
