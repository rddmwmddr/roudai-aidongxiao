import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, prog} from '../../core/ease';
import {Header, Legend, fmt, itemColor, legendHeight, niceScale, ramp, resolveFont, useChartBox} from '../../core/r3-chart-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type Series = {name: string; values: number[]; color?: string};
type Props = {
  xLabels: string[];
  series: Series[];
  baseline: 'zero' | 'center';
  title: string;
  subtitle: string;
  prefix: string;
  suffix: string;
  decimals: number;
  showGrid: boolean;
  showLegend: boolean;
  showScrubber: boolean;
  totalLabel: string;
  colors: string[];
  background: string;
  ink: string;
  fontFamily: string;
  startAt: number;
  speed: number;
};

const XL = ['2019', '2020', '2021', '2022', '2023', '2024'];
const SER: Series[] = [
  {name: 'Subscriptions', values: [40, 52, 66, 80, 96, 118]},
  {name: 'Services', values: [24, 26, 34, 38, 46, 52]},
  {name: 'Hardware', values: [30, 34, 30, 36, 32, 40]},
  {name: 'Licensing', values: [10, 14, 20, 26, 36, 44]},
];

const SS = 12; // samples per segment

const StackedAreaFlow: React.FC<Props> = ({
  xLabels,
  series,
  baseline,
  title,
  subtitle,
  prefix,
  suffix,
  decimals,
  showGrid,
  showLegend,
  showScrubber,
  totalLabel,
  colors,
  background,
  ink,
  fontFamily,
  startAt,
  speed,
}) => {
  const frame = useCurrentFrame();
  const {u, portrait} = useStage();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const box = useChartBox(title, subtitle);
  const font = resolveFont(fontFamily);

  const M = Math.max(2, xLabels.length, ...series.map((s) => s.values.length));
  const S = series.length;
  const val = (si: number, i: number) => Math.max(0, series[si].values[Math.min(i, series[si].values.length - 1)] ?? 0);
  const at = (si: number, fx: number) => {
    const i = Math.min(M - 2, Math.max(0, Math.floor(fx)));
    const t = clamp(fx - i);
    const e = (1 - Math.cos(t * Math.PI)) / 2;
    return val(si, i) * (1 - e) + val(si, i + 1) * e;
  };
  const totalAt = (fx: number) => series.reduce((a, _, si) => a + at(si, fx), 0);
  const maxTotal = Math.max(1, ...Array.from({length: M}, (_, i) => series.reduce((a, _s, si) => a + val(si, i), 0)));
  const center = baseline === 'center';
  const sc = niceScale(0, maxTotal * 1.04, 4);
  const yMax = center ? maxTotal * 1.06 : sc.max;

  // layout
  const legRight = !portrait && !box.square;
  const legSize = (portrait ? 32 : 28) * u;
  const legRowH = legSize * 1.9;
  const legCols = legRight ? 1 : S > 3 ? 2 : S;
  const legW = showLegend ? (legRight ? Math.min(box.w * 0.27, 430 * u) : box.w) : 0;
  const legH = showLegend ? legendHeight(S, legCols, legRowH) : 0;
  const x0 = box.x + (showGrid && !center ? 84 * u : 0);
  const x1 = box.x + box.w - (legRight && showLegend ? legW + 48 * u : 0);
  const top = box.y + (showScrubber ? 76 * u : 18 * u);
  const xlabH = 60 * u;
  const bottom = box.y + box.h - xlabH - (!legRight && showLegend ? legH + 32 * u : 0);
  const px = (fx: number) => x0 + (fx / (M - 1)) * (x1 - x0);
  const mid = (top + bottom) / 2;
  const py = (v: number) => (center ? mid - ((v - 0) / yMax) * ((bottom - top) / 2) : bottom - (v / yMax) * (bottom - top));

  // reveal
  const rev = ramp(frame, startAt + 6, 100, speed, ease.inOut);
  const fxScrub = rev * (M - 1);
  const revealW = (x1 - x0) * rev;

  // stack boundaries at every sample
  const n = (M - 1) * SS + 1;
  const lowers: number[][] = Array.from({length: S}, () => []);
  const uppers: number[][] = Array.from({length: S}, () => []);
  const xs: number[] = [];
  for (let k = 0; k < n; k++) {
    const fx = k / SS;
    xs.push(px(fx));
    let total = 0;
    const vals = series.map((_, si) => at(si, fx));
    total = vals.reduce((a, b) => a + b, 0);
    let acc = center ? -total / 2 : 0;
    vals.forEach((v, si) => {
      lowers[si].push(acc);
      acc += v;
      uppers[si].push(acc);
    });
  }
  // center baseline: shift to symmetrical around 0 -> py works on |v| relative to mid; map signed values
  const pyS = (v: number) => (center ? mid - (v / yMax) * ((bottom - top) / 1) : py(v));
  const pathFor = (si: number) => {
    const up = xs.map((x, k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${pyS(uppers[si][k]).toFixed(1)}`).join(' ');
    const lo = xs
      .map((x, k) => `L${xs[n - 1 - k].toFixed(1)} ${pyS(lowers[si][n - 1 - k]).toFixed(1)}`)
      .join(' ');
    return `${up} ${lo} Z`;
  };

  const showAt = Math.max(0, Math.min(M - 1, fxScrub));
  const scrubX = px(showAt);
  const labelStep = Math.max(1, Math.ceil(M / (portrait ? 6 : 10)));

  const legX = legRight ? x1 + 48 * u : box.x;
  const legY = legRight ? box.y + (box.h - legH) / 2 : box.y + box.h - legH;
  const legOrder = Array.from({length: S}, (_, k) => S - 1 - k);

  return (
    <AbsoluteFill style={{background}}>
      <Svg>
        <Header box={box} ink={ink} fontFamily={font} frame={frame} />
        {showGrid && !center &&
          (() => {
            const out: React.ReactNode[] = [];
            for (let g = 0; g <= sc.max + 1e-9; g += sc.step) {
              out.push(
                <g key={g} opacity={prog(frame, startAt - 4, startAt + 14)}>
                  <line x1={x0} x2={x1} y1={py(g)} y2={py(g)} stroke={ink} strokeOpacity={g === 0 ? 0.35 : 0.1} strokeWidth={2 * u} />
                  <text x={x0 - 14 * u} y={py(g) + 8 * u} textAnchor="end" fontFamily={font} fontWeight={500} fontSize={(portrait ? 26 : 22) * u} fill={ink} fillOpacity={0.5}>
                    {fmt(g, 0, prefix, suffix)}
                  </text>
                </g>,
              );
            }
            return out;
          })()}
        <defs>
          <clipPath id={`saf-${uid}`}>
            <rect x={x0 - 2} y={box.y - 100 * u} width={revealW + 2} height={box.h + 200 * u} />
          </clipPath>
        </defs>
        <g clipPath={`url(#saf-${uid})`}>
          {series.map((s, si) => (
            <path key={si} d={pathFor(si)} fill={itemColor(s.color, colors, si)} fillOpacity={0.94} stroke={background === 'transparent' ? '#ffffff' : background} strokeWidth={2.5 * u} strokeLinejoin="round" />
          ))}
        </g>
        {Array.from({length: M}, (_, i) => {
          if (i % labelStep !== 0 && i !== M - 1) return null;
          const lab = xLabels[i] ?? '';
          return (
            <text key={i} x={px(i)} y={bottom + 40 * u} textAnchor={i === 0 ? 'start' : i === M - 1 ? 'end' : 'middle'} fontFamily={font} fontWeight={600} fontSize={(portrait ? 28 : 24) * u} fill={ink} fillOpacity={0.6} opacity={prog(frame, startAt, startAt + 16)}>
              {lab}
            </text>
          );
        })}
        {showScrubber && rev > 0 && (
          <g opacity={clamp(rev * 8)}>
            <line x1={scrubX} x2={scrubX} y1={top - 14 * u} y2={bottom} stroke={ink} strokeOpacity={0.55 * (1 - prog(frame, startAt + 6 + 100 / speed, startAt + 6 + 122 / speed))} strokeWidth={2.5 * u} strokeDasharray={`${6 * u} ${6 * u}`} />
            <text
              x={Math.min(x1 - 6 * u, Math.max(x0 + 6 * u, scrubX))}
              y={top - 34 * u}
              textAnchor={scrubX > x1 - 220 * u ? 'end' : scrubX < x0 + 220 * u ? 'start' : 'middle'}
              fontFamily={font}
              fontWeight={700}
              fontSize={(portrait ? 40 : 36) * u}
              fill={ink}
              style={{fontVariantNumeric: 'tabular-nums'}}
            >
              {`${totalLabel ? totalLabel + ' ' : ''}${fmt(totalAt(showAt), decimals, prefix, suffix)}`}
            </text>
          </g>
        )}
        {showLegend && (
          <Legend
            items={legOrder.map((si) => ({
              label: series[si].name,
              color: itemColor(series[si].color, colors, si),
              value: fmt(at(si, showAt), decimals, prefix, suffix),
            }))}
            x={legX}
            y={legY}
            w={legW}
            cols={legCols}
            rowH={legRowH}
            size={legSize}
            ink={ink}
            fontFamily={font}
            frame={frame}
            start={startAt + 10}
            stagger={5}
          />
        )}
      </Svg>
    </AbsoluteFill>
  );
};

export const stackedAreaFlow = defineMotion<Props>({
  id: 'stacked-area-flow',
  title: 'Stacked area flow',
  category: 'data',
  description:
    'A smooth stacked area chart (or centred streamgraph) revealed left to right by a wipe: layers swell over the timeline, a dashed scrubber follows the reveal edge with a running total, the legend values count with it, and the axis and gridlines sit quietly behind.',
  source: ['original round-3 chart motion'],
  useFor: 'Composition over time: revenue by product line, traffic by source, energy mix, users by plan, time spent by activity. Replace xLabels and series; set baseline "center" for a streamgraph look.',
  durationInFrames: 210,
  defaultProps: {
    xLabels: XL,
    series: SER,
    baseline: 'zero',
    title: 'Where growth comes from',
    subtitle: 'Revenue by line, millions',
    prefix: '$',
    suffix: 'M',
    decimals: 0,
    showGrid: true,
    showLegend: true,
    showScrubber: true,
    totalLabel: 'Total',
    colors: ['#2F6FED', '#16B39A', '#F2B134', '#FF7A45', '#8E5CF0', '#E5487F'],
    background: '#0F1722',
    ink: '#EEF2F7',
    fontFamily: '',
    startAt: 10,
    speed: 1,
  },
  propDocs: {
    xLabels: 'labels along the x axis (years, months, ...)',
    series: 'layers bottom to top [{name, values[] (one per x label), color?}]',
    baseline: '"zero" = stacked area from the axis, "center" = streamgraph centred on the middle',
    title: 'headline (empty = none)',
    subtitle: 'small line under the headline (empty = none)',
    prefix: 'text before numbers, e.g. "$"',
    suffix: 'text after numbers, e.g. "M"',
    decimals: 'decimal places on the readouts',
    showGrid: 'horizontal gridlines with value labels (zero baseline only)',
    showLegend: 'legend with live values, beside (16:9) or below (1:1, 9:16)',
    showScrubber: 'dashed line and running total that follow the reveal edge',
    totalLabel: 'word before the running total (empty = number only)',
    colors: 'palette for series without their own colour',
    background: 'page colour, or "transparent"',
    ink: 'text and grid colour',
    fontFamily: 'CSS font family (empty = Space Grotesk)',
    startAt: 'frame the reveal starts',
    speed: 'animation speed multiplier',
  },
  component: StackedAreaFlow,
  tags: ['stacked area', 'streamgraph', 'area chart', 'chart', 'data', 'composition', 'timeline', 'trend', 'infographic', 'count-up', 'legend', 'overlay'],
});
