# dsh-env-inspector-plus

在 DSH（DeepSeek Harness）网页版「**设置 → 环境体检**」加一个只读分页，一眼看清当前宿主进程的处境。

同时给模型一个只读工具 `env_inspect`，让 AI 也能回答「现在跑在哪个目录、用哪个 profile、Node 什么版本」。

> **关于包名**：本包是 `dsh-env-inspector` 的重命名版本 —— npm 上 `dsh-env-inspector`
> 已被第三方占用（维护者 geeklei），故加 `-plus` 后缀发布。功能为同一份实现。

## 展示什么

**宿主身份**

- 进程 id（pid）
- 入口脚本路径
- 当前工作目录
- Node 版本、平台
- 已运行时长

**环境变量分组**

- 总数
- `DSH_` 前缀组
- 凭证形态组（`KEY` / `PASSWORD` / `SECRET` / `TOKEN`）
- 其余

**逐条变量清单**：只含**键名、是否以 `DSH_` 开头、是否命中凭证形态、是否已设值、值长度** —— 每个变量一行。

## 安全边界（重要）

**凭证形态变量的值一律不出宿主**。命中的键只返回布尔与长度，明文绝不进入模型上下文，也绝不进入 HTTP 响应体。

承诺范围是精确的：**逐条变量清单（`env.entries` 与两组键名）只含键名与元数据，不含任何环境变量的值**。

唯一携带原值的字段是 4 个 host 身份字段 —— `host.cwd`、`host.profileDir`、`host.profile`、`host.entry`（分别对应 `PWD` / `DSH_PROFILE_DIR` / `DSH_PROFILE` / 入口路径）。这是刻意的：「现在在哪个目录跑、用哪个 profile」正是体检最该回答的问题，掩掉就等于删掉主要用途；且这些值本来就会出现在会话里。

> 要看某个变量的**明文**，请用 `dsh-settings-params` 的 `env_param_get` —— 那条路有独立的显式授权。

## 安装

```sh
dsh plugin --profile web add dsh-env-inspector-plus
```

安装后重启宿主进程。

## 使用

**网页**：设置 → 环境体检

**模型工具**：

```
env_inspect
```

无参数，返回上述快照。适合在排查「环境变量没生效」「跑的是哪个 profile」这类问题时让模型自己看。

## 宿主贡献

| 类型 | 值 |
|---|---|
| 注入服务 | `['tools', 'webServer']` |
| 只读路由 | `GET /dsh-env-inspector/snapshot` |

> 路由路径**保留原名** `dsh-env-inspector`（未随包名改为 `-plus`），
> 以避免既有 profile 的注册点失效。

## 设计说明

本包**不 import 任何 `@deepseek-ai/*` 包**。作为树外插件包，插件目录下没有 `node_modules`，`import '@deepseek-ai/dsh-tools'` 会抛 `ERR_MODULE_NOT_FOUND`，宿主侧表现为 `failed to import`、插件根本装载不上。

因此工具定义是**手写对象**（零 dsh 依赖）：`{ name, description, parameters, output, execute }`，其中 `parameters` 是**显式 JSON Schema 根对象**。这与官方 `defineTool` 语法糖编译出的形状等价。

客户端 bundle 仅 `require` 平台种子表内的模块（`react`）。

## 许可证

MIT © felixpu

## 仓库

<https://github.com/felixpu/dsh-env-inspector-plus>
