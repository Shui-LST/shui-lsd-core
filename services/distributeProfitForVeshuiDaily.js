const { ethers } = require("hardhat");
const { VESHUI } = process.env;

async function run() {
    setInterval(async function () {
        const veShui = await ethers.getContractAt("veShui", VESHUI)
        const profit = await veShui.profitAwaiting()
        if (profit == 0n) {
            console.log("profit is 0, skip distribute")
            return
        }

        try {
            await veShui.distributeProfit()
            console.log("distribute profit for veShui daily", profit)
        } catch (err) {
            console.log("distribute profit for veShui daily error", err.toString())
        }
    }, 500)
}
run()