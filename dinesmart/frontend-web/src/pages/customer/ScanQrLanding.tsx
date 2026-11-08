import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, UtensilsCrossed, ArrowRight, ShieldCheck, Camera, X, 
  RefreshCw, AlertCircle, Upload, Smartphone, Monitor, Sparkles, 
  Building2, CheckCircle2, ChevronRight, Lock
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../supabase';

export const ScanQrLanding: React.FC = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: '', restaurant: '', email: '', phone: '' });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Check screen width for desktop view
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    const loadTables = async () => {
      try {
        const data = await db.getTables();
        setTables(data || []);
      } catch (e) {
        console.error(e);
      }
    };
    loadTables();

    return () => {
      window.removeEventListener('resize', checkDesktop);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScanSuccess = (decodedText: string) => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().catch(() => {});
    }
    setIsScanning(false);

    try {
      if (decodedText.includes('/table/')) {
        window.location.href = decodedText;
        return;
      }
      
      const matched = tables.find(t => t.qr_token === decodedText);
      if (matched) {
        window.location.href = `/table/${matched.id}?token=${matched.qr_token}`;
        return;
      }

      window.location.href = decodedText;
    } catch (err) {
      window.location.href = decodedText;
    }
  };

  const startCameraScanner = async () => {
    setCameraError(null);
    setIsScanning(true);
    setScannerLoading(true);

    setTimeout(async () => {
      try {
        const scannerId = 'inbuilt-qr-reader';
        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {
            // Frame parse error ignored
          }
        );
        setScannerLoading(false);
      } catch (err: any) {
        console.error('Error starting camera scanner:', err);
        setCameraError(err?.message || 'Could not access device camera. Please grant camera permission or upload a QR image.');
        setScannerLoading(false);
      }
    }, 300);
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {}
    }
    setIsScanning(false);
    setCameraError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('file-qr-temp');
      const result = await html5QrCode.scanFile(file, true);
      handleScanSuccess(result);
    } catch (err: any) {
      alert('Could not decode QR code from the selected image. Please try another image.');
    }
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
    setTimeout(() => {
      setShowDemoModal(false);
      setDemoSubmitted(false);
      setDemoForm({ name: '', restaurant: '', email: '', phone: '' });
    }, 2200);
  };

  const firstTable = tables.length > 0 ? tables[0] : { id: 1, table_number: '1', qr_token: 'demo' };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      {/* Hidden file scanner container */}
      <div id="file-qr-temp" className="hidden"></div>
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Top Navbar */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-slate-900/60 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">TableTap</h1>
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mt-0.5">Contactless Dining OS</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDemoModal(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-all flex items-center gap-1.5"
          >
            <Building2 size={13} />
            <span className="hidden sm:inline">For Restaurateurs</span>
            <span className="sm:hidden">Demo</span>
          </button>
          <a
            href={`/table/${firstTable.id || 1}?token=${firstTable.qr_token || 'demo'}`}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 transition-all text-white shadow-md shadow-orange-500/20 flex items-center gap-1.5"
          >
            <span>Live Sandbox</span>
            <ArrowRight size={13} />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-8 flex flex-col items-center justify-center text-center">
        
        {/* INBUILT CAMERA SCANNER VIEWPORT */}
        {isScanning ? (
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-3xl p-5 shadow-2xl relative animate-fade-in text-left">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-orange-400" />
                <h3 className="font-bold text-sm text-white">Live Inbuilt QR Scanner</h3>
              </div>
              <button
                onClick={stopCameraScanner}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {cameraError ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs space-y-3 text-center my-4">
                <AlertCircle size={28} className="text-red-400 mx-auto" />
                <p>{cameraError}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-red-600 transition-all"
                >
                  Upload QR Image Instead
                </button>
              </div>
            ) : (
              <div className="relative">
                {scannerLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 rounded-2xl flex flex-col items-center justify-center z-10 text-center gap-2">
                    <RefreshCw className="animate-spin text-orange-400" size={28} />
                    <p className="text-xs font-semibold text-slate-300">Activating camera feed...</p>
                  </div>
                )}
                {/* HTML5 QR Code Mount Element */}
                <div 
                  id="inbuilt-qr-reader" 
                  className="rounded-2xl overflow-hidden border border-orange-500/30 w-full min-h-[280px] bg-black"
                ></div>
                <p className="text-[11px] text-center text-slate-400 mt-3 font-medium">
                  Point camera directly at the Table QR code sticker
                </p>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Upload size={14} />
                <span>Upload QR Photo</span>
              </button>
              <button
                onClick={stopCameraScanner}
                className="text-orange-400 hover:text-orange-300 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* Visual Icon Badge */}
            <div className="relative mb-5">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-b from-orange-500/20 to-transparent border border-orange-500/30 flex items-center justify-center p-5 relative overflow-hidden backdrop-blur-sm shadow-xl shadow-orange-500/10">
                <QrCode size={48} className="text-orange-400 animate-pulse" />
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-bounce"></div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-xl shadow-lg">
                <ShieldCheck size={16} />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-3">
              <Sparkles size={12} />
              <span>Dine-In Digital Experience</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight max-w-xl">
              Scan Your Table QR Code
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm text-slate-400 leading-relaxed font-normal max-w-lg">
              Point your smartphone camera at the TableTap QR sticker on your table to browse the digital menu, customize items, and place instant orders.
            </p>

            {/* Desktop / Quick Table Selector Bar */}
            {tables.length > 0 && (
              <div className="mt-6 w-full max-w-xl bg-slate-900/80 border border-white/10 rounded-2xl p-4 text-left shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isDesktop ? <Monitor size={15} className="text-orange-400" /> : <Smartphone size={15} className="text-orange-400" />}
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {isDesktop ? "Desktop Simulator — Select Table Directly" : "Quick Table Direct Access"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{tables.length} Active Tables</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {tables.slice(0, 6).map((table) => (
                    <a
                      key={table.id}
                      href={`/table/${table.id}?token=${table.qr_token || 'demo'}`}
                      className="px-2 py-2 rounded-xl bg-white/5 hover:bg-orange-500/20 hover:border-orange-500/40 border border-white/5 transition-all text-center group cursor-pointer"
                    >
                      <div className="text-[10px] text-slate-400 group-hover:text-orange-300 font-medium">Table</div>
                      <div className="text-sm font-black text-white group-hover:text-orange-400">{table.table_number || table.id}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons for Mobile / QR */}
            <div className="mt-6 w-full max-w-sm space-y-2.5">
              <button
                onClick={startCameraScanner}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs sm:text-sm transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Camera size={18} />
                <span>Launch Camera QR Scanner</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload size={14} />
                <span>Upload QR Photo from Gallery</span>
              </button>
            </div>

            {/* Value Highlights Pill Row */}
            <div className="mt-8 flex flex-wrap justify-center items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Zero App Download Required
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Instant Order Routing to Kitchen
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Real-Time Bill & Food Tracking
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Restaurateur Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowDemoModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-white text-base">TableTap for Restaurants</h3>
                <p className="text-[11px] text-slate-400">Transform dining with contactless operations</p>
              </div>
            </div>

            {demoSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-white">Demo Request Received!</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Our hospitality onboarding team will reach out within 2 business hours with your personalized sandbox credentials.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={demoForm.name}
                    onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Restaurant / Brand Name</label>
                  <input
                    type="text"
                    required
                    value={demoForm.restaurant}
                    onChange={(e) => setDemoForm({ ...demoForm, restaurant: e.target.value })}
                    placeholder="e.g. Royal South Spice"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Work Email</label>
                    <input
                      type="email"
                      required
                      value={demoForm.email}
                      onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                      placeholder="manager@restaurant.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={demoForm.phone}
                      onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-orange-500/20"
                  >
                    Request Live Demo & Enterprise Pricing
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-2">No hardware lock-in &bull; Compatible with all thermal printers & POS tablets</p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Discreet Professional Footer with Staff & Management Portal */}
      <footer className="border-t border-white/10 py-4 px-6 bg-slate-900/40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>TableTap &copy; {new Date().getFullYear()}</span>
            <span>&bull;</span>
            <span className="text-slate-500">Contactless Dining & Kitchen Operations</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 flex items-center gap-1">
              <Lock size={11} /> Staff Access:
            </span>
            <a
              href="/kitchen"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Kitchen KDS
            </a>
            <span className="text-slate-600">&bull;</span>
            <a
              href="/waiter"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Waiter Dispatch
            </a>
            <span className="text-slate-600">&bull;</span>
            <a
              href="/admin"
              className="text-orange-400 hover:text-orange-300 font-semibold transition-colors"
            >
              Admin Portal &rarr;
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ScanQrLanding;
