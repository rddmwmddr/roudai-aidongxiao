import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ease, prog} from '../../core/ease';
import {SANS, backOut, bgOf, fmtInt, mixHex, starPath, withAlpha, wrapText} from '../../core/r3-social';
import {useSafeId} from '../../core/image-kit';
import {estWidth} from '../../core/text-kit';
import {Svg, useStage} from '../../core/stage';
import {defineMotion} from '../../core/types';

/**
 * A poll result: the question types in over a card, option bars fill one by one to their share with a counting percent, then
 * the winner locks in (bar glows, "winner" tag with a crown, the rest dim) and the total vote count ticks up.
 * `values` can be percentages or raw votes — they are normalised to a share of the total.
 */
type Props = {
  question: string;
  options: string[];
  values: number[];
  winnerLabel: string;
  votesLabel: string;
  totalVotes: number;
  background: string;
  ink: string;
  accent: string;
  barColor: string;
  cardColor: string;
  stagger: number;
  startAt: number;
};

const PollResultsBars: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const {w, h, u, portrait} = useStage();
  const uid = useSafeId('prb');
  const opts = (p.options && p.options.length ? p.options : ['Option']).slice(0, 8);
  const vals = opts.map((_, i) => Math.max(0, Number(p.values?.[i] ?? 0)));
  const sum = vals.reduce((a, b) => a + b, 0) || 1;
  const pct = vals.map((v) => (v / sum) * 100);
  const maxPct = Math.max(...pct, 1);
  const win = pct.indexOf(maxPct);
  const bg = p.background === 'transparent' ? '#ffffff' : p.background;
  const card = p.cardColor === 'auto' ? mixHex(bg, '#ffffff', 0.55) : p.cardColor;
  const f = Math.max(0, frame - p.startAt);

  const n = opts.length;
  // layout (px)
  const cardW = portrait ? w * 0.92 : Math.min(w * 0.7, 1280 * u);
  const S = portrait ? 1.35 * u : 1.12 * u;
  const qFs = 52 * S;
  const qLines = wrapText(p.question, qFs, cardW - 120 * S, 'sans', 3);
  const rowH = Math.min(120 * S, ((portrait ? h * 0.52 : h * 0.5) / n));
  const barH = rowH * 0.62;
  const headH = 40 * S + qLines.length * qFs * 1.22 + 30 * S;
  const cardH = headH + n * rowH + 108 * S;
  const cardX = (w - cardW) / 2;
  const cardY = (h - cardH) / 2;
  const rows0 = cardY + headH;
  const labelW = Math.min(cardW * 0.3, 330 * S);
  const trackX = cardX + 60 * S + labelW;
  const trackW = cardX + cardW - 60 * S - 150 * S - trackX;

  const cardIn = backOut(prog(f, 0, 18, ease.linear), 1.2);
  const qStart = 10;
  const qChars = qLines.join(' ').length;
  const typed = Math.floor(prog(f, qStart, qStart + Math.min(40, qChars * 1.1), ease.linear) * qChars);
  const barStart = qStart + 46;
  const fillDur = 46;
  const lockAt = barStart + (n - 1) * p.stagger + fillDur + 8;
  const lock = ease.out(prog(f, lockAt, lockAt + 14, ease.linear));
  const votes = Math.round(p.totalVotes * ease.out(prog(f, barStart, barStart + (n - 1) * p.stagger + fillDur, ease.linear)));
  let charBudget = typed;

  return (
    <AbsoluteFill style={{background: bgOf(p.background)}}>
      <Svg>
        <defs>
          <filter id={`${uid}-glow`} x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation={10 * S} />
          </filter>
        </defs>
        <g opacity={Math.min(1, cardIn * 1.5)} transform={`translate(${w / 2} ${h / 2}) scale(${0.94 + 0.06 * cardIn}) translate(${-w / 2} ${-h / 2})`}>
          <rect x={cardX} y={cardY} width={cardW} height={cardH} rx={36 * S} fill={card} stroke={withAlpha(p.ink, 0.08)} strokeWidth={2 * S} />
          {/* question (types in) */}
          {qLines.map((ln, i) => {
            const take = Math.max(0, Math.min(ln.length, charBudget));
            charBudget -= ln.length + 1;
            return (
              <text key={i} x={cardX + 60 * S} y={cardY + 40 * S + qFs * (0.92 + i * 1.22)} fontFamily={SANS} fontWeight={800} fontSize={qFs} fill={p.ink}>
                {ln.slice(0, take)}
              </text>
            );
          })}

          {opts.map((o, i) => {
            const at = barStart + i * p.stagger;
            const t = ease.out(prog(f, at, at + fillDur, ease.linear));
            const y = rows0 + i * rowH;
            const isW = i === win;
            const dim = isW ? 0 : lock * 0.45;
            const fill = isW ? mixHex(mixHex(p.barColor === 'auto' ? p.ink : p.barColor, bg, 0.55), p.accent, lock) : mixHex(p.barColor === 'auto' ? p.ink : p.barColor, bg, 0.45 + 0.0);
            const len = (trackW * (pct[i] / maxPct) * 0.96) * t;
            const rowIn = prog(f, at - 6, at + 6, ease.out);
            const bump = isW ? 1 + 0.05 * Math.sin(lock * Math.PI) : 1;
            const val = Math.round(pct[i] * t);
            const tagW = estWidth(p.winnerLabel.toUpperCase(), 20 * S, 'sans', 0.08) + 64 * S;
            const lines = wrapText(o, 34 * S, labelW, 'sans', 2);
            return (
              <g key={i} opacity={rowIn * (1 - dim)}>
                {lines.map((ln, j) => (
                  <text key={j} x={cardX + 60 * S} y={y + rowH / 2 + (lines.length === 1 ? 12 * S : (j - 0.35) * 32 * S)} fontFamily={SANS} fontWeight={isW && lock > 0.5 ? 800 : 600} fontSize={32 * S} fill={p.ink}>
                    {ln}
                  </text>
                ))}
                <rect x={trackX} y={y + (rowH - barH) / 2} width={trackW} height={barH} rx={barH / 2} fill={withAlpha(p.ink, 0.07)} />
                {isW && lock > 0 && <rect x={trackX} y={y + (rowH - barH) / 2} width={Math.max(0, len)} height={barH} rx={Math.min(barH / 2, len / 2)} fill={p.accent} opacity={0.55 * lock} filter={`url(#${uid}-glow)`} />}
                <g transform={`translate(0 ${y + rowH / 2}) scale(1 ${bump}) translate(0 ${-(y + rowH / 2)})`}>
                  <rect x={trackX} y={y + (rowH - barH) / 2} width={Math.max(0, len)} height={barH} rx={Math.min(barH / 2, len / 2)} fill={fill} />
                </g>
                <text x={cardX + cardW - 60 * S} y={y + rowH / 2 + 14 * S} textAnchor="end" fontFamily={SANS} fontWeight={800} fontSize={42 * S} fill={isW && lock > 0.3 ? mixHex(p.ink, p.accent, lock) : p.ink}>
                  {val}%
                </text>
                {isW && lock > 0.01 && (
                  <g transform={`translate(${trackX + Math.max(len, 0) - 10 * S} ${y + (rowH - barH) / 2 - 14 * S}) scale(${backOut(lock, 1.8)})`} opacity={lock}>
                    <rect x={-tagW} y={-26 * S} width={tagW} height={40 * S} rx={20 * S} fill={p.accent} />
                    <path d={starPath(-tagW + 24 * S, -6 * S, 11 * S)} fill="#fff" />
                    <text x={-tagW + 42 * S} y={-5 * S} fontFamily={SANS} fontWeight={800} fontSize={20 * S} fill="#fff" letterSpacing={1.5 * S}>
                      {p.winnerLabel.toUpperCase()}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          <text x={cardX + 60 * S} y={cardY + cardH - 40 * S} fontFamily={SANS} fontWeight={600} fontSize={28 * S} fill={p.ink} opacity={0.55 * prog(f, barStart, barStart + 14, ease.out)}>
            {fmtInt(votes)} {p.votesLabel}
          </text>
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

export const pollResultsBars = defineMotion<Props>({
  id: 'poll-results-bars',
  title: 'Poll results bars',
  category: 'ui',
  description: 'A poll card: the question types in, option bars fill one after another to their share with counting percentages, then the winner locks in with a glow and a tag while the rest dim; a vote total ticks up.',
  source: ['original (round 3, social & marketing)'],
  useFor: 'Poll and survey results, "you voted" reveals, audience-choice moments, A/B vote summaries, quiz answers and social engagement posts.',
  durationInFrames: 240,
  defaultProps: {
    question: 'What should we make next?',
    options: ['Quick tips', 'Deep dives', 'Behind the scenes', 'Q&A'],
    values: [41, 28, 21, 10],
    winnerLabel: 'Winner',
    votesLabel: 'votes',
    totalVotes: 3842,
    background: '#E9EEF8',
    ink: '#1B2233',
    accent: '#3A6BFF',
    barColor: 'auto',
    cardColor: 'auto',
    stagger: 12,
    startAt: 0,
  },
  propDocs: {
    question: 'the poll question',
    options: 'option labels (up to 8)',
    values: 'one number per option — percentages or raw votes (normalised to a share of the sum)',
    winnerLabel: 'text on the winner tag',
    votesLabel: 'word after the vote total',
    totalVotes: 'vote total shown at the bottom (counts up)',
    background: 'frame colour, or "transparent" to overlay content',
    ink: 'text / default bar colour',
    accent: 'winner bar + tag colour',
    barColor: 'colour of the non-winner bars, or "auto" (ink, softened)',
    cardColor: 'card fill, or "auto" (a lighter tone of the background)',
    stagger: 'frames between bars starting',
    startAt: 'frame the sequence begins',
  },
  component: PollResultsBars,
  tags: ['social', 'poll', 'survey', 'vote', 'results', 'bars', 'percent', 'data', 'quiz', 'engagement', 'overlay'],
});
