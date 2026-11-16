import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// 加载实际的动效注册、切换和数据校验。画布绘制由 tests/opus.mjs 覆盖。
const window = {
  DMMotionPrompt: {catalog: []},
  DM: {
    TEMPLATES: {},
    bezier: () => (x) => x,
    register(id, template) { this.TEMPLATES[id] = {...template, id}; },
    createScene(row) {
      if (row.template !== 'statement') window.DM.Opus.configOf(row);
      return {duration: 1, draw() {}};
    },
  },
};
const context = vm.createContext({
  window,
  CanvasRenderingContext2D: class {},
  document: {createElement: () => ({getContext() {}})},
});
for (const name of ['parser', 'library', 'opus_config', 'opus_templates', 'autoboard']) {
  const url = new URL(`../src/${name}.js`, import.meta.url);
  vm.runInContext(fs.readFileSync(url, 'utf8'), context, {filename: url.pathname});
}
const {DM: D, DMOpus: O} = window;
const template = 'comparison-dumbbell';
const line = '满意度从42升至58。';
const input = {data: {rows: [{label: '满意度', before: 42, after: 58}]}};
D.register('statement', {});

test('Opus 只对数据值及显示的样本量核对文稿出处', () => {
  const motion = O.fromAI(template, input);
  assert.equal(D.numberProblems({motion}, template, line).length, 0);
  motion.data.rows[0].after = 78;
  motion.metadata.sampleSize = 800;
  motion.metadata.showSampleSize = true;
  const issues = D.numberProblems({motion}, template, line).join(' ');
  assert.match(issues, /78/);
  assert.match(issues, /800/);
});

test('缺数据时维持样例标记，导入的演示分镜仍可直接导出', () => {
  const preview = D.adopt({tpl: 'statement', line}, template);
  assert.equal(preview.sampleData, true);
  assert.match(D.exportIssue(preview), /样例数据/);
  const verified = D.confirmMotionData({...preview, motion: {...preview.motion, data: input.data}}).row;
  assert.equal(verified.sampleData, undefined);
  assert.equal(verified.motion.demo, false);
  assert.equal(D.exportIssue(verified), '');
  const imported = D.adopt(O.row(O.defaults(template)), template);
  assert.equal(imported.sampleData, undefined);
  assert.equal(D.exportIssue(imported), '');
});

test('保留真实数据，切换到其他动效或从分镜重建 Opus 配置', () => {
  const row = {tpl: 'statement', line};
  const rebuilt = D.applyMotionData(row, template, {tpl: template, motionInput: input});
  assert.equal(rebuilt.error, undefined);
  assert.equal(rebuilt.row.motion.data.rows[0].before, 42);
  assert.equal(rebuilt.row.motion.demo, false);
  assert.equal(D.adopt(rebuilt.row, 'statement').motion, undefined);
  assert.match(D.applyMotionData(row, template, {tpl: template, motion: O.defaults(template)}).error, /演示数据/);
});

test('分镜审查给出 Opus 数据问题并保留其他分镜', () => {
  const rows = [{tpl: template, line, motionInput: {}}, {tpl: template, line, motionInput: input}];
  const board = window.DMBoard.reviewRows(rows, `${line}\n${line}`);
  assert.equal(board.flagged, 1);
  assert.match(board.issues[0].reasons.join(' '), /motionInput\.data/);
  assert.equal(board.rows[0].tpl, 'statement');
  assert.equal(board.rows[1].motion.data.rows[0].after, 58);
  assert.equal(board.rows[1].motionInput, undefined);
});

test('基于 Opus 的本机模板沿用原配置和组合预设', () => {
  for (const baseID of [template, Object.keys(O.PRESETS)[0]]) {
    const id = 'local.opus-clone';
    D.register(id, {...D.TEMPLATES[baseID], baseID});
    const sample = D.sampleOf(id);
    assert.equal(D.Opus.configOf({template: id, ...sample}).templateId, sample.motion.templateId);
  }
});

test('编辑 Opus 样式和播放位置后仍需确认规则版数据', () => {
  const title = {dataset: {motion: 'style.title'}, type: 'text', value: '新标题'};
  const controls = new Map(['motionError', 'motionCSVApply', 'motionCSVFile', 'motionJSONApply', 'motionRemember', 'motionJSONSave'].map(id => [id, {}]));
  const document = {
    getElementById: id => controls.get(id),
    querySelectorAll: selector => selector === '[data-motion]' ? [title] : [],
  };
  const url = new URL('../src/opus_editor.js', import.meta.url);
  vm.runInNewContext(fs.readFileSync(url, 'utf8'), {window, document}, {filename: url.pathname});
  const row = {...O.row(O.defaults(template)), pending: true, sampleData: true};
  D.Opus.bindEditor(row, () => {}, () => {}, () => 0.5);
  title.onchange();
  assert.equal(row.motion.style.title, '新标题');
  controls.get('motionRemember').onclick();
  assert.equal(row.motion.timeline.currentTime, 0.5);
  assert.equal(row.pending, true);
  assert.equal(row.sampleData, true);
  assert.equal(row.motion.demo, true);
});
