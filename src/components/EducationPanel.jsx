import { useMemo } from 'react'

export default function EducationPanel({ meta, proof }) {
  const summary = useMemo(() => {
    const parts = []
    parts.push('Pumping Lemma (for regular languages): if L is regular, there exists an integer p ≥ 1 such that every string s in L with |s| ≥ p can be written as s = xyz with |xy| ≤ p, |y| > 0, and for all i ≥ 0 the string x y^i z is in L.')
    if (meta?.kind === 'regex') parts.push('Here the language is given by a regular expression. For DFAs, a common heuristic is to choose p equal to the number of states; for regex, p can be based on an equivalent automaton, but we leave it selectable.')
    if (meta?.kind === 'automaton') parts.push('Here the language is given by an automaton. We set p to the number of states when available.')
    if (meta?.kind === 'custom') parts.push('Here membership is defined by custom code. The tool can still search for witnesses but cannot prove regularity.')
    if (proof) {
      parts.push(`Contradiction found: with p = ${proof.p}, s = "${proof.s}", choose decomposition x = "${proof.decomposition.x}", y = "${proof.decomposition.y}", z = "${proof.decomposition.z}" (|xy| ≤ p, |y| > 0). For i = ${proof.i}, the pumped string becomes "${proof.pumped}", which is not in L. Therefore, the chosen language is not regular.`)
    } else {
      parts.push('No contradiction was found for the tested decompositions and i values. This does not prove that L is regular; the pumping lemma is a one-way test. Try different s or increase the search range.')
    }
    return parts
  }, [meta, proof])

  return (
    <div className="prose prose-sm max-w-none">
      {summary.map((p, idx)=> (
        <p key={idx}>{p}</p>
      ))}
    </div>
  )
}
