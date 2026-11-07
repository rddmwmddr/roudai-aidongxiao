// 匹配：一镜的数据 + 文案 → 合适的模板排序，并说出为什么。导出 MP4 与核对也在这里。
(function (root) {
  'use strict';
  const D = root.DM;

  const textOnly = (min = 1) => (r) => r.lines && r.lines.length >= min;
  Object.assign(D.TEMPLATES.titleV, {accepts: textOnly(1)});
  Object.assign(D.TEMPLATES.titleH, {accepts: textOnly(1)});
  Object.assign(D.TEMPLATES.question, {accepts: (r) => !!(r.line || (r.lines && r.lines.length))});
  Object.assign(D.TEMPLATES.statement, {accepts: (r) => !!(r.line || (r.lines && r.lines.length))});
  Object.assign(D.TEMPLATES.relay, {accepts: textOnly(2)});
  Object.assign(D.TEMPLATES.rapid, {accepts: textOnly(4)});
  Object.assign(D.TEMPLATES.swap, {accepts: (r) => r.words && r.words.length > 1});

  const compatible = (row) =>
    Object.values(D.TEMPLATES).filter((t) => {
      if (t.custom) return t.accepts ? t.accepts(row) : true;
      if (!(row.groups && row.groups.length && row.groups.some((g) => g.metrics && g.metrics.length))) return false;
      // 数量超出这个模板的上限就不列出来；缺数（XX%）的镜头不算不合适
      return D.validate(Object.assign({}, row, {template: t.id})).errors.every((e) => /大于 0/.test(e));
    });

  const featuresOf = (row) => {
    const groups = row.groups || [];
    const metrics = groups.flatMap((g) => g.metrics || []);
    const text = row.line || '';
    return {
      n: metrics.length,
      groups: groups.length,
      nested: groups.some((g) => g.relation === 'nested'),
      opposing: groups.some((g) => g.relation === 'opposing'),
      chain: groups.some((g) => g.relation === 'chain') || /这其中|在他们之中/.test(text),
      note: metrics.some((m) => m.note),
      emphasis: metrics.some((m) => m.emphasis),
      qa: metrics.some((m) => m.answer),
      people: /用户|人|青少年|儿童|孩子|老人|朋友/.test(text),
      question: /[？?]/.test(text),
    };
  };

  // 打分：分高的排前面；上一镜刚用过同一个模板时减分，避免连着重复
  const fitOf = (tplId, row, last) => {
    const def = D.TEMPLATES[tplId];
    if (def.library) return D.fitLibrary(def, row);
    if (def.chart) return D.fitChart(def, row);
    const f = featuresOf(row);
    let score = 50;
    let why = '';
    const add = (s, w) => {
      score += s;
      if (w && !why) why = w;
    };
    switch (tplId) {
      case 'comb':
        if (f.nested) add(26, '有包含关系：同一批竖条再烧白');
        if (f.opposing) add(30, '两拨相反的人：前沿从两头往中间走');
        if (f.groups >= 2) add(10, '几组上下对齐，同一把尺子比较');
        if (f.chain) add(-25, '「这其中」的数基数变了，不能放同一把尺子');
        if (f.n === 1) add(0, '单个比例：一根根亮到真值');
        if (f.n > 4) add(-40);
        break;
      case 'dots':
        if (f.people) add(8, '说的是人：一个点就是 1% 的人');
        if (f.nested) add(22, '有包含关系：涂黑的点里再涂红');
        if (f.opposing) add(28, '同一批人分成两拨，从人群里走出来');
        if (f.chain) add(-25);
        if (f.groups > 3 || f.n > 6) add(-40);
        break;
      case 'zoom':
        if (f.chain) add(45, '「这其中」：亮的部分放大成新的 100%');
        else add(-22);
        break;
      case 'survey':
        if (f.qa) add(45, '连问连答：累积成一张答卷');
        else if (f.n >= 2) add(-10);
        else add(-30);
        break;
      case 'rank':
        if (f.n >= 3 && !f.nested && !f.opposing) add(30, '三个以上并列：依次长出来，方便比较');
        if (f.n === 2) add(5, '两个并列的数放在一起比');
        if (f.note) add(-25);
        if (f.n === 1) add(-30);
        break;
      case 'gauge':
        if (f.note) add(22, '基数不同：一个表一个量程，不会被读成同一个 100%');
        if (f.n <= 3 && f.n >= 1) add(0, '指针先甩满再回落，适合单独报数');
        if (f.nested || f.opposing) add(-15);
        break;
      case 'tape':
        if (f.n >= 2 && !f.nested && !f.chain) add(4, '几个数连着说：一把尺子走到底');
        if (f.n === 1) add(-14);
        break;
      case 'fill':
        if (f.n === 1) add(20, '只有一个要记住的数：数字本身就是图表');
        if (f.n >= 3) add(-20);
        break;
      case 'lucy':
        if (f.n === 1 && !row.groups[0].metrics[0].caption) add(60, '只报一个百分比：整屏黑卡');
        else add(-20);
        break;
      case 'tubes':
        add(-6, '材质感强，适合并列的几个数');
        break;
      case 'hex':
        add(-8, '蜂窝材质，适合并列的几个数');
        break;
      default:
        break;
    }
    if (tplId === row.tpl) score += 12;
    if (last && last === tplId) {
      score -= 12;
      why = why ? `${why}（上一个数据镜刚用过）` : '上一个数据镜刚用过';
    }
    return {score, why: why || D.TEMPLATES[tplId].desc};
  };

  const rank = (row, last) =>
    compatible(row)
      .map((t) => Object.assign({id: t.id, name: t.name, family: t.family}, fitOf(t.id, row, last)))
      .sort((a, b) => b.score - a.score);

  // ---------- 导出 ----------
  const SIZES = {
    '4k': {w: 3840, h: 2160, codec: {60: 'avc1.640034', 30: 'avc1.640033'}, bitrate: {60: 60e6, 30: 40e6}},
    '1080p': {w: 1920, h: 1080, codec: {60: 'avc1.64002A', 30: 'avc1.640028'}, bitrate: {60: 24e6, 30: 16e6}},
  };
  // 批量输出时标签页常在后台，setTimeout 会被限到每秒一次，这里用 MessageChannel 让出主线程
  const yieldNow = () => new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => r();
    ch.port2.postMessage(0);
  });
  // sink(data, position)：边编码边交出去，4K 长镜头不占内存（macOS App 直接写文件）
  const exportMP4 = async (raw, {size = '4k', fps = 60, onProgress, signal, sink} = {}) => {
    if (typeof VideoEncoder === 'undefined') throw new Error('这个浏览器不能导出视频，请用 Chrome 打开');
    await D.ensureGlyphs(JSON.stringify(raw));
    const cfg = SIZES[size];
    const canvas = document.createElement('canvas');
    canvas.width = cfg.w;
    canvas.height = cfg.h;
    const ctx = canvas.getContext('2d', {alpha: false});
    const scene = D.createScene(raw, cfg.w);
    const encoderConfig = {codec: cfg.codec[fps], width: cfg.w, height: cfg.h, bitrate: cfg.bitrate[fps], framerate: fps, latencyMode: 'quality', avc: {format: 'avc'}};
    const support = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) throw new Error(`这台电脑不支持 ${size} ${fps} 帧编码，请改用 1080p`);
    const pending = [];
    const target = sink ? new root.Mp4Muxer.StreamTarget({onData: (data, position) => pending.push([data.slice(), position]), chunked: true, chunkSize: 4 * 1024 * 1024}) : new root.Mp4Muxer.ArrayBufferTarget();
    const muxer = new root.Mp4Muxer.Muxer({target, video: {codec: 'avc', width: cfg.w, height: cfg.h, frameRate: fps}, fastStart: sink ? false : 'in-memory'});
    const drain = async () => {
      while (pending.length) {
        const [data, position] = pending.shift();
        await sink(data, position);
      }
    };
    let failure = null;
    const encoder = new VideoEncoder({output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e)});
    encoder.configure(encoderConfig);
    const frames = Math.round(scene.duration * fps);
    const started = performance.now();
    for (let f = 0; f < frames; f++) {
      if (signal && signal.aborted) {
        encoder.close();
        throw new DOMException('已取消', 'AbortError');
      }
      if (failure) throw failure;
      scene.draw(ctx, f / fps);
      const vf = new VideoFrame(canvas, {timestamp: Math.round((f * 1e6) / fps), duration: Math.round(1e6 / fps)});
      encoder.encode(vf, {keyFrame: f % (fps * 2) === 0});
      vf.close();
      while (encoder.encodeQueueSize > 6) {
        await Promise.race([new Promise((r) => encoder.addEventListener('dequeue', r, {once: true})), new Promise((r) => setTimeout(r, 250))]);
      }
      if (f % 15 === 0) {
        if (onProgress) onProgress((f + 1) / frames, (performance.now() - started) / 1000);
        await drain();
        await yieldNow();
      }
    }
    await encoder.flush();
    encoder.close();
    if (failure) throw failure;
    muxer.finalize();
    await drain();
    if (onProgress) onProgress(1, (performance.now() - started) / 1000);
    return {blob: sink ? null : new Blob([muxer.target.buffer], {type: 'video/mp4'}), frames, duration: scene.duration, width: cfg.w, height: cfg.h, fps};
  };

  // 读回导出视频的末帧，逐根/逐点数颜色
  const verifyMP4 = async (blob, raw) => {
    const scene = D.createScene(raw, 1920);
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.src = url;
    const limit = (p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('读回视频超时')), 20000))]);
    await limit(new Promise((ok, no) => {
      video.onloadedmetadata = ok;
      video.onerror = () => no(new Error('读不了导出的视频'));
    }));
    await limit(new Promise((ok) => {
      video.onseeked = ok;
      video.currentTime = Math.max(0, video.duration - 0.2);
    }));
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const g = c.getContext('2d', {willReadFrequently: true});
    g.drawImage(video, 0, 0);
    URL.revokeObjectURL(url);
    const k = c.width / 1920;
    const durationOK = Math.abs(video.duration - scene.duration) < 0.15;
    const out = {ok: durationOK, duration: video.duration, expectedDuration: scene.duration, width: c.width, height: c.height, rows: []};
    const pal = scene.palette;
    out.edited = !!scene.edited;
    // 手动调整过的镜头，竖条和圆点不在原位，只核时长
    if (pal && scene.probes && !scene.edited) {
      // 「只有 37%」时其余元素会退后变暗，所以每个颜色连同它的变暗版一起比
      const shades = Object.entries(pal).filter(([n]) => n !== 'bg').flatMap(([name, col]) => [0, 0.5, 0.55].map((f) => [name, D.mix(col, pal.bg, f)]));
      const classify = (x, y) => {
        const d = g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
        let best = null;
        let bestD = 1e9;
        for (const [name, col] of shades) {
          const dist = (d[0] - col[0]) ** 2 + (d[1] - col[1]) ** 2 + (d[2] - col[2]) ** 2;
          if (dist < bestD) {
            bestD = dist;
            best = name;
          }
        }
        return best;
      };
      out.rows = scene.probes().map((row) => {
        const got = row.points.map(([x, y]) => classify(x, y));
        const miss = got.filter((v, i) => row.expect[i] !== null && v !== row.expect[i]).length;
        const count = (arr, name) => arr.filter((v) => v === name).length;
        return {title: row.title, ok: miss === 0, mismatched: miss, got: {secondary: count(got, 'secondary'), primary: count(got, 'primary'), dim: count(got, 'dim')}, expect: {secondary: count(row.expect, 'secondary'), primary: count(row.expect, 'primary'), dim: count(row.expect, 'dim')}};
      });
      out.ok = durationOK && out.rows.every((r) => r.ok);
    }
    return out;
  };

  Object.assign(D, {compatible, featuresOf, fitOf, rankTemplates: rank, exportMP4, verifyMP4, SIZES});
})(window);
