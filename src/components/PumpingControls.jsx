import { useEffect, useMemo, useState } from 'react'

function enumerateDecompositions(s, p) {
  const chars = [...s]
  const out = []
  for (let i = 0; i <= Math.min(p, chars.length); i++) {
    for (let j = i + 1; j <= Math.min(p, chars.length); j++) {
      const x = chars.slice(0, i).join('')
      const y = chars.slice(i, j).join('')
      const z = chars.slice(j).join('')
      out.push({ iStart: i, iEnd: j, x, y, z })
    }
  }
  return out
}

export default function PumpingControls({ membership, meta, onProof }) {
  const [p, setP] = useState(4)
  const [autoP, setAutoP] = useState(true)
  const [s, setS] = useState('ab')
  const [iVal, setIVal] = useState(2)
  const [selected, setSelected] = useState(0)
  const [results, setResults] = useState({})

  useEffect(() => {
    if (autoP && meta && meta.states) setP(Math.max(2, meta.states))
  }, [autoP, meta])

  const decomps = useMemo(() => enumerateDecompositions(s, p), [s, p])

  useEffect(() => {
    setSelected(0)
    setResults({})
  }, [s, p])

  const current = decomps[selected]

  async function testPump(i) {
    if (!current || !membership) return
    const pumped = current.x + current.y.repeat(i) + current.z
    const res = await membership(pumped)
    setResults((prev) => ({ ...prev, [i]: { pumped, res } }))
  }

  async function autoFind() {
    // Try i in {0,2,3}
    const tryIs = [0, 2, 3]
    for (let idx = 0; idx < decomps.length; idx++) {
      const d = decomps[idx]
      for (const i of tryIs) {
        const pumped = d.x + d.y.repeat(i) + d.z
        const r = await membership(pumped)
        if (!r.inLanguage) {
          setSelected(idx)
          setResults((prev) => ({ ...prev, [i]: { pumped, res: r } }))
          onProof &&
            onProof({
              p,
              s,
              decomposition: { x: d.x, y: d.y, z: d.z, iStart: d.iStart, iEnd: d.iEnd },
              i,
              pumped,
              result: r,
            })
          return
        }
      }
    }
    onProof && onProof(null)
    alert('No contradiction found for tested i values. This does not prove regularity.')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">Pumping length p</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="number" min={1} value={p} onChange={(e)=>setP(parseInt(e.target.value||'0')||0)} className="w-24 rounded border px-2 py-1"/>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoP} onChange={(e)=>setAutoP(e.target.checked)}/>
              Auto from language (states when available)
            </label>
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Candidate string s</label>
          <input value={s} onChange={(e)=>setS(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Enter a string or paste emoji"/>
          <div className="text-xs text-gray-600 mt-1">Length: {[...s].length}</div>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Decompositions (|xy| ≤ p and |y| &gt; 0)</div>
        <div className="flex overflow-x-auto gap-2 p-1 bg-gray-50 rounded border">
          {decomps.slice(0, 200).map((d, idx) => (
            <button key={idx} onClick={()=>setSelected(idx)} className={`px-2 py-1 rounded text-xs whitespace-nowrap ${idx===selected?'bg-blue-600 text-white':'bg-white border'}`}>
              x[{d.iStart}] y[{d.iEnd-d.iStart}] z[{[...s].length-d.iEnd}]
            </button>
          ))}
          {decomps.length>200 && <div className="text-xs text-gray-600 px-2">+ {decomps.length-200} more</div>}
        </div>
      </div>

      {current && (
        <div className="space-y-2">
          <div className="text-sm">s = <span className="font-mono break-all">{s}</span></div>
          <div className="font-mono text-sm flex flex-wrap gap-1">
            {[...s].map((ch, idx)=>{
              const inX = idx < current.iStart
              const inY = idx >= current.iStart && idx < current.iEnd
              return (
                <span key={idx} title={`index ${idx}`} className={`px-1.5 py-0.5 rounded border ${inY?'bg-yellow-200 border-yellow-400': inX?'bg-blue-100 border-blue-300':'bg-green-100 border-green-300'}`}>{ch}</span>
              )
            })}
          </div>
          <div className="text-xs text-gray-700">x = <span className="font-mono">{current.x||'ε'}</span>, y = <span className="font-mono">{current.y}</span>, z = <span className="font-mono">{current.z||'ε'}</span></div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded bg-gray-100" onClick={()=>testPump(0)}>i = 0</button>
        <button className="px-3 py-1.5 rounded bg-gray-100" onClick={()=>testPump(1)}>i = 1</button>
        <button className="px-3 py-1.5 rounded bg-gray-100" onClick={()=>testPump(2)}>i = 2</button>
        <input type="number" className="w-20 rounded border px-2 py-1" value={iVal} onChange={(e)=>setIVal(parseInt(e.target.value||'0')||0)}/>
        <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={()=>testPump(iVal)}>Pump</button>
        <button className="ml-auto px-3 py-1.5 rounded bg-rose-600 text-white" onClick={autoFind}>Find contradiction</button>
      </div>

      {Object.keys(results).length>0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Results</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.entries(results).map(([i, info])=> (
              <div key={i} className={`rounded border p-2 ${info.res.inLanguage?'border-green-300 bg-green-50':'border-rose-300 bg-rose-50'}`}>
                <div className="text-sm">i = {i}</div>
                <div className="text-xs break-all"><span className="font-mono">{info.pumped}</span></div>
                <div className="text-xs mt-1">{info.res.inLanguage? 'xy^i z ∈ L' : 'xy^i z ∉ L'}</div>
                {info.res.error && <div className="text-xs text-rose-700">{info.res.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
