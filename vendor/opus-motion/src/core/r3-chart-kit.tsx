import React from 'react';
import {clamp, ease, prog} from './ease';
import {fonts} from './fonts';
import {useStage} from './stage';

/**
 * Round-3 chart kit: shared pieces for the reusable chart / infographic motions
 * (donut-breakdown, bar-race, gauge-kpi-dial, funnel-conversion, radar-compare, waterfall-bridge,
 * stacked-area-flow, progress-rings-stats).
 *
 * Every chart takes its data, labels, colours and number formatting as props; this file holds the
 * layout box (title + subtitle header), the legend, number formatting and a few geometry helpers.
 */

export const PALETTE = ['#2F6FED', '#FF7A45', '#16B39A', '#F2B134', '#8E5CF0', '#E5487F', '#5BC0EB', '#7A8794'];

/** colour i of a list, falling back to the default palette */
export const pickColor = (colors: string[] | undefined, i: number) =>
  colors && colors.length ? colors[i % colors.length] : PALETTE[i % PALETTE.length];

export const itemColor = (c: string | undefined, colors: string[] | undefined, i: number) => c || pickColor(colors, i);

/** 1,234.5 with prefix / suffix / decimals; negative sign goes in front of the prefix */
export const fmt = (v: number, decimals = 0, prefix = '', suffix = '', signed = false) => {
  const d = Math.max(0, Math.round(decimals));
  const r = Math.round(Math.abs(v) * 10 ** d);
  const neg = v < 0 && r > 0;
  const s = Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
  return `${neg ? '-' : signed && r > 0 ? '+' : ''}${prefix}${s}${suffix}`;
};

const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.4;
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(s.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
/** readable text colour on a filled shape */
export const textOn = (hex: string, light = '#FFFFFF', dark = '#14181F') => (lum(hex) > 0.42 ? dark : light);

/** rough text width estimate (em factor) */
export const tw = (text: string, size: number, f = 0.56) => text.length * size * f;

/** greedy word wrap on an estimated width */
export const wrapLines = (text: string, maxW: number, size: number, f = 0.56, maxLines = 4): string[] => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = '';
  for (const wd of words) {
    const t = cur ? cur + ' ' + wd : wd;
    if (cur && tw(t, size, f) > maxW) {
      lines.push(cur);
      cur = wd;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const keep = lines.slice(0, maxLines);
    keep[maxLines - 1] = keep[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return keep;
  }
  return lines;
};

/** truncate to an estimated width */
export const clip = (text: string, maxW: number, size: number, f = 0.56) => {
  const max = Math.max(1, Math.floor(maxW / (size * f)));
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text;
};

/** point on a circle; angle in degrees, 0 = up, clockwise */
export const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};

/** filled annulus sector between radii r0..r1 and angles a0..a1 (degrees, 0 = up, clockwise) */
export const arcPath = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) => {
  const sweep = Math.max(0.01, Math.min(359.99, a1 - a0));
  const e = a0 + sweep;
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, e);
  const [x2, y2] = polar(cx, cy, r0, e);
  const [x3, y3] = polar(cx, cy, r0, a0);
  const large = sweep > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
};

/** open arc stroke path (for rings) */
export const ringPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const sweep = Math.max(0.01, Math.min(359.99, a1 - a0));
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a0 + sweep);
  return `M${x0} ${y0} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

/** "nice" axis maximum and step for a value range */
export const niceScale = (lo: number, hi: number, ticks = 5) => {
  const span = Math.max(1e-9, hi - lo);
  const raw = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  return {min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step};
};

export interface ChartBox {
  /** content rectangle under the header */
  x: number;
  y: number;
  w: number;
  h: number;
  /** left edge / width of the whole padded frame */
  px: number;
  pw: number;
  titleLines: string[];
  titleSize: number;
  subLines: string[];
  subSize: number;
  /** y of the first title baseline / first subtitle baseline */
  titleY: number;
  subY: number;
  headerBottom: number;
  u: number;
  portrait: boolean;
  square: boolean;
}

/** padded layout box with the header (title + subtitle) measured; same for 16:9, 1:1 and 9:16 */
export const useChartBox = (title: string, subtitle: string): ChartBox => {
  const {w, h, u, portrait, square} = useStage();
  const padX = (portrait ? 64 : square ? 80 : 104) * u;
  const padTop = (portrait ? 116 : square ? 72 : 80) * u;
  const padBottom = (portrait ? 150 : square ? 72 : 76) * u;
  const pw = w - padX * 2;
  const titleSize = (portrait ? 68 : square ? 56 : 62) * u;
  const subSize = (portrait ? 30 : 26) * u;
  const titleLines = wrapLines(title, pw, titleSize, 0.54, 3);
  const subLines = wrapLines(subtitle, pw, subSize, 0.56, 3);
  const titleY = padTop + titleSize * 0.82;
  const subY = titleLines.length ? padTop + titleLines.length * titleSize * 1.12 + 14 * u + subSize * 0.95 : padTop + subSize * 0.95;
  let hb = padTop;
  if (titleLines.length) hb = padTop + titleLines.length * titleSize * 1.12;
  if (subLines.length) hb += (titleLines.length ? 14 * u : 0) + subLines.length * subSize * 1.35;
  const gap = titleLines.length || subLines.length ? (portrait ? 56 : 40) * u : 0;
  const y = hb + gap;
  return {x: padX, y, w: pw, h: Math.max(60 * u, h - padBottom - y), px: padX, pw, titleLines, titleSize, subLines, subSize, titleY, subY, headerBottom: hb, u, portrait, square};
};

export const Header: React.FC<{box: ChartBox; ink: string; fontFamily: string; frame: number; startAt?: number; muted?: number}> = ({
  box,
  ink,
  fontFamily,
  frame,
  startAt = 0,
  muted = 0.62,
}) => {
  const {u} = box;
  const t = prog(frame, startAt, startAt + 18, ease.out);
  const t2 = prog(frame, startAt + 5, startAt + 24, ease.out);
  const ty = box.titleY;
  const subY = box.subY;
  return (
    <g>
      {box.titleLines.map((l, i) => (
        <text
          key={'t' + i}
          x={box.px}
          y={ty + i * box.titleSize * 1.12 + (1 - t) * 18 * u}
          opacity={t}
          fontFamily={fontFamily}
          fontWeight={700}
          fontSize={box.titleSize}
          letterSpacing={-0.5 * u}
          fill={ink}
        >
          {l}
        </text>
      ))}
      {box.subLines.map((l, i) => (
        <text
          key={'s' + i}
          x={box.px}
          y={subY + i * box.subSize * 1.35 + (1 - t2) * 14 * u}
          opacity={t2 * muted}
          fontFamily={fontFamily}
          fontWeight={500}
          fontSize={box.subSize}
          fill={ink}
        >
          {l}
        </text>
      ))}
    </g>
  );
};

export interface LegendItem {
  label: string;
  color: string;
  /** optional value text shown right-aligned */
  value?: string;
}

/** height of a legend laid out in `cols` columns */
export const legendHeight = (n: number, cols: number, rowH: number) => Math.ceil(n / Math.max(1, cols)) * rowH;

/** swatch + label legend; items fade/slide in with a stagger; `dim(i)` can dim entries */
export const Legend: React.FC<{
  items: LegendItem[];
  x: number;
  y: number;
  w: number;
  cols?: number;
  rowH: number;
  size: number;
  ink: string;
  fontFamily: string;
  frame: number;
  start: number;
  stagger?: number;
  dim?: (i: number) => number;
  /** swatch shape */
  shape?: 'square' | 'dot' | 'line';
  align?: 'start' | 'center';
}> = ({items, x, y, w, cols = 1, rowH, size, ink, fontFamily, frame, start, stagger = 4, dim, shape = 'square', align = 'start'}) => {
  const c = Math.max(1, Math.min(cols, items.length));
  const cellW = w / c;
  const sw = size * 0.72;
  return (
    <g>
      {items.map((it, i) => {
        const col = i % c;
        const row = Math.floor(i / c);
        const inRow = Math.min(c, items.length - row * c);
        const rowOffset = align === 'center' ? ((c - inRow) * cellW) / 2 : 0;
        const t = prog(frame, start + i * stagger, start + i * stagger + 14, ease.out);
        const d = dim ? dim(i) : 1;
        const gx = x + rowOffset + col * cellW;
        const gy = y + row * rowH + rowH / 2;
        return (
          <g key={i} opacity={t * d} transform={`translate(${(1 - t) * -14 * (size / 26)} 0)`}>
            {shape === 'line' ? (
              <rect x={gx} y={gy - sw * 0.14} width={sw * 1.4} height={sw * 0.28} rx={sw * 0.14} fill={it.color} />
            ) : shape === 'dot' ? (
              <circle cx={gx + sw / 2} cy={gy} r={sw / 2} fill={it.color} />
            ) : (
              <rect x={gx} y={gy - sw / 2} width={sw} height={sw} rx={sw * 0.24} fill={it.color} />
            )}
            <text
              x={gx + sw * (shape === 'line' ? 1.4 : 1) + size * 0.5}
              y={gy + size * 0.35}
              fontFamily={fontFamily}
              fontWeight={600}
              fontSize={size}
              fill={ink}
            >
              {clip(it.label, cellW - sw * 1.6 - size * (it.value ? 4.2 : 0.6) - (c > 1 ? size * 1.4 : 0), size)}
            </text>
            {it.value !== undefined && (
              <text
                x={gx + cellW - size * 0.6 - (c > 1 ? size * 1.4 : 0)}
                y={gy + size * 0.35}
                textAnchor="end"
                fontFamily={fontFamily}
                fontWeight={700}
                fontSize={size}
                fill={ink}
                style={{fontVariantNumeric: 'tabular-nums'}}
              >
                {it.value}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};

/** common timing helper: progress 0..1 starting at `start`, `dur` frames at speed 1 */
export const ramp = (frame: number, start: number, dur: number, speed: number, e: (t: number) => number = ease.out) =>
  prog(frame, start, start + dur / Math.max(0.05, speed), e);

export const resolveFont = (family: string | undefined, role: keyof typeof fonts = 'grotesk') => (family && family.trim() ? family : fonts[role]);

export const clamp01 = (v: number) => clamp(v, 0, 1);
