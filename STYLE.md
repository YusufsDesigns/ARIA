# ARIA Design System
## style.md — Read Before Any UI Work

---

## Brand Identity

ARIA logo: White bold letterforms, orange dot accents on A and I, black background.
Tagline: "The Marketplace for AI Agents" (but never use "marketplace" in consumer-facing copy)
Consumer tagline: "Any goal. The right agents."
Developer tagline: "Build an agent. Earn every time it runs."

---

## Color Palette

```css
:root {
  /* Core */
  --aria-black:    #000000;  /* Background — pure, not near-black */
  --aria-white:    #FFFFFF;  /* Primary text */
  --aria-orange:   #FF6B35;  /* Brand accent — from logo */
  --aria-orange-glow: rgba(255, 107, 53, 0.15); /* Soft orange glow */
  --aria-orange-dim:  rgba(255, 107, 53, 0.60); /* Muted orange */

  /* Grays */
  --aria-gray-100: #F5F5F5;
  --aria-gray-400: #888888;  /* Muted text, placeholders */
  --aria-gray-600: #4A4A4A;  /* Subtle borders, dividers */
  --aria-gray-800: #1A1A1A;  /* Section backgrounds (slightly off-black) */
  --aria-gray-900: #0D0D0D;  /* Cards, elevated surfaces */

  /* Semantic */
  --aria-success:  #22C55E;  /* Task complete, agent paid */
  --aria-pending:  #3B82F6;  /* In progress */
  --aria-warning:  #EAB308;  /* Budget low */
  --aria-error:    #EF4444;  /* Failed */

  /* Shadows */
  --aria-glow-sm:  0 0 20px rgba(255, 107, 53, 0.2);
  --aria-glow-md:  0 0 40px rgba(255, 107, 53, 0.25);
  --aria-glow-lg:  0 0 80px rgba(255, 107, 53, 0.3);
}
```

**Usage rules:**
- Orange on black for primary CTAs, key accents, data highlights
- Never use orange for more than 15% of any given screen
- Off-black (#0D0D0D or #1A1A1A) for cards and sections — NOT the same as background
- Gray-400 for ALL placeholder text, captions, secondary info
- Never use white/orange gradient — it reads as "crypto bro"
- Never use purple. ARIA is not purple.

---

## Typography

```css
/* Import in layout.tsx */
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Hanken+Grotesk:wght@300;400;500;600;700;800&display=swap');

:root {
  --font-display: 'Chakra Petch', sans-serif;    /* All headings, labels, badges */
  --font-body:    'Hanken Grotesk', sans-serif;  /* Body text, UI text */
}
```

### Type Scale

```css
/* Display headings (Chakra Petch) */
.text-hero    { font: 700 clamp(48px, 8vw, 96px)/1.0 var(--font-display); letter-spacing: -0.02em; }
.text-h1      { font: 700 clamp(36px, 5vw, 64px)/1.05 var(--font-display); letter-spacing: -0.02em; }
.text-h2      { font: 600 clamp(24px, 3vw, 40px)/1.1  var(--font-display); letter-spacing: -0.01em; }
.text-h3      { font: 600 clamp(18px, 2vw, 24px)/1.2  var(--font-display); }
.text-label   { font: 500 12px/1.0 var(--font-display); letter-spacing: 0.12em; text-transform: uppercase; }

/* Body text (Hanken Grotesk) */
.text-body-lg { font: 400 18px/1.6 var(--font-body); }
.text-body    { font: 400 16px/1.6 var(--font-body); }
.text-body-sm { font: 400 14px/1.5 var(--font-body); }
.text-caption { font: 400 12px/1.4 var(--font-body); color: var(--aria-gray-400); }

/* Code / data */
.text-code    { font: 400 13px/1.5 'Fira Code', monospace; }
```

**Rules:**
- Chakra Petch for ALL headings, ALL badge/label text, ALL nav items, ALL button text
- Hanken Grotesk for ALL body copy, descriptions, form labels, captions
- Never use Chakra Petch below 12px (becomes unreadable)
- Never use Hanken Grotesk for headings above h3 level
- Line height 1.0-1.1 for large display text, 1.5-1.6 for body text

---

## Spacing

```css
/* 8px base unit */
--space-1:  4px;   /* Micro gaps */
--space-2:  8px;   /* Tight spacing within components */
--space-3:  12px;
--space-4:  16px;  /* Default component padding */
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;  /* Section internal spacing */
--space-10: 40px;
--space-12: 48px;  /* Section padding */
--space-16: 64px;  /* Large section gaps */
--space-20: 80px;
--space-24: 96px;  /* Major section separators */
--space-32: 128px; /* Hero padding */
```

**Key spacings:**
- Landing page sections: 96px top/bottom padding
- Card padding: 24px
- Button padding: 12px 24px (or 16px 32px for primary)
- Max content width: 1200px, centered

---

## Component Patterns

### Buttons

```css
/* Primary CTA */
.btn-primary {
  background: #FF6B35;
  color: #000;
  font: 600 14px/1 'Chakra Petch', sans-serif;
  letter-spacing: 0.05em;
  padding: 14px 32px;
  border-radius: 4px; /* NOT fully rounded — ARIA is precise, not soft */
  border: none;
  transition: opacity 150ms ease-out, transform 100ms ease-out;
}
.btn-primary:hover  { opacity: 0.9; }
.btn-primary:active { transform: scale(0.98); }

/* Secondary */
.btn-secondary {
  background: transparent;
  color: #FFF;
  border: 1px solid rgba(255,255,255,0.2);
  /* Same padding/font as primary */
  transition: border-color 150ms ease-out, background 150ms ease-out;
}
.btn-secondary:hover { border-color: #FF6B35; background: rgba(255,107,53,0.05); }

/* Ghost/text */
.btn-ghost {
  background: none; border: none; color: var(--aria-gray-400);
  transition: color 150ms ease-out;
}
.btn-ghost:hover { color: #FFF; }
```

**Rules:**
- Border radius: 4px for most buttons (NOT fully rounded pill — that's too soft for ARIA)
- Fully rounded only for badge/chip elements
- Primary button ALWAYS black text on orange
- Active state: scale(0.98), NOT scale(0.95) — too dramatic

### Cards

```css
.card-default {
  background: #0D0D0D;
  border: 1px solid #2A2A2A;
  border-radius: 8px;
  padding: 24px;
  transition: border-color 200ms ease-out;
}
.card-default:hover { border-color: rgba(255,107,53,0.4); }

/* Featured/highlighted card */
.card-featured {
  background: linear-gradient(135deg, #0D0D0D 0%, #1A0D00 100%);
  border: 1px solid rgba(255,107,53,0.3);
  box-shadow: 0 0 40px rgba(255,107,53,0.1);
}
```

**Rules:**
- Cards on the black background: use #0D0D0D or #111111 background — distinct but not jarring
- Border on cards: #2A2A2A default, orange tint on hover
- Never use heavy drop shadows on dark cards — they disappear. Use glow instead.
- Card corners: 8px radius for most, 4px for technical/data cards

### Badges / Status Chips

```css
.badge {
  font: 500 11px/1 'Chakra Petch', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 3px;
}

.badge-orange  { background: rgba(255,107,53,0.15); color: #FF6B35; border: 1px solid rgba(255,107,53,0.3); }
.badge-green   { background: rgba(34,197,94,0.12);  color: #22C55E; border: 1px solid rgba(34,197,94,0.3); }
.badge-blue    { background: rgba(59,130,246,0.12); color: #60A5FA; border: 1px solid rgba(59,130,246,0.3); }
.badge-gray    { background: rgba(255,255,255,0.06); color: #888;   border: 1px solid rgba(255,255,255,0.1); }
```

### Input / Prompt Area

```css
.prompt-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: #FFF;
  font: 400 16px/1.5 'Hanken Grotesk', sans-serif;
  padding: 16px 20px;
  width: 100%;
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
}
.prompt-input:focus {
  border-color: rgba(255,107,53,0.5);
  box-shadow: 0 0 0 3px rgba(255,107,53,0.1);
  outline: none;
}
.prompt-input::placeholder { color: #555; }
```

---

## Animations

```css
/* ARIA custom easing (use everywhere) */
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out:     cubic-bezier(0.77, 0, 0.175, 1);
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); /* For badges, status changes */

/* Standard durations */
--duration-fast:   150ms;  /* Button states, hover */
--duration-normal: 250ms;  /* Dropdowns, small reveals */
--duration-slow:   400ms;  /* Page transitions, large reveals */
```

**Rules (Emil Kowalski principles):**
- Button press: scale(0.98), 100ms ease-out
- Entering elements: from opacity:0 + translateY(8px) to opacity:1 + translateY(0)
- Exit animations are FASTER than entry (exit: 150ms, enter: 250ms)
- Never animate `height` directly — use `grid-template-rows: 0fr → 1fr`
- Never use bounce/elastic easing — too playful for ARIA's precision tone
- Stagger lists: 30-50ms between items

---

## Component Usage Map

Every component must be used. Here is where each one lives and which variant applies.

### SmokeBackground (spooky-smoke-animation.tsx)
- **Hero section of `/`** — full viewport background, `smokeColor="#FF6B35"`
- **App page `/app`** — same component, same orange, creates visual continuity from landing to product
- Sits as `position: absolute, inset: 0` behind all content. Content overlays it.

### agent-plan (agent-plan.tsx)
- **Landing page Section 3** — shows the live ReAct loop demo with ARIA-specific task data
- **App page `/app`** — shown inline below the prompt after task submission, updating in real-time via SSE
- Replace default task data with ARIA agent flow tasks (see CLAUDE.md for exact task data)
- Replace "MCP Servers" tool label with "Venice AI" and "x402 Payment"

### DisplayCards (display-cards.tsx)
- **Landing page Section 4** — three overlapping agent showcase cards
- Use the stacked/hover interaction as-is. Replace card content with ARIA agent data (see CLAUDE.md)

### features-10.tsx
- **Landing page Section 6** — adapted for ARIA features
- Replace the Tailark images with styled SVG diagrams or local illustrations
- Left card: MetaMask Smart Accounts / delegation visual
- Right card: x402 pay-per-use diagram
- Full-width bottom card: capability tags grid (replace CircularUI)

### card.tsx — Use All 8 Variants

| Variant | Where |
|---|---|
| `default` | Agent cards on `/agents` marketplace grid |
| `dots` | Developer CTA section on landing page |
| `gradient` | Privacy comparison section — ARIA side |
| `plus` | "How it works" three-step cards on landing page |
| `neubrutalism` | Capability gap cards on `/agents#gaps` section |
| `inner` | Code snippet blocks (x402 middleware example on `/register`) |
| `lifted` | Featured/highlighted agent card (top-rated agent) |
| `corners` | Stats bar cards (total agents, tasks completed, USDC earned) |

### Footer (motion-footer.tsx) — Visual Only, No GSAP

See footer section below for full spec.

---

## Footer Specification — No GSAP

Strip all GSAP code from `motion-footer.tsx`. Keep every visual element. The footer becomes a regular `<footer>` with CSS-only animations.

### What to Remove
```
- import { gsap } from 'gsap'
- import { ScrollTrigger } from 'gsap/ScrollTrigger'
- gsap.registerPlugin(ScrollTrigger)
- All useEffect blocks (both the GSAP one and the magnetic button one)
- wrapperRef, giantTextRef, headingRef, linksRef — all refs
- The clipPath wrapper div (removes the scroll-reveal curtain effect)
- position: fixed on the footer element
- h-screen height constraint
- MagneticButton GSAP logic — simplify to a plain div/button with CSS hover
```

### What to Keep (All the Visual Goodness)
```
- The STYLES string with all CSS keyframes and classes — keep entirely
- footer-bg-grid (the subtle grid background)
- footer-aurora with animate-footer-breathe (CSS-only breathing glow)
- footer-giant-bg-text "ARIA" (the huge background text)
- The diagonal marquee strip with animate-footer-scroll-marquee
- Glass pill buttons (.footer-glass-pill)
- The three-column bottom bar (copyright, made with ❤, back to top)
- footer-text-glow on the main heading
```

### Clean Footer Structure (No GSAP)
```tsx
export function AriaFooter() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <footer className="relative w-full min-h-[600px] flex flex-col justify-between
                         overflow-hidden bg-background text-foreground cinematic-footer-wrapper">

        {/* Aurora + Grid */}
        <div className="footer-aurora absolute left-1/2 top-1/2 h-[60vh] w-[80vw]
                        -translate-x-1/2 -translate-y-1/2 animate-footer-breathe
                        rounded-[50%] blur-[80px] pointer-events-none z-0" />
        <div className="footer-bg-grid absolute inset-0 z-0 pointer-events-none" />

        {/* Giant background ARIA text */}
        <div className="footer-giant-bg-text absolute -bottom-[5vh] left-1/2
                        -translate-x-1/2 whitespace-nowrap z-0 pointer-events-none select-none">
          ARIA
        </div>

        {/* Diagonal marquee */}
        <div className="absolute top-12 left-0 w-full overflow-hidden
                        border-y border-border/50 bg-background/60 backdrop-blur-md
                        py-4 z-10 -rotate-2 scale-110 shadow-2xl">
          <div className="flex w-max animate-footer-scroll-marquee
                          text-xs font-bold tracking-[0.3em] text-muted-foreground uppercase">
            <MarqueeItem /><MarqueeItem />
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-1 flex-col items-center
                        justify-center px-6 mt-20 w-full max-w-5xl mx-auto">
          <h2 className="text-5xl md:text-8xl font-black footer-text-glow
                         tracking-tighter mb-12 text-center">
            Start building with ARIA
          </h2>
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/app" className="footer-glass-pill px-10 py-5 rounded-full
                                        text-foreground font-bold text-sm">
                Try ARIA Free
              </a>
              <a href="/register" className="footer-glass-pill px-10 py-5 rounded-full
                                             text-foreground font-bold text-sm">
                Register Your Agent
              </a>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              <a href="/agents" className="footer-glass-pill px-6 py-3 rounded-full
                                           text-muted-foreground text-xs">Browse Agents</a>
              <a href="#" className="footer-glass-pill px-6 py-3 rounded-full
                                     text-muted-foreground text-xs">Privacy Policy</a>
              <a href="#" className="footer-glass-pill px-6 py-3 rounded-full
                                     text-muted-foreground text-xs">Docs</a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative z-20 w-full pb-8 px-6 md:px-12
                        flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-muted-foreground text-[10px] font-semibold
                          tracking-widest uppercase order-2 md:order-1">
            © 2026 ARIA — The Marketplace for AI Agents
          </div>
          <div className="footer-glass-pill px-6 py-3 rounded-full flex items-center
                          gap-2 order-1 md:order-2 cursor-default">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
              Built on
            </span>
            <span className="text-foreground font-black text-xs ml-1">Base Sepolia</span>
            <span className="text-[10px] text-muted-foreground">×</span>
            <span className="text-foreground font-black text-xs">Venice AI</span>
          </div>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="w-12 h-12 rounded-full footer-glass-pill flex items-center
                             justify-center text-muted-foreground hover:text-foreground
                             order-3 transition-colors">
            ↑
          </button>
        </div>
      </footer>
    </>
  )
}
```

### MarqueeItem for ARIA
```tsx
const MarqueeItem = () => (
  <div className="flex items-center space-x-12 px-6">
    <span>Private by Design</span> <span className="text-primary/60">✦</span>
    <span>Zero Data Retention</span> <span className="text-secondary/60">✦</span>
    <span>On-chain Permissions</span> <span className="text-primary/60">✦</span>
    <span>Agent Economy</span> <span className="text-secondary/60">✦</span>
    <span>Venice Powered</span> <span className="text-primary/60">✦</span>
    <span>ERC-7710</span> <span className="text-secondary/60">✦</span>
  </div>
)
```

The STYLES CSS string from the original component stays intact — all the animation keyframes, glass pill styles, grid background, aurora, giant text, and marquee are pure CSS and work perfectly without GSAP.

---

## Page-Specific Design Notes

### Landing Page (/)
- Full viewport hero with SmokeBackground (orange)
- Content sits on top of smoke with glass-morphism very subtly on the prompt area only
- Scroll down reveals sections on pure black background
- Use horizontal rules (1px, rgba(255,255,255,0.08)) between major sections
- Every section header: small Chakra Petch label in orange above the main heading

### App Page (/app)
- SmokeBackground continues (same component, same orange)
- Center-aligned layout, max-width 640px
- ARIA logo mark (small) above prompt
- After wallet connected: show greeting + budget setting before prompt
- Quick example prompts appear below the textarea

### Task Execution (/task/[id])
- Dark background (black)
- Two-column layout on desktop: left = ReAct reasoning/agent feed, right = results
- Payment Ledger uses monospace numbers for amounts
- All transaction hashes are links to BaseScan

### Agents Page (/agents)
- Grid layout: 3 columns desktop, 2 tablet, 1 mobile
- Filter sidebar: capabilities, price range, rating
- Each card: agent name (Chakra Petch), capability badges, price, rating, tasks completed
- "Register Your Agent" banner at top

### Gaps Page (/gaps)
- Header: "What ARIA needs next"
- Demand cards sorted by count
- Orange demand bars/progress indicators
- Each card: capability name, demand count, "estimated earnings", Build CTA

---

## Anti-patterns (Never Do)

- Never use purple in any form
- Never use glassmorphism except on the prompt input overlay (sparingly)
- Never use gradient text for body copy
- Never use heavy outer drop shadows on dark cards
- Never use "rounded-full" on buttons (only on badges/chips)
- Never use Inter or Space Grotesk
- Never use white or light backgrounds anywhere on the main ARIA app
- Never add large rounded icons above every heading (template-looking)
- Never use sparklines as decoration
- Never use left/right colored border stripes as card accents (> 1px)
- Never center-align body paragraphs (only headings)