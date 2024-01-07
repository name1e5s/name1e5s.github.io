import type { Site, SocialObjects, Fonts } from "./types";

export const SITE: Site = {
  website: "https://blog.hai-hs.in/", // replace this with your deployed domain
  author: "Hai-hsin",
  desc: "分け入っても分け入っても青い山",
  title: "🐟",
  ogImage: "forrest-gump-quote.jpg",
  lightAndDarkMode: true,
  postPerPage: 5,
};

export const LOCALE = ["zh-CN"]; // set to [] to use the environment default
export const FIRST_LOCALE = LOCALE[0];

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/name1e5s",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:me@hai-hs.in",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "Twitter",
    href: "https://twitter.com/name1e5s1",
    linkTitle: `${SITE.title} on Twitter`,
    active: true,
  },
];

export const LOAD_FONTS: Fonts = [
  {
    name: "MiSans",
    url: "https://cdn-font.hyperos.mi.com/font/css?family=MiSans:100,200,300,400,450,500,600,650,700,900:Chinese_Simplify,Latin&display=swap",
  },
  {
    name: "IBM Plex Mono",
    url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap",
  },
];

export const FONT_MONO = ["IBM Plex Mono", "monospace"];
export const FONT_SANS = ["MiSans", "sans-serif"];
