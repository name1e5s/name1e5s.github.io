---
title: Serverless性能优化挑战赛参赛总结
description: 如何恰到索尼耳机的。
pubDatetime: 2023-08-23T21:04:58+08:00
tags:
    - Rust
---

## Table of contents

## 前言

今年在阿里云举办的实习生见面会上，了解到了内部专为实习生举办的 Hackthon，于是便出于磨练自己技术的想法<del>和受到了丰厚奖品的诱惑</del>，报名了这场比赛。比赛一共分两个赛道，分别是

- 赛道一：AIGC 创意挑战赛，要求参赛者基于阿里云的 AI 能力，结合自己的创意来生成图片。

- 赛道二：Serverless 性能优化挑战赛，要求选手综合考虑资源成本和应用冷启动时间，设计 Serverless 调度器，降低资源成本的同时，提高资源的有效利用率。

看了下赛题介绍，再想到我这么多年来都没有过搞 AI 的经验，同时更是没有什么艺术细菌，显然这赛道一是与我无缘了，于是便选择了赛道二，来做性能优化。最终花了那么几周的时间，拿到了一个还算不错的成绩。

## 赛题介绍

我们先看FaaS 函数的生命周期，如下图所示：
![FaaS 函数的生命周期](https://tianchi-public.oss-cn-hangzhou.aliyuncs.com/public/files/forum/168619184986788101686191849020.png)

可以看到，主要有三个阶段：

- 冷启动：创建 FaaS 函数对应的 Pod 容器
- 初始化：初始化 FaaS 函数的运行环境
- 执行：执行 FaaS 函数的业务逻辑

其中，冷启动部分我们是不能够对用户收费的，用户在没有使用到 FaaS 函数的时间里也是不能收费的，这部分就是纯纯的成本。我们的目标就是设计一个调度算法，尽可能的减少这两部分成本时间，在降低资源成本的同时，提高资源的有效利用率。

主办方为我们提供了 Go 和 Java 的[模版](https://github.com/AliyunContainerService/scaler)，我们需要在这两个模版的基础上，实现我们的调度算法。

## Rewrite It in Rust!

拿到赛题，看了主办方的模版后，我感觉不管是用 Go 还是 Java 来做这个调度算法，都不够那么灵动，缺少一点「噼咔」的感觉。再加上我个人<del>在亚洲最大的 Rust 研发团队里</del>有过那么一年半 Rust 的研发经验，于是便开始调研用 Rust 来完成整个比赛的可行性。

从模版的代码来看，Scaler 这个东西对外只是提供一个 GRPC 的服务，这就稳了，Rust 的 GRPC 库 `tonic` 使用还是相对广泛的，而且 GRPC 也不用担心有什么大小端等问题。最后看了下官方测试时使用的镜像内部的文件，一看符号就知道，他们也是用 `tonic` 来做的评测程序，更加实锤了使用 Rust 来解题非常可行。很快啊，我就把 `idl` 文件搬了过来，并且用 `tonic-build` 安排上了代码的架子。

### 基础不牢，地动山摇

我们的 `Scaler` 不止要对外提供服务，同时还需要调用外部的一个 GRPC 服务来创建 Slot 以及销毁 Slot。这种涉及网络的调用有着一定的失败率，因此我们需要在调用这些服务时，做好容错机制，否则可能因为下游服务的错误拉高我们的错误率，最终导致成功率不够，分数归零。最简单的容错就是多重试几次，这里直接搞一个泛型函数来重试请求😋。

```rust
async fn run_with_retry<'a, 'b, F, G, Fut, Req, Resp>(
    &'a self,
    f: F,
    retry: G,
    req: Req,
) -> TonicResult<Resp>
where
    'b: 'a,
    F: Fn(&'a Platform, Req) -> Fut,
    G: Fn(&Resp) -> bool,
    Fut: Future<Output = TonicResult<Resp>> + 'b,
    Req: Clone,
{
    let mut count = 0;
    loop {
        let resp = f(self, req.clone()).await?;
        if count < 3 && retry(resp.get_ref()) {
            count += 1;
            continue;
        } else {
            return Ok(resp);
        }
    }
}
```

在这之后，把 Platform 服务提供的几个接口都套上我们的 `run_with_retry`，这样就可以尽量保证调用时的容错。

### 总体架构

![](https://raw.githubusercontent.com/name1e5s/article/master/Serverless/%E2%80%8EServerless.%E2%80%8E006.png)

总体框架如上图，我们实现了一个分层的架构，一共分为三层。

- Server 层：做错误转换，主要是把 `anyhow::Error` 转换成 `tonic` 的报错，这样我们在上面几层的代码中就可以尽情使用 `?` 符号来做错误的转发了。

- Schedule 层：做总体的调度策略，同时从 `tonic` 生成的结构体中提取参数，方便下一层传参数。

- Cell 层：针对单个实例的调度策略，就是确定什么时候创建/销毁 Slot 的逻辑。

层与层之间通过 `trait` 约定接口，方便做实现的替换。

## 调度策略

调度策略历经多次更新迭代，从最初的直接分配/释放，到池化，再到玄学的动态释放算法，最后返璞归真到摆烂式预分配算法，在算法更新换代的同时，也见证了其余参赛同学逐渐把得奖分数卷到水涨船高的过程。下面一一介绍我们在比赛中尝试实现过的策略。

### v0.1 - 直接分配/释放

这个是最简单的策略，也就是，让调度器在每次请求到来时，直接分配一个 Slot，然后在请求结束时，直接释放这个 Slot。这个策略的优点是实现简单，缺点是没有任何优化，每次请求都需要冷启动，这样的话，我们的成本就是每次请求的冷启动时间，相当的高。实际上我们也没有期望这个版本会有多少成绩，仅仅是为了验证我们的架构是否可行。

### v1.0 - 池化/垃圾回收

对于这种资源调度问题，最常见的解法就是弄一个资源池，之后做动态的资源获取/回收。放眼整个计算机领域，无论是线程池、连接池乃至于弹性计算业务，都是这个思路下的产物。

在使用资源池时，资源的请求操作等同于从池子中拿一个资源给用户，如果池子中没有资源的话就再去创建一个新的。而资源的释放操作等同于把资源放回池子中，这样其他用户就可以继续使用这个资源了。对应到代码就是如下逻辑：

```rust
impl Cell for NaiveCell {
    async fn assign(
        self: Arc<Self>, request_id: String, _: u64
    ) -> Result<model::Assignment> {
        let slot = self.clone().get_or_create_free_slot().await?;
        let instance_id = slot.slot.instance_id.clone();
        self.occupied_slots.insert(request_id.clone(), slot);
        Ok(model::Assignment { ... })
    }
    async fn idle(
        self: Arc<Self>, assignment: model::Assignment, idle_reason: model::IdleReason,
    ) -> Result<()> {
        let slot = { ... }; // Get slot by id
        if idle_reason.need_destroy {
            self.destroy_slot(&slot).await
        } else {
            self.put_free_slot_fresh(slot);
            Ok(())
        }
    }
}
```

官方模版中实现的其实也是类似的算法。但是我们 Rust 有着非常先进的异步任务抽象 `Future`，可以做一些其他语言三言两语很难实现的优化，比如：在创建资源的同时，等待资源池中返回资源，如果返回了就立刻返回池子中的资源。这样可以加速资源的分配，减少用户等待的时间，非常的方便。

```rust
async fn get_or_create_free_slot(self: Arc<Self>) -> Result<SlotInfo> {
    if let Some(slot) = self.try_get_free_slot() {
        return Ok(slot);
    }

    if let Some(slot) = timeout(ONE_SEC, self.wait_for_free_slot()).await.ok().flatten() {
        return Ok(slot);
    }

    match select(self.wait_for_free_slot(), self.create_free_slot()).await {
        Either::Left((slot, fut)) => {
            if let Some(slot) = slot {
                self.create_slot_in_background(fut);
                return Ok(slot);
            }
            fut.await
        }
        Either::Right((slot, _)) => slot,
    }
}
```

仅靠着这样的优化，我们的成绩就可以比官方模版高出一些了。但是能注意到，数据集 3 的成绩还是不够理想，因此，我们开始尝试探索新的调度策略。

### v1.5 - 动态 GC 释放时间

![](https://raw.githubusercontent.com/name1e5s/article/master/Serverless/%E2%80%8EServerless.%E2%80%8E014.png)

「函数生而**不**平等」，很快我们就注意到了，各个实例之间的分布频率不同，资源占用程度也不同。但是我们的调度算法却将其一视同仁，统一按照一个超时时间去释放实例。这样就导致，一旦出现了一个资源占用很严重，但是使用频率不够高的实例，就会疯狂拉低我们的分数。基于这一朴素的想法，我们引入了动态超时时间的调度，一共有两条规则。

1. 实例占用的内存越大，对应的超时时间就越短
2. 实例的使用频率越高，对应的超时时间就越长

核心函数如下：

```rust
fn update_memory_limit(&self, hint: i64) {
    let current = self.memory_limit.load(Ordering::SeqCst);
    let limit_base = OUTDATED_SLOT_GC_BASE_MEM_MB * OUTDATED_SLOT_GC_SEC;
    let limit_max = self.meta.memory_in_mb * OUTDATED_SLOT_GC_SEC * 2;
    let mut new = current;
    if hint > 10 {
        new = current + limit_base * (hint as f64 / 5.).ln().ceil() as u64;
    } else if hint < -10 {
        new = current - limit_base * (-hint as f64 / 5.).ln().ceil() as u64;
    }
    new = max(new, limit_base);
    new = min(new, limit_max);
    self.memory_limit.store(new, Ordering::SeqCst);
}
fn is_expired(&self, time_s: u64) -> bool {
    time_s * self.meta.memory_in_mb > self.memory_limit.load(Ordering::SeqCst)
}
```

通过函数动态计算一个和使用频率相关的超时量 `memory_limit`，之后使用 `time_s * self.meta.memory_in_mb` 来使得资源占用越多的实例超时时间越短。

这个策略的优点是，可以有效的减少资源占用程度高的实例的超时时间，从而减少资源的浪费。缺点是，这个策略的实现比较复杂，而且在实际的测试中，效果并不是很好，只在数据集 3 中取得了不错的提升，前两个数据集都是负优化。

### v2.0 - 猜你（数据集）喜欢

现在我们已经有了两个调度策略，一个在数据集 1/2 中表现良好，而另一个在数据集 3 中表现优异。同时，我们对训练集的数据分析也表明这三个数据集有较大的差异。前两个数据集来自 `k8s`，而且都有一定的随时间变化的规律。而第三个数据集来自函数计算，整体调用频率也显得杂乱无章。因此，我们的想法是，能不能在每个数据集上都使用不同的调度策略，从而达到最优的效果呢？

最终，我们基于 Rust 的动态派发机制 `trait object`，实现了对不同数据集使用不同策略的功能。

```rust
pub struct MixedCell {
    inner: Arc<dyn Cell>,
}
#[tonic::async_trait]
impl Cell for MixedCell {
    async fn assign(
        self: Arc<Self>,
        request_id: String,
        timestamp: u64,
    ) -> Result<model::Assignment> {
        self.inner.clone().assign(request_id, timestamp).await
    }
    async fn idle(
        self: Arc<Self>,
        assignment: model::Assignment,
        idle_reason: model::IdleReason,
    ) -> Result<()> {
        self.inner.clone().idle(assignment, idle_reason).await
    }
}
```

那么还剩下最后一个问题，怎么根据实例的名称来判断它属于哪个数据集？最后我们发现，前两个数据集的实例名都很短，且有意义，而第三个数据集的实例名都是类似 md5 一样的随机字符串。因此，我们可以通过实例名的长度来判断它属于哪个数据集。

```rust
impl CellFactory<MixedCell> for SimpleMixedCellFactory {
    fn new(&self, meta: model::Meta, client: Arc<Platform>) -> Arc<MixedCell> {
        if meta.key.len() >= 30 {
            // Use v1.5 when key is likely to from dataset 3
            MixedCell::new(MemoryCellFactory.new(meta, client))
        } else {
            // otherwise use v1.0
            MixedCell::new(NaiveCellFactory.new(meta, client))
        }
    }
}
```

### v3.0 - 幹你娘塞爆

我们的 2.0 策略实现的不错，靠着这么一个策略外加上手速上的先发制人，两周的赛程里我们在榜一肆虐了大约一周半。但是，随着后半段大家成绩的继续提升，我们这么个策略显得不够看了起来。我们开始尝试一些基于预测的策略，但是效果不是很优秀（真的没有做机器学习的天赋🥹）。直到某一天回看比赛的评分标准：

- 总分 =（请求执行总消耗/Slot 总消耗 + 请求执行总时间/(调度总时间 + 请求执行总时间)）* 100/2

如果我们在最开始就申请无限个 Slot，那么就靠着 0 分的资源分和 50 分的调度分，我们也可以拿到一个 50 分。换言之，低于 50 分的优化都可以被替换掉了。再一看我们 47 分的数据集 1，顿觉还有救。最终，我们基于预分配的算法做了如下优化：

- 预创建：在 Cell 创建之初，预创建一些 Slot 备用
- 长周期：GC 超时时间/GC 周期拉长，避免 Slot 过早释放
- 快释放：在一段时间没有任何请求后，释放所有 Slot

同时，通过对各个数据集预分配 Slot 的数量进行人工调整，保证分配数量为实例整个生命周期的最大值，我们最终在数据集 1/2 中提了 4～5 分，拿到了 55.75 分/第 4 名的成绩。

## 致谢

参加这次挑战赛，收获了很多，也学到了很多，最终也拿到了一个还算不错的成绩。在此感谢比赛举办方的辛勤工作，感谢赛题导师的指导，感谢队友的支持。最后，尤其要感谢给予我们队名灵感，同时陪伴我设计实现整个项目的二手玫瑰乐队。

## 附录

下面是我们参与决赛答辩的 PPT，供大家参考。同时，参赛代码也已经开源在 [Github](https://github.com/name1e5s/scaler-rust)。

<div>
    <object
    data='/assets/Serverless.pdf'
    type="application/pdf"
    width="720"
    height="480"
    >
    </object>
</div>