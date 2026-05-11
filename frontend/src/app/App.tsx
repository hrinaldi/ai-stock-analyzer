import { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, BarChart2, Loader2, AlertCircle, Zap, Database, Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';

const QUICK_PICKS = [
  { ticker: 'AAPL', label: 'Apple' },
  { ticker: 'NVDA', label: 'NVIDIA' },
  { ticker: 'TSLA', label: 'Tesla' },
  { ticker: 'MSFT', label: 'Microsoft' },
  { ticker: 'AMZN', label: 'Amazon' },
  { ticker: 'META', label: 'Meta' },
];

const PERIODS = [
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y',  label: '1Y' },
  { key: '2y',  label: '2Y' },
  { key: '5y',  label: '5Y' },
  { key: 'max', label: 'Max' },
];

// How many X-axis ticks to show per period so they never crowd
const TICK_COUNT: Record<string, number> = {
  '1mo': 5,
  '3mo': 6,
  '6mo': 6,
  '1y':  6,
  '2y':  6,
  '5y':  6,
  'max': 6,
};

type PricePoint = { date: string; price: number };

// Build a clean Y-axis domain with evenly spaced, round ticks
function getYAxisConfig(data: PricePoint[]): { domain: [number, number]; ticks: number[] } {
  if (!data.length) return { domain: [0, 1], ticks: [0, 1] };

  const prices = data.map(d => d.price).filter(p => isFinite(p) && p > 0);
  if (!prices.length) return { domain: [0, 1], ticks: [0, 1] };

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  // Pick a round step size that gives ~5 ticks
  const rawStep = range / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  const step = magnitude * (niceSteps.find(s => s * magnitude >= rawStep) ?? 10);

  const domainMin = Math.floor(minPrice / step) * step;
  const domainMax = Math.ceil(maxPrice / step) * step;

  const ticks: number[] = [];
  for (let t = domainMin; t <= domainMax + step * 0.01; t += step) {
    ticks.push(parseFloat(t.toPrecision(10)));
  }

  return { domain: [domainMin, domainMax], ticks };
}

// Format a price for the Y axis — handles everything from sub-penny to millions
function formatYTick(value: number): string {
  if (!isFinite(value) || value === 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  // Sub-penny — use scientific-style shorthand
  return `$${value.toPrecision(2)}`;
}

type StockData = {
  ticker: string;
  companyName: string;
  recommendation: 'buy' | 'hold' | 'sell';
  confidence: number;
  currentPrice: number;
  priceHistory: Record<string, PricePoint[]>;
  valuation: {
    peRatio: number | null;
    pbRatio: number | null;
    psRatio: number | null;
    debtToEquity: number | null;
  };
  technicalLevels: {
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
  };
  summary: string;
  bullCases: string[];
  bearCases: string[];
};

// Custom tooltip with $ prefix
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'oklch(0.145 0 0)',
        border: '2px solid rgb(16, 185, 129)',
        borderRadius: '8px',
        padding: '8px 12px',
        color: 'oklch(0.985 0 0)',
      }}>
        <p style={{ margin: 0, fontSize: 12, color: 'oklch(0.708 0 0)' }}>{label}</p>
        <p style={{ margin: 0, fontSize: 14, color: 'rgb(16, 185, 129)' }}>
          ${payload[0].value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [ticker, setTicker] = useState('');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState('3mo');

  const goHome = () => {
    setStockData(null);
    setError(null);
    setTicker('');
    setActivePeriod('3mo');
  };

  const fetchAnalysis = async (sym: string) => {
    if (!sym.trim()) return;
    setLoading(true);
    setError(null);
    setStockData(null);
    setActivePeriod('3mo');
    try {
      const res = await fetch(`http://localhost:5001/api/analyze/${sym.toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setStockData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalysis(ticker);
  };

  const handleQuickPick = (sym: string) => {
    setTicker(sym);
    fetchAnalysis(sym);
  };

  const getRecColor = (rec: string) => {
    if (rec === 'buy') return 'text-green-500';
    if (rec === 'sell') return 'text-red-500';
    return 'text-yellow-500';
  };

  const getRecIcon = (rec: string) => {
    if (rec === 'buy') return <TrendingUp className="w-8 h-8" />;
    if (rec === 'sell') return <TrendingDown className="w-8 h-8" />;
    return <Minus className="w-8 h-8" />;
  };

  const getBarColor = (rec: string) => {
    if (rec === 'buy') return 'bg-gradient-to-r from-green-500 to-green-400';
    if (rec === 'sell') return 'bg-gradient-to-r from-red-500 to-red-400';
    return 'bg-gradient-to-r from-yellow-500 to-yellow-400';
  };

  const fmt = (val: number | null) =>
    val !== null && val !== undefined ? val : 'N/A';

  // Thin out data points to avoid crowding — pick evenly spaced indices
  const getChartData = (): PricePoint[] => {
    if (!stockData) return [];
    const data = stockData.priceHistory[activePeriod] ?? [];
    const maxTicks = TICK_COUNT[activePeriod] ?? 6;
    if (data.length <= maxTicks * 4) return data;
    // Keep every Nth point so we get a smooth line without too many x labels
    const step = Math.floor(data.length / (maxTicks * 4));
    return data.filter((_, i) => i % step === 0 || i === data.length - 1);
  };

  // Pick evenly spaced tick indices for X axis
  const getTickIndices = (data: PricePoint[]): string[] => {
    if (data.length === 0) return [];
    const count = TICK_COUNT[activePeriod] ?? 6;
    if (data.length <= count) return data.map(d => d.date);
    const step = Math.floor((data.length - 1) / (count - 1));
    const ticks: string[] = [];
    for (let i = 0; i < count - 1; i++) ticks.push(data[i * step].date);
    ticks.push(data[data.length - 1].date);
    return ticks;
  };

  const chartData = getChartData();
  const ticks = getTickIndices(chartData);
  const yAxis = getYAxisConfig(chartData);

  return (
    <div className="dark min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header — click to go home */}
        <div
          className="flex items-center gap-3 cursor-pointer group w-fit"
          onClick={goHome}
        >
          <BarChart2 className="w-7 h-7 text-blue-400 group-hover:text-blue-300 transition-colors" />
          <h1 className="text-blue-400 text-2xl tracking-tight group-hover:text-blue-300 transition-colors">
            AI Stock Analyzer
          </h1>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter a stock ticker (e.g. AAPL, NVDA, TSLA)..."
            className="w-full pl-12 pr-28 py-3 bg-card border-2 border-blue-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-foreground placeholder:text-muted-foreground transition-all"
          />
          <button
            type="submit"
            disabled={loading || !ticker.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md text-sm transition-colors"
          >
            Analyze
          </button>
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            <span>Fetching data and running AI analysis...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-lg text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dashboard */}
        {stockData && !loading && (
          <>
            {/* Rec header */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-blue-400 text-2xl">{stockData.ticker}</h2>
                  <p className="text-muted-foreground text-sm mt-1">{stockData.companyName}</p>
                </div>
                <div className="text-4xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  ${stockData.currentPrice.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-4 bg-card/50 p-4 rounded-lg border border-border">
                <div className={`flex items-center gap-3 ${getRecColor(stockData.recommendation)}`}>
                  {getRecIcon(stockData.recommendation)}
                  <span className="uppercase tracking-wide text-lg font-medium">
                    {stockData.recommendation}
                  </span>
                </div>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getBarColor(stockData.recommendation)}`}
                    style={{ width: `${stockData.confidence}%` }}
                  />
                </div>
                <span className="text-muted-foreground min-w-fit">{stockData.confidence}% confidence</span>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-2 border-emerald-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-emerald-400">Price History</h3>
                {/* Period selector */}
                <div className="flex gap-1">
                  {PERIODS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActivePeriod(key)}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        activePeriod === key
                          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                          : 'text-muted-foreground hover:text-emerald-400 border border-transparent hover:border-emerald-500/30'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    ticks={ticks}
                    stroke="#6b7280"
                    tick={{ fill: '#d1d5db', fontSize: 11 }}
                    tickLine={{ stroke: '#4b5563' }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fill: '#d1d5db', fontSize: 11 }}
                    tickLine={{ stroke: '#4b5563' }}
                    domain={yAxis.domain}
                    ticks={yAxis.ticks}
                    tickFormatter={formatYTick}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="rgb(16, 185, 129)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: 'rgb(5, 150, 105)' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30 rounded-lg p-6">
              <h3 className="mb-4 text-cyan-400">Analysis Summary</h3>
              <p className="text-foreground/90 leading-relaxed">{stockData.summary}</p>
            </div>

            {/* Bull / Bear */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-lg p-6">
                <h3 className="mb-4 text-green-400">Bull Case</h3>
                <ul className="space-y-3">
                  {stockData.bullCases.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/90">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-2 border-red-500/30 rounded-lg p-6">
                <h3 className="mb-4 text-red-400">Bear Case</h3>
                <ul className="space-y-3">
                  {stockData.bearCases.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/90">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Valuation + Technical */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-orange-500/10 to-pink-500/10 border-2 border-orange-500/30 rounded-lg p-6">
                <h3 className="mb-4 text-orange-400">Valuation Metrics</h3>
                <div className="space-y-3">
                  {[
                    { label: 'P/E Ratio', val: fmt(stockData.valuation.peRatio) },
                    { label: 'P/B Ratio', val: fmt(stockData.valuation.pbRatio) },
                    { label: 'P/S Ratio', val: fmt(stockData.valuation.psRatio) },
                    { label: 'Debt/Equity', val: fmt(stockData.valuation.debtToEquity) },
                  ].map(({ label, val }, i, arr) => (
                    <div key={label} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? 'border-b border-orange-500/20' : ''}`}>
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-orange-300">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border-2 border-violet-500/30 rounded-lg p-6">
                <h3 className="mb-4 text-violet-400">Key Technical Levels</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Resistance 2', val: `$${stockData.technicalLevels.resistance2}`, color: 'text-red-400' },
                    { label: 'Resistance 1', val: `$${stockData.technicalLevels.resistance1}`, color: 'text-red-300' },
                    { label: 'Support 1',    val: `$${stockData.technicalLevels.support1}`,    color: 'text-green-300' },
                    { label: 'Support 2',    val: `$${stockData.technicalLevels.support2}`,    color: 'text-green-400' },
                  ].map(({ label, val, color }, i, arr) => (
                    <div key={label} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? 'border-b border-violet-500/20' : ''}`}>
                      <span className="text-muted-foreground">{label}</span>
                      <span className={color}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Landing screen */}
        {!stockData && !loading && !error && (
          <div className="space-y-10 pt-4">
            <div className="text-center space-y-4 py-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm mb-2">
                <Zap className="w-3.5 h-3.5" />
                Powered by Claude AI + Yahoo Finance
              </div>
              <h2 className="text-3xl text-foreground font-medium">
                AI-powered stock analysis,<br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  in seconds
                </span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Enter any ticker above to get a full buy/hold/sell recommendation, price chart, bull & bear cases, valuation metrics, and key technical levels — all generated by Claude from live market data.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Database className="w-5 h-5 text-emerald-400" />,
                  border: 'border-emerald-500/30',
                  bg: 'from-emerald-500/10 to-cyan-500/10',
                  title: '1. Live Data',
                  desc: 'Yahoo Finance pulls real-time price, fundamentals, and full price history for any ticker.',
                },
                {
                  icon: <Brain className="w-5 h-5 text-blue-400" />,
                  border: 'border-blue-500/30',
                  bg: 'from-blue-500/10 to-purple-500/10',
                  title: '2. AI Analysis',
                  desc: 'Claude analyzes the data and returns a structured recommendation with bull/bear cases and technical levels.',
                },
                {
                  icon: <BarChart2 className="w-5 h-5 text-violet-400" />,
                  border: 'border-violet-500/30',
                  bg: 'from-violet-500/10 to-fuchsia-500/10',
                  title: '3. Full Dashboard',
                  desc: 'Everything gets surfaced in one clean view — verdict, chart, valuation, and key levels.',
                },
              ].map(({ icon, border, bg, title, desc }) => (
                <div key={title} className={`bg-gradient-to-br ${bg} border-2 ${border} rounded-lg p-5 space-y-3`}>
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-foreground font-medium">{title}</span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm text-center">Or jump straight to a popular stock:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {QUICK_PICKS.map(({ ticker: sym, label }) => (
                  <button
                    key={sym}
                    onClick={() => handleQuickPick(sym)}
                    className="px-5 py-2.5 bg-card hover:bg-accent border-2 border-border hover:border-blue-500/50 rounded-lg text-foreground text-sm transition-all group"
                  >
                    <span className="text-blue-400 font-medium group-hover:text-blue-300">{sym}</span>
                    <span className="text-muted-foreground ml-2">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
