from dotenv import load_dotenv
import os
import yfinance as yf
import anthropic
import json
import logging
# yfinance logs a lot of noise by default so this silences it so only real errors show
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def get_stock_data(ticker):
    """Pull basic stock data from yfinance for a given ticker."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        hist = stock.history(period="3mo")
         # 3 months feels like a good window of time to get enough data without driving up the cost too much

        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("navPrice")
        # ETFs don't have currentPrice, they use regularMarketPrice or navPrice instead so checking all 3 to grab the price
        if hist.empty or not price:
            return None

        return {
            "ticker": ticker,
            "name": info.get("longName", ticker),
            "sector": info.get("sector", "N/A"),
            "current_price": price,
            "pe_ratio": info.get("trailingPE"),
            "market_cap": info.get("marketCap"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "analyst_target": info.get("targetMeanPrice"),
            "history": hist["Close"].to_string(),
        }
    except Exception:
        return None


def full_analysis(stock_data):
    """Run a full buy/hold/sell analysis on a validated stock."""
    prompt = f"""
Analyze this stock and give a buy, sell, or hold recommendation with detailed reasoning.

Company: {stock_data['name']}
Ticker: {stock_data['ticker']}
Sector: {stock_data['sector']}
Current Price: {stock_data['current_price']}
P/E Ratio: {stock_data['pe_ratio']}
52 Week High: {stock_data['fifty_two_week_high']}
52 Week Low: {stock_data['fifty_two_week_low']}
Market Cap: {stock_data['market_cap']}
Analyst Target Price: {stock_data['analyst_target']}

Recent 3 month price history:
{stock_data['history']}

Give a detailed analysis covering:
1. Price trend analysis
2. Valuation analysis
3. Bull vs bear case
4. Key technical levels
5. Final verdict: BUY, HOLD, or SELL with a confidence rating
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def brief_summary(stock_data):
    """Return a brief 2-3 sentence summary card for a stock."""
    prompt = f"""
Give a very brief 2-3 sentence summary of this stock for an investor deciding whether to learn more.
Include the current price, one key strength, one key risk, and analyst upside/downside.
Keep it concise -- this is a quick snapshot, not a full analysis.

Company: {stock_data['name']} ({stock_data['ticker']})
Sector: {stock_data['sector']}
Current Price: {stock_data['current_price']}
P/E Ratio: {stock_data['pe_ratio']}
52 Week High: {stock_data['fifty_two_week_high']}
52 Week Low: {stock_data['fifty_two_week_low']}
Analyst Target: {stock_data['analyst_target']}
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def recommend_tickers(user_criteria):
    """Ask Claude to suggest 5 tickers based on user criteria."""
    prompt = f"""
A user is looking for stock or ETF recommendations with the following criteria:
"{user_criteria}"

Suggest exactly 5 ticker symbols that best match this criteria.
Respond ONLY with a JSON array of ticker strings, nothing else. No explanation, no markdown, no backticks.
Example format: ["TICKER1", "TICKER2", "TICKER3", "TICKER4", "TICKER5"]
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    tickers = json.loads(raw)
    return tickers


def recommendation_mode():
    """Mode 2: Recommend stocks based on user criteria."""
    print("\nWhat are you looking for? Describe it freely.")
    print('Example: "a speculative AI stock that could take off" or "a safe dividend ETF"')
    criteria = input("\nYour criteria: ").strip()

    print("\nFinding recommendations for you...\n")

    # Step 1: Claude suggests tickers
    try:
        tickers = recommend_tickers(criteria)
    except Exception as e:
        print("Something went wrong finding recommendations. Try rephrasing your criteria.")
        return

    # Step 2: Validate tickers, silently replace any that fail
    valid_stocks = []
    tried_tickers = set(tickers)
    queue = list(tickers)
    max_attempts = 15
    # Without a cap this could loop forever if Claude keeps suggesting bad tickers

    while queue and len(valid_stocks) < 5 and len(tried_tickers) <= max_attempts:
        ticker = queue.pop(0)
        data = get_stock_data(ticker)
        if data:
            valid_stocks.append(data)
        else:
            # Silently ask Claude for one replacement
            try:
                exclude_list = list(tried_tickers)
                prompt = f"""
A user is looking for: "{criteria}"

The following tickers did not validate: {exclude_list}
Suggest 1 replacement ticker that fits the criteria and is NOT in that list.
Respond ONLY with a single ticker string, no explanation, no markdown.
Example: AAPL
"""
                message = client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=10,
                    messages=[{"role": "user", "content": prompt}]
                )
                replacement = message.content[0].text.strip().upper()
                if replacement not in tried_tickers:
                    tried_tickers.add(replacement)
                    queue.append(replacement)
            except Exception:
                pass

    if not valid_stocks:
        print("Couldn't find valid recommendations for that criteria. Try rephrasing.")
        return

    # Step 3: Show brief summary cards
    print(f"\n{'='*60}")
    print(f"  Found {len(valid_stocks)} recommendations for: \"{criteria}\"")
    print(f"{'='*60}\n")

    for i, stock in enumerate(valid_stocks, 1):
        print(f"[{i}] {stock['name']} ({stock['ticker']}) — ${stock['current_price']}")
        print(f"    Sector: {stock['sector']}")
        summary = brief_summary(stock)
        print(f"    {summary}")
        print()

    # Step 4: Let user pick which ones to analyze fully
    print("Would you like a full analysis on any of these? (e.g. '1', '1,3', or 'none')")
    choice = input("Your choice: ").strip().lower()

    if choice == "none" or choice == "":
        print("\nNo full analysis requested. Goodbye!")
        return

    selected_indexes = [int(x.strip()) - 1 for x in choice.split(",") if x.strip().isdigit()]

    for idx in selected_indexes:
        if 0 <= idx < len(valid_stocks):
            stock = valid_stocks[idx]
            print(f"\n{'='*60}")
            print(f"  Full Analysis: {stock['name']} ({stock['ticker']})")
            print(f"{'='*60}\n")
            print("Running full analysis, please wait...\n")
            analysis = full_analysis(stock)
            print(analysis)


def analysis_mode():
    """Mode 1: Analyze a specific stock ticker."""
    ticker = input("Enter stock ticker: ").strip().upper()

    print(f"\nFetching data for {ticker}...\n")
    stock_data = get_stock_data(ticker)

    if not stock_data:
        print(f"Could not find data for {ticker}. Please check the ticker and try again.")
        return

    print(f"Running full analysis for {stock_data['name']}...\n")
    analysis = full_analysis(stock_data)
    print(analysis)


def main():
    print("="*60)
    print("         📈 AI Stock Analysis Tool")
    print("="*60)
    print("\nWhat would you like to do?")
    print("  [1] Analyze a specific stock")
    print("  [2] Get stock recommendations based on your criteria")

    choice = input("\nEnter 1 or 2: ").strip()

    if choice == "1":
        analysis_mode()
    elif choice == "2":
        recommendation_mode()
    else:
        print("Invalid choice. Please enter 1 or 2.")


if __name__ == "__main__":
    main()