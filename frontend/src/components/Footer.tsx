export default function Footer() {
  return (
    <footer className="mt-16 footer">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md" style={{ background: 'rgba(255,255,255,0.92)' }} />
          <p style={{ color: 'rgba(255,255,255,0.92)' }}>© {new Date().getFullYear()} Green Pulse. Tous droits réservés.</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" style={{ color: 'rgba(255,255,255,0.92)' }} className="hover:text-white transition">Mentions légales</a>
          <a href="#" style={{ color: 'rgba(255,255,255,0.92)' }} className="hover:text-white transition">Confidentialité</a>
          <a href="#" style={{ color: 'rgba(255,255,255,0.92)' }} className="hover:text-white transition">Contact</a>
        </div>
      </div>
    </footer>
  );
}
