---
title: 新主题与 llms.txt
description: 博客主题更新，新增 llms.txt 支持
pubDatetime: 2026-03-01T22:00:00
tags:
  - 杂谈
---

上一次更新博客主题还是在 23 年年底校招尘埃落定之后，当时觉得 AstroPaper 这个主题看起来很炫酷，就尝试了一下。毕竟我也不是专业前端，还记得当时给博客添加了随浏览器切换日间/夜间主题的功能，把字体替换成 MiSans，还有集成 Giscus 评论系统，实现这些功能都费了不少力气。但开始工作之后其实也没更新多少内容，多少有点辜负了当时大干一番的热情。

如今两年过去了，不管是当时 Astro 使用的版本依赖，还是业界对编程这一行的预期，都有了翻天覆地的变化。LLM 和 Agent 在最近一段时间大兴其道，尤其是 25 年 12 月以来，以 Opus 4.5 和 GPT-5.2 Codex 的发布为标志，逐渐有人发现新的高端模型不止可以写写 Demo，在真实世界的大规模代码上也能广泛且正确地应用，编程似乎真的被视为是一种 "Solved Problem" 了。随之而来的就是所有人被各种劲爆的 LLM 新闻刷屏，然后狠狠 FOMO。(Mis)Anthropic 甚至在招聘页面写道：12 个月内 SWE 可能不复存在。正如那谁在 57 年写的，「事情正在起变化」，但又如那谁在晚年说过的，「你们怎么办？只有天知道」。

但在工程师被替代之前，还是可以吃一波自动化红利的。周末觉得 Open Claw 全 Vibe 的  💩 山代码质量太差，动不动就搞 breaking change，且 2C2G 的廉价机器经常 OOM（TS 魅力时刻属于），在研究那些 claw 类工具，打算给自己 vibe 一个 agent，在监工 Codex 规划实现路线时就在想：LLM 直接解析那些给人看的 HTML 文件多少有点浪费 Token，大模型又不会像人一样用眼睛看那些花花绿绿的界面元素，直接给它一个纯文本的版本不就好了么？然后我就重新发现了 [llms.txt](https://llmstxt.org/)，并打算在博客里也放一个。在实现之前，打算顺便把博客主题也重新 Vibe 一把。

`llms.txt` 怎么实现？都什么年代了还古法编程，直接让 AI 写：

```markdown
为当前目录实现 `llms.txt` 功能。需求包括：

1. 针对所有源代码为 md 格式的 posts 和 pages，在生成的 html 之外，额外保留一份 md 格式的原始内容。（posts 已实现）
2. 在网站根目录生成 `llms.txt` 文件，其内容可以视为 md 格式的网站内容索引，供 LLMs 使用。该文件应包含所有 posts 和 pages 的 md 链接。

llms.txt 的内容格式示例：

===
# <Title>

> <subtitle>

## contact

- [mail](mailto:xxx)
- [x](xxx)
- [github](xxx)

## links

* [blog](https://blog.hai-hs.in/llms.txt)
* [projects](https://blog.hai-hs.in/projects.md)
* [about](https://blog.hai-hs.in/about.md)

## blog 

* [FastHTML: A Python Library for Server-Rendered Hypermedia Applications](https://blog.hai-hs.in/posts/fasthtml.md): Some description about this post.
* [Another Post Title](https://blog.hai-hs.in/posts/another-post.md): Some description about this post.
... and so on for all posts.
===
```

然后等待完成即可。现在可以通过 https://blog.hai-hs.in/llms.txt 来访问。
