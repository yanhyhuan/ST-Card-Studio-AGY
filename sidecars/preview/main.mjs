import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// Release directory handle on Windows so plugin updates/renames never hit EBUSY.
try { process.chdir(tmpdir()); } catch {}

const DATA_DIR = join(homedir(), '.gemini', 'antigravity', 'st-statusbar-preview');
const DRAFT_FILE = join(DATA_DIR, 'live-draft.json');
const MAX_BODY_BYTES = 256 * 1024;

function readDraft() {
  try {
    if (!existsSync(DRAFT_FILE)) return { hasDraft: false, draft: null };
    const raw = readFileSync(DRAFT_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return { hasDraft: true, draft: parsed };
  } catch {
    return { hasDraft: false, draft: null };
  }
}

function saveDraft(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('草稿格式须为 JSON 对象');
  }
  mkdirSync(DATA_DIR, { recursive: true });
  const next = {
    ...payload,
    updatedAt: Number(payload.updatedAt) || Date.now(),
  };
  const serialized = JSON.stringify(next, null, 2);
  if (Buffer.byteLength(serialized, 'utf-8') > MAX_BODY_BYTES) {
    throw new Error('草稿体积超过 256 KB 上限');
  }
  writeFileSync(DRAFT_FILE, serialized, 'utf-8');
  return { ok: true, draft: next };
}

/**
 * Builds a 100% self-contained single-payload HTML page.
 * Why: Under custom-scheme URLs like `sidecar://st-statusbar-preview/preview/`,
 * root-relative `/styles.css` or `/app.js` resolves to `sidecar://st-statusbar-preview/styles.css`
 * (dropping the `/preview` sidecar segment and 404ing, leaving raw unstyled HTML!).
 * Inlining CSS + JS guarantees zero subresource path breaks across `sidecar://`, `http://`, and `file://`.
 */
export function buildSelfContainedHtml({ includeInitialDraft = true } = {}) {
  const tpl = readFileSync(join(HERE, 'src-index.html'), 'utf-8');
  const css = readFileSync(join(HERE, 'styles.css'), 'utf-8').replace(/<\/style/gi, '<\\/style');
  const appJs = readFileSync(join(HERE, 'app.js'), 'utf-8').replace(/<\/script/gi, '<\\/script');
  const xrayJs = existsSync(join(HERE, 'xray.js'))
    ? readFileSync(join(HERE, 'xray.js'), 'utf-8').replace(/<\/script/gi, '<\\/script')
    : '';
  const js = `${appJs}\n${xrayJs}`;
  let draftBoot = '';
  if (includeInitialDraft) {
    const { hasDraft, draft } = readDraft();
    if (hasDraft && draft) {
      const safeDraft = JSON.stringify(draft).replace(/</g, '\\u003c');
      draftBoot = `<script>window.__INITIAL_DRAFT = ${safeDraft};</script>\n  `;
    }
  }
  return tpl
    .replace('<!-- __INLINE_STYLE_SLOT__ -->', () => `<style>\n${css}\n  </style>`)
    .replace('<!-- __INLINE_SCRIPT_SLOT__ -->', () => `${draftBoot}<script>\n${js}\n  </script>`);
}

// Sync compiled standalone `index.html` on disk too so even `file://` opens cleanly.
try {
  writeFileSync(join(HERE, 'index.html'), buildSelfContainedHtml({ includeInitialDraft: false }), 'utf-8');
} catch {}

async function loadSidecarSdk() {
  try {
    return await import('sidecar_sdk');
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    const req = createRequire(import.meta.url);
    const resolved = req.resolve('sidecar_sdk');
    return import(pathToFileURL(resolved).href);
  }
}

if (process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
  const { SidecarApp, Response } = await loadSidecarSdk();
  const app = new SidecarApp();

  const serveHtml = () => new Response(buildSelfContainedHtml({ includeInitialDraft: true }), {
    contentType: 'text/html; charset=utf-8',
    headers: { 'Cache-Control': 'no-store' },
  });

  for (const p of ['/', '/index.html', '/preview', '/preview/']) {
    app.page(p, serveHtml);
  }

  for (const cssRoute of ['/styles.css', '/preview/styles.css']) {
    app.api(cssRoute, () => new Response(readFileSync(join(HERE, 'styles.css'), 'utf-8'), {
      contentType: 'text/css; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
    }), 'GET');
  }

  for (const jsRoute of ['/app.js', '/preview/app.js']) {
    app.api(jsRoute, () => new Response(readFileSync(join(HERE, 'app.js'), 'utf-8'), {
      contentType: 'application/javascript; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
    }), 'GET');
  }

  for (const draftRoute of ['/api/draft', '/preview/api/draft']) {
    app.api(draftRoute, () => readDraft(), 'GET');
    app.api(draftRoute, (data) => {
      try {
        return saveDraft(data);
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message || '保存失败' }), {
          status: 400,
          contentType: 'application/json; charset=utf-8',
        });
      }
    }, 'POST');
  }

  app.run();
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.ST_PREVIEW_PORT || 17896);
  const server = createServer(async (req, res) => {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const url = new URL(req.url || '/', `http://${host}`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (url.pathname === '/api/draft' || url.pathname === '/preview/api/draft') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(readDraft()));
        return;
      }
      if (req.method === 'POST') {
        const sameOrigin = !req.headers.origin || req.headers.origin === `http://${host}`;
        if (!sameOrigin) {
          res.writeHead(403);
          res.end();
          return;
        }
        try {
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (Buffer.byteLength(raw, 'utf-8') > MAX_BODY_BYTES) throw new Error('草稿体积超限');
          }
          const saved = saveDraft(JSON.parse(raw || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(saved));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e.message || '请求无效' }));
        }
        return;
      }
      res.writeHead(405);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end();
      return;
    }

    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/preview' || url.pathname === '/preview/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buildSelfContainedHtml({ includeInitialDraft: true }));
      return;
    }

    if (url.pathname.endsWith('/styles.css')) {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(readFileSync(join(HERE, 'styles.css'), 'utf-8'));
      return;
    }

    if (url.pathname.endsWith('/app.js')) {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(readFileSync(join(HERE, 'app.js'), 'utf-8'));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`ST Statusbar Preview running at http://127.0.0.1:${port}`);
  });
}
