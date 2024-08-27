# Paper Trading API

## Overview

The Paper Trading API is a Node.js-based application designed for simulating cryptocurrency trades using real-time market data from Binance. This API currently works exclusively for BTCUSDT, allowing users to create accounts, execute trades, monitor active trades, and retrieve trade histories, making it a useful tool for testing trading strategies without the risk of actual financial loss.

## Features

-   **Real-Time Market Data**: Leverages WebSocket connections to receive live trade data.
-   **Account Management**: Create, update, and delete paper trading accounts.
-   **Trade Execution**: Simulate long and short trades with leverage, including stop-loss and take-profit orders.
-   **Trade Monitoring**: Automatically exits trades based on market conditions.
-   **Trade History**: Retrieve detailed histories of all executed trades.
-   **Balance Management**: Update account balances to reflect profits, losses, and deposits.

## Getting Started

### Prerequisites

-   Node.js
-   npm (Node Package Manager)
-   Access to Binance WebSocket API
-   `.env` file with a defined `PORT` variable

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/SanelRyan/paper-trading-api.git
    cd paper-trading-api
    ```

2. Install the required dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and set your preferred port:

    ```plaintext
    PORT=3000
    ```

4. Create an `accounts` directory inside the project root to store account data:
    ```bash
    mkdir accounts
    ```

### Running the Application

Start the server:

```bash
node API/app.js
```

The server will start running at `http://localhost:3000`.

### API Endpoints

-   **GET /createAccount**: Create a new paper trading account.
-   **POST /takeTrade**: Execute a new trade for an account.
-   **POST /exitTrade**: Exit an active trade for an account.
-   **GET /getTradeHistory**: Retrieve the trade history of an account.
-   **GET /getAccountInfo**: Get details about a specific account.
-   **PUT /updateBalance**: Update the balance of an account.
-   **DELETE /deleteAccount**: Delete an account.
-   **PUT /updateAccountInfo**: Update the name of an account.
-   **GET /getAllAccountList**: Retrieve a list of all accounts.
-   **GET /getFinancialInfo**: Get financial information about an account.
-   **GET /getCurrentTrade**: Retrieve information about the current active trade of an account.
-   **GET /getCumulativeBalance**: Get the cumulative balance history of an account.

### Watchdog Process

The application includes a watchdog process that monitors the Bitcoin Pricing live and executes TP/SL accordingly. It is initiated alongside the API server:

```bash
node API/watchdog.js
```

## Author

**Sanel Ryan**  
Email: sanelryantclitus@gmail.com
