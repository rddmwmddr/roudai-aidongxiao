import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ease, prog} from '../../core/ease';
import {Header, Legend, clip, fmt, itemColor, niceScale, ramp, resolveFont, textOn, tw, useChartBox} from '../../core/r3-chart-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type Pt = {label: string; x: number; y: number; size: number; color?: string; group?: string};
type Props = {
  points: Pt[];
  title: string;
  subtitle: string;
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  xPrefix: string;
  xSuffix: string;
  yPrefix: string;
  ySuffix: string;
  xDecimals: number;
  yDecimals: number;
  zeroBased: boolean;
  showLabels: boolean;
  labelTop: number;
  maxRadius: number;
  bubbleOpacity: number;
  highlight: string;
  colors: string[];
  background: string;
  ink: string;
  fontFamily: string;
  startAt: number;
  speed: number;
};

const DEFAULT_POINTS: Pt[] = [
  {label: 'Alpha', x: 12, y: 78, size: 40, group: 'North'},
  {label: 'Bravo', x: 28, y: 52, size: 120, group: 'North'},
  {label: 'Cedar', x: 35, y: 88, size: 70, group: 'South'},
  {label: 'Delta', x: 47, y: 35, size: 200, group: 'South'},
  {label: 'Ember', x: 58, y: 66, size: 90, group: 'East'},
  {label: 'Fjord', x: 66, y: 22, size: 55, group: 'East'},
  {label: 'Grove', x: 74, y: 80, size: 150, group: 'North'},
  {label: 'Harbor', x: 86, y: 48, size: 240, group: 'West'},
  {label: 'Indigo', x: 92, y: 90, size: 35, group: 'West'},
  {label: 'Juniper', x: 20, y: 24, size: 25, group: 'South'},
];

const hexRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
};
/** colour of a translucent fill over the page, so label text contrast is judged on what is really seen */
const blend = (fg: string, bg: string, a: number) => {
  const f = hexRgb(fg);
  const b = hexRgb(bg);
  if (!f || !b) return fg;
  return '#' + f.map((v, i) => Math.round(b[i] + (v - b[i]) * a).toString(16).padStart(2, '0')).join('');
};

const BubbleScatterGrow: React.FC<Props> = ({
  points,
  title,
  subtitle,
  xLabel,
  yLabel,
  sizeLabel,
  xPrefix,
  xSuffix,
  yPrefix,
  ySuffix,
  xDecimals,
  yDecimals,
  zeroBased,
  showLabels,
  labelTop,
  maxRadius,
  bubbleOpacity,
  highlight,
  colors,
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

  const pts = (points || []).filter((p) => p && isFinite(p.x) && isFinite(p.y));
  const groups: string[] = [];
  pts.forEach((p) => {
    if (p.group && !groups.includes(p.group)) groups.push(p.group);
  });
  const colorOf = (p: Pt, i: number) => (p.color ? p.color : p.group ? itemColor(undefined, colors, groups.indexOf(p.group)) : itemColor(undefined, colors, i));

  // axis ranges
  const xs = pts.length ? pts.map((p) => p.x) : [0, 1];
  const ys = pts.length ? pts.map((p) => p.y) : [0, 1];
  const rng2 = (a: number[]) => {
    const lo = Math.min(...a);
    const hi = Math.max(...a);
    if (zeroBased) return niceScale(lo >= 0 ? 0 : lo, Math.max(hi, 1e-6), 5);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
    return niceScale(lo - pad, hi + pad, 5);
  };
  const xr = rng2(xs);
  const yr = rng2(ys);
  const tickSize = (portrait ? 26 : 22) * u;
  const axisTitleSize = (portrait ? 28 : 24) * u;
  const showLegend = groups.length > 1;
  const legSize = (portrait ? 28 : 24) * u;
  const legH = showLegend ? legSize * 2.2 : 0;

  const yTickLabels = (() => {
    const out: {v: number; s: string}[] = [];
    for (let v = yr.min; v <= yr.max + yr.step * 0.01; v += yr.step) out.push({v, s: fmt(v, yDecimals, yPrefix, ySuffix)});
    return out;
  })();
  const xTickLabels = (() => {
    const out: {v: number; s: string}[] = [];
    for (let v = xr.min; v <= xr.max + xr.step * 0.01; v += xr.step) out.push({v, s: fmt(v, xDecimals, xPrefix, xSuffix)});
    return out;
  })();
  const yAxisW = Math.max(...yTickLabels.map((t) => tw(t.s, tickSize, 0.58)), 20 * u) + 18 * u + (yLabel && !portrait ? axisTitleSize * 1.3 : 0);
  const footH = tickSize * 1.6 + (xLabel ? axisTitleSize * 1.5 : 0) + legH + (showLegend ? 18 * u : 0);
  const px0 = box.x + yAxisW;
  const px1 = box.x + box.w - 18 * u;
  const py0 = box.y + (portrait ? axisTitleSize * 2.1 : 28 * u);
  const py1 = box.y + box.h - footH;
  const sx = (v: number) => px0 + ((v - xr.min) / (xr.max - xr.min || 1)) * (px1 - px0);
  const sy = (v: number) => py1 - ((v - yr.min) / (yr.max - yr.min || 1)) * (py1 - py0);

  const maxSize = Math.max(...pts.map((p) => Math.max(0, p.size || 0)), 1e-9);
  const rMax = Math.min(maxRadius * u, (py1 - py0) / 4.2, (px1 - px0) / 6);
  const radius = (p: Pt) => Math.max(8 * u, Math.sqrt(Math.max(0, p.size || 0) / maxSize) * rMax);

  // draw order: big first, so small bubbles stay on top
  const order = pts.map((p, i) => ({p, i})).sort((a, b) => (b.p.size || 0) - (a.p.size || 0));
  // grow order: left to right
  const growRank = new Map<number, number>();
  [...pts.map((p, i) => ({p, i}))].sort((a, b) => a.p.x - b.p.x).forEach((o, k) => growRank.set(o.i, k));

  // greedy label placement (largest bubbles get priority)
  const fs = (portrait ? 26 : 22) * u;
  const placed: {x0: number; y0: number; x1: number; y1: number}[] = [];
  const bubblesBox = pts.map((p) => ({x: sx(p.x), y: sy(p.y), r: radius(p)}));
  const labelPos = new Map<number, {x: number; y: number; anchor: 'start' | 'middle' | 'end'; inside: boolean; text: string}>();
  if (showLabels) {
    const limit = labelTop > 0 ? labelTop : pts.length;
    order.slice(0, limit).forEach(({p, i}) => {
      const b = bubblesBox[i];
      const textW = tw(p.label, fs, 0.56);
      if (textW < b.r * 1.55 && fs < b.r * 1.1) {
        labelPos.set(i, {x: b.x, y: b.y + fs * 0.35, anchor: 'middle', inside: true, text: p.label});
        return;
      }
      const cands: {x: number; y: number; anchor: 'start' | 'middle' | 'end'}[] = [
        {x: b.x + b.r + 8 * u, y: b.y + fs * 0.35, anchor: 'start'},
        {x: b.x, y: b.y - b.r - 10 * u, anchor: 'middle'},
        {x: b.x - b.r - 8 * u, y: b.y + fs * 0.35, anchor: 'end'},
        {x: b.x, y: b.y + b.r + fs + 6 * u, anchor: 'middle'},
      ];
      for (const c of cands) {
        const x0 = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - textW : c.x - textW / 2;
        const r = {x0, x1: x0 + textW, y0: c.y - fs, y1: c.y + fs * 0.25};
        const inside = r.x0 >= box.x - 4 * u && r.x1 <= box.x + box.w + 4 * u && r.y0 >= box.y - 4 * u && r.y1 <= py1 + tickSize;
        const hit = placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
        if (inside && !hit) {
          placed.push(r);
          labelPos.set(i, {x: c.x, y: c.y, anchor: c.anchor, inside: false, text: p.label});
          return;
        }
      }
    });
  }

  const hlIdx = highlight ? pts.findIndex((p) => p.label === highlight) : -1;
  const hlT = hlIdx >= 0 ? prog(frame, startAt + (pts.length * 6 + 50) / speed, startAt + (pts.length * 6 + 72) / speed, ease.out) : 0;
  const axisT = prog(frame, startAt - 4, startAt + 22, ease.out);
  const bgSolid = background && background !== 'transparent' ? background : 'none';

  return (
    <AbsoluteFill style={{background}}>
      <Svg>
        <Header box={box} ink={ink} fontFamily={font} frame={frame} />
        {/* grid + ticks */}
        <g opacity={axisT}>
          {yTickLabels.map((t, i) => (
            <g key={'y' + i}>
              <line x1={px0} x2={px1} y1={sy(t.v)} y2={sy(t.v)} stroke={ink} strokeOpacity={i === 0 ? 0.35 : 0.1} strokeWidth={(i === 0 ? 2 : 1.5) * u} />
              <text x={px0 - 12 * u} y={sy(t.v) + tickSize * 0.35} textAnchor="end" fontFamily={font} fontWeight={500} fontSize={tickSize} fill={ink} fillOpacity={0.6} style={{fontVariantNumeric: 'tabular-nums'}}>
                {t.s}
              </text>
            </g>
          ))}
          {xTickLabels.map((t, i) => (
            <g key={'x' + i}>
              <line x1={sx(t.v)} x2={sx(t.v)} y1={py0} y2={py1} stroke={ink} strokeOpacity={i === 0 ? 0.35 : 0.06} strokeWidth={(i === 0 ? 2 : 1.5) * u} />
              <text x={sx(t.v)} y={py1 + tickSize * 1.35} textAnchor="middle" fontFamily={font} fontWeight={500} fontSize={tickSize} fill={ink} fillOpacity={0.6} style={{fontVariantNumeric: 'tabular-nums'}}>
                {t.s}
              </text>
            </g>
          ))}
          {xLabel ? (
            <text x={(px0 + px1) / 2} y={py1 + tickSize * 1.6 + axisTitleSize * 1.15} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={axisTitleSize} fill={ink} fillOpacity={0.85} letterSpacing={axisTitleSize * 0.03}>
              {xLabel}
            </text>
          ) : null}
          {yLabel ? (
            portrait ? (
              <text x={box.x} y={box.y + axisTitleSize * 0.9} fontFamily={font} fontWeight={700} fontSize={axisTitleSize} fill={ink} fillOpacity={0.85} letterSpacing={axisTitleSize * 0.03}>
                {yLabel}
              </text>
            ) : (
              <text transform={`translate(${box.x + axisTitleSize * 0.6} ${(py0 + py1) / 2}) rotate(-90)`} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={axisTitleSize} fill={ink} fillOpacity={0.85} letterSpacing={axisTitleSize * 0.03}>
                {yLabel}
              </text>
            )
          ) : null}
          {sizeLabel ? (
            <text x={px1} y={portrait ? box.y + axisTitleSize * 0.9 : py0 - 14 * u} textAnchor="end" fontFamily={font} fontWeight={500} fontSize={axisTitleSize * 0.82} fill={ink} fillOpacity={0.5}>
              {clip(sizeLabel, (px1 - px0) * 0.5, axisTitleSize * 0.82)}
            </text>
          ) : null}
        </g>

        {/* bubbles */}
        {order.map(({p, i}) => {
          const b = bubblesBox[i];
          const g = ramp(frame, startAt + 6 + (growRank.get(i) || 0) * 6, 34, speed, ease.back);
          if (g <= 0) return null;
          const col = colorOf(p, i);
          const isHl = i === hlIdx;
          const dim = hlIdx >= 0 && !isHl ? 1 - 0.5 * hlT : 1;
          const rr = b.r * g * (isHl ? 1 + 0.12 * hlT : 1);
          return (
            <g key={'b' + i} opacity={dim}>
              <circle cx={b.x} cy={b.y} r={rr} fill={col} fillOpacity={bubbleOpacity} stroke={col} strokeWidth={2.5 * u} />
              {isHl && <circle cx={b.x} cy={b.y} r={rr + 9 * u * hlT} fill="none" stroke={ink} strokeOpacity={0.7 * hlT} strokeWidth={2.5 * u} />}
            </g>
          );
        })}

        {/* labels */}
        {pts.map((p, i) => {
          const lp = labelPos.get(i);
          if (!lp) return null;
          const t = prog(frame, startAt + 20 + (growRank.get(i) || 0) * 6 / speed, startAt + 36 + (growRank.get(i) || 0) * 6 / speed, ease.out);
          const col = colorOf(p, i);
          const dim = hlIdx >= 0 && i !== hlIdx ? 1 - 0.55 * hlT : 1;
          return (
            <text
              key={'l' + i}
              x={lp.x}
              y={lp.y}
              textAnchor={lp.anchor}
              fontFamily={font}
              fontWeight={700}
              fontSize={fs}
              fill={lp.inside ? textOn(blend(col, background, bubbleOpacity)) : ink}
              stroke={lp.inside ? 'none' : bgSolid}
              strokeWidth={5 * u}
              strokeLinejoin="round"
              paintOrder="stroke"
              opacity={t * dim}
            >
              {lp.text}
            </text>
          );
        })}

        {showLegend && (
          <Legend
            items={groups.map((g, i) => ({label: g, color: itemColor(undefined, colors, i)}))}
            x={box.x + yAxisW}
            y={box.y + box.h - legH}
            w={box.w - yAxisW}
            cols={portrait ? 2 : Math.min(groups.length, 6)}
            rowH={legSize * 2}
            size={legSize}
            ink={ink}
            fontFamily={font}
            frame={frame}
            start={startAt + 30}
            stagger={4}
            shape="dot"
          />
        )}
      </Svg>
    </AbsoluteFill>
  );
};

export const bubbleScatterGrow = defineMotion<Props>({
  id: 'bubble-scatter-grow',
  title: 'Bubble scatter grow',
  category: 'data',
  description:
    'A bubble chart: axes and grid fade in, then bubbles grow in from left to right at their x / y position with area proportional to size, coloured per group, with collision-aware labels and an optional highlighted bubble with a ring.',
  source: ['original round-3 chart motion'],
  useFor:
    'Three-variable comparisons: markets by size, growth and margin, countries, products, campaigns, startups. Pass points as [{label, x, y, size, group?, color?}], axis titles and number formats; works on a transparent background.',
  durationInFrames: 180,
  defaultProps: {
    points: DEFAULT_POINTS,
    title: 'Reach vs engagement',
    subtitle: 'Bubble area shows audience size',
    xLabel: 'Reach (thousands)',
    yLabel: 'Engagement',
    sizeLabel: 'Bubble size = audience',
    xPrefix: '',
    xSuffix: '',
    yPrefix: '',
    ySuffix: '%',
    xDecimals: 0,
    yDecimals: 0,
    zeroBased: true,
    showLabels: true,
    labelTop: 0,
    maxRadius: 96,
    bubbleOpacity: 0.72,
    highlight: '',
    colors: ['#2F6FED', '#FF7A45', '#16B39A', '#F2B134', '#8E5CF0', '#E5487F', '#5BC0EB', '#7A8794'],
    background: '#F5F3EE',
    ink: '#18212B',
    fontFamily: '',
    startAt: 10,
    speed: 1,
  },
  propDocs: {
    points: 'bubbles [{label, x, y, size, group?, color?}]; group sets the colour and builds the legend',
    title: 'headline (empty = none)',
    subtitle: 'small line under the headline (empty = none)',
    xLabel: 'x-axis title (empty = none)',
    yLabel: 'y-axis title (empty = none)',
    sizeLabel: 'small note about what the bubble size means (empty = none)',
    xPrefix: 'text before x-axis numbers',
    xSuffix: 'text after x-axis numbers',
    yPrefix: 'text before y-axis numbers',
    ySuffix: 'text after y-axis numbers, e.g. "%"',
    xDecimals: 'decimals on x-axis numbers',
    yDecimals: 'decimals on y-axis numbers',
    zeroBased: 'start both axes at zero (false zooms to the data range)',
    showLabels: 'print bubble labels (inside when they fit, else beside, skipping collisions)',
    labelTop: 'only label the N largest bubbles (0 = all that fit)',
    maxRadius: 'radius of the largest bubble in u (capped to the plot size)',
    bubbleOpacity: 'fill opacity of bubbles 0-1',
    highlight: 'label of a bubble to ring and spotlight at the end (empty = none)',
    colors: 'palette for groups / bubbles without their own colour',
    background: 'page colour, or "transparent" to sit over other content',
    ink: 'text and grid colour',
    fontFamily: 'CSS font family (empty = Space Grotesk)',
    startAt: 'frame the axes start to appear',
    speed: 'animation speed multiplier',
  },
  component: BubbleScatterGrow,
  tags: ['bubble', 'scatter', 'chart', 'axes', 'grow', 'comparison', 'infographic', 'data', 'overlay', 'statistics', 'market', 'plot'],
});
