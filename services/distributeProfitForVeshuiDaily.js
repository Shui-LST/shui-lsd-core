const { ethers } = require("ethers");
const { abi } = require("../artifacts/contracts/espace/VeShui.sol/VeShui.json")
const { VESHUI, E_SPACE_RPC } = process.env;

const provider = new ethers.JsonRpcProvider(E_SPACE_RPC)

async function run() {
    setInterval(async function () {
        const veShui = new ethers.Contract(VESHUI, abi, provider)
        const profit = await veShui.profitAwaiting()
        if (profit == 0n) {
            console.log("profit is 0, skip distribute")
            return
        }

        await veShui.distributeProfit()
        console.log("distribute profit for veShui daily", profit)
    }, 1000 * 60 * 60)
}
run()