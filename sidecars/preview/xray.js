(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  if (!$('panel-xray')) return;

  let currentAvatarUrl = null;
  let currentAnalyzed = null;

  function decodeBase64ToUtf8(b64) {
    const clean = String(b64 || '').replace(/\s+/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  function parsePayloadString(str) {
    const trimmed = String(str || '').trim();
    if (!trimmed) throw new Error('文本块为空');
    if (trimmed.startsWith('{')) return JSON.parse(trimmed);
    return JSON.parse(decodeBase64ToUtf8(trimmed));
  }

  async function inflateZlibBytes(u8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前环境不支持解压 zTXt 数据块');
    }
    const tryFormat = async (fmt, slice) => {
      const ds = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      writer.write(slice);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(buf);
    };
    try {
      return await tryFormat('deflate', u8);
    } catch {
      return await tryFormat('deflate-raw', u8.subarray(2));
    }
  }

  async function parsePngCharacterCard(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 24 || !sig.every((b, i) => bytes[i] === b)) {
      throw new Error('文件头不是有效的 PNG 图片');
    }

    const view = new DataView(arrayBuffer);
    const latin1 = new TextDecoder('latin1');
    const utf8 = new TextDecoder('utf-8');
    const foundPayloads = [];
    let offset = 8;

    while (offset + 12 <= bytes.length) {
      const len = view.getUint32(offset, false);
      const type = latin1.decode(bytes.subarray(offset + 4, offset + 8));
      const dataStart = offset + 8;
      const dataEnd = dataStart + len;
      if (dataEnd + 4 > bytes.length) {
        throw new Error(`PNG 数据块 ${type} 长度异常`);
      }
      const chunk = bytes.subarray(dataStart, dataEnd);

      if (type === 'tEXt') {
        const nul = chunk.indexOf(0);
        if (nul > 0) {
          const keyword = latin1.decode(chunk.subarray(0, nul));
          const text = latin1.decode(chunk.subarray(nul + 1));
          if (/^(ccv3|chara)$/i.test(keyword)) {
            foundPayloads.push({ chunkType: 'tEXt', keyword: keyword.toLowerCase(), rawText: text });
          }
        }
      } else if (type === 'zTXt') {
        const nul = chunk.indexOf(0);
        if (nul > 0 && nul + 2 <= chunk.length) {
          const keyword = latin1.decode(chunk.subarray(0, nul));
          if (/^(ccv3|chara)$/i.test(keyword)) {
            const inflated = await inflateZlibBytes(chunk.subarray(nul + 2));
            foundPayloads.push({ chunkType: 'zTXt', keyword: keyword.toLowerCase(), rawText: latin1.decode(inflated) });
          }
        }
      } else if (type === 'iTXt') {
        const nul1 = chunk.indexOf(0);
        if (nul1 > 0 && nul1 + 3 <= chunk.length) {
          const keyword = latin1.decode(chunk.subarray(0, nul1));
          const compFlag = chunk[nul1 + 1];
          let pos = nul1 + 3;
          const nul2 = chunk.indexOf(0, pos);
          if (nul2 >= 0) {
            pos = nul2 + 1;
            const nul3 = chunk.indexOf(0, pos);
            if (nul3 >= 0) {
              pos = nul3 + 1;
              if (/^(ccv3|chara)$/i.test(keyword)) {
                const bodyBytes = compFlag === 1 ? await inflateZlibBytes(chunk.subarray(pos)) : chunk.subarray(pos);
                foundPayloads.push({ chunkType: 'iTXt', keyword: keyword.toLowerCase(), rawText: utf8.decode(bodyBytes) });
              }
            }
          }
        }
      } else if (type === 'IEND') {
        break;
      }

      offset = dataEnd + 4;
    }

    if (foundPayloads.length === 0) {
      throw new Error('图片内未找到 ccv3 或 chara 数据块（可能经聊天软件压缩丢失了元数据）');
    }

    const parsedList = foundPayloads.map((p) => ({
      ...p,
      json: parsePayloadString(p.rawText),
    }));

    const ccv3Entry = parsedList.find((p) => p.keyword === 'ccv3');
    const charaEntry = parsedList.find((p) => p.keyword === 'chara');
    const chosen = ccv3Entry || charaEntry || parsedList[0];

    let dualNote = null;
    if (ccv3Entry && charaEntry) {
      const n1 = ccv3Entry.json?.data?.name || ccv3Entry.json?.name || '';
      const n2 = charaEntry.json?.data?.name || charaEntry.json?.name || '';
      if (n1 !== n2) dualNote = `ccv3（${n1}）与 chara（${n2}）名称不一致`;
    }

    return {
      rawCard: chosen.json,
      chunkSummary: `${chosen.chunkType}/${chosen.keyword}`,
      dualNote,
    };
  }

  function estimateTokens(text) {
    const str = String(text || '');
    if (!str) return 0;
    let cjk = 0;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 0x2E80) cjk++;
    }
    return Math.ceil(cjk * 0.85 + (str.length - cjk) * 0.28);
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function extractTavernHelper(ext) {
    const th = ext?.tavern_helper;
    if (!th) return { scripts: [], regexes: [], variables: null };
    let mapObj = th;
    if (Array.isArray(th)) {
      mapObj = {};
      for (const pair of th) {
        if (Array.isArray(pair) && pair.length >= 2 && typeof pair[0] === 'string') {
          mapObj[pair[0]] = pair[1];
        }
      }
    }
    const scriptsRaw = Array.isArray(mapObj.scripts) ? mapObj.scripts : [];
    const regexRaw = Array.isArray(mapObj.regexes) ? mapObj.regexes : (Array.isArray(mapObj.tavern_regexes) ? mapObj.tavern_regexes : []);
    const varsRaw = (mapObj.variables && typeof mapObj.variables === 'object') ? mapObj.variables : null;
    return { scripts: scriptsRaw, regexes: regexRaw, variables: varsRaw };
  }

  function scanSecurityNotes({ regexes, scripts, greetings }) {
    const notes = [];
    const remoteUrls = new Set();
    let hasEval = false;
    let hasWildcardPost = false;

    const inspectCode = (str, where) => {
      const s = String(str || '');
      if (!s) return;
      for (const m of s.matchAll(/https?:\/\/[^\s"'`)<>]+/gi)) {
        const u = m[0];
        if (/\.(?:mjs|js|css)\b|jsdelivr|unpkg|esm\.sh|cdnjs|github/i.test(u)) {
          remoteUrls.add(`${u}（${where}）`);
        }
      }
      if (/\beval\s*\(|new\s+Function\s*\(/i.test(s)) hasEval = true;
      if (/postMessage\s*\([^)]*['"]\*['"]\s*\)/i.test(s)) hasWildcardPost = true;
    };

    regexes.forEach((r) => inspectCode(r.replaceString ?? r.replace_string, r.scriptName || r.script_name || '正则'));
    scripts.forEach((sc) => inspectCode(sc.content ?? sc.code ?? JSON.stringify(sc), sc.name || '脚本'));
    greetings.forEach((g) => inspectCode(g.text, g.label));

    if (remoteUrls.size > 0) {
      notes.push({
        warn: true,
        title: `外部脚本或样式链接（${remoteUrls.size} 处）`,
        detail: Array.from(remoteUrls).slice(0, 5).join('\n'),
      });
    }
    if (hasEval) {
      notes.push({
        warn: true,
        title: '含 eval / new Function 动态执行',
        detail: '当前仅做静态展示未运行，导入酒馆前请核对下方源码。',
      });
    }
    if (hasWildcardPost) {
      notes.push({
        warn: true,
        title: '含 postMessage(..., "*") 跨窗口消息',
        detail: '请留意接收侧是否校验消息字段。',
      });
    }
    if (notes.length === 0) {
      notes.push({
        warn: false,
        title: '未发现外部脚本链接或 eval 调用',
        detail: '',
      });
    }
    return notes;
  }

  function analyzeRawCard(rawCard, meta = {}) {
    if (!rawCard || typeof rawCard !== 'object') throw new Error('无效的 JSON 对象');
    const d = (rawCard.data && typeof rawCard.data === 'object') ? rawCard.data : rawCard;

    const spec = rawCard.spec === 'chara_card_v3'
      ? 'CCv3'
      : (rawCard.spec === 'chara_card_v2' ? 'CCv2' : 'JSON');

    const personaFields = [
      { key: 'description', label: '角色描述 (description)', text: d.description || '' },
      { key: 'personality', label: '性格 (personality)', text: d.personality || '' },
      { key: 'scenario', label: '场景 (scenario)', text: d.scenario || '' },
      { key: 'mes_example', label: '对话示例 (mes_example)', text: d.mes_example || '' },
      { key: 'system_prompt', label: '系统提示词 (system_prompt)', text: d.system_prompt || '' },
      { key: 'post_history_instructions', label: '历史后指令 (post_history_instructions)', text: d.post_history_instructions || '' },
      { key: 'creator_notes', label: '作者说明 (creator_notes)', text: d.creator_notes || '' },
    ].filter((f) => String(f.text).trim().length > 0);

    const greetings = [];
    if (typeof d.first_mes === 'string' && d.first_mes.length > 0) {
      greetings.push({ label: '主开场白', text: d.first_mes });
    }
    if (Array.isArray(d.alternate_greetings)) {
      d.alternate_greetings.forEach((g, i) => {
        if (typeof g === 'string' && g.length > 0) {
          greetings.push({ label: `备选 #${i + 1}`, text: g });
        }
      });
    }
    if (Array.isArray(d.group_only_greetings)) {
      d.group_only_greetings.forEach((g, i) => {
        if (typeof g === 'string' && g.length > 0) {
          greetings.push({ label: `群聊开场 #${i + 1}`, text: g });
        }
      });
    }

    const rawWbEntries = d.character_book?.entries;
    const wbEntries = (Array.isArray(rawWbEntries) ? rawWbEntries : Object.values(rawWbEntries || {}))
      .filter((e) => e && typeof e === 'object')
      .map((e, idx) => ({
        title: e.comment || e.name || `条目 #${idx + 1}`,
        keys: Array.isArray(e.keys) ? e.keys : [],
        constant: Boolean(e.constant),
        enabled: e.enabled !== false && !e.disable,
        content: String(e.content || ''),
      }));

    const cardRegexes = Array.isArray(d.extensions?.regex_scripts) ? d.extensions.regex_scripts : [];
    const th = extractTavernHelper(d.extensions);
    const allRegexes = [
      ...cardRegexes,
      ...th.regexes,
    ];

    const scripts = th.scripts.map((s, idx) => ({
      name: s.name || s.scriptName || `脚本 #${idx + 1}`,
      enabled: s.enabled !== false,
      info: s.info || s.description || '',
      content: String(s.content ?? s.code ?? ''),
    }));

    const personaChars = personaFields.filter((f) => f.key !== 'creator_notes').reduce((n, f) => n + f.text.length, 0);
    const greetChars = greetings.reduce((n, g) => n + g.text.length, 0);
    const wbChars = wbEntries.reduce((n, e) => n + e.content.length, 0);
    const regexChars = allRegexes.reduce((n, r) => n + String(r.replaceString ?? r.replace_string ?? '').length, 0);
    const scriptChars = scripts.reduce((n, s) => n + s.content.length, 0);

    const budgetParts = [
      { label: '人设', chars: personaChars, tokens: estimateTokens(personaFields.map((f) => f.text).join('\n')), color: '#B8654B' },
      { label: '世界书', chars: wbChars, tokens: estimateTokens(wbEntries.map((e) => e.content).join('\n')), color: '#5E849A' },
      { label: '开场白', chars: greetChars, tokens: estimateTokens(greetings.map((g) => g.text).join('\n')), color: '#689D7D' },
      { label: '正则', chars: regexChars, tokens: estimateTokens(allRegexes.map((r) => r.replaceString ?? r.replace_string ?? '').join('\n')), color: '#C89B4B' },
      { label: '脚本', chars: scriptChars, tokens: estimateTokens(scripts.map((s) => s.content).join('\n')), color: '#8C759E' },
    ];

    const secNotes = scanSecurityNotes({ regexes: allRegexes, scripts, greetings });

    return {
      rawCard,
      name: d.name || '未命名',
      creator: d.creator || '',
      version: d.character_version || '',
      tags: Array.isArray(d.tags) ? d.tags : [],
      spec,
      meta,
      personaFields,
      greetings,
      wbEntries,
      allRegexes,
      scripts,
      thVariables: th.variables,
      budgetParts,
      secNotes,
    };
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function renderXrayView(info) {
    currentAnalyzed = info;
    $('xray-error').classList.add('hidden');
    $('xray-result').classList.remove('hidden');
    $('xray-count-pill').textContent = info.name.slice(0, 6);
    $('xray-count-pill').classList.remove('hidden');

    if (info.meta.avatarUrl) {
      $('card-avatar-img').src = info.meta.avatarUrl;
      $('card-avatar-img').classList.remove('hidden');
      $('card-avatar-fallback').classList.add('hidden');
    } else {
      $('card-avatar-img').classList.add('hidden');
      $('card-avatar-fallback').textContent = info.meta.format || 'JSON';
      $('card-avatar-fallback').classList.remove('hidden');
    }

    $('card-name').textContent = info.name;
    $('card-spec-badge').textContent = [info.spec, info.meta.chunkSummary].filter(Boolean).join(' · ');

    const sub = $('card-submeta');
    sub.textContent = '';
    const metaItems = [];
    if (info.creator) metaItems.push(`作者 ${info.creator}`);
    if (info.version) metaItems.push(`v${info.version.replace(/^v/i, '')}`);
    if (info.meta.byteSize) metaItems.push(formatBytes(info.meta.byteSize));
    if (info.meta.dualNote) metaItems.push(info.meta.dualNote);
    metaItems.forEach((m) => sub.appendChild(makeEl('span', '', m)));

    const tagRow = $('card-tags-row');
    tagRow.textContent = info.tags.length > 0 ? `标签：${info.tags.slice(0, 10).join(' / ')}` : '';
    tagRow.classList.toggle('hidden', info.tags.length === 0);

    const totalChars = info.budgetParts.reduce((s, p) => s + p.chars, 0);
    const totalToks = info.budgetParts.reduce((s, p) => s + p.tokens, 0);
    $('budget-total').textContent = `${totalChars.toLocaleString()} 字 · ~${totalToks.toLocaleString()} tok`;

    const bar = $('budget-bar');
    const legend = $('budget-legend');
    bar.textContent = '';
    legend.textContent = '';
    info.budgetParts.forEach((p) => {
      if (p.chars <= 0 || totalChars <= 0) return;
      const pct = Math.round((p.chars / totalChars) * 100);
      const seg = makeEl('div', 'budget-seg');
      seg.style.width = `${Math.max((p.chars / totalChars) * 100, 1.5)}%`;
      seg.style.background = p.color;
      bar.appendChild(seg);
      legend.appendChild(makeEl('span', '', `${p.label} ${pct}% (${p.chars.toLocaleString()}字)`));
    });

    $('xcount-regex').textContent = String(info.allRegexes.length);
    $('xcount-greet').textContent = String(info.greetings.length);
    $('xcount-wb').textContent = String(info.wbEntries.length);
    $('xcount-scripts').textContent = String(info.scripts.length);

    renderRegexList(info);
    renderGreetingsList(info);
    renderWorldbookList(info, '');
    renderScriptsAndSecurity(info);
    renderPersonaList(info);
  }

  function pickBestSampleForRegex(info, rule) {
    const rawPat = rule.findRegex ?? rule.find_regex ?? '';
    if (!rawPat || info.greetings.length === 0) return info.greetings[0]?.text || '';
    const slash = /^\/([\s\S]*)\/([a-z]*)$/.exec(rawPat);
    try {
      const re = slash ? new RegExp(slash[1], slash[2].replace(/g/g, '')) : new RegExp(rawPat, 'm');
      const hit = info.greetings.find((g) => re.test(g.text));
      if (hit) return hit.text;
    } catch {}
    return info.greetings[0]?.text || '';
  }

  function renderRegexList(info) {
    const box = $('xray-regex-list');
    box.textContent = '';
    $('xray-regex-toolbar').classList.toggle('hidden', info.allRegexes.length <= 1);

    if (info.allRegexes.length === 0) {
      box.appendChild(makeEl('div', 'empty-hint', '无内嵌正则。'));
      return;
    }

    info.allRegexes.forEach((r, idx) => {
      const row = makeEl('div', 'flat-row');
      const head = makeEl('div', 'row-head');
      const titleWrap = makeEl('div', 'row-title');
      const name = r.scriptName ?? r.script_name ?? `正则 #${idx + 1}`;
      const isDisabled = Object.hasOwn(r, 'enabled') ? r.enabled === false : Boolean(r.disabled);
      titleWrap.appendChild(makeEl('span', '', name));
      if (isDisabled) titleWrap.appendChild(makeEl('span', 'plain-tag warn', '禁用'));

      const isDisplay = Object.hasOwn(r, 'destination')
        ? Boolean(r.destination?.display)
        : Boolean(r.markdownOnly || (!r.markdownOnly && !r.promptOnly));
      titleWrap.appendChild(makeEl('span', 'plain-tag', isDisplay ? '显示' : '仅提示词'));

      const sendBtn = makeEl('button', 'btn primary sm', '送入调试台');
      sendBtn.type = 'button';
      sendBtn.addEventListener('click', () => {
        const sample = pickBestSampleForRegex(info, r);
        window.__stStudioBridge?.loadSingleRegex(r, sample, info.thVariables);
      });

      head.appendChild(titleWrap);
      head.appendChild(sendBtn);
      row.appendChild(head);

      row.appendChild(makeEl('div', 'row-meta', r.findRegex ?? r.find_regex ?? ''));

      const repStr = String(r.replaceString ?? r.replace_string ?? '');
      const det = makeEl('details', 'x-details');
      det.appendChild(makeEl('summary', '', `替换模板 (${repStr.length} 字)`));
      det.appendChild(makeEl('pre', 'x-pre', repStr));
      row.appendChild(det);

      box.appendChild(row);
    });
  }

  function renderGreetingsList(info) {
    const box = $('xray-greet-list');
    box.textContent = '';
    if (info.greetings.length === 0) {
      box.appendChild(makeEl('div', 'empty-hint', '无开场白。'));
      return;
    }

    info.greetings.forEach((g) => {
      const row = makeEl('div', 'flat-row');
      const head = makeEl('div', 'row-head');
      const titleWrap = makeEl('div', 'row-title');
      titleWrap.appendChild(makeEl('span', '', g.label));
      titleWrap.appendChild(makeEl('span', 'plain-tag', `${g.text.length.toLocaleString()} 字`));

      const actions = makeEl('div', 'btn-row');
      const asSampleBtn = makeEl('button', 'btn sm', '用作测试文本');
      asSampleBtn.type = 'button';
      asSampleBtn.addEventListener('click', () => {
        window.__stStudioBridge?.setSampleFloor(g.text);
      });
      actions.appendChild(asSampleBtn);

      if (/<(?:div|style|html|section|details|table)|```html/i.test(g.text)) {
        const directBtn = makeEl('button', 'btn primary sm', '直接渲染 HTML');
        directBtn.type = 'button';
        directBtn.addEventListener('click', () => {
          window.__stStudioBridge?.loadDirectHtml(g.text, g.label, info.thVariables);
        });
        actions.appendChild(directBtn);
      }

      head.appendChild(titleWrap);
      head.appendChild(actions);
      row.appendChild(head);

      const det = makeEl('details', 'x-details');
      det.appendChild(makeEl('summary', '', '查看正文'));
      det.appendChild(makeEl('pre', 'x-pre', g.text));
      row.appendChild(det);
      box.appendChild(row);
    });
  }

  function renderWorldbookList(info, query) {
    const box = $('xray-wb-list');
    box.textContent = '';
    if (info.wbEntries.length === 0) {
      box.appendChild(makeEl('div', 'empty-hint', '无内嵌世界书。'));
      return;
    }

    const q = String(query || '').trim().toLowerCase();
    const filtered = q
      ? info.wbEntries.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.keys.some((k) => String(k).toLowerCase().includes(q)))
      : info.wbEntries;

    if (filtered.length === 0) {
      box.appendChild(makeEl('div', 'empty-hint', `无匹配「${query}」的条目。`));
      return;
    }

    filtered.forEach((e) => {
      const row = makeEl('div', 'flat-row');
      const head = makeEl('div', 'row-head');
      const titleWrap = makeEl('div', 'row-title');
      titleWrap.appendChild(makeEl('span', '', e.title));
      titleWrap.appendChild(makeEl('span', 'plain-tag', e.constant ? '常驻' : '关键词'));
      if (!e.enabled) titleWrap.appendChild(makeEl('span', 'plain-tag warn', '禁用'));
      head.appendChild(titleWrap);
      head.appendChild(makeEl('span', 'row-meta', `${e.content.length} 字`));
      row.appendChild(head);

      if (!e.constant && e.keys.length > 0) {
        row.appendChild(makeEl('div', 'row-meta', `触发词：${e.keys.join('、')}`));
      }

      const det = makeEl('details', 'x-details');
      det.appendChild(makeEl('summary', '', '查看正文'));
      det.appendChild(makeEl('pre', 'x-pre', e.content));
      row.appendChild(det);
      box.appendChild(row);
    });
  }

  function renderScriptsAndSecurity(info) {
    const secBox = $('xray-sec-summary');
    const scBox = $('xray-scripts-list');
    secBox.textContent = '';
    scBox.textContent = '';

    info.secNotes.forEach((n) => {
      const row = makeEl('div', 'flat-row');
      const head = makeEl('div', 'row-head');
      const title = makeEl('div', 'row-title');
      title.appendChild(makeEl('span', `plain-tag ${n.warn ? 'warn' : ''}`, n.warn ? '留意' : '静态检查'));
      title.appendChild(makeEl('span', '', n.title));
      head.appendChild(title);
      row.appendChild(head);
      if (n.detail) row.appendChild(makeEl('div', 'row-meta', n.detail));
      secBox.appendChild(row);
    });

    if (info.thVariables) {
      const row = makeEl('div', 'flat-row');
      row.appendChild(makeEl('div', 'row-title', '随卡初始变量 (tavern_helper.variables)'));
      const det = makeEl('details', 'x-details');
      det.appendChild(makeEl('summary', '', '查看 JSON'));
      det.appendChild(makeEl('pre', 'x-pre', JSON.stringify(info.thVariables, null, 2)));
      row.appendChild(det);
      scBox.appendChild(row);
    }

    if (info.scripts.length === 0) {
      scBox.appendChild(makeEl('div', 'empty-hint', '无内嵌 TavernHelper 脚本。'));
      return;
    }

    info.scripts.forEach((s) => {
      const row = makeEl('div', 'flat-row');
      const head = makeEl('div', 'row-head');
      const titleWrap = makeEl('div', 'row-title');
      titleWrap.appendChild(makeEl('span', '', s.name));
      if (!s.enabled) titleWrap.appendChild(makeEl('span', 'plain-tag warn', '默认关闭'));
      head.appendChild(titleWrap);
      head.appendChild(makeEl('span', 'row-meta', `${s.content.length} 字`));
      row.appendChild(head);
      if (s.info) row.appendChild(makeEl('div', 'muted-note', s.info));

      const det = makeEl('details', 'x-details');
      det.appendChild(makeEl('summary', '', '查看源码'));
      det.appendChild(makeEl('pre', 'x-pre', s.content));
      row.appendChild(det);
      box.appendChild(row);
    });
  }

  function renderPersonaList(info) {
    const box = $('xray-persona-list');
    box.textContent = '';
    if (info.personaFields.length === 0) {
      box.appendChild(makeEl('div', 'empty-hint', '无人设文本字段。'));
      return;
    }
    info.personaFields.forEach((f) => {
      const row = makeEl('div', 'flat-row');
      const head = makeEl('div', 'row-head');
      head.appendChild(makeEl('div', 'row-title', f.label));
      head.appendChild(makeEl('span', 'row-meta', `${f.text.length.toLocaleString()} 字`));
      row.appendChild(head);
      const det = makeEl('details', 'x-details');
      det.open = f.key === 'description';
      det.appendChild(makeEl('summary', '', '查看内容'));
      det.appendChild(makeEl('pre', 'x-pre', f.text));
      row.appendChild(det);
      box.appendChild(row);
    });
  }

  async function handleCardFile(file) {
    if (!file) return;
    $('xray-error').classList.add('hidden');
    try {
      const buf = await file.arrayBuffer();
      const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);

      if (currentAvatarUrl) {
        URL.revokeObjectURL(currentAvatarUrl);
        currentAvatarUrl = null;
      }

      if (isPng) {
        const parsedPng = await parsePngCharacterCard(buf);
        currentAvatarUrl = URL.createObjectURL(file);
        const info = analyzeRawCard(parsedPng.rawCard, {
          format: 'PNG',
          chunkSummary: parsedPng.chunkSummary,
          dualNote: parsedPng.dualNote,
          byteSize: file.size,
          avatarUrl: currentAvatarUrl,
        });
        renderXrayView(info);
      } else {
        const text = new TextDecoder('utf-8').decode(buf);
        const rawJson = JSON.parse(text);
        const info = analyzeRawCard(rawJson, {
          format: 'JSON',
          chunkSummary: '',
          byteSize: file.size,
          avatarUrl: null,
        });
        renderXrayView(info);
      }
      window.__stStudioBridge?.switchTopMode('xray');
    } catch (err) {
      $('xray-error').textContent = `解析失败：${err.message || '未知错误'}`;
      $('xray-error').classList.remove('hidden');
    }
  }

  function loadDemoCard() {
    const svgPortrait = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">
        <rect width="120" height="160" fill="#23211E"/>
        <rect x="12" y="12" width="96" height="136" fill="none" stroke="#6E665B" stroke-width="1"/>
        <text x="60" y="76" text-anchor="middle" fill="#E6E0D5" font-size="15" font-family="serif">沈 砚</text>
        <text x="60" y="98" text-anchor="middle" fill="#9A9184" font-size="10" font-family="sans-serif">临淮渡漕运账房</text>
      </svg>`,
    )}`;

    const demoRaw = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: '沈砚',
        creator: '示例卡',
        character_version: '1.0',
        tags: ['古风', '查账探案', '含状态栏'],
        description: '临淮渡北岸万通货栈的二账房，管着南来北往的船货斤两与栈租出入。常年穿一件洗得发白的青布直裰，右手食指与中指有常年拨算盘留下的薄茧。记数极准，不爱替人兜烂账。',
        personality: '认死理，说话留三分余地，碰到假账会追到底。',
        scenario: '腊月封河前夕，货栈少了三船官盐的入库底单，{{user}}奉命来北岸核查旧账。',
        first_mes: `沈砚把炭盆往桌脚边拨了拨，从架子最下层抽出一摞用麻绳捆着的流水簿，解开绳结摊在桌上。\n“十月十五到廿二的进出仓都在这儿了。官盐那三页被人用茶水洇过，字迹模糊，不过船头的吃水尺码还在水牌上记着，对一对就能看出差了多少斤。”\n\n<ledger>腊月初八 申时 | 万通货栈·内账房 | 剩余盘查时限：三日 | 已核对：水牌尺码 | 待查：十月十八夜班更夫名册</ledger>`,
        alternate_greetings: [
          `<div style="font-family:'Sarasa UI SC',sans-serif;background:#1E1C19;color:#EAE4DA;padding:14px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.12)">
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">封河查账 · 选择来访身份</div>
  <div style="font-size:12px;color:#9E9689;margin-bottom:10px">不同身份会影响沈砚起初愿意交出的底簿范围：</div>
  <div style="display:grid;gap:6px;font-size:12.5px">
    <div style="padding:7px 10px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">转运司书办：持有正式勘合公文，可直接调阅官盐底册</div>
    <div style="padding:7px 10px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">东家远亲：以年终盘库名义入栈，不惊动码头脚夫</div>
  </div>
</div>`,
        ],
        character_book: {
          name: '临淮渡货栈设定',
          entries: [
            {
              comment: '状态栏输出格式',
              constant: true,
              enabled: true,
              keys: [],
              content: '每次回复末尾附一行账目进度：\n<ledger>时辰 | 地点 | 剩余时限 | 已核实线索 | 当前待查项</ledger>',
            },
            {
              comment: '万通货栈水牌规矩',
              constant: false,
              enabled: true,
              keys: ['水牌', '吃水', '尺码'],
              content: '货船靠岸时由码头丈量手先记船身吃水寸数挂上木牌，进仓后再由账房落纸账，两处分属不同管事，很难同时改口。',
            },
          ],
        },
        extensions: {
          regex_scripts: [
            {
              id: 'demo-ledger-regex',
              scriptName: '账房核查记录栏',
              findRegex: '/<ledger>\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([\\s\\S]*?)<\\/ledger>/gi',
              replaceString: `<div class="ledger-box">
  <style>
    .ledger-box {
      margin-top: 12px; padding: 10px 13px; border-radius: 6px;
      background: #1B1A17; border: 1px solid rgba(234,229,220,0.14);
      color: #EAE5DC; font-family: "Sarasa UI SC", sans-serif; font-size: 12.5px;
    }
    .ledger-top { display: flex; justify-content: space-between; gap: 8px; padding-bottom: 7px; margin-bottom: 8px; border-bottom: 1px solid rgba(234,229,220,0.09); color: #B4AC9E; font-size: 12px; }
    .ledger-row { display: flex; justify-content: space-between; gap: 10px; margin-top: 4px; font-size: 12px; }
    .ledger-row span { color: #8F887D; flex-shrink: 0; }
  </style>
  <div class="ledger-top"><span>$1 · $2</span><span>$3</span></div>
  <div class="ledger-row"><span>已核实</span><strong>$4</strong></div>
  <div class="ledger-row"><span>待查项</span><strong>$5</strong></div>
</div>`,
              trimStrings: [],
              placement: [2],
              disabled: false,
              markdownOnly: true,
              promptOnly: false,
            },
          ],
          tavern_helper: [
            ['variables', { stat_data: { location: '万通货栈·内账房', budget: 120, progress: 25, trust: 50 } }],
          ],
        },
      },
    };

    const info = analyzeRawCard(demoRaw, {
      format: '示例',
      chunkSummary: '',
      byteSize: JSON.stringify(demoRaw).length,
      avatarUrl: svgPortrait,
    });
    renderXrayView(info);
  }

  const dropzone = $('xray-dropzone');
  dropzone.addEventListener('click', () => $('xray-file-input').click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('xray-file-input').click();
    }
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleCardFile(file);
  });

  $('xray-pick-btn').addEventListener('click', () => $('xray-file-input').click());
  $('xray-file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) void handleCardFile(file);
    e.target.value = '';
  });

  $('xray-demo-btn').addEventListener('click', loadDemoCard);

  $('send-all-regex-btn').addEventListener('click', () => {
    if (!currentAnalyzed || currentAnalyzed.allRegexes.length === 0) return;
    const sample = currentAnalyzed.greetings[0]?.text || '';
    window.__stStudioBridge?.loadAllRegexes(currentAnalyzed.allRegexes, sample, currentAnalyzed.thVariables);
  });

  $('wb-search-input').addEventListener('input', (e) => {
    if (!currentAnalyzed) return;
    renderWorldbookList(currentAnalyzed, e.target.value);
  });

  $('export-raw-card-btn').addEventListener('click', () => {
    if (!currentAnalyzed?.rawCard) return;
    const blob = new Blob([JSON.stringify(currentAnalyzed.rawCard, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentAnalyzed.name || 'character-card'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.querySelectorAll('[data-xray-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.xrayTab;
      document.querySelectorAll('[data-xray-tab]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      ['regex', 'greetings', 'worldbook', 'scripts', 'persona'].forEach((k) => {
        $(`xpane-${k}`).classList.toggle('hidden', k !== target);
      });
    });
  });
})();
