const { ethers } = require("hardhat");
const { address } = require("js-conflux-sdk");
async function main() {

    const { deploy } = deployments;
    const [deployer] = await ethers.getSigners();
    let data = `0xc4d66de8000000000000000000000000${deployer.address.slice(-40)}`;
    // console.log(data);return;
    let deploytx = await deploy("SHUI", {
        from: deployer.address,
        args: [],
        log: true,
        proxy: {
            proxyContract: "Proxy1967",
            proxyArgs: ["{implementation}", data],
        },
    });
    console.log(`SHUI proxy deployed at: ${deploytx.address}. Impl at: ${deploytx.implementation}`);
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });