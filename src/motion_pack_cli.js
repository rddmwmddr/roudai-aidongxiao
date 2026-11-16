// 给随 App 安装的 dm-motion 用。文件操作由 Swift 负责，校验和渲染复用 App 引擎。
(function (root) {
  'use strict';
  const D = root.DM;
  const parse = (json, label) => {
    try {
      return JSON.parse(json);
    } catch (e) {
      throw new Error(label + '不是有效的 JSON。' + e.message);
    }
  };
  const object = (json, label) => {
    const value = parse(json, label);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + '需要是 JSON 对象');
    return value;
  };
  const replace = (items, key, entry) => {
    const index = items.findIndex((item) => item[key] === entry[key]);
    if (index < 0) items.push(entry);
    else items[index] = entry;
  };

  root.dmMotionCommand = async (command, id, packJSON, inputJSON) => {
    try {
      const pack = parse(packJSON, '动效包');
      const counts = D.installMotionPack(pack);
      const templates = pack.templates ?? [];
      const overrides = pack.overrides ?? [];
      const overridden = new Set(overrides.map((entry) => entry.target));
      const list = () => D.catalog().map((item) => ({
        ...item, source: D.TEMPLATES[item.id].external ? 'local' : 'built-in', overridden: overridden.has(item.id),
      }));
      const requireMotion = () => {
        if (!Object.hasOwn(D.TEMPLATES, id)) throw new Error('找不到动效 ' + id + '。先用 list 查询 ID');
      };
      if (command === 'validate') return {counts};
      if (command === 'list') return {items: list()};

      if (command === 'get' || command === 'preview') {
        requireMotion();
        const sample = {line: '', ...D.sampleOf(id), tpl: id};
        if (D.motionUsesSampleSize(id) && sample.sampleSize == null && root.DMParser.sampleSize(sample.line) == null) {
          sample.sampleSize = 1000;
        }
        if (command === 'get') {
          const {fields, minimum} = JSON.parse(root.DMBridge.motionInput('{}', id));
          const entry = (D.TEMPLATES[id].external ? templates.find((t) => t.id === id) : overrides.find((t) => t.target === id)) ?? null;
          // 某些内置动效没有可绘制的样例，仍返回模板信息和数据结构。
          let survey;
          try {
            survey = await D.surveyElements({...sample, template: id});
          } catch (e) {
            survey = {elements: [], error: e.message};
          }
          return {motion: list().find((item) => item.id === id), entry, sample, fields, minimum, survey};
        }
        const row = inputJSON === null ? {...sample, sampleData: true} : {...object(inputJSON, '分镜数据'), tpl: id};
        const issue = inputJSON === null ? '' : D.motionError(row, true);
        if (issue) throw new Error(issue);
        return JSON.parse(await root.DMBridge.preview(JSON.stringify(row), id, true));
      }

      let next;
      switch (command) {
        case 'upsert': {
          const entry = object(inputJSON, '模板');
          replace(templates, 'id', entry);
          next = {...pack, templates};
          id = entry.id;
          break;
        }
        case 'remove':
          if (!id.startsWith('local.')) throw new Error('remove 只删除本机模板。恢复内置动效用 reset');
          if (!templates.some((t) => t.id === id)) return {id, changed: false, counts};
          next = {...pack, templates: templates.filter((t) => t.id !== id)};
          break;
        case 'override':
          replace(overrides, 'target', {...object(inputJSON, '覆盖配置'), target: id});
          next = {...pack, overrides};
          break;
        case 'reset':
          requireMotion();
          if (D.TEMPLATES[id].external) throw new Error('reset 只恢复内置动效。移除本机模板用 remove');
          if (!overridden.has(id)) return {id, changed: false, counts};
          next = {...pack, overrides: overrides.filter((t) => t.target !== id)};
          break;
        default:
          throw new Error('未知命令 ' + command);
      }
      return {id, counts: D.installMotionPack(next), updatedPack: JSON.stringify(next, null, 2) + '\n'};
    } catch (e) {
      return {error: e.message};
    }
  };
})(window);
