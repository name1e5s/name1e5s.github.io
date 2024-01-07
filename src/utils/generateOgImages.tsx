import satori, { type SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";
import { type CollectionEntry } from "astro:content";
import postOgImage from "./og-templates/post";
import siteOgImage from "./og-templates/site";

const fetchFonts = async () => {
  // Regular Font
  const fontFileRegular = await fetch(
    "https://github.com/name1e5s/name1e5s.github.io/releases/download/misans/MiSans-Regular.woff"
  );
  const fontRegular: ArrayBuffer = await fontFileRegular.arrayBuffer();

  // Bold Font
  const fontFileBold = await fetch(
    "https://github.com/name1e5s/name1e5s.github.io/releases/download/misans/MiSans-Demibold.woff"
  );
  const fontBold: ArrayBuffer = await fontFileBold.arrayBuffer();

  return { fontRegular, fontBold };
};

const { fontRegular, fontBold } = await fetchFonts();

const options: SatoriOptions = {
  width: 1200,
  height: 630,
  embedFont: true,
  fonts: [
    {
      name: "MiSans",
      data: fontRegular,
      weight: 400,
      style: "normal",
    },
    {
      name: "MiSans",
      data: fontBold,
      weight: 600,
      style: "normal",
    },
  ],
};

export async function generateOgImageForPost(post: CollectionEntry<"blog">) {
  const svg = await satori(postOgImage(post), options);
  return svg;
}

export async function generateOgImageForSite() {
  const svg = await satori(siteOgImage(), options);
  return svg;
}
