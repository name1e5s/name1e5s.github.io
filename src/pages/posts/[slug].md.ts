import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { buildSlugIndex, sortPosts } from "../../lib/blog";

export async function getStaticPaths() {
  const posts = sortPosts(await getCollection("blog"));
  const slugIndex = buildSlugIndex(posts);

  return Array.from(slugIndex.entries()).map(([slug, post]) => ({
    params: { slug },
    props: {
      title: post.data.title,
      body: post.body,
    },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const title = props.title as string;
  const body = (props.body as string).trim();
  const markdown = `# ${title}\n\n${body}\n`;

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
