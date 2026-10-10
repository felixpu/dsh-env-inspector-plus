// dsh-env-inspector-plus —— 环境体检的**浏览器半身**。
//
// 形态照官方模板 `cordis-plugin-development/templates/decoration/client.js`：
// 一个 `__ModuleLoader__.load({ id, factory })`，factory 里 `return` 插件对象。
//
// ⚠️ 只允许 require 平台种子表内的模块。本文件只用 react；槽位服务走
//    package.json 里 `dsh.client.inject` 声明的 "slots"。
//
// 契约来源（均经 cordis_inspect_query 实时核对，非猜测）：
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
// ⚠️ bundle id 必须等于 **npm 包名**（dsh-client-modules 校验：
//    "bundle loaded without registering <包名> via __ModuleLoader__.load"）。
//    本包因 npm 上 `dsh-env-inspector` 已被第三方占用（geeklei，0.3.0）而改名，
//    故下方 id 用 dsh-env-inspector-plus。
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
      '.dei-paths{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dei-path-row{display:flex;align-items:baseline;gap:10px;min-width:0}',
      '.dei-path-label{flex:none;width:52px;font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
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
      '.dei-doc{display:flex;flex-direction:column;gap:6px;font-size:12px;line-height:19px;',
      'color:var(--dsw-alias-label-secondary);max-width:76ch}',
      '.dei-doc p{margin:0}',
      '.dei-doc strong{color:var(--dsw-alias-label-primary);font-weight:600}',
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

    function formatUptime(seconds) {
      if (typeof seconds !== 'number' || !isFinite(seconds) || seconds < 0) return '—';
      var d = Math.floor(seconds / 86400);
      var hrs = Math.floor((seconds % 86400) / 3600);
      var mins = Math.floor((seconds % 3600) / 60);
      var secs = seconds % 60;
      if (d > 0) return d + ' 天 ' + hrs + ' 小时';
      if (hrs > 0) return hrs + ' 小时 ' + mins + ' 分';
      if (mins > 0) return mins + ' 分 ' + secs + ' 秒';
      return secs + ' 秒';
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
     * @param {string} version - `process.version` 原样。
     * @returns {string} 简短标签。
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

    /** 设置分页正文。data 为 null 时渲染加载态，error 非空时渲染错误态。 */
    function EnvInspectorSection() {
      var state = React.useState(null);
      var data = state[0];
      var setData = state[1];
      var errState = React.useState('');
      var error = errState[0];
      var setError = errState[1];
      var busyState = React.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];

      var load = React.useCallback(function () {
        setBusy(true);
        fetch(SNAPSHOT_URL, { headers: { accept: 'application/json' }, cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(function (payload) {
            if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
              throw new Error('响应结构不符合预期');
            }
            setData(payload.data);
            setError('');
          })
          .catch(function (cause) {
            setError('读取宿主快照失败：' + (cause && cause.message ? cause.message : String(cause)));
          })
          .then(function () { setBusy(false); });
      }, []);

      // 面板挂载即取一次；只读接口，无需轮询。
      React.useEffect(function () {
        load();
      }, [load]);

      var head = h('div', { className: 'dei-head' },
        h('div', { style: { minWidth: 0 } },
          h('h2', { className: 'dei-title' }, '环境体检'),
          h('p', { className: 'dei-sub' },
            data === null ? '变量值一律不出宿主。' : '采集于 ' + formatClock(data.collectedAt) + '　·　变量值一律不出宿主。')),
        h('div', { className: 'dei-actions' },
          h('button', {
            type: 'button', className: 'dei-btn', disabled: busy,
            onClick: load,
          }, busy ? '读取中…' : '重新采集')),
      );

      if (error !== '') {
        return h('div', { className: 'dei-root' }, head, h('p', { className: 'dei-err' }, error));
      }
      if (data === null) {
        return h('div', { className: 'dei-root' }, head, h('div', { className: 'dei-empty' }, '正在读取宿主快照…'));
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
          h('h3', { className: 'dei-section-title' }, '宿主'),
          h('div', { className: 'dei-summary' },
            h('span', { className: 'dei-chip dei-mono' }, 'pid ' + String(host.pid)),
            h('span', { className: 'dei-dot' }, '·'),
            h('span', { className: 'dei-chip dei-mono' }, host.platform + '/' + host.arch),
            h('span', { className: 'dei-dot' }, '·'),
            h('span', { className: 'dei-chip dei-mono' }, serverNodeLabel(host.nodeVersion)),
            h('span', { className: 'dei-dot' }, '·'),
            h('span', { className: 'dei-chip' }, '已运行 ' + formatUptime(host.uptimeSeconds)),
            profileMissing
              ? null
              : h('span', { className: 'dei-chip dei-mono' }, host.profile),
          ),
          h('div', { className: 'dei-paths' },
            h(PathRow, { label: '目录', value: host.cwd }),
            h(PathRow, { label: '入口', value: host.entry === '' ? '(未知)' : host.entry }),
            profileMissing ? null : h(PathRow, { label: 'Profile', value: host.profileDir }),
          ),
          // 原来这里常驻 131 字的解释；现在只在真有异常时给一句短提示，
          // 细节收进下方「说明」折叠区。
          profileMissing
            ? h('p', { className: 'dei-hint' }, '宿主环境未声明 Profile —— 这不影响使用。')
            : null,
        ),

        // ── ② 环境变量：图 + 两份键名清单合成一区（它们是同一件事的三个视角） ──
        h('div', { className: 'dei-section' },
          h('h3', { className: 'dei-section-title' },
            '环境变量',
            h('span', { className: 'dei-count' }, String(env.total))),

          h('div', { className: 'dei-bars' },
            h(Bar, { label: '全部', value: env.total, total: env.total }),
            h(Bar, { label: 'DSH_ 前缀', value: dshKeys.length, total: env.total }),
            h(Bar, {
              label: '凭证形态', value: credential.length, total: env.total,
              tone: credential.length > 0 ? 'warn' : undefined,
            }),
            h(Bar, { label: '其余', value: plainCount, total: env.total }),
          ),

          env.truncated === true
            ? h('p', { className: 'dei-err' }, '变量总数超出上限，清单只列出前若干条。')
            : null,

          // 键名清单：只在非空时出现。标题带数量（下不再复述数字）。
          credential.length === 0
            ? null
            : h('div', { className: 'dei-keygroup' },
                h('div', { className: 'dei-keygroup-title' },
                  '凭证形态',
                  h('span', { className: 'dei-count dei-count-warn' }, String(credential.length)),
                  h('span', { className: 'dei-hint-inline' }, '子代理 bash 默认读不到'),
                ),
                h('div', { className: 'dei-tags' },
                  credential.map(function (key) {
                    return h(KeyTag, { key: key, warn: true, note: '变量名命中凭证形态；值不出宿主' }, key);
                  })),
                // 一句可操作指引（原为 60 字常驻段落，压到一行）。
                h('p', { className: 'dei-hint' },
                  '需要明文？到 dsh-settings-params 的插件页开启该变量的模型读取授权。'),
              ),

          dshKeys.length === 0
            ? null
            : h('div', { className: 'dei-keygroup' },
                h('div', { className: 'dei-keygroup-title' },
                  'DSH_ 前缀',
                  h('span', { className: 'dei-count' }, String(dshKeys.length)),
                ),
                h('div', { className: 'dei-tags' },
                  dshKeys.map(function (key) {
                    var entry = env.entries.filter(function (item) { return item.key === key; })[0];
                    var len = entry === undefined ? 0 : entry.length;
                    return h(KeyTag, {
                      key: key,
                      note: entry !== undefined && entry.set ? '已设值，长度 ' + String(len) : '未设值',
                    }, key);
                  })),
              ),
        ),

        // ── ③ 术语与说明：统一收进折叠区，默认收起。 ──
        // 这一段是原先散落各处的解释性长文（合计约 200 字），内容一字未删，
        // 只是不再与数据抢视觉权重。
        h(Fold, { title: '术语与说明', icon: IconInfo === null ? null : h(IconInfo, { size: 14 }) },
          h('div', { className: 'dei-doc' },
            h('p', null, h('strong', null, '凭证形态'),
              '：变量名含 KEY / PASSWORD / SECRET / TOKEN（不区分大小写）。'
              + '与 DSH 派生子进程时的剥离规则同源，因此这一组在子代理的 bash 里默认读不到。'),
            h('p', null, h('strong', null, 'DSH_ 前缀'),
              '：由宿主写入，数量随会话变化，每次采集的数字都可能不同。'),
            h('p', null, h('strong', null, 'Profile 未声明'),
              '：本页读的是宿主进程自身的环境变量 DSH_PROFILE / DSH_PROFILE_DIR。'
              + '宿主若以 ' + '`dsh web`' + ' 直接拉起（命令行不带 --profile），进程里就没有它们 —— '
              + '这不代表 profile 没生效，只是该进程没在自己的环境里声明。'),
            h('p', null, h('strong', null, '本页只显示变量名'),
              '，不含任何变量的值；快照的路由与工具都不回传明文。'),
          )),

        // ── ④ 相关工具：一句话，不再独占一个 section 标题。 ──
        h(Fold, { title: '相关工具', icon: IconTool === null ? null : h(IconTool, { size: 14 }) },
          h('div', { className: 'dei-doc' },
            h('p', null, '模型可调用 ' + '`env_inspect`' + ' 工具读取同一份快照（默认只回统计与键名清单，不回值）。'),
          )),
      );
    }

    return {
      // 'slots' 走 dsh.client.inject 声明；与宿主工具的 'tools' 各自独立。
      inject: ['slots'],
      apply: function (ctx) {
        var disposeStyles = installStyles();
        ctx.effect(function () { return disposeStyles; }, 'dsh-env-inspector: styles');

        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register({
            name: 'settings.section',
            // 用自己的 id：作为新增一格并列，绝不顶掉宿主已有的分页。
            id: SECTION_ID,
            order: 55,
            label: '环境体检',
          }, EnvInspectorSection);
        });
      },
    };
  },
});
