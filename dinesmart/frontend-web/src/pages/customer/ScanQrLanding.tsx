import React, { useState, useEffect } from 'react';
import { QrCode, ChefHat, UtensilsCrossed, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';
import { db } from '../../supabase';

export const ScanQrLanding: React.FC = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTables = async () => {
      try {
        const data = await db.getTables();
        setTables(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadTables();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-slate-900/50 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">TableTap</h1>
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mt-0.5">DineSmart AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/kitchen"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 hover:border-orange-500/50 hover:bg-white/5 transition-all text-slate-300"
          >
            Kitchen KDS
          </a>
          <a
            href="/admin"
            className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 transition-all text-white shadow-md shadow-orange-500/20"
          >
            Admin
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col items-center justify-center text-center">
        {/* Animated Scanner Visual */}
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-b from-orange-500/20 to-transparent border border-orange-500/30 flex items-center justify-center p-6 relative overflow-hidden backdrop-blur-sm">
            <QrCode size={64} className="text-orange-400 animate-pulse" />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-bounce"></div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 p-1.5 rounded-xl shadow-lg">
            <ShieldCheck size={18} />
          </div>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight max-w-xl">
          Please Scan Your Dining Table’s QR Code
        </h2>
        <p className="mt-4 text-sm text-slate-400 max-w-lg leading-relaxed font-normal">
          To browse our live menu, place orders, and call for service, please point your smartphone camera at the genuine TableTap QR sticker on your dining table.
        </p>

        {/* Instructions Card */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl text-left">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs mb-2">1</div>
            <h4 className="text-xs font-bold text-white">Find Table QR</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">Locate the physical QR code sticker placed on your table stand.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs mb-2">2</div>
            <h4 className="text-xs font-bold text-white">Open Camera</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">Open your phone camera or QR scanner and scan the sticker.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs mb-2">3</div>
            <h4 className="text-xs font-bold text-white">Order & Pay</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">The authenticated table session will open instantly in your browser.</p>
          </div>
        </div>

        {/* Authorized Testing Tables Section */}
        {tables.length > 0 && (
          <div className="mt-10 w-full max-w-2xl bg-slate-900/60 border border-white/10 rounded-3xl p-6 text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Authorized Dining Tables</h3>
                <p className="text-[11px] text-slate-400">Click a registered table below to test the authenticated diner session:</p>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/30">
                Secured With QR Token
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {tables.slice(0, 8).map(tbl => (
                <a
                  key={tbl.id}
                  href={`/table/${tbl.id}?token=${tbl.qr_token}`}
                  className="group bg-white/5 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/50 rounded-2xl p-3 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white group-hover:text-orange-400">Table #{tbl.id}</span>
                    <ArrowRight size={12} className="text-slate-500 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <span className="text-[9px] text-slate-500 mt-2 truncate font-mono">
                    {tbl.qr_token ? `${tbl.qr_token.substring(0, 10)}...` : 'Active'}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Waiter App Download Prompt */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Smartphone size={14} className="text-orange-400" />
          <span>Are you a waiter?</span>
          <a
            href="/waiter-app.apk"
            download="WaiterApp.apk"
            className="text-orange-400 hover:text-orange-300 font-bold underline"
          >
            Download Waiter Android App (.apk)
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 text-center text-xs text-slate-500">
        TableTap &copy; {new Date().getFullYear()} &bull; DineSmart AI Restaurant Automation
      </footer>
    </div>
  );
};

export default ScanQrLanding;
