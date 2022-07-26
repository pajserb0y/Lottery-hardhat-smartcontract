const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Tests", function () {
          let lottery, vrfCoordinatorV2Mock, lotteryEntraceFee, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"]) //deploys every contract from scripts with tag all
              lottery = await ethers.getContract("Lottery", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              lotteryEntraceFee = await lottery.getEntranceFee()
              interval = await lottery.getInterval()
          })

          describe("constructor", function () {
              it("Initializes the lottery correctly", async () => {
                  //ideally one assert per "it"
                  const lotteryState = await lottery.getLotteryState()
                  assert.equal(lotteryState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })

          describe("Enter lottery", function () {
              it("Reverts when you don't pay enough", async function () {
                  await expect(lottery.enterLottery()).to.be.revertedWith(
                      "Lottery__NotEnoughEthEntered"
                  )
              })
              it("Records players when they eneter", async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  const playerFromContract = await lottery.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("Emits event on enter", async function () {
                  await expect(lottery.enterLottery({ value: lotteryEntraceFee })).to.emit(
                      lottery,
                      "LotteryEnter"
                  )
              })
              it("Doesn't allow entrance when lottery is calculating", async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  //we pretend to be ChainLink Keeper
                  await lottery.performUpkeep([])
                  const lotteryState = await lottery.getLotteryState()
                  assert.equal(lotteryState.toString(), "1")
                  await expect(
                      lottery.enterLottery({ value: lotteryEntraceFee })
                  ).to.be.revertedWith("Lottery__NotOpen")
              })
          })
          describe("Check Upkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("returns false if lottery isn't open", async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await lottery.performUpkeep("0x") // same as []
                  const lotteryState = await lottery.getLotteryState()
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert.equal(lotteryState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("return false if enough time hasn't passed", async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("return true if enough time has passed, has palyers and is open", async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", () => {
              it("it can only run if checkUpkeep is true", async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const tx = await lottery.performUpkeep([])
                  assert(tx)
              })
              it("reverts when checkUpkeep is false", async function () {
                  await expect(lottery.performUpkeep([])).to.be.revertedWith(
                      "Lottery__UpkeepNotNeeded"
                  )
              })
              it("updates the raffle state, emits an event, and calls vrf coordinator", async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const txResponse = await lottery.performUpkeep([])
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.events[1].args.requestId //first not zero because in contract vrfCoordinator emits first event and that one is zeroth
                  const lotteryState = await lottery.getLotteryState()
                  assert(requestId.toNumber() > 0)
                  assert(lotteryState.toString() == "1")
              })
          })
          describe("fullfillRandomWords", () => {
              beforeEach(async function () {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
              })
              it("can only be called after perfomeUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
                  ).to.be.revertedWith("nonexistent request")
              })
              //too big test
              it("picks a winner, resets the lottery, and sends money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 //deployer = 0
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedtoLottery = lottery.connect(accounts[i])
                      await accountConnectedtoLottery.enterLottery({ value: lotteryEntraceFee })
                  }
                  const startingTimeStamp = await lottery.getLastTimeStamp()

                  //performUpkeep (mock being chainlink keepers)
                  //fulfillRandomWords( mock being chainlink vrf)
                  //we will have to wait for fulfillRandomWords to be called

                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          //event listener for WinnerPicked, only when event is emmited we can assert results
                          console.log("Found the WinnerPicked event")
                          try {
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const endingTimeStamp = await lottery.getLastTimeStamp()
                              const numPlayers = await lottery.getNumberOfPlayers()
                              const winnerEndingBalance = await accounts[1].getBalance()

                              console.log(`Winner is: ${recentWinner}`)
                              console.log("\n All accounts are: \n")
                              console.log(accounts[0].address)
                              console.log(accounts[1].address)
                              console.log(accounts[2].address)
                              console.log(accounts[3].address)

                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(lotteryState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(
                                      lotteryEntraceFee
                                          .mul(additionalEntrants)
                                          .add(lotteryEntraceFee)
                                  )
                              )
                              resolve()
                          } catch (error) {
                              reject(error)
                          }
                      })
                      // Setting up the listener

                      //below, we will fire the event adn the listener will pick it up, and resolve
                      //this part will not be needed in staging test because we will use (nonlocal )test network which will use real chainlink keepers and vrf
                      const tx = await lottery.performUpkeep([]) //mocking chainlink keepers
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          //this function should emit "WinnerPicked" event
                          //mocking chainlink vrf
                          txReceipt.events[1].args.requestId,
                          lottery.address
                      )
                  })
              })
          })
      })
