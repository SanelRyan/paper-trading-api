require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/createAccount", (req, res) => {
	const { accountName, startingBalance } = req.query;

	if (!accountName || !startingBalance) {
		return res.status(400).json({
			success: false,
			message: "Missing accountName or startingBalance",
		});
	}

	const accountUuid = uuidv4();
	const creationTime = new Date().toISOString();

	const accountData = {
		uuid: accountUuid,
		name: accountName,
		balance: Number(startingBalance),
		startingBalance: Number(startingBalance),
		creationTime: creationTime,
		currentTrade: {},
		positionHistory: [],
	};

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	fs.writeFile(filePath, JSON.stringify(accountData, null, 2), (err) => {
		if (err) {
			return res.status(500).json({
				success: false,
				message: "Error creating account",
			});
		}
		res.json({
			success: true,
			message: `Account ${accountName} created successfully!`,
			uuid: accountUuid,
		});
	});
});

app.post("/takeTrade", (req, res) => {
	const { accountUuid, long_short, balance, leverage, entry_price, stop_loss, take_profit } = req.body;

	if (!accountUuid || !long_short || !balance || !leverage || !entry_price) {
		return res.status(400).json({
			success: false,
			message: "Missing required fields",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));

	const position_size = parseFloat((balance * leverage).toFixed(2));
	const margin = parseFloat(balance.toFixed(2));

	accountData.currentTrade = {
		leverage: parseFloat(leverage.toFixed(2)),
		type: long_short,
		margin: margin,
		positionSize: position_size,
		entryPrice: parseFloat(entry_price.toFixed(2)),
		stopLoss: stop_loss ? parseFloat(stop_loss.toFixed(2)) : null,
		takeProfit: take_profit ? parseFloat(take_profit.toFixed(2)) : null,
	};

	fs.writeFileSync(filePath, JSON.stringify(accountData, null, 2));

	res.json({
		success: true,
		message: `Trade executed for account ${accountData.name}`,
		trade: accountData.currentTrade,
	});
});

app.post("/exitTrade", (req, res) => {
	const { accountUuid, exit_price } = req.body;

	if (!accountUuid || !exit_price) {
		return res.status(400).json({
			success: false,
			message: "Missing required fields",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	const currentTrade = accountData.currentTrade;

	if (!currentTrade || Object.keys(currentTrade).length === 0) {
		return res.status(400).json({
			success: false,
			message: "No active trade to exit",
		});
	}

	const { entryPrice, leverage, margin, positionSize, type: long_short, stopLoss, takeProfit } = currentTrade;
	let pnl;

	if (long_short === "l") {
		pnl = parseFloat((((exit_price - entryPrice) * positionSize) / entryPrice).toFixed(2));
	} else if (long_short === "s") {
		pnl = parseFloat((((entryPrice - exit_price) * positionSize) / entryPrice).toFixed(2));
	} else {
		return res.status(400).json({
			success: false,
			message: "Invalid trade type",
		});
	}

	const percentage_pnl = parseFloat(((pnl / margin) * 100).toFixed(2));
	const trade_record = {
		pnl: pnl,
		percentage_pnl: percentage_pnl,
		time: new Date().toISOString(),
		position: long_short,
		margin: margin,
		leverage: leverage,
		entryPrice: parseFloat(entryPrice.toFixed(2)),
		exitPrice: parseFloat(exit_price.toFixed(2)),
		sl_hit: false,
		tp_hit: false,
	};

	if (stopLoss) {
		if ((long_short === "l" && exit_price <= stopLoss) || (long_short === "s" && exit_price >= stopLoss)) {
			trade_record.sl_hit = true;
		}
	}

	if (takeProfit) {
		if ((long_short === "l" && exit_price >= takeProfit) || (long_short === "s" && exit_price <= takeProfit)) {
			trade_record.tp_hit = true;
		}
	}

	accountData.positionHistory.push(trade_record);
	accountData.balance = parseFloat((accountData.balance + pnl).toFixed(2));
	accountData.currentTrade = {};

	fs.writeFileSync(filePath, JSON.stringify(accountData, null, 2));

	res.json({
		success: true,
		message: "Trade exited successfully",
		pnl: pnl,
		percentage_pnl: percentage_pnl,
		slHit: trade_record.sl_hit,
		tpHit: trade_record.tp_hit,
	});
});

app.get("/getTradeHistory", (req, res) => {
	const { accountUuid, page = 1, limit = 10 } = req.query;

	if (!accountUuid) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	const totalTrades = accountData.positionHistory.length;

	const parsedPage = parseInt(page);
	const parsedLimit = parseInt(limit);

	const maxPages = Math.ceil(totalTrades / parsedLimit);
	let index, offSet;

	if (parsedPage <= 1) {
		index = 0;
		offSet = parsedLimit;
	} else if (parsedPage > maxPages) {
		index = (maxPages - 1) * parsedLimit;
		offSet = totalTrades;
	} else {
		index = (parsedPage - 1) * parsedLimit;
		offSet = index + parsedLimit;
	}

	const paginatedHistory = accountData.positionHistory.slice(index, offSet);

	res.json({
		success: true,
		tradeHistory: paginatedHistory,
		totalTrades: totalTrades,
		maxPages: maxPages,
		page: parsedPage,
		limit: parsedLimit,
	});
});

app.get("/getAccountInfo", (req, res) => {
	const { accountUuid } = req.query;

	if (!accountUuid) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	const { positionHistory, ...accountInfo } = accountData;

	res.json({
		success: true,
		accountInfo: accountInfo,
	});
});

app.put("/updateBalance", (req, res) => {
	const { accountUuid, newBalance } = req.body;

	if (!accountUuid || !newBalance) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid or newBalance",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	accountData.balance = parseFloat(newBalance.toFixed(2));

	fs.writeFileSync(filePath, JSON.stringify(accountData, null, 2));

	res.json({
		success: true,
		message: `Balance updated for account ${accountData.name}`,
	});
});

app.delete("/deleteAccount", (req, res) => {
	const { accountUuid } = req.query;

	if (!accountUuid) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	fs.unlinkSync(filePath);

	res.json({
		success: true,
		message: "Account deleted successfully",
	});
});

app.put("/updateAccountInfo", (req, res) => {
	const { accountUuid, newAccountName } = req.body;

	if (!accountUuid || !newAccountName) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid or newAccountName",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	accountData.name = newAccountName;

	fs.writeFileSync(filePath, JSON.stringify(accountData, null, 2));

	res.json({
		success: true,
		message: `Account name updated to ${newAccountName}`,
	});
});

app.get("/getAllAccountList", (req, res) => {
	const accountsDir = path.join(__dirname, "../accounts");

	fs.readdir(accountsDir, (err, files) => {
		if (err) {
			return res.status(500).json({
				success: false,
				message: "Error reading accounts directory",
			});
		}

		const accountList = files.map((file) => {
			const filePath = path.join(accountsDir, file);
			const accountData = JSON.parse(fs.readFileSync(filePath));
			return {
				uuid: accountData.uuid,
				name: accountData.name,
				balance: accountData.balance,
				creationTime: accountData.creationTime,
			};
		});

		res.json({
			success: true,
			accounts: accountList,
		});
	});
});

app.get("/getFinancialInfo", (req, res) => {
	const { accountUuid } = req.query;

	if (!accountUuid) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	const { balance, positionHistory } = accountData;

	let totalNetProfit = 0;
	let grossProfit = 0;
	let grossLoss = 0;
	let numberWinningTrades = 0;
	let numberLosingTrades = 0;
	let largestWinningTrade = -Infinity;
	let largestLosingTrade = Infinity;
	let totalWinningTrades = 0;
	let totalLosingTrades = 0;

	positionHistory.forEach((trade) => {
		const { pnl, percentage_pnl } = trade;
		totalNetProfit += pnl;

		if (pnl > 0) {
			grossProfit += pnl;
			numberWinningTrades++;
			largestWinningTrade = Math.max(largestWinningTrade, pnl);
			totalWinningTrades += pnl;
		} else {
			grossLoss += Math.abs(pnl);
			numberLosingTrades++;
			largestLosingTrade = Math.min(largestLosingTrade, pnl);
			totalLosingTrades += Math.abs(pnl);
		}
	});

	const totalTrades = positionHistory.length;
	const percentProfitable = totalTrades > 0 ? ((numberWinningTrades / totalTrades) * 100).toFixed(2) : 0;
	const avgWinningTrade = numberWinningTrades > 0 ? (totalWinningTrades / numberWinningTrades).toFixed(2) : 0;
	const avgLosingTrade = numberLosingTrades > 0 ? (totalLosingTrades / numberLosingTrades).toFixed(2) : 0;

	res.json({
		success: true,
		financialInfo: {
			balance: balance,
			totalNetProfit: totalNetProfit.toFixed(2),
			grossProfit: grossProfit.toFixed(2),
			grossLoss: grossLoss.toFixed(2),
			totalTrades: totalTrades,
			percentProfitable: percentProfitable,
			numberWinningTrades: numberWinningTrades,
			numberLosingTrades: numberLosingTrades,
			largestWinningTrade: largestWinningTrade === -Infinity ? 0 : largestWinningTrade.toFixed(2),
			largestLosingTrade: largestLosingTrade === Infinity ? 0 : largestLosingTrade.toFixed(2),
			avgWinningTrade: avgWinningTrade,
			avgLosingTrade: avgLosingTrade,
		},
	});
});

app.get("/getCurrentTrade", (req, res) => {
	const { accountUuid } = req.query;

	if (!accountUuid) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	const currentTrade = accountData.currentTrade;

	if (!currentTrade || Object.keys(currentTrade).length === 0) {
		return res.status(404).json({
			success: false,
			message: "No active trade found",
		});
	}

	res.json({
		success: true,
		currentTrade: currentTrade,
	});
});

app.get("/getCumulativeBalance", (req, res) => {
	const { accountUuid } = req.query;

	if (!accountUuid) {
		return res.status(400).json({
			success: false,
			message: "Missing accountUuid",
		});
	}

	const filePath = path.join(__dirname, "../accounts", `${accountUuid}.json`);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({
			success: false,
			message: "Account not found",
		});
	}

	const accountData = JSON.parse(fs.readFileSync(filePath));
	const { startingBalance, positionHistory } = accountData;

	let cumulativeBalance = startingBalance;
	let balanceHistory = [{ date: accountData.creationTime, balance: cumulativeBalance }];

	positionHistory.forEach((trade) => {
		const { pnl, time } = trade;
		cumulativeBalance += pnl;
		balanceHistory.push({
			date: new Date(time).toISOString(),
			balance: cumulativeBalance,
		});
	});

	res.json({
		success: true,
		cumulativeBalanceHistory: balanceHistory,
	});
});

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
