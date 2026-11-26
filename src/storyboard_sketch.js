// 编导分镜 · 构图线框镜头示意（A-roll 出镜景别调度 / B-roll 实拍 / B-roll 素材）
// 不占 733 个动效库名额；当镜头 track 为 aroll / shoot / footage 时由 createScene 直接调用，支持预览、改时长、导出动态预演 MP4 与分镜单缩略图。
(function (root) {
  'use strict';
  const D = root.DM;
  const {clamp, lerp, progress, smooth, outCubic, hex, css} = D;

  const TRACKS = {
    aroll: {id: 'aroll', label: 'A-ROLL 出镜', short: 'A-roll', accentDark: '#E4F56B', accentPaper: '#1F6FEB'},
    motion: {id: 'motion', label: 'B-ROLL 动效', short: '动效', accentDark: '#FF5C1E', accentPaper: '#EE3A17'},
    shoot: {id: 'shoot', label: 'B-ROLL 实拍', short: '实拍', accentDark: '#FF8A33', accentPaper: '#D95B16'},
    footage: {id: 'footage', label: 'B-ROLL 素材', short: '素材', accentDark: '#5AC8FA', accentPaper: '#0969DA'},
  };

  // 兼容新旧分镜字段：旧文件没写 track 时按 cat / kind 判断，默认动效镜
  const shotTrack = (row) => {
    if (!row) return 'motion';
    const t = String(row.track || '').toLowerCase();
    if (TRACKS[t]) return t;
    if (row.cat === '实拍') return 'shoot';
    if (row.cat === '素材' || row.cat === '新闻素材') return 'footage';
    if (row.kind === 'A' || row.cat === 'A-roll' || row.cat === '出镜') return 'aroll';
    return 'motion';
  };

  const isSketchShot = (row) => shotTrack(row) !== 'motion';

  // 根据主体文本识别真实硬件品类，避免把头显、电视、电脑全画成四摄手机
  const detectDeviceKind = (row) => {
    const s = `${(row && row.subject) || ''} ${(row && row.visual) || ''} ${(row && row.line) || ''}`;
    if (/头显|眼镜|VR|MR|XR|PICO|Vision|头戴|头带|面罩|透视|眼动/i.test(s)) return 'headset';
    if (/电视|投影|客厅大屏|巨幕/i.test(s) && !/头显|PICO|头戴/i.test(s)) return 'tv';
    if (/笔记本|电脑|MacBook|键盘|显示器/i.test(s)) return 'laptop';
    if (/平板|iPad/i.test(s) && !/电视/.test(s)) return 'tablet';
    if (/手表|手环|戒指|耳机|耳塞|音箱|音响/i.test(s)) return 'wearable';
    return 'phone';
  };

  // 根据轨道、景别、运镜与主体自动挑选构图线框原型
  const inferSketchKind = (row) => {
    if (row && row.sketchKind) return row.sketchKind;
    const track = shotTrack(row);
    const size = String((row && row.shotSize) || '');
    const move = String((row && row.cameraMove) || '');
    const sub = `${(row && row.subject) || ''} ${(row && row.visual) || ''} ${(row && row.line) || ''}`;
    if (track === 'footage') return 'footage_doc';
    if (track === 'aroll') {
      if (/侧机位|B机|双机位|侧面/.test(size + move)) return 'host_side';
      if (/特写|近景/.test(size) && !/中近/.test(size)) return 'host_cu';
      if (/中近|跳切|推近/.test(size + move)) return 'host_mcu';
      return 'host_ms';
    }
    if (/对比|同框|并排|两款|两台|双机|AB|A\/B/i.test(size + sub)) return 'versus_two';
    if (/靠着|躺|沙发|卧室|试机|靠背|枕头|人物|场景|医院|家里|办公室|街头|门店|夜里|生活|跟拍|全景/.test(size + sub) && !/微距|产品特写/.test(size)) return 'person_scene';
    if (/俯拍|桌面|上手|滑动|点按|点击|打字|握持|手持操作|过肩|掐表|回.*微信|掏.*手机|上推/.test(size + sub)) return 'topdown_hands';
    return 'product_cu';
  };

  const sketchPalette = (row) => {
    const track = shotTrack(row);
    const meta = TRACKS[track] || TRACKS.shoot;
    const paper = row && row.theme === 'paper';
    const own = (row && row.colors) || {};
    const valid = (c, fb) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : fb);
    if (paper) {
      return {
        paper: true,
        bg: valid(own.bg, '#F2EFE8'),
        frameBg: '#FAF8F3',
        ink: valid(own.secondary, '#191A1D'),
        mute: 'rgba(25,26,29,0.58)',
        grid: 'rgba(25,26,29,0.13)',
        card: 'rgba(25,26,29,0.06)',
        accent: valid(own.primary, meta.accentPaper),
        badgeInk: '#FFFFFF',
      };
    }
    return {
      paper: false,
      bg: valid(own.bg, '#101114'),
      frameBg: '#16181D',
      ink: valid(own.secondary, '#F4F1EA'),
      mute: 'rgba(244,241,234,0.62)',
      grid: 'rgba(244,241,234,0.14)',
      card: 'rgba(255,255,255,0.06)',
      accent: valid(own.primary, meta.accentDark),
      badgeInk: track === 'aroll' ? '#121316' : '#101114',
    };
  };

  const roundRect = (c, x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  };

  const arrow = (c, x0, y0, x1, y1, head = 14) => {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 - head * Math.cos(ang - 0.45), y1 - head * Math.sin(ang - 0.45));
    c.lineTo(x1 - head * Math.cos(ang + 0.45), y1 - head * Math.sin(ang + 0.45));
    c.closePath();
    c.fill();
  };

  const cornerMarks = (c, x, y, w, h, len, color, width = 3) => {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    // 四角 L 标
    c.moveTo(x, y + len); c.lineTo(x, y); c.lineTo(x + len, y);
    c.moveTo(x + w - len, y); c.lineTo(x + w, y); c.lineTo(x + w, y + len);
    c.moveTo(x, y + h - len); c.lineTo(x, y + h); c.lineTo(x + len, y + h);
    c.moveTo(x + w - len, y + h); c.lineTo(x + w, y + h); c.lineTo(x + w, y + h - len);
    c.stroke();
    c.restore();
  };

  // 人物线框：scale 控制景别（中景 1.0 / 中近景 1.28 / 近景特写 1.68），turn 控制正侧面偏移
  const drawPerson = (c, cx, baseY, scale, turn, P) => {
    c.save();
    c.translate(cx, baseY);
    c.scale(scale, scale);
    c.strokeStyle = P.ink;
    c.fillStyle = P.paper ? 'rgba(25,26,29,0.05)' : 'rgba(244,241,234,0.06)';
    c.lineWidth = 3.2 / scale;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // 肩胸轮廓
    c.beginPath();
    c.moveTo(-210 + turn * 20, 220);
    c.quadraticCurveTo(-196 + turn * 15, 20, -82 + turn * 10, -10);
    c.lineTo(82 + turn * 10, -10);
    c.quadraticCurveTo(196 + turn * 15, 20, 210 + turn * 20, 220);
    c.fill();
    c.stroke();

    // 衣领与领夹麦
    c.beginPath();
    c.moveTo(-48 + turn * 12, -10);
    c.lineTo(6 + turn * 18, 66);
    c.lineTo(54 + turn * 12, -10);
    c.stroke();
    c.save();
    c.fillStyle = P.accent;
    c.beginPath();
    c.arc(28 + turn * 16, 44, 7 / scale * Math.min(scale, 1.3), 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 颈部
    c.beginPath();
    c.moveTo(-32 + turn * 8, -10);
    c.lineTo(-28 + turn * 8, -56);
    c.moveTo(32 + turn * 8, -10);
    c.lineTo(28 + turn * 8, -56);
    c.stroke();

    // 头部轮廓
    c.beginPath();
    c.ellipse(turn * 14, -148, 78, 98, turn * 0.06, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // 视线十字与眉眼水平线（标明朝向）
    c.strokeStyle = P.mute;
    c.lineWidth = 2 / scale;
    c.beginPath();
    c.moveTo(-52 + turn * 22, -156);
    c.lineTo(62 + turn * 26, -156);
    c.moveTo(6 + turn * 34, -196);
    c.lineTo(6 + turn * 34, -104);
    c.stroke();

    // 眼睛焦点
    c.fillStyle = P.accent;
    [-22, 30].forEach((ox) => {
      c.beginPath();
      c.arc(ox + turn * 28, -156, 4.5, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  };

  // 9 种构图线框绘制
  const drawSubjectSketch = (c, kind, box, u, row, P) => {
    const {x, y, w, h} = box;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const move = String(row.cameraMove || '');
    const pushK = /推/.test(move) ? lerp(0.96, 1.05, smooth(u)) : /拉/.test(move) ? lerp(1.06, 0.96, smooth(u)) : 1;
    const panX = /横移|右移|滑轨/.test(move) ? lerp(-28, 28, smooth(u)) : /左移/.test(move) ? lerp(28, -28, smooth(u)) : 0;

    c.save();
    roundRect(c, x, y, w, h, 14);
    c.clip();

    // 背景空间透视线（极淡）
    c.strokeStyle = P.grid;
    c.lineWidth = 1.5;
    if (kind.startsWith('host_') || kind === 'person_scene') {
      c.beginPath();
      c.moveTo(x, y + h * 0.78); c.lineTo(x + w, y + h * 0.78);
      c.moveTo(x + w * 0.16, y); c.lineTo(x + w * 0.16, y + h * 0.78);
      c.moveTo(x + w * 0.84, y); c.lineTo(x + w * 0.84, y + h * 0.78);
      c.stroke();
    }

    c.save();
    c.translate(cx + panX, cy);
    c.scale(pushK, pushK);
    c.translate(-cx, -cy);

    if (kind === 'host_ms') {
      drawPerson(c, cx, y + h * 0.73, 1.05, 0, P);
      cornerMarks(c, cx - 120, y + h * 0.2, 240, 240, 18, P.accent, 2.5);
    } else if (kind === 'host_mcu') {
      // A-roll 景别变动示意：外虚线框表示基准中景，内亮框表示跳切/推进后的中近景
      c.save();
      c.setLineDash([8, 6]);
      c.strokeStyle = P.mute;
      c.lineWidth = 2;
      c.strokeRect(x + 90, y + 48, w - 180, h - 96);
      c.setLineDash([]);
      c.font = `20px ${D.FONT_CN}`;
      c.fillStyle = P.mute;
      c.textAlign = 'left';
      c.fillText('基准中景 1.0×', x + 106, y + 80);
      c.restore();

      drawPerson(c, cx, y + h * 0.86, 1.38, 0, P);

      const ix = x + 250;
      const iy = y + 104;
      const iw = w - 500;
      const ih = h - 188;
      c.strokeStyle = P.accent;
      c.lineWidth = 2.6;
      c.strokeRect(ix, iy, iw, ih);
      c.fillStyle = P.accent;
      c.font = `21px ${D.FONT_CN}`;
      c.textAlign = 'left';
      c.fillText('变景别 · 中近景 1.2×', ix + 14, iy + 32);
      // 四角推进箭头
      c.strokeStyle = P.accent;
      c.lineWidth = 2.4;
      arrow(c, x + 120, y + 68, ix - 10, iy - 6, 11);
      arrow(c, x + w - 120, y + 68, ix + iw + 10, iy - 6, 11);
    } else if (kind === 'host_cu') {
      drawPerson(c, cx, y + h * 1.03, 1.82, 0, P);
      cornerMarks(c, cx - 150, y + h * 0.16, 300, 210, 22, P.accent, 3);
      c.fillStyle = P.accent;
      c.font = `20px ${D.FONT_CN}`;
      c.textAlign = 'center';
      c.fillText('眼部焦点 · 情绪重音', cx, y + h * 0.13);
    } else if (kind === 'host_side') {
      // 侧机位 B 机：人物偏左，右侧留视线空间，右上角画双机位俯视小图
      drawPerson(c, cx - 130, y + h * 0.84, 1.32, 1.15, P);
      c.save();
      c.strokeStyle = P.accent;
      c.fillStyle = P.accent;
      c.setLineDash([6, 6]);
      c.lineWidth = 2.2;
      arrow(c, cx - 40, y + h * 0.36, cx + 250, y + h * 0.36, 12);
      c.setLineDash([]);
      c.font = `20px ${D.FONT_CN}`;
      c.textAlign = 'left';
      c.fillText('视线留白（B 机 45° 侧切）', cx + 10, y + h * 0.33);
      // 右上双机位示意图
      const rx = x + w - 230, ry = y + 40;
      roundRect(c, rx, ry, 186, 118, 10);
      c.fillStyle = P.card;
      c.fill();
      c.strokeStyle = P.grid;
      c.stroke();
      c.fillStyle = P.ink;
      c.beginPath(); c.arc(rx + 93, ry + 42, 10, 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.mute;
      c.strokeRect(rx + 81, ry + 84, 24, 16);
      c.fillStyle = P.accent;
      c.fillRect(rx + 134, ry + 72, 26, 16);
      c.font = `16px ${D.FONT_CN}`;
      c.textAlign = 'center';
      c.fillStyle = P.mute; c.fillText('A机', rx + 93, ry + 112);
      c.fillStyle = P.accent; c.fillText('B机', rx + 147, ry + 102);
      c.restore();
    } else if (kind === 'product_cu') {
      const dev = detectDeviceKind(row);
      const subText = `${row.subject || ''} ${row.line || ''}`;
      if (dev === 'headset') {
        // 头显 / XR 眼镜 3/4 工业线框 + 后脑勺头带 + 分体外置盒与连线
        c.save();
        c.translate(cx - 70, cy + 8);
        c.strokeStyle = P.ink;
        c.fillStyle = P.paper ? 'rgba(25,26,29,0.05)' : 'rgba(244,241,234,0.06)';
        c.lineWidth = 3.4;
        // 前镜面弧形眼罩
        c.beginPath();
        c.moveTo(-210, -56);
        c.bezierCurveTo(-205, -135, 115, -135, 130, -56);
        c.bezierCurveTo(142, 24, 92, 82, 28, 76);
        c.quadraticCurveTo(-38, 44, -92, 76);
        c.bezierCurveTo(-158, 82, -216, 24, -210, -56);
        c.closePath();
        c.fill();
        c.stroke();
        // 双目透视摄像头开孔
        c.lineWidth = 2.4;
        [-132, 46].forEach((ox) => {
          c.beginPath(); c.arc(ox, -16, 16, 0, Math.PI * 2); c.stroke();
        });
        // 侧边镜腿与后脑勺环形配重头带
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(128, -32);
        c.bezierCurveTo(255, -56, 330, -28, 336, 18);
        c.bezierCurveTo(330, 68, 240, 82, 118, 42);
        c.stroke();
        // 外置计算盒与连接线
        const hasBox = /外置|盒|电池|计算|线|分摊|264/.test(subText);
        if (hasBox) {
          c.strokeStyle = P.accent;
          c.lineWidth = 2.8;
          c.beginPath();
          c.moveTo(96, 52);
          c.bezierCurveTo(145, 165, 225, 195, 290, 156);
          c.stroke();
          c.fillStyle = P.card;
          c.strokeStyle = P.ink;
          roundRect(c, 286, 94, 146, 108, 22);
          c.fill();
          c.stroke();
          c.fillStyle = P.accent;
          c.font = `18px ${D.FONT_CN}`;
          c.textAlign = 'center';
          c.fillText('外置盒', 359, 154);
        }
        c.restore();
        const fx = cx - 90, fy = cy - 110;
        cornerMarks(c, fx - 170, fy - 50, 340, 210, 20, P.accent, 3);
        c.fillStyle = P.accent;
        c.font = `20px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.fillText(hasBox ? '头显本体 + 分体外置盒特写' : '头显面罩与头带结构特写', fx - 166, fy - 64);
      } else if (dev === 'tv' || dev === 'laptop' || dev === 'tablet') {
        // 横屏大屏 / 笔记本 / 平板线框
        c.save();
        c.strokeStyle = P.ink;
        c.fillStyle = P.paper ? 'rgba(25,26,29,0.05)' : 'rgba(244,241,234,0.06)';
        c.lineWidth = 3.4;
        const ww = dev === 'tv' ? 560 : 440;
        const hh = dev === 'tv' ? 320 : 280;
        roundRect(c, cx - ww / 2, cy - hh / 2 - 16, ww, hh, dev === 'tv' ? 10 : 20);
        c.fill();
        c.stroke();
        if (dev === 'laptop') {
          c.beginPath();
          c.moveTo(cx - ww * 0.62, cy + hh / 2 - 16);
          c.lineTo(cx + ww * 0.62, cy + hh / 2 - 16);
          c.lineTo(cx + ww * 0.54, cy + hh / 2 + 20);
          c.lineTo(cx - ww * 0.54, cy + hh / 2 + 20);
          c.closePath();
          c.stroke();
        } else if (dev === 'tv') {
          c.beginPath();
          c.moveTo(cx - 90, cy + hh / 2 - 16); c.lineTo(cx - 120, cy + hh / 2 + 34);
          c.moveTo(cx + 90, cy + hh / 2 - 16); c.lineTo(cx + 120, cy + hh / 2 + 34);
          c.stroke();
        }
        c.restore();
        cornerMarks(c, cx - 180, cy - 120, 360, 210, 20, P.accent, 3);
      } else if (dev === 'wearable') {
        c.save();
        c.strokeStyle = P.ink;
        c.fillStyle = P.paper ? 'rgba(25,26,29,0.05)' : 'rgba(244,241,234,0.06)';
        c.lineWidth = 3.4;
        c.beginPath(); c.arc(cx, cy, 130, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.arc(cx, cy, 92, 0, Math.PI * 2); c.stroke();
        c.restore();
        cornerMarks(c, cx - 160, cy - 160, 320, 320, 20, P.accent, 3);
      } else {
        // 手机 3/4 特写 + 镜头模组 + 侧逆光 + 微距焦点框
        c.save();
        c.translate(cx - 30, cy + 10);
        c.rotate(-0.14);
        c.strokeStyle = P.ink;
        c.fillStyle = P.paper ? 'rgba(25,26,29,0.05)' : 'rgba(244,241,234,0.06)';
        c.lineWidth = 3.4;
        roundRect(c, -135, -245, 270, 490, 34);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(135, -215); c.lineTo(154, -202); c.lineTo(154, 232); c.lineTo(135, 245);
        c.stroke();
        c.lineWidth = 2.8;
        c.beginPath(); c.arc(0, -110, 78, 0, Math.PI * 2); c.stroke();
        [[-28, -132], [28, -132], [-28, -82], [28, -82]].forEach(([lx, ly]) => {
          c.beginPath(); c.arc(lx, ly, 18, 0, Math.PI * 2); c.stroke();
        });
        c.restore();
        const fx = cx + 60, fy = cy - 150;
        cornerMarks(c, fx - 75, fy - 65, 190, 140, 20, P.accent, 3);
        c.fillStyle = P.accent;
        c.font = `20px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.fillText('特写焦点 · 侧逆光勾边', fx - 70, fy - 78);
        c.strokeStyle = P.accent;
        c.lineWidth = 2.2;
        arrow(c, x + w - 120, y + 84, fx + 95, fy - 35, 12);
      }
    } else if (kind === 'topdown_hands') {
      const dev = detectDeviceKind(row);
      const subText = `${row.subject || ''} ${row.line || ''}`;
      c.strokeStyle = P.grid;
      c.lineWidth = 2;
      c.strokeRect(x + 120, y + 54, w - 240, h - 108);
      if (dev === 'headset') {
        // 过肩佩戴 / 透视看手机 / 掐表开播实操示意
        const seePhone = /手机|微信|透视|上推/.test(subText);
        c.strokeStyle = P.ink;
        c.fillStyle = P.card;
        c.lineWidth = 3.2;
        // 前景或头戴视窗轮廓
        roundRect(c, cx - 290, cy - 185, 580, 240, 64);
        c.fill();
        c.stroke();
        c.strokeStyle = P.accent;
        c.setLineDash([8, 6]);
        roundRect(c, cx - 250, cy - 155, 500, 180, 44);
        c.stroke();
        c.setLineDash([]);
        if (seePhone) {
          // 透视视野下看清手里的手机消息
          c.strokeStyle = P.ink;
          c.fillStyle = P.frameBg;
          roundRect(c, cx - 72, cy - 30, 144, 240, 20);
          c.fill();
          c.stroke();
          c.fillStyle = P.accent;
          roundRect(c, cx - 50, cy + 16, 100, 26, 8); c.fill();
          roundRect(c, cx - 50, cy + 56, 84, 26, 8); c.fill();
        }
        c.fillStyle = P.accent;
        c.font = `20px ${D.FONT_CN}`;
        c.textAlign = 'center';
        c.fillText(seePhone ? '第一视角 / 过肩实测：戴头显透视看清手机回消息' : '实操计时：从拿起头显、语音搜片到正片出声', cx, y + 92);
      } else {
        // 桌面俯拍：居中屏幕 + 双手拇指交互轨迹
        c.strokeStyle = P.ink;
        c.fillStyle = P.paper ? 'rgba(25,26,29,0.05)' : 'rgba(244,241,234,0.07)';
        c.lineWidth = 3.2;
        roundRect(c, cx - 115, cy - 215, 230, 430, 28);
        c.fill();
        c.stroke();
        roundRect(c, cx - 101, cy - 196, 202, 392, 18);
        c.strokeStyle = P.mute;
        c.lineWidth = 1.8;
        c.stroke();
        for (let i = 0; i < 4; i++) {
          roundRect(c, cx - 78, cy - 150 + i * 62, 156, 38, 8);
          c.stroke();
        }
        c.strokeStyle = P.ink;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(cx - 280, y + h); c.quadraticCurveTo(cx - 210, cy + 40, cx - 118, cy + 30);
        c.moveTo(cx + 280, y + h); c.quadraticCurveTo(cx + 200, cy + 20, cx + 38, cy + 16);
        c.stroke();
        const tapY = cy + lerp(44, -42, smooth(u));
        c.strokeStyle = P.accent;
        c.fillStyle = P.accent;
        c.lineWidth = 2.6;
        c.beginPath(); c.arc(cx + 24, tapY, 22, 0, Math.PI * 2); c.stroke();
        arrow(c, cx + 24, cy + 56, cx + 24, cy - 52, 11);
        c.font = `20px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.fillText('俯拍 / 过肩实操演示', cx + 145, cy - 150);
      }
    } else if (kind === 'versus_two') {
      const dev = detectDeviceKind(row);
      c.strokeStyle = P.grid;
      c.setLineDash([8, 8]);
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, y + 40); c.lineTo(cx, y + h - 40); c.stroke();
      c.setLineDash([]);

      [-260, 260].forEach((dx, idx) => {
        c.strokeStyle = idx === 0 ? P.ink : P.accent;
        c.fillStyle = P.card;
        c.lineWidth = 3.2;
        if (dev === 'headset') {
          roundRect(c, cx + dx - 165, cy - 110, 330, 175, 48);
        } else {
          roundRect(c, cx + dx - 105, cy - 195, 210, 390, 26);
        }
        c.fill();
        c.stroke();
        c.fillStyle = idx === 0 ? P.ink : P.accent;
        c.font = `bold 32px ${D.FONT_CN}`;
        c.textAlign = 'center';
        c.fillText(idx === 0 ? '对照屏 / 旧款' : '实测样机', cx + dx, dev === 'headset' ? cy + 125 : cy + 12);
      });
      c.fillStyle = P.accent;
      c.font = `21px ${D.FONT_CN}`;
      c.textAlign = 'center';
      c.fillText('同片源 / 同条件实拍对比', cx, y + 66);
    } else if (kind === 'person_scene') {
      const dev = detectDeviceKind(row);
      const subText = `${row.subject || ''} ${row.line || ''}`;
      if (dev === 'headset') {
        // 靠坐沙发 / 深夜卧床戴头显长时观影实拍示意（突出沙发靠背/枕头对后脑勺头带的支撑与外置盒走线）
        c.strokeStyle = P.mute;
        c.lineWidth = 2.6;
        // 沙发靠背或床头软包轮廓
        roundRect(c, x + 220, y + h * 0.34, 210, 280, 36);
        c.stroke();
        c.beginPath();
        c.moveTo(x + 200, y + h * 0.76);
        c.lineTo(x + w - 200, y + h * 0.76);
        c.stroke();
        drawPerson(c, cx - 40, y + h * 0.76, 0.96, 0.75, P);
        // 人物面部戴着的头显面罩与后脑勺头带焦点
        c.fillStyle = P.accent;
        roundRect(c, cx - 22, y + h * 0.76 - 168, 78, 38, 12);
        c.fill();
        cornerMarks(c, cx - 125, y + h * 0.76 - 190, 105, 84, 14, P.accent, 2.5);
        // 虚拟巨幕投影锥线
        c.strokeStyle = P.accent;
        c.setLineDash([7, 7]);
        c.beginPath();
        c.moveTo(cx + 58, y + h * 0.76 - 150);
        c.lineTo(x + w - 250, y + 110);
        c.moveTo(cx + 58, y + h * 0.76 - 142);
        c.lineTo(x + w - 250, y + 430);
        c.stroke();
        c.setLineDash([]);
        roundRect(c, x + w - 250, y + 106, 26, 330, 6);
        c.stroke();
        c.fillStyle = P.accent;
        c.font = `20px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.fillText(/夜|睡|关.*灯|卧室/.test(subText) ? '暗光卧室实拍 · 不开大灯躺看巨幕' : '居家靠坐实拍 · 后脑勺头带贴合与外置盒走线', x + 150, y + 64);
      } else {
        // 环境人物生活场景：左侧窗光框，右侧人物与桌面器物
        c.strokeStyle = P.mute;
        c.lineWidth = 2.2;
        c.strokeRect(x + 150, y + 86, 260, 280);
        c.beginPath();
        c.moveTo(x + 280, y + 86); c.lineTo(x + 280, y + 366);
        c.moveTo(x + 150, y + 226); c.lineTo(x + 410, y + 226);
        c.stroke();
        c.strokeStyle = P.ink;
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(x + 360, y + h * 0.74); c.lineTo(x + w - 140, y + h * 0.74); c.stroke();
        drawPerson(c, cx + 150, y + h * 0.74, 0.92, -0.8, P);
        roundRect(c, cx - 30, y + h * 0.74 - 72, 96, 68, 8);
        c.strokeStyle = P.accent;
        c.stroke();
        c.fillStyle = P.accent;
        c.font = `20px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.fillText('场景实拍 · 自然环境光', x + 150, y + 64);
      }
    } else {
      // footage_doc：新闻报道 / 论文报告 / 录屏资料卡
      const dx = cx - 430, dy = cy - 220, dw = 860, dh = 440;
      c.fillStyle = P.card;
      c.strokeStyle = P.ink;
      c.lineWidth = 2.8;
      roundRect(c, dx, dy, dw, dh, 16);
      c.fill();
      c.stroke();
      // 窗口顶栏
      c.beginPath(); c.moveTo(dx, dy + 52); c.lineTo(dx + dw, dy + 52); c.stroke();
      [0, 1, 2].forEach((i) => {
        c.fillStyle = i === 0 ? P.accent : P.mute;
        c.beginPath(); c.arc(dx + 28 + i * 22, dy + 26, 6, 0, Math.PI * 2); c.fill();
      });
      // 标题横条与高亮引用区
      c.fillStyle = P.ink;
      roundRect(c, dx + 48, dy + 86, 480, 26, 6); c.fill();
      c.fillStyle = css(hex(P.accent), P.paper ? 0.18 : 0.24);
      roundRect(c, dx + 44, dy + 140, dw - 88, 92, 10); c.fill();
      c.strokeStyle = P.accent;
      c.lineWidth = 2.4;
      c.stroke();
      c.fillStyle = P.accent;
      roundRect(c, dx + 64, dy + 166, dw - 160, 16, 4); c.fill();
      roundRect(c, dx + 64, dy + 196, dw - 280, 16, 4); c.fill();
      // 正文示意灰条
      c.fillStyle = P.grid;
      for (let i = 0; i < 4; i++) {
        roundRect(c, dx + 48, dy + 262 + i * 34, dw - (i === 3 ? 320 : 120), 12, 4);
        c.fill();
      }
      c.fillStyle = P.accent;
      c.font = `20px ${D.FONT_CN}`;
      c.textAlign = 'right';
      c.fillText('外部资料 / 报道截图 · 标明原始出处', dx + dw - 24, dy + 33);
    }
    c.restore();

    // 通用运镜方向大标识（若运镜为横移或俯仰，在画框底部/侧边画运镜轨）
    if (/横移|滑轨|右移|左移/.test(move)) {
      c.strokeStyle = P.accent;
      c.fillStyle = P.accent;
      c.lineWidth = 3;
      const left = /左移/.test(move);
      arrow(c, left ? cx + 180 : cx - 180, y + h - 34, left ? cx - 180 : cx + 180, y + h - 34, 14);
    } else if (/上摇|下摇|俯仰/.test(move)) {
      c.strokeStyle = P.accent;
      c.fillStyle = P.accent;
      c.lineWidth = 3;
      const up = /上摇/.test(move);
      arrow(c, x + w - 54, up ? cy + 120 : cy - 120, x + w - 54, up ? cy - 120 : cy + 120, 14);
    }

    c.restore();
  };

  const defaultShotSize = (track) => (track === 'aroll' ? '中景' : track === 'footage' ? '全屏资料' : '产品特写');
  const defaultCameraMove = (track) => (track === 'aroll' ? '固定' : track === 'footage' ? '局部放大' : '缓慢推轨');

  const createSketchScene = (row, S) => {
    void S;
    const track = shotTrack(row);
    const meta = TRACKS[track] || TRACKS.shoot;
    const P = sketchPalette(row);
    const kind = inferSketchKind(row);
    const shotSize = row.shotSize || defaultShotSize(track);
    const cameraMove = row.cameraMove || defaultCameraMove(track);
    const subject = row.subject || (track === 'aroll' ? '主讲人出镜' : track === 'footage' ? '资料画面' : '实拍主体');
    const shootGuide = row.shootGuide || row.visual || (track === 'aroll' ? `${shotSize}平视机位，眼神看镜头` : track === 'footage' ? '准备原始高清截图或视频片段，核对日期与出处' : `按${shotSize}构图实拍，注意光线层次`);
    const postGuide = row.postGuide || (track === 'aroll' ? '卡口播气口剪辑，重音词切准' : '画面先入或对齐重音词切入，留足动作起止');
    const cleanLine = String(row.line || '').trim();
    const silent = !cleanLine || /^[(（]?(不说话|留白|空镜|停顿)[)）]?$/.test(cleanLine);
    let speechDur = 2.6;
    if (!silent) {
      try {
        speechDur = Math.max(2.0, D.speechOf(row).dur);
      } catch (e) {
        speechDur = Math.max(2.0, Array.from(cleanLine).length / 4.8);
      }
    }
    const dur = speechDur + (row.hold != null ? +row.hold : silent ? 0 : 0.8);

    const frame = {x: 160, y: 108, w: 1600, h: 684};

    const draw = (c, t0) => {
      c.bg();
      c.fillStyle = P.bg;
      c.fillRect(0, 0, 1920, 1080);

      const u = clamp(t0 / Math.max(0.5, dur), 0, 1);

      // 1. 顶部导演状态栏
      c.el('header', '镜头标签');
      const badgeText = `${meta.label}  ·  ${shotSize}  ·  ${cameraMove}`;
      c.font = `bold 24px ${D.FONT_CN}`;
      const bw = Math.max(280, c.measureText(badgeText).width + 44);
      c.fillStyle = P.accent;
      roundRect(c, 160, 38, bw, 48, 24);
      c.fill();
      c.fillStyle = P.badgeInk;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(badgeText, 182, 62);

      // 右侧镜号、章节、主体与秒数
      c.fillStyle = P.mute;
      c.font = `23px ${D.FONT_CN}`;
      c.textAlign = 'right';
      const rightMeta = [`镜 ${row.no || '001'}`, row.ch || '正片', `主体：${subject}`, `${dur.toFixed(1)}s`].filter(Boolean).join('   ·   ');
      c.fillText(rightMeta, 1760, 62);

      // 2. 中央 16:9 监视器取景框 + 三分法辅助线 + 构图线框
      const tf = c.el('viewfinder', '构图示意框');
      const fu = clamp(tf / Math.max(0.5, dur), 0, 1);
      c.fillStyle = P.frameBg;
      roundRect(c, frame.x, frame.y, frame.w, frame.h, 14);
      c.fill();
      c.strokeStyle = P.grid;
      c.lineWidth = 2;
      c.stroke();

      // 三分法九宫格虚线
      c.save();
      c.strokeStyle = P.grid;
      c.setLineDash([6, 8]);
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(frame.x + frame.w / 3, frame.y); c.lineTo(frame.x + frame.w / 3, frame.y + frame.h);
      c.moveTo(frame.x + (frame.w * 2) / 3, frame.y); c.lineTo(frame.x + (frame.w * 2) / 3, frame.y + frame.h);
      c.moveTo(frame.x, frame.y + frame.h / 3); c.lineTo(frame.x + frame.w, frame.y + frame.h / 3);
      c.moveTo(frame.x, frame.y + (frame.h * 2) / 3); c.lineTo(frame.x + frame.w, frame.y + (frame.h * 2) / 3);
      c.stroke();
      c.restore();

      // 中心十字准星与安全四角
      c.strokeStyle = P.grid;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(960 - 14, frame.y + frame.h / 2); c.lineTo(960 + 14, frame.y + frame.h / 2);
      c.moveTo(960, frame.y + frame.h / 2 - 14); c.lineTo(960, frame.y + frame.h / 2 + 14);
      c.stroke();
      cornerMarks(c, frame.x + 22, frame.y + 20, frame.w - 44, frame.h - 40, 26, P.mute, 2.2);

      // 主体线框
      drawSubjectSketch(c, kind, frame, fu, row, P);

      // 3. 底部拍摄指导 & 后期导演双栏卡
      c.el('guides', '拍摄与后期指导');
      const gy = 810, gh = 114, gw = 786;
      [
        {x: 160, tag: track === 'footage' ? '素材要求' : '拍摄指导', body: shootGuide},
        {x: 974, tag: '后期导演', body: postGuide},
      ].forEach((box) => {
        c.fillStyle = P.card;
        roundRect(c, box.x, gy, gw, gh, 12);
        c.fill();
        c.fillStyle = P.accent;
        c.font = `bold 20px ${D.FONT_CN}`;
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText(box.tag, box.x + 20, gy + 16);
        const wrapped = D.wrapText(String(box.body || ''), gw - 40, 23, 18, 2);
        c.fillStyle = P.ink;
        c.font = `${wrapped.size}px ${D.FONT_CN}`;
        wrapped.lines.forEach((ln, idx) => {
          c.fillText(ln, box.x + 20, gy + 46 + idx * (wrapped.size * 1.28));
        });
      });

      // 4. 口播台词同步走字条
      c.el('subtitle', '口播台词', D.TEXT);
      const sy = 942;
      const lineShow = silent ? '（留白 / 无口播）' : cleanLine;
      const subWrap = D.wrapText(lineShow, 1560, 28, 20, 2);
      c.font = `${subWrap.size}px ${D.FONT_CN}`;
      c.textAlign = 'center';
      c.textBaseline = 'top';
      // 走字进度高亮条
      c.fillStyle = P.grid;
      roundRect(c, 160, 1040, 1600, 5, 2.5);
      c.fill();
      c.fillStyle = P.accent;
      roundRect(c, 160, 1040, Math.max(8, 1600 * u), 5, 2.5);
      c.fill();

      subWrap.lines.forEach((ln, idx) => {
        c.fillStyle = silent ? P.mute : P.ink;
        c.fillText(ln, 960, sy + idx * (subWrap.size * 1.32));
      });
    };

    return {duration: dur, draw};
  };

  const sketchColorRoles = (row) => {
    const P = sketchPalette(row);
    const own = (row && row.colors) || {};
    const ok = (k) => /^#[0-9a-f]{6}$/i.test(own[k] || '');
    return [
      {key: 'bg', name: '底色', value: P.bg, custom: ok('bg')},
      {key: 'primary', name: '标记色', value: P.accent, custom: ok('primary')},
      {key: 'secondary', name: '线框色', value: P.ink, custom: ok('secondary')},
    ];
  };

  Object.assign(D, {
    TRACKS,
    shotTrack,
    isSketchShot,
    inferSketchKind,
    createSketchScene,
    sketchColorRoles,
  });
})(window);
