import { useState, useEffect, useRef } from 'react'

// ─── Dimension library ───────────────────────────────────────────────────────

const SUGGESTED_DIMENSIONS = [
  {
    id: 'conciseness',
    name: 'Conciseness',
    poles: { low: 'expansive and fully elaborated', high: 'terse with no unnecessary words' },
  },
  {
    id: 'clarity',
    name: 'Clarity',
    poles: { low: 'loosely structured and implicit', high: 'direct, unambiguous, and well-organized' },
  },
  {
    id: 'warmth',
    name: 'Warmth',
    poles: { low: 'cool and transactional', high: 'warm, personable, and emotionally present' },
  },
  {
    id: 'formality',
    name: 'Formality',
    poles: { low: 'casual and conversational', high: 'formal and professional' },
  },
  {
    id: 'directness',
    name: 'Directness',
    poles: { low: 'diplomatic and heavily hedged', high: 'blunt with no softening' },
  },
  {
    id: 'humor',
    name: 'Humor',
    poles: { low: 'strictly serious', high: 'lightly playful where appropriate' },
  },
]

// ─── Slider logic ────────────────────────────────────────────────────────────

function isNeutral(value) {
  return value >= 36 && value <= 64
}

// Returns a phrase for the prompt, or null if neutral (neutral dims are omitted)
function getPromptPhrase(value, name, poles) {
  if (isNeutral(value)) return null
  if (poles) {
    if (value <= 10) return `push hard toward "${poles.low}"`
    if (value <= 35) return `lean toward "${poles.low}"`
    if (value <= 89) return `lean toward "${poles.high}"`
    return `push hard toward "${poles.high}"`
  }
  // Custom dimension — describe by intensity
  if (value <= 10) return `minimize ${name}`
  if (value <= 35) return `reduce ${name}`
  if (value <= 89) return `increase ${name}`
  return `maximize ${name}`
}

// Returns a human-readable label shown below the slider
function getSliderLabel(value, poles) {
  if (isNeutral(value)) return 'neutral'
  if (poles) {
    if (value <= 10) return `${poles.low} — strong`
    if (value <= 35) return poles.low
    if (value <= 89) return poles.high
    return `${poles.high} — strong`
  }
  if (value <= 10) return 'minimum'
  if (value <= 35) return 'low'
  if (value <= 89) return 'high'
  return 'maximum'
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(text, activeDimensions, sliderValues) {
  const lines = activeDimensions
    .map((dim) => {
      const val = sliderValues[dim.id] ?? 50
      const phrase = getPromptPhrase(val, dim.name, dim.poles)
      return phrase ? `- ${dim.name}: ${phrase}` : null
    })
    .filter(Boolean)

  if (lines.length === 0) {
    return `Rewrite the following text without changing its meaning. Return ONLY the rewritten text.\n\n"""\n${text}\n"""`
  }

  return [
    'Rewrite the following text with these tone and style adjustments:',
    '',
    ...lines,
    '',
    'Return ONLY the rewritten text. No explanation, no preamble.',
    '',
    'Original:',
    '"""',
    text,
    '"""',
  ].join('\n')
}

// ─── Settings persistence ────────────────────────────────────────────────────

const DEFAULT_SETTINGS = { baseURL: '', model: 'gpt-4o-mini', apiKey: '' }

function loadSettings() {
  try {
    const s = localStorage.getItem('ct-settings')
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

// ─── Components ──────────────────────────────────────────────────────────────

function SettingsModal({ settings, onChange, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Provider settings</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="field-label">
            Base URL
            <span className="field-hint">
              Leave blank to use the Vercel serverless function (recommended). For a local model use e.g.{' '}
              <code>http://localhost:11434/v1</code>
            </span>
            <input
              className="field-input"
              value={settings.baseURL}
              onChange={(e) => onChange({ ...settings, baseURL: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="field-label">
            Model
            <input
              className="field-input"
              value={settings.model}
              onChange={(e) => onChange({ ...settings, model: e.target.value })}
              placeholder="gpt-4o-mini"
            />
          </label>
          <label className="field-label">
            API key override
            <span className="field-hint">
              For local testing only. In production, set <code>API_KEY</code> as a Vercel environment variable instead.
            </span>
            <input
              className="field-input"
              type="password"
              value={settings.apiKey}
              onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
              placeholder="sk-…"
            />
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

function DimensionSlider({ dim, value, onChange, onRemove }) {
  const label = getSliderLabel(value, dim.poles)
  const neutral = isNeutral(value)
  const pct = value + '%'

  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-name">{dim.name}</span>
        <button className="remove-btn" onClick={onRemove} title="Remove">✕</button>
      </div>
      {dim.poles && (
        <div className="slider-poles">
          <span>{dim.poles.low}</span>
          <span>{dim.poles.high}</span>
        </div>
      )}
      <div className="slider-track-wrap" style={{ '--val': pct }}>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider"
        />
        <div className="center-tick" />
      </div>
      <div className={`slider-label ${neutral ? 'label-neutral' : 'label-active'}`}>
        {label}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [inputText, setInputText] = useState('')
  const [activeDims, setActiveDims] = useState([])
  const [sliderValues, setSliderValues] = useState({})
  const [output, setOutput] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [customInput, setCustomInput] = useState('')
  const customRef = useRef(null)
  const outputRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem('ct-settings', JSON.stringify(settings)) } catch {}
  }, [settings])

  // Scroll output into view after a run
  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [output])

  function addDim(dim) {
    if (activeDims.find((d) => d.id === dim.id)) return
    setActiveDims((prev) => [...prev, dim])
    setSliderValues((prev) => ({ ...prev, [dim.id]: 50 }))
  }

  function removeDim(id) {
    setActiveDims((prev) => prev.filter((d) => d.id !== id))
    setSliderValues((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  function addCustom() {
    const name = customInput.trim()
    if (!name) return
    const id = `custom-${Date.now()}`
    addDim({ id, name, poles: null })
    setCustomInput('')
    customRef.current?.focus()
  }

  function setSlider(id, value) {
    setSliderValues((prev) => ({ ...prev, [id]: value }))
  }

  async function run() {
    if (!inputText.trim() || activeDims.length === 0) return
    setIsLoading(true)
    setError(null)

    const prompt = buildPrompt(inputText, activeDims, sliderValues)
    const isLocal =
      settings.baseURL &&
      (settings.baseURL.includes('localhost') || settings.baseURL.includes('127.0.0.1'))

    try {
      let rewrite

      if (isLocal) {
        // Call local model directly from browser (Ollama, LM Studio, vLLM, etc.)
        const res = await fetch(`${settings.baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.model || 'llama3',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          }),
        })
        if (!res.ok) throw new Error(`Model returned ${res.status}`)
        const data = await res.json()
        rewrite = data.choices[0]?.message?.content?.trim()
      } else {
        // Route through serverless function (key stays server-side)
        const body = { prompt, model: settings.model }
        if (settings.baseURL) body.baseURL = settings.baseURL
        if (settings.apiKey) body.apiKey = settings.apiKey

        const res = await fetch('/api/rewrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Request failed (${res.status})`)
        }
        const data = await res.json()
        rewrite = data.rewrite
      }

      if (!rewrite) throw new Error('Empty response from model')
      setOutput(rewrite)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const canRun = inputText.trim().length > 0 && activeDims.length > 0

  return (
    <div className="app">
      <header className="header">
        <h1 className="app-title">Comment Tuner</h1>
        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      <main className="main">
        {/* ── Input ── */}
        <section className="section">
          <label className="section-label">Your text</label>
          <textarea
            className="textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste or type the comment, email, or note you want to adjust…"
            rows={5}
          />
        </section>

        {/* ── Dimension chips ── */}
        <section className="section">
          <label className="section-label">Dimensions</label>
          <div className="chips-row">
            {SUGGESTED_DIMENSIONS.map((dim) => {
              const active = !!activeDims.find((d) => d.id === dim.id)
              return (
                <button
                  key={dim.id}
                  className={`chip ${active ? 'chip-active' : ''}`}
                  onClick={() => (active ? removeDim(dim.id) : addDim(dim))}
                >
                  {dim.name}
                </button>
              )
            })}
            <div className="custom-wrap">
              <input
                ref={customRef}
                className="custom-input"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                placeholder="+ Add your own"
              />
            </div>
          </div>
        </section>

        {/* ── Sliders ── */}
        {activeDims.length > 0 && (
          <section className="section sliders-section">
            {activeDims.map((dim) => (
              <DimensionSlider
                key={dim.id}
                dim={dim}
                value={sliderValues[dim.id] ?? 50}
                onChange={(v) => setSlider(dim.id, v)}
                onRemove={() => removeDim(dim.id)}
              />
            ))}
          </section>
        )}

        {/* ── Run row ── */}
        <div className="run-row">
          {activeDims.length === 0 ? (
            <span className="run-hint">Select at least one dimension</span>
          ) : (
            <button className="btn-primary" onClick={run} disabled={!canRun || isLoading}>
              {isLoading ? (
                <span className="btn-inner">
                  <span className="spinner" />
                  Rewriting…
                </span>
              ) : output ? 'Regenerate' : 'Go'}
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Output ── */}
        {output && !isLoading && (
          <section className="output-section" ref={outputRef}>
            <div className="output-col">
              <div className="output-col-header">Original</div>
              <div className="output-text">{inputText}</div>
            </div>
            <div className="output-divider" />
            <div className="output-col">
              <div className="output-col-header">
                Rewrite
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(output)}
                >
                  Copy
                </button>
              </div>
              <div className="output-text output-text-rewrite">{output}</div>
            </div>
          </section>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
