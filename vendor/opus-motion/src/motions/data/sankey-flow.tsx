import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp, ease, prog} from '../../core/ease';
import {Header, clip, fmt, pickColor, ramp, resolveFont, tw, useChartBox} from '../../core/r3-chart-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

type LinkIn = {from: string; to: string; value: number; color?: string};
type Props = {
  links: LinkIn[];
  nodeColors: Record<string, string>;
  title: string;
  subtitle: string;
  prefix: string;
  suffix: string;
  decimals: number;
  showValues: boolean;
  linkMode: 'gradient' | 'source' | 'target';
  linkOpacity: number;
  nodeWidth: number;
  nodePad: number;
  align: 'justify' | 'left';
  highlight: string;
  colors: string[];
  background: string;
  ink: string;
  fontFamily: string;
  startAt: number;
  speed: number;
};

const DEFAULT_LINKS: LinkIn[] = [
  {from: 'Organic', to: 'Visitors', value: 420},
  {from: 'Paid', to: 'Visitors', value: 260},
  {from: 'Referral', to: 'Visitors', value: 180},
  {from: 'Visitors', to: 'Sign-ups', value: 380},
  {from: 'Visitors', to: 'Bounced', value: 480},
  {from: 'Sign-ups', to: 'Trial', value: 300},
  {from: 'Sign-ups', to: 'Inactive', value: 80},
  {from: 'Trial', to: 'Paying', value: 170},
  {from: 'Trial', to: 'Churned', value: 130},
];

type N = {id: string; i: number; depth: number; vin: number; vout: number; value: number; y: number; h: number; x: number; col: number; color: string};
type L = {i: number; s: N; t: N; value: number; sy: number; ty: number; w: number; color?: string};

const SankeyFlow: React.FC<Props> = ({
  links,
  nodeColors,
  title,
  subtitle,
  prefix,
  suffix,
  decimals,
  showValues,
  linkMode,
  linkOpacity,
  nodeWidth,
  nodePad,
  align,
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

  const layout = React.useMemo(() => {
    const clean = (links || []).filter((l) => l && l.from && l.to && l.from !== l.to && l.value > 0);
    const byId = new Map<string, N>();
    const getN = (id: string) => {
      let n = byId.get(id);
      if (!n) {
        n = {id, i: byId.size, depth: 0, vin: 0, vout: 0, value: 0, y: 0, h: 0, x: 0, col: 0, color: ''};
        byId.set(id, n);
      }
      return n;
    };
    clean.forEach((l) => {
      getN(l.from);
      getN(l.to);
    });
    const nodes = [...byId.values()];
    // depth by relaxation (bounded so cycles cannot loop forever)
    for (let it = 0; it < nodes.length + 1; it++) {
      let ch = false;
      clean.forEach((l) => {
        const a = byId.get(l.from)!;
        const b = byId.get(l.to)!;
        if (b.depth < a.depth + 1 && a.depth < nodes.length) {
          b.depth = a.depth + 1;
          ch = true;
        }
      });
      if (!ch) break;
    }
    const ok = clean.filter((l) => byId.get(l.to)!.depth > byId.get(l.from)!.depth);
    ok.forEach((l) => {
      byId.get(l.from)!.vout += l.value;
      byId.get(l.to)!.vin += l.value;
    });
    let maxDepth = 0;
    nodes.forEach((n) => (maxDepth = Math.max(maxDepth, n.depth)));
    nodes.forEach((n) => {
      n.value = Math.max(n.vin, n.vout, 1e-9);
      if (align === 'justify' && n.vout === 0 && n.depth > 0) n.depth = maxDepth;
    });
    const cols: N[][] = Array.from({length: maxDepth + 1}, () => []);
    nodes.forEach((n) => {
      n.col = n.depth;
      cols[n.depth].push(n);
    });
    // order nodes in each column with a few barycentre sweeps to cut crossings
    const order = new Map<string, number>();
    cols.forEach((c) => c.forEach((n, k) => order.set(n.id, k)));
    for (let sweep = 0; sweep < 6; sweep++) {
      const down = sweep % 2 === 0;
      const seq = down ? cols.map((_, k) => k) : cols.map((_, k) => cols.length - 1 - k);
      seq.forEach((ci) => {
        const c = cols[ci];
        const bary = new Map<string, number>();
        c.forEach((n) => {
          const rel = ok.filter((l) => (down ? l.to === n.id : l.from === n.id));
          let sw = 0;
          let s = 0;
          rel.forEach((l) => {
            const o = order.get(down ? l.from : l.to) ?? 0;
            sw += l.value;
            s += o * l.value;
          });
          bary.set(n.id, sw ? s / sw : order.get(n.id)!);
        });
        c.sort((a, b) => bary.get(a.id)! - bary.get(b.id)! || a.i - b.i);
        c.forEach((n, k) => order.set(n.id, k));
      });
    }
    return {nodes, cols, links: ok};
  }, [JSON.stringify(links), align]);

  const {nodes, cols, links: okLinks} = layout;
  const nCols = cols.length;
  const labelSize = (portrait ? 28 : square ? 26 : 26) * u;
  const valSize = labelSize * 0.82;
  const nw = nodeWidth * u * (portrait ? 0.9 : 1);

  // margins for labels of the first and last column
  const labW = (c: N[]) => c.reduce((m, n) => Math.max(m, tw(n.id, labelSize, 0.6)), 0);
  const capLab = (portrait ? 0.2 : 0.17) * box.w;
  const leftM = Math.min(capLab, labW(cols[0] || []) + (showValues ? 40 * u : 22 * u));
  const rightM = Math.min(capLab, labW(cols[nCols - 1] || []) + (showValues ? 64 * u : 22 * u));
  const innerX0 = box.x + leftM;
  const innerX1 = box.x + box.w - rightM - nw;
  const colStep = nCols > 1 ? (innerX1 - innerX0) / (nCols - 1) : 0;

  // vertical scale shared by all columns
  const pad = nodePad * u;
  let ky = Infinity;
  cols.forEach((c) => {
    const tot = c.reduce((a, n) => a + n.value, 0) || 1;
    ky = Math.min(ky, (box.h - (c.length - 1) * pad) / tot);
  });
  if (!isFinite(ky)) ky = 1;
  cols.forEach((c, ci) => {
    const tot = c.reduce((a, n) => a + n.value * ky, 0) + (c.length - 1) * pad;
    let y = box.y + (box.h - tot) / 2;
    c.forEach((n) => {
      n.x = innerX0 + ci * colStep;
      n.y = y;
      n.h = n.value * ky;
      n.color = nodeColors?.[n.id] || pickColor(colors, n.i);
      y += n.h + pad;
    });
  });

  // stack link ends inside nodes
  const outs = new Map<string, L[]>();
  const ins = new Map<string, L[]>();
  const L2: L[] = okLinks.map((l, i) => {
    const s = nodes.find((n) => n.id === l.from)!;
    const t = nodes.find((n) => n.id === l.to)!;
    return {i, s, t, value: l.value, sy: 0, ty: 0, w: l.value * ky, color: l.color};
  });
  L2.forEach((l) => {
    (outs.get(l.s.id) || outs.set(l.s.id, []).get(l.s.id)!).push(l);
    (ins.get(l.t.id) || ins.set(l.t.id, []).get(l.t.id)!).push(l);
  });
  nodes.forEach((n) => {
    let y = n.y;
    (outs.get(n.id) || []).sort((a, b) => a.t.y - b.t.y).forEach((l) => {
      l.sy = y;
      y += l.w;
    });
    y = n.y;
    (ins.get(n.id) || []).sort((a, b) => a.s.y - b.s.y).forEach((l) => {
      l.ty = y;
      y += l.w;
    });
  });

  const hl = highlight && nodes.some((n) => n.id === highlight) ? highlight : '';
  const hlT = hl ? prog(frame, startAt + (nCols * 16 + 50) / speed, startAt + (nCols * 16 + 70) / speed, ease.out) : 0;
  const linkOn = (l: L) => (hl ? l.s.id === hl || l.t.id === hl : true);
  const haloColor = background && background !== 'transparent' ? background : 'none';
  const uid = 'sankey-flow';

  return (
    <AbsoluteFill style={{background}}>
      <Svg>
        <defs>
          {L2.map((l) => {
            const t = ramp(frame, startAt + l.s.col * 16 + 8, 46, speed, ease.inOut);
            const x0 = l.s.x + nw;
            const x1 = l.t.x;
            const top = Math.min(l.sy, l.ty) - 4;
            const bot = Math.max(l.sy, l.ty) + l.w + 4;
            return (
              <React.Fragment key={l.i}>
                <clipPath id={`${uid}-c${l.i}`}>
                  <rect x={x0 - 1} y={top} width={Math.max(0, (x1 - x0 + 2) * t)} height={bot - top} />
                </clipPath>
                {linkMode === 'gradient' && !l.color && (
                  <linearGradient id={`${uid}-g${l.i}`} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x1} y2={0}>
                    <stop offset="0" stopColor={l.s.color} />
                    <stop offset="1" stopColor={l.t.color} />
                  </linearGradient>
                )}
              </React.Fragment>
            );
          })}
        </defs>
        <Header box={box} ink={ink} fontFamily={font} frame={frame} />

        {/* ribbons */}
        {L2.map((l) => {
          const x0 = l.s.x + nw;
          const x1 = l.t.x;
          const xm = (x0 + x1) / 2;
          const w = Math.max(1.5 * u, l.w);
          const p = `M${x0} ${l.sy} C${xm} ${l.sy} ${xm} ${l.ty} ${x1} ${l.ty} L${x1} ${l.ty + w} C${xm} ${l.ty + w} ${xm} ${l.sy + w} ${x0} ${l.sy + w} Z`;
          const fill = l.color || (linkMode === 'gradient' ? `url(#${uid}-g${l.i})` : linkMode === 'target' ? l.t.color : l.s.color);
          const on = linkOn(l);
          return (
            <path key={l.i} d={p} fill={fill} opacity={linkOpacity * (on ? 1 : 1 - 0.7 * hlT)} clipPath={`url(#${uid}-c${l.i})`} />
          );
        })}

        {/* nodes */}
        {nodes.map((n) => {
          const ns0 = startAt + (n.col === 0 ? 0 : n.col * 16 + 22 / speed);
          const t = ramp(frame, ns0, 26, speed, ease.out);
          const cy = n.y + n.h / 2;
          const hh = Math.max(3 * u, n.h) * t;
          const connected = !hl || n.id === hl || L2.some((l) => (l.s.id === hl && l.t.id === n.id) || (l.t.id === hl && l.s.id === n.id));
          const dim = connected ? 1 : 1 - 0.6 * hlT;
          const first = n.col === 0;
          const lx = first ? n.x - 14 * u : n.x + nw + 14 * u;
          const room = first ? leftM - 18 * u : (n.col === nCols - 1 ? rightM - 18 * u : box.x + box.w - lx);
          const lt = prog(frame, ns0 + 8 / speed, ns0 + 26 / speed, ease.out);
          const vtxt = fmt(n.value, decimals, prefix, suffix);
          const showVal = showValues && n.h >= (labelSize + valSize) * 0.95;
          const inlineVal = showValues && !showVal;
          const label = clip(n.id + (inlineVal ? '  ' + vtxt : ''), Math.max(40 * u, room), labelSize, 0.56);
          return (
            <g key={n.id} opacity={dim}>
              <rect x={n.x} y={cy - hh / 2} width={nw} height={hh} rx={Math.min(6 * u, nw / 3)} fill={n.color} />
              <g opacity={lt} transform={`translate(${(first ? -1 : 1) * (1 - lt) * -10 * u} 0)`}>
                <text
                  x={lx}
                  y={cy + (showVal ? -valSize * 0.1 : labelSize * 0.35)}
                  textAnchor={first ? 'end' : 'start'}
                  fontFamily={font}
                  fontWeight={700}
                  fontSize={labelSize}
                  fill={ink}
                  stroke={haloColor}
                  strokeWidth={5 * u}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {label}
                </text>
                {showVal && (
                  <text
                    x={lx}
                    y={cy + labelSize * 0.35 + valSize * 0.95}
                    textAnchor={first ? 'end' : 'start'}
                    fontFamily={font}
                    fontWeight={500}
                    fontSize={valSize}
                    fill={ink}
                    fillOpacity={0.62}
                    stroke={haloColor}
                    strokeWidth={5 * u}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{fontVariantNumeric: 'tabular-nums'}}
                  >
                    {fmt(n.value * clamp(lt), decimals, prefix, suffix)}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </Svg>
    </AbsoluteFill>
  );
};

export const sankeyFlow = defineMotion<Props>({
  id: 'sankey-flow',
  title: 'Sankey flow',
  category: 'data',
  description:
    'A Sankey diagram built from a list of weighted links: node bars grow column by column and curved ribbons, sized by value and coloured source-to-target, sweep across between them with labels and values; an optional highlighted node dims everything not connected to it.',
  source: ['original round-3 chart motion'],
  useFor:
    'Where things go: traffic to conversions, budget to departments, energy or cash flows, funnels with leaks, user journeys. Pass links as [{from, to, value}], set prefix / suffix and brand colours; works on a transparent background over footage.',
  durationInFrames: 210,
  defaultProps: {
    links: DEFAULT_LINKS,
    nodeColors: {Visitors: '#8E5CF0', Bounced: '#9AA3AD', Inactive: '#B8BEC5', Paying: '#12A150', Churned: '#E5484D'},
    title: 'Where visitors go',
    subtitle: 'Monthly sessions from first touch to paying customer',
    prefix: '',
    suffix: '',
    decimals: 0,
    showValues: true,
    linkMode: 'gradient',
    linkOpacity: 0.5,
    nodeWidth: 26,
    nodePad: 22,
    align: 'left',
    highlight: '',
    colors: ['#2F6FED', '#FF7A45', '#16B39A', '#F2B134', '#8E5CF0', '#E5487F', '#5BC0EB', '#7A8794'],
    background: '#F5F3EE',
    ink: '#18212B',
    fontFamily: '',
    startAt: 8,
    speed: 1,
  },
  propDocs: {
    links: 'weighted links [{from, to, value, color?}]; nodes are created from the names, columns follow the flow direction',
    nodeColors: 'optional node name -> colour overrides, e.g. {"Paid":"#E5487F"}',
    title: 'headline (empty = none)',
    subtitle: 'small line under the headline (empty = none)',
    prefix: 'text before every number, e.g. "$"',
    suffix: 'text after every number, e.g. "K", " users"',
    decimals: 'decimal places on the numbers',
    showValues: 'print each node total (tall nodes: under the name, short nodes: next to it)',
    linkMode: 'ribbon colour: "gradient" (source to target), "source" or "target"',
    linkOpacity: 'ribbon opacity 0-1',
    nodeWidth: 'node bar width in u',
    nodePad: 'vertical gap between nodes of a column in u',
    align: '"justify" pushes end nodes to the last column, "left" keeps them where they land',
    highlight: 'node name to spotlight at the end (empty = none); unrelated nodes and links dim',
    colors: 'palette used for nodes without an override',
    background: 'page colour, or "transparent" to sit over other content',
    ink: 'text colour',
    fontFamily: 'CSS font family (empty = Space Grotesk)',
    startAt: 'frame the first column appears',
    speed: 'animation speed multiplier',
  },
  component: SankeyFlow,
  tags: ['sankey', 'flow', 'links', 'diagram', 'chart', 'funnel', 'budget', 'journey', 'conversion', 'allocation', 'infographic', 'data', 'overlay', 'statistics'],
});
