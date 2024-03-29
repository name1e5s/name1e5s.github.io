---
title: 详解并查集（基础篇）
description: 对于并查集这一数据结构的基础介绍。
pubDatetime: 2018-04-04T19:20:53
tags:
    - C
---

## 简介

并查集是一种树型的数据结构，用于处理一些不相交集（Disjoint Sets）的合并及查询问题。不相交集，顾名思义，就是交集为空集的一些集合。比如集合 {1,3,5} 和集合 {2,4,6} 就是不相交集。 {2,3,5} 和 {1,3,5} 就不是，因为他们的交集不是空集。该数据结构由Bernard A. Galler和Michael J. Fischer于1964年提出。

对于并查集，主要有如下操作：

1. 合并两个集合（“并”）

2. 判断两个元素是否属于同一个集合。（“查”）

<!--more-->

为了能更好地理解这个数据结构，我们不妨看一下一个文风看起来就很古老的故事(来自[这里](https://blog.csdn.net/niushuai666/article/details/6662911))：

> 话说江湖上散落着各式各样的大侠，有上千个之多。他们没有什么正当职业，整天背着剑在外面走来走去，碰到和自己不是一路人的，就免不了要打一架。但大侠们有一个优点就是讲义气，绝对不打自己的朋友。而且他们信奉“朋友的朋友就是我的朋友”，只要是能通过朋友关系串联起来的，不管拐了多少个弯，都认为是自己人。这样一来，江湖上就形成了一个一个的群落，通过两两之间的朋友关系串联起来。而不在同一个群落的人，无论如何都无法通过朋友关系连起来，于是就可以放心往死了打。但是两个原本互不相识的人，如何判断是否属于一个朋友圈呢？

> 我们可以在每个朋友圈内推举出一个比较有名望的人，作为该圈子的代表人物，这样，每个圈子就可以这样命名“齐达内朋友之队”“罗纳尔多朋友之队”……两人只要互相对一下自己的队长是不是同一个人，就可以确定敌友关系了。

> 但是还有问题啊，大侠们只知道自己直接的朋友是谁，很多人压根就不认识队长，要判断自己的队长是谁，只能漫无目的的通过朋友的朋友关系问下去：“你是不是队长？你是不是队长？”这样一来，队长面子上挂不住了，而且效率太低，还有可能陷入无限循环中。于是队长下令，重新组队。队内所有人实行分等级制度，形成树状结构，我队长就是根节点，下面分别是二级队员、三级队员。每个人只要记住自己的上级是谁就行了。遇到判断敌友的时候，只要一层层向上问，直到最高层，就可以在短时间内确定队长是谁了。由于我们关心的只是两个人之间是否连通，至于他们是如何连通的，以及每个圈子内部的结构是怎样的，甚至队长是谁，并不重要。所以我们可以放任队长随意重新组队，只要不搞错敌友关系就好了。于是，门派产生了。

> ![](https://coding.net/u/name1e5s/p/pic/git/raw/master/0_1311901712oy9f.gif)

> 假设现在武林中的形势如图所示。虚竹小和尚与周芷若MM是我非常喜欢的两个人物，他们的终极boss分别是玄慈方丈和灭绝师太，那明显就是两个阵营了。我不希望他们互相打架，就对他俩说：“你们两位拉拉勾，做好朋友吧。”他们看在我的面子上，同意了。这一同意可非同小可，整个少林和峨眉派的人就不能打架了。这么重大的变化，可如何实现呀，要改动多少地方？其实非常简单，我对玄慈方丈说：“大师，麻烦你把你的上级改为灭绝师太吧。这样一来，两派原先的所有人员的终极boss都是师太，那还打个球啊！反正我们关心的只是连通性，门派内部的结构不要紧的。”玄慈一听肯定火大了：“我靠，凭什么是我变成她手下呀，怎么不反过来？我抗议！”抗议无效，上天安排的，最大。反正谁加入谁效果是一样的，我就随手指定了一个。


对于并查集还有两种优化：路径压缩和按秩合并

我们继续看上文的故事，对于武林啊，使用路径压缩大致就是相当于这样（依旧来自[这里](https://blog.csdn.net/niushuai666/article/details/6662911)）：

> 建立门派的过程是两个人两个人地连接起来的，谁当谁的手下完全随机。最后的树状结构会变成什么胎唇样，我也完全无法预计，一字长蛇阵也有可能。这样查找的效率就会比较低下。最理想的情况就是所有人的直接上级都是掌门，一共就两级结构，只要找一次就找到掌门了。哪怕不能完全做到，也最好尽量接近。这样就产生了路径压缩算法。 设想这样一个场景：两个互不相识的大侠碰面了，想知道能不能揍。 于是赶紧打电话问自己的上级：“你是不是掌门？” 上级说：“我不是呀，我的上级是谁谁谁，你问问他看看。” 一路问下去，原来两人的最终boss都是东厂曹公公。 “哎呀呀，原来是记己人，西礼西礼，在下三营六组白面葫芦娃!” “幸会幸会，在下九营十八组仙子狗尾巴花！” 两人高高兴兴地手拉手喝酒去了。 “等等等等，两位同学请留步，还有事情没完成呢！”我叫住他俩。 “哦，对了，还要做路径压缩。”两人醒悟。 白面葫芦娃打电话给他的上级六组长：“组长啊，我查过了，其习偶们的掌门是曹公公。不如偶们一起及接拜在曹公公手下吧，省得级别太低，以后查找掌门麻环。” “唔，有道理。” 白面葫芦娃接着打电话给刚才拜访过的三营长……仙子狗尾巴花也做了同样的事情。 这样，查询中所有涉及到的人物都聚集在曹公公的直接领导下。每次查询都做了优化处理，所以整个门派树的层数都会维持在比较低的水平上。

而按秩合并，就是（本段由笔者自己瞎编）：

> ...（合并那部分）玄慈一听肯定火大了：“我靠，凭什么是我变成她手下呀，怎么不反过来？我抗议！”我一听这不行啊，万一他要一发火把我顺便削了可不好完，于是我就想了个比较公平的合并方法。和他说：“要不这样吧，你们俩比一比谁手下的人层数少，层数少的那个就变成层数多的那个的下级，你看怎样呀？”玄慈听了觉着还行，就按照我说的做了。

## C 语言实现

在这里，我们使用两个数组来实现带路径压缩和按秩合并策略的并查集合。因此，我们需要使用的声明如下：

```c
int disjoint[1024];
int rank[1024];
```

首先，我们需要一个建立并查集的函数，在此不再说明：

```c
void make_set(void) {
    for(int i = 0; i < 1024; i ++) {
        disjoint[i] = i;
        rank[i] = 0;
    }
}
```

之后就是查找函数（无路径压缩），按照上面的小故事，我们很容易就能写出这个函数：

```c
int find_set(int x) {
    int temp = x;

    while(disjoint[x] != x)
        x = disjoint[x]; // 一路向上寻找上级

    return x;
}
```

加上路径压缩后，代码如下：

```c
int find_set(int x) {
    if(x != disjoint[x])
         disjoint[x] = find_set(disjoint[x]);
     return disjoint[x];
}
```

你甚至能写到一行里：

```c
int find_set(int x){
        return x==disjoint[x]?x:disjoint[x]=find_set(disjoint[x]);
}
```

普通的合并算法：

```c
void union_set(int x,int y)
{
    fx = find_set(x);
    fy = find_set(y);
    if(fy!=fx) // 如果大 BOSS 不一样，就随便合并
       father[fx]=fy;
}
```

按秩（Rank）合并：

```c
void union_set(int x, int y)
{   x = find_set(x);
    y = find_set(y);
    
    if(rank[x] > rank[y])
        disjoint[y] = x;
    else 
    {
        disjoint[x] = y;
        if(rank[x] == rank[y])
            rank[y]++;
    }
}
```

## 附加资料

[这里](https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/6-046j-design-and-analysis-of-algorithms-spring-2012/lecture-notes/MIT6_046JS12_lec16.pdf) 有关于并查集的比较详尽的介绍

[这里](https://visualgo.net/zh/ufds)是该数据结构的可视化。

## 练习

[HDU 1232](http://acm.hdu.edu.cn/showproblem.php?pid=1232)

[POJ 1611](http://poj.org/problem?id=1611)

[POJ 2542](http://poj.org/problem?id=2542)

[PAT-A 1013](https://www.patest.cn/contests/pat-a-practise/1013)