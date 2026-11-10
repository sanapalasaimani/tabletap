import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Upload, Sparkles, ChefHat, Clock, Award, Star } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../supabase';
import './ScanQrLanding.css';

interface DishSlide {
  badge: string;
  title: string;
  description: string;
  meta: string;
  imageUrl: string;
  alt: string;
}

const DISH_SLIDES: DishSlide[] = [
  {
    badge: "Dum Cooked · Chef's Special",
    title: "Hyderabadi Chicken Biryani",
    description: "Layered with long-grain basmati, saffron, aromatic whole spices, and tender chicken slow-cooked under sealed dum. A guest favourite for both lunch and dinner.",
    meta: "★ 4.9 (420+ reviews) · Prepared in 15 mins",
    imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80",
    alt: "Glistening copper handi of authentic Chicken Dum Biryani with fried onions and mint"
  },
  {
    badge: "Slow Cooked Handi",
    title: "Royal Mutton Biryani",
    description: "Succulent cuts of lamb infused with browned onions, crushed mint, and aged rice sealed in earthenware to preserve moisture, depth, and spice essence.",
    meta: "★ 4.8 (310+ reviews) · Rich & Flavorful",
    imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=1000&q=80",
    alt: "Slow cooked Mutton Dum Biryani topped with caramelized onions and saffron"
  },
  {
    badge: "Clay Oven & Tandoor",
    title: "Paneer Butter Masala & Garlic Naan",
    description: "Cubes of fresh malai paneer simmered in a velvety, buttery tomato-cashew makhani gravy, paired with blistered, herb-brushed garlic tandoori naan.",
    meta: "★ 4.9 (540+ reviews) · Vegetarian Classic",
    imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=1000&q=80",
    alt: "Creamy Paneer Butter Masala served with warm charred Garlic Naan"
  },
  {
    badge: "Wok Tossed · Indo-Chinese",
    title: "Crispy Szechuan Chilli Chicken",
    description: "Golden-fried chicken morsels tossed on high wok heat with crisp bell peppers, spicy slit green chillies, spring onions, and savory dark soy glaze.",
    meta: "★ 4.7 (280+ reviews) · Spicy Appetizer",
    imageUrl: "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1000&q=80",
    alt: "Wok tossed spicy Chilli Chicken with green bell peppers and chillies"
  },
  {
    badge: "Hospitality Experience",
    title: "Faster Kitchen Sync, Delighted Guests",
    description: "When digital orders reach the kitchen display in seconds, dining tables turn faster, food arrives piping hot, and your floor team focuses on genuine warmth.",
    meta: "Zero Wait Time · Seamless Table Turnover",
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80",
    alt: "Warm restaurant dining room with happy guests and ambient hospitality lighting"
  }
];

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

  // Carousel auto-rotation timer (4500ms)
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % DISH_SLIDES.length);
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

      {/* Top Navbar */}
      <nav>
        <div className="w">
          <a className="logo" href="#top">
            <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
              <rect width="38" height="38" rx="11" fill="#ff7a0a"/>
              <path d="M12 10v7a3 3 0 0 0 6 0v-7M15 10v18M25 10c-3 2-3 8 0 10v8" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
            </svg>
            <span>TableTap<small>Smart Hospitality OS</small></span>
          </a>
          <a className="l" href="#platform">Platform</a>
          <a className="l" href="#intelligence">Operations</a>
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
              <div className="ph-h"><b>Table 12</b><span>Digital Menu</span></div>
              <div className="bub u">Something mild, no nuts?</div>
              <div className="bub a">Try the Paneer Butter Masala. Creamy, nut-free, mild spice.</div>
              
              {/* Dish Item 1 with Real Food Photo */}
              <div className="dish">
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <img 
                    src="https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=120&q=80" 
                    alt="Paneer Butter Masala" 
                    className="dish-thumb"
                  />
                  <div>
                    <b><i className="veg"></i>Paneer Butter Masala</b>
                    <span>Mild · nut-free</span>
                  </div>
                </div>
                <b>₹320</b>
              </div>

              {/* Dish Item 2 with Real Food Photo */}
              <div className="dish">
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <img 
                    src="https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=120&q=80" 
                    alt="Garlic Naan" 
                    className="dish-thumb"
                  />
                  <div>
                    <b><i className="veg"></i>Garlic Naan</b>
                    <span>Tandoor baked</span>
                  </div>
                </div>
                <b>₹70</b>
              </div>

              <div 
                className="dish" 
                style={{ background: 'var(--ac)', color: '#ffffff', justifyContent: 'center', border: 0, cursor: 'pointer', marginTop: '12px' }}
                onClick={startCameraScanner}
              >
                <b>Send to kitchen</b>
              </div>
            </div>

            <div className="kds">
              <h4>
                <span>Kitchen display</span>
                <span style={{ color: 'var(--ok)' }}>Live Sync</span>
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

      {/* "Served fresh, loved by guests" Real Food Photography Carousel */}
      <section style={{ padding: '64px 0 0' }}>
        <div className="w">
          <h2>Served fresh, loved by guests</h2>
          <p className="lead" style={{ margin: '8px 0 0' }}>
            Authentic culinary preparation synced directly from dining table to chef station.
          </p>

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
              {DISH_SLIDES.map((slide, idx) => (
                <figure key={idx} className="tile">
                  <div className="tile-img-box">
                    <img 
                      src={slide.imageUrl} 
                      alt={slide.alt} 
                      className="tile-img" 
                      loading="lazy"
                    />
                    <div className="tile-badge">{slide.badge}</div>
                  </div>
                  <figcaption>
                    {slide.title}
                    <span>{slide.description}</span>
                    <div className="tile-meta">
                      <span>{slide.meta}</span>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="dots">
              {DISH_SLIDES.map((slide, idx) => (
                <button
                  key={idx}
                  className="dot"
                  aria-current={currentSlide === idx ? 'true' : 'false'}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={slide.title}
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
            {['Guest self-ordering', 'Kitchen display (KDS)', 'Floor staff assistant', 'Manager command center'].map((name, i) => (
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
              <h3>Floor staff assistant for tables</h3>
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

      {/* Intelligence & Operational Analytics Section */}
      <section className="ai" id="intelligence">
        <div className="w">
          <h2>Built-in hospitality intelligence</h2>
          <p className="lead">
            Turn daily orders, dish pairings, and diner feedback into operational actions your team can act on immediately.
          </p>
          <div className="ag">
            <div className="card">
              <div>
                <h3>Interactive Guest Concierge</h3>
                <p>Voice-enabled dietary guidance and dish suggestions. Diners ask about ingredients, allergens, or what to order in plain language.</p>
              </div>
              <div>
                <div className="bub u" style={{ maxWidth: '100%' }}>Is the biryani very spicy?</div>
                <div className="bub a" style={{ maxWidth: '100%' }}>Medium spice. I can request it mild, or suggest a cooling raita.</div>
              </div>
            </div>

            <div className="card">
              <div>
                <h3>Smart Menu Analytics & Pairings</h3>
                <p>Automatically discover your kitchen's top sellers, slow movers, and high-margin pairings to optimize preparation and inventory.</p>
              </div>
              <div>
                <div className="row" style={{ marginBottom: '8px' }}>Butter Naan + Dal <em>Pairs often (68%)</em></div>
                <div className="row">Veg Platter <em>Slow mover · Promote</em></div>
              </div>
            </div>

            <div className="card">
              <div>
                <h3>Real-Time Guest Feedback Trends</h3>
                <p>Categorizes customer reviews by station and sentiment, helping floor and kitchen managers fix bottlenecks before they affect reputation.</p>
              </div>
              <div>
                <div className="bar" aria-label="Sentiment example">
                  <i style={{ width: '68%', background: 'var(--ok)' }}></i>
                  <i style={{ width: '20%', background: 'var(--wa)' }}></i>
                  <i style={{ width: '12%', background: 'var(--er)' }}></i>
                </div>
                <div className="row" style={{ marginTop: '10px' }}>Top bottleneck <em>Dessert prep pace</em></div>
              </div>
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
                  <td>Smart analytics and review trends</td>
                </tr>
                <tr>
                  <td>Hardware</td>
                  <td>Expensive proprietary terminals</td>
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
          <p className="lead">Trusted by modern casual dining restaurants, cafes, and multi-outlet hospitality teams.</p>
          <div className="tg">
            <blockquote>
              “Orders reach the pass in seconds. The color-coded SLA timers alone changed how smoothly we run Friday night rushes.”
              <footer>Head chef, sample restaurant</footer>
            </blockquote>
            <blockquote>
              “Guests get instant answers about allergens, so my floor team spends their time on genuine, attentive hospitality.”
              <footer>F&amp;B manager, sample hotel</footer>
            </blockquote>
            <blockquote>
              “Feedback trends showed our dessert station was lagging on peak hours. We adjusted kitchen prep and fixed it in a week.”
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
              <p>No. They scan the QR code and the menu opens instantly in their phone browser. Only your waiters use the Android waiter app.</p>
            </details>
            <details>
              <summary>Do we need new hardware?</summary>
              <p>No. TableTap runs on the smartphones, kitchen tablets and laptops you already have.</p>
            </details>
            <details>
              <summary>How do the smart insights and feedback features work?</summary>
              <p>The interactive concierge answers menu and dietary questions. Menu analytics study order history for best sellers, pairings, and peak hours. Review trends group guest feedback by station and sentiment.</p>
            </details>
            <details>
              <summary>Can it support hotels and multiple outlets?</summary>
              <p>Yes. The manager console is built for hotels, food courts, and chains with several outlets.</p>
            </details>
            <details>
              <summary>How long does onboarding take?</summary>
              <p>Share your menu, print the QR stickers, and train staff on the kitchen display and waiter app. You can be operational within 24 to 48 hours.</p>
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
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
          © 2026 TableTap, powered by DineSmart AI. Enterprise contactless dining and restaurant management.
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
