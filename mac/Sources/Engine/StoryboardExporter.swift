import Foundation

// 导出离线自包含的单文件《分镜板与拍摄清单 HTML》：
// 内嵌每镜 16:9 构图线框示意或动效关键帧，含「全片分镜板」「现场拍摄与素材单（可打勾）」「后期顺片表」三视图，支持投屏与 A4 打印。
enum StoryboardExporter {
    static func buildHTML(board: Board, shots: [Shot], stage: StageController, names: [String: String], onProgress: ((Double) -> Void)? = nil) async -> String {
        let durations = await stage.durations(shots)
        var thumbs: [Shot.ID: String] = [:]
        for (idx, shot) in shots.enumerated() {
            if let url = await stage.shotDataURL(shot, width: 480) {
                thumbs[shot.id] = url
            }
            onProgress?(Double(idx + 1) / Double(max(1, shots.count)))
        }

        let totalSec = shots.reduce(0.0) { $0 + ($1.duration ?? durations[$1.id] ?? 3.0) }
        let arollShots = shots.filter { $0.track == "aroll" }
        let motionShots = shots.filter { $0.track == "motion" }
        let shootShots = shots.filter { $0.track == "shoot" }
        let footageShots = shots.filter { $0.track == "footage" }

        struct EncodedShot: Encodable {
            let id: Int
            let no: String
            let ch: String
            let track: String
            let trackLabel: String
            let shotSize: String
            let cameraMove: String
            let subject: String
            let tplName: String
            let line: String
            let visual: String
            let shootGuide: String
            let postGuide: String
            let note: String
            let sec: Double
            let startSec: Double
            let thumb: String
        }

        var running = 0.0
        var encoded: [EncodedShot] = []
        for s in shots {
            let d = s.duration ?? durations[s.id] ?? 3.0
            let tplName = s.isMotion ? (names[s.template] ?? s.template) : s.timelineCaption(names: names)
            encoded.append(EncodedShot(
                id: s.id,
                no: s.no,
                ch: s.chapter,
                track: s.track,
                trackLabel: s.trackLabel,
                shotSize: s.shotSize,
                cameraMove: s.cameraMove,
                subject: s.subject,
                tplName: tplName,
                line: s.line,
                visual: s.visual,
                shootGuide: s.shootGuide.isEmpty ? s.visual : s.shootGuide,
                postGuide: s.postGuide,
                note: s.note,
                sec: (d * 10).rounded() / 10,
                startSec: (running * 10).rounded() / 10,
                thumb: thumbs[s.id] ?? ""
            ))
            running += d
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        let rowsJSON = (try? encoder.encode(encoded)).map { String(decoding: $0, as: UTF8.self) } ?? "[]"
        let safeTitle = escapeHTML(board.title.isEmpty ? "分镜与拍摄清单" : board.title)
        let storageKey = "dm_shoot_check_\(board.title)"

        return """
        <!doctype html>
        <html lang="zh-CN">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>\(safeTitle) · 分镜与拍摄清单</title>
        <style>
        :root{--bg:#F5F3EE;--card:#FFFFFF;--ink:#18191C;--mute:#64625D;--line:rgba(24,25,28,.1);--aroll:#1F6FEB;--motion:#E04622;--shoot:#D96B16;--footage:#0969DA}
        *{box-sizing:border-box}
        body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif;font-size:14px;line-height:1.55}
        header{max-width:1360px;margin:0 auto;padding:28px 24px 16px}
        .headTop{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
        h1{margin:0;font-size:26px;font-weight:700;letter-spacing:-.01em}
        .meta{color:var(--mute);font-size:13px;font-variant-numeric:tabular-nums}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:16px}
        .stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
        .stat b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
        .stat span{font-size:12px;color:var(--mute)}
        .bar{position:sticky;top:0;z-index:5;background:rgba(245,243,238,.92);backdrop-filter:blur(14px);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
        .barIn{max-width:1360px;margin:0 auto;padding:10px 24px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .tabs,.filters{display:flex;gap:6px;flex-wrap:wrap}
        button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:5px 12px;border-radius:99px;cursor:pointer;font-size:13px}
        button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
        .search{margin-left:auto;border:1px solid var(--line);background:var(--card);border-radius:99px;padding:5px 12px;font:inherit;font-size:13px;min-width:190px}
        main{max-width:1360px;margin:0 auto;padding:20px 24px 60px}
        h2{margin:26px 0 12px;font-size:17px;display:flex;align-items:baseline;gap:8px}
        h2 small{color:var(--mute);font-weight:400;font-size:13px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
        .shot{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;break-inside:avoid}
        .thumb{position:relative;aspect-ratio:16/9;background:#101114}
        .thumb img{width:100%;height:100%;object-fit:cover;display:block}
        .badge{position:absolute;left:8px;top:8px;display:flex;gap:5px;align-items:center;background:rgba(0,0,0,.68);color:#fff;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
        .tag{padding:1px 7px;border-radius:99px;color:#fff;font-size:11px;font-weight:600}
        .t-aroll{background:var(--aroll)}.t-motion{background:var(--motion)}.t-shoot{background:var(--shoot)}.t-footage{background:var(--footage)}
        .dur{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.68);color:#fff;padding:2px 7px;border-radius:5px;font-size:11px;font-variant-numeric:tabular-nums}
        .body{padding:12px;display:flex;flex-direction:column;gap:8px;flex:1}
        .spec{font-size:12px;color:var(--mute);font-weight:500}
        .line{margin:0;font-size:14px;font-weight:500}
        .guides{margin-top:auto;padding-top:8px;border-top:1px dashed var(--line);font-size:12px;color:var(--mute);display:flex;flex-direction:column;gap:4px}
        .guides b{color:var(--ink);font-weight:600}
        .note{background:#FFF4E5;color:#9A5B00;padding:5px 8px;border-radius:6px;font-size:12px}
        table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
        th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:13px}
        th{background:rgba(24,25,28,.03);font-weight:600;color:var(--mute);white-space:nowrap}
        tr.done td{opacity:.48;text-decoration:line-through}
        .num{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--mute)}
        @media print{.bar{display:none}body{background:#fff}header,main{max-width:none;padding:10px 0}.grid{grid-template-columns:repeat(2,1fr)}}
        </style>
        </head>
        <body>
        <header>
          <div class="headTop">
            <div>
              <h1>\(safeTitle)</h1>
              <div class="meta">共 \(shots.count) 镜 · 预估总长 \(formatClock(totalSec)) · 可双击离线审阅或按 ⌘P 打印场记单</div>
            </div>
            <button onclick="window.print()">打印 / 存 PDF</button>
          </div>
          <div class="stats">
            <div class="stat"><b>\(arollShots.count) 镜</b><span>A-roll 出镜（含景别切换）</span></div>
            <div class="stat"><b>\(motionShots.count) 镜</b><span>B-roll 动效（动效库直出）</span></div>
            <div class="stat"><b>\(shootShots.count) 镜</b><span>B-roll 实拍（产品 / 人物 / 操作）</span></div>
            <div class="stat"><b>\(footageShots.count) 镜</b><span>B-roll 素材（资料 / 报道 / 录屏）</span></div>
          </div>
        </header>
        <div class="bar">
          <div class="barIn">
            <div class="tabs" id="tabs">
              <button data-v="board" class="on">分镜板</button>
              <button data-v="shoot">拍摄与素材单</button>
              <button data-v="edit">后期顺片表</button>
            </div>
            <div class="filters" id="filters">
              <button data-f="all" class="on">全部</button>
              <button data-f="aroll">A-roll</button>
              <button data-f="motion">动效</button>
              <button data-f="shoot">实拍</button>
              <button data-f="footage">素材</button>
            </div>
            <input class="search" id="q" type="search" placeholder="搜台词、景别、主体…">
          </div>
        </div>
        <main id="app"></main>
        <script>
        const ROWS = \(rowsJSON);
        const KEY = \(jsonString(storageKey));
        let view = 'board', filter = 'all', query = '';
        let checked = {};
        try { checked = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
        const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
        const clk = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        const hit = (r) => {
          if (filter !== 'all' && r.track !== filter) return false;
          if (!query) return true;
          return [r.no, r.ch, r.line, r.shotSize, r.cameraMove, r.subject, r.shootGuide, r.postGuide, r.tplName].join(' ').toLowerCase().includes(query.toLowerCase());
        };
        const render = () => {
          const list = ROWS.filter(hit);
          const box = document.getElementById('app');
          if (view === 'board') {
            const chs = [...new Set(list.map((r) => r.ch))];
            box.innerHTML = chs.map((ch) => {
              const items = list.filter((r) => r.ch === ch);
              return `<h2>${esc(ch)} <small>${items.length} 镜</small></h2><div class="grid">${items.map((r) => `
                <article class="shot">
                  <div class="thumb">
                    ${r.thumb ? `<img src="${r.thumb}" alt="镜 ${esc(r.no)}">` : ''}
                    <div class="badge"><span>${esc(r.no)}</span><span class="tag t-${esc(r.track)}">${esc(r.trackLabel)}</span></div>
                    <div class="dur">${clk(r.startSec)} · ${r.sec.toFixed(1)}s</div>
                  </div>
                  <div class="body">
                    <div class="spec">${esc(r.track === 'motion' ? `动效：${r.tplName}` : [r.shotSize, r.cameraMove, r.subject].filter(Boolean).join(' · '))}</div>
                    <p class="line">${esc(r.line || '（无口播）')}</p>
                    ${r.note ? `<div class="note">待确认：${esc(r.note)}</div>` : ''}
                    <div class="guides">
                      ${r.shootGuide ? `<div><b>${r.track === 'footage' ? '素材' : r.track === 'motion' ? '画面' : '拍摄'}：</b>${esc(r.shootGuide)}</div>` : ''}
                      ${r.postGuide ? `<div><b>后期：</b>${esc(r.postGuide)}</div>` : ''}
                    </div>
                  </div>
                </article>`).join('')}</div>`;
            }).join('') || '<p style="color:var(--mute)">没有符合筛选条件的镜头。</p>';
            return;
          }
          if (view === 'shoot') {
            const groups = [
              ['B-roll 实拍补镜单（现场逐条打勾）', list.filter((r) => r.track === 'shoot')],
              ['A-roll 出镜景别与机位单', list.filter((r) => r.track === 'aroll')],
              ['外部资料与素材准备单', list.filter((r) => r.track === 'footage')],
            ];
            box.innerHTML = groups.map(([title, items]) => !items.length ? '' : `
              <h2>${esc(title)} <small>${items.length} 条</small></h2>
              <table><thead><tr><th style="width:36px">完成</th><th>镜号</th><th>景别 / 运镜</th><th>拍摄主体</th><th>拍摄 / 素材要求</th><th>对应口播</th></tr></thead>
              <tbody>${items.map((r) => `<tr class="${checked[r.id] ? 'done' : ''}">
                <td><input type="checkbox" data-check="${r.id}" ${checked[r.id] ? 'checked' : ''}></td>
                <td class="num">${esc(r.no)}<br><small>${esc(r.ch)}</small></td>
                <td><b>${esc(r.shotSize || '-')}</b><br><span class="num">${esc(r.cameraMove || '')}</span></td>
                <td>${esc(r.subject || '-')}</td>
                <td>${esc(r.shootGuide)}</td>
                <td>${esc(r.line)}</td>
              </tr>`).join('')}</tbody></table>`).join('') || '<p style="color:var(--mute)">当前筛选下没有需要实拍或准备素材的镜头。</p>';
            box.querySelectorAll('[data-check]').forEach((el) => {
              el.onchange = () => {
                checked[el.dataset.check] = el.checked;
                try { localStorage.setItem(KEY, JSON.stringify(checked)); } catch (e) {}
                render();
              };
            });
            return;
          }
          box.innerHTML = `<h2>全片后期顺片表 <small>${list.length} 镜</small></h2>
            <table><thead><tr><th>时间码</th><th>镜号</th><th>轨道</th><th>动效 / 景别</th><th>口播原文</th><th>后期剪辑与画面说明</th></tr></thead>
            <tbody>${list.map((r) => `<tr>
              <td class="num">${clk(r.startSec)}<br>${r.sec.toFixed(1)}s</td>
              <td class="num">${esc(r.no)}</td>
              <td><span class="tag t-${esc(r.track)}">${esc(r.trackLabel)}</span></td>
              <td>${esc(r.track === 'motion' ? r.tplName : [r.shotSize, r.cameraMove].filter(Boolean).join(' · '))}</td>
              <td>${esc(r.line)}</td>
              <td>${esc([r.shootGuide, r.postGuide].filter(Boolean).join(' ｜ '))}</td>
            </tr>`).join('')}</tbody></table>`;
        };
        document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => {
          view = b.dataset.v;
          document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
          render();
        });
        document.querySelectorAll('#filters button').forEach((b) => b.onclick = () => {
          filter = b.dataset.f;
          document.querySelectorAll('#filters button').forEach((x) => x.classList.toggle('on', x === b));
          render();
        });
        document.getElementById('q').oninput = (e) => { query = e.target.value.trim(); render(); };
        render();
        </script>
        </body>
        </html>
        """
    }

    private static func formatClock(_ sec: Double) -> String {
        String(format: "%02d:%02d", Int(sec) / 60, Int(sec) % 60)
    }

    private static func escapeHTML(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private static func jsonString(_ text: String) -> String {
        guard let d = try? JSONEncoder().encode(text) else { return "\"dm_check\"" }
        return String(decoding: d, as: UTF8.self)
    }
}
