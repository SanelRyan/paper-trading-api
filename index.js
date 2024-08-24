const { fork } = require("child_process");

const APIProcess = fork("./API/app.js");

const WatchdogProcess = fork("./Watchdog/watchdog.js");

APIProcess.on("error", (err) => {
	console.error("API process error:", err);
});

WatchdogProcess.on("error", (err) => {
	console.error("Watchdog process error:", err);
});
