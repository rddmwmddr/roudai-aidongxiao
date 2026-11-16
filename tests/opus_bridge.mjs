import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const O = createRequire(import.meta.url)('../src/opus_config.js');
const source = fs.readFileSync(new URL('../src/app_bridge.js', import.meta.url), 'utf8');

// Run the App's actual bridge and configuration validator without a WebKit window.
const stage = (prepareFrame = async () => {}) => {
  const messages = [];
  let select;
  const canvas = {getContext: () => ({})};
  const host = {clientWidth: 960, style: {}};
  const window = {
    webkit: {messageHandlers: {dm: {postMessage: (message) => messages.push(message)}}},
    DMOpus: O,
    DM: {
      ensureGlyphs: async () => false,
      loadFonts: async () => {},
      createScene: (row) => ({duration: row.motion.timeline.duration}),
      Opus: {prepareAssets: async () => {}, prepareFrame},
    },
    DMEditor: class {
      constructor(options) { select = options.onSelect; }
      bind() {}
    },
  };
  vm.runInNewContext(source, {
    window,
    document: {
      getElementById: (id) => id === 'cv' ? canvas : host,
      documentElement: {style: {setProperty() {}}},
    },
    performance,
    ResizeObserver: class { observe() {} },
    requestAnimationFrame() {},
    addEventListener() {},
  });
  return {
    select,
    messages,
    load: (row) => window.DMBridge.load(JSON.stringify(row), false),
  };
};

const cohort = (id) => O.row(O.defaults('cohort-regroup'), id);
const firstUser = (row) => row.motion.data.users[0][row.motion.fieldMappings.id];

test('selecting a participant posts the original shot ID with the edited config', async () => {
  const view = stage();
  const shot = cohort(17);
  const selectedId = firstUser(shot);
  await view.load(shot);
  view.select([`user:${selectedId}`]);
  await view.load(cohort(29));
  const edit = view.messages.find((event) => event.type === 'editRow');
  assert.ok(edit, 'cohort selection must use the shot edit bridge');
  assert.equal(edit.id, 17);
  assert.equal(edit.label, '选择受访者');
  assert.equal(JSON.parse(edit.fields).motion.options.selectedId, selectedId);
});

test('an old participant selection cannot edit the next shot while its frame is loading', async () => {
  let loading, resume;
  const entered = new Promise((resolve) => { loading = resolve; });
  const pending = new Promise((resolve) => { resume = resolve; });
  const view = stage(async (row) => {
    if (row.id === 29) {
      loading();
      await pending;
    }
  });
  const shot = cohort(17);
  await view.load(shot);
  const next = view.load(cohort(29));
  await entered;
  view.select([`user:${firstUser(shot)}`]);
  resume();
  await next;
  assert.equal(view.messages.some((event) => ['editRow', 'motionObject'].includes(event.type)), false);
});
