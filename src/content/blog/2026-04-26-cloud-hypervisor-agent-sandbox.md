---
title: 面向 Agent Sandbox 的 Cloud Hypervisor 优化实践
description: 针对 agent sandbox 场景拆解 Cloud Hypervisor 下游优化
pubDatetime: 2026-04-26T23:52:47+08:00
llmTag: llm-driven
tags:
  - 虚拟化
  - Cloud Hypervisor
commit_range: "v28.0..HEAD"
prompt: |
  从 v28.0 开始，到 HEAD 的所有 commit 为针对 agent sandbox 场景，为 cloud-hypervisor 所做的优化，现在我们需要写一份技术博客，用于宣传我们的改动。请根据这些 commit 的改动，生成技术博客的内容。博客内容需要包括：1. 所有 commit 的 message，即 `git log --oneline v28.0..`` 看到的输出 2. 分章节总结并描述我们的改动，需要注意在描述改动内容时，需要额外说明这些改动的背景，以及是出于什么设计上的取舍，做了这些改动，便于不了解 sandbox 技术的读者也能快速了解我们的设计。博客内容应当足够详细，且需要引用足够的代码来做分析。生成后的博客放在 blog.md 内。并在最开始的 yaml frontmatter 中，保留这段提示词，以便后续的检查和优化。
---

本文分析的仓库来自 [name1e5s/cloud-hypervisor 的 `upstream-ready/cube_diff_details_more_2` 分支](https://github.com/name1e5s/cloud-hypervisor/tree/upstream-ready/cube_diff_details_more_2)。它源于 [TencentCloud/CubeSandbox 的 `hypervisor` 目录](https://github.com/TencentCloud/CubeSandbox/tree/master/hypervisor)：CubeSandbox 使用 AI 将原本集中在下游代码里的相关改动拆分成一系列更适合 review、讲解和后续 upstream 准备的 commits。下文的 `v28.0..HEAD` commit range 对应的，就是这些面向 agent sandbox 场景的拆分提交。

这些提交可以看作一次围绕 agent sandbox 运行时的系统化改造：CubeSandbox 保留了 Cloud Hypervisor 原有的轻量 VMM、virtio 设备模型和安全隔离基础，同时补齐了 agent 场景最关心的几件事：快速启动、可迁移、可恢复、可观测、可控 I/O、可集成到上层 sandbox runtime。

所谓 agent sandbox，和一台长期运行的“传统虚拟机”很不一样。它更像是为一次 AI agent 任务临时拉起的隔离执行环境：需要在极短时间内创建，需要安全地访问有限文件和网络资源，需要通过 vsock 或共享内存和宿主服务交换数据，需要在任务调度、故障恢复、资源回收时保持外部可管理。这个场景会把虚拟化的很多“边缘问题”变成主路径问题：快照格式是否可审计，设备状态是否能恢复，网络 TAP 是否会成为启动瓶颈，文件系统后端是否多一层进程和 socket，日志是否能跟 sandbox id 对齐，guest 内部状态是否能被上层 runtime 可靠感知。

下面先列出完整提交列表，然后按主题展开。

## Commit 列表

以下是 `git log --oneline v28.0..` 的完整输出：

```text
2cf988684 chore(api): remove obsolete HTTP module shim
adf0e5bce test(runtime): expand integration coverage
46c67192a feat(cli): extend ch-remote with snapshot service commands
9ed6db58c feat(cli): switch the main binary to runtime library wiring
d84193382 feat(api): split HTTP endpoints and add snapshot service routes
01a264e79 feat(api): add service-backed VMM request transport
eec48776c feat(cli): extract reusable runtime library
998535649 chore(virtio-devices): align common seccomp and device glue helpers
92db4bef7 fix(hypervisor): simplify handled VM exit payloads
33dc1d912 fix(vm-migration): switch snapshot state helpers to serde
5cd92df39 feat(vmm): wire runtime restore and migration flow
7b0ee7118 feat(vmm): add downstream device manager backends
ef90a9288 feat(vmm): extend runtime configuration schema
c06b84e94 fix(hypervisor): adapt the KVM backend to newer ioctl APIs
f043067af feat(tools): add cube-cpuid utility
b75ab616c feat(arch): add x86 compatibility filters and platform identity helpers
434a187a4 feat(hypervisor): add serializable x86 CPUID and XSAVE helpers
2d5981935 fix(arch): use volatile GuestMemory I/O for MP table setup
9a2ed90c5 chore(devices): clarify reset and shutdown log messages
8669f5d0f chore(event_monitor): use workspace serde dependency
aeeebf1d3 chore(cleanup): apply small Rust API idiom updates
d7b81d6c1 feat(vsock): snapshot backend state and add muxer epoll modes
fe1b440dd fix(vsock): buffer TX writes when the host socket would block
0e4654114 fix(virtio-devices): adapt vhost-user fs frontend request plumbing
31c9b586d chore(dev): add downstream workflow helper scripts
24a4643dd chore(dev): add cargo lock conflict helper
1d0f4e9d2 chore(dev): refresh dev container helper
80a5b1249 test(ci): wire vmm_instance integration suite into runner
362a66b8f test(api): add http api fuzz target
7a23fdd57 feat(virtio-devices): add native virtio-fs device
ca8afaf93 feat(net_util): add tap-pool lookup for donated tap fds
a9a272232 feat(net_util): record virtio-net ratelimit hits
81a335982 fix(virtio-devices): switch virtio-net snapshot state to serde
ae6f952ee feat(virtio-devices): enable EVENT_IDX and ratelimit accounting for virtio-block
04135f3a2 fix(rate_limiter): return detailed bucket reduction results
39ac33b93 refactor(virtio-devices): rename vhost-user frontend/backend plumbing
25547d2b4 fix(virtio-devices): switch common device snapshots to serde
29bb9230f feat(devices): add ivshmem PCI device
6bb8b6755 feat(devices): add pvpanic PCI device
d909076f0 feat(devices): add x86 sysctrl legacy device
b3f24fc48 fix(devices): switch legacy MMIO and serial snapshots to serde
d8267d8bc fix(devices): switch ioapic snapshot state to serde
9109b9fee fix(pci): switch migratable state from Versionize to serde
dc90e6bfa fix(hypervisor): adapt MSHV register names to new bindings
e7b5c22a2 fix(vhost_user): adapt backend crates to newer vhost-user APIs
14a1df592 fix(block_util): adapt block I/O helpers to newer vm-memory APIs
65b6e0aa6 fix(arch): use volatile GuestMemory I/O for UEFI loading
e0da873eb fix(arch): switch RegionType snapshot state to serde
ec49e30b8 chore(deps): bump rust-vmm dependencies and workspace manifests
5c3cb873b feat(logging): add async file logger crate
6d0cb2922 feat(logging): add JSON log sink crate
d8a4b590e fix(event_monitor): protect monitor writes with a mutex
9f837b5d1 feat(event): add global event notifier crate
5f685d6d4 chore(virtiofsd): vendor virtiofsd sources
3b268da34 chore(build): bump msrv to rust 1.77
```

## 1. 从二进制 VMM 到可嵌入运行时库

Cloud Hypervisor 原本更像一个独立二进制：命令行解析配置，启动 VMM 线程，通过 HTTP API 或 Unix socket 做运行时控制。agent sandbox 的上层调度器则更希望把 VMM 当作一个库来管理：创建 sandbox、等待 guest ready、发起快照、恢复、销毁，都应该能通过进程内 API 完成。这样可以减少外部进程编排和 socket 生命周期管理，把 sandbox runtime 和 VMM 生命周期绑定得更紧。

这组提交做了两层拆分：

1. `src/lib.rs` 新增 `VmmInstance`，把启动、日志、event monitor、event notifier、API channel 初始化封装成库接口。
2. `vmm/src/api/service.rs` 引入全局 `VMM_SERVICE`，把原本面向 HTTP endpoint 的 API request 复用为进程内 request transport。

关键代码如下：

```rust
// src/lib.rs
pub struct VmmInstance {
    vmm_thread: Option<JoinHandle<Result<(), VmmError>>>,
}

impl VmmInstance {
    pub fn new(vmm_config: VmmConfig) -> Result<Self, Error> {
        // ...
        let (req_sender, req_receiver) = channel();
        let (res_sender, res_receiver) = channel();
        let api_evt = EventFd::new(EFD_NONBLOCK).map_err(Error::CreateEventFd)?;

        VMM_SERVICE
            .lock()
            .unwrap()
            .init(req_sender, api_evt.try_clone().unwrap(), res_receiver)
            .map_err(Error::InitVmmService)?;

        let hypervisor = hypervisor::new().map_err(Error::CreateHypervisor)?;
        // ...
    }
}
```

```rust
// vmm/src/api/service.rs
lazy_static! {
    pub static ref VMM_SERVICE: Mutex<VmmService> = Mutex::new(VmmService::new());
}

pub struct VmmService {
    inner: Option<VmmServiceInner>,
}

impl VmmService {
    pub fn send_request(&self, request: ApiRequest) -> Result<ApiResponse, Error> {
        let instance = self.inner.as_ref().ok_or(Error::NotInit)?;
        instance.api_sender.send(request)?;
        instance.api_evt.write(1)?;
        instance.res_receiver.recv()
    }
}
```

这里的设计取舍很重要：CubeSandbox 没有把 `Vm`、`DeviceManager`、`MemoryManager` 的内部锁暴露给库调用方，控制操作继续沿用 Cloud Hypervisor 既有的 `ApiRequest -> VMM thread -> ApiResponse` 串行路径。这会多一次 channel 发送和 eventfd 唤醒，但好处是所有控制操作仍然在 VMM 主线程序列化执行，不会破坏原有并发模型，也能让 HTTP API、`ch-remote` 和库 API 共享同一套语义。

同时，`ch-remote` 被补齐为快照控制工具：

```rust
// src/bin/ch-remote.rs
fn snapshot_api_command(socket: &mut UnixStream, url: &str) -> Result<(), Error> {
    let snapshot_config = vmm::api::VmSnapshotConfig {
        destination_url: String::from(url),
    };

    simple_api_command(socket, "PUT", "snapshot", Some(&to_json(snapshot_config)?))
}

fn pause2snapshot_api_command(socket: &mut UnixStream, url: &str) -> Result<(), Error> {
    simple_api_command(socket, "PUT", "pause2snapshot", Some(&to_json(url)?))
}
```

这让同一个 VMM 既能作为传统命令行程序运行，也能作为 sandbox runtime 的内部组件运行。对 agent 平台来说，这意味着上层可以把虚拟机生命周期纳入自己的调度事务：拉起、等待、暂停、保存、恢复、清理都可通过一个库实例完成。

## 2. 快照和恢复：从不可见状态到 serde 快照树

agent sandbox 的一个典型需求是“任务可以被暂停、转移、恢复”。例如调度器需要把正在执行的 agent 从一台机器搬到另一台，或者在节点维护前把 sandbox 保存下来。要做到这一点，VMM 不只要保存 guest 内存，还要保存 CPU、设备、PCI 配置、virtio 队列、vsock 后端、文件系统后端等状态。

这组提交把大量迁移状态从 `Versionize` 转向 `serde`，核心抽象在 `vm-migration/src/lib.rs`：

```rust
#[derive(Clone, Default, Deserialize, Serialize)]
pub struct SnapshotDataSection {
    pub id: String,
    pub snapshot: String,
}

impl SnapshotDataSection {
    pub fn to_state<'a, T>(&'a self) -> Result<T, MigratableError>
    where
        T: Deserialize<'a>,
    {
        serde_json::from_str(&self.snapshot).map_err(to_restore_error)
    }

    pub fn new_from_state<T>(id: &str, state: &T) -> Result<Self, MigratableError>
    where
        T: Serialize,
    {
        let snapshot = serde_json::to_string(state).map_err(to_snapshot_error)?;

        Ok(SnapshotDataSection {
            id: format!("{}-section", id),
            snapshot,
        })
    }
}

#[derive(Clone, Default, Deserialize, Serialize)]
pub struct Snapshot {
    pub id: String,
    pub snapshots: std::collections::BTreeMap<String, Box<Snapshot>>,
    pub snapshot_data: std::collections::HashMap<String, SnapshotDataSection>,
}
```

这个模型把 VM 状态描述为一棵树：`Vm` 是根，下面挂 `CpuManager`、`MemoryManager`、`DeviceManager`，而 `DeviceManager` 再挂每个设备。每个叶子节点通过 serde 序列化自己的状态。它牺牲了一些二进制格式的紧凑性，但换来了三个对 sandbox 很关键的收益：

1. 快照内容可读、可检查、可在开发中快速定位兼容性问题。
2. 每个设备可以独立演进自己的状态结构，新增字段通过 serde default 更容易兼容。
3. 上层 runtime 可以把快照作为普通文件资产管理，摆脱对不透明 blob 的强依赖。

VM 层的快照流程也体现了几个约束：只能在暂停状态快照；TDX VM 不支持快照；x86/KVM 需要保存公共 CPUID 和时钟状态；最后把 CPU、内存、设备快照组合起来。

```rust
// vmm/src/vm.rs
impl Snapshottable for Vm {
    fn snapshot(&mut self) -> std::result::Result<Snapshot, MigratableError> {
        event!("vm", "snapshotting");

        // TDX VM and non-paused VM are rejected before snapshotting.
        // ...
        let current_state = self.get_state().unwrap();
        if current_state != VmState::Paused {
            return Err(MigratableError::Snapshot(anyhow!("VM must be paused")));
        }

        let vm_snapshot_state = VmSnapshot {
            #[cfg(all(feature = "kvm", target_arch = "x86_64"))]
            clock: self.saved_clock,
            #[cfg(all(feature = "kvm", target_arch = "x86_64"))]
            common_cpuid,
        };
        let mut vm_snapshot = Snapshot::new_from_state(VM_SNAPSHOT_ID, &vm_snapshot_state)?;

        vm_snapshot.add_snapshot(self.cpu_manager.lock().unwrap().snapshot()?);
        vm_snapshot.add_snapshot(self.memory_manager.lock().unwrap().snapshot()?);
        // aarch64 vgic snapshot, if needed
        // ...
        vm_snapshot.add_snapshot(self.device_manager.lock().unwrap().snapshot()?);

        event!("vm", "snapshotted");
        Ok(vm_snapshot)
    }
}
```

快照写出时，配置、状态和内存被拆分保存，并且显式 `sync_all()`：

```rust
// vmm/src/vm.rs
impl Transportable for Vm {
    fn send(&self, snapshot: &Snapshot, destination_url: &str)
        -> std::result::Result<(), MigratableError>
    {
        let vm_config = serde_json::to_string(self.config.lock().unwrap().deref())
            .map_err(|e| MigratableError::MigrateSend(e.into()))?;
        snapshot_config_file.write(vm_config.as_bytes())?;
        snapshot_config_file.sync_all()?;

        let vm_state = serde_json::to_vec(snapshot)?;
        snapshot_state_file.write(&vm_state)?;
        snapshot_state_file.sync_all()?;

        if let Some(memory_manager_snapshot) = snapshot.snapshots.get(MEMORY_MANAGER_SNAPSHOT_ID) {
            self.memory_manager
                .lock()
                .unwrap()
                .send(&memory_manager_snapshot.clone(), destination_url)?;
        }
        // Memory snapshot is delegated to MemoryManager.
        Ok(())
    }
}
```

这里的取舍是把跨机器 pause-snapshot 的可靠性放在快照吞吐之前。`sync_all()` 会增加快照路径上的 I/O 成本，但 agent sandbox 的恢复语义通常比单次快照吞吐更重要：调度器拿到“快照完成”的返回后，应当能相信配置和状态已经落盘。

恢复路径则允许上层替换部分运行时配置，例如磁盘、网络、vsock、fs、pmem，以及是否 prefault 内存：

```rust
// vmm/src/lib.rs
fn vm_restore(&mut self, restore_cfg: RestoreConfig) -> result::Result<(), VmError> {
    let vm_config = Arc::new(Mutex::new({
        let mut vm_config = recv_vm_config(source_url).map_err(VmError::Restore)?;

        // Destination-local resources can be rebound during restore.
        if let Some(disks) = &restore_cfg.disks {
            vm_config.update_disks(disks);
        }
        if let Some(nets) = &restore_cfg.net {
            vm_config.update_nets(nets);
        }
        if let Some(vsock) = &restore_cfg.vsock {
            vm_config.update_vsock(vsock);
        }
        if let Some(fses) = &restore_cfg.fs {
            vm_config.update_fses(fses);
        }
        // vsock / pmem / dirty-log are handled similarly.
        // ...
        vm_config.memory.dirty_log = restore_cfg.dirty_log;
        vm_config
    }));

    let snapshot = recv_vm_state(source_url).map_err(VmError::Restore)?;
    self.vm_check_cpuid_compatibility(&vm_config, &vm_snapshot.common_cpuid)
        .map_err(VmError::Restore)?;

    let mut vm = Vm::new_from_snapshot(/* snapshot, config, events, hypervisor, ... */)?;
    vm.restore(snapshot).map_err(VmError::Restore)?;
    vm.resume().map_err(VmError::Resume)?;
    Ok(())
}
```

这对 sandbox 迁移很实用：源端和目的端可能有不同的 TAP fd、vsock socket 路径、virtio-fs 共享目录，快照恢复不能假设所有外设路径完全相同。CubeSandbox 把“可迁移的 guest 内部状态”和“目的端必须重新绑定的宿主资源”区分开，避免把本机 fd/path 当成可跨机器状态。

设备快照还做了并行化：

```rust
// vmm/src/device_manager.rs
impl Snapshottable for DeviceManager {
    fn snapshot(&mut self) -> std::result::Result<Snapshot, MigratableError> {
        let devices = self.device_tree.lock().unwrap().all_nodes();

        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(work_thread_num)
            .enable_all()
            .build()
            .unwrap();

        let mut snapshot = rt.block_on(async move {
            let snapshot = Snapshot::new(DEVICE_MANAGER_SNAPSHOT_ID);
            for device_node in devices.into_iter() {
                if let Some(migratable) = device_node.migratable {
                    thread_pool.push(tokio::spawn(async move {
                        migratable.lock().unwrap().snapshot()
                    }));
                }
            }
            // await workers and add each device snapshot
            // ...
        })?;

        snapshot.add_data_section(SnapshotDataSection::new_from_state(
            DEVICE_MANAGER_SNAPSHOT_ID,
            &self.state(),
        )?);

        Ok(snapshot)
    }
}
```

这同样是面向 agent workload 的优化：sandbox 内设备越来越多，virtio-fs、vsock、net、block 都有自己的状态，串行快照会把 tail latency 拉长。并行化要求每个设备的 `snapshot()` 自己负责内部一致性，因此 CubeSandbox 只在 VM 已暂停、控制面串行的前提下做这件事。

## 3. CPU 和平台兼容：让快照可以跨机器恢复

agent sandbox 经常被调度到不同物理机。问题是 x86 guest 启动后看到的 CPUID 会影响内核、libc、语言 runtime 选择指令集。如果源机器暴露了目的机器没有的指令，恢复后 guest 可能直接非法指令崩溃。因此这组提交加入了可序列化 CPUID、兼容过滤、平台 identity 辅助和 `cube-cpuid` 工具。

配置层新增了 `CompatibleMode`：

```rust
// vmm/src/vm_config.rs
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, Default)]
pub enum CompatibleMode {
    #[default]
    Vendor,
    Max,
    Ignore,
}

pub struct CpusConfig {
    pub boot_vcpus: u8,
    pub max_vcpus: u8,
    #[serde(default)]
    pub kvm_hyperv: bool,
    #[serde(default = "default_cpuconfig_max_phys_bits")]
    pub max_phys_bits: u8,
    #[serde(default)]
    pub compatible: CompatibleMode,
}
```

生成 CPUID 时，`vendor_compatible` 和 `arch_compatible` 分别控制“从外部兼容模板取交集”和“套用跨架构模板”：

```rust
// arch/src/x86_64/mod.rs
pub fn generate_common_cpuid(
    hypervisor: Arc<dyn hypervisor::Hypervisor>,
    topology: Option<(u8, u8, u8)>,
    sgx_epc_sections: Option<Vec<SgxEpcSection>>,
    phys_bits: u8,
    kvm_hyperv: bool,
    vendor_compatible: bool,
    arch_compatible: bool,
) -> super::Result<Vec<CpuIdEntry>> {
    let mut cpuid = hypervisor.get_cpuid().map_err(Error::CpuidGetSupported)?;

    if vendor_compatible {
        let cpuid_compatible = generate_compatible_cpuid();
        if !cpuid_compatible.cpuids.is_empty() {
            CpuidPatch::intersect_cpuid(&mut cpuid, cpuid_compatible.cpuids);
        }
    }

    CpuidPatch::patch_cpuid(&mut cpuid, cpuid_patches);

    if arch_compatible {
        cpuid_filter::apply_compatible_template(&mut cpuid);
        for entry in cpuid.as_mut_slice().iter_mut() {
            if 0xd == entry.function && entry.index == 0 {
                entry.ecx = xstate_required_size(entry.eax);
            }
        }
    }
    // ...
}
```

兼容性检查也更细：它不直接比较整个 CPUID blob，而是针对不同 leaf/register 使用不同规则。有些特性必须是源端的 bitwise subset，有些数值不能变小，有些 hypervisor signature 必须相等。

```rust
// arch/src/x86_64/mod.rs
enum CpuidCompatibleCheck {
    BitwiseSubset,
    Equal,
    NumNotGreater,
}

pub fn check_cpuid_compatibility(
    src_vm_cpuid: &[CpuIdEntry],
    dest_vm_cpuid: &[CpuIdEntry],
) -> Result<(), Error> {
    let feature_entry_list = &Self::checked_feature_entry_list();
    let src_vm_features = Self::get_features_from_cpuid(src_vm_cpuid, feature_entry_list);
    let dest_vm_features = Self::get_features_from_cpuid(dest_vm_cpuid, feature_entry_list);

    for (i, (src_vm_feature, dest_vm_feature)) in src_vm_features
        .iter()
        .zip(dest_vm_features.iter())
        .enumerate()
    {
        let entry = &feature_entry_list[i];
        let entry_compatible = match entry.compatible_check {
            CpuidCompatibleCheck::BitwiseSubset => {
                let different_feature_bits = src_vm_feature ^ dest_vm_feature;
                let src_vm_feature_bits_only = different_feature_bits & src_vm_feature;
                src_vm_feature_bits_only == 0
            }
            CpuidCompatibleCheck::Equal => src_vm_feature == dest_vm_feature,
            CpuidCompatibleCheck::NumNotGreater => src_vm_feature <= dest_vm_feature,
        };
        // ...
    }
}
```

这里没有选择“永远伪装成最低端 CPU”。那样迁移最稳，但会损失大量性能。CubeSandbox 提供了三档：

- `vendor`：默认策略，在同厂商机器间做交集，兼顾性能和迁移成功率。
- `max`：更激进地套用跨架构兼容模板，适合更异构的资源池。
- `ignore`：不做兼容收敛，适合单机或调用方明确知道不需要迁移的场景。

这让平台可以按资源池形态选择，不必把所有 agent workload 都压到同一个最低公分母。

## 4. Native virtio-fs：把文件系统后端纳入 VMM

agent sandbox 通常需要访问一小部分宿主文件：任务输入、工具缓存、工作目录、模型运行中产生的中间产物。传统做法是通过 vhost-user-fs，把 virtio-fs 设备前端放在 VMM，后端放在独立 `virtiofsd` 进程。这种隔离清晰，但对高密度 sandbox 有成本：每个 sandbox 多一个进程、多一个 socket、多一套生命周期和 seccomp 规则。

这组提交 vendor 了 `virtiofsd`，并新增 native virtio-fs 设备，把后端直接嵌入 `virtio-devices/src/fs.rs`。配置层通过 `native=<on|off>` 做兼容选择：

```rust
// vmm/src/config.rs
impl FsConfig {
    pub const SYNTAX: &'static str =
        "tag=<tag>,socket=<path>,native=<on|off>,shared_dir=<dir>,\
         read_only=<on|off>,allowed_dirs=<dir_list>,\
         ops_size=<n>,bw_size=<n>,...";

    pub fn parse(fs: &str) -> Result<Self> {
        // ...
        let native = parser.convert::<Toggle>("native")?.unwrap_or(Toggle(false)).0;

        let tag = parser.get("tag").ok_or(Error::ParseFsTagMissing)?;
        let mut socket = PathBuf::new();
        if !native {
            socket = PathBuf::from(parser.get("socket").ok_or(Error::ParseFsSockMissing)?);
        }

        let mut backendfs_config = None;
        let rate_limiter_config = if native {
            backendfs_config = Some(Self::parse_backendfs(&parser)?);
            // parse ops/bw token bucket
            // ...
        } else {
            None
        };

        Ok(FsConfig { tag, socket, backendfs_config, rate_limiter_config, .. })
    }
}
```

设备管理器根据是否存在 `backendfs_config` 选择 native 或 vhost-user 后端：

```rust
// vmm/src/device_manager.rs
fn make_virtio_fs_device(
    &mut self,
    fs_cfg: &mut FsConfig,
) -> DeviceManagerResult<MetaVirtioDevice> {
    let id = self.resolve_or_allocate_fs_id(fs_cfg)?;
    let node = device_node!(id);

    if let Some(bfs_cfg) = &fs_cfg.backendfs_config {
        self.make_native_virtio_fs_device(id, node, fs_cfg, bfs_cfg)
    } else {
        self.make_vhost_virtio_fs_device(id, node, fs_cfg)
    }
}
```

Native fs 设备的后端配置里包含很多 sandbox 关心的安全和性能参数：

```rust
// virtio-devices/src/fs.rs
pub struct BackendFsConfig {
    pub shared_dir: String,
    pub thread_pool_size: usize,
    pub xattr: bool,
    pub posix_acl: bool,
    pub xattrmap: Option<String>,
    pub cache: u8,
    pub read_only: bool,
    pub allowed_dirs: Option<Vec<String>>,
    // writeback, direct I/O, security labels, rlimit, etc.
    // ...
}
```

实际后端创建时，会把共享目录 canonicalize，然后配置 passthrough fs。只读模式会走 `PassthroughFsRo`：

```rust
// virtio-devices/src/fs.rs
let shared_dir_rp =
    fs::canonicalize(shared_dir).map_err(ActivateError::ActivateVirtioFs)?;

let fs_cfg = passthrough::Config {
    cache_policy: cache,
    root_dir: shared_dir_rp_str.into(),
    xattr: backendfs_config.xattr,
    read_only: backendfs_config.read_only,
    // xattrmap, readdirplus, writeback, security labels, etc.
    ..Default::default()
};

if backendfs_config.read_only {
    Ok(ServerType::PassthroughFsRo(/* server omitted */))
} else {
    Ok(ServerType::PassthroughFs(/* server omitted */))
}
```

这背后的取舍是：native virtio-fs 减少进程和 IPC，启动更快，资源占用更小，也更容易把 fs 后端状态纳入 VMM 快照；代价是后端和 VMM 在同一进程地址空间里，隔离边界更依赖 Rust 代码、seccomp 和配置收敛。因此 CubeSandbox 保留 vhost-user 路径，允许平台在“隔离优先”和“密度/延迟优先”之间选择。

Native virtio-fs 还支持运行时更新：

```rust
// vmm/src/device_manager.rs
pub fn fs_device_update(&self, fs_cfg: FsConfig) -> DeviceManagerResult<()> {
    if let Some(id) = fs_cfg.id {
        let node = device_tree.get(&id).ok_or(DeviceManagerError::UnknownDeviceId(id))?;
        let (tx, rx) = std::sync::mpsc::channel();

        if node.dev_fd.is_some() && fs_cfg.backendfs_config.is_some() {
            let event = FsEvent {
                tx,
                backendfs_config: fs_cfg.backendfs_config.unwrap(),
            };
            pending_dev_message.push(event);
            notify_fs_thread(node.dev_fd)?;
        }

        let success = rx.recv().map_err(DeviceManagerError::VirtioFsServerRecv)?;
        if !success {
            return Err(DeviceManagerError::VirtioFsServerUpdate("failed".into()));
        }
    }
    Ok(())
}
```

这非常适合 agent 任务的动态权限模型：sandbox 启动后，可以按任务阶段扩大或收缩 allowed dirs，而不必销毁整台 VM。

## 5. I/O 性能和资源控制：tap pool、EVENT_IDX 与 rate limiter

高密度 agent sandbox 的启动瓶颈经常不在 CPU，而在宿主侧资源准备。以网络为例，每个 sandbox 通常都需要一个 TAP 设备。TAP 可以理解为 Linux 提供给虚拟机的一块“虚拟网卡线缆”：guest 里的 virtio-net 把包发到 TAP fd，宿主网络栈再把包送进 bridge、veth、路由或安全策略链路。

传统路径是在 VM 启动时创建 TAP、通过 ioctl/netlink 配置队列数、IP/MAC/MTU、vnet header、offload，再把设备 enable。单个 VM 看起来还好，但 agent 平台的特点是短生命周期、高并发、密集创建：如果一次任务就拉起一个 sandbox，TAP 创建和 netlink 全局锁竞争会直接体现在 P99 启动延迟上。

提交 `feat(net_util): add tap-pool lookup for donated tap fds` 引入了“donated TAP fd”路径：TAP 可以由外部 pool 预先创建和配置，启动 VM 时直接领取 fd。这里的“donated”指上层 runtime 把一个已经准备好的 TAP 文件描述符交给 VMM 使用。

```rust
// net_util/src/tap.rs
pub struct Tap {
    tap_file: File,
    if_name: Vec<u8>,
    donated: bool,
}

impl Tap {
    pub fn lookup_from_pool(if_name: &str, sandbox_id: String) -> Result<Tap> {
        let file = request_from_pool(if_name, sandbox_id)?;

        Ok(Tap {
            tap_file: file,
            if_name: if_name.into(),
            donated: true,
        })
    }

    pub fn is_donated(&self) -> bool {
        self.donated
    }
}
```

`open_tap()` 的逻辑也体现了这个设计：只有单队列 TAP 且调用方提供了 `sandbox_id` 时才走快速路径；失败时自动退回原来的慢路径。

```rust
// net_util/src/open_tap.rs
pub fn open_tap(
    if_name: Option<&str>,
    num_rx_q: usize,
    sandbox_id: Option<String>,
) -> Result<Vec<Tap>> {
    let mut taps: Vec<Tap> = Vec::new();

    if num_rx_q == 1 {
        if let Some(name) = if_name {
            if let Some(sandbox_id) = sandbox_id {
                match Tap::lookup_from_pool(name, sandbox_id) {
                    Ok(tap) => {
                        taps.push(tap);
                        info!("Fast request tap success");
                        return Ok(taps);
                    }
                    Err(e) => {
                        info!("Fast request tap failed {:?}, fall back to slow path", e)
                    }
                }
            }
        }
    }

    check_mq_support(&if_name, num_rx_q)?;
    // fallback: open_named/new, set ip/netmask/mac/mtu, enable...
}
```

在 virtio-net 激活时，如果 TAP 是 donated，就跳过 VMM 内部 offload 配置：

```rust
// virtio-devices/src/net.rs
let tap = taps.remove(0);

if !tap.is_donated() {
    tap.set_offload(virtio_features_to_tap_offload(self.common.acked_features))?;
}
```

这个取舍的本质是把网络准备从 VM 启动热路径移到外部池化层：VMM 少做 setup，启动更快；pool 则必须保证 fd 已经按 virtio-net 协商能力正确配置。这个边界很清楚：VMM 对 donated fd 的态度是“信任但标记”，通过 `donated: true` 避免重复配置；runtime 对 pool 的责任是“预创建、预配置、按 sandbox_id 分配、失败回收”。对于 agent 平台，这是合理的，因为上层 runtime 本来就负责 sandbox id、网络命名空间、策略路由和清理。

换句话说，TAP pool 的主要收益在启动路径：少做热路径上的内核对象创建和网络配置，启动抖动也会随之变小。原本每台 VM 都要重复做的准备工作，被提前摊销到了资源池里。

资源控制方面，rate limiter 解决的是另一个问题：agent 是不可信或半可信 workload，同一节点上可能同时运行多个 sandbox。如果某个 agent 大量读写磁盘、刷 virtio-fs、打满网络队列，它不应该拖垮同机其他任务。Cloud Hypervisor 原本已有 token bucket 思路：给“字节数”和“操作次数”各放一个桶，请求要先消耗 token，token 不够就等 timerfd 唤醒后继续。

这组改动把 rate limiter 从布尔结果扩展为更详细的 `BucketReduction`：

```rust
// rate_limiter/src/lib.rs
pub enum BucketReduction {
    Failure,
    Success,
    OverConsumption(f64),
}

pub fn consume(&mut self, tokens: u64, token_type: TokenType) -> BucketReduction {
    if self.timer_active {
        return BucketReduction::Failure;
    }

    let token_bucket = self.bucket_for(token_type);

    if let Some(bucket) = token_bucket {
        let refill_time = bucket.refill_time_ms();
        match bucket.reduce(tokens) {
            BucketReduction::Failure => {
                self.activate_timer(TIMER_REFILL_DUR);
                BucketReduction::Failure
            }
            BucketReduction::Success => BucketReduction::Success,
            BucketReduction::OverConsumption(ratio) => {
                self.activate_timer(Duration::from_millis((ratio * refill_time as f64) as u64));
                BucketReduction::OverConsumption(ratio)
            }
        }
    } else {
        BucketReduction::Success
    }
}
```

这里有三个结果，分别对应三种运行时语义：

1. `Success`：本次请求在预算内，可以继续处理队列。
2. `Failure`：预算不够，但请求本身没有超出桶容量；设备线程会停下来，等 timerfd 表示 token 重新填充。
3. `OverConsumption(f64)`：单次请求本身就大于桶容量。这个请求已经被允许处理，但后续请求会按超额比例被延迟。

第三种情况是这次改动的关键。没有 `OverConsumption` 时，一个大请求只有两个糟糕选择：要么直接失败，破坏 guest 看到的设备语义；要么完全放行，破坏限速语义。现在可以把它表达成“这次先让它过，但之后多等一会儿”，这更符合块设备和文件系统的直觉。

在 native virtio-fs 队列处理里，rate limiter 同时统计 ops 和 bytes 的触发情况：

```rust
// virtio-devices/src/fs.rs
let mut rate_limited = BucketReduction::Success;
let mut rate_limited_type = TokenType::Ops;
let len = self.server.handle_message(
    reader,
    writer,
    cache_handler.as_mut(),
    &mut self.rate_limiter,
    &mut rate_limited,
    &mut rate_limited_type,
)?;

if rate_limited != BucketReduction::Success {
    match rate_limited_type {
        TokenType::Ops => {
            limit_by_ops += Wrapping(1);
            self.rate_limited.call_once(|| info!("{} fs ops ratelimit fired", self.id));
        }
        TokenType::Bytes => {
            limit_by_bytes += Wrapping(1);
            self.rate_limited.call_once(|| info!("{} fs bw ratelimit fired", self.id));
        }
    }

    if rate_limited == BucketReduction::Failure {
        queue.go_to_previous_position();
        break;
    }
}
```

当限速真正触发时，设备线程会把处理权交回 epoll，避免忙等。以 virtio-fs 为例：普通 queue event 到来时先检查 limiter 是否 blocked；如果 blocked，就不继续处理队列。等 `RATE_LIMITER_EVENT` 到来后，调用 `event_handler()` 消费 timerfd 事件，再重新处理队列。

```rust
// virtio-devices/src/fs.rs
match ev_type {
    QUEUE_AVAIL_EVENT => {
        self.queue_evt.read()?;
        let rate_limit_reached = self.rate_limiter.as_ref().is_some_and(|r| r.is_blocked());

        if !rate_limit_reached {
            self.handle_event_impl()?
        }
    }
    RATE_LIMITER_EVENT => {
        if let Some(rate_limiter) = &mut self.rate_limiter {
            rate_limiter.event_handler()?;
            self.handle_event_impl()?
        }
    }
}
```

virtio-net 的 RX/TX 也遵循同样思路。RX 限速解除后，如果 guest 还有可用 descriptor，就重新注册 TAP 的 EPOLLIN；TX 限速解除后，则唤醒 driver side queue 继续发送。

```rust
// virtio-devices/src/net.rs
RX_RATE_LIMITER_EVENT => {
    if let Some(rate_limiter) = &mut self.net.rx_rate_limiter {
        rate_limiter.event_handler()?;

        if !self.net.rx_tap_listening && self.net.rx_desc_avail {
            net_util::register_listener(/* TAP fd, EPOLLIN, RX_TAP_EVENT */)?;
            self.net.rx_tap_listening = true;
        }
    }
}
```

这里还有一个容易被忽略的点：限速日志和计数服务于运营闭环。agent 平台上的慢任务，可能是 CPU 忙、网络受限、文件系统受限、宿主拥塞、guest 内部服务卡住。提交 `feat(net_util): record virtio-net ratelimit hits` 和 native fs 中的 `limit_by_ops`/`limit_by_bytes`，让平台能区分“任务本身慢”和“被资源策略限速”。这对调参也很重要：如果大量 sandbox 都被 fs ops 限速，说明默认 bucket 可能过小；如果只有单个 sandbox 被限速，则可能是 agent 行为异常。

virtio-block 和 virtio-net 也补齐了 EVENT_IDX、ratelimit accounting 和 snapshot serde 化。`EVENT_IDX` 是 virtio ring 的中断抑制机制，可以减少无意义的中断/唤醒；在高密度 sandbox 中，它和 rate limiter 的组合非常关键：前者减少正常 I/O 的通知开销，后者控制异常 I/O 的资源占用。这些改动同时提升了性能和可运营性，让 agent 平台能回答三个问题：这个 sandbox 为什么慢？它是不是触发了 I/O 限速？它能否安全暂停并恢复到另一个节点？

## 6. Sandbox 专用设备：sysctrl、pvpanic、ivshmem

agent sandbox 需要 guest 和 host 之间有一些极小但可靠的信号通道。完整的 agent protocol 可以走 vsock，但像“guest 系统已启动”“vsock server ready”“guest panic”这类状态，如果完全依赖用户态服务，可能在故障路径上失效。因此 CubeSandbox 新增了几个小设备，把关键生命周期信号变成 guest 可见的硬件接口。

### x86 sysctrl legacy device

`SysCtrl` 是一个简单 I/O port 设备，guest 写入特定位后，host 侧发出全局事件通知：

```rust
// devices/src/legacy/sys_ctrl.rs
const SYS_START: u8 = 1 << 0;
const SYS_RESTORE: u8 = 1 << 1;
const SYS_PANIC: u8 = 1 << 2;
const SYS_VSOCK_SERVER: u8 = 1 << 3;
const SYS_VALID: u8 = SYS_START | SYS_RESTORE;

impl BusDevice for SysCtrl {
    fn read(&mut self, _base: u64, _offset: u64, data: &mut [u8]) {
        data[0] = self.sys_state & SYS_VALID;
    }

    fn write(&mut self, _base: u64, _offset: u64, data: &[u8])
        -> Option<std::sync::Arc<std::sync::Barrier>>
    {
        let code = data[0];
        if sys_start(code) && !sys_start(self.sys_state) {
            self.sys_state |= SYS_START;
            event_notify!(NotifyEvent::SysStart);
        }

        if (code & SYS_VSOCK_SERVER) == SYS_VSOCK_SERVER {
            info!("vsock server ready");
            event_notify!(NotifyEvent::VsockServerReady);
        }

        None
    }
}
```

这里没有复用 ACPI 或复杂 virtio 通道，是有意为之：启动早期和故障路径上，越小的 ABI 越可靠。代价是它是 x86 legacy port 风格，通用性不如标准设备；但对受控 guest image 的 sandbox runtime 来说，这种小而稳定的 paravirt ABI 更好维护。

### pvpanic PCI device

`pvpanic` 让 guest panic/crash-loaded 事件以 PCI MMIO 的方式通知 host，并写入 event monitor：

```rust
// devices/src/pvpanic.rs
const PVPANIC_PANICKED: u8 = 1 << 0;
const PVPANIC_CRASH_LOADED: u8 = 1 << 1;

impl BusDevice for PvPanicDevice {
    fn write(&mut self, _base: u64, _offset: u64, data: &[u8]) -> Option<Arc<Barrier>> {
        let event = self.event_to_string(data[0]);
        warn!("pvpanic got guest event {}", event);
        event!("guest", "panic", "event", &event);
        None
    }
}
```

对 agent 平台来说，panic 是调度和运维信号，会影响任务重试、镜像健康度、节点隔离和用户可见错误归因。把 panic 做成设备事件，可以避免依赖 guest 内部日志服务。

### ivshmem PCI device

`ivshmem` 提供一段 guest/host 可共享的内存区域，适合低延迟状态交换或特殊加速场景：

```rust
// devices/src/ivshmem.rs
pub struct IvshmemDevice {
    id: String,
    interrupt_mask: u32,
    interrupt_status: Arc<AtomicU32>,
    iv_position: u32,
    doorbell: u32,
    configuration: PciConfiguration,
    bar_regions: Vec<PciBarConfiguration>,
    region: Option<Arc<GuestRegionMmap>>,
    region_size: u64,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct IvshmemDeviceState {
    interrupt_mask: u32,
    interrupt_status: u32,
    iv_position: u32,
    doorbell: u32,
}
```

设备管理器创建 ivshmem 时，会把后端文件映射成 RAM region，再注册到 guest userspace mapping：

```rust
// vmm/src/device_manager.rs
let region = MemoryManager::create_ram_region(
    &Some(ivshmem_cfg.path.clone()),
    GuestAddress(start_addr),
    ivshmem_cfg.size,
    // file offset, shared/private flags, hugepage settings...
)?;

let mem_slot = self.memory_manager.lock().unwrap().create_userspace_mapping(
    region.start_addr().0,
    region.len(),
    region.as_ptr() as u64,
    // readonly, log_dirty, mergeable...
)?;

ivshmem_device.lock().unwrap().assign_region(region);
```

这里的取舍是：共享内存是强能力，必须由配置显式开启，并通过固定 size/path 控制边界；它不适合承载复杂协议，但适合非常低延迟、结构化的小数据交换。

## 7. vsock：把 agent 控制通道做得更可靠

vsock 是 guest 和 host 之间最自然的控制通道。它可以理解为“虚拟机内外之间的本机 socket”：guest 不需要知道宿主网络地址，也不需要经过外部网卡和防火墙路径，就能和宿主上的服务通信。agent sandbox 里，宿主通常通过 vsock 和 guest 内的 agent daemon 通信：下发任务、读取输出、传输控制消息、等待 ready 信号。

这条通道在用户体验上非常关键。对普通 VM 来说，网络偶发 backpressure 可能只是一次连接变慢；对 agent sandbox 来说，它可能意味着“用户看不到输出”“任务控制消息丢失”“上层误判 sandbox dead”。因此 CubeSandbox 对 vsock 的优化重点放在 backpressure、epoll 集成和恢复边界，而非单纯追求峰值带宽。

提交 `fix(vsock): buffer TX writes when the host socket would block` 处理了一个很具体但很关键的问题：写 host Unix socket 时遇到 `WouldBlock`，不能直接失败，而应该把数据放进 TX buffer，等待 EPOLLOUT 再继续。

为什么会出现 `WouldBlock`？vsock 的 Unix backend 最终要写宿主侧 UnixStream。这个 stream 是非阻塞的，当宿主服务暂时没有及时读取，内核 socket buffer 满了，`write()` 就会返回 `WouldBlock`。这代表当前时刻写不进去，并不表示连接已经损坏。如果 VMM 把它当成硬错误，guest 看到的就是一次莫名其妙的连接 reset；如果 VMM 阻塞等待，整个设备线程可能被卡住，影响其他连接。

```rust
// virtio-devices/src/vsock/csm/connection.rs
fn send_bytes(&mut self, buf: &[u8]) -> Result<()> {
    if !self.tx_buf.is_empty() {
        return self.tx_buf.push(buf);
    }

    let written = match self.stream.write(buf) {
        Ok(cnt) => cnt,
        Err(e) => {
            if e.kind() == ErrorKind::WouldBlock {
                return self.tx_buf.push(buf);
            } else {
                return Err(Error::StreamWrite(e));
            }
        }
    };

    self.fwd_cnt += Wrapping(written as u32);

    if written < buf.len() {
        self.tx_buf.push(&buf[written..])?;
    }

    Ok(())
}
```

这段逻辑做了三件事。第一，如果之前已经有未写完的数据，新的数据直接追加到 TX buffer，避免乱序。第二，只有 TX buffer 为空时才尝试直接写 UnixStream，这是最快路径。第三，遇到 `WouldBlock` 或部分写时，把剩余数据保存下来，由后续 EPOLLOUT 事件继续推进。这样 guest 的连接语义更接近普通 TCP/Unix socket：短暂拥塞表现为延迟，连接本身仍然保持稳定。

提交 `feat(vsock): snapshot backend state and add muxer epoll modes` 则让 vsock muxer 可以保存部分后端状态，例如本地端口集合，同时支持嵌套 epoll 与非嵌套模式：

```rust
// virtio-devices/src/vsock/unix/muxer.rs
impl Snapshottable for VsockMuxer {
    fn id(&self) -> String {
        self.id.clone()
    }

    fn snapshot(&mut self) -> std::result::Result<Snapshot, MigratableError> {
        Snapshot::new_from_state(&self.id, &self.state())
    }
}

impl VsockMuxer {
    pub fn new(
        id: String,
        host_sock_path: String,
        epoll_nested: bool,
        state: Option<VsockMuxerState>,
    ) -> Result<Self> {
        let local_port_set = state
            .map(|s| s.local_port_set)
            .unwrap_or_else(|| HashSet::with_capacity(defs::MAX_CONNECTIONS));

        let epoll_fd = epoll::create(true).map_err(Error::EpollFdCreate)?;
        let host_sock = bind_nonblocking_unix_listener(&host_sock_path)?;

        // ...
        if epoll_nested {
            muxer.add_listener(muxer.host_sock.as_raw_fd(), EpollListener::HostSock)?;
        }
        Ok(muxer)
    }
}
```

这里的 muxer 是 Unix backend 的核心：它维护连接表、监听宿主侧 Unix socket、把 guest 端口和 host stream 对应起来，并把 backend 的 epoll fd 接入 VMM 的事件循环。`epoll_nested` 的意义在于支持两类集成方式：一种是 muxer 自己维护 nested epoll，再把这个 fd 注册给上层；另一种是由外部 epoll helper 直接驱动。这样同一套 vsock backend 可以适配不同的 runtime 线程模型。

快照方面，CubeSandbox 只保存“恢复后继续正确分配端口、重建 backend 所需的状态”。至于 UnixStream 的内核缓冲区和对端进程状态，CubeSandbox 交给上层协议处理。这个边界看起来保守，但对 agent sandbox 更稳：正在进行的 RPC/流式输出通常应该由 agent protocol 做请求级确认和重放；如果 VMM 试图热迁移半开的宿主 socket，上层语义会变得更难解释。

因此 vsock 这组优化的目标可以概括为三句话：正常运行时，不因为宿主短暂读不及时而断连接；快照恢复时，保存足够的 backend 状态让通道可重新建立；集成 runtime 时，允许不同 epoll 模型复用同一个后端。换个更直观的说法，CubeSandbox 没有把 vsock 包装成分布式连接迁移层，它更关注一个可靠、可恢复、边界清晰的 sandbox 控制通道。

## 8. 可观测性：事件通知、JSON 日志、异步文件日志

sandbox 平台的故障定位经常跨越三层：调度器、VMM、guest agent。没有结构化事件，很难回答“VM 已经启动了吗”“guest 什么时候 panic 的”“vsock server 是否 ready”“迁移失败在哪个阶段”。这组提交新增了 `event_notifier`、`log_json`、`logging`，并修复了 `event_monitor` 并发写入。

`event_notifier` 是进程内事件通道，适合库模式下把 VM 事件直接发给上层 runtime：

```rust
// event_notifier/src/lib.rs
#[derive(Debug, PartialEq, Eq)]
pub enum NotifyEvent {
    VmShutdown,
    VsockServerReady,
    RestoreReady,
    SysStart,
    MigrationComplete,
    MigrationFail,
}

pub fn setup_notifier(notifier: Sender<NotifyEvent>) {
    let mut guard = NOTIFIER.lock().unwrap();
    guard.init(notifier);
}

pub fn send_event(event: NotifyEvent) {
    let mut guard = NOTIFIER.lock().unwrap();
    guard.send(event);
}
```

`event_monitor` 原本是写 JSON event，现在把输出文件和起始时间放进 `Mutex`，避免多线程设备事件交错写：

```rust
// event_monitor/src/lib.rs
static mut MONITOR: Option<Mutex<(File, Instant)>> = None;

pub fn event_log(source: &str, event: &str, properties: Option<&HashMap<Cow<str>, Cow<str>>>) {
    if let Some(mutex) = unsafe { MONITOR.as_ref() } {
        let mut guard = mutex.lock().unwrap();
        let e = Event {
            timestamp: guard.1.elapsed(),
            source,
            event,
            properties,
        };
        serde_json::to_writer_pretty(&guard.0, &e).ok();
        guard.0.write_all(b"\n\n").ok();
    }
}
```

异步日志则解决另一个现实问题：启动早期写日志会拖慢 sandbox 启动，尤其是日志文件在慢盘或 overlay filesystem 上。`src/common.rs` 的 logger 可以先 buffer，等 vCPU 启动后再启动 `cube-log` 异步线程：

```rust
// src/common.rs
fn log_async(&self, data: String, target: &str) {
    if self.logger_thread_started.lock().unwrap().load(Ordering::SeqCst) {
        slog_info!(slog_scope::logger(), "{}", data);
        return;
    }

    if self.vcpu_started.load(Ordering::SeqCst) {
        self.build_logger_thread();
        self.flush_buffer_to_async_logger();
    } else {
        self.buffer.lock().unwrap().push(data);
    }
}
```

这套机制让 sandbox runtime 可以把 `sandbox_id`、启动时间线、guest 事件、panic 事件和结构化 JSON 日志串起来，面向生产问题定位更友好。

## 9. seccomp 和依赖升级：让新增能力仍在收敛边界内

新增 native virtio-fs、rate limiter、vsock epoll 模式、runtime library 之后，系统调用面不可避免会变化。CubeSandbox 同步调整了 seccomp glue 和 thread rules，确保每类 virtio 线程只获得自己需要的 syscall。

例如 virtio 线程类型中新增 `VirtioFs`：

```rust
// virtio-devices/src/seccomp_filters.rs
pub enum Thread {
    // ...
    VirtioFs,
}
```

VMM 层也允许 runtime 注入额外 seccomp 规则：

```rust
// vmm/src/seccomp_filters.rs
fn thread_rules(
    hypervisor_type: HypervisorType,
) -> Result<Vec<(i64, Vec<SeccompRule>)>, BackendError> {
    let mut rules = api_thread_rules()?;
    // signal handler, vCPU, VMM, pty foreground...
    // ...
    rules.append(&mut virtio_devices::seccomp_filters::virtio_device_thread_rules());
    rules.append(&mut create_runtime_seccomp_rules()?);
    Ok(rules)
}

fn create_runtime_seccomp_rules() -> Result<Vec<(i64, Vec<SeccompRule>)>, BackendError> {
    Ok(RUTIME_RULES.read().unwrap().to_vec())
}

pub fn set_runtime_seccomp_rules(rules: Vec<(i64, Vec<SeccompRule>)>) {
    *RUTIME_RULES.write().unwrap() = rules;
}
```

这是对 sandbox 场景的一个现实妥协：不同平台可能需要注入少量运行时特定 syscall 规则，例如日志、监控或某些后端文件系统能力。如果把规则完全写死，会逼迫下游长期维护 fork；如果完全放开，则破坏 seccomp 的安全价值。CubeSandbox 选择在默认规则之外提供显式注入点，让策略仍然由上层集中审计。

依赖升级和 API 适配提交，例如 KVM ioctl、MSHV bindings、vhost-user API、vm-memory API、Rust MSRV 1.77 等，则是为了让这组改动站在更新的 rust-vmm 生态上，降低长期维护成本。

## 10. 测试和工程化：让 runtime 路径成为主路径

这组改动不只添加功能，也把测试覆盖拉向新的 runtime 使用方式：

- `test(runtime): expand integration coverage`
- `test(ci): wire vmm_instance integration suite into runner`
- `test(api): add http api fuzz target`
- 开发辅助脚本、cargo lock conflict helper、workflow helper

这说明 CubeSandbox 的目标已经从“维护一个下游特性分支”推进到“把 agent sandbox 的关键路径纳入日常验证”：库模式启动、HTTP/API fuzz、快照恢复、设备状态 serde、runtime 配置 schema 都要能被 CI 持续覆盖。

## 总结：一组 sandbox 运行时能力

从这些 commit 可以看到，CubeSandbox 对 Cloud Hypervisor 的优化覆盖了启动、迁移、设备、I/O、观测和安全边界。agent sandbox 对 VMM 的要求更像一个系统性清单：

1. 控制面要可嵌入，所以上层 runtime 可以直接管理 VMM 生命周期。
2. 状态要可快照、可恢复、可检查，所以迁移状态改成 serde 树，并补齐 CPU/设备/后端状态。
3. 资源要可池化、可限速，所以引入 donated TAP、EVENT_IDX、rate limiter 细粒度结果和 I/O 统计。
4. 文件系统要低延迟且可控，所以保留 vhost-user 的同时新增 native virtio-fs，并支持 allowed dirs、read-only、cache、运行时更新。
5. guest/host 信号要可靠，所以增加 sysctrl、pvpanic、ivshmem 和 event notifier。
6. 故障要能定位，所以引入 JSON log、异步文件日志、event monitor mutex 和结构化事件。
7. 安全边界要继续收敛，所以新增能力同步更新 seccomp，并提供 runtime 规则注入点。

这些取舍背后的共同原则是：在 agent sandbox 里，虚拟机更多是 runtime 的隔离执行单元，用户通常不会直接管理它。VMM 需要足够小、足够快，也要足够透明、可恢复、可观测。CubeSandbox 这轮改动把 Cloud Hypervisor 往这个方向推进了一大步。
