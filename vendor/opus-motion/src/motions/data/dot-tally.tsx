// Idea after lemo-opuscar styles/visual-investigation demo sPeople() dot grid (MIT, LemoLab) — see THIRD_PARTY_NOTICES.md.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ease, prog} from '../../core/ease';
import {fonts} from '../../core/fonts';
import {rng} from '../../core/random';
import {useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type Group = {label: string; count: number; marked: number};
type Props = {
  groups: Group[];
  cols: number;
  background: string;
  ink: string;
  accent: string;
  markStyle: 'ring' | 'fill' | 'cross';
  markStart: number;
  stagger: number;
  groupGap: number;
  shuffle: boolean;
  total: string;
  totalLabel: string;
  legend: [string, string];
  seed: number;
};

const DotTally: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const {w, h, u, portrait} = useStage();
  const groups = p.groups.length ? p.groups : [];
  const cols = Math.max(4, p.cols);
  const areaW = portrait ? w - 120 * u : w * 0.6;
  const pitch = Math.min(54 * u, areaW / cols);
  const radius = pitch * 0.3;
  const gx = portrait ? 60 * u : 96 * u;
  const labelH = 40 * u;
  const rowsOf = (g: Group) => Math.ceil(g.count / cols);
  const gridH = groups.reduce((s, g) => s + labelH + rowsOf(g) * pitch + 34 * u, 0);
  const top = portrait ? 120 * u : Math.max(60 * u, (h - gridH) / 2 - 20 * u);

  const marks = React.useMemo(
    () =>
      groups.map((g, gi) => {
        const idx = Array.from({length: g.count}, (_, i) => i);
        if (p.shuffle) {
          const r = rng(p.seed * 31 + gi);
          for (let i = idx.length - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            [idx[i], idx[j]] = [idx[j], idx[i]];
          }
        }
        const order = new Map<number, number>();
        idx.slice(0, Math.min(g.marked, g.count)).forEach((dot, k) => order.set(dot, k));
        return order;
      }),
    [groups, p.shuffle, p.seed],
  );

  let t0 = p.markStart;
  const starts = groups.map((g) => {
    const s = t0;
    t0 += g.marked * p.stagger + p.groupGap;
    return s;
  });
  const markEnd = t0 - p.groupGap;
  const markedNow = groups.reduce((s, g, gi) => s + Math.min(g.marked, Math.max(0, Math.floor((frame - starts[gi]) / p.stagger) + 1)), 0);
  const markedAll = groups.reduce((s, g) => s + g.marked, 0);
  const countAll = groups.reduce((s, g) => s + g.count, 0);
  const landT = prog(frame, markEnd + 6, markEnd + 24, ease.back);

  let yy = top;
  const out: React.ReactNode[] = [];
  groups.forEach((g, gi) => {
    const gy = yy;
    const labIn = prog(frame, gi * 6, gi * 6 + 14, ease.out);
    out.push(
      <text key={`l${gi}`} x={gx} y={gy + 24 * u} fill={p.ink} opacity={0.7 * labIn} fontFamily={fonts.mono} fontSize={19 * u} letterSpacing={3 * u}>
        {g.label.toUpperCase()}
      </text>,
    );
    for (let i = 0; i < g.count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = gx + c * pitch + pitch / 2;
      const y = gy + labelH + r * pitch + pitch / 2;
      const enter = prog(frame, 4 + gi * 8 + i * 0.35, 4 + gi * 8 + i * 0.35 + 12, ease.back);
      const mo = marks[gi].get(i);
      const mt = mo === undefined ? 0 : prog(frame, starts[gi] + mo * p.stagger, starts[gi] + mo * p.stagger + 8, ease.out);
      const rr = radius * enter;
      if (p.markStyle === 'fill') {
        out.push(<circle key={`${gi}-${i}`} cx={x} cy={y} r={rr} fill={mt > 0.5 ? p.accent : p.ink} />);
      } else if (p.markStyle === 'cross') {
        out.push(
          <g key={`${gi}-${i}`}>
            <circle cx={x} cy={y} r={rr} fill={p.ink} opacity={1 - mt * 0.7} />
            <path d={`M${x - radius} ${y - radius}L${x + radius} ${y + radius}M${x + radius} ${y - radius}L${x - radius} ${y + radius}`} stroke={p.accent} strokeWidth={2.4 * u} strokeLinecap="round" opacity={mt} />
          </g>,
        );
      } else {
        out.push(
          <g key={`${gi}-${i}`}>
            <circle cx={x} cy={y} r={rr} fill={p.ink} opacity={1 - mt} />
            <circle cx={x} cy={y} r={rr * (1 + 0.25 * (1 - mt))} fill="none" stroke={p.accent} strokeWidth={1.8 * u} opacity={mt} />
          </g>,
        );
      }
    }
    yy += labelH + rowsOf(g) * pitch + 34 * u;
  });

  const bigX = portrait ? w / 2 : w * 0.78;
  const bigY = portrait ? Math.min(h - 360 * u, yy + 170 * u) : h * 0.46;
  const totalText = p.total && p.total.length ? p.total : String(markedAll);
  const shown = frame < markEnd ? String(markedNow) : totalText;

  return (
    <AbsoluteFill style={{background: p.background}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        {out}
        <g opacity={prog(frame, p.markStart - 6, p.markStart + 8, ease.out)}>
          <text x={bigX} y={bigY} textAnchor="middle" fill={p.accent} fontFamily={fonts.sans} fontWeight={800} fontSize={(portrait ? 230 : 190) * u * (frame < markEnd ? 1 : 1 + 0.08 * (1 - landT))} letterSpacing={-4 * u}>
            {shown}
          </text>
          <text x={bigX} y={bigY + 52 * u} textAnchor="middle" fill={p.ink} opacity={0.75} fontFamily={fonts.sans} fontWeight={600} fontSize={30 * u}>
            {p.totalLabel || `of ${countAll}`}
          </text>
        </g>
        <g opacity={landT} transform={`translate(${bigX} ${bigY + 118 * u})`} fontFamily={fonts.mono} fontSize={20 * u} fill={p.ink} textAnchor="middle">
          <text x={0} y={0}>
            <tspan fill={p.ink}>{'● '}</tspan>
            <tspan>{p.legend[0]}</tspan>
            <tspan dx={26 * u} fill={p.accent}>{'○ '}</tspan>
            <tspan>{p.legend[1]}</tspan>
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const dotTally = defineMotion<Props>({
  id: 'dot-tally',
  title: 'Dot tally (people as dots)',
  category: 'data',
  description:
    'One dot per person in labelled groups; selected dots turn one by one from filled cream discs into open red rings while a huge counter runs; the total and a two-symbol legend land at the end.',
  source: ['lemo-opuscar styles/visual-investigation demo sPeople() (MIT, LemoLab) — idea, own SVG build'],
  useFor: 'Casualties, survey answers ("37 of 100 said…"), seats won, users affected, failure rates — a restrained alternative to a bar chart an agent can generate from two numbers.',
  durationInFrames: 240,
  defaultProps: {
    groups: [
      {label: 'Customers', count: 72, marked: 26},
      {label: 'Partners', count: 36, marked: 15},
    ],
    cols: 18,
    background: '#0F1012',
    ink: '#ECEAE4',
    accent: '#FF4A2E',
    markStyle: 'ring',
    markStart: 50,
    stagger: 0.9,
    groupGap: 14,
    shuffle: true,
    total: '',
    totalLabel: '',
    legend: ['unaffected', 'affected'],
    seed: 5,
  },
  propDocs: {
    groups: '[{label, count, marked}] one grid per group; `marked` dots turn',
    cols: 'dots per row',
    background: 'background colour',
    ink: 'colour of the filled dots and text',
    accent: 'colour of marked dots and the big number',
    markStyle: "'ring' | 'fill' | 'cross'",
    markStart: 'frame the first dot turns',
    stagger: 'frames between marked dots',
    groupGap: 'frames pause between groups',
    shuffle: 'mark in seeded random order (false = row order)',
    total: 'text for the final big figure (default: number of marked dots)',
    totalLabel: 'line under the figure (default "of N")',
    legend: '[unmarked label, marked label]',
    seed: 'shuffle seed',
  },
  component: DotTally,
  tags: ['dots', 'tally', 'survey', 'statistic', 'people', 'count', 'casualties', 'ring', 'chart', 'pictogram', 'proportion'],
});
