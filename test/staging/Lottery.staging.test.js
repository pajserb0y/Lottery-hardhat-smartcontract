const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Staging Tests", function () {
          let lottery, lotteryEntraceFee, deployer, winnerStartingBalance

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              lottery = await ethers.getContract("Lottery", deployer)
              lotteryEntraceFee = await lottery.getEntranceFee()
          })

          describe("fullfillRandomWords", () => {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  //enter the lottery
                  const startingTimeStamp = await lottery.getLastTimeStamp()
                  const accounts = await ethers.getSigners()
                  console.log("Setting up test...")

                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired")
                          try {
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await lottery.getLastTimeStamp()

                              await expect(lottery.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(lotteryState, 0)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(lotteryEntraceFee).toString()
                              )
                              //because we hace only one player

                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              reject(error)
                          }
                      })
                      //then entering lottery
                      console.log("Entering Lotttery...")
                      const tx = await lottery.enterLottery({ value: lotteryEntraceFee })
                      //and this code WONT complete until our listener has finished listening
                      await tx.wait(1)
                      console.log("Ok, time to wait...")
                      winnerStartingBalance = await accounts[0].getBalance() // this is deployers balance

                      //promise is exited when it is resolved or rejected so this promise will be finished inside Listener
                  })

                  //setup the listener before we enter the lottery
                  //incase the blockchain moves really fast
              })
          })
      })
