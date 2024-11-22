const { ethers } = require("ethers");
const { abi } = require("../artifacts/contracts/espace/VeShui.sol/VeShui.json")
const { VESHUI, E_SPACE_RPC } = process.env;

const provider = new ethers.JsonRpcProvider(E_SPACE_RPC)

async function run() {
    const veShui = new ethers.Contract(VESHUI, abi, provider)
    const profit = await veShui.profitAwaiting()
    console.log(profit)
}

run()