// Tooltip definitions plus the derived artefacts: the live page CSS, and the
// per-tooltip copyable snippet + LLM prompt. Imported by index.astro (for the
// grid + inlined live CSS) and by tooltip-data.json.ts (which emits the
// snippet/prompt payload the copy modal fetches on demand).
import Layout from '../layouts/Layout.astro';

// Shared base — every tooltip starts from this, then layers one `.tp-N` direction
// + reveal. The tooltip text comes from the trigger's `data-tip` attribute, so
// the whole thing is pure CSS: no JavaScript, one element, two pseudo-elements.
export const TIP_BASE = `.tip {
  /* Theme tokens — override these to recolour the tooltip */
  --tip-bg: #0F191E;     /* bubble + arrow */
  --tip-fg: #E2F1F2;     /* bubble text */
  --tip-radius: 6px;
  --tip-gap: 8px;        /* distance from the trigger */
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 9px 16px;
  border: 1px solid var(--tip-bg);
  border-radius: var(--tip-radius);
  background: transparent;
  color: var(--tip-bg);
  cursor: pointer;
}
/* The bubble */
.tip::after {
  content: attr(data-tip);
  position: absolute;
  z-index: 20;
  padding: 6px 10px;
  border-radius: var(--tip-radius);
  background: var(--tip-bg);
  color: var(--tip-fg);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: none;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
/* The arrow — a single coloured border edge on a transparent box */
.tip::before {
  content: "";
  position: absolute;
  z-index: 20;
  border: 7px solid transparent;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
/* Reveal on hover or keyboard focus */
.tip:hover::after, .tip:focus-visible::after,
.tip:hover::before, .tip:focus-visible::before { opacity: 1; }`;

// Each tooltip: a display name plus the CSS that, layered on .tip, positions the
// bubble + arrow and gives it a fade / slide reveal.
export const tips: { name: string; css: string }[] = [
  // ---- 8 compass directions, slide-in reveal ----
  { name: 'Top', css: `.tp-1::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translate(-50%, 6px); }
.tp-1::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 6px); }
.tp-1:hover::after, .tp-1:focus-visible::after { transform: translate(-50%, 0); }
.tp-1:hover::before, .tp-1:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Bottom', css: `.tp-2::after { left: 50%; top: calc(100% + var(--tip-gap)); transform: translate(-50%, -6px); }
.tp-2::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translate(-50%, -6px); }
.tp-2:hover::after, .tp-2:focus-visible::after { transform: translate(-50%, 0); }
.tp-2:hover::before, .tp-2:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Left', css: `.tp-3::after { right: calc(100% + var(--tip-gap)); top: 50%; transform: translate(6px, -50%); }
.tp-3::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: var(--tip-bg); transform: translate(6px, -50%); }
.tp-3:hover::after, .tp-3:focus-visible::after { transform: translate(0, -50%); }
.tp-3:hover::before, .tp-3:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Right', css: `.tp-4::after { left: calc(100% + var(--tip-gap)); top: 50%; transform: translate(-6px, -50%); }
.tp-4::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: var(--tip-bg); transform: translate(-6px, -50%); }
.tp-4:hover::after, .tp-4:focus-visible::after { transform: translate(0, -50%); }
.tp-4:hover::before, .tp-4:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Top Right', css: `.tp-5::after { left: 0; bottom: calc(100% + var(--tip-gap)); transform: translateY(6px); }
.tp-5::before { left: 14px; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateY(6px); }
.tp-5:hover::after, .tp-5:focus-visible::after,
.tp-5:hover::before, .tp-5:focus-visible::before { transform: translateY(0); }` },
  { name: 'Top Left', css: `.tp-6::after { right: 0; bottom: calc(100% + var(--tip-gap)); transform: translateY(6px); }
.tp-6::before { right: 14px; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateY(6px); }
.tp-6:hover::after, .tp-6:focus-visible::after,
.tp-6:hover::before, .tp-6:focus-visible::before { transform: translateY(0); }` },
  { name: 'Bottom Right', css: `.tp-7::after { left: 0; top: calc(100% + var(--tip-gap)); transform: translateY(-6px); }
.tp-7::before { left: 14px; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translateY(-6px); }
.tp-7:hover::after, .tp-7:focus-visible::after,
.tp-7:hover::before, .tp-7:focus-visible::before { transform: translateY(0); }` },
  { name: 'Bottom Left', css: `.tp-8::after { right: 0; top: calc(100% + var(--tip-gap)); transform: translateY(-6px); }
.tp-8::before { right: 14px; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translateY(-6px); }
.tp-8:hover::after, .tp-8:focus-visible::after,
.tp-8:hover::before, .tp-8:focus-visible::before { transform: translateY(0); }` },
  // ---- Same 4 cardinal directions, gentle fade-only reveal ----
  { name: 'Top · Fade', css: `.tp-9::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translateX(-50%); }
.tp-9::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%); }` },
  { name: 'Bottom · Fade', css: `.tp-10::after { left: 50%; top: calc(100% + var(--tip-gap)); transform: translateX(-50%); }
.tp-10::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translateX(-50%); }` },
  { name: 'Left · Fade', css: `.tp-11::after { right: calc(100% + var(--tip-gap)); top: 50%; transform: translateY(-50%); }
.tp-11::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: var(--tip-bg); transform: translateY(-50%); }` },
  { name: 'Right · Fade', css: `.tp-12::after { left: calc(100% + var(--tip-gap)); top: 50%; transform: translateY(-50%); }
.tp-12::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: var(--tip-bg); transform: translateY(-50%); }` },
  // ---- Extra reveal flavours ----
  { name: 'Top · Scale', css: `.tp-13::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform-origin: bottom center; transform: translateX(-50%) scale(0.7); }
.tp-13::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%) scale(0.7); transform-origin: bottom center; }
.tp-13:hover::after, .tp-13:focus-visible::after,
.tp-13:hover::before, .tp-13:focus-visible::before { transform: translateX(-50%) scale(1); }` },
  { name: 'Bottom · Scale', css: `.tp-14::after { left: 50%; top: calc(100% + var(--tip-gap)); transform-origin: top center; transform: translateX(-50%) scale(0.7); }
.tp-14::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translateX(-50%) scale(0.7); transform-origin: top center; }
.tp-14:hover::after, .tp-14:focus-visible::after,
.tp-14:hover::before, .tp-14:focus-visible::before { transform: translateX(-50%) scale(1); }` },
  { name: 'Top · Pop', css: `.tp-15::after, .tp-15::before { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-15::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translate(-50%, 10px) scale(0.9); transform-origin: bottom center; }
.tp-15::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 10px); }
.tp-15:hover::after, .tp-15:focus-visible::after { transform: translate(-50%, 0) scale(1); }
.tp-15:hover::before, .tp-15:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Top · Expand', css: `.tp-16::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translateX(-50%); clip-path: inset(0 50% 0 50%); transition: opacity 0.25s ease, clip-path 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.tp-16::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%) scaleX(0); }
.tp-16:hover::after, .tp-16:focus-visible::after { clip-path: inset(0 0 0 0); }
.tp-16:hover::before, .tp-16:focus-visible::before { transform: translateX(-50%) scaleX(1); }` },
  { name: 'Bottom · Pop', css: `.tp-17::after, .tp-17::before { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-17::after { left: 50%; top: calc(100% + var(--tip-gap)); transform-origin: top center; transform: translate(-50%, -10px) scale(0.9); }
.tp-17::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translate(-50%, -10px); }
.tp-17:hover::after, .tp-17:focus-visible::after { transform: translate(-50%, 0) scale(1); }
.tp-17:hover::before, .tp-17:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Left · Scale', css: `.tp-18::after { right: calc(100% + var(--tip-gap)); top: 50%; transform-origin: right center; transform: translateY(-50%) scale(0.7); }
.tp-18::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: var(--tip-bg); transform-origin: right center; transform: translateY(-50%) scale(0.7); }
.tp-18:hover::after, .tp-18:focus-visible::after,
.tp-18:hover::before, .tp-18:focus-visible::before { transform: translateY(-50%) scale(1); }` },
  { name: 'Right · Scale', css: `.tp-19::after { left: calc(100% + var(--tip-gap)); top: 50%; transform-origin: left center; transform: translateY(-50%) scale(0.7); }
.tp-19::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: var(--tip-bg); transform-origin: left center; transform: translateY(-50%) scale(0.7); }
.tp-19:hover::after, .tp-19:focus-visible::after,
.tp-19:hover::before, .tp-19:focus-visible::before { transform: translateY(-50%) scale(1); }` },
  { name: 'Top · Flip', css: `.tp-20::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform-origin: bottom center; transform: translateX(-50%) perspective(200px) rotateX(-90deg); }
.tp-20::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%); }
.tp-20:hover::after, .tp-20:focus-visible::after { transform: translateX(-50%) perspective(200px) rotateX(0); }` },
  { name: 'Bottom · Flip', css: `.tp-21::after { left: 50%; top: calc(100% + var(--tip-gap)); transform-origin: top center; transform: translateX(-50%) perspective(200px) rotateX(90deg); }
.tp-21::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translateX(-50%); }
.tp-21:hover::after, .tp-21:focus-visible::after { transform: translateX(-50%) perspective(200px) rotateX(0); }` },
  { name: 'Top · Blur', css: `.tp-22::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translateX(-50%); filter: blur(6px); transition: opacity 0.25s ease, filter 0.3s ease; }
.tp-22::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%); }
.tp-22:hover::after, .tp-22:focus-visible::after { filter: blur(0); }` },
  { name: 'Right · Expand', css: `.tp-23::after { left: calc(100% + var(--tip-gap)); top: 50%; transform: translateY(-50%); clip-path: inset(0 100% 0 0); transition: opacity 0.25s ease, clip-path 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.tp-23::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: var(--tip-bg); transform-origin: left center; transform: translateY(-50%) scale(0); }
.tp-23:hover::after, .tp-23:focus-visible::after { clip-path: inset(0 0 0 0); }
.tp-23:hover::before, .tp-23:focus-visible::before { transform: translateY(-50%) scale(1); }` },
  { name: 'Top · Rise', css: `.tp-24::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translate(-50%, 14px); }
.tp-24::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 14px); }
.tp-24:hover::after, .tp-24:focus-visible::after,
.tp-24:hover::before, .tp-24:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Left · Pop', css: `.tp-25::after, .tp-25::before { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-25::after { right: calc(100% + var(--tip-gap)); top: 50%; transform-origin: right center; transform: translate(10px, -50%) scale(0.9); }
.tp-25::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: var(--tip-bg); transform: translate(10px, -50%); }
.tp-25:hover::after, .tp-25:focus-visible::after { transform: translate(0, -50%) scale(1); }
.tp-25:hover::before, .tp-25:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Right · Pop', css: `.tp-26::after, .tp-26::before { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-26::after { left: calc(100% + var(--tip-gap)); top: 50%; transform-origin: left center; transform: translate(-10px, -50%) scale(0.9); }
.tp-26::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: var(--tip-bg); transform: translate(-10px, -50%); }
.tp-26:hover::after, .tp-26:focus-visible::after { transform: translate(0, -50%) scale(1); }
.tp-26:hover::before, .tp-26:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Bottom · Expand', css: `.tp-27::after { left: 50%; top: calc(100% + var(--tip-gap)); transform: translateX(-50%); clip-path: inset(0 0 100% 0); transition: opacity 0.25s ease, clip-path 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.tp-27::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform-origin: top center; transform: translateX(-50%) scaleY(0); }
.tp-27:hover::after, .tp-27:focus-visible::after { clip-path: inset(0 0 0 0); }
.tp-27:hover::before, .tp-27:focus-visible::before { transform: translateX(-50%) scaleY(1); }` },
  { name: 'Left · Expand', css: `.tp-28::after { right: calc(100% + var(--tip-gap)); top: 50%; transform: translateY(-50%); clip-path: inset(0 0 0 100%); transition: opacity 0.25s ease, clip-path 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.tp-28::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: var(--tip-bg); transform-origin: right center; transform: translateY(-50%) scaleX(0); }
.tp-28:hover::after, .tp-28:focus-visible::after { clip-path: inset(0 0 0 0); }
.tp-28:hover::before, .tp-28:focus-visible::before { transform: translateY(-50%) scaleX(1); }` },
  { name: 'Top · Zoom', css: `.tp-29::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform-origin: bottom center; transform: translateX(-50%) scale(0); }
.tp-29::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform-origin: bottom center; transform: translateX(-50%) scale(0); }
.tp-29:hover::after, .tp-29:focus-visible::after,
.tp-29:hover::before, .tp-29:focus-visible::before { transform: translateX(-50%) scale(1); }` },
  { name: 'Bottom · Zoom', css: `.tp-30::after { left: 50%; top: calc(100% + var(--tip-gap)); transform-origin: top center; transform: translateX(-50%) scale(0); }
.tp-30::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform-origin: top center; transform: translateX(-50%) scale(0); }
.tp-30:hover::after, .tp-30:focus-visible::after,
.tp-30:hover::before, .tp-30:focus-visible::before { transform: translateX(-50%) scale(1); }` },
  { name: 'Left · Zoom', css: `.tp-31::after { right: calc(100% + var(--tip-gap)); top: 50%; transform-origin: right center; transform: translateY(-50%) scale(0); }
.tp-31::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: var(--tip-bg); transform-origin: right center; transform: translateY(-50%) scale(0); }
.tp-31:hover::after, .tp-31:focus-visible::after,
.tp-31:hover::before, .tp-31:focus-visible::before { transform: translateY(-50%) scale(1); }` },
  { name: 'Right · Zoom', css: `.tp-32::after { left: calc(100% + var(--tip-gap)); top: 50%; transform-origin: left center; transform: translateY(-50%) scale(0); }
.tp-32::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: var(--tip-bg); transform-origin: left center; transform: translateY(-50%) scale(0); }
.tp-32:hover::after, .tp-32:focus-visible::after,
.tp-32:hover::before, .tp-32:focus-visible::before { transform: translateY(-50%) scale(1); }` },
  { name: 'Top · Unfold', css: `.tp-33::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform-origin: bottom center; transform: translateX(-50%) scaleY(0); }
.tp-33::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform-origin: bottom center; transform: translateX(-50%) scaleY(0); }
.tp-33:hover::after, .tp-33:focus-visible::after,
.tp-33:hover::before, .tp-33:focus-visible::before { transform: translateX(-50%) scaleY(1); }` },
  { name: 'Bottom · Unfold', css: `.tp-34::after { left: 50%; top: calc(100% + var(--tip-gap)); transform-origin: top center; transform: translateX(-50%) scaleY(0); }
.tp-34::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform-origin: top center; transform: translateX(-50%) scaleY(0); }
.tp-34:hover::after, .tp-34:focus-visible::after,
.tp-34:hover::before, .tp-34:focus-visible::before { transform: translateX(-50%) scaleY(1); }` },
  { name: 'Top · Swing', css: `.tp-35::after, .tp-35::before { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-35::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform-origin: bottom center; transform: translateX(-50%) rotate(-12deg); }
.tp-35::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%); }
.tp-35:hover::after, .tp-35:focus-visible::after { transform: translateX(-50%) rotate(0); }` },
  { name: 'Top · Skew', css: `.tp-36::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform-origin: bottom center; transform: translate(-50%, 6px) skewX(-18deg); }
.tp-36::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 6px); }
.tp-36:hover::after, .tp-36:focus-visible::after { transform: translate(-50%, 0) skewX(0); }
.tp-36:hover::before, .tp-36:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Top Right · Fade', css: `.tp-37::after { left: 0; bottom: calc(100% + var(--tip-gap)); }
.tp-37::before { left: 14px; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); }` },
  { name: 'Top Left · Fade', css: `.tp-38::after { right: 0; bottom: calc(100% + var(--tip-gap)); }
.tp-38::before { right: 14px; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); }` },
  { name: 'Bottom Right · Fade', css: `.tp-39::after { left: 0; top: calc(100% + var(--tip-gap)); }
.tp-39::before { left: 14px; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); }` },
  { name: 'Bottom Left · Fade', css: `.tp-40::after { right: 0; top: calc(100% + var(--tip-gap)); }
.tp-40::before { right: 14px; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); }` },
  { name: 'Top · Light', css: `/* light bubble scoped to the pseudo-elements so the trigger keeps its own colours */
.tp-41::after { left: 50%; bottom: calc(100% + var(--tip-gap)); background: #E2F1F2; color: #0F191E; border: 1px solid color-mix(in srgb, #0F191E 18%, transparent); box-shadow: 0 6px 18px -6px color-mix(in srgb, #0F191E 35%, transparent); transform: translate(-50%, 6px); }
.tp-41::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: #E2F1F2; transform: translate(-50%, 6px); }
.tp-41:hover::after, .tp-41:focus-visible::after,
.tp-41:hover::before, .tp-41:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Top · Pill', css: `.tp-42::after { left: 50%; bottom: calc(100% + var(--tip-gap)); border-radius: 9999px; padding: 6px 14px; transform: translate(-50%, 6px); }
.tp-42::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 6px); }
.tp-42:hover::after, .tp-42:focus-visible::after,
.tp-42:hover::before, .tp-42:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Top · Glow', css: `.tp-43::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translateX(-50%); box-shadow: 0 0 0 1px color-mix(in srgb, var(--tip-bg) 40%, transparent), 0 0 16px color-mix(in srgb, var(--tip-bg) 55%, transparent); }
.tp-43::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%); }` },
  { name: 'Top · Soft', css: `.tp-44::after { left: 50%; bottom: calc(100% + var(--tip-gap)); border-radius: 12px; padding: 8px 14px; box-shadow: 0 10px 24px -8px color-mix(in srgb, var(--tip-bg) 60%, transparent); transform-origin: bottom center; transform: translateX(-50%) scale(0.8); }
.tp-44::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform-origin: bottom center; transform: translateX(-50%) scale(0.8); }
.tp-44:hover::after, .tp-44:focus-visible::after,
.tp-44:hover::before, .tp-44:focus-visible::before { transform: translateX(-50%) scale(1); }` },
  { name: 'Top · Spaced', css: `.tp-45::after { left: 50%; bottom: calc(100% + var(--tip-gap)); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; transform: translateX(-50%); }
.tp-45::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translateX(-50%); }` },
  { name: 'Top · No Arrow', css: `.tp-46::before { display: none; }
.tp-46::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translate(-50%, 6px); }
.tp-46:hover::after, .tp-46:focus-visible::after { transform: translate(-50%, 0); }` },
  { name: 'Left · Slide Far', css: `.tp-47::after { right: calc(100% + var(--tip-gap)); top: 50%; transform: translate(16px, -50%); }
.tp-47::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: var(--tip-bg); transform: translate(16px, -50%); }
.tp-47:hover::after, .tp-47:focus-visible::after,
.tp-47:hover::before, .tp-47:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Right · Slide Far', css: `.tp-48::after { left: calc(100% + var(--tip-gap)); top: 50%; transform: translate(-16px, -50%); }
.tp-48::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: var(--tip-bg); transform: translate(-16px, -50%); }
.tp-48:hover::after, .tp-48:focus-visible::after,
.tp-48:hover::before, .tp-48:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Bottom · Light', css: `/* light bubble scoped to the pseudo-elements so the trigger keeps its own colours */
.tp-49::after { left: 50%; top: calc(100% + var(--tip-gap)); background: #E2F1F2; color: #0F191E; border: 1px solid color-mix(in srgb, #0F191E 18%, transparent); box-shadow: 0 6px 18px -6px color-mix(in srgb, #0F191E 35%, transparent); transform: translate(-50%, -6px); }
.tp-49::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: #E2F1F2; transform: translate(-50%, -6px); }
.tp-49:hover::after, .tp-49:focus-visible::after,
.tp-49:hover::before, .tp-49:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Bottom · Pill', css: `.tp-50::after { left: 50%; top: calc(100% + var(--tip-gap)); border-radius: 9999px; padding: 6px 14px; transform: translate(-50%, -6px); }
.tp-50::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translate(-50%, -6px); }
.tp-50:hover::after, .tp-50:focus-visible::after,
.tp-50:hover::before, .tp-50:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Bottom · No Arrow', css: `.tp-51::before { display: none; }
.tp-51::after { left: 50%; top: calc(100% + var(--tip-gap)); transform: translate(-50%, -6px); }
.tp-51:hover::after, .tp-51:focus-visible::after { transform: translate(-50%, 0); }` },
  { name: 'Top · Outline', css: `.tp-52::after { left: 50%; bottom: calc(100% + var(--tip-gap)); background: transparent; color: var(--tip-bg); border: 1px solid var(--tip-bg); transform: translate(-50%, 6px); }
.tp-52::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 6px); }
.tp-52:hover::after, .tp-52:focus-visible::after,
.tp-52:hover::before, .tp-52:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Bottom · Glow', css: `.tp-53::after { left: 50%; top: calc(100% + var(--tip-gap)); transform: translateX(-50%); box-shadow: 0 0 0 1px color-mix(in srgb, var(--tip-bg) 40%, transparent), 0 0 16px color-mix(in srgb, var(--tip-bg) 55%, transparent); }
.tp-53::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translateX(-50%); }` },
  { name: 'Left · Light', css: `/* light bubble scoped to the pseudo-elements so the trigger keeps its own colours */
.tp-54::after { right: calc(100% + var(--tip-gap)); top: 50%; background: #E2F1F2; color: #0F191E; border: 1px solid color-mix(in srgb, #0F191E 18%, transparent); box-shadow: 0 6px 18px -6px color-mix(in srgb, #0F191E 35%, transparent); transform: translate(6px, -50%); }
.tp-54::before { right: 100%; top: 50%; border-width: 6px 0 6px var(--tip-gap); border-left-color: #E2F1F2; transform: translate(6px, -50%); }
.tp-54:hover::after, .tp-54:focus-visible::after,
.tp-54:hover::before, .tp-54:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Right · Light', css: `/* light bubble scoped to the pseudo-elements so the trigger keeps its own colours */
.tp-55::after { left: calc(100% + var(--tip-gap)); top: 50%; background: #E2F1F2; color: #0F191E; border: 1px solid color-mix(in srgb, #0F191E 18%, transparent); box-shadow: 0 6px 18px -6px color-mix(in srgb, #0F191E 35%, transparent); transform: translate(-6px, -50%); }
.tp-55::before { left: 100%; top: 50%; border-width: 6px var(--tip-gap) 6px 0; border-right-color: #E2F1F2; transform: translate(-6px, -50%); }
.tp-55:hover::after, .tp-55:focus-visible::after,
.tp-55:hover::before, .tp-55:focus-visible::before { transform: translate(0, -50%); }` },
  { name: 'Top · Slide Far', css: `.tp-56::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translate(-50%, 16px); }
.tp-56::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 16px); }
.tp-56:hover::after, .tp-56:focus-visible::after,
.tp-56:hover::before, .tp-56:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Bottom · Slide Far', css: `.tp-57::after { left: 50%; top: calc(100% + var(--tip-gap)); transform: translate(-50%, -16px); }
.tp-57::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translate(-50%, -16px); }
.tp-57:hover::after, .tp-57:focus-visible::after,
.tp-57:hover::before, .tp-57:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Top · Drop', css: `.tp-58::after, .tp-58::before { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-58::after { left: 50%; bottom: calc(100% + var(--tip-gap)); transform: translate(-50%, -10px); transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-58::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, -10px); }
.tp-58:hover::after, .tp-58:focus-visible::after,
.tp-58:hover::before, .tp-58:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Bottom · Bounce', css: `.tp-59::after, .tp-59::before { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-59::after { left: 50%; top: calc(100% + var(--tip-gap)); transform: translate(-50%, 10px); transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.tp-59::before { left: 50%; top: 100%; border-width: 0 6px var(--tip-gap) 6px; border-bottom-color: var(--tip-bg); transform: translate(-50%, 10px); }
.tp-59:hover::after, .tp-59:focus-visible::after,
.tp-59:hover::before, .tp-59:focus-visible::before { transform: translate(-50%, 0); }` },
  { name: 'Top · Multiline', css: `.tp-60::after { left: 50%; bottom: calc(100% + var(--tip-gap)); width: max-content; max-width: 160px; white-space: normal; line-height: 1.4; text-align: center; transform: translate(-50%, 6px); }
.tp-60::before { left: 50%; bottom: 100%; border-width: var(--tip-gap) 6px 0 6px; border-top-color: var(--tip-bg); transform: translate(-50%, 6px); }
.tp-60:hover::after, .tp-60:focus-visible::after,
.tp-60:hover::before, .tp-60:focus-visible::before { transform: translate(-50%, 0); }` },
];

// All tooltip CSS, plus a reduced-motion guard — injected once for the live page.
export const liveCss = `${TIP_BASE}\n${tips.map((t) => t.css).join('\n')}
/* Respect reduced-motion: reveal instantly, no slide/scale */
@media (prefers-reduced-motion: reduce) {
  .tip::after, .tip::before { transition-duration: 0.01ms !important; }
}`;

// Per-tooltip copyable snippet: required markup as a leading comment (the text
// lives in data-tip), then the shared base styles and this tooltip's own rules.
export const snippets: Record<string, string> = {};
tips.forEach((t, i) => {
  const n = i + 1;
  snippets[String(n)] = `<!-- Markup: <button class="tip tp-${n}" data-tip="${t.name} tooltip">Hover me</button> -->\n\n${TIP_BASE}\n\n${t.css}`;
});

// Per-tooltip LLM prompt: a self-contained instruction a coding agent can paste
// to recreate the exact same tooltip (markup + base styles + direction rules).
export const prompts: Record<string, string> = {};
tips.forEach((t, i) => {
  const n = i + 1;
  const markup = `<button class="tip tp-${n}" data-tip="${t.name} tooltip">Hover me</button>`;
  prompts[String(n)] = `Recreate this tooltip exactly, using pure CSS only — no JavaScript, no external libraries, no dependencies.

It is a "${t.name}" tooltip: a pure-CSS tooltip whose bubble + arrow position and reveal (direction, animation, timing curve, and colours) must match the CSS below precisely.

Use this exact HTML markup (the tooltip text lives in the \`data-tip\` attribute):

${markup}

Apply this CSS. The \`.tip\` rules are the shared base every tooltip starts from (the bubble is \`::after\`, the arrow is \`::before\`); the \`.tp-${n}\` rules layer on the "${t.name}" position and reveal:

${TIP_BASE}

${t.css}

Requirements:
- Keep the markup and class names exactly as shown; the bubble text comes from \`data-tip\`.
- The tooltip is themed through CSS custom properties (\`--tip-bg\`, \`--tip-fg\`, \`--tip-radius\`, \`--tip-gap\`) — preserve them so the colours and spacing can be overridden.
- Reveal the bubble + arrow on both \`:hover\` and \`:focus-visible\` so it is keyboard accessible.
- Respect \`prefers-reduced-motion: reduce\` by making the transitions near-instant.
- Do not add any JavaScript; the tooltip must be achieved with CSS alone.`;
});
