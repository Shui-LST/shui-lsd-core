// require("@nomicfoundation/hardhat-foundry");
require("hardhat-conflux");
require("@openzeppelin/hardhat-upgrades");
// require("hardhat-abi-exporter");
require("hardhat-deploy");
// require("@nomicfoundation/hardhat-foundry");
// require("@nomiclabs/hardhat-solhint");
require('solidity-coverage')
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers")
require("hardhat-abi-exporter");

// const chai = require("chai");
// const chaiAsPromised = require('chai-as-promised');
// const chaiEventEmitter = require('chai-eventemitter2');
// chai.use(chaiAsPromised);
// chai.use(chaiEventEmitter());

require("dotenv").config();

const { loadPrivateKey } = require("./scripts/util");
const cPRIVATE_KEY = loadPrivateKey('cPRIVATE_KEY');
const ePRIVATE_KEY = loadPrivateKey('ePRIVATE_KEY');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.18",
    // defaultNetwork: 'ecfx_test',
    networks: {
        hardhat: {
            accounts: {
                mnemonic: "test test test test test test test test test test test junk",
                initialIndex: 0,
                path: "m/44'/60'/0'/0",
                count: 11,
                accountsBalance: "5000000000000000000000000000",
                passphrase: ""
            },
            allowUnlimitedContractSize: true,
            // loggingEnabled: true,
        },
        ropsten: {
            url: process.env.ROPSTEN_URL || "",
            accounts: ePRIVATE_KEY !== undefined ? [ePRIVATE_KEY] : [],
        },
        cfx: {
            url: process.env.CORE_SPACE_RPC || "https://main.confluxrpc.com",
            accounts: [cPRIVATE_KEY],
            chainId: 1029,
        },
        cfx_test: {
            url: "https://test.confluxrpc.com",
            accounts: [cPRIVATE_KEY],
            chainId: 1,
        },
        ecfx: {
            url: process.env.E_SPACE_RPC || "https://evm.confluxrpc.com",
            accounts: [ePRIVATE_KEY],
            chainId: 1030,
        },
        ecfx_test: {
            url: `https://evmtestnet.confluxrpc.com`,
            accounts: [ePRIVATE_KEY],
            chainId: 71,
        }
    },
    etherscan: {
        apiKey: {
            ecfx_test: 'an api key',
        },
        customChains: [
            {
                network: "ecfx_test",
                chainId: 71,
                urls: {
                    apiURL: "https://evmapi-testnet.confluxscan.net/api",
                    browserURL: "https://evmapi-testnet.confluxscan.net"
                }
            }
        ]
    },
    abiExporter: {
        path: "./data/abi",
        // runOnCompile: true,
        clear: true,
        flat: true,
        only: [
            "sCFX",
            "SHUI",
            "EVotingEscrow",
            "PoSPool"
        ],
        spacing: 2,
        pretty: true,
        // format: "minimal",
    }
};
