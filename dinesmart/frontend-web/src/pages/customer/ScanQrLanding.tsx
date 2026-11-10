import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Upload } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../supabase';
import './ScanQrLanding.css';

export const ScanQrLanding: React.FC = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);

  // Carousel & Live Demo state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [kdsTimers, setKdsTimers] = useState<number[]>([120, 840, 1380]); // 2m, 14m, 23m in seconds

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

  // Carousel auto-timer (4500ms)
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 5);
    }, 4500);
    return () => clearInterval(interval);
  }, [isHovered]);

  // Live KDS Demo incrementing timers
  useEffect(() => {
    const interval = setInterval(() => {
      setKdsTimers(prev => prev.map(t => t + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getTimerClass = (sec: number) => {
    const m = Math.floor(sec / 60);
    if (m >= 20) return 'tk r';
    if (m >= 10) return 'tk y';
    return 'tk';
  };

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
          () => {}
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
    <div className="tabletap-landing">
      {/* Hidden file scanner container */}
      <div id="file-qr-temp" className="hidden" style={{ display: 'none' }}></div>
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileUpload} 
        style={{ display: 'none' }} 
      />

      {/* SVG Graphic Definitions for dishes & carousel */}
      <svg width="0" height="0" style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <symbol id="bir" viewBox="0 0 240 170">
            <rect width="240" height="170" fill="#fdebd3"/>
            <ellipse cx="120" cy="130" rx="98" ry="30" fill="#e3ddd3"/>
            <ellipse cx="120" cy="122" rx="86" ry="25" fill="#fff"/>
            <path d="M52 118q8-62 68-62t68 62q-68 24-136 0z" style={{ fill: 'var(--rice)' }}/>
            <g style={{ fill: 'var(--meat)' }}>
              <ellipse cx="90" cy="90" rx="21" ry="13" transform="rotate(-25 90 90)"/>
              <ellipse cx="142" cy="82" rx="20" ry="12" transform="rotate(18 142 82)"/>
              <ellipse cx="118" cy="106" rx="19" ry="11"/>
            </g>
            <g fill="#fff" opacity=".8">
              <circle cx="68" cy="110" r="3"/>
              <circle cx="160" cy="104" r="3"/>
              <circle cx="100" cy="72" r="2.5"/>
              <circle cx="170" cy="92" r="2.5"/>
            </g>
            <g fill="#3f9142">
              <circle cx="106" cy="68" r="5"/>
              <circle cx="152" cy="100" r="4"/>
              <circle cx="78" cy="100" r="4"/>
            </g>
            <path d="M150 62q14 6 22 20" stroke="#8a5a1c" strokeWidth="4" fill="none" strokeLinecap="round"/>
          </symbol>
          <symbol id="des" viewBox="0 0 240 170">
            <rect width="240" height="170" fill="#fde4ea"/>
            <path d="M46 96h148q-6 50-74 50t-74-50z" fill="#d94f00"/>
            <ellipse cx="120" cy="96" rx="74" ry="11" fill="#b8541a"/>
            <g fill="#6b2a0d">
              <circle cx="86" cy="82" r="22"/>
              <circle cx="154" cy="82" r="22"/>
              <circle cx="120" cy="76" r="23"/>
              <circle cx="104" cy="56" r="19"/>
              <circle cx="138" cy="56" r="19"/>
            </g>
            <g fill="#fff" opacity=".45">
              <ellipse cx="78" cy="74" rx="6" ry="3"/>
              <ellipse cx="146" cy="74" rx="6" ry="3"/>
              <ellipse cx="112" cy="68" rx="6" ry="3"/>
              <ellipse cx="98" cy="49" rx="5" ry="3"/>
            </g>
            <g fill="#7bb661">
              <circle cx="120" cy="46" r="3"/>
              <circle cx="96" cy="62" r="2.5"/>
              <circle cx="146" cy="64" r="2.5"/>
              <circle cx="70" cy="92" r="2.5"/>
            </g>
          </symbol>
          <symbol id="chk" viewBox="0 0 240 170">
            <rect width="240" height="170" fill="#fdebd3"/>
            <ellipse cx="120" cy="130" rx="98" ry="30" fill="#e3ddd3"/>
            <ellipse cx="120" cy="122" rx="86" ry="25" fill="#fff"/>
            <g fill="#a82a14">
              <rect x="72" y="78" width="30" height="24" rx="8" transform="rotate(-12 87 90)"/>
              <rect x="108" y="70" width="32" height="26" rx="8" transform="rotate(10 124 83)"/>
              <rect x="146" y="84" width="28" height="24" rx="8" transform="rotate(-8 160 96)"/>
              <rect x="96" y="100" width="30" height="20" rx="8"/>
              <rect x="132" y="102" width="26" height="18" rx="8" transform="rotate(14 145 111)"/>
            </g>
            <g fill="#3f9142">
              <rect x="86" y="68" width="16" height="12" rx="3"/>
              <rect x="152" y="72" width="16" height="12" rx="3"/>
              <rect x="112" y="92" width="14" height="10" rx="3"/>
            </g>
            <g fill="#fff" opacity=".85">
              <rect x="130" y="64" width="12" height="9" rx="3"/>
              <rect x="72" y="100" width="12" height="9" rx="3"/>
            </g>
            <g fill="#7bb661">
              <circle cx="104" cy="66" r="3"/>
              <circle cx="168" cy="102" r="3"/>
              <circle cx="84" cy="110" r="3"/>
            </g>
          </symbol>
          <symbol id="face" viewBox="-40 -50 80 90">
            <path d="M-34 -6q0-40 34-40t34 40q-14-18-34-18t-34 18z" style={{ fill: 'var(--hair)' }}/>
            <circle r="32" style={{ fill: 'var(--skin)' }}/>
            <path d="M-34 -6q0-40 34-40t34 40q-14-18-34-18t-34 18z" style={{ fill: 'var(--hair)' }}/>
            <circle cx="-11" cy="-4" r="3.5" fill="#2b1b12"/>
            <circle cx="11" cy="-4" r="3.5" fill="#2b1b12"/>
            <path d="M-17 8q17 20 34 0z" fill="#fff" stroke="#2b1b12" strokeWidth="3" strokeLinejoin="round"/>
            <circle cx="-21" cy="8" r="5" fill="#ff8a8a" opacity=".5"/>
            <circle cx="21" cy="8" r="5" fill="#ff8a8a" opacity=".5"/>
          </symbol>
        </defs>
      </svg>

      {/* Top Navbar */}
      <nav>
        <div className="w">
          <a className="logo" href="#top">
            <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
              <rect width="38" height="38" rx="11" fill="#ff7a0a"/>
              <path d="M12 10v7a3 3 0 0 0 6 0v-7M15 10v18M25 10c-3 2-3 8 0 10v8" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
            </svg>
            <span>TableTap<small>Contactless dining OS</small></span>
          </a>
          <a className="l" href="#platform">Platform</a>
          <a className="l" href="#intelligence">AI and insights</a>
          <a className="l" href="#compare">Compare</a>
          <a className="l" href="#faq">FAQ</a>
          <a className="btn" href="/kitchen">Kitchen KDS</a>
          <a className="btn p" href="/admin">Admin</a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero" id="top">
        <div className="w hg">
          <div>
            <h1>Let guests order from their table</h1>
            <p className="lead">
              With TableTap, guests scan a QR code, read the menu and order from their own phone. 
              The kitchen gets the order straight away, and your waiters and managers can see everything in one place.
            </p>
            <div className="btns">
              <button onClick={startCameraScanner} className="btn p">
                Open inbuilt camera scanner
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="btn">
                Upload QR image from gallery
              </button>
            </div>
            <div className="pills">
              <span className="pill"><i>✓</i>Zero app download required</span>
              <span className="pill"><i>✓</i>Instant order routing to kitchen</span>
              <span className="pill"><i>✓</i>Real-time bill and food tracking</span>
            </div>
          </div>

          {/* Interactive Live Demo */}
          <div className="demo" aria-label="Product preview: guest phone and kitchen display">
            <div className="phone">
              <div className="ph-h"><b>Table 12</b><span>Menu</span></div>
              <div className="bub u">Something mild, no nuts?</div>
              <div className="bub a">Try the Paneer Butter Masala. Nut-free, spice level 1.</div>
              <div className="dish">
                <div>
                  <b><i className="veg"></i>Paneer Butter Masala</b>
                  <span>Mild · nut-free</span>
                </div>
                <b>₹320</b>
              </div>
              <div className="dish">
                <div>
                  <b><i className="veg"></i>Garlic Naan</b>
                  <span>Add-on suggested</span>
                </div>
                <b>₹70</b>
              </div>
              <div 
                className="dish" 
                style={{ background: 'var(--ac)', color: '#ffffff', justifyContent: 'center', border: 0, cursor: 'pointer' }}
                onClick={startCameraScanner}
              >
                <b>Send to kitchen</b>
              </div>
            </div>

            <div className="kds">
              <h4>
                <span>Kitchen display</span>
                <span style={{ color: 'var(--ok)' }}>Live</span>
              </h4>
              <div className={getTimerClass(kdsTimers[0])}>
                <b>Table 12 <em>{formatTimer(kdsTimers[0])}</em></b>
                <small>Paneer Butter Masala, Naan</small>
              </div>
              <div className={getTimerClass(kdsTimers[1])}>
                <b>Table 7 <em>{formatTimer(kdsTimers[1])}</em></b>
                <small>Veg Biryani × 2</small>
              </div>
              <div className={getTimerClass(kdsTimers[2])}>
                <b>Table 3 <em>{formatTimer(kdsTimers[2])}</em></b>
                <small>Chilli Chicken · Overdue</small>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="stats">
        <div className="w sg">
          <div><b>0</b><span>app downloads for guests</span></div>
          <div><b>&lt;15s</b><span>target ticket routing to kitchen</span></div>
          <div><b>99.9%</b><span>uptime target</span></div>
          <div><b>3 apps</b><span>guest web, kitchen, waiter app</span></div>
        </div>
      </div>

      {/* "Served fresh, loved by guests" Carousel */}
      <section style={{ padding: '64px 0 0' }}>
        <div className="w">
          <h2>Served fresh, loved by guests</h2>
          <div 
            className="sv" 
            id="sv"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div 
              className="tr" 
              id="tr"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              <figure className="tile">
                <svg viewBox="0 0 240 170" role="img" aria-label="Illustration of chicken biryani">
                  <use href="#bir" width="240" height="170" style={{ ['--meat' as any]: '#c8651f', ['--rice' as any]: '#f4c542' }}/>
                </svg>
                <figcaption>
                  Chicken biryani
                  <span>Cooked slowly on dum with whole spices. A favourite at both lunch and dinner.</span>
                </figcaption>
              </figure>

              <figure className="tile">
                <svg viewBox="0 0 240 170" role="img" aria-label="Illustration of mutton biryani">
                  <use href="#bir" width="240" height="170" style={{ ['--meat' as any]: '#6e2f14', ['--rice' as any]: '#e3a02d' }}/>
                </svg>
                <figcaption>
                  Mutton biryani
                  <span>Tender mutton layered with fragrant rice and cooked in its own steam.</span>
                </figcaption>
              </figure>

              <figure className="tile">
                <svg viewBox="0 0 240 170" role="img" aria-label="Illustration of gulab jamun dessert">
                  <use href="#des" width="240" height="170"/>
                </svg>
                <figcaption>
                  Gulab jamun
                  <span>Soft milk dumplings fried and soaked in sugar syrup with rose water. “Gulab” means rose water in Persian, and “jamun” is a dark Indian fruit the sweet resembles. Many food historians link it to Persian-influenced sweets brought to India under the Mughals.</span>
                </figcaption>
              </figure>

              <figure className="tile">
                <svg viewBox="0 0 240 170" role="img" aria-label="Illustration of chilli chicken">
                  <use href="#chk" width="240" height="170"/>
                </svg>
                <figcaption>
                  Chilli chicken
                  <span>Crispy chicken tossed with green chillies, onion and capsicum in a spicy soy sauce. An Indo-Chinese favourite.</span>
                </figcaption>
              </figure>

              <figure className="tile">
                <svg viewBox="0 0 240 170" role="img" aria-label="Illustration of three smiling customers">
                  <rect width="240" height="170" fill="#fff1d6"/>
                  <use href="#face" x="4" y="46" width="80" height="90" style={{ ['--skin' as any]: '#f1c27d', ['--hair' as any]: '#3b2a20' }}/>
                  <use href="#face" x="80" y="34" width="80" height="90" style={{ ['--skin' as any]: '#c68642', ['--hair' as any]: '#1f1612' }}/>
                  <use href="#face" x="156" y="46" width="80" height="90" style={{ ['--skin' as any]: '#8d5524', ['--hair' as any]: '#2b1b12' }}/>
                </svg>
                <figcaption>
                  Customer smiles
                  <span>Orders reach the kitchen faster, so tables leave happy.</span>
                </figcaption>
              </figure>
            </div>

            <div className="dots">
              {[0, 1, 2, 3, 4].map(idx => (
                <button
                  key={idx}
                  className="dot"
                  aria-current={currentSlide === idx ? 'true' : 'false'}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform Tabs Section */}
      <section id="platform">
        <div className="w">
          <h2>One platform from table to kitchen to back office</h2>
          <p className="lead">Four connected experiences that share one live order stream.</p>
          
          <div className="tabs" role="tablist">
            {['Guest ordering', 'Kitchen display', 'Waiter app', 'Manager console'].map((name, i) => (
              <button
                key={name}
                className="tab"
                role="tab"
                aria-selected={activeTab === i}
                onClick={() => setActiveTab(i)}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Panel 0: Guest Ordering */}
          <div className={`panel ${activeTab === 0 ? 'on' : ''}`}>
            <div>
              <h3>Guests order in under 90 seconds</h3>
              <p className="lead" style={{ margin: 0 }}>Scan the QR on the table and the menu opens in the browser.</p>
              <ul>
                <li><b>Visual menu</b> with veg, non-veg, spice and allergen filters</li>
                <li><b>Customization</b> of spice level and add-ons</li>
                <li><b>Live tracking</b> of cooking progress, plus one-tap waiter call</li>
                <li><b>Promo codes</b> and payment by UPI, card or cash</li>
              </ul>
            </div>
            <div className="pv">
              <div className="row">Butter Naan <em>Preparing</em></div>
              <div className="row">Dal Makhani <em>Ready to serve</em></div>
              <div className="row">Gulab Jamun <em>Delivered</em></div>
            </div>
          </div>

          {/* Panel 1: Kitchen Display */}
          <div className={`panel ${activeTab === 1 ? 'on' : ''}`}>
            <div>
              <h3>Tickets that never get lost</h3>
              <p className="lead" style={{ margin: 0 }}>Orders route straight to the right station screen. No thermal paper.</p>
              <ul>
                <li><b>SLA timers:</b> green under 10 min, yellow 10–20, red over 20</li>
                <li><b>Audible chime</b> on every new order</li>
                <li><b>One-tap status:</b> Preparing, Ready to serve, Delivered</li>
              </ul>
            </div>
            <div className="pv">
              <div className="tk" style={{ margin: 0 }}><b>Table 12 <em>04:10</em></b><small>Within SLA</small></div>
              <div className="tk y" style={{ margin: 0 }}><b>Table 7 <em>14:30</em></b><small>Watch closely</small></div>
              <div className="tk r" style={{ margin: 0 }}><b>Table 3 <em>23:05</em></b><small>Overdue, alert sent</small></div>
            </div>
          </div>

          {/* Panel 2: Waiter App */}
          <div className={`panel ${activeTab === 2 ? 'on' : ''}`}>
            <div>
              <h3>Waiter app for the floor</h3>
              <p className="lead" style={{ margin: 0 }}>An Android app (APK) that puts the floor team on the same live stream.</p>
              <ul>
                <li><b>Call alerts</b> when a guest taps for help</li>
                <li><b>Assisted ordering</b> for guests who prefer to talk to a person</li>
                <li><b>Ready-to-serve pings</b> from the kitchen so food is delivered hot</li>
                <li><b>Table status</b> at a glance</li>
              </ul>
            </div>
            <div className="pv">
              <div className="row">Table 5 · Call waiter <em>Now</em></div>
              <div className="row">Table 12 · Order ready <em>Pick up</em></div>
              <div className="row">Table 9 · Bill requested <em>1 min</em></div>
            </div>
          </div>

          {/* Panel 3: Manager Console */}
          <div className={`panel ${activeTab === 3 ? 'on' : ''}`}>
            <div>
              <h3>Run the whole outlet from one screen</h3>
              <p className="lead" style={{ margin: 0 }}>Live revenue, table occupancy and a searchable history of past orders.</p>
              <ul>
                <li><b>Out of stock in one tap</b>, so guests never order unavailable dishes</li>
                <li><b>Staff shifts,</b> loyalty tiers and coupon builder</li>
                <li><b>One-click</b> PDF and Excel financial reports</li>
                <li><b>Multi-outlet</b> view for hotels and chains</li>
              </ul>
            </div>
            <div className="pv">
              <div className="row">Today’s revenue <em>Live</em></div>
              <div className="row">Tables occupied <em>14 / 20</em></div>
              <div className="row">Peak hour forecast <em>8–9 pm</em></div>
            </div>
          </div>
        </div>
      </section>

      {/* AI & Insights Section */}
      <section className="ai" id="intelligence">
        <div className="w">
          <h2>Intelligence built into every order</h2>
          <p className="lead">Three AI capabilities turn daily orders and reviews into decisions your team can act on.</p>
          <div className="ag">
            <div className="card">
              <h3>AI chatbot with voice</h3>
              <p>Guests ask about ingredients, allergens or what to order. The assistant answers in plain language and can read replies aloud.</p>
              <div className="bub u" style={{ maxWidth: '100%' }}>Is the biryani very spicy?</div>
              <div className="bub a" style={{ maxWidth: '100%' }}>Medium. I can make it mild, or suggest a raita.</div>
            </div>
            <div className="card">
              <h3>ML menu insights</h3>
              <p>Machine learning finds your best sellers, slow movers and dishes often ordered together, and forecasts peak hours.</p>
              <div className="row" style={{ marginBottom: '8px' }}>Butter Naan + Dal <em>Pairs often</em></div>
              <div className="row">Veg Platter <em>Slow mover</em></div>
            </div>
            <div className="card">
              <h3>NLP review analysis</h3>
              <p>Natural language processing reads guest reviews and groups them by topic and sentiment, so you see what to fix first.</p>
              <div className="bar" aria-label="Sentiment example">
                <i style={{ width: '68%', background: 'var(--ok)' }}></i>
                <i style={{ width: '20%', background: 'var(--wa)' }}></i>
                <i style={{ width: '12%', background: 'var(--er)' }}></i>
              </div>
              <div className="row" style={{ marginTop: '10px' }}>Top complaint <em>Slow desserts</em></div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="compare">
        <div className="w">
          <h2>The old way and the TableTap way</h2>
          <div className="cw">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Paper menus and legacy POS</th>
                  <th>TableTap</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Menu</td>
                  <td>Printed, outdated quickly</td>
                  <td>Live QR menu, updated instantly</td>
                </tr>
                <tr>
                  <td>Ordering</td>
                  <td>Waiter writes, errors creep in</td>
                  <td>Guest orders with exact modifiers</td>
                </tr>
                <tr>
                  <td>Kitchen</td>
                  <td>Paper tickets that get lost</td>
                  <td>Real-time display with timers</td>
                </tr>
                <tr>
                  <td>Payment</td>
                  <td>Wait for the bill</td>
                  <td>UPI, card or cash at the table</td>
                </tr>
                <tr>
                  <td>Insights</td>
                  <td>End-of-day spreadsheets</td>
                  <td>ML insights and review analysis</td>
                </tr>
                <tr>
                  <td>Hardware</td>
                  <td>Expensive terminals</td>
                  <td>Existing phones, tablets, laptops</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section>
        <div className="w">
          <h2>What restaurant teams say</h2>
          <p className="lead">Sample quotes for layout. Replace with real pilot feedback before presenting.</p>
          <div className="tg">
            <blockquote>
              “Orders reach the pass in seconds. The red timers alone changed how we run Friday night.”
              <footer>Head chef, sample restaurant</footer>
            </blockquote>
            <blockquote>
              “Guests ask the chatbot about allergens, so my floor team spends time on service.”
              <footer>F&amp;B manager, sample hotel</footer>
            </blockquote>
            <blockquote>
              “Review analysis showed desserts were slow. We fixed it in a week.”
              <footer>Owner, sample café chain</footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" style={{ paddingTop: 0 }}>
        <div className="w">
          <h2>Questions owners ask</h2>
          <div style={{ marginTop: '28px', maxWidth: '820px' }}>
            <details>
              <summary>Do guests need to download an app?</summary>
              <p>No. They scan the QR code and the menu opens in their phone browser. Only your waiters use the Android waiter app.</p>
            </details>
            <details>
              <summary>Do we need new hardware?</summary>
              <p>No. TableTap runs on the smartphones, kitchen tablets and laptops you already have.</p>
            </details>
            <details>
              <summary>How do the AI and ML features work?</summary>
              <p>The chatbot answers menu and dietary questions. ML models study order history for best sellers, pairings and peak hours. NLP groups guest reviews by topic and sentiment.</p>
            </details>
            <details>
              <summary>Can it support hotels and multiple outlets?</summary>
              <p>Yes. The manager console is built for hotels, food courts and chains with several outlets.</p>
            </details>
            <details>
              <summary>How long does onboarding take?</summary>
              <p>Share your menu, print the QR stickers, and train staff on the kitchen display and waiter app. Timelines are agreed during onboarding.</p>
            </details>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section id="cta" style={{ paddingTop: 0 }}>
        <div className="w">
          <div className="cta">
            <h2>Please scan your table QR code</h2>
            <p>Scan the TableTap sticker on your dining table to browse the menu and place orders.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={startCameraScanner} className="btn p">
                Open inbuilt camera scanner
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="btn">
                Upload QR image from gallery
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="f">
        <div className="w">
          © 2026 TableTap, powered by DineSmart AI. Figures marked as targets are planning assumptions.
        </div>
      </footer>

      {/* Inbuilt Camera Scanner Viewport Modal */}
      {isScanning && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '24px',
              padding: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              color: '#ffffff',
              textAlign: 'left'
            }}
          >
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '12px',
                borderBottom: '1px solid #1e293b',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} color="#f97316" />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  Live Inbuilt QR Scanner
                </h3>
              </div>
              <button
                onClick={stopCameraScanner}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: 0,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {cameraError ? (
              <div 
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '16px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  textAlign: 'center',
                  margin: '16px 0'
                }}
              >
                <AlertCircle size={28} color="#f87171" style={{ margin: '0 auto 8px' }} />
                <p style={{ margin: '0 0 12px' }}>{cameraError}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontWeight: 700,
                    padding: '10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    border: 0,
                    cursor: 'pointer'
                  }}
                >
                  Upload QR Image Instead
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {scannerLoading && (
                  <div 
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10,
                      gap: '8px'
                    }}
                  >
                    <RefreshCw className="animate-spin" size={28} color="#f97316" />
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                      Activating camera feed...
                    </p>
                  </div>
                )}
                <div 
                  id="inbuilt-qr-reader" 
                  style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    width: '100%',
                    minHeight: '280px',
                    backgroundColor: '#000000'
                  }}
                ></div>
                <p style={{ margin: '12px 0 0', fontSize: '11px', textAlign: 'center', color: '#94a3b8' }}>
                  Point camera directly at the Table QR code sticker
                </p>
              </div>
            )}

            <div 
              style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px'
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: 0,
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Upload size={14} />
                <span>Upload QR Photo</span>
              </button>
              <button
                onClick={stopCameraScanner}
                style={{
                  background: 'none',
                  border: 0,
                  color: '#f97316',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanQrLanding;
