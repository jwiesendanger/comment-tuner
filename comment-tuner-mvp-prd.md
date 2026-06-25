# Comment Tuner — MVP PRD

**Status:** Draft  
**Scope:** MVP / Internal Utility  
**Last updated:** 2026-06-25

---

## 1. Purpose

Comment Tuner rewrites a piece of text according to a set of user-defined "dials," letting the user shape the tone and style of a message without rewriting it by hand.

People often write a comment, email, or note that says the right thing but lands wrong — too blunt, too rambling, too cold. Rewriting it well takes time and judgment. This tool does that rewrite on demand and gives the user direct, visible control over exactly how it's adjusted.

---

## 2. North Star

**The product is the visible effect of moving a dial.** Every design decision — prompting strategy, UI layout, interaction model — should serve one thing: when the user nudges a slider and re-runs, the text changes in the way they expected, and they can see it.

If that loop feels alive and legible, the tool is worth using. If the sliders feel decorative, nothing else saves it.

---

## 3. Core User Flow

1. User pastes or types a comment into the input field.
2. User adds one or more **dimensions** by clicking suggested chips (e.g., Conciseness, Warmth) or typing a custom one.
3. Each dimension gets a bipolar slider (0–100, neutral center at 50).
4. User clicks **Go**.
5. The tool constructs a prompt from the text and active slider states, sends it to the configured AI model, and displays the rewrite **side by side** with the original.
6. User adjusts sliders and clicks **Regenerate** to iterate.

---

## 4. Dimension Model

### 4.1 What a dimension is

A dimension is a named, bipolar axis with a neutral center. Every dimension has:
- A **name** (e.g., "Conciseness", "Warmth", or anything the user types)
- Implied **poles**: what 0 means vs. what 100 means
- A **slider value** (0–100), where 50 = "leave this axis alone"

### 4.2 Suggested dimensions (shipped defaults)

The app ships a library of clickable chips. Clicking one adds its slider.

| Chip | 0 pole | 100 pole |
|------|--------|----------|
| Conciseness | Expansive, fully elaborated | Terse, no unnecessary words |
| Clarity | Loosely structured, implicit | Direct, unambiguous, well-organized |
| Warmth | Cool, transactional | Warm, personable, emotionally present |
| Formality | Casual, conversational | Formal, professional register |
| Directness | Diplomatic, heavily hedged | Blunt, no softening |
| Humor | Strictly serious | Lightly playful where appropriate |

### 4.3 Custom dimensions

A "+ Add your own" field lets the user type any dimension name. The model infers the poles from the name. Optional pole definitions are out of scope for MVP.

### 4.4 Prompt construction (the key design decision)

Raw 0–100 values are meaningless to a language model — it cannot reliably distinguish 70 from 80. Internally, the app quantizes each slider into **five labeled steps** and translates each step into a natural-language intensity phrase before it touches the prompt.

| Slider range | Phrase passed to model |
|---|---|
| 0–10 | "push hard toward [0-pole]" |
| 11–35 | "lean toward [0-pole]" |
| 36–64 | "leave this axis neutral — do not deliberately push in either direction" |
| 65–89 | "lean toward [100-pole]" |
| 90–100 | "push hard toward [100-pole]" |

This gives users five perceptible, monotonic steps per dial — honest and reliable — while the slider UI still feels smooth and continuous.

All active dimensions are passed together in a single prompt. The model reconciles tensions (e.g., high Conciseness vs. high Warmth) holistically. Do not apply dimensions sequentially; that creates order-dependent drift.

Dimensions set to neutral (36–64) are omitted from the prompt entirely — they add noise without signal.

---

## 5. Output

- Original text and rewrite are displayed **side by side**. This is non-negotiable — it's what makes the dials feel meaningful.
- A **Regenerate** button re-runs the same config without re-entering text.
- A **Copy** button copies the rewrite to clipboard.
- No diff highlighting, multiple variants, or saved history in MVP.

---

## 6. Visual Design

### 6.1 Aesthetic direction

**Modern minimalist.** The dials are the signature element of the product — everything else should recede. The design must feel considered, not utilitarian, even though this is an internal tool.

- **Color:** Near-monochrome base (off-white background, near-black text, light gray borders). One accent color (e.g., a muted indigo or slate-blue) used only on the active state of sliders and the Go/Regenerate CTA. No decorative color.
- **Typography:** One typeface throughout. A geometric sans with good legibility at small sizes (e.g., Inter, DM Sans). No decorative or display faces.
- **Density:** Generous whitespace. Nothing feels crowded. The slider row is the hero element of the interface.
- **Motion:** Sparing and purposeful. The output panel fades in on completion. Slider thumbs respond with a subtle tactile feel. Nothing bounces or spins.

### 6.2 Layout (single page, no nav)

```
┌─────────────────────────────────────────────────┐
│  Comment Tuner                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Input textarea — full width, ~5 rows]         │
│                                                 │
│  Dimensions                                     │
│  [Conciseness] [Warmth] [Formality] ... [+Add]  │
│                                                 │
│  ──── Conciseness ─────────────●────────────    │
│       Expansive               ↑50           Terse│
│  ──── Warmth ──────────────────────●────────    │
│       Cool                              Warm    │
│                                                 │
│                         [  Go  ]                │
│                                                 │
├───────────────────┬─────────────────────────────┤
│   Original        │   Rewrite                   │
│                   │                             │
│   [text]          │   [rewritten text]          │
│                   │                [Copy]       │
│                   │           [Regenerate]      │
└───────────────────┴─────────────────────────────┘
```

### 6.3 Slider design

- Each slider has a visible **center notch** (a tick or slight indentation at 50) so the user can see and feel when they've crossed into one territory or another.
- Active (non-neutral) sliders show their current intensity phrase in small text below the track, so the user knows exactly what the model will receive.
- Removing a dimension chip removes its slider.

---

## 7. Provider / Model Configuration

### 7.1 Provider abstraction

The tool must work with both hosted API providers (OpenAI, Anthropic, Azure, Grok, etc.) and local model runners (Ollama, LM Studio, vLLM). A provider is a single config object:

```json
{
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "apiKey": "sk-..."
}
```

Because nearly all hosted providers and local runners support the OpenAI-compatible `/v1/chat/completions` format, one adapter covers almost everything. The model field is configuration, not code.

### 7.2 Request routing

Hosted key and local URL cannot share a request path:

- **Hosted (apiKey present):** Browser → serverless function (holds key securely) → provider API. The key never touches the browser.
- **Local (no apiKey):** Browser → local model URL directly (e.g., `http://localhost:11434`). The serverless function cannot reach `localhost` on the user's machine — only their browser can. Local runners must have CORS enabled.

The app branches on whether an apiKey is present in config.

### 7.3 Config UI (MVP)

A settings panel (behind a gear icon) exposes:
- Base URL field
- Model name field
- API key field (masked, optional — leave blank for local)

One config at a time. Named presets / profile switching are post-MVP.

---

## 8. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Single-page app (React or plain JS) | Runtime-dynamic slider list is natural in code; impractical in Power Apps |
| Backend | One serverless function | Holds hosted API key server-side; routes model calls |
| Hosting | Vercel | Static page + function, deploys in minutes |
| Model | Any OpenAI-compatible endpoint | Config field, not code — swap without touching the app |

**Teams integration:** Not required for MVP. If needed later, the same web app can be embedded as a Teams tab with no changes to the app itself. Power Apps is not the path.

---

## 9. Out of Scope (v1)

- Saved rewrite history
- Multiple simultaneous rewrite variants
- Custom pole definitions per dimension
- Diff / change highlighting
- User accounts or authentication
- Named provider presets
- Branding / polish

This is an internal utility. Scope discipline is the product.

---

## 10. Success Criteria

The MVP is working when:

1. A user can paste text, add at least two dimensions, set sliders, and receive a coherent rewrite that perceptibly reflects those settings.
2. Moving a slider from neutral to either extreme produces a noticeably different rewrite.
3. Two dimensions with some tension (e.g., Conciseness + Warmth both high) produce a plausible reconciliation, not a broken output.
4. The tool routes correctly through the serverless function for hosted keys and directly from the browser for local model URLs.
5. The original and rewrite sit visibly side by side in the output.

**This is an empirical question, not a spec question.** The slider semantics (the phrase-mapping table in §4.4) should be treated as a starting hypothesis and tuned after hands-on use. Ten minutes of playing with live output will teach more than further design.

---

## 11. Decisions

| Question | Decision | Notes |
|---|---|---|
| Do sliders trade off against each other in the UI, or are they independent? | **Independent** — the model reconciles tensions | Sequential application creates drift; holistic is cleaner |
| What happens if the user submits with no dimensions active? | **Show inline message:** "Select at least one dimension" | Go button remains visible but submission is blocked |
| Minimum viable error handling for failed model calls? | Show inline error message, keep input state | Don't clear the form on failure |
