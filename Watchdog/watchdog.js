require("dotenv").config();
const WebSocket = require("ws");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const socket = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

socket.on("open", function open() {
	console.log("Connected to WebSocket");
});

const port = process.env.PORT || 3000;

socket.on("message", async function incoming(data) {
	const trade = JSON.parse(data);
	const price = parseFloat(trade.p);

	const accountsDir = path.join(__dirname, "../accounts");
	fs.readdir(accountsDir, async (err, files) => {
		if (err) {
			console.error("Error reading accounts directory:", err);
			return;
		}

		for (const file of files) {
			const filePath = path.join(accountsDir, file);
			const accountData = JSON.parse(fs.readFileSync(filePath));

			if (accountData.currentTrade && Object.keys(accountData.currentTrade).length > 0) {
				const { stopLoss, takeProfit, type: long_short } = accountData.currentTrade;

				if (stopLoss && ((long_short === "l" && price <= stopLoss) || (long_short === "s" && price >= stopLoss))) {
					await axios.post(`http://localhost:${port}/exitTrade`, {
						accountUuid: accountData.uuid,
						exit_price: price,
					});
				}

				if (takeProfit && ((long_short === "l" && price >= takeProfit) || (long_short === "s" && price <= takeProfit))) {
					await axios.post(`http://localhost:${port}/exitTrade`, {
						accountUuid: accountData.uuid,
						exit_price: price,
					});
				}
			}
		}
	});
});

socket.on("error", function error(err) {
	console.error("WebSocket error:", err);
});

socket.on("close", function close() {
	console.log("WebSocket connection closed");
});
