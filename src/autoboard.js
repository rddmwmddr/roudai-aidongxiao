// 智能编导分镜（离线规则引擎 + AI 结果核验）：
// 整篇文稿 → 按完整语义拍切镜 → A-roll 出镜（含景别递进与双机位调度）/ B-roll 动效（按文案逻辑关系选高表现力模板）/ B-roll 实拍（真机硬件与实测场景）/ B-roll 素材（外部报道与公开资料）。
// 硬规则：口播原文 line 一字不改、不漏；所有数字出自原文。
(function (root) {
  'use strict';
  const D = root.DM;
  const P = root.DMParser;

  const HEAD = /^(第[一二三四五六七八九十百\d]+[章节部分幕回集]|开场|序章|序言|序|引子|前言|结尾|尾声|片尾|结语)(?:[\s：:、.．—-]+(.*))?$/;
  const PCT = /(\d+(?:\.\d+)?\s*[%％])|(百分之[零一二两三四五六七八九十百点\d]+)/;
  const SENT = /[^。！？!?；;\n]+[。！？!?；;]*["”’」』）)]*/g;
  const SILENT = /^[(（【\[]?\s*(不说话|留白|停顿|空镜|静音)\s*[)）】\]]?$/;
  const PENDING_SLOT_RE = /(XX\s*[%％]|待填|占比.*放(?:在)?屏幕|数据.*放(?:在)?屏幕|直接放(?:在)?屏幕上)/i;

  // 外部资料素材：仅匹配明确引用公开媒体、第三方报告、发布会或网页聊天记录，绝不把作者自有问卷当成录屏素材
  const FOOTAGE_RE = /(新闻|报道|热搜|人民日报|新华社|央视|日报|晚报|周刊|官网|发布会|演讲|财报|白皮书|论文|期刊|聊天记录|评论区|网友问|网友说|公告|专利|历史画面)|((?:19|20)\d{2}年\d{1,2}月|今年\d{1,2}月).*?(?:报道|事件|事故|中毒|住院|发布|上线|通报)/;

  // 实拍识别：区分「真机硬件/上手实测/具体试机场景」与「修辞比喻里顺嘴提到的日常设备」
  const RHETORICAL_SCREEN_RE = /(放(?:在)?屏幕上|屏幕前的你|手边的手机|手边的屏|常规屏幕|家里本来就有|家里又有|排第1的理由|问卷里写|有人在问卷里|那400个)/;
  const VERSUS_RE = /(两款|两台|三款|三台|五款|和上代|跟上代|同框|并排|左边这|右边这|播了同一段片子做对比|跟平时惯用的屏幕.*对比)/;
  const HANDS_RE = /(拿在手|握在手|单手|握持|手感|点开|点击|滑动|上滑|下拉|长按|拍张照片|拍了张|打开App|打开相机|插上|充电|折叠|展开|放进兜|掐表|喊片名|豆包语音|发了条微信|回2条微信|头戴往上推|头戴上推|拎着盒子|理一下线)/;
  const PRODUCT_RE = /(机身|边框|背板|后盖|中框|镜头|模组|潜望|长焦|传感器|快门|按键|接口|折痕|铰链|厚度|磨砂|钛|配色|外观|黑边|刘海|灵动岛|扬声器|散热|发热|样张|夜景|逆光|外置盒|计算单元|后脑勺的头带|头戴减重|眼动变焦|现实透视|4DGS|264克)/;
  const SCENE_TEST_RE = /(先试佩戴|坐在平时家里看片|靠在沙发靠背|床头枕头上躺着看|等家里人都睡了.*关上卧室的灯.*戴上头显|去线下试机.*找把椅子靠着坐|去医院.*挂号)/;

  const TURN_RE = /^(但是|但|不过|然而|其实|那我换个问法|换句话说|问题是|但问题是|为什么|真相是|结果呢|恰恰相反|说白了|注意看|更有意思的是|回头看|回头再看|把.*合在一起看)/;
  const FIRST_PERSON_RE = /(我们|我问|我换|那我|我把|我会|我想|我试|我干脆|我看到|我当时|我自己|在我看|你会问|会吧|好用吧|前面我问|说实话)/;

  const sentencesOf = (para) => (para.match(SENT) || []).map((s) => s.trim()).filter(Boolean);
  const isQuestion = (s) => /[？?]["”’」』）)]*$/.test(s);
  const hasPct = (s) => PCT.test(s);
  const stripEnd = (s) => s.replace(/[，。！？!?；;、,.\s"”’」』）)]+$/, '');
  const lenOf = (s) => Array.from(s).length;

  const listOf = (s) => {
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

  // ---------- 非百分比人群数据与二元反差语义解析（让动效真正表达文稿逻辑） ----------
  // 1. 样本漏斗：如「1200人的头显调研，800个人买过，400个人没买。800个买过的人里，322个嫌重压脸」
  const parseCountFunnel = (text) => {
    if (/几乎一样多|差不多/.test(text)) return null;
    const matches = [...String(text).matchAll(/(\d{2,6})\s*(?:个人|位|名|人|个)(?![月星礼])([^，。；！？\n]{0,14})/g)];
    if (matches.length < 3) return null;
    const items = [];
    matches.forEach((m) => {
      const v = +m[1];
      let raw = (m[2] || '').replace(/^(的|里头|其中|中|里|有|也)/, '').replace(/(里|中|的)$/, '').trim();
      if (!raw) {
        const idx = m.index || 0;
        const before = text.slice(Math.max(0, idx - 10), idx).replace(/^.*[，。；：]/, '').trim();
        raw = before;
      }
      if (v > 0 && !items.some((x) => x.value === v)) {
        items.push({label: (raw || '调研样本').slice(0, 10), value: v, find: String(v)});
      }
    });
    if (items.length >= 3 && items[0].value > items[1].value) {
      const chain = [items[0], items[1]];
      for (let i = 2; i < items.length; i++) {
        const prev = chain[chain.length - 1].value;
        // 真正的漏斗每一层都明显收缩（<= 0.82），把「14个 vs 13个」这种并列分叉排除在外
        if (items[i].value <= prev * 0.82 && items[0].value - items[1].value !== items[i].value) {
          chain.push(items[i]);
        }
      }
      if (chain.length >= 3) {
        return {
          tpl: 'chFunnel',
          unit: '人',
          title: '调研样本层级筛选',
          series: chain,
          visual: `漏斗层层筛选：${chain.map((x) => `${x.value}人`).join(' → ')}`,
        };
      }
    }
    return null;
  };

  // 2. 人群点阵个体反差：如「38个人里，5个说会，21个说还是用别的」或「还有252个人一直在稳定用……这252个人里，有111个也选了重、压脸」
  const parseCrowdContrast = (text) => {
    const m = String(text).match(/(\d{2,3})\s*(?:个人|位|名|人)(?:[\s\S]*?\1\s*(?:个人|位|名|人))?[^。！？\n]{0,28}?(?:里|中)[，,]?\s*(?:有|仅有|只有)?\s*(\d{1,3})\s*(?:个人|个|位|人)(?![月星])([^，。；！？\n]{1,18})(?:[，,]\s*(?:有)?(\d{1,3})\s*(?:个人|个|位|人)([^，。；！？\n]{1,18}))?/);
    if (!m) return null;
    const total = +m[1];
    const n1 = +m[2];
    const desc1 = stripEnd(m[3] || '');
    const n2 = m[4] ? +m[4] : null;
    const desc2 = m[5] ? stripEnd(m[5]) : '';
    if (total < 15 || total > 300 || n1 <= 0 || n1 >= total) return null;
    if (n2 != null && n2 > 0 && n1 + n2 <= total) {
      const small = n1 <= n2 ? {n: n1, desc: desc1} : {n: n2, desc: desc2};
      const big = n1 <= n2 ? {n: n2, desc: desc2} : {n: n1, desc: desc1};
      return {
        tpl: 'attrition',
        total,
        unit: '人',
        caption: `${total}位受访者真实表态对比`,
        highlight: {
          n: small.n,
          find: `${small.n}`,
          text: `${small.desc}（另有 ${big.n} 人${big.desc}）`,
        },
        visual: `${total}个点代表${total}人：仅${small.n}人亮起，反衬${big.n}人${big.desc}`,
      };
    }
    return {
      tpl: 'attrition',
      total,
      unit: '人',
      caption: `${total}位稳定使用人群中的重叠反馈`,
      highlight: {
        n: n1,
        find: `${n1}`,
        text: desc1,
      },
      visual: `${total}人点阵中亮出${n1}人：${desc1}`,
    };
  };

  // 3. 同基数分组并列对比（如「换电视或投影的有14个，换手机的有13个」）
  const parseGroupCounts = (text) => {
    const clauses = String(text).split(/[，,。；;！!？?\n]/).map((s) => s.trim()).filter(Boolean);
    const items = [];
    let leadTotal = '';
    const leadMatch = String(text).match(/(\d{2,4})\s*(?:个人|位|人)/);
    if (leadMatch) leadTotal = `${leadMatch[1]}位半途换设备的用户去向`;
    clauses.forEach((cl) => {
      const m = cl.match(/^([^0-9]{2,14}?)(?:的)?(?:有|是|为|占)\s*(\d+(?:\.\d+)?)\s*(个|人|位|台|分钟|分)(?![月星])$/);
      if (m) {
        const label = m[1].replace(/^(其中|而|但|换|选|去)/, '').replace(/的$/, '').trim();
        if (label && lenOf(label) <= 8 && !/^(上次|问卷|专门)/.test(label)) {
          items.push({label, value: +m[2], unit: m[3], find: `${m[2]}${m[3]}`});
        }
      }
    });
    if (items.length >= 2 && items.length <= 4 && items.every((x) => x.unit === items[0].unit)) {
      const values = {};
      items.forEach((x) => { values[x.label] = x.value; });
      return {
        tpl: 'groupBars',
        sets: [{
          caption: leadTotal,
          unit: items[0].unit === '个' && leadTotal ? '人' : items[0].unit,
          values,
          find: items.map((x) => x.find),
          highlight: items[items.length - 1].label,
        }],
        visual: `分组对比柱：${items.map((x) => `${x.label} ${x.value}`).join(' vs ')}`,
      };
    }
    return null;
  };

  // 4. 强烈二元反差句识别 → 左右滑杆对比（split）
  const parseRhetoricalSplit = (text) => {
    const clean = stripEnd(text);
    // 模式 A：「明明……，摘下来/却宁愿……」
    let m = clean.match(/明明([^，。]{4,22})[，,]\s*([^，。]*?(?:却|宁愿|偏偏|反而)[^，。]{4,24})/);
    if (m) {
      const leftTitle = /大.*屏|头显/.test(m[1]) ? '头显大屏' : '原本预期';
      const rightTitle = /手机/.test(m[2]) ? '巴掌大手机' : '实际选择';
      return {
        left: {title: leftTitle, lines: [m[1].trim()]},
        right: {title: rightTitle, find: m[2].slice(0, 4), lines: [m[2].trim()]},
        visual: `左右滑杆反差：${leftTitle} vs ${rightTitle}`,
      };
    }
    // 模式 B：「……是0门槛的，……但凡多出N步折腾，……」
    m = clean.match(/([^，。]{2,16}是0门槛的)[，,]\s*([^，。]{1,16}但凡[^，。]{2,14})(?:[，,]\s*([^。！？]{1,22}))?/);
    if (m) {
      const rLines = [m[2].trim()];
      const tailParts = m[3] ? m[3].split(/[，,]/).map((x) => x.trim()).filter(Boolean) : [];
      return {
        left: {title: '0门槛顺手看', lines: [m[1].trim()]},
        right: {title: '多2步就熄灭', find: m[2].slice(0, 4), lines: rLines.concat(tailParts).slice(0, 3)},
        visual: '左右滑杆对比：0门槛日常屏 vs 多两步折腾念头熄灭',
      };
    }
    // 模式 C：「前面那些人……是因为……；而到这儿……偏要……」
    m = clean.match(/前面([^；。]{6,28})[；;，,]\s*而到这儿[，,]?\s*([^。！？]{6,34})/);
    if (m) {
      return {
        left: {title: '换回常规屏', lines: [m[1].trim()]},
        right: {title: '非戴不可的时刻', find: '而到这儿', lines: [m[2].trim()]},
        visual: '左右滑杆收束：手边屏够用 vs 深夜独享大屏刚需',
      };
    }
    return null;
  };

  const pickSubject = (text, re, fallback) => {
    const m = text.match(re);
    if (!m) return fallback;
    const hit = m[0];
    return lenOf(hit) <= 12 ? hit : hit.slice(0, 12);
  };

  // 判断叙事段落归属：footage（外部素材）/ shoot（真机与场景实拍）/ aroll（主讲人出镜）
  const classifyNarrative = (text) => {
    if (SILENT.test(text.trim())) {
      return {
        track: 'aroll',
        shotSize: '近景',
        cameraMove: '固定',
        subject: '主讲人留白停顿',
        shootGuide: '近景注视镜头留白，保留环境底噪',
        postGuide: '音乐收低，留足停顿气口',
      };
    }
    if (FOOTAGE_RE.test(text) && !FIRST_PERSON_RE.test(text)) {
      const isScreen = /(聊天记录|评论|官网|论文|专利|财报|白皮书)/.test(text);
      const sub = pickSubject(text, FOOTAGE_RE, '公开报道资料');
      return {
        track: 'footage',
        shotSize: isScreen ? '录屏特写' : '全屏资料',
        cameraMove: isScreen ? '缓慢推轨' : '局部放大',
        subject: `${sub}原件画面`,
        sketchKind: 'footage_doc',
        shootGuide: isScreen ? '截取高分原页，隐去无关隐私信息' : '准备报道版面高清原件，保留媒体名与日期',
        postGuide: '念到核心事实时框选高亮，周边压暗聚焦',
      };
    }
    if (RHETORICAL_SCREEN_RE.test(text) && !HANDS_RE.test(text) && !SCENE_TEST_RE.test(text)) {
      return {track: 'aroll'};
    }
    if (VERSUS_RE.test(text) && (PRODUCT_RE.test(text) || /片子|屏幕|手机|机身|参数/.test(text))) {
      const sub = pickSubject(text, PRODUCT_RE, '实测样机与对照屏');
      return {
        track: 'shoot',
        shotSize: '双机同框',
        cameraMove: '横移滑轨',
        subject: `同源对比实拍（${sub}）`,
        sketchKind: 'versus_two',
        shootGuide: '样机与对照设备同框播放同一片源，统一环境色温与曝光',
        postGuide: '左右分屏或滑轨横移对照，用简洁角标区分设备',
      };
    }
    if (SCENE_TEST_RE.test(text)) {
      const isNight = /夜|睡|关.*灯|卧室/.test(text);
      return {
        track: 'shoot',
        shotSize: '中景实拍',
        cameraMove: isNight ? '固定' : '缓慢推轨',
        subject: isNight ? '深夜卧室关灯躺看头显' : '居家/门店靠坐长时佩戴实测',
        sketchKind: 'person_scene',
        shootGuide: isNight
          ? '卧室关主灯仅留微弱氛围光，侧拍人物躺下佩戴头显，不惊动周围'
          : '侧拍人物靠坐沙发或椅背连续看剧，带出后脑勺头带贴合与外置盒走线',
        postGuide: '铺在口播上方完整展现真实使用姿态，动作自然不摆拍',
      };
    }
    if (HANDS_RE.test(text)) {
      const sub = pickSubject(text, HANDS_RE, '上手实操');
      return {
        track: 'shoot',
        shotSize: /微信|头戴|拎着|握持|拿在手|单手/.test(text) ? '过肩操作' : '桌面俯拍',
        cameraMove: '固定',
        subject: `实操测试（${sub}）`,
        sketchKind: 'topdown_hands',
        shootGuide: '过肩或俯拍机位对准手部动作与设备响应，避开反光，一镜到底记录耗时与顺畅度',
        postGuide: '卡口播动作词切入实拍，保留真实按键、语音唤醒或理线原声',
      };
    }
    if (PRODUCT_RE.test(text) && (!FIRST_PERSON_RE.test(text) || /拿到这台|外置盒|后脑勺|264克/.test(text))) {
      const sub = pickSubject(text, PRODUCT_RE, '硬件本体');
      const macro = /(边框|镜头|模组|折痕|铰链|厚度|磨砂|钛|按键|接口|头带|外置盒)/.test(text);
      return {
        track: 'shoot',
        shotSize: macro ? '微距细节' : '产品特写',
        cameraMove: macro ? '横移滑轨' : '缓慢推轨',
        subject: `硬件特写（${sub}）`,
        sketchKind: 'product_cu',
        shootGuide: `暗调干净桌面侧逆光勾边，围绕${sub}推进展示结构与配重细节`,
        postGuide: '卡产品名或结构词切入特写，留足画面看清细节',
      };
    }
    return {track: 'aroll'};
  };

  // 按「完整语义拍」组织段落：不按逗号碎切，整段推理、整串漏斗数据或整项实测合为一镜
  const planParagraph = (para, out, opts = {}) => {
    if (SILENT.test(para.trim())) {
      out.push({type: 'silent', text: para.trim()});
      return;
    }
    const sents = sentencesOf(para);
    if (!sents.length) return;
    if (opts.sentences) {
      sents.forEach((s) => out.push({type: hasPct(s) ? 'data' : 'narrative', text: s}));
      return;
    }

    let i = 0;
    let narrative = [];
    const flush = () => {
      if (!narrative.length) return;
      out.push({type: 'narrative', text: narrative.join('')});
      narrative = [];
    };

    while (i < sents.length) {
      const s = sents[i];

      // 0. 预留待填屏幕数据位（如「具体几类用途的占比，我直接放屏幕上」）
      if (PENDING_SLOT_RE.test(s) && !/\d+\s*[%％]/.test(s)) {
        flush();
        out.push({type: 'pending_data', text: s});
        i++;
        continue;
      }

      // 1. 百分比数据组：把同一数据链相连句子合为一镜
      if (hasPct(s)) {
        flush();
        const group = [s];
        let j = i + 1;
        while (j < sents.length) {
          const next = sents[j];
          const attached = /^(这其中|其中|在他们之中|而|只有|仅有|这还|会|另外|同时)/.test(next);
          const total = lenOf(group.join('')) + lenOf(next);
          if ((hasPct(next) && total <= 170) || (attached && total <= 180)) {
            group.push(next);
            j++;
          } else break;
        }
        out.push({type: 'data', text: group.join('')});
        i = j;
        continue;
      }

      // 2. 非百分比人群漏斗 / 人群个体反差 / 分组人数对比
      const twoSent = i + 1 < sents.length ? s + sents[i + 1] : s;
      const threeSent = i + 2 < sents.length ? twoSent + sents[i + 2] : twoSent;
      if (parseCountFunnel(threeSent)) {
        flush();
        const useThree = !parseCountFunnel(twoSent);
        out.push({type: 'count_funnel', text: useThree ? threeSent : twoSent});
        i += useThree ? 3 : 2;
        continue;
      }
      if (i + 1 < sents.length && !parseCrowdContrast(s) && parseCrowdContrast(twoSent)) {
        flush();
        out.push({type: 'crowd_contrast', text: twoSent});
        i += 2;
        continue;
      }
      if (parseCrowdContrast(s)) {
        flush();
        out.push({type: 'crowd_contrast', text: s});
        i++;
        continue;
      }
      if (i + 2 < sents.length && /^你猜|我们问/.test(sents[i + 1]) && parseGroupCounts(sents[i + 2])) {
        flush();
        out.push({type: 'group_counts', text: s + sents[i + 1] + sents[i + 2]});
        i += 3;
        continue;
      }
      if (i + 1 < sents.length && /^你猜|我们问/.test(s) && (parseCrowdContrast(sents[i + 1]) || parseGroupCounts(sents[i + 1]))) {
        flush();
        const combined = s + sents[i + 1];
        out.push({type: parseCrowdContrast(sents[i + 1]) ? 'crowd_contrast' : 'group_counts', text: combined});
        i += 2;
        continue;
      }
      if (parseGroupCounts(s)) {
        flush();
        out.push({type: 'group_counts', text: s});
        i++;
        continue;
      }
      const series = D.parseSeries ? D.parseSeries(s) : null;
      if (series) {
        flush();
        out.push({type: 'data', text: s});
        i++;
        continue;
      }

      // 3. 强烈二元反差句 → split 左右对比动效
      if (parseRhetoricalSplit(s)) {
        flush();
        out.push({type: 'split_contrast', text: s});
        i++;
        continue;
      }

      // 3b. 超短引导句（≤14字，如「然后试被打断。」）若紧接实拍测试句，直接并入下一句实拍
      if (lenOf(s) <= 14 && i + 1 < sents.length && classifyNarrative(sents[i + 1]).track === 'shoot') {
        sents[i + 1] = s + sents[i + 1];
        i++;
        continue;
      }

      // 4. 连续设问句
      if (isQuestion(s) && lenOf(s) <= 48) {
        flush();
        const qs = [s];
        let j = i + 1;
        while (j < sents.length && isQuestion(sents[j]) && lenOf(sents[j]) <= 48 && qs.length < 6 && !hasPct(sents[j])) {
          qs.push(sents[j]);
          j++;
        }
        if (qs.length >= 2) {
          out.push({type: 'question', lines: qs, text: qs.join('')});
          i = j;
          continue;
        }
        if (j < sents.length && lenOf(sents[j]) <= 12 && /^(我会|会啊|会吧|不会|好用|没错|对)[，。！？!?]*$/.test(sents[j])) {
          out.push({type: 'aroll_qa', text: s + sents[j]});
          i = j + 1;
          continue;
        }
        out.push({type: 'single_question', lines: qs, text: s});
        i = j;
        continue;
      }

      // 5. 顿号并列四词以上 → relay 词语接力
      const words = listOf(s);
      if (words) {
        flush();
        out.push({type: 'relay', lines: words, text: s});
        i++;
        continue;
      }

      // 6. 实拍测试段落或主讲口播段落：同轨道相邻句子合并成完整语义拍（65~135 字），拒绝一秒一碎切
      const hint = classifyNarrative(s);
      if (hint.track !== 'aroll') {
        flush();
        const block = [s];
        let j = i + 1;
        while (j < sents.length) {
          const nx = sents[j];
          if (hasPct(nx) || parseCrowdContrast(nx) || parseGroupCounts(nx) || parseRhetoricalSplit(nx)) break;
          const nxHint = classifyNarrative(nx);
          if (nxHint.track === hint.track && lenOf(block.join('')) + lenOf(nx) <= 135) {
            block.push(nx);
            j++;
          } else if (lenOf(block.join('')) < 42 && lenOf(nx) <= 45 && !TURN_RE.test(nx)) {
            block.push(nx);
            j++;
            break;
          } else break;
        }
        out.push({type: 'narrative', text: block.join('')});
        i = j;
        continue;
      }

      if (TURN_RE.test(s) && narrative.length > 0 && lenOf(narrative.join('')) >= 28) {
        flush();
      }
      narrative.push(s);
      if (lenOf(narrative.join('')) >= 92 || narrative.length >= 3) flush();
      i++;
    }
    flush();
  };

  // A-roll 景别递进与双机位调度器
  const makeARollScheduler = () => {
    let streak = 0;
    let lastSize = '';
    let sideToggle = false;
    return {
      resetAfterBRoll() {
        streak = 0;
      },
      next(text, isChapterFirst) {
        streak++;
        const turn = TURN_RE.test(text);
        const ask = /[？?]/.test(text);
        const punchy = lenOf(text) <= 28;

        let shotSize = '中景';
        let cameraMove = '固定';
        let sketchKind = 'host_ms';
        let shootGuide = 'A 机正面中景平视，自然手势配合口播论述';
        let postGuide = '承接上镜气口切入，保持整段推理语流完整';

        if (streak === 1) {
          if (!isChapterFirst && (turn || (ask && punchy))) {
            shotSize = '近景';
            cameraMove = '固定';
            sketchKind = 'host_cu';
            shootGuide = '近景直视镜头，眼神定住给出核心判断';
            postGuide = '从 B-roll 硬切近景收束注意力，句尾留半秒气口';
          }
        } else if (turn || ask) {
          shotSize = lastSize === '近景' ? '特写' : '近景';
          cameraMove = '跳切推近';
          sketchKind = shotSize === '特写' ? 'host_cu' : 'host_mcu';
          shootGuide = shotSize === '特写'
            ? '推至面部特写（或 4K 裁切 1.35×），突出情绪转折与眼神停顿'
            : '从上一镜中景跳切推近至 1.2× 近景，身体微前倾拉近交流感';
          postGuide = '卡句首转折或提问词硬切放大景别，制造思辨推进感';
        } else if (sideToggle) {
          shotSize = '侧机位中近';
          cameraMove = '双机位切B机';
          sketchKind = 'host_side';
          shootGuide = '切 B 机 45° 侧机位中近景，人物视线前方留白';
          postGuide = '段落换气处切 B 机侧面视角，自然过渡长段分析';
          sideToggle = false;
        } else {
          shotSize = lastSize === '中近景' ? '中景' : '中近景';
          cameraMove = shotSize === '中近景' ? '跳切推近' : '固定';
          sketchKind = shotSize === '中近景' ? 'host_mcu' : 'host_ms';
          shootGuide = shotSize === '中近景'
            ? '由中景裁切至 1.15× 中近景，手势收在胸前取景框内'
            : '切回 A 机标准中景舒缓节奏，留出呼吸空间';
          postGuide = shotSize === '中近景'
            ? '新论点起音处跳切推近一档'
            : '回落至基准中景画幅';
          sideToggle = true;
        }
        lastSize = shotSize;
        return {
          track: 'aroll',
          kind: 'A',
          cat: 'A-roll',
          shotSize,
          cameraMove,
          subject: '主讲人出镜',
          sketchKind,
          visual: `A-roll ${shotSize}（${cameraMove}）`,
          shootGuide,
          postGuide,
          streak,
        };
      },
    };
  };

  const motionFields = (tplId, extra, postGuide) => {
    const def = D.TEMPLATES[tplId];
    const cat = !def ? '文字动效' : def.cat === 'percent' || def.cat === 'chart' || def.cat === 'fine' ? '数据动效' : ['kxi', 'kxs', 'kxm', 'button', 'toggle', 'loader'].includes(def.cat) ? '屏幕动效' : '文字动效';
    return Object.assign({
      track: 'motion',
      kind: 'B',
      cat,
      tpl: tplId,
      shotSize: '全屏动效',
      cameraMove: '帧内动画',
      subject: def ? def.name : '动效画面',
      shootGuide: '无需实拍，由动效引擎直接渲染导出',
      postGuide: postGuide || '导出 4K MP4 覆盖在口播轨上方，数字与关键词对齐人声落点',
    }, extra);
  };

  const generate = (text, opts = {}) => {
    const clean = String(text || '').replace(/\r\n?/g, '\n').replace(/　/g, ' ');
    const lines = clean.split('\n').map((l) => l.trim());
    let chapter = opts.chapter || '正片';
    let title = '';
    const rawParas = [];
    let verse = [];
    const flushVerse = (plan) => {
      if (!verse.length) return;
      if (verse.length >= 2) plan.push({type: 'verse', lines: verse.slice(), text: verse.join('，'), ch: chapter});
      else planParagraph(verse[0], plan, opts);
      verse = [];
    };

    const plan = [];
    let afterHead = false;
    if (opts.whole) {
      const all = clean.replace(/\n+/g, '').trim();
      if (all) {
        const sents = sentencesOf(all);
        const words = listOf(all);
        if (SILENT.test(all)) plan.push({type: 'silent', text: all, ch: chapter});
        else if (PENDING_SLOT_RE.test(all) && !/\d+\s*[%％]/.test(all)) plan.push({type: 'pending_data', text: all, ch: chapter});
        else if (hasPct(all) || (D.parseSeries && D.parseSeries(all))) plan.push({type: 'data', text: all, ch: chapter});
        else if (parseCountFunnel(all)) plan.push({type: 'count_funnel', text: all, ch: chapter});
        else if (parseCrowdContrast(all)) plan.push({type: 'crowd_contrast', text: all, ch: chapter});
        else if (parseGroupCounts(all)) plan.push({type: 'group_counts', text: all, ch: chapter});
        else if (parseRhetoricalSplit(all)) plan.push({type: 'split_contrast', text: all, ch: chapter});
        else if (sents.length >= 2 && sents.every(isQuestion) && sents.length <= 6) plan.push({type: 'question', lines: sents, text: all, ch: chapter});
        else if (words) plan.push({type: 'relay', lines: words, text: all, ch: chapter});
        else plan.push({type: 'narrative', text: all, ch: chapter});
      }
    } else {
      // 跨空行合并同一数据漏斗开场（如第1段「1200人调研，800买过，400没买」紧接第2段「800个买过的人里，322个嫌重」）
      for (let idx = 0; idx < lines.length; idx++) {
        const raw = lines[idx];
        if (!raw) {
          rawParas.push('');
          continue;
        }
        let nextIdx = idx + 1;
        while (nextIdx < lines.length && !lines[nextIdx]) nextIdx++;
        if (nextIdx < lines.length && lines[nextIdx] && !/^#/.test(raw) && !HEAD.test(raw)) {
          const firstNextSent = (sentencesOf(lines[nextIdx])[0] || '');
          if (firstNextSent && parseCountFunnel(`${raw}${firstNextSent}`)) {
            const restNext = sentencesOf(lines[nextIdx]).slice(1).join('');
            rawParas.push(`${raw}${firstNextSent}`);
            lines[nextIdx] = restNext;
            continue;
          }
        }
        rawParas.push(raw);
      }

      rawParas.forEach((raw) => {
        if (!raw) {
          flushVerse(plan);
          return;
        }
        const md = raw.match(/^#{1,6}\s*(.+)$/);
        const line = md ? md[1].trim() : raw;
        const h = line.match(HEAD);
        if (md || (h && lenOf(line) <= 36)) {
          flushVerse(plan);
          if (md && !title && !h) title = line;
          else chapter = h ? h[1] : line;
          if (md && title !== line) chapter = h ? h[1] : line;
          afterHead = true;
          return;
        }
        if (afterHead && lenOf(line) <= 16 && !/[。！？!?；;，,]/.test(line) && !hasPct(line) && !SILENT.test(line)) {
          verse.push(line);
          return;
        }
        flushVerse(plan);
        afterHead = false;
        const before = plan.length;
        planParagraph(line, plan, opts);
        for (let k = before; k < plan.length; k++) plan[k].ch = chapter;
      });
      flushVerse(plan);
    }
    plan.forEach((p) => {
      if (!p.ch) p.ch = chapter;
    });

    let lastDataTpl = null;
    let prevCh = '';
    const used = {};
    const aroll = makeARollScheduler();

    const matchedMotion = (row, txt) => {
      const m = D.matchMotion ? D.matchMotion(txt, used) : null;
      if (!m) return null;
      used[m.id] = (used[m.id] || 0) + 1;
      aroll.resetAfterBRoll();
      return Object.assign(row, motionFields(m.id, {
        lines: [stripEnd(txt)],
        visual: `动效「${m.name}」（呼应「${m.hit}」）`,
      }, `画面随「${m.hit}」切入「${m.name}」动效，念完回切主线`));
    };

    const rows = plan.map((p, idx) => {
      const isChapterFirst = p.ch !== prevCh;
      prevCh = p.ch;
      const base = {id: idx + 1, no: String(idx + 1).padStart(3, '0'), ch: p.ch, line: p.text, lines: [stripEnd(p.text) || p.text], tpl: 'statement'};

      if (p.type === 'silent') {
        const info = classifyNarrative(p.text);
        aroll.resetAfterBRoll();
        return Object.assign(base, info, {
          kind: 'A',
          cat: 'A-roll',
          visual: `${info.shotSize} · 留白停顿`,
        });
      }
      if (p.type === 'verse') {
        aroll.resetAfterBRoll();
        return Object.assign(base, motionFields('titleH', {
          head: p.ch,
          lines: p.lines,
          visual: '章节诗句卡',
        }, '章节起首黑场渐显，留足诗句阅读时间'));
      }
      if (p.type === 'pending_data') {
        aroll.resetAfterBRoll();
        const adopted = D.adopt ? D.adopt(Object.assign({}, base), 'rank') : base;
        return Object.assign(adopted, motionFields('rank', {
          pending: true,
          visual: '预留屏幕数据排行（待填真实占比）',
          note: '文稿在此处预留了上屏数据位，填入真实数字后即可导出成片',
        }, '填入真实调研占比后导出 4K 排行画面覆盖在口播轨上'));
      }
      if (p.type === 'count_funnel') {
        aroll.resetAfterBRoll();
        const fn = parseCountFunnel(p.text);
        if (fn) {
          lastDataTpl = fn.tpl;
          return Object.assign(base, motionFields(fn.tpl, {
            title: fn.title,
            unit: fn.unit,
            series: fn.series,
            visual: fn.visual,
          }, '随口播报出的样本数逐层收缩漏斗，直观呈现人群筛选过程'));
        }
      }
      if (p.type === 'crowd_contrast') {
        aroll.resetAfterBRoll();
        const cc = parseCrowdContrast(p.text);
        if (cc) {
          lastDataTpl = cc.tpl;
          return Object.assign(base, motionFields(cc.tpl, {
            total: cc.total,
            unit: cc.unit,
            caption: cc.caption,
            highlight: cc.highlight,
            visual: cc.visual,
          }, `满屏 ${cc.total} 个点代表每一个人，念到关键人数时瞬间点亮形成反差`));
        }
      }
      if (p.type === 'group_counts') {
        aroll.resetAfterBRoll();
        const gc = parseGroupCounts(p.text);
        if (gc) {
          lastDataTpl = gc.tpl;
          return Object.assign(base, motionFields(gc.tpl, {
            sets: gc.sets,
            visual: gc.visual,
          }, '分组对比柱随口播同步生长，高亮反常识的那一组'));
        }
      }
      if (p.type === 'split_contrast') {
        aroll.resetAfterBRoll();
        const sp = parseRhetoricalSplit(p.text);
        if (sp) {
          return Object.assign(base, motionFields('split', {
            left: sp.left,
            right: sp.right,
            visual: sp.visual,
          }, '前半句展示左半屏常态，转折词落音时滑杆扫过揭晓右半屏反差'));
        }
      }
      if (p.type === 'question') {
        aroll.resetAfterBRoll();
        const qLines = p.lines.map(stripEnd).map((l, i) => `${l}${/[?]$/.test(p.lines[i]) ? '?' : '？'}`);
        return Object.assign(base, motionFields('question', {
          lines: qLines,
          visual: '连续设问上屏',
        }, '每问卡口播起音依次打出，末问停顿半秒引发思考'));
      }
      if (p.type === 'relay') {
        aroll.resetAfterBRoll();
        return Object.assign(base, motionFields('relay', {
          lines: p.lines,
          visual: '并列短词接力排布',
        }, '顿号处逐词卡点顶替，收尾排成一行定格'));
      }
      if (p.type === 'data') {
        aroll.resetAfterBRoll();
        const parsed = P.parseCopy(p.text);
        if (parsed.count > 0) {
          const candidate = Object.assign({}, base, {groups: parsed.groups, cat: '数据动效'});
          const ranked = D.rankTemplates(candidate, lastDataTpl);
          const top = ranked[0];
          if (top) {
            lastDataTpl = top.id;
            return Object.assign(base, motionFields(top.id, {
              groups: parsed.groups,
              visual: (parsed.explain && parsed.explain.length ? parsed.explain.join('；') : '') || top.why,
            }, `用「${top.name}」呈现数据关系，数字落定对齐口播报数瞬间`));
          }
        }
        const series = D.parseSeries ? D.parseSeries(p.text) : null;
        if (series) {
          const candidate = Object.assign({}, base, series, {cat: '数据动效'});
          const top = D.rankTemplates(candidate, lastDataTpl).filter((t) => D.TEMPLATES[t.id].chart)[0];
          if (top) {
            lastDataTpl = top.id;
            return Object.assign(base, motionFields(top.id, Object.assign({}, series, {
              visual: top.why,
            }), `用「${top.name}」对比各项数值，关键项高亮落定`));
          }
        }
        return Object.assign(base, motionFields('statement', {
          lines: [stripEnd(p.text)],
          visual: '重音字幕（含待拆解数字）',
          note: '这句里有数字，规则未自动拆出结构，可手动换图表模板',
        }));
      }

      // 1. 判断是否属于外部资料素材（footage）或真机/实测场景实拍（shoot）
      const kindInfo = classifyNarrative(p.text);
      if (kindInfo.track === 'shoot' || kindInfo.track === 'footage') {
        aroll.resetAfterBRoll();
        const cat = kindInfo.track === 'footage' ? '素材' : '实拍';
        return Object.assign(base, kindInfo, {
          kind: 'B',
          cat,
          visual: `${kindInfo.shotSize} · ${kindInfo.subject}（${kindInfo.cameraMove}）`,
        });
      }

      // 2. 非第一人称的精炼短句（≤22字）若说到动效库具象词，配对应动效
      if (!FIRST_PERSON_RE.test(p.text) && lenOf(p.text) <= 22) {
        const hit = matchedMotion(Object.assign({}, base), p.text);
        if (hit) return hit;
      }

      // 3. 单句客观设问（不含第一人称主讲与转折词）且上一镜已是 A-roll：切问题卡动效
      if (p.type === 'single_question' && !FIRST_PERSON_RE.test(p.text) && !TURN_RE.test(p.text) && idx > 0) {
        const qLines = p.lines.map(stripEnd).map((l, i) => `${l}${/[?]$/.test(p.lines[i]) ? '?' : '？'}`);
        aroll.resetAfterBRoll();
        return Object.assign(base, motionFields('question', {
          lines: qLines,
          visual: '核心问题上屏',
        }, '切全屏问题卡打破连续口播，让观众聚焦核心追问'));
      }

      // 其余归入 A-roll 出镜：保持整段思考连贯，通过景别递进与双机位切换赋予呼吸感
      const nextARoll = aroll.next(p.text, isChapterFirst);
      if (!opts.whole && nextARoll.streak >= 3 && lenOf(p.text) <= 30 && !FIRST_PERSON_RE.test(p.text)) {
        aroll.resetAfterBRoll();
        return Object.assign(base, motionFields('statement', {
          lines: [stripEnd(p.text)],
          visual: '金句重音字幕上屏',
        }, '连续出镜后切全屏重音字幕做节奏呼吸，字随口播敲出'));
      }
      return Object.assign(base, nextARoll);
    });

    const first = lines.find(Boolean) || '';
    const counts = {
      aroll: rows.filter((r) => r.track === 'aroll').length,
      motion: rows.filter((r) => r.track === 'motion').length,
      shoot: rows.filter((r) => r.track === 'shoot').length,
      footage: rows.filter((r) => r.track === 'footage').length,
    };
    return {
      title: title || opts.title || (lenOf(first) <= 30 && !HEAD.test(first) ? stripEnd(first) : '新分镜表'),
      rows,
      stats: counts,
    };
  };

  const normalizeDirectorFields = (r) => {
    const track = D.shotTrack ? D.shotTrack(r) : (r.track || 'motion');
    r.track = track;
    if (track === 'aroll') {
      r.kind = 'A';
      r.cat = 'A-roll';
      r.shotSize = r.shotSize || '中景';
      r.cameraMove = r.cameraMove || '固定';
      r.subject = r.subject || '主讲人出镜';
      r.tpl = D.TEMPLATES[r.tpl] ? r.tpl : 'statement';
    } else if (track === 'shoot') {
      r.kind = 'B';
      r.cat = '实拍';
      r.shotSize = r.shotSize || '产品特写';
      r.cameraMove = r.cameraMove || '缓慢推轨';
      r.subject = r.subject || '实拍画面';
      r.tpl = D.TEMPLATES[r.tpl] ? r.tpl : 'statement';
    } else if (track === 'footage') {
      r.kind = 'B';
      r.cat = '素材';
      r.shotSize = r.shotSize || '全屏资料';
      r.cameraMove = r.cameraMove || '局部放大';
      r.subject = r.subject || '资料画面';
      r.tpl = D.TEMPLATES[r.tpl] ? r.tpl : 'statement';
    } else {
      r.track = 'motion';
      r.kind = 'B';
      const tpl = D.TEMPLATES[r.tpl];
      if (!r.cat || ['A-roll', '出镜', '实拍', '素材'].includes(r.cat)) {
        r.cat = tpl && (tpl.cat === 'percent' || tpl.cat === 'chart' || tpl.cat === 'fine') ? '数据动效' : ['kxi', 'kxs', 'kxm', 'button', 'toggle', 'loader'].includes(tpl && tpl.cat) ? '屏幕动效' : '文字动效';
      }
      r.shotSize = r.shotSize || '全屏动效';
      r.cameraMove = r.cameraMove || '帧内动画';
      // 预留待填数据位（如文稿写「具体占比我直接放屏幕上」或「XX%」）：允许保留选定图表模板并用样例渲染预览，标明待填
      if (r.pending && tpl && D.adopt) {
        const keepNote = r.note || '文稿此处预留数据位，填入真实数字后即可出片';
        const keepVis = r.visual;
        const adopted = D.adopt(Object.assign({}, r), r.tpl);
        Object.assign(r, adopted, {pending: true, note: keepNote});
        if (keepVis) r.visual = keepVis;
      }
    }
    if (!(r.lines && r.lines.length) && r.line) {
      const s = stripEnd(r.line);
      if (s) r.lines = [s];
    }
    if (!r.visual) {
      r.visual = track === 'motion'
        ? (D.TEMPLATES[r.tpl] ? D.TEMPLATES[r.tpl].name : '动效画面')
        : `${r.shotSize} · ${r.subject}（${r.cameraMove}）`;
    }
    return r;
  };

  const checkRow = (row, source) => {
    const problems = [];
    const isMotion = (D.shotTrack ? D.shotTrack(row) : (row.track || 'motion')) === 'motion';
    const tpl = D.TEMPLATES[row.tpl];
    if (isMotion && !tpl) problems.push(`没有「${row.tpl}」这个模板`);
    const srcN = P.normalizeText(source || '');
    const lineN = P.normalizeText(row.line || '');
    if (!lineN) problems.push('缺口播原文');
    else if (srcN && !srcN.includes(lineN)) problems.push('口播和文稿原文不一致');
    if (isMotion && row.tpl === 'cohort' && row.size > 14) {
      problems.push('cohort 每排最多 12 个点，人数较多请改用 attrition');
    }
    if (isMotion && !row.pending && !row.sampleData) {
      const render = D.motionRenderProblem(row);
      if (render) problems.push(render);
      problems.push(...D.numberProblems(D.motionData(row), row.tpl, source || row.line));
    } else if (!isMotion || tpl) {
      try {
        const raw = Object.assign({}, row, {template: row.tpl || 'statement'});
        const scene = D.createScene(raw, 320);
        const cv = document.createElement('canvas');
        cv.width = 320;
        cv.height = 180;
        const g = cv.getContext('2d', {alpha: false});
        if (g) scene.draw(g, scene.duration * 0.6);
      } catch (e) {
        problems.push(e.message);
      }
    }
    return problems;
  };

  const reviewRows = (rows, source) => {
    const issues = [];
    const out = rows.map((row, i) => {
      let r = Object.assign({}, row, {id: i + 1, no: String(i + 1).padStart(3, '0'), ch: row.ch || '正片'});
      // 样本人数由分镜口播识别，或由用户在检查器明确填写。
      delete r.sampleSize;
      const isMotion = (D.shotTrack ? D.shotTrack(r) : (r.track || 'motion')) === 'motion';
      let problems;
      try {
        if (isMotion && !r.pending) r = D.normalizeGeneratedMotion(r);
        r = normalizeDirectorFields(r);
        problems = checkRow(r, source);
      } catch (e) {
        problems = [e.message];
      }
      if (problems.length) {
        const fb = generate(r.line || '', {whole: true}).rows[0];
        issues.push({no: r.no, chapter: r.ch, template: D.TEMPLATES[r.tpl]?.name || r.tpl || '未指定动效', reasons: problems});
        const note = `AI 的结果用不了：${problems.join('；')}。已换成规则版，请确认`;
        if (fb) return Object.assign(fb, {id: r.id, no: r.no, ch: r.ch, line: r.line || fb.line, note});
        delete r.motion;
        delete r.motionInput;
        return Object.assign(r, {track: 'motion', tpl: 'statement', lines: r.line ? [stripEnd(r.line)] : r.lines, kind: 'B', cat: '文字动效', note});
      }
      return r;
    });
    // 覆盖率：文稿里有多少文字进了分镜，防止 AI 悄悄漏掉段落（章节标题不算漏字）
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
    return {rows: out, coverage: srcN.length ? Math.min(1, covered / srcN.length) : 1, flagged: issues.length, issues};
  };

  root.DMBoard = {generate, checkRow, reviewRows, normalizeDirectorFields};
})(window);
