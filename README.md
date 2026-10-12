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
dsh plugin --profile web add github:felixpu/dsh-env-inspector-plus
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
| 成功信封 | `{ ok: true, data: <快照> }` |
| 失败信封 | `{ ok: false, code: 'snapshot-failed' }`（HTTP 500，文案由客户端字典翻译） |

> 路由路径**保留原名** `dsh-env-inspector`（未随包名改为 `-plus`），
> 以避免既有 profile 的注册点失效。`settings.section` 的注册 id 同理保留原名；
> 而 locale 命名空间用**包名** `dsh-env-inspector-plus`（避免与 npm 上同名第三方包撞字典）。

## 中英双语（三套互相独立的机制，别混）

### ① 运行时 UI 文案 —— `client/client.js` 里的字典（45 条）

客户端半身走平台官方 locale 服务：

```js
const NS = 'dsh-env-inspector-plus'          // 命名空间用包名，避免与他人撞名
ctx.effect(() => ctx.locale.register(NS, { zh, en }), NS + ': dictionaries')
const t = ctx.locale.bind(NS)
ctx.slots.register({ ..., locale: NS }, EnvInspectorSection)   // 渲染器自动注入 t
```

- **每个 `ctx.slots.register` 都要带 `locale: NS`** —— 平台渲染器据此把 `t` 座位自动注入组件
  props，所以组件里直接 `props.t`，**不需要**再写 `inject: () => ({ t })`。
- **设置分页导航项的 `label` 必须用函数**（`() => t('section.label')`）：设置页导航每次读取时经
  `resolveSlotLabel` 求值，语言切换后这一格立刻跟着变，不用重新注册。写成固定字符串则切换语言
  后仍是旧语言。
- **必须声明客户端注入**：`package.json` 的 `dsh.client.inject` 含
  `@deepseek-ai/dsh-client-locale`，插件对象 `inject` 含 `'locale'`。缺了它，注册带 `locale:` 的
  插槽会抛 `SlotAssemblyError`。
- 一条消息 = 一个完整句子，变量用 `{name}` 占位。**不要片段拼接** —— 中英语序不同
  （`2 d 3 h` vs 「2 天 3 小时」），拼接式无法重排。
- 平台 `common` 命名空间已有的通用词（`cancel` / `loading` / `unknown`…）**刻意不重复定义**，
  查表未命中会自动回落 common。
- 键名小写点分层级；`code.*` 的叶段可含连字符（如 `code.snapshot-failed`），因为它要一对一
  对齐宿主回的机器可读 code。
- **zh 与 en 的键必须完全一致**：运行时 `register` 不检查，漏键不报错、只会在该语言下显示
  key 名。`apply` 里有一次键一致性自查 + `console.warn`（参考归档插件）。

### ② 宿主 → 客户端的失败：只回机器可读 code

宿主**不该知道 UI 语言**。快照路由失败时回 `{ ok: false, code: 'snapshot-failed' }`，面向用户的
句子全部由客户端字典翻译：

```js
const HOST_CODES = { 'snapshot-failed': 'code.snapshot-failed' }   // 白名单映射
```

未知 code 退回通用文案（`error.badResponse`）—— **绝不把 `code.xxx` 这种 key 名显示给用户**。
客户端把失败存成**描述符**（字典键 + 参数）而不是已翻好的句子，因此切换语言后错误文案即时跟随，
不会停在取数那一刻的语言。

### ③ 模型侧工具描述与 render 文本：有意保持英文单语

`env_inspect` 的 `description` 与参数说明是**面向模型的能力契约**，不是 UI 文案：平台自带工具
（`bash` / `read` / `grep`…）同样只有一份英文描述，且宿主拿不到会话的 UI 语言。

`output.render` 的文本同时进「模型上下文」与「网页工具卡片」，但它也**不是本插件的界面** ——
故写成语言无关的字段式标签（`host:` / `entry:` / `cwd:` / `uptime:` / `env:`），与平台自带工具一致。

### ④ 插件展示元数据 —— `locale/*.json`

`locale/en.json` 与 `locale/zh.json` 提供**插件展示元数据**（`meta.title` / `meta.description`），
Plugin Manager 与设置页**无需激活插件**即可读取，用于显示本地化的插件名与说明。
这与上面 ① 的运行时 UI 文案是两套东西。

```json
{ "meta": { "title": "…", "description": "…" } }
```

⚠️ 两个容易漏的点（漏任一个都会**静默失效**，不报错）：

1. **必须在 `package.json` 的 `exports` 里导出 `./locale/*.json`** —— 宿主经 Node 模块解析器
   读取该资源，未导出的子路径会得到 `ERR_PACKAGE_PATH_NOT_EXPORTED`，被当作「没有 locale」跳过。
2. **`files` 需包含 `locale`** —— 否则 `pnpm pack` / `npm publish` 的产物里不会带上它。

`icon.svg` 走顶层 `icon` 字段（相对路径），**不需要** `exports`。

## 设计说明

本包**不 import 任何 `@deepseek-ai/*` 包**。作为树外插件包，插件目录下没有 `node_modules`，`import '@deepseek-ai/dsh-tools'` 会抛 `ERR_MODULE_NOT_FOUND`，宿主侧表现为 `failed to import`、插件根本装载不上。

因此工具定义是**手写对象**（零 dsh 依赖）：`{ name, description, parameters, output, execute }`，其中 `parameters` 是**显式 JSON Schema 根对象**。这与官方 `defineTool` 语法糖编译出的形状等价。

客户端 bundle 仅 `require` 平台种子表内的模块（`react` 与
`@deepseek-ai/dsh-client-ui-primitives`）；`slots` / `locale` 两个服务走 `dsh.client.inject` 声明。

## 许可证

MIT © felixpu

## 仓库

<https://github.com/felixpu/dsh-env-inspector-plus>
