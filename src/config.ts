import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://blog.hai-hs.in/", // replace this with your deployed domain
  author: "Hai-hsin",
  desc: "分け入っても分け入っても青い山",
  title: "🐟",
  ogImage: "assets/forrest-gump-quote.webp",
  lightAndDarkMode: true,
  postPerPage: 5,
};

export const LOCALE = ["zh-CN"]; // set to [] to use the environment default

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
