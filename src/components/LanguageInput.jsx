import { useEffect, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'

// Small helper: deep freeze to avoid accidental mutations
function deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj)
    Object.getOwnPropertyNames(obj).forEach((prop) => deepFreeze(obj[prop]))
  }
  return obj
}

// NFA/DFA simulation with epsilon-closure support
function epsilonClosure(stateSet, transitions) {
  const stack = [...stateSet]
  const visited = new Set(stateSet)
  while (stack.length) {
    const s = stack.pop()
    const epsTargets = (transitions[s]?.[''] || []).concat(transitions[s]?.['eps'] || [])
    for (const t of epsTargets) {
      if (!visited.has(t)) {
        visited.add(t)
        stack.push(t)
      }
    }
  }
  return visited
}

function stepNFA(currentStates, symbol, transitions) {
  const next = new Set()
  for (const s of currentStates) {
    const targets = transitions[s]?.[symbol] || []
    for (const t of targets) next.add(t)
  }
  return next
}

function validateAutomaton(auto) {
  const errors = []
  if (!auto || typeof auto !== 'object') return ['Automaton JSON must be an object']
  const { states, start, accepts, transitions } = auto
  if (!Array.isArray(states) || states.length === 0) errors.push('states must be a non-empty array')
  if (typeof start !== 'string') errors.push('start must be a string state id')
  if (!Array.isArray(accepts)) errors.push('accepts must be an array of state ids')
  if (typeof transitions !== 'object') errors.push('transitions must be an object')
  if (errors.length) return errors
  if (!states.includes(start)) errors.push('start state must be in states')
  for (const a of accepts) if (!states.includes(a)) errors.push(`accept state ${a} not in states`)
  // Basic transition validation
  for (const [s, map] of Object.entries(transitions)) {
    if (!states.includes(s)) errors.push(`transition from unknown state ${s}`)
    if (typeof map !== 'object') errors.push(`transitions[${s}] must be an object`)
    for (const [sym, targets] of Object.entries(map)) {
      if (!Array.isArray(targets)) errors.push(`transitions[${s}][${sym}] must be an array of targets`)
      for (const t of targets) if (!states.includes(t)) errors.push(`transition target ${t} not in states`)
    }
  }
  return errors
}

function makeAutomatonMembership(auto) {
  const errors = validateAutomaton(auto)
  if (errors.length) {
    return {
      ok: false,
      error: errors.join('\n'),
    }
  }
  const frozen = deepFreeze(auto)
  const isDeterministic = Object.values(frozen.transitions).every((m) =>
    Object.values(m).every((arr) => Array.isArray(arr) && arr.length <= 1)
  )
  const membership = (s) => {
    // Supports unicode strings; process symbols by code units as entered
    if (typeof s !== 'string') s = String(s)
    let current = epsilonClosure(new Set([frozen.start]), frozen.transitions)
    for (const ch of [...s]) {
      const moved = stepNFA(current, ch, frozen.transitions)
      current = epsilonClosure(moved, frozen.transitions)
    }
    for (const st of current) if (frozen.accepts.includes(st)) return { inLanguage: true }
    return { inLanguage: false }
  }
  return {
    ok: true,
    membership,
    meta: {
      kind: 'automaton',
      states: frozen.states.length,
      deterministic: isDeterministic,
    },
  }
}

function makeRegexMembership(regexSource) {
  try {
    // Anchor to full-string match
    const rx = new RegExp(`^(?:${regexSource})$`, 'u')
    const membership = (s) => {
      if (typeof s !== 'string') s = String(s)
      return { inLanguage: rx.test(s) }
    }
    return {
      ok: true,
      membership,
      meta: { kind: 'regex', states: undefined },
    }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

function makeSandboxMembership(code) {
  const wrapped = `"use strict";\nreturn (async function(s, helpers){\n  ${code}\n})`
  let fn
  try {
    fn = new Function(wrapped)()
  } catch (e) {
    return { ok: false, error: 'Code compile error: ' + (e.message || String(e)) }
  }
  const membership = async (s) => {
    const timeoutMs = 300
    const timer = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
    const exec = (async () => {
      try {
        const res = await fn(s, { len: (x) => [...String(x)].length, count: (str, ch) => [...String(str)].filter((c) => c === ch).length })
        return { inLanguage: !!res }
      } catch (e) {
        return { inLanguage: false, error: 'Runtime error: ' + (e.message || String(e)) }
      }
    })()
    try {
      return await Promise.race([timer, exec])
    } catch (e) {
      return { inLanguage: false, error: (e && e.message) || 'Timeout' }
    }
  }
  return { ok: true, membership, meta: { kind: 'custom' } }
}

const templates = {
  anbn: `// Language: a^n b^n\n// Return true iff s has k a's followed by k b's\nconst m = s.match(/^(a+)(b+)$/u)\nif(!m) return false\nreturn m[1].length === m[2].length` ,
  anbncn: `// Language: a^n b^n c^n\nconst m = s.match(/^(a+)(b+)(c+)$/u)\nif(!m) return false\nreturn m[1].length === m[2].length && m[2].length === m[3].length`,
  abab: `// Language: (ab)*\nreturn /^(?:ab)*$/u.test(s)` ,
  emoji: `// Example with emoji\n// Strings of n 😀 followed by n 😺\nconst m = s.match(/^(😀+)(😺+)$/u)\nreturn !!m && m[1].length === m[2].length`,
}

export default function LanguageInput({ onReady }) {
  const [mode, setMode] = useState('regex')
  const [regex, setRegex] = useState('(ab)*')
  const [autoText, setAutoText] = useState(
    JSON.stringify(
      {
        states: ['q0', 'q1'],
        start: 'q0',
        accepts: ['q0'],
        transitions: {
          q0: { a: ['q1'] },
          q1: { b: ['q0'] },
        },
      },
      null,
      2
    )
  )
  const [code, setCode] = useState(templates.abab)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState(null)

  // Build membership adapter based on mode
  const builder = useMemo(() => {
    if (mode === 'regex') return () => makeRegexMembership(regex)
    if (mode === 'automaton')
      return () => {
        try {
          const obj = JSON.parse(autoText)
          return makeAutomatonMembership(obj)
        } catch (e) {
          return { ok: false, error: 'Invalid JSON: ' + (e.message || String(e)) }
        }
      }
    if (mode === 'custom') return () => makeSandboxMembership(code)
    return () => ({ ok: false, error: 'Unknown mode' })
  }, [mode, regex, autoText, code])

  useEffect(() => {
    const built = builder()
    if (!built.ok) {
      setError(built.error || 'Unknown error')
      onReady && onReady(null, { kind: mode })
      setMeta(null)
      return
    }
    setError('')
    setMeta(built.meta)
    onReady && onReady(built.membership, built.meta)
  }, [builder, onReady, mode])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const text = await f.text()
    setAutoText(text)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        <button className={`px-3 py-1 rounded ${mode==='regex'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setMode('regex')}>Regex</button>
        <button className={`px-3 py-1 rounded ${mode==='automaton'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setMode('automaton')}>Automaton</button>
        <button className={`px-3 py-1 rounded ${mode==='custom'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setMode('custom')}>Custom Code</button>
      </div>

      {mode==='regex' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Regular Expression (full-string)</label>
          <input value={regex} onChange={(e)=>setRegex(e.target.value)} placeholder="e.g., (ab)* | a*b*" className="w-full rounded border px-3 py-2"/>
          <p className="text-xs text-gray-600">Anchored automatically as ^(?:re)$ with Unicode support.</p>
        </div>
      )}

      {mode==='automaton' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Automaton JSON (DFA or NFA with optional epsilon as '' or 'eps')</label>
            <label className="inline-flex items-center gap-2 text-blue-600 cursor-pointer">
              <Upload size={16}/> Import JSON
              <input type="file" accept="application/json,.json" className="hidden" onChange={onFile}/>
            </label>
          </div>
          <textarea value={autoText} onChange={(e)=>setAutoText(e.target.value)} rows={10} className="w-full rounded border px-3 py-2 font-mono text-sm"/>
          <p className="text-xs text-gray-600">Structure: {{ states: string[], start: string, accepts: string[], transitions: Record&lt;state, Record&lt;symbol, string[]&gt;&gt; }}</p>
        </div>
      )}

      {mode==='custom' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-medium">Custom membership function</label>
            <div className="flex gap-2 text-xs">
              <button className="px-2 py-1 rounded bg-gray-100" onClick={()=>setCode(templates.anbn)}>a^n b^n</button>
              <button className="px-2 py-1 rounded bg-gray-100" onClick={()=>setCode(templates.anbncn)}>a^n b^n c^n</button>
              <button className="px-2 py-1 rounded bg-gray-100" onClick={()=>setCode(templates.abab)}>(ab)*</button>
              <button className="px-2 py-1 rounded bg-gray-100" onClick={()=>setCode(templates.emoji)}>Emoji</button>
            </div>
          </div>
          <div className="rounded border overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-700">async function inLanguage(s, helpers) {'{'} ... return true|false {'}'}</div>
            <textarea value={code} onChange={(e)=>setCode(e.target.value)} rows={10} className="w-full px-3 py-2 font-mono text-sm outline-none"/>
          </div>
          <p className="text-xs text-gray-600">Runs in a sandbox with a short timeout. Use helpers.len(s) and helpers.count(s, ch).</p>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {meta && (
        <div className="text-xs text-gray-700">Mode: {meta.kind} {meta.states?`• states: ${meta.states}`:''}</div>
      )}
    </div>
  )
}
