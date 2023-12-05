---
title: SpinalHDL 现已加入对 VCS 以及 Vivado 的支持
description: 一些更新介绍。
pubDatetime: 2022-05-07T22:04:58+08:00
tags: 
    - Spinal
---

随着 [SpinalHDL 1.7.0](https://github.com/SpinalHDL/SpinalHDL/releases/tag/v1.7.0) 的发布，我的提交 [#644](https://github.com/SpinalHDL/SpinalHDL/pull/644) 和 [#664](https://github.com/SpinalHDL/SpinalHDL/pull/664) 中实现的对于 VCS 和 Vivado 的支持也已经正式可用了。现在大家可以使用 VCS 或是 Vivado 作为 SpinalSim 的后端，对带有仅支持对应仿真器的加密 IP 进行仿真测试，并在熟悉的工具流中查看波形，进行调试了。如果在使用过程中遇到了什么问题，也可以直接在 PR 下评论。

## 如何使用

受益于 SpinalHDL 的设计，将 VCS 或是 Vivado 替换为仿真测试的后端是非常简单的。在设置好需要的环境变量后，通常只需要改动一行代码即可启用对应仿真器的支持。

### 环境配置

#### VCS

要为 SpinalSim 启用 VCS 仿真器，需要添加如下环境变量：

- `VCS_HOME`: VCS 的安装目录
- `VERDI_HOME`: Verdi 的安装目录

并对现有的环境变量进行如下修改：

- 将 `$VCS_HOME/bin` 以及 `$VERDI_HOME/bin` 添加到 `$PATH` 中
- 将 `$VERDI_HOME/share/PLI/{VCS, IUS, lib, Ius, MODELSIM}/LINUX64` 添加到 `$LD_LIBRARY_PATH` 中

之后还需要确保成功了安装 `boost` 库，SpinalSim 使用 `boost` 提供的 IPC 功能与 VCS 进行通信。

#### Vivado

要为 SpinalSim 启用 Vivado 的仿真器（通常被称为 xsim），需要添加如下环境变量：

- `VIVADO_HOME`: Vivado 的安装目录，例如 `/opt/Xilinx/Vivado/2021.2`

并将 `$VIVADO_HOME/bin` 添加到 `$PATH` 中。

### 使用方法

#### VCS

在 `SimConfig` 中加入 `withVCS` 即可。需要注意的是，VCS 2016 及之前的版本不支持带有 C++ 11 支持的 GCC，而我们的 C++ 代码需要 C++ 11 支持，如果整个系统都使用 VCS 需要的 GCC 版本，就会出现编译问题。此时需要将系统的 GCC 设置为支持 C++ 11 的 GCC 版本，并使用 `withVCSCc` 和 `withVCSLd` 手动指定 `VCS` 使用的 `CC` 以及 `LD`，语法如下： 

```diff
 object MyTopLevelSim {
   def main(args: Array[String]) {
-    SimConfig.withWave.doSim(new MyTopLevel){dut =>
+    SimConfig
+      .withVCS // Use VCS as simulator
+      .withVCSCc("gcc-4.4") // Use gcc-4.4 as VCS compiler
+      .withVCSLd("g++-4.4") // Use g++-4.4 as VCS linker
+      .withFsdbWave // Use fsdb as waveform format
+      .doSim(new MyTopLevel){dut =>
       //Fork a process to generate the reset and the clock on the dut
       dut.clockDomain.forkStimulus(period = 10)
```

SpinalSim 的 VCS 后端按照常见的三步仿真流程实现，用户可以根据自己的需要，向各个阶段添加参数，详细的添加方式可以查看[官方文档](https://spinalhdl.github.io/SpinalDoc-RTD/master/SpinalHDL/Simulation/install/VCS.html)。

#### Vivado

在 `SimConfig` 中加入 `withXSim` 即可，默认的波形输出格式是 `wdb`。如果项目中存在 `xci` 文件或是 `bd` 文件，需要通过 `withXSimSourcesPaths` 指定文件所在的文件夹路径。

```diff
 object MyTopLevelSim {
   def main(args: Array[String]) {
+    val xciDir = ArrayBuffer("path/to/xci_dir")
+    val bdDir = ArrayBuffer("path/to/bd_dir")
-    SimConfig.withWave.doSim(new MyTopLevel){dut =>
+    SimConfig
+      .withXSim
+      .withXSimSourcesPaths(xciDir, bdDir)
+      .withWave.doSim(new MyTopLevel){dut =>
       //Fork a process to generate the reset and the clock on the dut
       dut.clockDomain.forkStimulus(period = 10)
```
之后即可使用 `Vivado` 查看波形：

![](https://user-images.githubusercontent.com/15176913/160247664-909660e3-c974-48ba-ae97-ef2abbaade71.png)

## 如何实现

### SpinalHDL 仿真模块的结构

SpinalHDL 的仿真模块大致可以分为三层：

- `spinal.core.sim`：将用户的代码转化为对 `spinal.sim.SimRaw` 接口的调用
- `spinal.sim.Sim*`：调用各个仿真器对应的 Backend，实现 `spinal.sim.SimRaw` 接口
- `spinal.sim.*Backend`：执行编译流程，并通过 JNI 与各个仿真器提供的接口进行交互

![](https://s3.bmp.ovh/imgs/2022/05/07/e35a9b41598c2739.jpg)

作为仿真模块核心的 `SimRaw` 接口定义如下：

```scala
abstract class SimRaw {
  var userData : Any = null
  def getInt(signal : Signal) : Int
  def getLong(signal : Signal) : Long
  def setLong(signal : Signal, value : Long) : Unit
  def getBigInt(signal : Signal) : BigInt
  def setBigInt(signal : Signal, value : BigInt): Unit
  def getIntMem(signal : Signal, index : Long) : Int // 已经弃用
  def getLongMem(signal : Signal, index : Long) : Long // 已经弃用
  def setLongMem(signal : Signal, value : Long, index : Long): Unit // 已经弃用
  def getBigIntMem(signal : Signal, index : Long) : BigInt // 已经弃用
  def setBigIntMem(signal : Signal, value : BigInt, index : Long): Unit // 已经弃用
  def sleep(cycles : Long): Unit
  def enableWave(): Unit
  def disableWave(): Unit
  def eval() : Boolean
  def end(): Unit
  def isBufferedWrite : Boolean
}
```

总结起来，`SimRaw` 中定义了这两类接口：

- 流程控制接口：
  - `sleep`：指定仿真器模拟的时钟周期数，在执行完毕前 SpinalSim 不会要求更多的操作
  - `enableWave`：开启波形输出
  - `disableWave`：关闭波形输出
  - `end`：结束仿真
  - `eval`：更新仿真器的状态，并返回是否执行完毕
- 信号的读写接口：`get*` 和 `set*`

要实现对仿真器的支持，我们需要做的就是定义仿真器需要的编译流程，并根据仿真器提供的接口，实现 `SimRaw` 中定义的接口。

### VCS

VCS 支持 VPI 规范，因此我们要做的就是定义 VCS 的仿真流程，其余部分复用 SpinalHDL 已有的对 VPI 的支持即可。

#### VPI

VPI 是 Verilog 规范中定义的一套 C 接口，通过这套接口可以访问、修改 Verilog 模块中定义的各个对象，还可以通过注册回调来在出现特定的仿真事件时触发某些操作。绝大多数仿真器都会支持这一套接口。

`spinal.sim.SimVpi` 以及 `spinal.sim.VpiBackend` 实现了基于 VPI 的 `SimRaw` 接口，并留出了 `compileVPI`、`analyzeRTL` 这两个接口。我们只要根据各个仿真器的流程来自定义 VPI Plugin 的编译过程以及对 RTL 的处理流程，就可以实现对仿真器的支持。

具体的实现可以查看[源码](https://github.com/SpinalHDL/SpinalHDL/blob/dev/sim/src/main/scala/spinal/sim/VpiBackend.scala#L671)，大部分流程与正常使用 VCS 的仿真流程相同，额外添加了一些编译 VPI 代码的指令。

### Vivado

很遗憾的是，Vivado 不支持 VPI 规范，我们只能利用 Vivado 提供的 XSI 规范，从头做起。关于 XSI 的详细信息可以在[这里](https://docs.xilinx.com/r/en-US/ug900-vivado-logic-simulation/Using-Xilinx-Simulator-Interface) 找到。XSI 提供了一组非常简洁的接口，可以访问、修改 Verlog module 中定义的各个 port，但是对于模块内部的信号，XSI 就无能为力了。XSI 提供的函数如下：

|Activity|XSI Function|Xsi::Loader Member Function|
|--- |--- |--- |
|Open the design|xsi_open|open|
|Fetch a port ID|xsi_get_port_number|get_port_number|
|Set an input port value|xsi_put_value|put_value|
|Run the simulation|xsi_run|run|
|Fetch an output port value|xsi_get_value|get_value|
|Close the design|xsi_close|close|

在基于这些接口实现完 `SimRaw` 后，我们还需要定义一套将 Vivado 项目编译为仿真库的流程，这里使用的是 Vivado 提供的 `launch_simulation -scripts_only` 指令来实现，并通过 `sed` 命令添加部分参数到生成的编译脚本中。

具体的实现可以查看[源码](https://github.com/SpinalHDL/SpinalHDL/blob/dev/sim/src/main/scala/spinal/sim/XSimBackend.scala)。