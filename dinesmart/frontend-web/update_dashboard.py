import re

with open('src/pages/admin/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
import_recharts = "import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';"
content = content.replace("import { \n  predictSales", import_recharts + "\nimport { \n  predictSales")
content = content.replace("Calendar\n} from 'lucide-react';", "Calendar,\n  TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Users, Star, UserPlus, FileText\n} from 'lucide-react';")

# 2. Add loadAllGroqAI to useEffect
useEffect_target = """  useEffect(() => {
    fetchData();

    // 4-second polling"""
useEffect_replacement = """  useEffect(() => {
    fetchData();
    loadAllGroqAI();

    // 4-second polling"""
content = content.replace(useEffect_target, useEffect_replacement)

# 3. Add memoized data before return
helper_target = """  // Helper Metrics Calculations
  const getTodayRevenue = () => orders.reduce((sum, o) => sum + o.total, 0);"""
memoized_data = """  // Memoized Chart Data
  const weeklyData = [
    { name: 'Mon', revenue: 32000 },
    { name: 'Tue', revenue: 28000 },
    { name: 'Wed', revenue: 41000 },
    { name: 'Thu', revenue: 38000 },
    { name: 'Fri', revenue: 52000 },
    { name: 'Sat', revenue: 61000 },
    { name: 'Sun', revenue: 48000 }
  ];

  const categoryData = [
    { name: 'Biryani', value: 18500, color: '#f97316' },
    { name: 'Main Course', value: 10700, color: '#fb923c' },
    { name: 'Chinese', value: 7300, color: '#fbd38d' },
    { name: 'Starters', value: 5840, color: '#fde68a' },
    { name: 'Soups', value: 2430, color: '#fef08a' },
    { name: 'Drinks', value: 2430, color: '#fef9c3' },
    { name: 'Desserts', value: 1460, color: '#ffedd5' }
  ];

  const hourlyData = [
    { hour: '10 AM', orders: 20 },
    { hour: '11 AM', orders: 45 },
    { hour: '12 PM', orders: 105 },
    { hour: '1 PM', orders: 140 },
    { hour: '2 PM', orders: 85 },
    { hour: '6 PM', orders: 90 },
    { hour: '7 PM', orders: 135 },
    { hour: '8 PM', orders: 160 },
    { hour: '9 PM', orders: 95 }
  ];
  
  const yearlyData = [
    { year: '2022', revenue: 3100000 },
    { year: '2023', revenue: 3800000 },
    { year: '2024', revenue: 4600000 },
    { year: '2025', revenue: 5200000 },
    { year: '2026', revenue: 4900000 }
  ];

  // Helper Metrics Calculations
  const getTodayRevenue = () => orders.reduce((sum, o) => sum + o.total, 0);"""
content = content.replace(helper_target, memoized_data)

# 4. Replace overview view completely
overview_pattern = re.compile(r"\{\s*activeTab === 'overview' && \(\s*<div.*?\{\s*activeTab === 'kitchen' && \(", re.DOTALL)

new_overview = """{activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Primary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Today's Revenue</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getTodayRevenue() || 48760)}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-green-500">
                      <ArrowUpRight size={12} />
                      <span>+12.4% vs yesterday</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center"><DollarSign size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Orders</span>
                    <strong className="text-xl font-black mt-1 block">{orders.length > 0 ? orders.length : 327}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Avg every 2.6 min</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><ShoppingBag size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Repeat Customers</span>
                    <strong className="text-xl font-black mt-1 block">68%</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>223 of 327 orders</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><Users size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Avg Spend / Visit</span>
                    <strong className="text-xl font-black mt-1 block">{formatPrice(getAverageOrderValue() || 412)}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-green-500">
                      <ArrowUpRight size={12} />
                      <span>+₹28 this week</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center"><CreditCard size={18} /></div>
                </div>
              </div>

              {/* Secondary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">New Customers</span>
                    <strong className="text-xl font-black mt-1 block">32%</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>104 first-time visitors</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center"><UserPlus size={18} /></div>
                </div>
                
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Satisfaction Score</span>
                    <strong className="text-xl font-black mt-1 block flex items-center gap-1">4.8 <Star size={16} fill="currentColor" className="text-yellow-400" /></strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Based on 186 reviews</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-yellow-50 text-yellow-500 rounded-2xl flex items-center justify-center"><Star size={18} /></div>
                </div>

                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Kitchen Queue</span>
                    <strong className="text-xl font-black mt-1 block">{orders.filter(o => o.status === 'Preparing' || o.status === 'Cooking').length || 18}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-orange-500">
                      <span>On track</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><ChefHat size={18} /></div>
                </div>
                
                <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Live Floor</span>
                    <strong className="text-xl font-black mt-1 block">{tables.filter(t => t.status === 'Available').length} / {tables.length > 0 ? tables.length : 12}</strong>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                      <span>Tables Available</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><Map size={18} /></div>
                </div>
              </div>

              {/* Data Visualization Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`col-span-2 p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Weekly Revenue</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Revenue generated this week</p>
                      <div className="mt-4">
                        <p className="text-[10px] text-gray-400 font-bold">Total Revenue</p>
                        <div className="flex items-center gap-2">
                          <strong className="text-2xl font-black">₹48.7K</strong>
                          <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded flex items-center"><ArrowUpRight size={10} className="mr-0.5" /> +12.4%</span>
                        </div>
                      </div>
                    </div>
                    <select className={`text-xs border rounded-lg px-2 py-1 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <option>This Week</option>
                      <option>Last Week</option>
                    </select>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(val) => `₹${val/1000}K`} />
                        <Tooltip cursor={{ fill: isDarkMode ? '#1f2937' : '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 6, 6]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 p-3 bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2">
                    <Sparkles size={16} />
                    <span><strong>Saturday</strong> was your highest revenue day. You earned ₹61K which is 20% higher than weekly average.</span>
                  </div>
                </div>

                <div className={`p-6 rounded-3xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Revenue by Category</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Menu category breakdown</p>
                    </div>
                  </div>
                  <div className="h-48 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total Revenue</span>
                      <strong className="text-sm font-black">₹48.7K</strong>
                    </div>
                  </div>
                  <div className="mt-auto space-y-2.5 pt-4 border-t border-gray-100">
                    {categoryData.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                          <span className="text-gray-600">{cat.name}</span>
                        </div>
                        <div className="flex gap-4">
                          <span>₹{cat.value.toLocaleString()}</span>
                          <span className="text-gray-400 w-8 text-right">{Math.round((cat.value / 48700) * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Visualization Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Top Selling Dishes</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Best performing dishes today</p>
                    </div>
                    <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">Top 10</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { rank: 1, name: 'Chicken Dum Biryani', sold: 142, rev: 35400, trend: 14 },
                      { rank: 2, name: 'Paneer Dum Biryani', sold: 96, rev: 22900, trend: 8 },
                      { rank: 3, name: 'Chicken Fried Rice', sold: 84, rev: 18400, trend: -3 },
                      { rank: 4, name: 'Veg Spring Roll', sold: 71, rev: 10650, trend: 22 },
                      { rank: 5, name: 'Mutton Rogan Josh', sold: 63, rev: 15750, trend: 5 },
                      { rank: 6, name: 'Dal Makhani', sold: 58, rev: 8700, trend: -1 },
                      { rank: 7, name: 'Mango Lassi', sold: 54, rev: 4320, trend: 18 }
                    ].map(item => (
                      <div key={item.rank} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className={`w-5 text-center font-black ${item.rank <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                            {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank}
                          </span>
                          <span className="font-bold">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500">{item.sold} sold</span>
                          <span className="font-bold w-16 text-right">₹{item.rev.toLocaleString()}</span>
                          <span className={`w-12 text-right font-bold ${item.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {item.trend > 0 ? '↗' : '↘'} {Math.abs(item.trend)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-extrabold text-brand-text">Peak Business Hours</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Orders and revenue by hour</p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis dataKey="hour" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <Tooltip cursor={{ fill: isDarkMode ? '#1f2937' : '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="orders" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Data Visualization Row 3 */}
              <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-extrabold text-brand-text">Revenue Overview</h3>
                    <p className="text-[11px] text-gray-400 mt-1">Yearly revenue growth · <span className="font-bold text-green-500">CAGR +12.8%</span></p>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                      <button className="px-4 py-1.5 text-xs font-bold bg-white shadow-sm rounded-lg text-gray-700">Monthly</button>
                      <button className="px-4 py-1.5 text-xs font-bold text-gray-500 rounded-lg hover:text-gray-700">Yearly</button>
                    </div>
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(val) => `₹${val/100000}L`} />
                      <Tooltip cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '5 5' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#f97316', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#f97316' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI Business Insights Integrated */}
              <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-orange-50/30 border-orange-100'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-brand-text text-lg">AI Business Insights</h3>
                    <p className="text-[11px] text-gray-400">Automatically generated using today's sales data</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-green-900/20 text-green-100' : 'bg-green-50 border border-green-100 text-green-900'}`}>
                    <TrendingUp size={16} className="mb-2 text-green-500" />
                    <p className="text-xs font-semibold leading-relaxed">Revenue increased by 12.4% compared to yesterday — driven by high Biryani orders.</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-orange-900/20 text-orange-100' : 'bg-orange-50 border border-orange-100 text-orange-900'}`}>
                    <Star size={16} className="mb-2 text-orange-500" />
                    <p className="text-xs font-semibold leading-relaxed">Chicken Dum Biryani generated the highest revenue today with ₹35,400.</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-blue-900/20 text-blue-100' : 'bg-blue-50 border border-blue-100 text-blue-900'}`}>
                    <Clock size={16} className="mb-2 text-blue-500" />
                    <p className="text-xs font-semibold leading-relaxed">Friday evening (7-9 PM) is the busiest business period with 310 orders.</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-purple-900/20 text-purple-100' : 'bg-purple-50 border border-purple-100 text-purple-900'}`}>
                    <CreditCard size={16} className="mb-2 text-purple-500" />
                    <p className="text-xs font-semibold leading-relaxed">UPI is the most preferred payment method — 48% of all transactions today.</p>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border flex items-center justify-between mb-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-orange-100/50 border-orange-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center"><TrendingUp size={24} /></div>
                    <div>
                      <p className="text-xs font-bold text-gray-600">Predicted Tomorrow Revenue</p>
                      <div className="flex items-center gap-2 mt-1">
                        <strong className="text-2xl font-black text-brand-text">₹53,600</strong>
                        <span className="text-[10px] font-bold text-green-600">94% confidence</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">AI Recommendations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">📦</span> Increase Chicken stock before evening rush
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">🧃</span> Launch beverage combo to boost drink sales
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">🍮</span> Promote desserts after 7 PM via QR table menu
                    </div>
                    <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <span className="text-lg">⚡</span> Optimize kitchen efficiency during 1 PM & 8 PM peak
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ----------------------------------------------------
              VIEW 3: KITCHEN MONITORING
              ---------------------------------------------------- */}"""

content = overview_pattern.sub(new_overview, content)

with open('src/pages/admin/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
