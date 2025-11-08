import { useCallback, useState } from 'react'
import Header from './components/Header'
import LanguageInput from './components/LanguageInput'
import PumpingControls from './components/PumpingControls'
import EducationPanel from './components/EducationPanel'

function App() {
  const [membership, setMembership] = useState(null)
  const [meta, setMeta] = useState(null)
  const [proof, setProof] = useState(null)

  const onReady = useCallback((fn, meta) => {
    setMembership(() => fn)
    setMeta(meta)
    setProof(null)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 text-gray-900">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Define a language</h2>
          <LanguageInput onReady={onReady} />
        </section>

        <section className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Pumping tool</h2>
          {membership ? (
            <PumpingControls membership={membership} meta={meta} onProof={setProof} />
          ) : (
            <div className="text-sm text-gray-600">Enter a valid language above to enable pumping.</div>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Explanation</h2>
          <EducationPanel meta={meta} proof={proof} />
        </section>
      </main>
      <footer className="text-center text-xs text-gray-500 py-6">Built for teaching and exploration • Client-side only</footer>
    </div>
  )
}

export default App
