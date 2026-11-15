import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, prog} from '../../core/ease';
import {Header, clip, fmt, itemColor, ramp, resolveFont, textOn, useChartBox} from '../../core/r3-chart-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type Stage = {label: string; value: number; color?: string};
type Props = {
  stages: Stage[];
  title: string;
  subtitle: string;
  prefix: string;
  suffix: string;
  decimals: number;
  conversionDecimals: number;
  showConversion: boolean;
  showPercentInside: boolean;
  summaryLabel: string;
  colors: string[];
  background: string;
  ink: string;
  fontFamily: string;
  startAt: number;
  speed: number;
};

const STAGES: Stage[] = [
  {label: 'Visitors', value: 48000},
  {label: 'Sign-ups', value: 19200},
  {label: 'Trials', value: 8600},
  {label: 'Paying', value: 3100},
  {label: 'Renewed', value: 1900},
];

const FunnelConversion: React.FC<Props> = ({
  stages,
  title,
  subtitle,
  prefix,
  suffix,
  decimals,
  conversionDecimals,
  showConversion,
  showPercentInside,
  summaryLabel,
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
  const rows = stages.map((s, i) => ({...s, value: Math.max(0, s.value), color: itemColor(s.color, colors, i)}));
  const n = Math.max(1, rows.length);
  const top = Math.max(1e-9, rows[0]?.value || 1);

  const summaryH = summaryLabel ? (portrait ? 100 : 84) * u : 0;
  const areaH = box.h - summaryH;
  const gap = 8 * u;
  const rh = (areaH - gap * (n - 1)) / n;
  const labW = (portrait ? 215 : 270) * u;
  const valW = (portrait ? 215 : 270) * u;
  const funW = box.w - labW - valW - 40 * u;
  const fx = box.x + labW + 20 * u;
  const fcx = fx + funW / 2;
  const fs = Math.min((portrait ? 34 : 34) * u, rh * 0.34);
  const per = 15 / speed;

  const shape = (v: number) => (Math.max(0.0001, v) / top) * funW;

  return (
    <AbsoluteFill style={{background}}>
      <Svg>
        <Header box={box} ink={ink} fontFamily={font} frame={frame} />
        {rows.map((r, i) => {
          const t0 = startAt + i * per;
          const t = prog(frame, t0, t0 + 26 / speed, ease.out);
          if (t <= 0) return null;
          const wTop = shape(r.value);
          const wBot = i < n - 1 ? shape(rows[i + 1].value) : wTop * 0.78;
          const y = box.y + i * (rh + gap);
          const yc = y + rh / 2;
          const wt = wTop * t;
          const wb = wBot * t;
          const pts = `${fcx - wt / 2},${y} ${fcx + wt / 2},${y} ${fcx + wb / 2},${y + rh} ${fcx - wb / 2},${y + rh}`;
          const conv = i > 0 && rows[i - 1].value > 0 ? (r.value / rows[i - 1].value) * 100 : 100;
          const cvT = prog(frame, t0 + 6 / speed, t0 + 22 / speed, ease.out);
          const share = (r.value / top) * 100;
          const inside = showPercentInside && wTop * 0.9 > 110 * u;
          const cnt = r.value * clamp(t * 1.15);
          return (
            <g key={i}>
              <polygon points={pts} fill={r.color} />
              {inside && (
                <text x={fcx} y={yc + fs * 0.36} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={fs} fill={textOn(r.color)} opacity={prog(frame, t0 + 14 / speed, t0 + 28 / speed)}>
                  {fmt(share, share < 10 ? 1 : 0, '', '%')}
                </text>
              )}
              <g opacity={t}>
                <rect x={box.x} y={yc - fs * 0.42} width={fs * 0.84} height={fs * 0.84} rx={fs * 0.2} fill={r.color} />
                <text x={box.x + fs * 1.25} y={yc + fs * 0.36} fontFamily={font} fontWeight={600} fontSize={fs} fill={ink}>
                  {clip(r.label, labW - fs * 1.4, fs)}
                </text>
                <text x={box.x + box.w} y={yc + fs * 0.4} textAnchor="end" fontFamily={font} fontWeight={700} fontSize={fs * 1.3} fill={ink} style={{fontVariantNumeric: 'tabular-nums'}}>
                  {fmt(cnt, decimals, prefix, suffix)}
                </text>
              </g>
              {showConversion && i > 0 && (
                <g opacity={cvT} transform={`translate(0 ${(1 - cvT) * -8 * u})`}>
                  <rect x={box.x + box.w - 150 * u} y={y - gap / 2 - fs * 0.62} width={150 * u} height={fs * 1.24} rx={fs * 0.62} fill={background === 'transparent' ? '#0F1722' : background} />
                  <rect x={box.x + box.w - 150 * u} y={y - gap / 2 - fs * 0.62} width={150 * u} height={fs * 1.24} rx={fs * 0.62} fill={ink} fillOpacity={0.1} />
                  <text x={box.x + box.w - 75 * u} y={y - gap / 2 + fs * 0.27} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={fs * 0.82} fill={ink} fillOpacity={0.85}>
                    {`↓ ${fmt(conv * clamp(cvT), conversionDecimals, '', '%')}`}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {summaryLabel && rows.length > 1 && (
          <g opacity={prog(frame, startAt + n * per + 6, startAt + n * per + 22)}>
            <line x1={box.x} x2={box.x + box.w} y1={box.y + areaH + 14 * u} y2={box.y + areaH + 14 * u} stroke={ink} strokeOpacity={0.18} strokeWidth={2 * u} />
            <text x={box.x} y={box.y + areaH + summaryH * 0.78} fontFamily={font} fontWeight={600} fontSize={fs * 1.05} fill={ink} fillOpacity={0.7}>
              {summaryLabel}
            </text>
            <text x={box.x + box.w} y={box.y + areaH + summaryH * 0.8} textAnchor="end" fontFamily={font} fontWeight={700} fontSize={fs * 1.5} fill={rows[rows.length - 1].color} style={{fontVariantNumeric: 'tabular-nums'}}>
              {fmt((rows[rows.length - 1].value / top) * 100 * ramp(frame, startAt + n * per, 20, speed), rows[rows.length - 1].value / top < 0.1 ? 1 : conversionDecimals, '', '%')}
            </text>
          </g>
        )}
      </Svg>
    </AbsoluteFill>
  );
};

export const funnelConversion = defineMotion<Props>({
  id: 'funnel-conversion',
  title: 'Funnel conversion',
  category: 'data',
  description:
    'A conversion funnel: stage bars narrow in proportion to their value and grow in one after another from the top, labels with colour keys on the left, count-up values on the right, step-to-step "↓ 40%" conversion pills between stages and an overall conversion figure at the bottom.',
  source: ['original round-3 chart motion'],
  useFor: 'Sales and signup funnels, hiring pipelines, checkout drop-off, content-to-lead stories, any "how many survive each step" breakdown. Replace stages, colours, prefix / suffix.',
  durationInFrames: 180,
  defaultProps: {
    stages: STAGES,
    title: 'From visit to renewal',
    subtitle: 'Users at each stage of the journey',
    prefix: '',
    suffix: '',
    decimals: 0,
    conversionDecimals: 0,
    showConversion: true,
    showPercentInside: true,
    summaryLabel: 'Overall conversion',
    colors: ['#2F6FED', '#3D83F0', '#3F9AE6', '#2DB3C6', '#16B39A', '#3CC48A'],
    background: '#F5F3EE',
    ink: '#18212B',
    fontFamily: '',
    startAt: 10,
    speed: 1,
  },
  propDocs: {
    stages: 'stages top to bottom [{label, value, color?}]; widths are proportional to value',
    title: 'headline (empty = none)',
    subtitle: 'small line under the headline (empty = none)',
    prefix: 'text before values',
    suffix: 'text after values, e.g. "K"',
    decimals: 'decimals on stage values',
    conversionDecimals: 'decimals on the conversion percentages',
    showConversion: 'show the "↓ n%" pill between stages',
    showPercentInside: 'print each stage share of the top inside its bar when wide enough',
    summaryLabel: 'label of the final overall-conversion line (empty = hide it)',
    colors: 'palette for stages without their own colour',
    background: 'page colour, or "transparent"',
    ink: 'text colour',
    fontFamily: 'CSS font family (empty = Space Grotesk)',
    startAt: 'frame the first stage appears',
    speed: 'animation speed multiplier',
  },
  component: FunnelConversion,
  tags: ['funnel', 'conversion', 'pipeline', 'sales', 'chart', 'data', 'drop-off', 'stages', 'infographic', 'count-up', 'marketing', 'overlay'],
});
