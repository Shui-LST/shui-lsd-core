const { Conflux } = require('js-conflux-sdk');
const ethers = require('ethers');
const CORE = require('@uniswap/sdk-core')
const V2_SDK = require('@uniswap/v2-sdk')
const { teleAlert } = require('./tele-bot');
const { Token, CurrencyAmount } = CORE;
const { Pair, Route, FACTORY_ADDRESS_MAP } = V2_SDK;
require('dotenv').config();

/*
# Monitor

1. pos node is running
2. sync script is running: sender account balance is enough
3. sCFX price in swappi is bigger than 1
4. how to monitor contract asset is not stolen?
*/

const WCFX_ADDRESS = '0x14b2D3bC65e74DAE1030EAFd8ac30c533c976A9b';
const FACTORY_ADDRESS = '0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5'; // swappi factory address
// add factory address for network 1030 so that the sdk can work on network 1030
FACTORY_ADDRESS_MAP[1030] = FACTORY_ADDRESS;

const cfxClient = new Conflux({
    // url: 'http://localhost:12537',
    url: 'https://main.confluxrpc.com',
    networkId: 1029
});

const provider = new ethers.JsonRpcProvider('https://evm.confluxrpc.com');

const sCFX = new Token(1030, process.env.sCFX, 18, 'sCFX', 'Shui LSD');

const WCFX = new Token(1030, WCFX_ADDRESS, 18, 'WCFX', 'Wrapped CFX');

// this is the ABI of the uniswap v2 pair contract
const uniswapV2poolABI = require('../../tmp/uni-v2-abi.json');

async function main () {
    setInterval(async function() {
        // 
        await isNodeRunning();

        await isSyncScriptRunning();

        await isPriceNormal();

    }, 5 * 60 * 1000);
}

main().catch(err => {
    console.error(err);
    process.exit();
});

const failTimes = {};

async function alert(name, msg) {
    if (failTimes[name] === undefined) failTimes[name] = 0;
    failTimes[name]++;
    if (failTimes[name] > 8) {
        await teleAlert(msg);
    }
    console.log(`${name} is down: ${msg}`);
}

function notifyNormal(name) {
    failTimes[name] = 0;
    console.log(`${name} is normal`);
}

async function isNodeRunning() {
    try {
        const status = await cfxClient.cfx.getStatus();
        notifyNormal('node');
    } catch(e) {
        await alert('node', 'Conflux node is down');
    }
}

// check nonce of syncer is increasing
const syncer = process.env.cADDRESS;
let syncerNonce = 0;
async function isSyncScriptRunning() {
    let nonce = await cfxClient.cfx.getNextNonce(syncer);
    if (syncerNonce < nonce) {
        syncerNonce = nonce;
        notifyNormal('syncScript');
    } else {
        await alert('syncScript', 'sync script seems stopped');
    }
}

async function createPair(token) {
    // const pairAddress = Pair.getAddress(token, WCFX);
    const pairAddress = process.env.SWAPPI_LP_TOKEN;

    // Setup provider, import necessary ABI ...
    const pairContract = new ethers.Contract(pairAddress, uniswapV2poolABI, provider)
    const reserves = await pairContract["getReserves"]()
    const [reserve0, reserve1] = reserves

    const tokens = [token, WCFX]
    const [token0, token1] = tokens[0].sortsBefore(tokens[1]) ? tokens : [tokens[1], tokens[0]]

    const pair = new Pair(CurrencyAmount.fromRawAmount(token0, reserve0.toString()), CurrencyAmount.fromRawAmount(token1, reserve1.toString()))
    
    // due to the Pair.getAddress is not correct in network 1030(the sdk calculate method is not match with 1030 contract), we need to set the address manually
    pair.liquidityToken.address = pairAddress

    // console.log(pair.liquidityToken.address);
    return pair
}

// amount of 1 CFX -> sCFX; should be smaller than 1
async function getPrice(token) {
    const pair = await createPair(token);

    const route = new Route([pair], WCFX, token)

    // console.log(typeof route.midPrice.toSignificant(6))
    // console.log(route.midPrice.invert().toSignificant(6))
    
    return Number(route.midPrice.toSignificant(6));
}

async function isPriceNormal() {
    let price = await getPrice(sCFX);
    if (price >= 1) {
        await alert('price', `sCFX price is ${price}`);
    } else {
        notifyNormal('price');
    }
}
