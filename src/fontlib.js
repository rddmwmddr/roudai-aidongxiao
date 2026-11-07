// 字体库：服务器版存到团队字体库，单文件版存在这台电脑的浏览器里。
(function (root) {
  'use strict';
  const API = root.DM_API || null;

  const idb = () =>
    new Promise((ok, no) => {
      const r = indexedDB.open('dm_font_lib', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('lib', {keyPath: 'id'});
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  const tx = async (mode, fn) => {
    const db = await idb();
    return new Promise((ok, no) => {
      const store = db.transaction('lib', mode).objectStore('lib');
      const r = fn(store);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  };
  const hashId = async (buf) => {
    const d = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(d)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const failText = async (res) => {
    try {
      return (await res.json()).error || `服务器返回 ${res.status}`;
    } catch (e) {
      return `服务器返回 ${res.status}`;
    }
  };

  const lib = {
    remote: !!API,
    async list() {
      if (API) {
        const res = await fetch(`${API}/fonts`);
        if (!res.ok) throw new Error(await failText(res));
        return (await res.json()).fonts;
      }
      const all = await tx('readonly', (s) => s.getAll());
      return all.map(({id, name, size}) => ({id, name, size}));
    },
    async add(name, buffer) {
      // 先在本机试着载入，坏文件或 ttc 合集在这里就会报错
      const probe = new FontFace('DMProbe', buffer.slice(0));
      try {
        await probe.load();
      } catch (e) {
        throw new Error('这个文件载入不了。支持 ttf、otf、woff、woff2；ttc 合集不支持');
      }
      if (API) {
        const res = await fetch(`${API}/fonts?name=${encodeURIComponent(name)}`, {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: buffer});
        if (!res.ok) throw new Error(await failText(res));
        return (await res.json()).id;
      }
      const id = await hashId(buffer);
      await tx('readwrite', (s) => s.put({id, name, size: buffer.byteLength, buffer}));
      return id;
    },
    async remove(id) {
      if (API) {
        const res = await fetch(`${API}/fonts/${id}`, {method: 'DELETE'});
        if (!res.ok) throw new Error(await failText(res));
        return;
      }
      await tx('readwrite', (s) => s.delete(id));
    },
    async load(id) {
      if (API) {
        const res = await fetch(`${API}/fonts/${id}`);
        if (!res.ok) throw new Error(await failText(res));
        return res.arrayBuffer();
      }
      const row = await tx('readonly', (s) => s.get(id));
      if (!row) throw new Error('这个字体已经被删了');
      return row.buffer;
    },
  };
  root.DMFontLib = lib;
})(window);
