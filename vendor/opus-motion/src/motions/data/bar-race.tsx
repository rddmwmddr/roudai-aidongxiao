import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, lerp} from '../../core/ease';
import {Header, clip, fmt, pickColor, ramp, resolveFont, textOn, useChartBox} from '../../core/r3-chart-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type Step = {label: string; values: number[]};
type Props = {
  names: string[];
  frames: Step[];
  topN: number;
  title: string;
  subtitle: string;
  prefix: string;
  suffix: string;
  decimals: number;
  stepFrames: number;
  scale: 'dynamic' | 'fixed';
  showRank: boolean;
  showPeriod: boolean;
  colors: string[];
  background: string;
  ink: string;
  fontFamily: string;
  startAt: number;
  speed: number;
};

const NAMES = ['Aurora', 'Beacon', 'Cobalt', 'Delta', 'Ember', 'Fjord', 'Garnet', 'Harbor'];
const FRAMES: Step[] = [
  {label: '2019', values: [12, 18, 9, 30, 6, 14, 4, 20]},
  {label: '2020', values: [20, 22, 16, 34, 12, 18, 10, 24]},
  {label: '2021', values: [34, 27, 31, 36, 22, 21, 19, 27]},
  {label: '2022', values: [52, 31, 49, 38, 41, 25, 33, 30]},
  {label: '2023', values: [71, 38, 66, 41, 62, 31, 52, 33]},
  {label: '2024', values: [96, 47, 82, 45, 90, 36, 71, 37]},
];

const BarRace: React.FC<Props> = ({
  names,
  frames,
  topN,
  title,
  subtitle,
  prefix,
  suffix,
  decimals,
  stepFrames,
  scale,
  showRank,
  showPeriod,
  colors,
  background,
  ink,
  fontFamily,
  startAt,
  speed,
}) => {
  const frame = useCurrentFrame();
  const {u, portrait} = useStage();
  const box = useChartBox(title, subtitle);
  const font = resolveFont(fontFamily);

  const n = names.length;
  const steps = frames.length ? frames : [{label: '', values: names.map(() => 0)}];
  const val = (si: number, i: number) => Math.max(0, steps[si].values[i] ?? 0);
  const rankAt = (si: number) => {
    const order = names.map((_, i) => i).sort((a, b) => val(si, b) - val(si, a) || a - b);
    const r = new Array(n).fill(0);
    order.forEach((idx, k) => (r[idx] = k));
    return r as number[];
  };

  const stepDur = Math.max(6, stepFrames) / Math.max(0.05, speed);
  const s = clamp((frame - startAt - 14 / speed) / stepDur, 0, steps.length - 1);
  const i0 = Math.min(steps.length - 1, Math.floor(s));
  const i1 = Math.min(steps.length - 1, i0 + 1);
  const local = i1 === i0 ? 0 : s - i0;
  // each step: a short rest, then the move
  const e = ease.inOut(clamp((local - 0.12) / 0.88));
  const intro = ramp(frame, startAt, 26, speed, ease.out);

  const rA = rankAt(i0);
  const rB = rankAt(i1);
  const maxA = Math.max(1e-9, ...names.map((_, i) => val(i0, i)));
  const maxB = Math.max(1e-9, ...names.map((_, i) => val(i1, i)));
  const globalMax = Math.max(1e-9, ...steps.flatMap((st) => st.values.map((v) => Math.max(0, v))));
  const curMax = scale === 'fixed' ? globalMax : lerp(maxA, maxB, e);

  const top = Math.max(1, Math.min(topN, n));
  const labelW = (portrait ? 220 : 250) * u;
  const valueRoom = (portrait ? 150 : 170) * u;
  const rankW = showRank ? 52 * u : 0;
  const rowGap = (portrait ? 14 : 12) * u;
  const rowH = Math.min((portrait ? 170 : 120) * u, (box.h - (showPeriod && portrait ? 120 * u : 0)) / top);
  const barH = Math.max(14 * u, rowH - rowGap);
  const barX = box.x + rankW + labelW;
  const barMax = box.w - rankW - labelW - valueRoom;
  const fs = Math.min(barH * 0.5, 38 * u);
  const periodIdx = Math.round(s);
  const periodLabel = steps[periodIdx]?.label ?? '';
  const blockH = rowH * top;
  const y0 = box.y + (box.h - blockH - (showPeriod && portrait ? 120 * u : 0)) / 2;

  const order = names.map((_, i) => i);

  return (
    <AbsoluteFill style={{background}}>
      <Svg>
        <Header box={box} ink={ink} fontFamily={font} frame={frame} />
        {showPeriod && periodLabel && (
          <text
            x={box.x + box.w}
            y={portrait ? y0 + blockH + 100 * u : y0 + blockH - 8 * u}
            textAnchor="end"
            fontFamily={font}
            fontWeight={700}
            fontSize={(portrait ? 120 : 190) * u}
            fill={ink}
            fillOpacity={0.12 * intro}
            letterSpacing={-2 * u}
          >
            {periodLabel}
          </text>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((g, k) => (
          <line key={k} x1={barX + barMax * g} x2={barX + barMax * g} y1={y0 - 6 * u} y2={y0 + blockH} stroke={ink} strokeOpacity={0.07 * intro} strokeWidth={2 * u} />
        ))}
        {order.map((i) => {
          const pos = lerp(rA[i], rB[i], e);
          const v = lerp(val(i0, i), val(i1, i), e) * intro;
          const vis = clamp(top - pos);
          if (vis <= 0.001) return null;
          const col = pickColor(colors, i);
          const bw = Math.max(2 * u, (v / curMax) * barMax);
          const y = y0 + pos * rowH + (rowH - barH) / 2;
          const textInside = bw > 170 * u;
          return (
            <g key={i} opacity={vis * intro}>
              {showRank && (
                <text x={box.x + rankW - 12 * u} y={y + barH / 2 + fs * 0.36} textAnchor="end" fontFamily={font} fontWeight={700} fontSize={fs * 0.8} fill={ink} fillOpacity={0.35}>
                  {Math.round(pos) + 1}
                </text>
              )}
              <text x={box.x + rankW + labelW - 18 * u} y={y + barH / 2 + fs * 0.36} textAnchor="end" fontFamily={font} fontWeight={600} fontSize={fs} fill={ink}>
                {clip(names[i], labelW - 24 * u, fs)}
              </text>
              <rect x={barX} y={y} width={bw} height={barH} rx={Math.min(10 * u, barH / 4)} fill={col} />
              <text
                x={textInside ? barX + bw - 16 * u : barX + bw + 16 * u}
                y={y + barH / 2 + fs * 0.36}
                textAnchor={textInside ? 'end' : 'start'}
                fontFamily={font}
                fontWeight={700}
                fontSize={fs}
                fill={textInside ? textOn(col) : ink}
                style={{fontVariantNumeric: 'tabular-nums'}}
              >
                {fmt(v, decimals, prefix, suffix)}
              </text>
            </g>
          );
        })}
      </Svg>
    </AbsoluteFill>
  );
};

export const barRace = defineMotion<Props>({
  id: 'bar-race',
  title: 'Bar chart race',
  category: 'data',
  description:
    'Ranked horizontal bars that grow, then re-order smoothly over time as the data steps through keyframes: bars overtake each other, values roll, the leader changes, and a big faded period label (year, quarter) changes behind them.',
  source: ['original round-3 chart motion'],
  useFor: 'Rankings over time: market share by year, top products by quarter, followers by month, league tables, "who is winning" stories. Give the names once and one values row per period in `frames`.',
  durationInFrames: 240,
  defaultProps: {
    names: NAMES,
    frames: FRAMES,
    topN: 6,
    title: 'Who is growing fastest',
    subtitle: 'Index of weekly active users',
    prefix: '',
    suffix: '',
    decimals: 0,
    stepFrames: 34,
    scale: 'dynamic',
    showRank: false,
    showPeriod: true,
    colors: ['#2F6FED', '#FF7A45', '#16B39A', '#F2B134', '#8E5CF0', '#E5487F', '#5BC0EB', '#7A8794'],
    background: '#0F1722',
    ink: '#EEF2F7',
    fontFamily: '',
    startAt: 8,
    speed: 1,
  },
  propDocs: {
    names: 'one name per bar; colours follow the name index so a bar keeps its colour while it moves',
    frames: 'keyframes [{label, values[]}] — one values row per period, same order as names',
    topN: 'how many bars are visible at a time (others slide off the bottom)',
    title: 'headline (empty = none)',
    subtitle: 'small line under the headline (empty = none)',
    prefix: 'text before every value',
    suffix: 'text after every value, e.g. "%", "M"',
    decimals: 'decimal places on values',
    stepFrames: 'frames per keyframe step at speed 1',
    scale: '"dynamic" rescales to the current leader, "fixed" keeps one scale for the whole race',
    showRank: 'print the live rank number at the left',
    showPeriod: 'big faded period label behind the bars',
    colors: 'bar palette by name index',
    background: 'page colour, or "transparent"',
    ink: 'text colour',
    fontFamily: 'CSS font family (empty = Space Grotesk)',
    startAt: 'frame the bars start to grow',
    speed: 'animation speed multiplier',
  },
  component: BarRace,
  tags: ['bar chart race', 'ranking', 'leaderboard', 'chart', 'data', 'overtake', 'timeline', 'infographic', 'count-up', 'statistics', 'overlay'],
});
