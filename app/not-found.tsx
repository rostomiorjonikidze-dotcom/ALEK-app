export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-16 text-stone-900">
      <div className="mx-auto max-w-xl rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">
        <img src="/alek-logo.png" alt="ALEK" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
        <h1 className="mt-5 text-3xl font-black">Page introuvable</h1>
        <p className="mt-3 text-stone-600">La page demandée n’existe pas ou a été déplacée.</p>
        <a href="/" className="mt-7 inline-block rounded-2xl bg-amber-600 px-6 py-3 font-bold text-white hover:bg-amber-700">Retour à ALEK</a>
      </div>
    </main>
  );
}
