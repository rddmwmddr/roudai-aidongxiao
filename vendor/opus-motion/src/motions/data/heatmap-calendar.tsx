import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, prog} from '../../core/ease';
import {n2, rng} from '../../core/random';
import {Header, fmt, ramp, resolveFont, tw, useChartBox} from '../../core/r3-chart-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type Props = {
  values: number[];
  sampleSeed: number;
  startDate: string;
  weekStart: 'sun' | 'mon';
  layout: 'auto' | 'strip' | 'months';
  levels: number;
  title: string;
  subtitle: string;
  prefix: string;
  suffix: string;
  totalLabel: string;
  bestLabel: string;
  activeLabel: string;
  lessLabel: string;
  moreLabel: string;
  showStats: boolean;
  showLegend: boolean;
  showWeekdays: boolean;
  accent: string;
  emptyOpacity: number;
  background: string;
  ink: string;
  fontFamily: string;
  startAt: number;
  speed: number;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseDate = (s: string): [number, number, number] => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec((s || '').trim());
  if (!m) return [2025, 1, 5];
  return [+m[1], clamp(+m[2], 1, 12), clamp(+m[3], 1, 31)];
};

type Day = {i: number; month: number; year: number; dom: number; wd: number; v: number};

const HeatmapCalendar: React.FC<Props> = ({
  values,
  sampleSeed,
  startDate,
  weekStart,
  layout,
  levels,
  title,
  subtitle,
  prefix,
  suffix,
  totalLabel,
  bestLabel,
  activeLabel,
  lessLabel,
  moreLabel,
  showStats,
  showLegend,
  showWeekdays,
  accent,
  emptyOpacity,
  background,
  ink,
  fontFamily,
  startAt,
  speed,
}) => {
  const frame = useCurrentFrame();
  const {u, portrait, square} = useStage();
  const box = useChartBox(title, subtitle);
  const font = resolveFont(fontFamily);

  const days = React.useMemo<Day[]>(() => {
    const [y, m, d] = parseDate(startDate);
    let vals = (values || []).map((v) => (isFinite(v) ? Math.max(0, v) : 0)).slice(0, 371);
    if (!vals.length) {
      const r = rng(sampleSeed);
      vals = Array.from({length: 365}, (_, i) => {
        const wd = new Date(Date.UTC(y, m - 1, d + i)).getUTCDay();
        const wave = (n2('hm' + sampleSeed, i * 0.045, 0) + 1) / 2; // slow bursts of activity
        const weekend = wd === 0 || wd === 6 ? 0.35 : 1;
        const base = (0.2 + 0.8 * wave) * 11 * weekend * (0.3 + 0.9 * r());
        return r() < 0.1 + 0.12 * (1 - wave) ? 0 : Math.max(1, Math.round(base));
      });
    }
    return vals.map((v, i) => {
      const dt = new Date(Date.UTC(y, m - 1, d + i));
      return {i, month: dt.getUTCMonth(), year: dt.getUTCFullYear(), dom: dt.getUTCDate(), wd: dt.getUTCDay(), v};
    });
  }, [JSON.stringify(values), sampleSeed, startDate]);

  const n = days.length;
  const maxV = Math.max(...days.map((d) => d.v), 1e-9);
  const total = days.reduce((a, d) => a + d.v, 0);
  const active = days.filter((d) => d.v > 0).length;
  let bestIdx = 0;
  days.forEach((d, i) => {
    if (d.v > days[bestIdx].v) bestIdx = i;
  });
  const L = Math.max(3, Math.min(8, Math.round(levels)));
  const level = (v: number) => (v <= 0 ? 0 : clamp(Math.ceil((v / maxV) * (L - 1)), 1, L - 1));
  const opOf = (lv: number) => (lv === 0 ? emptyOpacity : 0.28 + 0.72 * ((lv - 1) / Math.max(1, L - 2)));
  const rowOf = (wd: number) => (weekStart === 'mon' ? (wd + 6) % 7 : wd);

  const mode = layout === 'auto' ? (portrait || square ? 'months' : 'strip') : layout;

  // footer (stats + legend)
  const statBig = (portrait ? 54 : square ? 48 : 46) * u;
  const statSmall = (portrait ? 24 : 21) * u;
  const stacked = portrait || square;
  const footH = (showStats ? statBig + statSmall * 1.6 : 0) + (showLegend && (stacked || !showStats) ? 40 * u : 0) + (showStats && showLegend && stacked ? 40 * u : 0);
  const footGap = footH > 0 ? 36 * u : 0;
  const chartH = box.h - footH - footGap;

  type Place = {x: number; y: number; cell: number; col: number};
  const place: Place[] = new Array(n);
  const labels: {x: number; y: number; text: string; size: number; anchor: 'start' | 'middle'; order: number}[] = [];
  let weekdayLabels: {y: number; text: string}[] = [];
  let wdX = 0;
  let gridW = 0;
  let gridH = 0;
  let cell = 0;
  let originX = box.x;
  let originY = box.y;

  if (mode === 'strip') {
    const off = rowOf(days[0].wd);
    const cols = Math.ceil((off + n) / 7);
    const lab = (portrait ? 24 : 21) * u;
    const dayW = showWeekdays ? tw('Wed', lab, 0.58) + 16 * u : 0;
    const monH = lab * 1.9;
    cell = Math.min((box.w - dayW) / cols, (chartH - monH) / 7, 64 * u);
    gridW = cell * cols;
    gridH = cell * 7;
    originX = box.x + (box.w - gridW - dayW) / 2 + dayW;
    originY = box.y + monH + Math.max(0, (box.h - (monH + gridH + footGap + footH)) * 0.4);
    days.forEach((d, i) => {
      const col = Math.floor((off + i) / 7);
      place[i] = {x: originX + col * cell, y: originY + rowOf(d.wd) * cell, cell, col};
    });
    let lastLabelCol = -10;
    days.forEach((d, i) => {
      if (d.dom <= 7 && (i === 0 || days[i - 1].month !== d.month) || i === 0) {
        const col = place[i].col;
        if (col - lastLabelCol >= 3 || i === 0) {
          const nextMonthSoon = i === 0 && n > 7 && days.slice(1, 10).some((q) => q.dom === 1);
          if (!nextMonthSoon) {
            labels.push({x: originX + col * cell, y: originY - lab * 0.55, text: MONTHS[d.month], size: lab, anchor: 'start', order: col});
            lastLabelCol = col;
          }
        }
      }
    });
    if (showWeekdays) {
      wdX = originX - 12 * u;
      const idx = weekStart === 'mon' ? [0, 2, 4] : [1, 3, 5];
      weekdayLabels = idx.map((r) => ({y: originY + (r + 0.5) * cell + lab * 0.35, text: DOW[weekStart === 'mon' ? (r + 1) % 7 : r]}));
    }
  } else {
    // one mini calendar per month
    const months: {month: number; year: number; first: number}[] = [];
    days.forEach((d, i) => {
      const last = months[months.length - 1];
      if (!last || last.month !== d.month || last.year !== d.year) months.push({month: d.month, year: d.year, first: i});
    });
    const mcols = portrait ? 3 : square ? 4 : Math.min(6, months.length);
    const mrows = Math.ceil(months.length / mcols);
    const blockGap = (portrait ? 30 : 26) * u;
    const lab = (portrait ? 28 : 24) * u;
    const titleH = lab * 1.9;
    const bw = (box.w - (mcols - 1) * blockGap) / mcols;
    const rowsNeeded = 6;
    cell = Math.min(bw / 7, (chartH - (mrows - 1) * blockGap - mrows * titleH) / (mrows * rowsNeeded), 64 * u);
    const blockW = cell * 7;
    const blockH = titleH + cell * rowsNeeded;
    const totalW = mcols * blockW + (mcols - 1) * blockGap;
    const totalH = mrows * blockH + (mrows - 1) * blockGap;
    const ox = box.x + (box.w - totalW) / 2;
    const oy = box.y + Math.max(0, (box.h - (totalH + footGap + footH)) * 0.4);
    gridW = totalW;
    gridH = totalH;
    originX = ox;
    originY = oy;
    months.forEach((mo, mi) => {
      const bx = ox + (mi % mcols) * (blockW + blockGap);
      const by = oy + Math.floor(mi / mcols) * (blockH + blockGap);
      labels.push({x: bx, y: by + lab * 0.95, text: MONTHS[mo.month] + (months.some((q) => q.month === mo.month && q.year !== mo.year) ? ' ' + String(mo.year).slice(2) : ''), size: lab, anchor: 'start', order: mi});
      const first = days[mo.first];
      const startCol = rowOf(first.wd) - (first.dom - 1) % 7;
      for (let i = mo.first; i < n && days[i].month === mo.month && days[i].year === mo.year; i++) {
        const idx = rowOf(first.wd) + (days[i].dom - first.dom);
        place[i] = {x: bx + (idx % 7) * cell, y: by + titleH + Math.floor(idx / 7) * cell, cell, col: mi};
      }
      void startCol;
    });
  }

  const gapC = cell * 0.16;
  const rad = cell * 0.22;
  const popSpan = 80 / speed;
  const delayOf = (i: number) => startAt + (i / Math.max(1, n - 1)) * popSpan;
  const axisT = prog(frame, startAt - 2, startAt + 16, ease.out);
  const bestT = prog(frame, startAt + popSpan + 20, startAt + popSpan + 44, ease.out);
  const pulse = 0.5 + 0.5 * Math.sin(((frame - (startAt + popSpan + 30)) / 30) * Math.PI * 2);
  const statT = (k: number) => prog(frame, startAt + 14 + k * 8, startAt + 34 + k * 8, ease.out);
  const countT = ramp(frame, startAt + 14, popSpan + 10, 1, ease.out);

  const footY = originY + gridH + footGap;
  const statY = footY + statBig * 0.85;
  const fullStats = [fmt(total, 0, prefix, suffix), fmt(maxV, 0, prefix, suffix), fmt(active, 0)];
  const statLabels = [totalLabel, bestLabel, activeLabel];
  const statWs = fullStats.map((b, k) => Math.max(tw(b, statBig, 0.62), tw(statLabels[k], statSmall, 0.56)) + 56 * u);
  const statScale = Math.min(1, box.w / Math.max(1, statWs.reduce((a, b) => a + b, 0)));
  const statXs = statWs.map((_, k) => box.x + statWs.slice(0, k).reduce((a, b) => a + b, 0) * statScale);
  const stats = [
    {big: fmt(total * countT, 0, prefix, suffix), small: totalLabel},
    {big: fmt(maxV * clamp(countT * 1.0), 0, prefix, suffix), small: bestLabel},
    {big: fmt(active * countT, 0), small: activeLabel},
  ];
  const legY = stacked && showStats ? statY + statSmall * 1.5 + 62 * u : footY + statBig * 0.4;
  const legSw = (portrait ? 26 : 22) * u;
  const legText = (portrait ? 24 : 21) * u;
  const legW = legSw * (L + 1) * 1.3 + tw(lessLabel, legText, 0.56) + tw(moreLabel, legText, 0.56) + 40 * u;
  const legX = stacked ? box.x + (showStats ? 0 : (box.w - legW) / 2) : box.x + box.w - legW;
  const legT = prog(frame, startAt + popSpan + 6, startAt + popSpan + 28, ease.out);

  return (
    <AbsoluteFill style={{background}}>
      <Svg>
        <Header box={box} ink={ink} fontFamily={font} frame={frame} />
        <g opacity={axisT}>
          {labels.map((l, k) => (
            <text key={k} x={l.x} y={l.y} textAnchor={l.anchor} fontFamily={font} fontWeight={600} fontSize={l.size} fill={ink} fillOpacity={0.62}>
              {l.text}
            </text>
          ))}
          {weekdayLabels.map((l, k) => (
            <text key={'w' + k} x={wdX} y={l.y} textAnchor="end" fontFamily={font} fontWeight={500} fontSize={(portrait ? 24 : 21) * u} fill={ink} fillOpacity={0.5}>
              {l.text}
            </text>
          ))}
        </g>
        {days.map((d, i) => {
          const p = place[i];
          if (!p) return null;
          const t = prog(frame, delayOf(i), delayOf(i) + 16, ease.back);
          if (t <= 0) return null;
          const lv = level(d.v);
          const s = 0.35 + 0.65 * Math.min(1, t);
          const sz = (cell - gapC) * s;
          const cx = p.x + cell / 2;
          const cy = p.y + cell / 2;
          return (
            <rect
              key={i}
              x={cx - sz / 2}
              y={cy - sz / 2}
              width={sz}
              height={sz}
              rx={rad}
              fill={lv === 0 ? ink : accent}
              fillOpacity={opOf(lv) * clamp(t * 1.4)}
            />
          );
        })}
        {place[bestIdx] && (
          <circle
            cx={place[bestIdx].x + cell / 2}
            cy={place[bestIdx].y + cell / 2}
            r={cell * (0.78 + 0.18 * pulse)}
            fill="none"
            stroke={ink}
            strokeWidth={Math.max(2, cell * 0.1)}
            strokeOpacity={bestT * (0.85 - 0.35 * pulse)}
          />
        )}
        {showStats &&
          stats.map((s, k) => (
            <g key={k} opacity={statT(k)} transform={`translate(0 ${(1 - statT(k)) * 12 * u})`}>
              <text x={statXs[k]} y={statY} fontFamily={font} fontWeight={700} fontSize={statBig} fill={ink} style={{fontVariantNumeric: 'tabular-nums'}}>
                {s.big}
              </text>
              <text x={statXs[k]} y={statY + statSmall * 1.5} fontFamily={font} fontWeight={500} fontSize={statSmall} fill={ink} fillOpacity={0.6}>
                {s.small}
              </text>
            </g>
          ))}
        {showLegend && (
          <g opacity={legT}>
            <text x={legX} y={legY + legText * 0.35} fontFamily={font} fontWeight={500} fontSize={legText} fill={ink} fillOpacity={0.6}>
              {lessLabel}
            </text>
            {Array.from({length: L}, (_, lv) => (
              <rect
                key={lv}
                x={legX + tw(lessLabel, legText, 0.56) + 14 * u + lv * legSw * 1.3}
                y={legY - legSw / 2}
                width={legSw}
                height={legSw}
                rx={legSw * 0.22}
                fill={lv === 0 ? ink : accent}
                fillOpacity={opOf(lv)}
              />
            ))}
            <text x={legX + tw(lessLabel, legText, 0.56) + 14 * u + L * legSw * 1.3 + 8 * u} y={legY + legText * 0.35} fontFamily={font} fontWeight={500} fontSize={legText} fill={ink} fillOpacity={0.6}>
              {moreLabel}
            </text>
          </g>
        )}
      </Svg>
    </AbsoluteFill>
  );
};

export const heatmapCalendar = defineMotion<Props>({
  id: 'heatmap-calendar',
  title: 'Heatmap calendar',
  category: 'data',
  description:
    'A GitHub-style contribution calendar: one rounded square per day, shaded in levels of the accent colour, popping in left to right with month and weekday labels, count-up stats and a less / more legend; the best day gets a pulsing ring. Reflows to a grid of mini-month calendars in square and vertical frames.',
  source: ['original round-3 chart motion'],
  useFor:
    'Activity over a year: commits, workouts, streaks, sales days, habits, support tickets, website traffic by day. Pass values (one number per day) and startDate, set the accent colour and unit; leave values empty to preview with seeded sample data.',
  durationInFrames: 210,
  defaultProps: {
    values: [],
    sampleSeed: 7,
    startDate: '2025-01-01',
    weekStart: 'sun',
    layout: 'auto',
    levels: 5,
    title: 'A year of activity',
    subtitle: 'Each square is one day, darker means more',
    prefix: '',
    suffix: '',
    totalLabel: 'Total contributions',
    bestLabel: 'Best day',
    activeLabel: 'Active days',
    lessLabel: 'Less',
    moreLabel: 'More',
    showStats: true,
    showLegend: true,
    showWeekdays: true,
    accent: '#16A34A',
    emptyOpacity: 0.09,
    background: '#F5F3EE',
    ink: '#18212B',
    fontFamily: '',
    startAt: 8,
    speed: 1,
  },
  propDocs: {
    values: 'one number per day, up to 371 (empty = seeded sample year)',
    sampleSeed: 'seed for the sample data used when values is empty',
    startDate: 'date of the first value, "YYYY-MM-DD" (drives month labels and weekday alignment)',
    weekStart: '"sun" or "mon": which weekday is the top row',
    layout: '"auto" (strip in 16:9, mini months in 1:1 / 9:16), "strip" or "months"',
    levels: 'number of shades including empty (3-8)',
    title: 'headline (empty = none)',
    subtitle: 'small line under the headline (empty = none)',
    prefix: 'text before total and best-day numbers',
    suffix: 'text after total and best-day numbers, e.g. " commits"',
    totalLabel: 'caption under the total',
    bestLabel: 'caption under the best-day value',
    activeLabel: 'caption under the active-days count',
    lessLabel: 'legend text at the light end',
    moreLabel: 'legend text at the dark end',
    showStats: 'show the three count-up stats',
    showLegend: 'show the less / more legend',
    showWeekdays: 'show Mon / Wed / Fri labels (strip layout)',
    accent: 'colour of the busiest days',
    emptyOpacity: 'opacity of days with a zero value',
    background: 'page colour, or "transparent" to sit over other content',
    ink: 'text and empty-day colour',
    fontFamily: 'CSS font family (empty = Space Grotesk)',
    startAt: 'frame the first square appears',
    speed: 'animation speed multiplier',
  },
  component: HeatmapCalendar,
  tags: ['heatmap', 'calendar', 'github', 'contribution', 'activity', 'streak', 'habit', 'chart', 'infographic', 'data', 'overlay', 'statistics', 'year'],
});
