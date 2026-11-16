// 本机动效包。只解释声明式数据，所有绘制和导出仍走同一个引擎。
(function (root) {
  'use strict';
  const D = root.DM;
  const builtIn = new Map(Object.entries(D.TEMPLATES));
  let defaultsByID = new Map();
  let externalIDs = [];
  const color = /^#[0-9a-f]{6}$/i;
  const localID = /^local\.[a-z0-9][a-z0-9._-]{0,63}$/;
  const elementID = /^(?!(?:constructor|prototype)$)[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/;
  const localCategory = {id: 'local', name: '本机模板'};

  const check = (valid, path, why) => {
    if (!valid) throw new Error(`${path} ${why}`);
  };
  const object = (value, path, keys) => {
    check(value && typeof value === 'object' && !Array.isArray(value), path, '需要是对象');
    for (const k of Object.keys(value)) check(keys.includes(k), `${path}.${k}`, '不支持这个字段');
  };
  const range = (value, min, max, path) => check(Number.isFinite(value) && value >= min && value <= max, path, `需要是 ${min} 到 ${max} 的数字`);
  const string = (value, length, path) => check(typeof value === 'string' && value.trim() && value.length <= length, path, `需要是 1 到 ${length} 字的文本`);
  const hex = (value, path) => check(typeof value === 'string' && color.test(value), path, '需要是 #RRGGBB 颜色');

  const readDefaults = (entry, path) => {
    const config = entry.defaults ?? {};
    object(config, `${path}.defaults`, ['theme', 'colors', 'speed', 'hold']);
    if (config.theme !== undefined) check(['black', 'paper'].includes(config.theme), `${path}.defaults.theme`, '只支持 black 或 paper');
    if (config.speed !== undefined) range(config.speed, 0.05, 20, `${path}.defaults.speed`);
    if (config.hold !== undefined) range(config.hold, 0, 30, `${path}.defaults.hold`);
    const colors = config.colors ?? {};
    check(colors && typeof colors === 'object' && !Array.isArray(colors), `${path}.defaults.colors`, '需要是颜色对象');
    for (const [key, value] of Object.entries(colors)) {
      check(elementID.test(key), `${path}.defaults.colors`, '颜色键无效');
      hex(value, `${path}.defaults.colors.${key}`);
    }
    const layers = entry.layers ?? {};
    check(layers && typeof layers === 'object' && !Array.isArray(layers) && Object.keys(layers).length <= 128, `${path}.layers`, '最多可以配置 128 个元素');
    const engineLayers = {};
    for (const [id, layer] of Object.entries(layers)) {
      const at = `${path}.layers.${id}`;
      check(elementID.test(id), at, '元素 ID 无效');
      object(layer, at, ['m', 'alpha', 'hidden', 'color', 'speed', 'delay']);
      if (layer.m !== undefined) {
        const m = layer.m;
        check(Array.isArray(m) && m.length === 6, `${at}.m`, '需要 6 个矩阵值');
        m.forEach((v, i) => range(v, i < 4 ? -20 : -7680, i < 4 ? 20 : 7680, `${at}.m[${i}]`));
        check(Math.abs(m[0] * m[3] - m[1] * m[2]) >= 0.00001, `${at}.m`, '缩放矩阵需要可逆');
      }
      if (layer.alpha !== undefined) range(layer.alpha, 0, 1, `${at}.alpha`);
      if (layer.hidden !== undefined) check(typeof layer.hidden === 'boolean', `${at}.hidden`, '需要是布尔值');
      if (layer.color !== undefined) hex(layer.color, `${at}.color`);
      if (layer.speed !== undefined) range(layer.speed, 0.05, 20, `${at}.speed`);
      if (layer.delay !== undefined) range(layer.delay, 0, 30, `${at}.delay`);
      engineLayers[id] = layer.color
        ? {...layer, color: [1, 3, 5].map((index) => parseInt(layer.color.slice(index, index + 2), 16))}
        : layer;
    }
    return {config, layers: engineLayers};
  };

  const readElements = (elements, path, duration, textOnly = false) => {
    const minimum = textOnly ? 0 : 1;
    check(Array.isArray(elements) && elements.length >= minimum && elements.length <= 48, path, `需要 ${minimum} 到 48 个元素`);
    const ids = new Set();
    elements.forEach((e, i) => {
      const at = `${path}[${i}]`;
      object(e, at, ['id', 'type', 'x', 'y', 'width', 'height', 'size', 'color', 'text', 'bind', 'enter', 'start', 'seconds']);
      check(typeof e.id === 'string' && elementID.test(e.id) && !ids.has(e.id) && !['bg', 'main'].includes(e.id), `${at}.id`, '需要是唯一的元素 ID');
      if (textOnly) check(e.id.length <= 72, `${at}.id`, '叠加图层的 ID 最长 72 字符');
      ids.add(e.id);
      if (textOnly) check(e.type === 'text', `${at}.type`, '叠加图层只支持 text');
      else check(['rect', 'circle', 'text'].includes(e.type), `${at}.type`, '只支持 rect、circle 或 text');
      range(e.x, -1920, 3840, `${at}.x`);
      range(e.y, -1080, 2160, `${at}.y`);
      hex(e.color, `${at}.color`);
      range(e.start ?? 0, 0, duration, `${at}.start`);
      range(e.seconds ?? 0.6, 0.05, 30, `${at}.seconds`);
      check(['fade', 'slide', 'pop', 'none'].includes(e.enter ?? 'fade'), `${at}.enter`, '只支持 fade、slide、pop 或 none');
      if (e.type === 'text') {
        range(e.size ?? 72, 8, 240, `${at}.size`);
        if (e.bind !== undefined) check(['line', 'title', 'sampleSize'].includes(e.bind), `${at}.bind`, '只支持 line、title 或 sampleSize');
        if (e.text !== undefined || e.bind === undefined) string(e.text, 200, `${at}.text`);
        if (e.bind === 'sampleSize' && e.text !== undefined) {
          check(e.text.includes('{sampleSize}'), `${at}.text`, '绑定样本人数的文案需要包含 {sampleSize}');
        }
      } else {
        range(e.width, 1, 3840, `${at}.width`);
        range(e.height, 1, 2160, `${at}.height`);
      }
    });
  };

  const sampleSizeOf = (row) => Number.isSafeInteger(row.sampleSize) && row.sampleSize > 0
    ? row.sampleSize
    : root.DMParser.sampleSize(row.line);

  const textOf = (e, row) => {
    if (e.bind === 'sampleSize') {
      const size = sampleSizeOf(row);
      return size == null ? '' : (e.text ?? '总共{sampleSize}人').replaceAll('{sampleSize}', String(size));
    }
    const bound = e.bind === 'line' ? (Array.isArray(row.lines) && row.lines.join(' ')) || row.line : row.title;
    return e.bind ? bound || e.text || '' : e.text;
  };

  const drawElement = (c, e, speed, value, id = e.id) => {
    if (e.bind === 'sampleSize' && value === '') return;
    const isText = e.type === 'text';
    const local = c.el(id, isText ? value || e.id : e.id, isText ? D.TEXT : undefined);
    const elapsed = local * speed - (e.start ?? 0);
    if (elapsed < 0) return;
    const u = e.enter === 'none' ? 1 : D.outCubic(D.progress(elapsed, 0, e.seconds ?? 0.6));
    c.save();
    c.globalAlpha = u;
    c.fillStyle = e.color;
    const x = e.x + (e.enter === 'slide' ? 90 * (1 - u) : 0);
    const y = e.y;
    if (e.enter === 'pop') {
      c.translate(x, y);
      c.scale(0.8 + 0.2 * u, 0.8 + 0.2 * u);
      c.translate(-x, -y);
    }
    if (isText) {
      c.font = `${e.size ?? 72}px ${D.FONT_CN}`;
      c.textBaseline = 'middle';
      c.fillText(String(value).slice(0, 300), x, y);
    } else if (e.type === 'rect') {
      c.fillRect(x, y, e.width, e.height);
    } else {
      c.translate(x + e.width / 2, y + e.height / 2);
      c.scale(e.width / 2, e.height / 2);
      c.beginPath();
      c.arc(0, 0, 1, 0, 2 * Math.PI);
      c.fill();
    }
    c.restore();
  };

  const sceneTemplate = (entry, path) => {
    const {elements, duration = 4} = entry;
    range(duration, 0.5, 60, `${path}.duration`);
    readElements(elements, `${path}.elements`, duration);
    return {
      custom: true, takesText: true, accepts: () => true,
      sample: {lines: ['本机动效示例'], title: '动效标题'},
      create(row, S) {
        const speed = row.speed > 0 ? +row.speed : 1;
        const values = elements.map((e) => e.type === 'text' ? textOf(e, row) : undefined);
        return {
          duration: duration / speed + +(row.hold ?? 0),
          draw(c, time) {
            D.clearFrame(c, S, row.colors?.bg ?? '#101014');
            elements.forEach((e, i) => drawElement(c, e, speed, values[i]));
          },
        };
      },
    };
  };

  const readEntry = (entry, path) => {
    const result = readDefaults(entry, path);
    if (entry.overlays !== undefined) {
      readElements(entry.overlays, `${path}.overlays`, 60, true);
      // 和底图自己的元素分开，即使 ID 取了相同的名字也能独立调整。
      result.overlays = new Map(entry.overlays.map((e) => [`overlay:${e.id}`, {...e, enter: e.enter ?? 'none'}]));
    }
    const sampleSizeLayers = (entry.elements ?? entry.overlays ?? []).filter((e) => e.type === 'text' && e.bind === 'sampleSize');
    result.sampleSizeLayers = new Set(sampleSizeLayers.map((e) => entry.overlays ? `overlay:${e.id}` : e.id));
    return result;
  };

  D.installMotionPack = (pack) => {
    object(pack, '动效包', ['version', 'templates', 'overrides']);
    check(pack.version === 1, 'version', '只支持版本 1');
    const templates = pack.templates ?? [];
    const overrides = pack.overrides ?? [];
    check(Array.isArray(templates) && templates.length <= 40, 'templates', '最多 40 个模板');
    check(Array.isArray(overrides) && overrides.length <= 40, 'overrides', '最多 40 个覆盖');
    const nextTemplates = new Map();
    const nextDefaults = new Map();
    for (const [i, entry] of templates.entries()) {
      const path = `templates[${i}]`;
      object(entry, path, ['id', 'name', 'description', 'base', 'elements', 'duration', 'defaults', 'layers', 'overlays']);
      check(typeof entry.id === 'string' && localID.test(entry.id) && !nextTemplates.has(entry.id), `${path}.id`, '需要是唯一的 local. 开头的 ID');
      string(entry.name, 64, `${path}.name`);
      if (entry.description !== undefined) string(entry.description, 240, `${path}.description`);
      check((entry.base !== undefined) !== (entry.elements !== undefined), path, '需要指定 base 或 elements 其中之一');
      let definition;
      if (entry.base !== undefined) {
        const base = builtIn.get(entry.base);
        check(base && entry.duration === undefined, `${path}.base`, '需要是内置模板 ID，时长由原模板计算');
        definition = {...base, sourceCategory: base.cat, baseID: entry.base, sample: D.sampleOf(entry.base)};
      } else {
        check(entry.overlays === undefined, `${path}.overlays`, '自建画面请用 elements 添加文字');
        definition = sceneTemplate(entry, path);
      }
      nextTemplates.set(entry.id, {...definition, id: entry.id, name: entry.name, desc: entry.description || definition.desc || '本机动效包', cat: 'local', family: '本机模板', external: true, library: false});
      nextDefaults.set(entry.id, readEntry(entry, path));
    }
    for (const [i, entry] of overrides.entries()) {
      const path = `overrides[${i}]`;
      object(entry, path, ['target', 'defaults', 'layers', 'overlays']);
      check(builtIn.has(entry.target) && !nextDefaults.has(entry.target), `${path}.target`, '需要是唯一的内置模板 ID');
      nextDefaults.set(entry.target, readEntry(entry, path));
    }
    // 全部校验完再替换。任何一项错误都保留上一版。
    for (const id of externalIDs) delete D.TEMPLATES[id];
    for (const [id, def] of nextTemplates) D.register(id, def);
    externalIDs = [...nextTemplates.keys()];
    defaultsByID = nextDefaults;
    const category = D.CATEGORIES.indexOf(localCategory);
    if (externalIDs.length && category < 0) D.CATEGORIES.push(localCategory);
    if (!externalIDs.length && category >= 0) D.CATEGORIES.splice(category, 1);
    return {templates: templates.length, overrides: overrides.length};
  };

  D.motionDefaults = (row, id) => {
    const config = defaultsByID.get(id)?.config;
    return config ? {...config, ...row, colors: {...config.colors, ...row.colors}} : row;
  };

  D.motionLayerDefaults = (id) => defaultsByID.get(id)?.layers;
  D.motionUsesSampleSize = (id) => !!defaultsByID.get(id)?.sampleSizeLayers.size;
  D.motionIsSampleSizeLayer = (template, id) => defaultsByID.get(template)?.sampleSizeLayers.has(id) ?? false;
  const overlayText = (row, id, element) => {
    if (element.bind === 'sampleSize') return textOf(element, row);
    const own = row.overlayText?.[row.template]?.[id];
    return typeof own === 'string' ? own : textOf(element, row);
  };

  D.motionOverlayText = (row, id) => {
    const element = defaultsByID.get(row.template)?.overlays?.get(id);
    return element && overlayText(row, id, element);
  };

  D.motionOverlay = (row, template) => {
    const overlays = defaultsByID.get(template)?.overlays;
    if (!overlays?.size) return null;
    const resolved = [...overlays].map(([id, element]) => ({id, element, value: overlayText(row, id, element)}));
    return (stage) => {
      stage.save();
      stage.textAlign = 'left';
      resolved.forEach(({id, element, value}) => drawElement(stage, element, 1, value, id));
      stage.restore();
    };
  };

  D.mergeMotionLayers = (defaults, layers) => {
    if (!defaults || !Object.keys(defaults).length) return layers;
    const combined = {...defaults};
    for (const [id, patch] of Object.entries(layers || {})) {
      const base = Object.hasOwn(defaults, id) ? defaults[id] : null;
      const merged = {...base, ...patch};
      if (base?.m && patch.m) merged.m = root.DMStage.mul(patch.m, base.m);
      Object.defineProperty(combined, id, {value: merged, enumerable: true, configurable: true, writable: true});
    }
    return combined;
  };
})(window);
