# AI Stock Analyzer

An AI-powered stock analysis tool built with the Anthropic Claude API and Yahoo Finance. Available as both a CLI tool and a full-stack web app.

---

## Versions

### CLI (`/cli`)
A terminal-based tool for quick stock analysis and personalized recommendations.

- Analyze any stock or ETF — get a full breakdown including price trends, valuation, bull/bear case, key technical levels, and a buy/hold/sell verdict with confidence rating
- Get personalized recommendations — describe what you're looking for in plain English and the tool finds, validates, and summarizes the best matching stocks or ETFs
- Smart validation — all recommended tickers are verified through Yahoo Finance before being shown. Invalid or delisted tickers are silently replaced

### Web App (`/frontend` + `/backend`)
A full-stack web app with an interactive dashboard. UI designed in Figma, built with React + Flask, with Claude assisting in implementation.

- All CLI features surfaced in a clean dashboard UI
- Interactive price chart with selectable time periods (1M / 3M / 6M / 1Y / 2Y / 5Y / Max)
- Bull & bear case breakdown, valuation metrics, and key technical levels
- Quick-pick buttons for popular tickers on the landing page

---

## Demo (CLI)

> Output trimmed for readability. Full analysis includes detailed price phase breakdowns, weighted scoring matrix, and strategic entry/exit guidance.

```
============================================================
         📈 AI Stock Analysis Tool
============================================================

What would you like to do?
  [1] Analyze a specific stock
  [2] Get stock recommendations based on your criteria

Enter 1 or 2: 1
Enter stock ticker: HSAI

Fetching data for HSAI...
Running full analysis for Hesai Group...

# Hesai Group (HSAI) - Comprehensive Stock Analysis

## 1. PRICE TREND ANALYSIS
Net 3-month gain: ~+25.4% from December starting point
Stock is trading ~16.8% below its 52-week high of $30.85
Pattern of higher lows suggests a structural uptrend

## 2. VALUATION ANALYSIS
| Metric         | Value   | Assessment        |
|----------------|---------|-------------------|
| Current Price  | $25.67  | —                 |
| P/E Ratio      | 54.6x   | Premium valuation |
| Analyst Target | $32.46  | +26.4% upside     |

## 3. BULL VS. BEAR CASE
🐂 BULL: #1 LiDAR supplier in China, 26%+ analyst upside,
         strong EV/AV tailwinds, earnings growing rapidly
🐻 BEAR: DoD military company listing, geopolitical risk,
         54x P/E leaves little margin for error

## 4. KEY TECHNICAL LEVELS
Resistance: $28.10–$28.80 (Jan-Feb peak zone)
Current:    $25.67
Support:    $23.75 (recent 3-month low)

## 🟡 RECOMMENDATION: HOLD — Confidence: 65%
Accumulate on dips toward $23-24 support zone.
Price target: $30-32 over 6-12 months.
Stop loss: $20.50
```

---

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/hrinaldi/ai-stock-analyzer.git
cd ai-stock-analyzer
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Add your API key
Create a `.env` file in the root (for CLI) or in `backend/` (for the web app) and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your-api-key-here
```
Get your key at [console.anthropic.com](https://console.anthropic.com)

---

## Running the CLI
```bash
cd cli
python yfinanceapi.py
```

## Running the Web App

Open two terminals:

**Terminal 1 — backend:**
```bash
cd backend
python app.py
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## Tech Stack

**CLI:**
- [Anthropic Claude API](https://www.anthropic.com) — AI analysis and ticker recommendations
- [yfinance](https://github.com/ranaroussi/yfinance) — Yahoo Finance data
- [python-dotenv](https://github.com/theskumar/python-dotenv) — environment variable management

**Web App:**
- React, TypeScript, Tailwind CSS v4, Recharts, Vite
- Python, Flask, flask-cors
- Figma (UI design)

---

## How It Works

### Analyze a Stock
Enter any valid ticker and the tool pulls price history and key metrics from Yahoo Finance, then passes that data to Claude for a detailed analysis covering price trend, valuation, bull/bear case, key technical levels, and a final buy/hold/sell verdict with confidence rating.

### Get Recommendations
Describe what you're looking for in plain English. Claude suggests candidate tickers, each one is validated through Yahoo Finance, and you get a brief summary card for each. You can then request a full analysis on any of them.

---

## Notes

- This tool is for informational purposes only and does not constitute financial advice
- API costs are billed through your Anthropic account. Running on Claude Sonnet, each analysis costs roughly $0.02–0.03
- A free Anthropic API account with $5 in credits is more than enough to get started
- Product design, API pipeline architecture, and prompt engineering by the author. Code structure and formatting built with AI assistance
