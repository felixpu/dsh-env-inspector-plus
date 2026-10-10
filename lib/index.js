/**
 * dsh-env-inspector —— 环境体检的**宿主半身**。
 *
 * 一条主线：把「当前宿主进程的事实」采集成一份只读快照，供两个消费者使用 ——
 *
 *  1. 模型：`env_inspect` 工具（本文件注册）；
 *  2. 网页：「设置 → 环境体检」分页（客户端半身经下面这条同源路由取数）。
 *
 * 采什么：
 *  - 宿主身份：进程 id、入口脚本、工作目录、Node 版本、平台、运行时长；
 *  - 环境变量分组：总数、DSH 前缀组、凭证形态组（KEY/PASSWORD/SECRET/TOKEN，
 *    与 `@deepseek-ai/dsh-subprocess` 的剥离规则同源）、其余；
 *  - 敏感判定：**凭证形态变量的值一律不出宿主** —— 命中的键只回布尔与长度，
 *    明文绝不进模型上下文、也绝不进 HTTP 响应体。
 *
 * ## 「值不出宿主」的准确边界
 *
 * 严格说，快照里确实有几个字段携带**环境变量的原值** —— `host.cwd`、
 * `host.profileDir`、`host.profile`、`host.entry`。它们分别等于 `PWD` /
 * `DSH_PROFILE_DIR` / `DSH_PROFILE` / 启动参数里的入口路径。这是刻意的：
 * 「当前在哪个目录跑、用哪个 profile」正是体检最该回答的问题，掩掉就等于把
 * 主要用途删了；而且这几个值本来就会出现在会话里（会话头部、工具调用记录）。
 *
 * 所以本插件的承诺范围是精确的：**逐条变量清单（`env.entries` 与两组键名）
 * 只含键名与元数据，绝不含任何环境变量的值**；唯一取值的地方是上面那四个
 * host 身份字段，且都是路径类、非凭证。实测方式见本仓库的验证记录：
 * 对全部环境变量的值做一遍子串穷举，命中快照的只有这四项。
 *
 * ## 为什么值是掩码而不是明文
 *
 * DSH 在 spawn 子进程时会剥离凭证形态的变量，官方注释写明「隐式继承被禁，
 * 显式提供放行」；而工具调用正是一条「显式提供」的通路（不经 spawn）。本插件
 * 刻意**不使用**这条通路去取值 —— 它的用途是「体检」（看清有哪些变量、归哪组、
 * 有没有设值），不是「取密」。要看明文请用 dsh-settings-params 的
 * `env_param_get`，那条路有独立的显式授权。
 *
 * ## 关于 `DSH_` 前缀那一组的长度
 *
 * `DSH_SESSION_ID`、`DSH_*` 等由宿主在启动会话时写进自身环境，数量随会话变化。
 * 因此本插件对每个变量只回 **键名 + 三个布尔（是否以 DSH 开头 / 是否命中凭证
 * 形态 / 是否已设值）+ 长度**，不回值 —— 这样即使会话标识出现在键名里，也不
 * 会把任何可复用的凭证内容带出去。
 *
 * ## 为什么不 import `@deepseek-ai/dsh-tools`
 *
 * 官方教程 `develop/basic/tool` 用 `defineTool`，但那是**写在 dsh 源码 checkout
 * 里**的开发姿势：checkout 内 `@deepseek-ai/*` 可由 workspace 解析。本仓库是
 * **树外插件包**，profile 只把它软链进 `node_modules`，插件目录下没有
 * `node_modules`，`import '@deepseek-ai/dsh-tools'` 会抛
 * `ERR_MODULE_NOT_FOUND`，宿主侧表现为 `failed to import` —— 插件根本装载不上。
 *
 * 因此这里与 `dsh-settings-params` 一致：**手写工具定义对象**，零 dsh 依赖。
 * `defineTool` 的源码证实它只是语法糖 —— 把「隐式参数 DSL」编译成 JSON Schema、
 * 再包一层参数校验后交给注册表。注册表真正需要的形状是
 * `{ name, description, parameters(JSON Schema), output: { schema, render }, execute }`，
 * 手写完全等价。
 *
 * 代价：参数不走 `defineTool` 的自动校验（工具名、schema 合法性仍需自己保证），
 * 换来的是「装得上」这个前提。本文件顶部的 `parameters` 因此是**显式 JSON
 * Schema**，与 `output.schema` 同一种根约定，不再有两套约定的坑。
 *
 * @module dsh-env-inspector-plus
 */

/** cordis 插件名，与 cordis 条目名、client bundle id 保持一致。 */
export const name = 'dsh-env-inspector-plus';

/** 注册路由要用宿主 Web 服务；工具注册表必须在注册工具前就绪。 */
export const inject = ['tools', 'webServer'];

/**
 * 凭证形态变量的判定 —— 与 DSH 子进程剥离规则同源。
 *
 * 官方在 spawn 子进程时按 `DSH_` 前缀或该正则剥离变量，这里沿用同一套判定，
 * 好处是「本页标红的变量」与「子代理 bash 里读不到的变量」**恰好是同一批**，
 * 用户看到的分组不会与真实行为对不上。
 */
const CREDENTIAL_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/i;

/** 单次响应里最多的变量条数，防止极端环境下把响应撑爆。 */
const MAX_ENTRIES = 400;

/**
 * 取一个环境变量的「指纹」：只有键名、布尔与长度，**不含值**。
 * @param key - 变量名。
 * @param value - 变量值（仅用于取长度，绝不外传）。
 * @returns 一条只读记录。
 */
function fingerprint(key, value) {
  return {
    key,
    dshPrefixed: key.startsWith('DSH_'),
    credentialLike: CREDENTIAL_PATTERN.test(key),
    set: value !== undefined && value !== '',
    length: value === undefined ? 0 : value.length,
  };
}

/**
 * 采集当前宿主进程的只读快照。
 * @returns 可直接 JSON 序列化、也可直接回给模型的快照对象。
 */
export function snapshot() {
  const entries = [];
  // 键名排序后遍历：输出稳定，便于用户在不同时刻对比两份快照。
  for (const key of Object.keys(process.env).sort()) {
    if (entries.length >= MAX_ENTRIES) break;
    entries.push(fingerprint(key, process.env[key]));
  }

  const credentialLike = entries.filter((entry) => entry.credentialLike);
  const dshPrefixed = entries.filter((entry) => entry.dshPrefixed);

  return {
    host: {
      pid: process.pid,
      // argv[1] 是入口脚本；源码执行或打包执行都会给出真实路径，便于确认在跑哪份代码。
      entry: process.argv[1] ?? '',
      cwd: process.cwd(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.round(process.uptime()),
      profile: process.env.DSH_PROFILE ?? '',
      // 注意语义：这两项读的是**宿主进程自身**的环境变量，不是「当前会话用了哪个
      // profile」。宿主若以 `dsh web` 直接拉起（命令行不带 --profile），进程里就
      // 没有这两个变量，返回空串 —— 这不代表 profile 未生效，而子系统拉起时
      // （launchd/systemd/Windows 服务）正是这种情形。空串即「本进程未声明」。
      profileDir: process.env.DSH_PROFILE_DIR ?? '',
    },
    env: {
      total: entries.length,
      truncated: Object.keys(process.env).length > MAX_ENTRIES,
      dshPrefixedCount: dshPrefixed.length,
      credentialLikeCount: credentialLike.length,
      // 只列命中的**键名**，不含值 —— 页面据此渲染分组表。
      credentialLikeKeys: credentialLike.map((entry) => entry.key),
      dshPrefixedKeys: dshPrefixed.map((entry) => entry.key),
      entries,
    },
    collectedAt: new Date().toISOString(),
  };
}

/**
 * `env_inspect` 工具：让模型读到与设置页同一份快照。
 *
 * 纯读、无副作用、不碰磁盘与网络；返回值里没有任何环境变量的**值**。
 */
const envInspectTool = {
  name: 'env_inspect',
  description:
    '体检当前 DSH 宿主进程：返回进程 id / 入口脚本 / 工作目录 / Node 版本 / 运行时长，'
    + '以及环境变量的分组统计（总数、DSH_ 前缀组、凭证形态组）与逐条指纹（键名、是否已设值、长度）。'
    + '**绝不返回任何变量的值** —— 需要读取某个变量明文请改用 dsh-settings-params 的 env_param_get。',
  // 显式 JSON Schema 根对象：手写定义时 parameters 就是最终 schema，无隐式根转换。
  parameters: {
    type: 'object',
    properties: {
      includeEntries: {
        type: 'boolean',
        description: '是否返回逐条变量指纹（默认 false，只回分组统计与键名清单）。',
      },
    },
    additionalProperties: false,
  },
  // output.schema 走 ValueSchemaSpec：显式根对象，additionalProperties 必填。
  output: {
    schema: {
      type: 'object',
      properties: {
        host: {
          type: 'object',
          properties: {
            pid: { type: 'integer' },
            entry: { type: 'string' },
            cwd: { type: 'string' },
            nodeVersion: { type: 'string' },
            platform: { type: 'string' },
            arch: { type: 'string' },
            uptimeSeconds: { type: 'integer' },
            profile: { type: 'string' },
            profileDir: { type: 'string' },
          },
          additionalProperties: false,
        },
        env: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            truncated: { type: 'boolean' },
            dshPrefixedCount: { type: 'integer' },
            credentialLikeCount: { type: 'integer' },
            credentialLikeKeys: { type: 'array', items: { type: 'string' } },
            dshPrefixedKeys: { type: 'array', items: { type: 'string' } },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  dshPrefixed: { type: 'boolean' },
                  credentialLike: { type: 'boolean' },
                  set: { type: 'boolean' },
                  length: { type: 'integer' },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
        collectedAt: { type: 'string' },
      },
      additionalProperties: false,
    },
    render: (_args, value) => {
      const lines = [
        `宿主：pid ${value.host.pid}，Node ${value.host.nodeVersion}，${value.host.platform}/${value.host.arch}`,
        `入口：${value.host.entry || '(未知)'}`,
        `工作目录：${value.host.cwd}`,
        `已运行：${value.host.uptimeSeconds} 秒`,
        `环境变量：共 ${value.env.total} 个，其中 DSH_ 前缀 ${value.env.dshPrefixedCount} 个、`
          + `凭证形态 ${value.env.credentialLikeCount} 个`,
      ];
      if (value.env.credentialLikeKeys.length > 0) {
        lines.push(`凭证形态键名：${value.env.credentialLikeKeys.join('、')}`);
      }
      if (value.env.truncated) lines.push('（变量过多，仅列出前若干条）');
      return [{ type: 'text', text: lines.join('\n') }];
    },
  },
  execute(args) {
    const full = snapshot();
    // 默认只回统计与键名：逐条指纹对模型通常无用，省下的是上下文 token。
    if (args === undefined || args === null || args.includeEntries !== true) delete full.env.entries;
    return full;
  },
};

/**
 * cordis 插件入口。
 * @param ctx - 宿主上下文。
 */
export function apply(ctx) {
  ctx.effect(() => ctx.tools.register(envInspectTool), 'dsh-env-inspector: env_inspect tool');

  // 同源只读路由：客户端半身的设置分页每次打开/刷新都重新取一遍，
  // 因此页面上看到的一定是「此刻的宿主」，不存在陈旧快照问题。
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-env-inspector/snapshot',
    handler: (_request, response) => {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        // 只读且含会话相关键名，禁止任何中间层缓存。
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify({ ok: true, data: snapshot() }));
    },
  }), 'dsh-env-inspector: snapshot route');
}
