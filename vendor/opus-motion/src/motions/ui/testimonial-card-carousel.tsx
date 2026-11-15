import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ease, prog} from '../../core/ease';
import {Avatar, SANS, avatarColor, backOut, bgOf, mixHex, starPath, withAlpha, wrapText} from '../../core/r3-social';
import {fonts} from '../../core/fonts';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

/**
 * Social-proof carousel: customer quote cards (big quote mark, quote text, star rating, avatar with name + role) rotate through
 * a centre stage; the neighbours peek in at the sides, scaled and dimmed, and pager dots track the active card.
 */
type Testimonial = {quote: string; name: string; role?: string; rating?: number};
type Props = {
  testimonials: Testimonial[];
  holdFrames: number;
  moveFrames: number;
  heading: string;
  background: string;
  cardColor: string;
  ink: string;
  accent: string;
  starColor: string;
  quoteFont: 'sans' | 'serif';
  startAt: number;
};

const TestimonialCardCarousel: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const {w, h, u, portrait} = useStage();
  const items = (p.testimonials && p.testimonials.length ? p.testimonials : [{quote: 'Add quotes through the testimonials prop.', name: 'Your Customer'}]).slice(0, 10);
  const n = items.length;
  const f = Math.max(0, frame - p.startAt);
  const hold = Math.max(20, p.holdFrames);
  const move = Math.min(Math.max(8, p.moveFrames), hold - 6);
  const bg = p.background === 'transparent' ? '#ffffff' : p.background;
  const card = p.cardColor === 'auto' ? mixHex(bg, '#ffffff', 0.7) : p.cardColor;

  // fractional index: hold then glide to the next card
  const step = Math.floor(f / (hold + move));
  const within = f - step * (hold + move);
  const pos = step + (within > hold ? ease.inOut((within - hold) / move) : 0);
  const active = Math.round(pos) % n;

  const cw = portrait ? w * 0.8 : Math.min(w * 0.4, 800 * u);
  const ch = portrait ? Math.min(h * 0.46, cw * 1.18) : Math.min(h * 0.62, cw * 0.82);
  const S = cw / 760;
  const cy = h * (portrait ? 0.47 : 0.48);
  const spacing = cw * 1.06;
  const enter = backOut(prog(f, 0, 22, ease.linear), 1.2);
  const font: 'sans' | 'serif' = p.quoteFont === 'serif' ? 'serif' : 'sans';
  const qFont = font === 'serif' ? fonts.serif : SANS;

  const order = items
    .map((it, i) => {
      let rel = i - (pos % n);
      rel = ((rel + n / 2) % n + n) % n - n / 2;
      return {it, i, rel};
    })
    .filter((o) => Math.abs(o.rel) <= 1.55)
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));

  return (
    <AbsoluteFill style={{background: bgOf(p.background)}}>
      <Svg>
        {p.heading && (
          <text x={w / 2} y={cy - ch / 2 - 56 * S} textAnchor="middle" fontFamily={SANS} fontWeight={800} fontSize={40 * S} letterSpacing={6 * S} fill={p.ink} opacity={0.55 * enter}>
            {p.heading.toUpperCase()}
          </text>
        )}
        {order.map(({it, i, rel}) => {
          const a = Math.abs(rel);
          const sc = (1 - 0.16 * Math.min(a, 1.5)) * (0.9 + 0.1 * enter);
          const x = w / 2 + rel * spacing * (1 - 0.05 * Math.min(a, 1.5));
          const op = (1 - Math.min(1, Math.max(0, a - 0.9) / 0.65)) * (a < 0.5 ? 1 : 0.7) * Math.min(1, enter * 1.6);
          const focus = 1 - Math.min(1, a);
          const avail = ch - 350 * S;
          let qs = Math.max(30, 54 - Math.max(0, it.quote.length - 60) * 0.18) * S;
          let lines = wrapText(it.quote, qs, cw - 120 * S, font, 8);
          while (lines.length * qs * 1.32 > avail && qs > 22 * S) {
            qs *= 0.93;
            lines = wrapText(it.quote, qs, cw - 120 * S, font, 8);
          }
          const lh = qs * 1.32;
          const tTop = cy - ch / 2 + 150 * S;
          const rating = Math.max(0, Math.min(5, it.rating ?? 5));
          const nm = it.name;
          return (
            <g key={i} opacity={op} transform={`translate(${x} ${cy}) scale(${sc}) translate(${-x} ${-cy})`}>
              <rect x={x - cw / 2} y={cy - ch / 2 + 14 * S} width={cw} height={ch} rx={36 * S} fill="#000" opacity={0.16 * focus} />
              <rect x={x - cw / 2} y={cy - ch / 2} width={cw} height={ch} rx={36 * S} fill={card} stroke={withAlpha(p.ink, 0.1)} strokeWidth={2 * S} />
              <path d={`M${x - cw / 2 + 56 * S} ${cy - ch / 2 + 116 * S} q0 -52 44 -64 l5 14 q-22 8 -22 30 h22 v36 h-49z M${x - cw / 2 + 126 * S} ${cy - ch / 2 + 116 * S} q0 -52 44 -64 l5 14 q-22 8 -22 30 h22 v36 h-49z`} fill={p.accent} opacity={0.95} />
              {lines.map((ln, j) => (
                <text key={j} x={x - cw / 2 + 60 * S} y={tTop + lh * (j + 0.7)} fontFamily={qFont} fontWeight={font === 'serif' ? 500 : 600} fontSize={qs} fill={p.ink}>
                  {ln}
                </text>
              ))}
              {/* stars */}
              <g>
                {Array.from({length: 5}, (_, k) => {
                  const on = k < Math.round(rating);
                  const t = Math.min(backOut(Math.min(1, Math.max(0, (focus - 0.5 - k * 0.06) / 0.35)), 2), prog(f, 8 + k * 4, 20 + k * 4, ease.linear));
                  return <path key={k} d={starPath(x - cw / 2 + (84 + k * 52) * S, cy + ch / 2 - 150 * S, 21 * S * (on ? t : 1))} fill={on ? p.starColor : withAlpha(p.ink, 0.15)} />;
                })}
              </g>
              <line x1={x - cw / 2 + 60 * S} x2={x + cw / 2 - 60 * S} y1={cy + ch / 2 - 118 * S} y2={cy + ch / 2 - 118 * S} stroke={withAlpha(p.ink, 0.1)} strokeWidth={2 * S} />
              <Avatar cx={x - cw / 2 + 100 * S} cy={cy + ch / 2 - 58 * S} r={36 * S} name={nm} color={avatarColor(nm, i)} />
              <text x={x - cw / 2 + 156 * S} y={cy + ch / 2 - 60 * S} fontFamily={SANS} fontWeight={800} fontSize={32 * S} fill={p.ink}>
                {nm}
              </text>
              {it.role && (
                <text x={x - cw / 2 + 156 * S} y={cy + ch / 2 - 26 * S} fontFamily={SANS} fontWeight={400} fontSize={26 * S} fill={p.ink} opacity={0.6}>
                  {it.role.length > 34 ? it.role.slice(0, 33) + '…' : it.role}
                </text>
              )}
            </g>
          );
        })}

        {/* pager dots */}
        <g opacity={enter}>
          {items.map((_, i) => {
            const act = i === active;
            const dw = (act ? 40 : 14) * S;
            const total = n * 14 * S + (n - 1) * 16 * S + 26 * S;
            let xx = w / 2 - total / 2;
            for (let j = 0; j < i; j++) xx += (j === active ? 40 : 14) * S + 16 * S;
            return <rect key={i} x={xx} y={cy + ch / 2 + 64 * S} width={dw} height={14 * S} rx={7 * S} fill={act ? p.accent : withAlpha(p.ink, 0.22)} />;
          })}
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

export const testimonialCardCarousel = defineMotion<Props>({
  id: 'testimonial-card-carousel',
  title: 'Testimonial card carousel',
  category: 'ui',
  description: 'Customer quote cards with a big quote mark, star rating, avatar, name and role rotate through a centre stage; neighbouring cards peek in scaled and dimmed, pager dots follow.',
  source: ['original (round 3, social & marketing)'],
  useFor: 'Social proof sections, customer-love videos, case-study teasers, landing-page testimonial strips, review roundups and app-store style praise.',
  durationInFrames: 330,
  defaultProps: {
    testimonials: [
      {quote: 'We cut our weekly reporting from a full day to twenty minutes. It simply works.', name: 'Maya Rivers', role: 'Operations lead', rating: 5},
      {quote: 'Setup took one afternoon and the whole team was using it by Friday.', name: 'Dev Patel', role: 'Founder, small studio', rating: 5},
      {quote: 'Support answered in minutes and actually fixed the problem. Rare these days.', name: 'Lena Ortiz', role: 'Customer success', rating: 4},
      {quote: 'The best purchase we made this year. Our customers noticed the difference.', name: 'Sam Okafor', role: 'Shop owner', rating: 5},
    ],
    holdFrames: 66,
    moveFrames: 16,
    heading: 'What people say',
    background: '#ECEFF6',
    cardColor: 'auto',
    ink: '#1D2233',
    accent: '#4C6FE0',
    starColor: '#F2B134',
    quoteFont: 'sans',
    startAt: 0,
  },
  propDocs: {
    testimonials: 'array of {quote, name, role?, rating?(0-5)} — up to 10',
    holdFrames: 'frames each card is held in the centre',
    moveFrames: 'frames of the glide to the next card',
    heading: 'small caption above the cards (empty to hide)',
    background: 'frame colour, or "transparent" to overlay content',
    cardColor: 'card fill, or "auto" (lighter than the background)',
    ink: 'text colour',
    accent: 'quote mark + active dot colour',
    starColor: 'filled star colour',
    quoteFont: '"sans" or "serif" for the quote text',
    startAt: 'frame the sequence begins',
  },
  component: TestimonialCardCarousel,
  tags: ['social', 'testimonial', 'reviews', 'quotes', 'carousel', 'cards', 'stars', 'customers', 'proof', 'marketing', 'overlay'],
});
