import { Rocket, BookOpen } from 'lucide-react'

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="text-blue-600" size={20}/>
          <span className="font-semibold">Pumping Lemma Explorer</span>
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <BookOpen size={16}/>
          <span>Learn by experimentation</span>
        </div>
      </div>
    </header>
  )
}
