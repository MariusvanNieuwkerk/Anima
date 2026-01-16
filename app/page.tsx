import Link from 'next/link'
import { Pencil, Heart, ClipboardList } from 'lucide-react'

export default function Home() {
  return (
    <main
      className="min-h-screen bg-stone-50"
      style={{
        backgroundImage: 'radial-gradient(rgba(120,113,108,0.10) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6">
          <h1 className="font-serif text-4xl md:text-6xl tracking-tight text-stone-900">
            Leren is geen solo-missie.
          </h1>
          <p className="text-stone-600 text-base md:text-xl max-w-2xl mx-auto leading-relaxed">
            Anima verbindt leerling, ouder en leraar in één kalme, digitale leeromgeving.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-6 py-3 text-white font-semibold hover:bg-stone-800 transition-colors shadow-sm"
            >
              Start met Leren
            </Link>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
              <Pencil className="h-6 w-6 text-stone-700" strokeWidth={2} />
            </div>
            <h2 className="text-stone-700 font-semibold text-lg">Voor de Leerling</h2>
            <p className="text-stone-500 leading-relaxed">
              Een rustig bureau met een AI-coach die je leert denken, niet alleen antwoorden geeft.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
              <Heart className="h-6 w-6 text-amber-700" strokeWidth={2} />
            </div>
            <h2 className="text-stone-700 font-semibold text-lg">Voor de Ouder</h2>
            <p className="text-stone-500 leading-relaxed">
              Geen cijferlijsten, maar inzicht in focus en groei. Met één klik meer rust in huis.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-stone-700" strokeWidth={2} />
            </div>
            <h2 className="text-stone-700 font-semibold text-lg">Voor de Leraar</h2>
            <p className="text-stone-500 leading-relaxed">
              Zie in één oogopslag wie er vastloopt, zonder dat je overal tegelijk hoeft te zijn.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-10 border-t border-stone-200 text-center text-sm text-stone-500">
          © 2026 Anima Education.
        </footer>
      </div>
    </main>
  )
}