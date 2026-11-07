// 文案解析：一段口播文案 → 分组、数值、关系、念到每个数的时刻。纯规则，不联网。
// 拆错了可以在界面上改，这里只负责给出一个靠谱的初稿。
(function (root) {
  'use strict';

  const RATE = 5.2; // 口播语速：音节/秒
  const PAD = 0.25;
  const CN = {零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9};

  const cnToNumber = (s) => {
    if (s.includes('点')) {
      const [a, b] = s.split('点');
      const dec = Array.from(b).map((c) => CN[c]).join('');
      return `${cnToNumber(a)}.${dec}`;
    }
    if (s === '一百') return 100;
    if (s.includes('十')) {
      const [a, b] = s.split('十');
      return (a ? CN[a] : 1) * 10 + (b ? CN[b] : 0);
    }
    return CN[s];
  };

  const normalizeText = (input) =>
    String(input)
      .replace(/[％]/g, '%')
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/．/g, '.')
      .replace(/百分之([零一二两三四五六七八九十百点]+)/g, (_, n) => `${cnToNumber(n)}%`)
      .replace(/\s+/g, '');

  // 念出来有多少个音节，用来估时间
  const numberSyllables = (n) => {
    const [a, b] = String(n).split('.');
    const v = +a;
    let c = v <= 10 ? 1 : v < 20 ? 2 : v === 100 ? 2 : v % 10 === 0 ? 2 : v < 100 ? 3 : a.length + 1;
    if (b) c += 1 + b.length;
    return c;
  };
  const syllables = (s) => {
    let n = 0;
    const re = /(\d+(?:\.\d+)?)(%?)|([A-Za-z]+)|([一-鿿])|([，,、：:])|([。；;！!？?\n])/g;
    let m;
    while ((m = re.exec(s))) {
      if (m[1]) n += numberSyllables(m[1]) + (m[2] ? 3 : 0);
      else if (m[3]) n += Math.max(1, Math.ceil(m[3].length / (m[3] === m[3].toUpperCase() ? 1 : 3)));
      else if (m[4]) n += 1;
      else if (m[5]) n += 0.8;
      else if (m[6]) n += 1.6;
    }
    return n;
  };

  const SAMPLE = /^(?:在我们调研的)?\d+\s*(?:位|名|家|个|为)[^，,]*?(?:中|里)$/;
  const LEAD_CONNECT = /^的?(?:用户|人群|人|朋友|家长|老年人|受访者|孩子|学生)?(?:表示|说|称|会说|都)?/;
  const VERBS = /(占到了|占到|占了|占比为|占比|占|达到了|达到|达|约为|约|大约|是|为|有|只有|仅有|仅仅|仅|才|不到|不足|超过|高达|将近|接近|近|的比例)$/;
  const PREFIX = /(只有|仅有|仅仅|仅|才|不到|不足|超过|高达|将近|接近|近)$/;
  const EMPH = /(只有|仅有|仅仅|仅|才|不到|不足)/;
  const NOTE = /^(这|而这|但这|不过这|并且这|而且这)/;
  const NOTE2 = /(比例|基数|样本|仅仅|只是|只算)/;
  const SUBJECT_AGE = /^(\d+\s*(?:到|至|-|—|~)\s*\d+\s*岁(?:的)?(?:青少年|儿童|孩子|学生|人群|用户|成年人|老人|女性|男性|人)?)/;
  const SUBJECT_ERA = /^(\d{2}后(?:用户|人群|学生)?)/;
  const SUBJECT_WORD = /^([一-鿿]{0,6}?(?:青少年|儿童|孩子|大学生|中学生|小学生|学生|家长|女性|男性|老人|成年人|消费者|受访者|高频用户|低频用户|新用户|老用户|付费用户|用户|人群))(?=[一-鿿A-Za-z])/;
  const FREQ = ['每年', '每季度', '每月', '每两周', '每周', '每天', '每日', '每小时'];
  const NEG = /(几乎不|不会|不再|不太|从不|从未|没有|没|很少|极少|未)/;

  const freqRank = (s) => {
    let r = -1;
    FREQ.forEach((w, i) => {
      if (s.includes(w)) r = Math.max(r, i);
    });
    return r;
  };
  const stripEnd = (s) =>
    s
      .replace(/^[，,、]+/, '')
      .replace(/[，,、。；;！!？?]+$/, '')
      .replace(/(的用户|的人群|的人|的比例|比例|用户比例|的)$/, '')
      .replace(/[，,、]+$/, '')
      .trim();
  const shareWord = (a, b) => {
    const A = a.replace(/[，,、的了在是]/g, '');
    for (let i = 0; i + 2 <= A.length; i++) if (b.includes(A.slice(i, i + 2))) return true;
    return false;
  };

  const parseCopy = (input) => {
    const text = normalizeText(input);
    const syllAt = (i) => syllables(text.slice(0, i));
    const timeAt = (i) => syllAt(i) / RATE + PAD;

    const parts = [];
    const re = /[^，,。；;！!？?\n]+([，,。；;！!？?\n]*)/g;
    let m;
    while ((m = re.exec(text))) {
      const body = m[0].slice(0, m[0].length - m[1].length);
      parts.push({body, start: m.index, end: m.index + body.length, sentenceEnd: /[。；;！!？?\n]/.test(m[1])});
    }

    const metrics = [];
    let pending = [];
    let leadOpen = null;
    let notes = 0;

    const addMetric = (value, prefix, descParts, numEnd, numStart) => {
      const desc = descParts.map((p) => p.text).join('，');
      const mObj = {
        value: Math.round(parseFloat(value) * 10) / 10,
        prefix,
        emphasis: EMPH.test(prefix || ''),
        desc,
        sLand: timeAt(numEnd),
        sCap: descParts.length ? timeAt(descParts[0].start) : timeAt(numStart),
      };
      metrics.push(mObj);
      return mObj;
    };

    // 这一句后面还有没有别的数
    const restHasNumber = (i) => {
      if (parts[i].sentenceEnd) return false;
      for (let k = i + 1; k < parts.length; k++) {
        if (/\d+(?:\.\d+)?\s*%/.test(parts[k].body)) return true;
        if (parts[k].sentenceEnd) return false;
      }
      return false;
    };
    parts.forEach((p, partIndex) => {
      const numRe = /(\d+(?:\.\d+)?)\s*%/g;
      const nums = [];
      let n;
      while ((n = numRe.exec(p.body))) nums.push(n);
      if (!nums.length) {
        if (/^(这其中|其中|这里面|在他们之中|他们之中)$/.test(p.body)) {
          leadOpen = null;
          pending.push({text: p.body, start: p.start});
        } else if (NOTE.test(p.body) && NOTE2.test(p.body) && metrics.length) {
          const last = metrics[metrics.length - 1];
          last.note = {text: p.body, sAt: timeAt(p.start), sEnd: timeAt(p.end)};
          const baseMatch = p.body.match(/(?:对|在|是)([^，。]*?(?:用户|人群|人|群体|受访者))/);
          if (baseMatch) last.note.base = baseMatch[1].replace(/^(仅仅是|只是|是)/, '');
          leadOpen = null;
          notes++;
        } else if (leadOpen) {
          leadOpen.desc = leadOpen.desc ? `${leadOpen.desc}，${p.body}` : p.body;
          if (leadOpen.sCapLate) {
            leadOpen.sCap = timeAt(p.start);
            leadOpen.sCapLate = false;
          }
          if (restHasNumber(partIndex)) leadOpen = null;
        } else {
          pending.push({text: p.body, start: p.start});
        }
      } else {
        let cursor = 0;
        nums.forEach((num, idx) => {
          const before = p.body.slice(cursor, num.index);
          const nextStart = idx + 1 < nums.length ? nums[idx + 1].index : p.body.length;
          const after = p.body.slice(num.index + num[0].length, nextStart);
          const prefixMatch = before.match(PREFIX);
          const prefix = prefixMatch ? prefixMatch[1] : '';
          let own = before;
          while (VERBS.test(own)) own = own.replace(VERBS, '');
          const absStart = p.start + num.index;
          const absEnd = absStart + num[0].length;
          const tail = after.replace(LEAD_CONNECT, '');
          // 「这78%的用户中」是在指上一个数，不是新数
          if (/^这$/.test(own) && metrics.length && metrics[metrics.length - 1].value === Math.round(parseFloat(num[1]) * 10) / 10) {
            pending = [{text: '其中', start: absStart}];
            cursor = nextStart;
            return;
          }
          const wasWithin = pending.some((x) => /^(这其中|其中|这里面|在他们之中|他们之中)$/.test(x.text));
          const descParts = pending.filter((x) => !SAMPLE.test(x.text));
          if (own) descParts.push({text: own, start: p.start + cursor});
          pending = [];
          const realTail = tail.length >= 2 && !/^(比例|用户|人群|人|的比例)$/.test(tail);
          if (realTail || (!descParts.length && /^(的|表示|认为|觉得|说|称)/.test(after))) {
            // 数字在前：「有45%表示……」「有48%的用户表示，……」，后面一句归它
            const obj = addMetric(num[1], prefix, realTail ? [{text: tail, start: absEnd}] : [], absEnd, absStart);
            obj.sCapLate = !realTail;
            obj.within = wasWithin;
            obj.fromLead = true;
            leadOpen = obj;
          } else {
            addMetric(num[1], prefix, descParts, absEnd, absStart);
            leadOpen = null;
            if (tail.length >= 2) pending.push({text: tail, start: absEnd});
          }
          cursor = nextStart;
        });
      }
      if (p.sentenceEnd) {
        pending = [];
        leadOpen = null;
      }
    });

    // 分组
    const groups = [];
    let current = null;
    metrics.forEach((mt) => {
      let desc = mt.desc;
      let title = '';
      const subj = mt.fromLead ? null : desc.match(SUBJECT_AGE) || desc.match(SUBJECT_ERA) || desc.match(SUBJECT_WORD);
      if (subj) {
        title = subj[1];
        desc = desc.slice(subj[0].length).replace(/^[，,的]+/, '');
      }
      const caption = stripEnd(desc);
      const metric = {caption, value: mt.value, prefix: mt.prefix, emphasis: mt.emphasis, note: mt.note || null, sLand: mt.sLand, sCap: mt.sCap};
      const within = mt.within || /^(其中|这其中|这里面|在他们之中|他们之中)/.test(mt.desc);
      const isNested =
        !title &&
        current &&
        current.metrics.length === 1 &&
        current.relation !== 'chain' &&
        !current.metrics[0].note &&
        current.metrics[0].value >= mt.value &&
        !within &&
        freqRank(current.metrics[0].caption) >= 0 &&
        freqRank(caption) > freqRank(current.metrics[0].caption);
      if (within && current && !title) {
        // 「这其中」：基数变了，不是同一把尺子
        metric.caption = stripEnd(caption.replace(/^(其中|这其中|这里面|在他们之中|他们之中)[，,]?/, ''));
        current.metrics.push(metric);
        current.relation = 'chain';
      } else if (isNested) {
        current.metrics.push(metric);
        current.relation = 'nested';
      } else {
        current = {title, sTitle: mt.sCap, relation: 'single', metrics: [metric]};
        groups.push(current);
      }
    });

    // 相反的两拨人：相邻、无标题、同一个词一正一反、加起来不超过 100
    const merged = [];
    for (let i = 0; i < groups.length; i++) {
      const a = groups[i];
      const b = groups[i + 1];
      if (
        b &&
        a.metrics.length === 1 &&
        b.metrics.length === 1 &&
        !a.metrics[0].note &&
        !b.title &&
        NEG.test(a.metrics[0].caption) !== NEG.test(b.metrics[0].caption) &&
        shareWord(a.metrics[0].caption, b.metrics[0].caption) &&
        a.metrics[0].value + b.metrics[0].value <= 100
      ) {
        merged.push({title: a.title, sTitle: a.sTitle, relation: 'opposing', metrics: [a.metrics[0], b.metrics[0]]});
        i++;
      } else {
        merged.push(a);
      }
    }

    // 人话说明
    const explain = [];
    merged.forEach((g) => {
      if (g.relation === 'chain') explain.push(`${g.metrics.map((x) => x.value + '%').join(' → ')}：后面的数是前面那批人里面的比例，基数一层层变`);
      if (g.relation === 'nested') explain.push(`${g.metrics[1].value}% 包含在 ${g.metrics[0].value}% 里（${g.metrics[1].caption} 的人一定也 ${g.metrics[0].caption}）`);
      if (g.relation === 'opposing') explain.push(`${g.metrics[0].value}% 和 ${g.metrics[1].value}% 是相反的两拨人，我按同一批人、互不重叠处理，请确认`);
      g.metrics.forEach((mt) => {
        if (mt.note) explain.push(`${mt.value}% 的基数和其他数不同：${mt.note.base || mt.note.text}。不能和其他数放进同一个 100%`);
      });
    });
    if (merged.length > 1 && merged.every((g) => g.title)) explain.push(`${merged.map((g) => g.title).join('、')} 分组对比，同一把尺子上下对齐`);

    return {text, groups: merged, explain, count: metrics.length, duration: timeAt(text.length)};
  };

  root.DMParser = {parseCopy, syllables, normalizeText, RATE};
  if (typeof module === 'object' && module.exports) module.exports = root.DMParser;
})(typeof window !== 'undefined' ? window : globalThis);
