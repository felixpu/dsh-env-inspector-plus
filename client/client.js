// dsh-env-inspector-plus —— 环境体检的**浏览器半身**。
//
// 形态照官方模板 `cordis-plugin-development/templates/decoration/client.js`：
// 一个 `__ModuleLoader__.load({ id, factory })`，factory 里 `return` 插件对象。
//
// ⚠️ 只允许 require 平台种子表内的模块。本文件只用 react 与
//    @deepseek-ai/dsh-client-ui-primitives；槽位与多语言服务走 package.json 里
//    `dsh.client.inject` 声明的 "@deepseek-ai/dsh-client-ui-slots" 与
//    "@deepseek-ai/dsh-client-locale"。
//
// 契约来源（均经 cordis_inspect_query 实时核对 + 读平台源码，非猜测）：
//
// 1) 设置分页 = `settings.section` 槽（kind=list, scope=root），注册选项
//    `{ id, order, label }`。id 用自己的（见下方 SECTION_ID）→ 作为**新增一格**
//    与「通用 / 模型 / 插件」并列；若复用已存在的 id 会**顶掉**那一格。
//
// 2) 该槽 ownerProps 只有 `{ close }`，正文自身拿不到宿主数据，因此数据经
//    宿主半身的同源只读路由（见下方 SNAPSHOT_URL）取 —— 与
//    dsh-settings-params 的取数方式一致。
//
// 3) 主题 token 只使用 Theme.listTokens 实报名单里的 14 个别名 token；
//    明暗两套由主题层自行切换，本文件不写死任何颜色。
//
// 4) 界面文案走平台官方 locale 服务：`ctx.locale.register(NS, {zh, en})` +
//    `ctx.locale.bind(NS)`，每个 `ctx.slots.register` 带 `locale: NS` ——
//    渲染器（dsh-client-ui-renderer 的 standardKit()）会据此把 `t` 座位
//    自动注入组件 props，因此**不需要**再写 `inject: () => ({ t })`。
//    设置分页的 `label` 用**函数**（`SlotLabel = string | (() => string)`），
//    导航行每次读取时求值，语言切换后不用重新注册就能跟着变。
//
// ⚠️ bundle id 必须等于 **npm 包名**（dsh-client-modules 校验：
//    "bundle loaded without registering <包名> via __ModuleLoader__.load"）。
//    本包因 npm 上 `dsh-env-inspector` 已被第三方占用（geeklei，0.3.0）而改名，
//    故下方 id 与 locale 命名空间用 dsh-env-inspector-plus。
//    而 SECTION_ID / SNAPSHOT_URL 属于**运行时标识**，保持原名不变，
//    以免既有 profile 的注册点与已装状态失效。
window.__ModuleLoader__.load({
  id: 'dsh-env-inspector-plus',
  factory(require) {
    var React = require('react');
    var h = React.createElement;

    // 平台共享组件（均在种子表内）。取不到的项退化为自绘，
    // 不让「少一个可选项」把整页拖垮 —— 与 dsh-settings-params 同一套防御写法。
    var primitives = null;
    try { primitives = require('@deepseek-ai/dsh-client-ui-primitives'); } catch (e) { primitives = null; }
    var DisclosureRow = primitives && typeof primitives.DisclosureRow === 'function' ? primitives.DisclosureRow : null;
    var IconInfo = primitives && typeof primitives.IconInfoOutlineRegular === 'function' ? primitives.IconInfoOutlineRegular : null;
    var IconTool = primitives && typeof primitives.IconSparkleRegular === 'function' ? primitives.IconSparkleRegular : null;

    var SECTION_ID = 'dsh-env-inspector';
    var SNAPSHOT_URL = '/dsh-env-inspector/snapshot';

    // ── 文案字典（官方 locale 服务；中英双语必须成对）────────────────────
    //
    // ⚠️ 命名空间用**包名**，绝不复用官方或他人命名空间 —— 同名会撞
    //    （duplicate (ns, locale) 会抛错）。这里刻意不用运行时的 SECTION_ID
    //    ('dsh-env-inspector')：npm 上存在同名第三方包，撞名会互相顶掉字典。
    //
    // ⚠️ 每条都是**一个完整句子**，变量用 `{name}` 占位（平台按
    //    /\{(\w+)\}/g 替换）。不要拆成片段再拼接：英文语序与中文不同
    //    （"Up 2 d 3 h" vs 「已运行 2 天 3 小时」），拼接式无法重排，
    //    片段本身也成了需要翻译的字符串。
    //
    // ⚠️ 平台 `common` 命名空间已有的通用词**刻意不定义**，直接复用
    //    （lookup 在本命名空间未命中后会自动回落 common）。
    var NS = 'dsh-env-inspector-plus';

    var zh = {
      'section.label': '环境体检',
      // 页头
      'head.sub': '变量值一律不出宿主。',
      'head.subCollected': '采集于 {time}　·　变量值一律不出宿主。',
      'action.reload': '重新采集',
      'action.reloading': '读取中…',
      'state.loading': '正在读取宿主快照…',
      'state.truncated': '变量总数超出上限，清单只列出前若干条。',
      // 错误（宿主只回机器可读 code，见 code.* 键）
      'error.http': 'HTTP {status}',
      'error.badResponse': '响应结构不符合预期',
      'error.fetchFailed': '读取宿主快照失败：{msg}',
      'code.snapshot-failed': '宿主采集环境变量快照时出错',
      // 宿主身份
      'host.title': '宿主',
      'host.cwd': '目录',
      'host.entry': '入口',
      'host.profile': 'Profile',
      'host.uptime': '已运行 {uptime}',
      'host.profileMissing': '宿主环境未声明 Profile —— 这不影响使用。',
      'value.unknown': '(未知)',
      // 运行时长（每种粒度都是一个完整句式）
      'uptime.days': '{d} 天 {h} 小时',
      'uptime.hours': '{h} 小时 {m} 分',
      'uptime.minutes': '{m} 分 {s} 秒',
      'uptime.seconds': '{s} 秒',
      // 环境变量
      'env.title': '环境变量',
      'bar.all': '全部',
      'bar.dsh': 'DSH_ 前缀',
      'bar.credential': '凭证形态',
      'bar.plain': '其余',
      'keygroup.credential': '凭证形态',
      'keygroup.dsh': 'DSH_ 前缀',
      'note.subagentHidden': '子代理 bash 默认读不到',
      'note.credentialHit': '变量名命中凭证形态；值不出宿主',
      'note.valueSet': '已设值，长度 {len}',
      'note.valueUnset': '未设值',
      'hint.grant': '需要明文？到 dsh-settings-params 的插件页开启该变量的模型读取授权。',
      // 折叠区
      'fold.terms': '术语与说明',
      'fold.tools': '相关工具',
      'term.credential': '凭证形态',
      'doc.credential': '变量名含 KEY / PASSWORD / SECRET / TOKEN（不区分大小写）。与 DSH 派生子进程时的剥离规则同源，因此这一组在子代理的 bash 里默认读不到。',
      'term.dsh': 'DSH_ 前缀',
      'doc.dsh': '由宿主写入，数量随会话变化，每次采集的数字都可能不同。',
      'term.profile': 'Profile 未声明',
      'doc.profile': '本页读的是宿主进程自身的环境变量 DSH_PROFILE / DSH_PROFILE_DIR。宿主若以 dsh web 直接拉起（命令行不带 --profile），进程里就没有它们 —— 这不代表 profile 没生效，只是该进程没在自己的环境里声明。',
      'term.privacy': '本页只显示变量名',
      'doc.privacy': '不含任何变量的值；快照的路由与工具都不回传明文。',
      'doc.tools': '模型可调用 env_inspect 工具读取同一份快照（默认只回统计与键名清单，不回值）。',
    };

    var en = {
      'section.label': 'Environment inspection',
      // Page head
      'head.sub': 'Variable values never leave the Host.',
      'head.subCollected': 'Collected at {time} · Variable values never leave the Host.',
      'action.reload': 'Recollect',
      'action.reloading': 'Reading…',
      'state.loading': 'Reading the Host snapshot…',
      'state.truncated': 'The variable count exceeded the limit; only the first entries are listed.',
      // Errors (the Host returns machine-readable codes only, see the code.* keys)
      'error.http': 'HTTP {status}',
      'error.badResponse': 'Unexpected response shape',
      'error.fetchFailed': 'Failed to read the Host snapshot: {msg}',
      'code.snapshot-failed': 'the Host failed to collect the environment snapshot',
      // Host identity
      'host.title': 'Host',
      'host.cwd': 'Directory',
      'host.entry': 'Entry',
      'host.profile': 'Profile',
      'host.uptime': 'Up {uptime}',
      'host.profileMissing': 'The Host environment declares no Profile — this does not affect usage.',
      'value.unknown': '(unknown)',
      // Uptime (one complete phrasing per granularity)
      'uptime.days': '{d} d {h} h',
      'uptime.hours': '{h} h {m} min',
      'uptime.minutes': '{m} min {s} s',
      'uptime.seconds': '{s} s',
      // Environment variables
      'env.title': 'Environment variables',
      'bar.all': 'All',
      'bar.dsh': 'DSH_ prefix',
      'bar.credential': 'Credentials',
      'bar.plain': 'Other',
      'keygroup.credential': 'Credential-shaped',
      'keygroup.dsh': 'DSH_ prefix',
      'note.subagentHidden': 'Not readable in a subagent bash by default',
      'note.credentialHit': 'The name matches the credential shape; the value stays on the Host',
      'note.valueSet': 'Value set, length {len}',
      'note.valueUnset': 'No value',
      'hint.grant': 'Need the plaintext? Enable model read access for this variable on the dsh-settings-params plugin page.',
      // Disclosure sections
      'fold.terms': 'Terms and notes',
      'fold.tools': 'Related tools',
      'term.credential': 'Credential-shaped',
      'doc.credential': 'The variable name contains KEY / PASSWORD / SECRET / TOKEN (case-insensitive). This matches the DSH subprocess stripping rule, so this group is not readable in a subagent bash by default.',
      'term.dsh': 'DSH_ prefix',
      'doc.dsh': 'Written by the Host; the count changes per session, so each collection may report different numbers.',
      'term.profile': 'Profile not declared',
      'doc.profile': 'This page reads the Host process own environment variables DSH_PROFILE / DSH_PROFILE_DIR. When the Host is started directly with dsh web (no --profile on the command line), they are absent from the process — that does not mean the profile is inactive, only that this process did not declare it in its own environment.',
      'term.privacy': 'This page shows variable names only',
      'doc.privacy': 'It carries no variable values; neither the snapshot route nor the tool ever returns plaintext.',
      'doc.tools': 'The model can call the env_inspect tool to read the same snapshot (by default it returns only the statistics and the key lists, never values).',
    };

    // 宿主只回**机器可读的 code**（如 'snapshot-failed'），面向用户的文案一律
    // 归客户端字典所有 —— 这样宿主不必知道 UI 语言，切换语言后文案也跟着变。
    // 白名单式映射：未知 code 一律退回调用方给的兜底文案，
    // **绝不把 `code.xxx` 这种 key 名显示给用户**（那等于泄漏实现细节）。
    var HOST_CODES = Object.create(null);
    HOST_CODES['snapshot-failed'] = 'code.snapshot-failed';

    /**
     * 把宿主返回的 code 映射成本命名空间的字典键。
     * @param code - 宿主响应体里的 `code`（可能不存在或不是字符串）。
     * @returns 命中的字典键；未命中返回 undefined。
     */
    function hostCodeKey(code) {
      return typeof code === 'string' ? HOST_CODES[code] : undefined;
    }

    /**
     * 造一个**带描述符的 Error**：`deiCode` 存字典键与参数，`message` 保留 key 名
     * 便于调试。用 Error 而不是裸对象抛出，是为了保留堆栈、且不与平台自身抛出的
     * 异常形态混淆。
     * @param key - 字典键。
     * @param params - 占位符参数（可省略）。
     * @returns 待抛出的错误。
     */
    function fail(key, params) {
      var error = new Error(key);
      error.deiCode = { key: key, params: params };
      return error;
    }

    var CSS = [
      '.dei-root{display:flex;flex-direction:column;gap:14px;padding:2px 0 20px;min-width:0;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.dei-head{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}',
      '.dei-title{margin:0;font-size:15px;line-height:24px;font-weight:600}',
      '.dei-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dei-actions{margin-left:auto;display:flex;gap:8px;flex:none}',
      '.dei-btn{font:inherit;font-size:12px;padding:5px 12px;border-radius:8px;cursor:pointer;',
      'border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.dei-btn:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dei-btn:disabled{opacity:.55;cursor:default}',

      // 一处摘要行：把 pid / 平台 / Node / 运行时长 / Profile 这些**同质的短信息**
      // 并排放，不再各占一张卡片（原先 5 张卡片占掉首屏一半高度）。
      '.dei-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}',
      '.dei-chip{font-size:12px;line-height:20px;padding:1px 9px;border-radius:999px;',
      'background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dei-dot{color:var(--dsw-alias-label-tertiary);font-size:11px}',

      // 路径行：标签定宽 + 路径省略中段，长路径不再把行撑爆。
      // 标签宽度按**英文**最长者（"Directory"）留量，中文标签只会更短。
      '.dei-paths{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dei-path-row{display:flex;align-items:baseline;gap:10px;min-width:0}',
      '.dei-path-label{flex:none;width:70px;font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.dei-path-value{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

      '.dei-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:500}',
      '.dei-section{display:flex;flex-direction:column;gap:9px;min-width:0}',
      '.dei-section-title{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;line-height:20px;font-weight:600}',
      // 标题旁的数量徽标：让「有几个」只在标题出现一次，正文不再复述。
      '.dei-count{font-size:11px;line-height:17px;padding:0 7px;border-radius:999px;font-weight:500;',
      'background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.dei-count-warn{background:transparent;border:.5px solid var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}',

      '.dei-bars{display:flex;flex-direction:column;gap:8px}',
      '.dei-bar-row{display:flex;align-items:center;gap:10px;min-width:0}',
      '.dei-bar-name{flex:none;width:88px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dei-bar-track{flex:1;height:8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;min-width:40px}',
      '.dei-bar-fill{height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary)}',
      '.dei-bar-fill-warn{background:var(--dsw-alias-state-warn-primary)}',
      '.dei-bar-fill-error{background:var(--dsw-alias-state-error-primary)}',
      '.dei-bar-num{flex:none;width:40px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}',

      // 键名清单分组：与上面的条形图同属一区，用小标题分隔而不是各自独立成区。
      '.dei-keygroup{display:flex;flex-direction:column;gap:7px;min-width:0;padding-top:2px}',
      '.dei-keygroup-title{display:flex;align-items:center;gap:8px;font-size:12px;line-height:18px;',
      'color:var(--dsw-alias-label-primary);font-weight:500}',
      '.dei-tags{display:flex;flex-wrap:wrap;gap:6px;min-width:0}',
      '.dei-key{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:18px;',
      'padding:1px 7px;border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);',
      'overflow-wrap:anywhere;max-width:100%}',
      '.dei-key-warn{color:var(--dsw-alias-state-warn-primary)}',

      // 提示/说明：统一为弱化的一行小字，不再与数据争视觉权重。
      '.dei-hint{margin:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}',
      '.dei-hint-inline{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);font-weight:400}',

      // 折叠区（术语与说明 / 相关工具）。展开后的正文在此排版。
      '.dei-fold{margin-top:2px}',
      '.dei-fold-body{padding:2px 0 6px 22px;display:flex;flex-direction:column;gap:6px}',
      '.dei-doc{display:flex;flex-direction:column;gap:10px;font-size:12px;line-height:19px;',
      'color:var(--dsw-alias-label-secondary);max-width:76ch}',
      '.dei-doc p{margin:0}',
      // 术语用独立小标题承载，而不是把一句话拆成「粗体词 + 半句」再拼起来
      // —— 拆句拼接在语序不同的语言里没法重排，也无法整句翻译。
      '.dei-doc-item{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dei-doc-term{color:var(--dsw-alias-label-primary);font-weight:600}',
      '.dei-fold-fallback{display:flex;flex-direction:column;gap:7px}',

      '.dei-err{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}',
      '.dei-empty{padding:18px 0;font-size:12px;color:var(--dsw-alias-label-secondary);text-align:center}',
    ].join('');

    // 样式表挂在 document.head 上，用 data 属性标记归属，卸载时按标记精确移除。
    // 幂等：重复 apply（HMR）不会叠加第二份。
    function installStyles() {
      var marker = 'dsh-env-inspector/page.css';
      if (document.querySelector('style[data-plugin-css="' + marker + '"]') !== null) return function () {};
      var tag = document.createElement('style');
      tag.setAttribute('data-plugin-css', marker);
      tag.setAttribute('data-plugin', 'dsh-env-inspector');
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return function () {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
      };
    }

    /**
     * 把运行秒数格式化成一个**完整短语**（每种粒度一个字典键）。
     *
     * ⚠️ 刻意不用「数字 + 单位片段」拼接：中英文的语序与单位写法都不同
     *    （`2 天 3 小时` vs `2 d 3 h`），拼接式无法重排。这里每个分支都是一整句。
     * @param seconds - 运行秒数。
     * @param t - 本命名空间的翻译函数。
     * @returns 可读短语；入参非法时返回破折号。
     */
    function formatUptime(seconds, t) {
      if (typeof seconds !== 'number' || !isFinite(seconds) || seconds < 0) return '—';
      var d = Math.floor(seconds / 86400);
      var hrs = Math.floor((seconds % 86400) / 3600);
      var mins = Math.floor((seconds % 3600) / 60);
      var secs = seconds % 60;
      if (d > 0) return t('uptime.days', { d: d, h: hrs });
      if (hrs > 0) return t('uptime.hours', { h: hrs, m: mins });
      if (mins > 0) return t('uptime.minutes', { m: mins, s: secs });
      return t('uptime.seconds', { s: secs });
    }

    function formatClock(iso) {
      if (typeof iso !== 'string' || iso === '') return '—';
      var date = new Date(iso);
      if (isNaN(date.getTime())) return '—';
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
    }

    // ── 小组件 ────────────────────────────────────────────────────────────

    /**
     * 把 `v22.22.0` 压成 `Node 22`。
     *
     * 宿主身份这一行是**摘要**（下面还有完整信息），不该让一个版本号占掉
     * 半行宽度；`v22.22.0` 里真正有辨识度的只有主版本号。
     * @param version - `process.version` 原样。
     * @returns 简短标签。
     */
    function serverNodeLabel(version) {
      var m = /^v?(\d+)/.exec(String(version));
      return m === null ? String(version) : 'Node ' + m[1];
    }

    /** 一行「标签 + 等宽路径」，路径过长时省略中段。 */
    function PathRow(props) {
      return h('div', { className: 'dei-path-row' },
        h('span', { className: 'dei-path-label' }, props.label),
        h('span', { className: 'dei-path-value dei-mono', title: props.value }, props.value),
      );
    }

    function Bar(props) {
      var total = props.total > 0 ? props.total : 1;
      var ratio = Math.max(0, Math.min(1, props.value / total));
      var fillClass = 'dei-bar-fill' + (props.tone === undefined ? '' : ' dei-bar-fill-' + props.tone);
      return h('div', { className: 'dei-bar-row' },
        h('span', { className: 'dei-bar-name' }, props.label),
        h('span', { className: 'dei-bar-track' },
          h('span', { className: fillClass, style: { width: (ratio * 100).toFixed(1) + '%' } })),
        h('span', { className: 'dei-bar-num' }, String(props.value)),
      );
    }

    function KeyTag(props) {
      return h('code', {
        className: props.warn === true ? 'dei-key dei-key-warn' : 'dei-key',
        title: props.note === undefined ? props.children : props.note,
      }, props.children);
    }

    /** 一条说明：术语做独立小标题，正文是**一整句**译文（不做片段拼接）。 */
    function DocItem(props) {
      return h('div', { className: 'dei-doc-item' },
        h('div', { className: 'dei-doc-term' }, props.term),
        h('p', null, props.body),
      );
    }

    /** 设置分页正文。data 为 null 时渲染加载态，failure 非空时渲染错误态。 */
    function EnvInspectorSection(props) {
      // `t` 由插槽渲染器按注册选项 `locale: NS` 自动注入（standardKit）。
      var t = props.t;

      var state = React.useState(null);
      var data = state[0];
      var setData = state[1];
      // ⚠️ 存的是**失败描述符**（字典键 + 参数）而不是已经翻好的句子：
      //    句子存在 state 里就固定成了取数那一刻的语言，切换语言后错误文案
      //    会停在旧语言（直到用户再点一次「重新采集」）。存描述符则每次渲染
      //    用当前 `t` 现算，语言切换即时生效。
      var failState = React.useState(null);
      var failure = failState[0];
      var setFailure = failState[1];
      var busyState = React.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];

      var load = React.useCallback(function () {
        setBusy(true);
        fetch(SNAPSHOT_URL, { headers: { accept: 'application/json' }, cache: 'no-store' })
          .then(function (response) {
            // 先把包体解析出来：宿主失败时也回同一信封（{ ok: false, code }），
            // 只有拿不到 JSON 时才退回 HTTP 状态码（例如被数据闸拦成 401）。
            return response.json().catch(function () {
              throw fail('error.http', { status: response.status });
            });
          })
          .then(function (payload) {
            if (payload === null || typeof payload !== 'object') {
              throw fail('error.badResponse');
            }
            if (payload.ok !== true) {
              // 宿主只回机器可读 code（见 HOST_CODES）；翻不出来就用通用文案。
              var key = hostCodeKey(payload.code);
              throw fail(key === undefined ? 'error.badResponse' : key);
            }
            setData(payload.data);
            setFailure(null);
          })
          .catch(function (cause) {
            // 两种形态：上面主动抛的「描述符 Error」，或 fetch 自身的异常对象。
            if (cause !== null && typeof cause === 'object' && cause.deiCode !== undefined) {
              setFailure(cause.deiCode);
              return;
            }
            setFailure({
              key: 'error.fetchFailed',
              params: { msg: cause && cause.message ? cause.message : String(cause) },
            });
          })
          .then(function () { setBusy(false); });
      }, []);

      // 面板挂载即取一次；只读接口，无需轮询。
      React.useEffect(function () {
        load();
      }, [load]);

      var head = h('div', { className: 'dei-head' },
        h('div', { style: { minWidth: 0 } },
          h('h2', { className: 'dei-title' }, t('section.label')),
          h('p', { className: 'dei-sub' },
            data === null ? t('head.sub') : t('head.subCollected', { time: formatClock(data.collectedAt) }))),
        h('div', { className: 'dei-actions' },
          h('button', {
            type: 'button', className: 'dei-btn', disabled: busy,
            onClick: load,
          }, busy ? t('action.reloading') : t('action.reload'))),
      );

      if (failure !== null) {
        return h('div', { className: 'dei-root' }, head,
          h('p', { className: 'dei-err' }, t(failure.key, failure.params)));
      }
      if (data === null) {
        return h('div', { className: 'dei-root' }, head, h('div', { className: 'dei-empty' }, t('state.loading')));
      }

      var host = data.host;
      var env = data.env;
      var credential = env.credentialLikeKeys;
      var dshKeys = env.dshPrefixedKeys;
      var plainCount = env.total - dshKeys.length;
      var profileMissing = host.profile === '';

      // ── 一个可折叠区块。平台组件缺席时退化为直接展开（信息不丢）。 ──
      function Fold(props) {
        var openState = React.useState(false);
        var open = openState[0];
        var setOpen = openState[1];
        if (DisclosureRow === null) {
          // 无平台组件：直接平铺，内容仍在，只是不能收起。
          return h('div', { className: 'dei-fold-fallback' },
            h('div', { className: 'dei-section-title' }, props.title), props.children);
        }
        return h(DisclosureRow, {
          icon: props.icon === undefined ? null : props.icon,
          title: props.title,
          open: open,
          expandable: true,
          onToggle: function () { setOpen(!open); },
          expandOnRowClick: true,
          keepContentWhenOpen: true,
          className: 'dei-fold',
          rowClassName: 'dei-fold-row',
          titleClassName: 'dei-fold-title',
          contentClassName: 'dei-fold-content',
        }, h('div', { className: 'dei-fold-body' }, props.children));
      }

      return h('div', { className: 'dei-root' },
        head,

        // ── ① 宿主：同质的短信息压成一行，不再各占一张卡片 ──
        h('div', { className: 'dei-section' },
          h('h3', { className: 'dei-section-title' }, t('host.title')),
          h('div', { className: 'dei-summary' },
            h('span', { className: 'dei-chip dei-mono' }, 'pid ' + String(host.pid)),
            h('span', { className: 'dei-dot' }, '·'),
            h('span', { className: 'dei-chip dei-mono' }, host.platform + '/' + host.arch),
            h('span', { className: 'dei-dot' }, '·'),
            h('span', { className: 'dei-chip dei-mono' }, serverNodeLabel(host.nodeVersion)),
            h('span', { className: 'dei-dot' }, '·'),
            h('span', { className: 'dei-chip' }, t('host.uptime', { uptime: formatUptime(host.uptimeSeconds, t) })),
            profileMissing
              ? null
              : h('span', { className: 'dei-chip dei-mono' }, host.profile),
          ),
          h('div', { className: 'dei-paths' },
            h(PathRow, { label: t('host.cwd'), value: host.cwd }),
            h(PathRow, { label: t('host.entry'), value: host.entry === '' ? t('value.unknown') : host.entry }),
            profileMissing ? null : h(PathRow, { label: t('host.profile'), value: host.profileDir }),
          ),
          // 原来这里常驻 131 字的解释；现在只在真有异常时给一句短提示，
          // 细节收进下方「说明」折叠区。
          profileMissing
            ? h('p', { className: 'dei-hint' }, t('host.profileMissing'))
            : null,
        ),

        // ── ② 环境变量：图 + 两份键名清单合成一区（它们是同一件事的三个视角） ──
        h('div', { className: 'dei-section' },
          h('h3', { className: 'dei-section-title' },
            t('env.title'),
            h('span', { className: 'dei-count' }, String(env.total))),

          h('div', { className: 'dei-bars' },
            h(Bar, { label: t('bar.all'), value: env.total, total: env.total }),
            h(Bar, { label: t('bar.dsh'), value: dshKeys.length, total: env.total }),
            h(Bar, {
              label: t('bar.credential'), value: credential.length, total: env.total,
              tone: credential.length > 0 ? 'warn' : undefined,
            }),
            h(Bar, { label: t('bar.plain'), value: plainCount, total: env.total }),
          ),

          env.truncated === true
            ? h('p', { className: 'dei-err' }, t('state.truncated'))
            : null,

          // 键名清单：只在非空时出现。标题带数量（下不再复述数字）。
          credential.length === 0
            ? null
            : h('div', { className: 'dei-keygroup' },
                h('div', { className: 'dei-keygroup-title' },
                  t('keygroup.credential'),
                  h('span', { className: 'dei-count dei-count-warn' }, String(credential.length)),
                  h('span', { className: 'dei-hint-inline' }, t('note.subagentHidden')),
                ),
                h('div', { className: 'dei-tags' },
                  credential.map(function (key) {
                    return h(KeyTag, { key: key, warn: true, note: t('note.credentialHit') }, key);
                  })),
                // 一句可操作指引（原为 60 字常驻段落，压到一行）。
                h('p', { className: 'dei-hint' }, t('hint.grant')),
              ),

          dshKeys.length === 0
            ? null
            : h('div', { className: 'dei-keygroup' },
                h('div', { className: 'dei-keygroup-title' },
                  t('keygroup.dsh'),
                  h('span', { className: 'dei-count' }, String(dshKeys.length)),
                ),
                h('div', { className: 'dei-tags' },
                  dshKeys.map(function (key) {
                    var entry = env.entries.filter(function (item) { return item.key === key; })[0];
                    var len = entry === undefined ? 0 : entry.length;
                    return h(KeyTag, {
                      key: key,
                      note: entry !== undefined && entry.set
                        ? t('note.valueSet', { len: String(len) })
                        : t('note.valueUnset'),
                    }, key);
                  })),
              ),
        ),

        // ── ③ 术语与说明：统一收进折叠区，默认收起。 ──
        // 这一段是原先散落各处的解释性长文（合计约 200 字），内容一字未删，
        // 只是不再与数据抢视觉权重，且改为整句翻译（术语独立成小标题）。
        h(Fold, { title: t('fold.terms'), icon: IconInfo === null ? null : h(IconInfo, { size: 14 }) },
          h('div', { className: 'dei-doc' },
            h(DocItem, { term: t('term.credential'), body: t('doc.credential') }),
            h(DocItem, { term: t('term.dsh'), body: t('doc.dsh') }),
            h(DocItem, { term: t('term.profile'), body: t('doc.profile') }),
            h(DocItem, { term: t('term.privacy'), body: t('doc.privacy') }),
          )),

        // ── ④ 相关工具：一句话，不再独占一个 section 标题。 ──
        h(Fold, { title: t('fold.tools'), icon: IconTool === null ? null : h(IconTool, { size: 14 }) },
          h('div', { className: 'dei-doc' },
            h('p', null, t('doc.tools')),
          )),
      );
    }

    return {
      // 'slots' 与 'locale' 走 dsh.client.inject 声明；与宿主工具的 'tools' 各自独立。
      inject: ['slots', 'locale'],
      apply: function (ctx) {
        var disposeStyles = installStyles();
        ctx.effect(function () { return disposeStyles; }, 'dsh-env-inspector: styles');

        // 键一致性自查：register 运行时**不检查**两种语言是否给全 —— 漏键不会抛错，
        // 只会静默显示 key 名（很难被发现）。所以启动时主动比一次并告警。
        // 自查本身绝不能影响注册，故整段包 try/catch。
        try {
          var missingEn = Object.keys(zh).filter(function (k) { return !(k in en); });
          var missingZh = Object.keys(en).filter(function (k) { return !(k in zh); });
          if (missingEn.length > 0 || missingZh.length > 0) {
            console.warn('[dsh-env-inspector-plus] dictionary keys mismatch',
              { missingEn: missingEn, missingZh: missingZh });
          }
        } catch (e) { /* 自查失败不影响功能 */ }

        // 注册中英字典；ctx.effect 包住，卸载时撤销该命名空间，
        // HMR 重载不会撞「namespace 已有该 locale」的重复注册错误。
        ctx.effect(function () {
          return ctx.locale.register(NS, { zh: zh, en: en });
        }, NS + ': dictionaries');
        var t = ctx.locale.bind(NS);

        try {
          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register({
              name: 'settings.section',
              // 用自己的 id：作为新增一格并列，绝不顶掉宿主已有的分页。
              id: SECTION_ID,
              order: 55,
              // ⚠️ label 用**函数**而非字符串：SlotLabel = string | (() => string)，
              //    设置页导航行每次读取时求值，语言切换后这一格会立刻跟着变，
              //    不需要重新注册。写成固定字符串则切换语言后仍是旧语言。
              label: function () { return t('section.label'); },
              // 声明本页文案的字典命名空间 → 渲染器自动注入 `t` 座位。
              locale: NS,
            }, EnvInspectorSection);
          });
        } catch (e) {
          // 注册失败只该失去这一格，绝不能让异常冒泡导致整个客户端插件激活失败。
          console.warn('[dsh-env-inspector-plus] settings section register failed:', e);
        }
      },
    };
  },
});
