// 肉呆爱动效的服务端：共用分镜修改和团队字体库。只听本机端口，鉴权在 nginx。不依赖第三方包。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +(process.env.PORT || 8096);
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const BOARDS = path.join(DATA, 'boards');
const FONTS = path.join(DATA, 'fonts');
const HISTORY = path.join(DATA, 'history');
for (const d of [BOARDS, FONTS, HISTORY]) fs.mkdirSync(d, {recursive: true});

const MAX_JSON = 4 * 1024 * 1024;
const MAX_FONT = 40 * 1024 * 1024;
const boardKey = (name) => crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 20);
const boardFile = (name) => path.join(BOARDS, `${boardKey(name)}.json`);

const writeAtomic = (file, text) => {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
};
const readState = (name) => {
  try {
    return JSON.parse(fs.readFileSync(boardFile(name), 'utf8'));
  } catch (e) {
    return {title: String(name), rev: 0, edits: {}, extra: {}, fonts: {}};
  }
};
// 每个分镜每天留一份，改坏了能回去
const snapshot = (name, state) => {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(HISTORY, `${boardKey(name)}-${day}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(state));
};
const saveState = (name, state) => {
  snapshot(name, state);
  state.rev = (state.rev || 0) + 1;
  state.updatedAt = new Date().toISOString();
  writeAtomic(boardFile(name), JSON.stringify(state));
  return state;
};

const readBody = (req, max) =>
  new Promise((ok, no) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > max) {
        no(Object.assign(new Error('文件太大'), {status: 413}));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', no);
  });
const send = (res, status, data) => {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
};

// 只收真字体：按文件头判断
const fontKind = (buf) => {
  const head = buf.subarray(0, 4).toString('latin1');
  if (head === 'wOF2') return {ext: 'woff2', type: 'font/woff2'};
  if (head === 'wOFF') return {ext: 'woff', type: 'font/woff'};
  if (head === 'OTTO') return {ext: 'otf', type: 'font/otf'};
  if (head === 'true' || buf.readUInt32BE(0) === 0x00010000) return {ext: 'ttf', type: 'font/ttf'};
  return null;
};
const fontIndexFile = path.join(FONTS, 'index.json');
const readFonts = () => {
  try {
    return JSON.parse(fs.readFileSync(fontIndexFile, 'utf8'));
  } catch (e) {
    return [];
  }
};

const handle = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = url.pathname.replace(/^\/motion\/api/, '');
  const board = url.searchParams.get('board');

  if (req.method === 'GET' && route === '/state') {
    if (!board) return send(res, 400, {error: '缺 board'});
    const state = readState(board);
    if (url.searchParams.get('since') === String(state.rev)) return send(res, 200, {rev: state.rev, same: true});
    return send(res, 200, state);
  }
  if (req.method === 'POST' && route === '/edit') {
    const body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8'));
    if (!body.board) return send(res, 400, {error: '缺 board'});
    const state = readState(body.board);
    const id = String(body.id);
    if (body.row !== undefined) {
      if (body.row === null) delete state.extra[id];
      else state.extra[id] = body.row;
    } else if (body.diff === null || (body.diff && !Object.keys(body.diff).length)) delete state.edits[id];
    else if (body.diff) state.edits[id] = body.diff;
    return send(res, 200, {rev: saveState(body.board, state).rev});
  }
  if (req.method === 'POST' && route === '/assign') {
    const body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'));
    if (!body.board || !['cn', 'num', 'title'].includes(body.slot)) return send(res, 400, {error: '参数不对'});
    const state = readState(body.board);
    state.fonts = state.fonts || {};
    if (body.font) state.fonts[body.slot] = String(body.font);
    else delete state.fonts[body.slot];
    return send(res, 200, {rev: saveState(body.board, state).rev});
  }
  if (req.method === 'GET' && route === '/fonts') return send(res, 200, {fonts: readFonts()});
  if (req.method === 'POST' && route === '/fonts') {
    const buf = await readBody(req, MAX_FONT);
    const kind = buf.length > 16 ? fontKind(buf) : null;
    if (!kind) return send(res, 400, {error: '这不是字体文件。支持 ttf、otf、woff、woff2；ttc 合集不支持'});
    const id = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    const name = (url.searchParams.get('name') || '未命名字体').slice(0, 80);
    fs.writeFileSync(path.join(FONTS, `${id}.${kind.ext}`), buf);
    const list = readFonts().filter((f) => f.id !== id);
    list.push({id, name, ext: kind.ext, type: kind.type, size: buf.length, at: new Date().toISOString()});
    writeAtomic(fontIndexFile, JSON.stringify(list));
    return send(res, 200, {id, name});
  }
  const m = route.match(/^\/fonts\/([0-9a-f]{16})$/);
  if (m) {
    const list = readFonts();
    const f = list.find((x) => x.id === m[1]);
    if (!f) return send(res, 404, {error: '没有这个字体'});
    const file = path.join(FONTS, `${f.id}.${f.ext}`);
    if (req.method === 'GET') {
      res.writeHead(200, {'Content-Type': f.type, 'Content-Length': f.size, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff'});
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === 'DELETE') {
      fs.rmSync(file, {force: true});
      writeAtomic(fontIndexFile, JSON.stringify(list.filter((x) => x.id !== f.id)));
      return send(res, 200, {ok: true});
    }
  }
  return send(res, 404, {error: '没有这个接口'});
};

// 单进程按顺序处理写请求，读改写不会互相覆盖
let queue = Promise.resolve();
http
  .createServer((req, res) => {
    const run = () =>
      handle(req, res).catch((e) => {
        if (!res.headersSent) send(res, e.status || (e instanceof SyntaxError ? 400 : 500), {error: e.status ? e.message : '服务出错'});
        if (!e.status && !(e instanceof SyntaxError)) console.error(e);
      });
    if (req.method === 'GET') return run();
    queue = queue.then(run, run);
    return queue;
  })
  .listen(PORT, '127.0.0.1', () => console.log(`data-motion listening on 127.0.0.1:${PORT}`));
