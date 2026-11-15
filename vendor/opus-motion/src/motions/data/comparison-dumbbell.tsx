import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, lerp, prog} from '../../core/ease';
import {Header, clip, fmt, niceScale, ramp, resolveFont, tw, useChartBox} from '../../core/r3-chart-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type Row = {label: string; before: number; after: number};
type Props = {
  data: Row[];
  title: string;
  subtitle: string;
  beforeLabel: string;
  afterLabel: string;
  prefix: string;
  suffix: string;
  decimals: number;
  sort: 'none' | 'delta' | 'after' | 'before';
  showValues: boolean;
  showDelta: boolean;
  deltaMode: 'absolute' | 'percent';
  goodDirection: 'up' | 'down';
  zeroBased: boolean;
  beforeColor: string;
  afterColor: string;
  goodColor: string;
  badColor: string;
  background: string;
  ink: string;
  fontFamily: string;
  startAt: number;
  speed: number;
};

const DEFAULT_DATA: Row[] = [
  {label: 'Onboarding', before: 42, after: 78},
  {label: 'Checkout', before: 55, after: 71},
  {label: 'Search', before: 38, after: 64},
  {label: 'Support', before: 61, after: 66},
  {label: 'Mobile app', before: 47, after: 52},
  {label: 'Reporting', before: 70, after: 58},
];

const ComparisonDumbbell: React.FC<Props> = ({
  data,
  title,
  subtitle,
  beforeLabel,
  afterLabel,
  prefix,
  suffix,
  decimals,
  sort,
  showValues,
  showDelta,
  deltaMode,
  goodDirection,
  zeroBased,
  beforeColor,
  afterColor,
  goodColor,
  badColor,
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

  let rows = (data || []).filter((d) => d && isFinite(d.before) && isFinite(d.after));
  if (sort === 'delta') rows = [...rows].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before));
  else if (sort === 'after') rows = [...rows].sort((a, b) => b.after - a.after);
  else if (sort === 'before') rows = [...rows].sort((a, b) => b.before - a.before);

  const vals = rows.flatMap((r) => [r.before, r.after]);
  const vmin = vals.length ? Math.min(...vals) : 0;
  const vmax = vals.length ? Math.max(...vals) : 1;
  const sc = zeroBased ? niceScale(Math.min(0, vmin), vmax, 5) : niceScale(vmin - (vmax - vmin) * 0.08, vmax + (vmax - vmin) * 0.08, 5);

  const labSize = (portrait ? 30 : square ? 27 : 26) * u;
  const valSize = labSize * 0.86;
  const tickSize = (portrait ? 24 : 21) * u;
  const labW = Math.min(box.w * (portrait ? 0.3 : 0.2), Math.max(...rows.map((r) => tw(r.label, labSize, 0.56)), 70 * u) + 24 * u);
  const deltaW = showDelta ? (portrait ? 120 : 130) * u : 0;
  const legH = (portrait ? 46 : 40) * u;
  const axisH = tickSize * 1.9;
  const gx0 = box.x + labW;
  const gx1 = box.x + box.w - deltaW - (showValues ? 70 * u : 24 * u);
  const gy0 = box.y + legH + 14 * u;
  const gy1 = box.y + box.h - axisH;
  const rowH = Math.min((portrait ? 170 : 96) * u, (gy1 - gy0) / Math.max(1, rows.length));
  const gh = rowH * rows.length;
  const top = gy0;
  const sx = (v: number) => gx0 + ((v - sc.min) / (sc.max - sc.min || 1)) * (gx1 - gx0);
  const dotR = Math.min(15 * u, rowH * 0.2);

  const ticks: number[] = [];
  for (let v = sc.min; v <= sc.max + sc.step * 0.01; v += sc.step) ticks.push(v);
  const axisT = prog(frame, startAt - 4, startAt + 14, ease.out);
  const rowStart = (i: number) => startAt + 8 + i * 8;
  const legT = prog(frame, startAt + 6, startAt + 24, ease.out);

  const goodUp = goodDirection === 'up';
  const deltaStr = (r: Row, k: number) => {
    const d = r.after - r.before;
    if (deltaMode === 'percent') {
      const pct = r.before !== 0 ? (d / Math.abs(r.before)) * 100 : 0;
      return fmt(pct * k, 0, '', '%', true);
    }
    return fmt(d * k, decimals, prefix, suffix, true);
  };

  return (
    <AbsoluteFill style={{background}}>
      <Svg>
        <Header box={box} ink={ink} fontFamily={font} frame={frame} />

        {/* legend */}
        <g opacity={legT}>
          {[
            {label: beforeLabel, color: beforeColor},
            {label: afterLabel, color: afterColor},
          ].map((it, k) => {
            const x = gx0 + k * Math.min(260 * u, (gx1 - gx0) / 2.2);
            return (
              <g key={k}>
                <circle cx={x + dotR * 0.8} cy={box.y + legH / 2} r={dotR * 0.8} fill={it.color} />
                <text x={x + dotR * 2.2} y={box.y + legH / 2 + valSize * 0.35} fontFamily={font} fontWeight={700} fontSize={valSize} fill={ink}>
                  {clip(it.label, 220 * u, valSize)}
                </text>
              </g>
            );
          })}
        </g>

        {/* grid */}
        <g opacity={axisT}>
          {ticks.map((v, i) => (
            <g key={i}>
              <line x1={sx(v)} x2={sx(v)} y1={gy0} y2={top + gh} stroke={ink} strokeOpacity={0.09} strokeWidth={1.5 * u} />
              <text x={sx(v)} y={top + gh + tickSize * 1.5} textAnchor="middle" fontFamily={font} fontWeight={500} fontSize={tickSize} fill={ink} fillOpacity={0.6} style={{fontVariantNumeric: 'tabular-nums'}}>
                {fmt(v, sc.step < 1 ? 1 : 0, prefix, suffix)}
              </text>
            </g>
          ))}
        </g>

        {/* rows */}
        {rows.map((r, i) => {
          const y = top + i * rowH + rowH / 2;
          const s0 = rowStart(i);
          const lt = prog(frame, s0 - 2, s0 + 14, ease.out);
          const pb = ramp(frame, s0, 16, speed, ease.back);
          const move = ramp(frame, s0 + 14, 34, speed, ease.inOut);
          const xb = sx(r.before);
          const xa = lerp(xb, sx(r.after), move);
          const up = r.after >= r.before;
          const good = up === goodUp || r.after === r.before;
          const dcol = good ? goodColor : badColor;
          const x0 = Math.min(xb, xa);
          const x1 = Math.max(xb, xa);
          const dT = prog(frame, s0 + 40 / speed, s0 + 58 / speed, ease.out);
          const curVal = lerp(r.before, r.after, move);
          return (
            <g key={i}>
              {i % 2 === 0 && <rect x={box.x} y={top + i * rowH} width={box.w} height={rowH} rx={8 * u} fill={ink} fillOpacity={0.035 * axisT} />}
              <text x={box.x + 12 * u} y={y + labSize * 0.35} fontFamily={font} fontWeight={600} fontSize={labSize} fill={ink} opacity={lt}>
                {clip(r.label, labW - 24 * u, labSize)}
              </text>
              <line x1={gx0} x2={gx1} y1={y} y2={y} stroke={ink} strokeOpacity={0.06 * lt} strokeWidth={1.5 * u} />
              {/* connector */}
              <line x1={x0} x2={x1} y1={y} y2={y} stroke={dcol} strokeOpacity={0.55} strokeWidth={Math.max(4 * u, dotR * 0.5)} strokeLinecap="round" />
              {/* before dot (hollow ring, stays) */}
              <circle cx={xb} cy={y} r={dotR * clamp(pb)} fill={beforeColor} />
              {/* after dot */}
              <circle cx={xa} cy={y} r={dotR * clamp(pb) * 1.08} fill={afterColor} stroke={background !== 'transparent' ? background : 'none'} strokeWidth={3 * u} />
              {showValues && (
                <>
                  <text
                    x={up ? xb - dotR - 10 * u : xb + dotR + 10 * u}
                    y={y + valSize * 0.35}
                    textAnchor={up ? 'end' : 'start'}
                    fontFamily={font}
                    fontWeight={600}
                    fontSize={valSize}
                    fill={ink}
                    fillOpacity={0.62}
                    opacity={clamp(pb)}
                    style={{fontVariantNumeric: 'tabular-nums'}}
                  >
                    {fmt(r.before, decimals, prefix, suffix)}
                  </text>
                  <text
                    x={up ? xa + dotR * 1.1 + 10 * u : xa - dotR * 1.1 - 10 * u}
                    y={y + valSize * 0.35}
                    textAnchor={up ? 'start' : 'end'}
                    fontFamily={font}
                    fontWeight={700}
                    fontSize={valSize}
                    fill={ink}
                    opacity={clamp(move * 1.6 - 0.2)}
                    style={{fontVariantNumeric: 'tabular-nums'}}
                  >
                    {fmt(curVal, decimals, prefix, suffix)}
                  </text>
                </>
              )}
              {showDelta && (
                <g opacity={dT} transform={`translate(${(1 - dT) * 10 * u} 0)`}>
                  <rect x={box.x + box.w - deltaW + 6 * u} y={y - valSize * 0.95} width={deltaW - 8 * u} height={valSize * 1.9} rx={valSize * 0.95} fill={dcol} fillOpacity={0.16} />
                  <text x={box.x + box.w - deltaW / 2 - 1 * u} y={y + valSize * 0.35} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={valSize} fill={dcol} style={{fontVariantNumeric: 'tabular-nums'}}>
                    {clip(deltaStr(r, 1), deltaW - 16 * u, valSize, 0.6)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </Svg>
    </AbsoluteFill>
  );
};

export const comparisonDumbbell = defineMotion<Props>({
  id: 'comparison-dumbbell',
  title: 'Comparison dumbbell',
  category: 'data',
  description:
    'A dumbbell (before / after) chart: for each category a "before" dot appears on a shared axis, then the "after" dot slides away from it, stretching a connector coloured green for improvement and red for decline, with value labels and a change pill at the right.',
  source: ['original round-3 chart motion'],
  useFor:
    'Change between two states per item: before vs after, last year vs this year, plan vs actual, men vs women, A vs B, scores pre- and post-launch. Pass data as [{label, before, after}], set the two series names, colours, prefix / suffix and which direction is good.',
  durationInFrames: 180,
  defaultProps: {
    data: DEFAULT_DATA,
    title: 'Satisfaction by area',
    subtitle: 'Score out of 100, before and after the redesign',
    beforeLabel: 'Before',
    afterLabel: 'After',
    prefix: '',
    suffix: '',
    decimals: 0,
    sort: 'none',
    showValues: true,
    showDelta: true,
    deltaMode: 'absolute',
    goodDirection: 'up',
    zeroBased: false,
    beforeColor: '#9AA3AD',
    afterColor: '#2F6FED',
    goodColor: '#12A150',
    badColor: '#E5484D',
    background: '#F5F3EE',
    ink: '#18212B',
    fontFamily: '',
    startAt: 10,
    speed: 1,
  },
  propDocs: {
    data: 'rows [{label, before, after}]; any count',
    title: 'headline (empty = none)',
    subtitle: 'small line under the headline (empty = none)',
    beforeLabel: 'legend name of the first dot',
    afterLabel: 'legend name of the second dot',
    prefix: 'text before every number, e.g. "$"',
    suffix: 'text after every number, e.g. "%", " pts"',
    decimals: 'decimal places on the numbers',
    sort: '"none", "delta" (biggest change first), "after" or "before" (largest first)',
    showValues: 'print the before and after values beside the dots',
    showDelta: 'show the change pill at the right',
    deltaMode: '"absolute" (after minus before) or "percent"',
    goodDirection: '"up" (increase is green) or "down" (decrease is green, e.g. cost, time)',
    zeroBased: 'start the axis at zero (otherwise it zooms to the data range)',
    beforeColor: 'colour of the before dot',
    afterColor: 'colour of the after dot',
    goodColor: 'connector and pill colour for a good change',
    badColor: 'connector and pill colour for a bad change',
    background: 'page colour, or "transparent" to sit over other content',
    ink: 'text and grid colour',
    fontFamily: 'CSS font family (empty = Space Grotesk)',
    startAt: 'frame the first row starts',
    speed: 'animation speed multiplier',
  },
  component: ComparisonDumbbell,
  tags: ['dumbbell', 'before after', 'comparison', 'change', 'chart', 'dot plot', 'slope', 'delta', 'infographic', 'data', 'overlay', 'statistics', 'progress'],
});
