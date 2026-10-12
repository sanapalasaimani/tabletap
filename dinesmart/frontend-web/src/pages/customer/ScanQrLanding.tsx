import React, { useState, useEffect, useRef } from 'react';
import { QrCode, UtensilsCrossed, ArrowRight, ShieldCheck, Camera, X, RefreshCw, AlertCircle, Upload, Smartphone } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../supabase';

export const ScanQrLanding: React.FC = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
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
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScanSuccess = (decodedText: string) => {
    // If scanner detects table URL or token
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().catch(() => {});
    }
    setIsScanning(false);

    try {
      if (decodedText.includes('/table/')) {
        // Direct table URL redirect
        window.location.href = decodedText;
        return;
      }
      
      // If it scanned just a token or raw text, match table
      const matched = tables.find(t => t.qr_token === decodedText);
      if (matched) {
        window.location.href = `/table/${matched.id}?token=${matched.qr_token}`;
        return;
      }

      // Default redirect
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

      {/* Main Container */}
      <main className="flex-1 max-w-xl mx-auto w-full px-5 py-8 flex flex-col items-center justify-center text-center">
        
        {/* INBUILT CAMERA SCANNER MODAL / VIEWPORT */}
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
          <>
            {/* Visual Header */}
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-3xl bg-gradient-to-b from-orange-500/20 to-transparent border border-orange-500/30 flex items-center justify-center p-5 relative overflow-hidden backdrop-blur-sm">
                <QrCode size={56} className="text-orange-400 animate-pulse" />
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-bounce"></div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-xl shadow-lg">
                <ShieldCheck size={16} />
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Please Scan Table QR Code
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed font-normal max-w-md">
              To place orders and browse the digital menu, scan the TableTap QR sticker on your dining table.
            </p>

            {/* ACTION BUTTON: Inbuilt Camera Scanner */}
            <div className="mt-6 w-full max-w-sm space-y-2.5">
              <button
                onClick={startCameraScanner}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs sm:text-sm transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Camera size={18} />
                <span>Open Inbuilt Camera Scanner</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload size={14} />
                <span>Upload QR Image from Gallery</span>
              </button>
            </div>

            {/* Quick Testing Table Sessions */}
            {tables.length > 0 && (
              <div className="mt-8 w-full max-w-md bg-slate-900/60 border border-white/10 rounded-3xl p-5 text-left">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Testing Tables</h3>
                    <p className="text-[10px] text-slate-400">Direct links for authorized testing:</p>
                  </div>
                  <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                    Active Tables
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {tables.slice(0, 6).map(tbl => (
                    <a
                      key={tbl.id}
                      href={`/table/${tbl.id}?token=${tbl.qr_token}`}
                      className="group bg-white/5 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/50 rounded-xl p-2.5 transition-all flex items-center justify-between"
                    >
                      <span className="text-xs font-black text-white group-hover:text-orange-400">Table #{tbl.id}</span>
                      <ArrowRight size={12} className="text-slate-500 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Waiter App Download Prompt */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Smartphone size={14} className="text-orange-400" />
              <span>Waiter?</span>
              <a
                href="/waiter-app.apk"
                download="WaiterApp.apk"
                className="text-orange-400 hover:text-orange-300 font-bold underline"
              >
                Download Waiter APK
              </a>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-3 text-center text-[11px] text-slate-500">
        TableTap &copy; {new Date().getFullYear()} &bull; DineSmart AI Restaurant Automation
      </footer>
    </div>
  );
};

export default ScanQrLanding;
