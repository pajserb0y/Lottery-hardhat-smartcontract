require("dotenv").config()
const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESSES_FILE = "./frontend-nextjs/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "./frontend-nextjs/constants/abi.json"

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating front end...")
        updateContractAdresses()
        updateAbi()
    }
}

async function updateContractAdresses() {
    const lottery = await ethers.getContract("Lottery")
    const currentAdresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
    const chainId = network.config.chainId.toString()

    if (chainId in currentAdresses) {
        if (!currentAdresses[chainId].includes(lottery.address)) {
            currentAdresses[chainId].push(lottery.address)
        }
    } else {
        currentAdresses[chainId] = [lottery.address]
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAdresses))
    console.log("written Address")
}

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery")
    fs.writeFileSync(FRONT_END_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json))
    console.log("written Abi")
}

module.exports.tags = ["all", "frontend"]
