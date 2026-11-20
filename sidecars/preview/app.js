(() => {
  'use strict';

  const STORAGE_KEY = 'st_card_workbench_state_v3';
  const POLL_MS = 1800;
  const $ = (id) => document.getElementById(id);

  const PRESETS = {
    'css-card': {
      mode: 'regex',
      hostSurface: 'auto',
      canvasTheme: 'dark',
      scriptName: '行旅账册状态栏',
      findRegex: '/<status>\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([\\s\\S]*?)<\\/status>/gi',
      trimStrings: '',
      replaceString: `<div class="st-sheet">
  <style>
    .st-sheet {
      margin-top: 12px;
      padding: 11px 13px;
      background: #1B1A17;
      color: #EAE5DC;
      border: 1px solid rgba(234, 229, 220, 0.14);
      border-radius: 6px;
      font-family: "Sarasa UI SC", "Microsoft YaHei", sans-serif;
      font-size: 12.5px;
      line-height: 1.5;
    }
    .st-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 6px;
      padding-bottom: 8px;
      margin-bottom: 9px;
      border-bottom: 1px solid rgba(234, 229, 220, 0.10);
      color: #B8B0A2;
      font-size: 12px;
    }
    .st-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px 14px;
    }
    .st-item span {
      display: block;
      font-size: 11px;
      color: #8E877B;
    }
    .st-item strong {
      font-weight: 600;
      color: #F0ECE3;
    }
    .st-fold {
      margin-top: 9px;
      padding-top: 8px;
      border-top: 1px solid rgba(234, 229, 220, 0.08);
    }
    .st-fold summary {
      cursor: pointer;
      color: #C9B296;
      font-size: 12px;
      user-select: none;
    }
    .st-fold p {
      margin: 5px 0 0;
      color: #C2BBB0;
      font-size: 12px;
    }
  </style>
  <div class="st-head">
    <span>$1</span>
    <span>$2</span>
  </div>
  <div class="st-grid">
    <div class="st-item"><span>盘缠</span><strong>$3</strong></div>
    <div class="st-item"><span>身体状况</span><strong>$4</strong></div>
  </div>
  <details class="st-fold" open>
    <summary>随身物件</summary>
    <p>$5</p>
  </details>
</div>`,
      sampleInput: `渡口的茶棚刚收了幌子，掌柜把两碟盐水花生搁在靠窗的木桌上，顺手掩上半扇挡风板：“北边昨夜下了早霜，船家天亮才拔锚，客官先喝碗热茶暖暖手。”\n\n<status>十月廿三 酉正 | 临淮渡·老柳茶棚 | 碎银三两、铜钱四十文 | 左肩旧伤未愈 | 渡船凭引、油纸包的干粮</status>`,
      mockVars: JSON.stringify({ stat_data: { silver: 3, cash: 40, location: '临淮渡·老柳茶棚' } }, null, 2),
    },

    'mvu-hud': {
      mode: 'regex',
      hostSurface: 'auto',
      canvasTheme: 'dark',
      scriptName: '调查卷宗面板（MVU iframe）',
      findRegex: '/<hud_mount\\s*\\/?>/gi',
      trimStrings: '',
      replaceString: `\`\`\`html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Sarasa UI SC", system-ui, sans-serif;
    background: #1A1B1E;
    color: #E6E8EC;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    padding: 12px 13px;
    font-size: 12.5px;
  }
  .top { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 8px; margin-bottom: 9px; border-bottom: 1px solid rgba(255,255,255,0.09); }
  .place { font-weight: 600; }
  .fund { font-family: monospace; font-size: 12px; color: #C8B48A; }
  .tabs { display: flex; gap: 6px; margin-bottom: 9px; }
  .tab {
    border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #9CA2AE;
    padding: 3px 9px; border-radius: 4px; cursor: pointer; font-size: 11.5px;
  }
  .tab.active { background: rgba(255,255,255,0.08); color: #F0F2F5; border-color: rgba(255,255,255,0.24); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .cell { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 5px; padding: 7px 9px; }
  .label { font-size: 11px; color: #8E95A2; margin-bottom: 4px; display: flex; justify-content: space-between; }
  .bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
  .fill { height: 100%; background: #7FA88E; transition: width 0.2s ease; }
  .notes { font-size: 12px; color: #C5CAD3; line-height: 1.6; }
  .act {
    margin-top: 9px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04);
    color: #DCE0E8; border-radius: 4px; padding: 4px 9px; font-size: 11.5px; cursor: pointer;
  }
  .act:hover { border-color: rgba(255,255,255,0.28); }
</style>
</head>
<body>
  <div class="top">
    <span class="place" id="loc">-</span>
    <span class="fund" id="fund">-</span>
  </div>
  <div class="tabs">
    <button class="tab active" data-t="overview">进度</button>
    <button class="tab" data-t="notes">待查线索</button>
  </div>
  <div id="pane-overview" class="grid">
    <div class="cell">
      <div class="label"><span>查证进度</span><strong id="prog-val">0%</strong></div>
      <div class="bar"><div class="fill" id="prog-bar" style="width:0%"></div></div>
    </div>
    <div class="cell">
      <div class="label"><span>证人配合度</span><strong id="trust-val">0</strong></div>
      <div class="bar"><div class="fill" id="trust-bar" style="width:0%;background:#B88B6C"></div></div>
    </div>
  </div>
  <div id="pane-notes" class="notes" style="display:none"></div>
  <button class="act" id="expense-btn" type="button">记一笔车马费 (-20 经费)</button>

  <script>
    let activeTab = 'overview';
    function render() {
      const vars = getVariables({ type: 'chat' }) || {};
      const s = vars.stat_data || {};
      document.getElementById('loc').textContent = s.location || '未记录地点';
      document.getElementById('fund').textContent = '经费 ' + (s.budget ?? 0);
      const prog = Math.max(0, Math.min(100, Number(s.progress) || 0));
      const trust = Math.max(0, Math.min(100, Number(s.trust) || 0));
      document.getElementById('prog-val').textContent = prog + '%';
      document.getElementById('prog-bar').style.width = prog + '%';
      document.getElementById('trust-val').textContent = trust + '%';
      document.getElementById('trust-bar').style.width = trust + '%';
      const list = Array.isArray(s.clues) ? s.clues : ['暂无记录'];
      const box = document.getElementById('pane-notes');
      box.textContent = '';
      list.forEach(item => {
        const div = document.createElement('div');
        div.textContent = '· ' + item;
        box.appendChild(div);
      });
    }
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.t;
        document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('pane-overview').style.display = activeTab === 'overview' ? 'grid' : 'none';
        document.getElementById('pane-notes').style.display = activeTab === 'notes' ? 'block' : 'none';
      });
    });
    document.getElementById('expense-btn').addEventListener('click', () => {
      const vars = getVariables({ type: 'chat' }) || {};
      const s = Object.assign({}, vars.stat_data || {});
      s.budget = Math.max(0, (Number(s.budget) || 0) - 20);
      insertOrAssignVariables({ stat_data: s }, { type: 'chat' });
      render();
    });
    waitGlobalInitialized('Mvu').then(() => {
      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, render);
      render();
    });
  <\/script>
</body>
</html>
\`\`\``,
      sampleInput: `档案室的值班员把登记簿推过来，指了指倒数第三行被墨水涂改过的入库日期。\n<hud_mount/>`,
      mockVars: JSON.stringify({
        stat_data: {
          location: '旧市政厅·三楼档案室',
          budget: 340,
          progress: 60,
          trust: 45,
          clues: [
            '核对十月十四日的货运签收单',
            '向门卫确认当晚借钥匙的人名',
          ],
        },
      }, null, 2),
    },

    'purify-trap': {
      mode: 'regex',
      hostSurface: 'message',
      canvasTheme: 'dark',
      scriptName: '普通楼层清洗预警示例',
      findRegex: '/\\[木匣:(.*?)\\]/g',
      trimStrings: '',
      replaceString: `<div style="margin-top:8px;padding:10px 12px;background:#22201D;color:#EAE5DC;border-radius:6px;border:1px solid rgba(255,255,255,0.14)">
  <div style="margin-bottom:6px">抽屉底层放着一只上了锁的木匣。</div>
  <button onclick="alert('$1')" style="padding:4px 9px;border-radius:4px;border:1px solid #5A534A;background:#2E2B27;color:#EAE5DC;cursor:pointer">查看匣内物件（onclick 在酒馆普通楼层会被过滤）</button>
</div>`,
      sampleInput: `拉开书桌右侧最下面的抽屉，木板后面露出半截铜锁。\n[木匣:旧印章、两张当票]`,
      mockVars: JSON.stringify({ stat_data: {} }, null, 2),
    },
  };

  const state = {
    mode: 'regex',
    hostSurface: 'auto',
    viewport: 'fluid',
    canvasTheme: 'dark',
    stageView: 'render',
    wbTab: 'rule',
    liveSync: true,
    lastDraftTs: 0,
    rulesList: [],
    activeRuleIdx: 0,
    chainAll: false,
    scriptName: '',
    findRegex: '',
    trimStrings: '',
    replaceString: '',
    sampleInput: '',
    mockVars: '',
    renderToken: '',
  };

  function resolveApiUrl(subpath) {
    const clean = subpath.replace(/^\//, '');
    if (location.protocol === 'sidecar:') {
      const u = new URL(location.href);
      u.pathname = u.pathname.replace(/\/?$/, '/') + clean;
      u.search = '';
      return u.toString();
    }
    return '/' + clean;
  }

  function sidecarFetch(subpath, init) {
    if (location.protocol === 'file:') return Promise.reject(new Error('offline file'));
    const url = resolveApiUrl(subpath);
    const fn = window.sidecar?.fetch ? window.sidecar.fetch.bind(window.sidecar) : fetch;
    return fn(url, init);
  }

  function loadInitialState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object' && saved.replaceString) {
        Object.assign(state, saved);
        return;
      }
    } catch {}
    applyPresetObject(PRESETS['css-card'], false);
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: state.mode,
        hostSurface: state.hostSurface,
        viewport: state.viewport,
        canvasTheme: state.canvasTheme,
        liveSync: state.liveSync,
        lastDraftTs: state.lastDraftTs,
        scriptName: state.scriptName,
        findRegex: state.findRegex,
        trimStrings: state.trimStrings,
        replaceString: state.replaceString,
        sampleInput: state.sampleInput,
        mockVars: state.mockVars,
      }));
    } catch {}
  }

  function applyPresetObject(p, renderNow = true) {
    state.mode = p.mode || 'regex';
    state.hostSurface = p.hostSurface || 'auto';
    if (p.canvasTheme) state.canvasTheme = p.canvasTheme;
    state.scriptName = p.scriptName || '';
    state.findRegex = p.findRegex || '';
    state.trimStrings = Array.isArray(p.trimStrings) ? p.trimStrings.join(', ') : (p.trimStrings || '');
    state.replaceString = p.replaceString || '';
    state.sampleInput = p.sampleInput ?? state.sampleInput;
    if (p.mockVars) {
      state.mockVars = typeof p.mockVars === 'string' ? p.mockVars : JSON.stringify(p.mockVars, null, 2);
    }
    syncInputsFromState();
    if (renderNow) evaluateAndRender();
  }

  function syncInputsFromState() {
    $('input-mode').value = state.mode;
    $('host-surface').value = state.hostSurface;
    $('script-name').value = state.scriptName;
    $('find-regex').value = state.findRegex;
    $('trim-strings').value = state.trimStrings;
    $('replace-string').value = state.replaceString;
    $('sample-input').value = state.sampleInput;
    $('mock-vars').value = state.mockVars;
    $('regex-fields').classList.toggle('hidden', state.mode === 'direct-html');
    $('replace-label').innerHTML = state.mode === 'direct-html'
      ? 'HTML 源码'
      : '替换内容 <code>replaceString</code>';
    $('view-render').dataset.canvasTheme = state.canvasTheme;
    $('bg-toggle').textContent = state.canvasTheme === 'dark' ? '深色底' : '浅色底';
    $('viewport-box').dataset.vp = state.viewport;
    $('sync-btn').setAttribute('aria-pressed', String(state.liveSync));
  }

  function parseRegexPattern(rawPattern) {
    const str = String(rawPattern ?? '');
    if (!str) return { error: '查找表达式为空' };
    const slashMatch = /^\/([\s\S]*)\/([a-z]*)$/.exec(str);
    if (slashMatch) {
      const [, body, flags] = slashMatch;
      try {
        const seen = new Set();
        for (const ch of flags) {
          if (seen.has(ch)) return { error: `正则标志重复：${ch}` };
          seen.add(ch);
        }
        return { regex: new RegExp(body, flags) };
      } catch (e) {
        return { error: `正则语法错误：${e.message}` };
      }
    }
    try {
      return { regex: new RegExp(str, 'gm') };
    } catch (e) {
      return { error: `正则语法错误：${e.message}` };
    }
  }

  function parseTrimList(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
    return String(raw || '')
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function applySingleRule(input, rule) {
    const parsed = parseRegexPattern(rule.findRegex);
    if (parsed.error) return { output: input, matchCount: 0, groupCount: 0, error: parsed.error };

    const trims = parseTrimList(rule.trimStrings);
    const applyTrims = (val) => {
      let res = String(val ?? '');
      for (const t of trims) {
        if (t) res = res.split(t).join('');
      }
      return res;
    };

    let matchCount = 0;
    let groupCount = 0;
    const template = String(rule.replaceString ?? '');

    const output = String(input ?? '').replace(parsed.regex, (...args) => {
      matchCount += 1;
      const hasNamed = typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
      const namedGroups = hasNamed ? args[args.length - 1] : null;
      const fullMatch = args[0];
      const captureEnd = hasNamed ? args.length - 3 : args.length - 2;
      const captures = args.slice(1, captureEnd).map(applyTrims);
      groupCount = Math.max(groupCount, captures.length);

      let rep = template.replace(/\{\{match\}\}/gi, () => applyTrims(fullMatch));
      rep = rep.replace(/\$\$|\$&|\$(\d{1,2})|\$<([^>]+)>/g, (tok, num, groupName) => {
        if (tok === '$$') return '$';
        if (tok === '$&') return applyTrims(fullMatch);
        if (groupName !== undefined) {
          return namedGroups && Object.hasOwn(namedGroups, groupName)
            ? applyTrims(namedGroups[groupName])
            : '';
        }
        if (num.length === 2) {
          const idx2 = Number(num);
          if (idx2 >= 1 && idx2 <= captures.length) return captures[idx2 - 1] ?? '';
          const idx1 = Number(num[0]);
          if (idx1 >= 1 && idx1 <= captures.length) return (captures[idx1 - 1] ?? '') + num[1];
          return tok;
        }
        const idx = Number(num);
        if (idx >= 1 && idx <= captures.length) return captures[idx - 1] ?? '';
        return tok;
      });
      return rep;
    });

    return { output, matchCount, groupCount, error: null };
  }

  function normalizeImportedRule(item, idx = 0) {
    const isHelper = Object.hasOwn(item, 'find_regex') || Object.hasOwn(item, 'replace_string');
    const name = item.scriptName ?? item.script_name ?? `规则 #${idx + 1}`;
    const findRegex = item.findRegex ?? item.find_regex ?? '';
    const replaceString = item.replaceString ?? item.replace_string ?? '';
    const trimStrings = item.trimStrings ?? item.trim_strings ?? [];
    const disabled = isHelper ? item.enabled === false : Boolean(item.disabled);
    const promptOnly = isHelper
      ? Boolean(item.destination?.prompt && !item.destination?.display)
      : Boolean(item.promptOnly && !item.markdownOnly);
    return {
      dialect: isHelper ? 'helper' : 'card',
      scriptName: String(name),
      findRegex: String(findRegex),
      replaceString: String(replaceString),
      trimStrings: Array.isArray(trimStrings) ? trimStrings : parseTrimList(trimStrings),
      disabled,
      promptOnly,
    };
  }

  function extractFencedHtmlOrFullDoc(htmlText) {
    const fence = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(htmlText);
    if (fence) {
      return {
        isIframeDoc: true,
        innerDoc: fence[1],
        surroundingBefore: htmlText.slice(0, fence.index).trim(),
        surroundingAfter: htmlText.slice(fence.index + fence[0].length).trim(),
      };
    }
    if (/^\s*<!doctype\s+html/i.test(htmlText) || /^\s*<html[\s>]/i.test(htmlText)) {
      return { isIframeDoc: true, innerDoc: htmlText, surroundingBefore: '', surroundingAfter: '' };
    }
    return { isIframeDoc: false, innerDoc: htmlText, surroundingBefore: '', surroundingAfter: '' };
  }

  function runPreflightAudit({ error, matchCount, finalOutput, effectiveSurface, ruleMeta, varsError }) {
    const audits = [];
    if (error) {
      audits.push({ severity: 'error', text: error });
      return audits;
    }
    if (varsError) {
      audits.push({ severity: 'warn', text: `模拟变量 JSON 格式错误：${varsError}` });
    }
    if (ruleMeta?.disabled) {
      audits.push({ severity: 'warn', text: '该规则当前为禁用状态，导入酒馆后不会运行。' });
    }
    if (ruleMeta?.promptOnly) {
      audits.push({ severity: 'warn', text: '该规则只勾选了提示词阶段（promptOnly），未开显示阶段，酒馆界面不会渲染。' });
    }
    if (state.mode === 'regex' && matchCount === 0) {
      audits.push({ severity: 'warn', text: '查找表达式未匹配到测试文本，当前显示的是原文。' });
    }

    if (effectiveSurface === 'message') {
      if (/<script[\s>]/i.test(finalOutput)) {
        audits.push({
          severity: 'warn',
          text: '普通楼层内含 <script>：酒馆 DOMPurify 会将其过滤；需要跑脚本请套入 ```html 代码块走酒馆助手 iframe。',
        });
      }
      if (/\son[a-z]+\s*=/i.test(finalOutput) || /href\s*=\s*["']?\s*javascript:/i.test(finalOutput)) {
        audits.push({
          severity: 'warn',
          text: '普通楼层内含 onclick 等内联事件：酒馆 DOMPurify 会将其清掉；请改用 <details> 或走 iframe 代码块。',
        });
      }
    }

    if (audits.length === 0) {
      audits.push({
        severity: 'ok',
        text: effectiveSurface === 'iframe'
          ? '通过：当前按酒馆助手 iframe 沙盒运行，已挂载 getVariables / Mvu 模拟接口。'
          : '通过：未发现会被普通楼层安全过滤拦截的脚本或内联事件。',
      });
    }
    return audits;
  }

  function buildRuntimeShimScript(mockVarsObj, token) {
    const safeJson = JSON.stringify(mockVarsObj || {}).replace(/</g, '\\u003c');
    return `<script>
(function(){
  const __TOKEN = ${JSON.stringify(token)};
  let __STORE = ${safeJson};
  const __LISTENERS = new Map();
  function __clone(v){ try { return JSON.parse(JSON.stringify(v)); } catch { return {}; } }
  function __log(msg){
    try { parent.postMessage({ __stPreviewLog: String(msg), token: __TOKEN }, '*'); } catch {}
  }
  window.__receiveMockVars = function(nextVars, emitUpdate){
    __STORE = __clone(nextVars || {});
    if (emitUpdate) window.eventEmit(window.Mvu.events.VARIABLE_UPDATE_ENDED, __clone(__STORE));
  };
  window.addEventListener('message', function(ev){
    if (ev.data && ev.data.__stMvuUpdate) {
      window.__receiveMockVars(ev.data.__stMvuUpdate, true);
    }
  });
  window.getCurrentMessageId = function(){ return 0; };
  window.getTavernVersion = function(){ return '1.18.0-preview'; };
  window.getTavernHelperVersion = function(){ return '4.8.19-preview'; };
  window.getVariables = function(){ return __clone(__STORE); };
  window.replaceVariables = function(next){
    __STORE = __clone(next || {});
    __log('replaceVariables 已写入');
    try { parent.postMessage({ __stVarsMutated: __clone(__STORE), token: __TOKEN }, '*'); } catch {}
    return __clone(__STORE);
  };
  window.insertOrAssignVariables = function(patch){
    __STORE = Object.assign({}, __STORE, __clone(patch || {}));
    __log('更新变量: ' + Object.keys(patch || {}).join(', '));
    try { parent.postMessage({ __stVarsMutated: __clone(__STORE), token: __TOKEN }, '*'); } catch {}
    return __clone(__STORE);
  };
  window.updateVariablesWith = function(updater){
    if (typeof updater === 'function') __STORE = __clone(updater(__clone(__STORE)) || __STORE);
    __log('updateVariablesWith 已执行');
    try { parent.postMessage({ __stVarsMutated: __clone(__STORE), token: __TOKEN }, '*'); } catch {}
    return __clone(__STORE);
  };
  window.eventOn = function(evt, fn){
    if (!__LISTENERS.has(evt)) __LISTENERS.set(evt, new Set());
    __LISTENERS.get(evt).add(fn);
    return { stop: function(){ __LISTENERS.get(evt)?.delete(fn); } };
  };
  window.eventOnce = function(evt, fn){
    const sub = window.eventOn(evt, function(...a){ sub.stop(); fn(...a); });
    return sub;
  };
  window.eventEmit = function(evt, payload){
    __log('事件: ' + evt);
    const set = __LISTENERS.get(evt);
    if (set) set.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  };
  window.waitGlobalInitialized = function(name){
    return Promise.resolve(window[name]);
  };
  window.TavernHelper = {
    getVariables: window.getVariables,
    replaceVariables: window.replaceVariables,
    insertOrAssignVariables: window.insertOrAssignVariables,
    updateVariablesWith: window.updateVariablesWith,
    eventOn: window.eventOn,
    eventOnce: window.eventOnce,
    eventEmit: window.eventEmit,
    getCurrentMessageId: window.getCurrentMessageId
  };
  window.Mvu = {
    events: { VARIABLE_UPDATE_ENDED: 'mvu_variable_update_ended' },
    getMvuData: function(){ return __clone(__STORE); }
  };
  window.SillyTavern = {
    getContext: function(){ return { name1: 'User', name2: 'Character', chatId: 'preview-chat' }; }
  };
  function __reportHeight(){
    const b = document.body;
    const h = b ? Math.ceil(b.getBoundingClientRect().height) : 150;
    try { parent.postMessage({ __stPreviewHeight: Math.min(Math.max(h + 4, 110), 540), token: __TOKEN }, '*'); } catch {}
  }
  window.addEventListener('load', __reportHeight);
  if (typeof ResizeObserver !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function(){
      if (document.body) new ResizeObserver(__reportHeight).observe(document.body);
      setTimeout(__reportHeight, 60);
    });
  }
  window.addEventListener('error', function(e){
    __log('脚本报错: ' + (e.message || '未知错误'));
  });
})();
<\/script>`;
  }

  function formatMixedProseAndHtml(src) {
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)(?:\s[^<>]*?)?(\/?)>/g;
    let out = '';
    let lastIdx = 0;
    let depth = 0;
    let inRawTextTag = null;

    for (const m of src.matchAll(tagRe)) {
      const chunk = src.slice(lastIdx, m.index);
      out += (depth === 0 && !inRawTextTag) ? chunk.replace(/\n/g, '<br>') : chunk;
      const fullTag = m[0];
      const name = (m[1] || '').toLowerCase();
      const selfClose = m[2] === '/' || voidTags.has(name);

      if (fullTag.startsWith('<!--')) {
        out += fullTag;
      } else if (fullTag.startsWith('</')) {
        if (inRawTextTag === name) inRawTextTag = null;
        if (depth > 0) depth -= 1;
        out += fullTag;
      } else {
        if (!inRawTextTag) {
          if (name === 'style' || name === 'script') inRawTextTag = name;
          if (!selfClose) depth += 1;
        }
        out += fullTag;
      }
      lastIdx = m.index + fullTag.length;
    }
    const tail = src.slice(lastIdx);
    out += (depth === 0 && !inRawTextTag) ? tail.replace(/\n/g, '<br>') : tail;
    return out.replace(/(?:<br>\s*)+(<div|<section|<details|<table|<article)/gi, '<br>$1');
  }

  function buildSrcdoc({ finalOutput, extracted, effectiveSurface, mockVarsObj, token }) {
    const shim = buildRuntimeShimScript(mockVarsObj, token);
    const isDark = state.canvasTheme === 'dark';

    if (effectiveSurface === 'iframe') {
      const rawDoc = extracted.innerDoc;
      if (/<head[\s>]/i.test(rawDoc)) {
        return rawDoc.replace(/<head([^>]*)>/i, () => `<head>${shim}`);
      }
      if (/<html[\s>]/i.test(rawDoc)) {
        return rawDoc.replace(/<html([^>]*)>/i, () => `<html><head>${shim}</head>`);
      }
      return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${shim}<style>body{margin:0;color:${isDark ? '#EFECE6' : '#22201D'};font-family:"Sarasa UI SC",system-ui,sans-serif;}</style></head><body>${rawDoc}</body></html>`;
    }

    const bubbleBg = isDark ? '#1E1D1A' : '#FCFBF8';
    const bubbleText = isDark ? '#EAE5DC' : '#1F1D1A';
    const bubbleBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(36,32,26,0.12)';
    const proseHtml = formatMixedProseAndHtml(finalOutput);

    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
${shim}
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: ${bubbleText};
    font-family: "Sarasa UI SC", "Microsoft YaHei", system-ui, sans-serif;
    font-size: 13.5px;
    line-height: 1.65;
  }
  .mes-bubble {
    background: ${bubbleBg};
    border: 1px solid ${bubbleBorder};
    border-radius: 6px;
    padding: 12px 14px;
    word-break: break-word;
  }
</style>
</head>
<body>
  <div class="mes-bubble">${proseHtml}</div>
</body>
</html>`;
  }

  function evaluateAndRender() {
    persistState();

    let mockVarsObj = {};
    let varsError = null;
    try {
      mockVarsObj = state.mockVars.trim() ? JSON.parse(state.mockVars) : {};
      $('vars-status').textContent = 'JSON 正常';
    } catch (e) {
      varsError = e.message;
      $('vars-status').textContent = `JSON 语法错误：${e.message}`;
    }

    let finalOutput = '';
    let matchCount = 0;
    let groupCount = 0;
    let regexError = null;
    let currentRuleMeta = null;

    if (state.mode === 'direct-html') {
      finalOutput = state.replaceString;
      $('match-pill').textContent = 'HTML 直渲';
      $('match-pill').dataset.tone = 'ok';
    } else if (state.chainAll && state.rulesList.length > 1) {
      let running = state.sampleInput;
      let totalHits = 0;
      for (const r of state.rulesList) {
        if (r.disabled || r.promptOnly) continue;
        const step = applySingleRule(running, r);
        if (step.error) {
          regexError = `[${r.scriptName}] ${step.error}`;
          break;
        }
        running = step.output;
        totalHits += step.matchCount;
      }
      finalOutput = running;
      matchCount = totalHits;
      $('match-pill').textContent = regexError ? '正则有误' : `串联匹配 ${totalHits} 处`;
      $('match-pill').dataset.tone = regexError ? 'err' : (totalHits > 0 ? 'ok' : 'warn');
    } else {
      if (state.rulesList[state.activeRuleIdx]) {
        currentRuleMeta = state.rulesList[state.activeRuleIdx];
      }
      const res = applySingleRule(state.sampleInput, {
        findRegex: state.findRegex,
        replaceString: state.replaceString,
        trimStrings: state.trimStrings,
      });
      finalOutput = res.output;
      matchCount = res.matchCount;
      groupCount = res.groupCount;
      regexError = res.error;

      if (regexError) {
        $('match-pill').textContent = '正则语法错误';
        $('match-pill').dataset.tone = 'err';
      } else if (matchCount === 0) {
        $('match-pill').textContent = '未匹配';
        $('match-pill').dataset.tone = 'warn';
      } else {
        $('match-pill').textContent = groupCount > 0 ? `匹配 ${matchCount} 处 · ${groupCount} 组` : `匹配 ${matchCount} 处`;
        $('match-pill').dataset.tone = 'ok';
      }
    }

    const extracted = extractFencedHtmlOrFullDoc(finalOutput);
    const effectiveSurface = state.hostSurface === 'auto'
      ? (extracted.isIframeDoc ? 'iframe' : 'message')
      : state.hostSurface;

    const audits = runPreflightAudit({
      error: regexError,
      matchCount,
      finalOutput,
      effectiveSurface,
      ruleMeta: currentRuleMeta,
      varsError,
    });

    const warnItems = audits.filter((a) => a.severity === 'warn' || a.severity === 'error');
    const badge = $('audit-badge');
    if (warnItems.length > 0) {
      badge.textContent = String(warnItems.length);
      badge.classList.remove('hidden');
      const topIssue = warnItems[0];
      $('alert-banner').textContent = topIssue.text;
      $('alert-banner').dataset.level = topIssue.severity === 'error' ? 'error' : 'warn';
      $('alert-banner').classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
      $('alert-banner').classList.add('hidden');
    }

    const auditList = $('audit-list');
    auditList.textContent = '';
    for (const item of audits) {
      const li = document.createElement('li');
      li.className = 'audit-item';
      li.dataset.severity = item.severity;
      li.textContent = item.text;
      auditList.appendChild(li);
    }

    $('html-output').textContent = finalOutput;
    $('output-meta').textContent = `${finalOutput.length} 字符 · ${effectiveSurface === 'iframe' ? 'iframe 沙盒' : '普通楼层'}`;

    const showSurrounding = effectiveSurface === 'iframe';
    const beforeEl = $('prose-before');
    const afterEl = $('prose-after');
    if (showSurrounding && extracted.surroundingBefore) {
      beforeEl.textContent = extracted.surroundingBefore;
      beforeEl.classList.remove('hidden');
    } else {
      beforeEl.textContent = '';
      beforeEl.classList.add('hidden');
    }
    if (showSurrounding && extracted.surroundingAfter) {
      afterEl.textContent = extracted.surroundingAfter;
      afterEl.classList.remove('hidden');
    } else {
      afterEl.textContent = '';
      afterEl.classList.add('hidden');
    }

    const token = Math.random().toString(36).slice(2, 10);
    state.renderToken = token;
    $('preview-frame').srcdoc = buildSrcdoc({
      finalOutput,
      extracted,
      effectiveSurface,
      mockVarsObj,
      token,
    });
  }

  function importJsonRules(rawText) {
    const parsed = JSON.parse(rawText);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    if (arr.length === 0) throw new Error('JSON 数组为空');
    const normalized = arr.map((it, idx) => normalizeImportedRule(it, idx));
    state.rulesList = normalized;
    state.activeRuleIdx = 0;
    state.chainAll = false;
    $('chain-all-toggle').checked = false;

    if (normalized.length > 1) {
      const sel = $('rule-index-select');
      sel.textContent = '';
      normalized.forEach((r, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${i + 1}. ${r.scriptName}${r.disabled ? ' (禁用)' : ''}`;
        sel.appendChild(opt);
      });
      $('multi-rule-bar').classList.remove('hidden');
    } else {
      $('multi-rule-bar').classList.add('hidden');
    }

    loadRuleFromList(0);
  }

  function loadRuleFromList(idx) {
    const r = state.rulesList[idx];
    if (!r) return;
    state.activeRuleIdx = idx;
    state.mode = 'regex';
    state.scriptName = r.scriptName;
    state.findRegex = r.findRegex;
    state.trimStrings = r.trimStrings.join(', ');
    state.replaceString = r.replaceString;
    syncInputsFromState();
    evaluateAndRender();
  }

  function buildExportPayload(dialect) {
    const trims = parseTrimList(state.trimStrings);
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `regex-${Date.now()}`;
    if (dialect === 'helper') {
      return {
        id,
        script_name: state.scriptName || '状态栏渲染',
        enabled: true,
        find_regex: state.findRegex,
        replace_string: state.replaceString,
        trim_strings: trims,
        source: { user_input: false, ai_output: true, slash_command: false, world_info: false },
        destination: { display: true, prompt: false },
        run_on_edit: true,
        min_depth: null,
        max_depth: null,
      };
    }
    return {
      id,
      scriptName: state.scriptName || '状态栏渲染',
      findRegex: state.findRegex,
      replaceString: state.replaceString,
      trimStrings: trims,
      placement: [2],
      disabled: false,
      markdownOnly: true,
      promptOnly: false,
      runOnEdit: true,
      substituteRegex: 0,
      minDepth: null,
      maxDepth: null,
    };
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function consumeDraftIfNewer(draft) {
    if (!draft || !draft.updatedAt) return false;
    if (Number(draft.updatedAt) <= state.lastDraftTs) return false;
    state.lastDraftTs = Number(draft.updatedAt);
    state.rulesList = [];
    $('multi-rule-bar').classList.add('hidden');
    applyPresetObject({
      mode: draft.mode || 'regex',
      hostSurface: draft.hostSurface || 'auto',
      scriptName: draft.scriptName || draft.title || '对话草稿',
      findRegex: draft.findRegex ?? state.findRegex,
      trimStrings: draft.trimStrings ?? state.trimStrings,
      replaceString: draft.replaceString ?? state.replaceString,
      sampleInput: draft.sampleInput ?? state.sampleInput,
      mockVars: draft.mockVars ?? state.mockVars,
    }, true);
    showConsoleLog(`已同步草稿：${draft.title || draft.scriptName || '状态栏'}`);
    return true;
  }

  async function pollLiveDraft() {
    if (!state.liveSync) return;
    try {
      const res = await sidecarFetch('/api/draft', { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.hasDraft && data.draft) {
        consumeDraftIfNewer(data.draft);
      }
    } catch {}
  }

  function showConsoleLog(msg) {
    $('console-text').textContent = msg;
    $('console-strip').classList.remove('hidden');
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.token !== state.renderToken) return;
    if (typeof d.__stPreviewHeight === 'number') {
      $('preview-frame').style.height = `${d.__stPreviewHeight}px`;
    }
    if (typeof d.__stPreviewLog === 'string') {
      showConsoleLog(d.__stPreviewLog);
    }
    if (d.__stVarsMutated && typeof d.__stVarsMutated === 'object') {
      state.mockVars = JSON.stringify(d.__stVarsMutated, null, 2);
      $('mock-vars').value = state.mockVars;
      persistState();
    }
  });

  let debounceTimer = null;
  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(evaluateAndRender, 100);
  }

  $('preset-select').addEventListener('change', (e) => {
    const key = e.target.value;
    if (key && PRESETS[key]) {
      state.rulesList = [];
      $('multi-rule-bar').classList.add('hidden');
      applyPresetObject(PRESETS[key], true);
    }
    e.target.value = '';
  });

  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importJsonRules(text);
      showConsoleLog(`已导入 ${file.name}`);
    } catch (err) {
      showConsoleLog(`导入失败：${err.message}`);
    }
    e.target.value = '';
  });

  $('sync-btn').addEventListener('click', () => {
    state.liveSync = !state.liveSync;
    syncInputsFromState();
    persistState();
    if (state.liveSync) void pollLiveDraft();
  });

  document.querySelectorAll('[data-stage-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.stageView = btn.dataset.stageView;
      document.querySelectorAll('[data-stage-view]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      $('view-render').classList.toggle('hidden', state.stageView !== 'render');
      $('view-html').classList.toggle('hidden', state.stageView !== 'html');
      $('view-audit').classList.toggle('hidden', state.stageView !== 'audit');
    });
  });

  document.querySelectorAll('[data-viewport]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.viewport = btn.dataset.viewport;
      document.querySelectorAll('[data-viewport]').forEach((b) => b.classList.toggle('active', b === btn));
      $('viewport-box').dataset.vp = state.viewport;
      persistState();
    });
  });

  $('bg-toggle').addEventListener('click', () => {
    state.canvasTheme = state.canvasTheme === 'dark' ? 'light' : 'dark';
    syncInputsFromState();
    evaluateAndRender();
  });

  $('rerender-btn').addEventListener('click', evaluateAndRender);
  $('clear-console-btn').addEventListener('click', () => $('console-strip').classList.add('hidden'));

  $('copy-html-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('html-output').textContent || '');
      showConsoleLog('已复制 HTML');
    } catch {}
  });

  document.querySelectorAll('[data-wb-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.wbTab = btn.dataset.wbTab;
      document.querySelectorAll('[data-wb-tab]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      ['rule', 'sample', 'vars', 'export'].forEach((k) => {
        $(`wb-${k}`).classList.toggle('hidden', k !== state.wbTab);
      });
    });
  });

  document.querySelectorAll('[data-insert]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const ta = $('replace-string');
      const ins = chip.dataset.insert || '';
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, start) + ins + ta.value.slice(end);
      state.replaceString = ta.value;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + ins.length;
      scheduleRender();
    });
  });

  document.querySelectorAll('[data-wrap-fence]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cur = state.replaceString.trim();
      if (/^```html/i.test(cur)) return;
      state.replaceString = '```html\n' + cur + '\n```';
      $('replace-string').value = state.replaceString;
      evaluateAndRender();
    });
  });

  $('rule-index-select').addEventListener('change', (e) => loadRuleFromList(Number(e.target.value) || 0));
  $('chain-all-toggle').addEventListener('change', (e) => {
    state.chainAll = e.target.checked;
    evaluateAndRender();
  });

  $('input-mode').addEventListener('change', (e) => {
    state.mode = e.target.value;
    syncInputsFromState();
    evaluateAndRender();
  });

  $('host-surface').addEventListener('change', (e) => {
    state.hostSurface = e.target.value;
    evaluateAndRender();
  });

  ['script-name', 'find-regex', 'trim-strings', 'replace-string', 'sample-input', 'mock-vars'].forEach((id) => {
    const keyMap = {
      'script-name': 'scriptName',
      'find-regex': 'findRegex',
      'trim-strings': 'trimStrings',
      'replace-string': 'replaceString',
      'sample-input': 'sampleInput',
      'mock-vars': 'mockVars',
    };
    $(id).addEventListener('input', (e) => {
      state[keyMap[id]] = e.target.value;
      if (state.rulesList[state.activeRuleIdx] && id !== 'sample-input' && id !== 'mock-vars') {
        const cur = state.rulesList[state.activeRuleIdx];
        cur.scriptName = state.scriptName;
        cur.findRegex = state.findRegex;
        cur.trimStrings = parseTrimList(state.trimStrings);
        cur.replaceString = state.replaceString;
      }
      scheduleRender();
    });
  });

  $('emit-mvu-btn').addEventListener('click', () => {
    try {
      const parsed = state.mockVars.trim() ? JSON.parse(state.mockVars) : {};
      $('vars-status').textContent = '已发送更新事件';
      $('preview-frame').contentWindow?.postMessage({ __stMvuUpdate: parsed }, '*');
    } catch (e) {
      $('vars-status').textContent = `JSON 语法错误：${e.message}`;
    }
  });

  $('parse-json-btn').addEventListener('click', () => {
    try {
      const raw = $('paste-json-area').value.trim();
      if (!raw) return;
      importJsonRules(raw);
      document.querySelector('[data-wb-tab="rule"]').click();
    } catch (e) {
      showConsoleLog(`JSON 解析失败：${e.message}`);
    }
  });

  $('export-card-btn').addEventListener('click', () => {
    const obj = buildExportPayload('card');
    downloadJson(`${obj.scriptName || 'regex'}-card.json`, obj);
  });

  $('export-th-btn').addEventListener('click', () => {
    const obj = buildExportPayload('helper');
    downloadJson(`${obj.script_name || 'regex'}-tavern-helper.json`, obj);
  });

  $('copy-card-json-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildExportPayload('card'), null, 2));
      showConsoleLog('已复制 JSON');
    } catch {}
  });

  function switchTopMode(modeName) {
    const isXray = modeName === 'xray';
    document.querySelectorAll('[data-top-mode]').forEach((btn) => {
      const active = btn.dataset.topMode === modeName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    $('panel-studio').classList.toggle('hidden', isXray);
    $('panel-xray').classList.toggle('hidden', !isXray);
    $('studio-top-actions').classList.toggle('hidden', isXray);
    $('xray-top-actions').classList.toggle('hidden', !isXray);
  }

  document.querySelectorAll('[data-top-mode]').forEach((btn) => {
    btn.addEventListener('click', () => switchTopMode(btn.dataset.topMode));
  });

  window.__stStudioBridge = {
    switchTopMode,
    loadSingleRegex(rawRule, sampleText, mockVarsObj) {
      state.rulesList = [];
      $('multi-rule-bar').classList.add('hidden');
      const norm = normalizeImportedRule(rawRule, 0);
      if (typeof sampleText === 'string' && sampleText.trim()) state.sampleInput = sampleText;
      if (mockVarsObj && typeof mockVarsObj === 'object') {
        state.mockVars = JSON.stringify(mockVarsObj, null, 2);
      }
      applyPresetObject({
        mode: 'regex',
        hostSurface: 'auto',
        scriptName: norm.scriptName,
        findRegex: norm.findRegex,
        trimStrings: norm.trimStrings,
        replaceString: norm.replaceString,
        sampleInput: state.sampleInput,
        mockVars: state.mockVars,
      }, true);
      switchTopMode('studio');
    },
    loadAllRegexes(rawRulesArray, sampleText, mockVarsObj) {
      if (typeof sampleText === 'string' && sampleText.trim()) state.sampleInput = sampleText;
      if (mockVarsObj && typeof mockVarsObj === 'object') {
        state.mockVars = JSON.stringify(mockVarsObj, null, 2);
      }
      importJsonRules(JSON.stringify(rawRulesArray));
      if (rawRulesArray.length > 1) {
        state.chainAll = true;
        $('chain-all-toggle').checked = true;
        evaluateAndRender();
      }
      switchTopMode('studio');
    },
    loadDirectHtml(htmlText, label, mockVarsObj) {
      state.rulesList = [];
      $('multi-rule-bar').classList.add('hidden');
      if (mockVarsObj && typeof mockVarsObj === 'object') {
        state.mockVars = JSON.stringify(mockVarsObj, null, 2);
      }
      applyPresetObject({
        mode: 'direct-html',
        hostSurface: 'auto',
        scriptName: label || '内嵌页面',
        replaceString: htmlText,
        mockVars: state.mockVars,
      }, true);
      switchTopMode('studio');
    },
    setSampleFloor(floorText) {
      state.sampleInput = String(floorText || '');
      syncInputsFromState();
      evaluateAndRender();
      switchTopMode('studio');
    },
  };

  loadInitialState();
  syncInputsFromState();
  if (state.liveSync && window.__INITIAL_DRAFT) {
    if (!consumeDraftIfNewer(window.__INITIAL_DRAFT)) evaluateAndRender();
  } else {
    evaluateAndRender();
  }
  void pollLiveDraft();
  setInterval(pollLiveDraft, POLL_MS);
})();
