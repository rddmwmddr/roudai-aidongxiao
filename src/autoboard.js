// 一键分镜（离线规则版）：整篇文稿 → 分镜表。不联网，不编内容，口播原文一个字不改。
// 规则只能给出初稿：带数字的句子做数据动效，问题做问题卡，一串词做接力，长段叙述做重音字幕。
(function (root) {
  'use strict';
  const D = root.DM;
  const P = root.DMParser;

  const HEAD = /^(第[一二三四五六七八九十百\d]+[章节部分幕回集]|开场|序章|序言|序|引子|前言|结尾|尾声|片尾|结语)(?:[\s：:、.．—-]+(.*))?$/;
  const PCT = /(\d+(?:\.\d+)?\s*[%％])|(百分之[零一二两三四五六七八九十百点\d]+)/;
  const SENT = /[^。！？!?；;\n]+[。！？!?；;]*["”’」』）)]*/g;

  const sentencesOf = (para) => (para.match(SENT) || []).map((s) => s.trim()).filter(Boolean);
  const isQuestion = (s) => /[？?]["”’」』）)]*$/.test(s);
  const hasPct = (s) => PCT.test(s);
  const stripEnd = (s) => s.replace(/[，。！？!?；;、,.\s"”’」』）)]+$/, '');
  const lenOf = (s) => Array.from(s).length;

  const listOf = (s) => {
    // 「选拿铁、美式、手冲、冷萃」：四个以上的短词才算一串
    const body = stripEnd(s);
    const parts = body.split(/[、]/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 4) return null;
    const middle = parts.slice(1, -1);
    if (!middle.every((x) => lenOf(x) <= 8)) return null;
    const first = parts[0];
    const cut = first.search(/[，,：:]/);
    const head = cut >= 0 ? first.slice(cut + 1).trim() : first;
    const words = [head.length > 8 ? head.slice(-4) : head, ...middle, parts[parts.length - 1].length > 8 ? parts[parts.length - 1].slice(0, 4) : parts[parts.length - 1]];
    return words.filter(Boolean);
  };

  // 一段连续文字 → 一组镜头的草稿
  const planParagraph = (para, out, opts = {}) => {
    const sents = sentencesOf(para);
    let i = 0;
    let narrative = [];
    const flush = () => {
      if (!narrative.length) return;
      out.push({type: 'narrative', text: narrative.join('')});
      narrative = [];
    };
    while (i < sents.length) {
      const s = sents[i];
      if (hasPct(s)) {
        flush();
        // 铺垫太长时单独成一镜，动效从念到内容时才开始
        const group = [s];
        let j = i + 1;
        while (j < sents.length) {
          const next = sents[j];
          const attached = /^(这其中|其中|在他们之中|而|只有|仅有|这还|会|另外|同时)/.test(next);
          const total = lenOf(group.join('')) + lenOf(next);
          if ((hasPct(next) && total <= 150) || (attached && total <= 170)) {
            group.push(next);
            j++;
          } else break;
        }
        out.push({type: 'data', text: group.join('')});
        i = j;
        continue;
      }
      if (isQuestion(s) && lenOf(s) <= 48) {
        flush();
        const qs = [s];
        let j = i + 1;
        while (j < sents.length && isQuestion(sents[j]) && lenOf(sents[j]) <= 48 && qs.length < 4 && !hasPct(sents[j])) {
          qs.push(sents[j]);
          j++;
        }
        out.push({type: 'question', lines: qs, text: qs.join('')});
        i = j;
        continue;
      }
      const words = listOf(s);
      if (words) {
        flush();
        out.push({type: 'relay', lines: words, text: s});
        i++;
        continue;
      }
      // A-roll 是念出来的，一句一镜，每句都去配动效
      if (opts.sentences) {
        flush();
        out.push({type: 'statement', text: s});
        i++;
        continue;
      }
      if (lenOf(s) <= 26 && narrative.length === 0 && (i === sents.length - 1 || /[：:]$/.test(s) === false && sents.length === 1)) {
        out.push({type: 'statement', text: s});
        i++;
        continue;
      }
      narrative.push(s);
      if (lenOf(narrative.join('')) >= 90 || narrative.length >= 3) flush();
      i++;
    }
    flush();
  };

  const generate = (text, opts = {}) => {
    const clean = String(text || '').replace(/\r\n?/g, '\n').replace(/　/g, ' ');
    const lines = clean.split('\n').map((l) => l.trim());
    let chapter = opts.chapter || '正片';
    let title = '';
    const plan = [];
    let verse = [];
    const flushVerse = () => {
      if (!verse.length) return;
      if (verse.length >= 2) plan.push({type: 'verse', lines: verse.slice(), text: verse.join('，'), ch: chapter});
      else planParagraph(verse[0], plan.push ? plan : plan);
      verse = [];
    };
    let afterHead = false;
    // 拆分、组合之后重新匹配：这段话就是一镜，不再往下拆
    if (opts.whole) {
      const all = clean.replace(/\n+/g, '').trim();
      if (all) {
        const sents = sentencesOf(all);
        const words = listOf(all);
        if (hasPct(all)) plan.push({type: 'data', text: all, ch: chapter});
        else if (sents.length && sents.every(isQuestion) && sents.length <= 4) plan.push({type: 'question', lines: sents, text: all, ch: chapter});
        else if (words) plan.push({type: 'relay', lines: words, text: all, ch: chapter});
        else plan.push({type: 'statement', text: all, ch: chapter});
      }
    }
    (opts.whole ? [] : lines).forEach((raw) => {
      if (!raw) {
        flushVerse();
        return;
      }
      const md = raw.match(/^#{1,6}\s*(.+)$/);
      const line = md ? md[1].trim() : raw;
      const h = line.match(HEAD);
      if (md || (h && lenOf(line) <= 36)) {
        flushVerse();
        if (md && !title && !h) title = line;
        else chapter = h ? h[1] : line;
        if (md && title !== line) chapter = h ? h[1] : line;
        afterHead = true;
        return;
      }
      // 章节标题后面紧跟的几行没有标点的短句，当诗句
      if (afterHead && lenOf(line) <= 16 && !/[。！？!?；;，,]/.test(line) && !hasPct(line)) {
        verse.push(line);
        return;
      }
      flushVerse();
      afterHead = false;
      const before = plan.length;
      planParagraph(line, plan, opts);
      for (let k = before; k < plan.length; k++) plan[k].ch = chapter;
    });
    flushVerse();
    plan.forEach((p) => {
      if (!p.ch) p.ch = chapter;
    });

    let last = null;
    const used = {};
    // 这句话说到了某个动效，就用它；同一个动效全片最多两次
    const matched = (row, text) => {
      const m = D.matchMotion ? D.matchMotion(text, used) : null;
      if (!m) return null;
      used[m.id] = (used[m.id] || 0) + 1;
      return Object.assign(row, {tpl: m.id, lines: [stripEnd(text)], visual: `说到「${m.hit}」：${m.name}`});
    };
    const rows = plan.map((p, idx) => {
      const row = {id: idx + 1, no: String(idx + 1).padStart(3, '0'), ch: p.ch, line: p.text, kind: 'B', cat: '文字动效', visual: ''};
      if (p.type === 'verse') {
        return Object.assign(row, {tpl: 'titleH', head: p.ch, lines: p.lines, visual: '诗句卡'});
      }
      if (p.type === 'question') {
        return Object.assign(row, {tpl: 'question', lines: p.lines.map(stripEnd).map((l, i) => `${l}${/[?]$/.test(p.lines[i]) ? '?' : '？'}`), visual: '问题打出来'});
      }
      if (p.type === 'relay') {
        return Object.assign(row, {tpl: 'relay', lines: p.lines, visual: '一串词接力，最后排成一行'});
      }
      if (p.type === 'statement') {
        const hit = matched(row, p.text);
        if (hit) return hit;
        return Object.assign(row, {tpl: 'statement', lines: [stripEnd(p.text)], visual: '念到哪字出到哪'});
      }
      if (p.type === 'data') {
        const parsed = P.parseCopy(p.text);
        if (parsed.count > 0) {
          const candidate = Object.assign({}, row, {groups: parsed.groups, cat: '数据动效'});
          const ranked = D.rankTemplates(candidate, last);
          const top = ranked[0];
          if (top) {
            last = top.id;
            return Object.assign(candidate, {tpl: top.id, visual: parsed.explain || top.why});
          }
        }
        // 不是百分比的一串数（3 亿、12 亿）：做成图表
        const series = D.parseSeries ? D.parseSeries(p.text) : null;
        if (series) {
          const candidate = Object.assign({}, row, series, {cat: '数据动效'});
          const top = D.rankTemplates(candidate, last).filter((t) => D.TEMPLATES[t.id].chart)[0];
          if (top) {
            last = top.id;
            return Object.assign(candidate, {tpl: top.id, visual: top.why});
          }
        }
        return Object.assign(row, {tpl: 'statement', lines: [stripEnd(p.text)], visual: '念到哪字出到哪', note: '这句里有数字，但规则拆不出来，请手动填数据'});
      }
      return Object.assign(row, {tpl: 'statement', lines: [stripEnd(p.text)], visual: '念到哪字出到哪'});
    });
    const first = lines.find(Boolean) || '';
    return {title: title || opts.title || (lenOf(first) <= 30 && !HEAD.test(first) ? stripEnd(first) : '新分镜表'), rows, stats: {motion: rows.length}};
  };

  // 校验 AI 给的分镜：模板要存在，数据要画得出来，所有数字必须出自文稿
  const numbersIn = (o, bag = []) => {
    if (o == null) return bag;
    if (Array.isArray(o)) o.forEach((v) => numbersIn(v, bag));
    else if (typeof o === 'object') {
      Object.entries(o).forEach(([k, v]) => {
        if (k === 'value' || k === 'v') {
          if (Number.isFinite(+v)) bag.push(+v);
        } else if (k === 'n' || k === 'out' || k === 'total') {
          if (Number.isFinite(+v)) bag.push(+v);
        } else if (k !== 'land' && k !== 'sheets' && k !== 'size' && k !== 'ceil' && k !== 'hold' && k !== 'speed' && k !== 'id' && k !== 'g' && k !== 'tier' && k !== 'no') numbersIn(v, bag);
      });
    }
    return bag;
  };
  const checkRow = (row, source) => {
    const problems = [];
    const tpl = D.TEMPLATES[row.tpl];
    if (!tpl) problems.push(`没有「${row.tpl}」这个模板`);
    const srcN = P.normalizeText(source || '');
    const lineN = P.normalizeText(row.line || '');
    if (!row.line) problems.push('缺口播原文');
    else if (srcN && !srcN.includes(lineN)) problems.push('口播和文稿原文不一致');
    if (tpl) {
      try {
        const raw = Object.assign({}, row, {template: row.tpl});
        const scene = D.createScene(raw, 320);
        const cv = document.createElement('canvas');
        cv.width = 320;
        cv.height = 180;
        scene.draw(cv.getContext('2d', {alpha: false}), scene.duration * 0.6);
      } catch (e) {
        problems.push(e.message);
      }
    }
    const bad = numbersIn(row.groups).concat(numbersIn(row.points), numbersIn(row.ref), numbersIn(row.sets), numbersIn(row.steps), numbersIn(row.highlight), numbersIn(row.events), row.value != null ? [+row.value] : []).filter((v) => {
      const s = String(v);
      return !lineN.includes(s) && !srcN.includes(s);
    });
    if (bad.length) problems.push(`数字 ${[...new Set(bad)].join('、')} 在文稿里找不到`);
    return problems;
  };
  const reviewRows = (rows, source) => {
    let last = null;
    const out = rows.map((row, i) => {
      const r = Object.assign({}, row, {id: i + 1, no: String(i + 1).padStart(3, '0')});
      r.kind = 'B';
      r.ch = r.ch || '正片';
      r.visual = r.visual || '';
      r.cat = r.cat || '文字动效';
      const problems = checkRow(r, source);
      if (problems.length) {
        // 用规则版兜底，文字不丢，并标出来让人看
        const fb = generate(r.line || '').rows[0];
        const note = `AI 的结果用不了：${problems.join('；')}。已换成规则版，请确认`;
        if (fb) return Object.assign(fb, {id: r.id, no: r.no, ch: r.ch, line: r.line || fb.line, note});
        return Object.assign(r, {tpl: 'statement', lines: r.line ? [stripEnd(r.line)] : r.lines, kind: 'B', cat: '文字动效', note});
      }
      if (r.groups) last = r.tpl;
      return r;
    });
    void last;
    // 覆盖率：文稿里有多少文字进了分镜，防止 AI 悄悄漏掉段落
    // 章节标题不上屏，不算漏掉的文字
    const body = String(source || '').split(/\r?\n/).filter((l) => {
      const t = l.trim().replace(/^#{1,6}\s*/, '');
      return !(HEAD.test(t) && lenOf(t) <= 36);
    }).join('\n');
    const srcN = P.normalizeText(body).replace(/[\s，。！？!?；;、,.：:"“”‘’（）()《》]/g, '');
    let covered = 0;
    let cursor = 0;
    out.forEach((r) => {
      const l = P.normalizeText(r.line || '').replace(/[\s，。！？!?；;、,.：:"“”‘’（）()《》]/g, '');
      if (!l) return;
      const at = srcN.indexOf(l, cursor);
      if (at >= 0) {
        covered += l.length;
        cursor = at + l.length;
      } else {
        const any = srcN.indexOf(l);
        if (any >= 0) covered += l.length;
      }
    });
    return {rows: out, coverage: srcN.length ? Math.min(1, covered / srcN.length) : 1, flagged: out.filter((r) => /^AI 的结果用不了/.test(r.note || '')).length};
  };

  root.DMBoard = {generate, checkRow, reviewRows};
})(window);
