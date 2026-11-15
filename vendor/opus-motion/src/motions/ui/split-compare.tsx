import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import {clamp, ease, prog, tween} from '../../core/ease';
import {fonts} from '../../core/fonts';
import {Plate, resolveSrc} from '../../core/image-kit';
import {useStage} from '../../core/stage';
import {fitSize} from '../../core/text-kit';
import {defineMotion} from '../../core/types';
import {LedgerCounter, LedgerSplit} from '../../core/r2-e2-ui-kit';

/**
 * video3 "split-screen-compare": static presentation chrome (headline + subheading, two synced 16:9 panels,
 * colour-coded labels with a description and a coloured stat line, footnote) around content that plays in
 * perfect sync. Default content is the same procedural plate drawn twice: glowing amber line-art ("wireframe")
 * on the left, full colour on the right, both under one shared camera push. Optional intro: the 2 px divider
 * draws top -> bottom and the panels open outward from it. layout 'wipe' = one frame with a moving divider.
 */
type Side = {label: string; color: string; desc: string; stat: string; src: string; style: 'lines' | 'color' | 'mono' | 'sepia' | 'warm'};

type Props = {
  background: string;
  headline: string;
  subheadline: string;
  footnote: string;
  left: Side;
  right: Side;
  image: string;
  seed: number;
  layout: 'panels' | 'wipe' | 'ledger';
  introWipe: boolean;
  push: number;
  fadeOut: boolean;
  build: boolean;
  headlineColor: string;
  textColor: string;
  dividerColor: string;
  counters: LedgerCounter[];
  stamp: string;
  dividerDrop: number;
  stampColor: string;
  badTint: string;
};

const STYLE_FILTER: Record<string, string> = {
  color: 'none',
  mono: 'grayscale(1) contrast(1.15) brightness(1.05)',
  sepia: 'sepia(0.85) contrast(1.05) brightness(0.95)',
  warm: 'saturate(1.25) contrast(1.05) sepia(0.15)',
};

/** one panel's moving content (same camera for both sides -> perfect sync) */
const PanelContent: React.FC<{side: Side; image: string; seed: number; pw: number; ph: number; zoom: number; dx: number; dy: number; fid: string}> = ({side, image, seed, pw, ph, zoom, dx, dy, fid}) => {
  const src = side.src || image;
  const tr: React.CSSProperties = {transform: `translate(${dx}px, ${dy}px) scale(${zoom})`, transformOrigin: '50% 55%'};
  if (!src) {
    const lines = side.style === 'lines';
    return (
      <div style={{position: 'absolute', inset: 0, ...tr, filter: lines ? 'none' : STYLE_FILTER[side.style] ?? 'none'}}>
        <Plate width={pw} height={ph} seed={seed} mode={lines ? 'lines' : 'color'} stroke={lines ? '#F2C48C' : undefined} ground={lines ? '#0d0a07' : undefined} />
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', inset: 0, ...tr, background: '#0d0a07'}}>
      <Img src={resolveSrc(src)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: side.style === 'lines' ? `url(#${fid})` : STYLE_FILTER[side.style] ?? 'none'}} />
    </div>
  );
};

const LabelStack: React.FC<{side: Side; x: number; y: number; u: number; maxW: number; t: number; textColor: string}> = ({side, x, y, u, maxW, t, textColor}) => {
  const ls = fitSize(side.label, 38 * u, maxW, 'sans');
  const ds = fitSize(side.desc, 28 * u, maxW, 'sans');
  const ss = fitSize(side.stat, 28 * u, maxW, 'sans');
  const row = (k: number): React.CSSProperties => {
    const p = clamp(t * 3 - k * 0.6);
    return {opacity: ease.out(p), transform: `translateY(${(1 - ease.out(p)) * 10 * u}px)`};
  };
  return (
    <div style={{position: 'absolute', left: x - maxW / 2, width: maxW, top: y, textAlign: 'center', fontFamily: fonts.sans}}>
      <div style={{fontSize: ls, fontWeight: 800, color: side.color, lineHeight: 1.1, letterSpacing: '0.01em', ...row(0)}}>{side.label}</div>
      <div style={{fontSize: ds, fontWeight: 400, color: textColor, marginTop: 22 * u, lineHeight: 1.2, ...row(1)}}>{side.desc}</div>
      <div style={{fontSize: ss, fontWeight: 600, color: side.color, marginTop: 12 * u, lineHeight: 1.2, opacity: 0.92, ...row(2)}}>{side.stat}</div>
    </div>
  );
};

const SplitCompare: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const {w, h, u, cx, portrait, durationInFrames: D} = useStage();
  const fid = `splitcmp-edge-${p.seed}`;

  // shared camera: slow push + drift, identical in both panels
  const cam = prog(frame, 0, D, ease.sine);
  const zoom = 1 + p.push * cam;
  const dx = -18 * u * cam;
  const dy = -8 * u * cam;
  const fade = p.fadeOut ? 1 - prog(frame, D - 16, D - 1, ease.linear) : 1;
  // synced build: both panels are revealed by the same rising scan line
  const bt = p.build ? prog(frame, 16, 52, ease.inOut) : 1;
  const Build: React.FC<{children: React.ReactNode; color: string}> = ({children, color}) => (
    <>
      <div style={{position: 'absolute', inset: 0, clipPath: bt < 1 ? `inset(${(1 - bt) * 100}% 0 0 0)` : undefined}}>{children}</div>
      {bt > 0 && bt < 1 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: `${(1 - bt) * 100}%`, height: 3 * u, marginTop: -1.5 * u, background: '#fff8ec', boxShadow: `0 0 ${14 * u}px ${4 * u}px ${color}`}} />
      )}
    </>
  );

  // chrome intro
  const head = prog(frame, 2, 20, ease.out);
  const sub = prog(frame, 8, 26, ease.out);
  const divDraw = p.introWipe ? prog(frame, 2, 12, ease.inOut) : 1;
  const open = p.introWipe ? prog(frame, 8, 26, ease.inOut) : prog(frame, 0, 10, ease.out);
  const labT = prog(frame, 24, 54, ease.linear);
  const foot = prog(frame, 44, 62, ease.out);

  // geometry -----------------------------------------------------------------------------
  const wipe = p.layout === 'wipe';
  const gutter = 16 * u;
  type Box = {x: number; y: number; w: number; h: number};
  let boxes: Box[];
  let labelPos: {x: number; y: number; maxW: number}[];
  let headY: number;
  let footY: number;
  if (wipe) {
    const pw = portrait ? w - 2 * 48 * u : Math.min(w - 2 * 160 * u, ((h - 520 * u) * 16) / 9);
    const ph = portrait ? Math.min(pw * 1.25, h - 760 * u) : (pw * 9) / 16;
    const y0 = portrait ? h * 0.5 - ph / 2 - 60 * u : 250 * u + (h - 250 * u - 300 * u - ph) / 2;
    boxes = [{x: cx - pw / 2, y: y0, w: pw, h: ph}];
    labelPos = [
      {x: cx - pw / 4, y: y0 + ph + 34 * u, maxW: pw / 2 - 20 * u},
      {x: cx + pw / 4, y: y0 + ph + 34 * u, maxW: pw / 2 - 20 * u},
    ];
    headY = y0 - 170 * u;
    footY = Math.min(h - 46 * u, y0 + ph + 260 * u);
  } else if (!portrait) {
    const m = 8 * u;
    const pw = (w - 2 * m - gutter) / 2;
    const ph = Math.min((pw * 530) / 944, h - 560 * u);
    const pt = h / 2 - ph / 2;
    boxes = [
      {x: m, y: pt, w: pw, h: ph},
      {x: m + pw + gutter, y: pt, w: pw, h: ph},
    ];
    labelPos = boxes.map((b) => ({x: b.x + b.w / 2, y: b.y + b.h + 30 * u, maxW: b.w - 40 * u}));
    headY = pt - 183 * u;
    footY = h - 58 * u;
  } else {
    const pw = w - 2 * 48 * u;
    const ph = (pw * 9) / 16;
    const block = ph + 190 * u;
    const total = 2 * block + 40 * u;
    const top = 250 * u + (h - 250 * u - 90 * u - total) / 2;
    boxes = [
      {x: 48 * u, y: top, w: pw, h: ph},
      {x: 48 * u, y: top + block + 40 * u, w: pw, h: ph},
    ];
    labelPos = boxes.map((b) => ({x: b.x + b.w / 2, y: b.y + b.h + 26 * u, maxW: b.w - 40 * u}));
    headY = top - 200 * u;
    footY = h - 70 * u;
  }

  const hs = fitSize(p.headline, 54 * u, w - 120 * u, 'sans');
  const ss = fitSize(p.subheadline, 30 * u, w - 120 * u, 'sans', 0.05);
  const fs = fitSize(p.footnote, 22 * u, w - 80 * u, 'sans');

  // divider for side-by-side / stacked layout
  const divider = !wipe && (
    <div
      style={
        portrait
          ? {position: 'absolute', top: boxes[0].y + boxes[0].h + 190 * u + 19 * u, left: cx - (divDraw * (w - 96 * u)) / 2, width: divDraw * (w - 96 * u), height: 2 * u, background: p.dividerColor}
          : {position: 'absolute', left: cx - u, top: boxes[0].y, width: 2 * u, height: boxes[0].h * divDraw, background: p.dividerColor}
      }
    />
  );

  const panel = (b: Box, side: Side, i: number) => {
    // open outward from the divider (left panel grows leftward, right panel rightward)
    let clip = 'inset(0 0 0 0)';
    if (open < 1) {
      const k = (1 - open) * 100;
      clip = portrait ? (i === 0 ? `inset(${k}% 0 0 0)` : `inset(0 0 ${k}% 0)`) : i === 0 ? `inset(0 0 0 ${k}%)` : `inset(0 ${k}% 0 0)`;
      if (!p.introWipe) clip = 'inset(0 0 0 0)';
    }
    return (
      <div key={i} style={{position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, overflow: 'hidden', clipPath: clip, opacity: p.introWipe ? 1 : open, background: '#000'}}>
        <div style={{position: 'absolute', inset: 0, opacity: fade}}>
          <Build color={side.color}>
            <PanelContent side={side} image={p.image} seed={p.seed} pw={b.w} ph={b.h} zoom={zoom} dx={dx} dy={dy} fid={fid} />
          </Build>
        </div>
      </div>
    );
  };

  // wipe layout: one frame, left style left of the moving divider
  let wipeEl: React.ReactNode = null;
  if (wipe) {
    const b = boxes[0];
    const d =
      0.5 +
      0.36 * prog(frame, 40, 80, ease.inOut) -
      0.72 * prog(frame, 92, 150, ease.inOut) +
      0.36 * prog(frame, 162, 200, ease.inOut);
    const dPx = b.w * (p.introWipe ? tween(frame, [10, 36], [0, 1], ease.inOut) * d : d);
    const hx = b.x + dPx;
    wipeEl = (
      <>
        <div style={{position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, overflow: 'hidden', borderRadius: 6 * u, opacity: open}}>
          <div style={{position: 'absolute', inset: 0, opacity: fade}}>
            <PanelContent side={p.right} image={p.image} seed={p.seed} pw={b.w} ph={b.h} zoom={zoom} dx={dx} dy={dy} fid={fid} />
          </div>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${b.w - dPx}px 0 0)`, opacity: fade}}>
            <PanelContent side={p.left} image={p.image} seed={p.seed} pw={b.w} ph={b.h} zoom={zoom} dx={dx} dy={dy} fid={fid} />
          </div>
          {[p.left, p.right].map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 18 * u,
                [i === 0 ? 'left' : 'right']: 18 * u,
                padding: `${6 * u}px ${14 * u}px`,
                borderRadius: 40 * u,
                background: 'rgba(10,8,6,0.62)',
                color: s.color,
                fontFamily: fonts.sans,
                fontWeight: 800,
                fontSize: 24 * u,
                opacity: labT > 0 ? 1 : 0,
              }}
            >
              {s.label}
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', left: hx - 1.5 * u, top: b.y, width: 3 * u, height: b.h, background: '#f8f1e6', opacity: open, boxShadow: `0 0 ${10 * u}px rgba(0,0,0,0.5)`}} />
        <div
          style={{
            position: 'absolute',
            left: hx - 22 * u,
            top: b.y + b.h / 2 - 22 * u,
            width: 44 * u,
            height: 44 * u,
            borderRadius: '50%',
            background: '#f8f1e6',
            opacity: open,
            boxShadow: `0 ${3 * u}px ${12 * u}px rgba(0,0,0,0.45)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2a241e',
            fontFamily: fonts.sans,
            fontWeight: 800,
            fontSize: 20 * u,
            letterSpacing: 2 * u,
          }}
        >
          ‹›
        </div>
      </>
    );
  }

  return (
    <AbsoluteFill style={{background: p.background}}>
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
        <defs>
          <filter id={fid} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0" />
            <feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="4.5" intercept="-0.04" />
              <feFuncG type="linear" slope="4.5" intercept="-0.04" />
              <feFuncB type="linear" slope="4.5" intercept="-0.04" />
            </feComponentTransfer>
            <feColorMatrix type="matrix" values="0.95 0 0 0 0.05  0.77 0 0 0 0.04  0.55 0 0 0 0.03  0 0 0 1 0" result="lines" />
            <feGaussianBlur stdDeviation="2.5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="lines" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      {/* header */}
      <div style={{position: 'absolute', left: 0, right: 0, top: headY, textAlign: 'center', fontFamily: fonts.sans}}>
        <div style={{fontSize: hs, fontWeight: 800, color: p.headlineColor, lineHeight: 1.1, opacity: head, transform: `translateY(${(1 - head) * 14 * u}px)`}}>{p.headline}</div>
        <div style={{fontSize: ss, fontWeight: 400, color: p.textColor, opacity: 0.85 * sub, marginTop: 26 * u, letterSpacing: '0.05em'}}>{p.subheadline}</div>
      </div>
      {wipe ? wipeEl : [panel(boxes[0], p.left, 0), panel(boxes[1], p.right, 1)]}
      {divider}
      <LabelStack side={p.left} {...labelPos[0]} u={u} t={labT} textColor={p.textColor} />
      <LabelStack side={p.right} {...labelPos[1]} u={u} t={clamp(labT - 0.08)} textColor={p.textColor} />
      <div style={{position: 'absolute', left: 0, right: 0, top: footY - fs * 0.6, textAlign: 'center', fontFamily: fonts.sans, fontSize: fs, color: '#928e89', opacity: foot}}>{p.footnote}</div>
    </AbsoluteFill>
  );
};

const SplitCompareRoot: React.FC<Props> = (p) =>
  p.layout === 'ledger' ? (
    <LedgerSplit counters={p.counters} stamp={p.stamp} seed={p.seed} image={p.image === 'demo/lighthouse.jpg' ? '' : p.image} headline={p.headline === 'Same blueprint, two ways to draw it' ? 'Before vs after' : p.headline} dividerColor={p.dividerColor === '#35342d' ? '#F5F2EC' : p.dividerColor} dividerDrop={p.dividerDrop} stampColor={p.stampColor} badTint={p.badTint} />
  ) : (
    <SplitCompare {...p} />
  );

export const splitCompare = defineMotion<Props>({
  id: 'split-compare',
  title: 'Split-screen compare',
  category: 'ui',
  description: 'Presentation layout: headline, two perfectly synced panels (line-art vs colour by default) with colour-coded labels, stat lines and a footnote.',
  source: ['video3 0:00-0:23 split-screen-compare'],
  useFor: 'Before/after, A vs B, two tools / two styles / two renderers of the same thing.',
  durationInFrames: 240,
  defaultProps: {
    background: '#0b0907',
    headline: 'Same blueprint, two ways to draw it',
    subheadline: 'Same scene, same camera, same timing. Only the renderer changes.',
    footnote: '※ Export time = time to turn the finished 8-second animation into an MP4.',
    left: {label: 'Line pass', color: '#e8af78', desc: 'Every edge traced, nothing shaded', stat: 'Export ≈ 45 s', src: '', style: 'lines'},
    right: {label: 'Full render', color: '#76c8fb', desc: 'Light, colour and atmosphere', stat: 'Export ≈ 12 min', src: '', style: 'color'},
    image: 'demo/lighthouse.jpg',
    seed: 4,
    layout: 'panels',
    introWipe: true,
    push: 0.14,
    fadeOut: false,
    build: true,
    headlineColor: '#f8e2c0',
    textColor: '#e8e4df',
    dividerColor: '#35342d',
    counters: [
      {label: 'Before', value: 1240, unit: 'ms', bad: true},
      {label: 'After', value: 86, unit: 'ms'},
    ] as LedgerCounter[],
    stamp: 'FIXED',
    dividerDrop: 10,
    stampColor: '#E5484D',
    badTint: '#B8281E',
  },
  propDocs: {
    headline: 'headline above the panels',
    subheadline: 'one-line subheading',
    footnote: 'small grey footnote at the bottom',
    left: '{label, color, desc, stat, src, style} for the left (top in portrait) panel; style lines|color|mono|sepia|warm',
    right: 'same for the right (bottom) panel',
    image: 'public/ image shown in both panels when a side has no own src (empty = procedural plate)',
    seed: 'procedural plate seed',
    layout: "'panels' = two side-by-side (stacked in portrait) panels, 'wipe' = one frame with a moving divider, 'ledger' = full-bleed halves: divider drops, the bad half desaturates with a red tint, two counters race, a stamp lands on the divider",
    counters: 'ledger: [{label, value, unit?, prefix?, bad?, decimals?}] for the two halves; bad = desaturated + red tint',
    stamp: 'ledger: stamp text on the divider after both counters settle',
    dividerDrop: 'ledger: frames the divider takes to drop in',
    stampColor: 'ledger: stamp colour',
    badTint: 'ledger: red tint multiplied over the bad half',
    introWipe: 'divider draws on and the panels open outward from it',
    push: 'shared camera push amount over the whole motion (0.14 = +14 %)',
    build: 'both panels are revealed in sync by a rising scan line after the intro',
    fadeOut: 'panels fade to black over the last 0.5 s (chrome stays)',
  },
  component: SplitCompareRoot,
  tags: ['compare', 'split-screen', 'before-after', 'layout', 'presentation', 'ledger', 'counter', 'versus', 'stamp', 'claim vs reality'],
});
