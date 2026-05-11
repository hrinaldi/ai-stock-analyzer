from dotenv import load_dotenv
import os
import json
import logging
import yfinance as yf
import anthropic
from flask import Flask, jsonify
from flask_cors import CORS

logging.getLogger("yfinance").setLevel(logging.CRITICAL)

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

app = Flask(__name__)
CORS(app)


def format_history(hist):
    """Convert a yfinance history dataframe to a list of {date, price} dicts."""
    result = []
    for date, row in hist["Close"].items():
        result.append({
            "date": date.strftime("%b %d '%y"),
            "price": round(float(row), 2)
        })
    return result


def get_stock_data(ticker):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist_3mo = stock.history(period="3mo")

        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("navPrice")
        if hist_3mo.empty or not price:
            return None

        # Fetch all available periods upfront
        hist_1mo  = stock.history(period="1mo")
        hist_6mo  = stock.history(period="6mo")
        hist_1y   = stock.history(period="1y")
        hist_2y   = stock.history(period="2y")
        hist_5y   = stock.history(period="5y")
        hist_max  = stock.history(period="max")

        return {
            "ticker": ticker,
            "name": info.get("longName", ticker),
            "sector": info.get("sector", "N/A"),
            "current_price": price,
            "pe_ratio": info.get("trailingPE"),
            "pb_ratio": info.get("priceToBook"),
            "ps_ratio": info.get("priceToSalesTrailing12Months"),
            "debt_to_equity": info.get("debtToEquity"),
            "market_cap": info.get("marketCap"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "analyst_target": info.get("targetMeanPrice"),
            # Price history for each period
            "price_history": {
                "1mo":  format_history(hist_1mo)  if not hist_1mo.empty  else [],
                "3mo":  format_history(hist_3mo)  if not hist_3mo.empty  else [],
                "6mo":  format_history(hist_6mo)  if not hist_6mo.empty  else [],
                "1y":   format_history(hist_1y)   if not hist_1y.empty   else [],
                "2y":   format_history(hist_2y)   if not hist_2y.empty   else [],
                "5y":   format_history(hist_5y)   if not hist_5y.empty   else [],
                "max":  format_history(hist_max)  if not hist_max.empty  else [],
            },
            # Still send 3mo string for the AI analysis prompt
            "history_string": hist_3mo["Close"].to_string(),
        }
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None


def analyze_stock(stock_data):
    prompt = f"""
Analyze this stock and return a structured JSON analysis.

Company: {stock_data['name']}
Ticker: {stock_data['ticker']}
Sector: {stock_data['sector']}
Current Price: {stock_data['current_price']}
P/E Ratio: {stock_data['pe_ratio']}
P/B Ratio: {stock_data['pb_ratio']}
P/S Ratio: {stock_data['ps_ratio']}
Debt/Equity: {stock_data['debt_to_equity']}
52 Week High: {stock_data['fifty_two_week_high']}
52 Week Low: {stock_data['fifty_two_week_low']}
Market Cap: {stock_data['market_cap']}
Analyst Target Price: {stock_data['analyst_target']}

Recent 3 month price history:
{stock_data['history_string']}

Return ONLY a JSON object, no markdown, no backticks, no explanation. Use exactly this structure:
{{
  "recommendation": "buy",
  "confidence": 75,
  "summary": "2-3 sentence summary here.",
  "bullCases": ["point 1", "point 2", "point 3", "point 4"],
  "bearCases": ["point 1", "point 2", "point 3", "point 4"],
  "technicalLevels": {{
    "support1": 150.00,
    "support2": 145.00,
    "resistance1": 165.00,
    "resistance2": 175.00
  }}
}}
"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    return json.loads(raw)


@app.route("/api/analyze/<ticker>", methods=["GET"])
def analyze(ticker):
    ticker = ticker.upper().strip()

    stock_data = get_stock_data(ticker)
    if not stock_data:
        return jsonify({"error": f"Could not find data for {ticker}. Check the ticker and try again."}), 404

    try:
        ai_analysis = analyze_stock(stock_data)
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

    def safe_round(val, digits=2):
        try:
            return round(float(val), digits)
        except (TypeError, ValueError):
            return None

    response = {
        "ticker": stock_data["ticker"],
        "companyName": stock_data["name"],
        "recommendation": ai_analysis["recommendation"],
        "confidence": ai_analysis["confidence"],
        "currentPrice": stock_data["current_price"],
        "priceHistory": stock_data["price_history"],
        "valuation": {
            "peRatio": safe_round(stock_data["pe_ratio"]),
            "pbRatio": safe_round(stock_data["pb_ratio"]),
            "psRatio": safe_round(stock_data["ps_ratio"]),
            "debtToEquity": safe_round(stock_data["debt_to_equity"]),
        },
        "technicalLevels": ai_analysis["technicalLevels"],
        "summary": ai_analysis["summary"],
        "bullCases": ai_analysis["bullCases"],
        "bearCases": ai_analysis["bearCases"],
    }

    return jsonify(response)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(port=5001, debug=True)
