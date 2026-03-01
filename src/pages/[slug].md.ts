import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { isIndexablePage } from "../lib/pages";

export async function getStaticPaths() {
  const pages = (await getCollection("pages")).filter(isIndexablePage);

  return pages.map((page) => ({
    params: { slug: page.id },
    props: {
      title: page.data.title,
      body: page.body,
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
