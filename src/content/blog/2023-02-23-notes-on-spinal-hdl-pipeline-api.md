---
title: Notes on SpinalHDL Pipeline API
description: Simple usages and internals of Spinal Pipeline API.
pubDatetime: 2023-02-23T22:04:58+08:00
tags:
    - SpinalHDL
    - Pipeline
---

## Table of contents

##  Introduction

My master's graduate project is to build a RISC-V processor, [Trimurti](https://github.com/name1e5s/Trimurti), with some special features to boost performance of the inference task.  I've built a MIPS core in traditional HDL like system verilog, and boot a OS on the system successfully. But building a complex circuit with such a prehistoric language was a suffering process, you need to maintain port definitions in different modules, define wires and connect ports by yourself, all those tasks needs to do **MANUALLY**. It took me about two weeks to find a cache bug caused by a typo on module connection. In this project, I decided to build the processor with a Scala-based modern hardware construct language, [SpinalHDL](https://spinalhdl.github.io/SpinalDoc-RTD/master/index.html). Its [`Pipeline`](https://github.com/SpinalHDL/SpinalHDL/blob/dev/lib/src/main/scala/spinal/lib/pipeline/Pipeline.scala#L11) API allows the definition of flexible pipelines, but I can't find document about how to use `Pipeline`, and what's happening under the hood. The goal of this article is to explain the design and usage of `Pipeline` and associate classes, with some backgrounds and example codes.

## Traditional Processor Pipeline

It's helpful to know how pipeline is designed in traditional RISC-V processor before we talk about `Pipeline` in SpinalHDL. Here we choose the well-known [`RI5CY`](https://github.com/openhwgroup/cv32e40p) as a example, which is a 32-bit in-order RISC-V core with a 4-stage pipeline.

![RI5CY Pipeline](https://docs.openhwgroup.org/projects/cv32e40p-user-manual/en/latest/_images/CV32E40P_Pipeline.png "RI5CY Pipeline")

If you look at the rtl directory, you'll see the stages and their build blocks appeared in pipeline graph immediately. You can find `cv32e40p_ex_stage`, `cv32e40p_id_stage`, `cv32e40p_if_stage` and `cv32e40p_load_store_unit`, and you can expect which stage  the `alu`, `decoder` or `prefetch` is located in. Finally all those units are connected together in `cv32e40p_core`.
```
rtl
├── cv32e40p_aligner.sv
├── cv32e40p_alu.sv
├── cv32e40p_alu_div.sv
├── cv32e40p_apu_disp.sv
├── cv32e40p_compressed_decoder.sv
├── cv32e40p_controller.sv
├── cv32e40p_core.sv
├── cv32e40p_cs_registers.sv
├── cv32e40p_decoder.sv
├── cv32e40p_ex_stage.sv
├── cv32e40p_ff_one.sv
├── cv32e40p_fifo.sv
├── cv32e40p_fp_wrapper.sv
├── cv32e40p_hwloop_regs.sv
├── cv32e40p_id_stage.sv
├── cv32e40p_if_stage.sv
├── cv32e40p_int_controller.sv
├── cv32e40p_load_store_unit.sv
├── cv32e40p_mult.sv
├── cv32e40p_obi_interface.sv
├── cv32e40p_popcnt.sv
├── cv32e40p_prefetch_buffer.sv
├── cv32e40p_prefetch_controller.sv
├── cv32e40p_register_file_ff.sv
├── cv32e40p_register_file_latch.sv
├── cv32e40p_sleep_unit.sv
├── cv32e40p_wrapper.sv
├── ...
```

A direct code organization, right? We may have been designing processor pipeline this way before `verilog` was invented. But such a pipeline is a typical **high cohesion** design. Codes to implement same functionality spreads everywhere. For example the M extension, we can find decode logic in ID stage, real execute logic in EX stage, and write back logic in WB stage. Lots of registers, ports and wires across pipeline is added to connect these logic. The more functionality we add, the more ports, registers and wires you need to maintain. When the pipeline has few stages, and the logic is clear, maintaining those connectors is not a big task. However, when you want to build a highly configurable pipeline. with lots functionality in the pipeline, maintenance would become a nightmare for everyone. Fortunately, SpinalHDL gives us an alternative way to build pipeline with less mind complexity. 

![Traditional Pipeline Design, Grouped by Functionality](https://raw.githubusercontent.com/name1e5s/article/master/pic/trad-pipeline.png "Traditional Pipeline Design, Grouped by Functionality")
##  VexRiscv Processor Pipeline

`Pipeline` in [`VexRiscv`](https://github.com/SpinalHDL/VexRiscv/) can considered as a previous version of the one in SpinalHDL lib, it gives us some basic ideas about how to group things for the same functionality together. `VexRiscv` is built with a generic pipeline contains some stages and plugins which implements some real decode/execute logic, etc.

Let's start with the definition of [`Stage` and `Stagable`](https://github.com/SpinalHDL/VexRiscv/blob/master/src/main/scala/vexriscv/Stage.scala).
```scala
class Stageable[T <: Data](_dataType: => T) extends HardType[T](_dataType) with Nameable {
    def dataType = apply()
    setWeakName(this.getClass.getSimpleName.replace("$",""))
}

class Stage() extends Area{
  def outsideCondScope[T](that: => T): T = ???
  def input[T <: Data](key: Stageable[T]): T = ???
  def output[T <: Data](key: Stageable[T]): T = ???
  def insert[T <: Data](key: Stageable[T]): T = ???

  val inputs   = mutable.LinkedHashMap[Stageable[Data],Data]()
  val outputs  = mutable.LinkedHashMap[Stageable[Data],Data]()
  val inserts  = mutable.LinkedHashMap[Stageable[Data],Data]()

  ...
}
```
`Stageable` is a wrapper around common `HardType[Data]` types, used as a key to index through hash maps. `Satage` defines a `inputs`, `outputs`, `signals`, `inserts` for a stage. No magic here, just some definitions of I/O ports and some helper functions to insert keys to hash maps and returns a wire for the key.

Then the `Pipeline` itself.
```scala
trait Pipeline {
  type T <: Pipeline
  val plugins = ArrayBuffer[Plugin[T]]()
  var stages = ArrayBuffer[Stage]()

  def build(): Unit ={
    // connect logic...
  }

  // build pipeline before pop component
  Component.current.addPrePopTask(() => build())
}
```
`Pipeline` is a trait, which defines a `plugins` and `stages` for a pipeline. `build` is a function to connect all the logic together. It's called before `pop` the component. `build` does the following things:

1. build all the plugins to insert keys and logics to stages
2. combine all the inserts to a single map, and in which stage the key is inserted
3. check if there are any keys in `inputs` and `outputs` that are not in `inserts`, and throw an erro if has
4. complete the `inputs` and `outputs` by adding keys in `inserts` that are not in `inputs` and `outputs`
5. connect default output to input for all the keys in `inputs` and `outputs` in a stage, this makes the inputs will just flow through the stage if no logic changes it is inserted
6. connect previous stage's output to current stage's input for all the keys in `inputs` and `outputs` in a stage, with registers inserted.

This means, if you want to produce some data from stage A, and use it in stage B after A, you can simply derive a class from `Stagable` and insert it into stage A, then use it by query with `input` method in stage B. `Pipeline` will insert the necessary wires and registers to connect them together. A simple example is shown below, which adds 2 to the input and output the result after 4 stages.
```scala
class VexRiscVPipelineExample extends Component with Pipeline {
  type T = VexRiscVPipelineExample

  object RESULT extends Stageable(UInt(32 bits))

  // build a new stage
  def newStage(): Stage = { val s = new Stage; stages += s; s }
  val stageA = newStage()
  for (i <- 1 to 4) {
    // set name to avoid conflict
    newStage().setName(f"mid_$i")
  }
  val stageB = newStage()
  val io = new Bundle {
    val input = in UInt(32 bits)
    val output = out UInt(32 bits)
  }

  // functional logic
  stageA.insert(RESULT):= io.input + 1
  io.output:= stageB.output(RESULT) + 1
}
```

Combining `Pipeline` and `Stage`, we've successfully reduce the ports and wires we need to maintain in a pipeline. However, we still need to write code for different functionality in same `Component`. This is where `Plugin` comes in.
```scala
trait Plugin[T <: Pipeline] extends Nameable {
  var pipeline: T = null.asInstanceOf[T]
  // Used to setup things with other plugins
  def setup(pipeline: T): Unit = ???
  // Used to flush out the required hardware (called after setup)
  def build(pipeline: T): Unit = ???

  // convenience class to specify which stage the code species should be inserted
  implicit class implicitsStage(stage: Stage){
    def plug[T <: Area](area: T): T = ???
  }
  implicit class implicitsPipeline(stage: Pipeline){
    def plug[T <: Area](area: T) = ???
  }
}
```
`Plugin` gives us a way to group logic for same functionality together. It split the logic into two parts, `setup` and `build`. `setup` is used to interact with other plugins, such as adding how to decode a new instruction to decoder plugin, and `build` is used to flush the hardware. `Plugin` also provides a `plug` method to mark which stage the logic is inserted. When we use the Plugin style to implement the example above, we can do it like this:
```scala
class VexRiscVPluginExample extends Plugin[VexRiscVPipelineExample] {
  override def build(pipeline: VexRiscVPipelineExample): Unit = {
    import pipeline._

    // we can even define io in plugin
    // but remind to set name for it
    val io = new Bundle {
      val input = in UInt (32 bits)
      val output = out UInt (32 bits)
    }.setName("io")

    object RESULT extends Stageable(UInt(32 bits))

    // these logic lives in stageA
    stageA plug new Area {
      import stageA._
      insert(RESULT):= io.input + 1
    }

    stageB plug new Area {
      import stageB._
      io.output:= output(RESULT) + 1
    }
  }
}

// no actual logic in Component, yay!
class VexRiscVPipelineExample extends Component with Pipeline {
  type T = VexRiscVPipelineExample

  plugins += new VexRiscVPluginExample

  def newStage(): Stage = { val s = new Stage; stages += s; s }

  val stageA = newStage().setName("A")
  for (i <- 1 to 4) {
    newStage().setName(f"mid_$i")
  }
  val stageB = newStage().setName("B")
}
```
Finally, we can build a processor with code grouped by functionality, and the pipeline is automatically connected together. For more examples, check out the [`VexRiscv`](https://github.com/SpinalHDL/VexRiscv/).


## SpinalHDL Pipeline

SpinalHDL pipeline is an experimental feature, first intodoced in SpinalHDL 1.7.1, originally built for [NaxRiscv](https://github.com/SpinalHDL/NaxRiscv). Compared to the `Pipeline` in VexRiscv, SpinalHDL pipeline introduces the concept of `ConnectionLogic`, allowing users to define how the stages is connected. It also adds more implicit functions and classes, make it more convient to use. And removes the `Plugin` concept and focused on building pipeline only. Users should build their own `Plugin` style framework if they want to, as what NaxRiscv did.

### `ConnectionLogic`

SpinalHDL `Pipeline` introduces `ConnectionLogic` to define how the stages is connected. The trait is like this:
```scala
// abstraction of ports need to be connected across stages
case class ConnectionPoint(valid: Bool, ready: Bool, payload: Seq[Data]) extends Nameable
trait ConnectionLogic extends Nameable with OverridedEqualsHashCode {
  // how m is connected to s
  def on(m: ConnectionPoint,
         s: ConnectionPoint,
         flush: Bool, flushNext: Bool, flushNextHit: Bool,
         throwHead: Bool, throwHeadHit: Bool): Area
  def latency: Int = ???
  def tokenCapacity: Int = ???
  def alwasContainsSlaveToken: Boolean = false
  def withPayload: Boolean = true
}
```
It defines how the master stage is connected to the slave stage. The `on` method is called when the master stage is connected to the slave stage. SpinalHDL also gives us some default implementation:

- `Connection.DIRECT`: connect last stage's output to current stage's input directly, without any buffer or register
- `Connection.M2S`: connect last stage's output to current stage's input with a set of register, as what VexRiscv does
- `Connection.S2M`: in fact, I cannot figure out what this is used for, but it is used in NaxRiscv

For common usage, `Commection.M2S` is enough. However, if you want to build a component like ring buffer used to connect frontend and backend of a OoO processor, you may derive a class from `ConnectionLogic` and implement your own `on` method.

### Examples

With lots of implicit conversions, now we can build stages like common components. The following example shows how to add 2 to the input and output the result after 4 stages with new `Pipeline` api.
```scala
class SpinalHDLPipelineExample extends Module {
  val input = in UInt(32 bits)
  val output = out UInt(32 bits)

  val pipeline = new Pipeline {
    val RESULT = Stageable(UInt(32 bits))

    val stageA = new Stage {
      // no more insert method
      RESULT := input + 1
    }
    for (i <- 1 until 4) {
      // we need to specify the connection logic now
      new Stage(connection = Connection.M2S()).setName(f"mid_$i")
    }
    val stageB = new Stage(connection = Connection.M2S()) {
      // we can even override a key's value
      // and no more output or input method
      overloaded(RESULT) := RESULT + 1
      // ...but need some tricks to get the output in the same stage
      output := internals.outputOf(StageableKey(RESULT.asInstanceOf[Stageable[Data]], null)).asInstanceOf[UInt]
    }
  }

  // build pipeline by hand
  pipeline.build()
}
```

When you want to build the pipeline with `Plugin` style, you can visit what [NaxRiscv](https://github.com/SpinalHDL/NaxRiscv/blob/main/src/main/scala/naxriscv/utilities/Framework.scala) did. Generally it follows the same two-step process as VexRiscv, but with more flexibility and abality to generate codes with multithreading.