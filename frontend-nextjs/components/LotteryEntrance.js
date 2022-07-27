import { useEffect, useState } from "react"
import { useWeb3Contract } from "react-moralis"
import { abi, contractAddress } from "../constants"
import { useMoralis } from "react-moralis"
import { ethers } from "ethers"
import { useNotification } from "web3uikit"

export default function LotteryEntrance() {
    const { chainId: chainIdHex, isWeb3Enabled } = useMoralis() //Header passes all info about metamask wallet to moralis provider which passes in down to all componests
    const chainId = parseInt(chainIdHex)
    const lotteryAddress = chainId in contractAddress ? contractAddress[chainId][0] : null

    const [entranceFee, setEntranceFee] = useState("0") //useState is hook for rerendering when value of variable changes!
    const [numPlayers, setNumPlayers] = useState("0") //useState is hook for rerendering when value of variable changes!
    const [recentWinner, setRecentWinner] = useState("0") //useState is hook for rerendering when value of variable changes!

    const dispatch = useNotification()

    const { runContractFunction: enterLottery } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "enterLottery",
        params: {},
        msgValue: entranceFee,
    })

    const { runContractFunction: getEntranceFee } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "getEntranceFee",
        params: {},
    })

    const { runContractFunction: getNumberOfPlayers } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "getNumberOfPlayers",
        params: {},
    })

    const { runContractFunction: getRecentWinner } = useWeb3Contract({
        abi: abi,
        contractAddress: lotteryAddress,
        functionName: "getRecentWinner",
        params: {},
    })

    async function updateUI() {
        setEntranceFee(
            (
                await getEntranceFee({
                    onError: (error) => console.log(error),
                })
            ).toString()
        )
        setNumPlayers(
            (
                await getNumberOfPlayers({
                    onError: (error) => console.log(error),
                })
            ).toString()
        )
        setRecentWinner(
            (
                await getRecentWinner({
                    onError: (error) => console.log(error),
                })
            ).toString()
        )
    }

    useEffect(() => {
        if (isWeb3Enabled) {
            updateUI()
        }
    }, [isWeb3Enabled])

    const handleSuccess = async function (tx) {
        await tx.wait(1)
        handleNewNotificationTx(tx)
        updateUI()
    }

    const handleNewNotificationTx = function () {
        dispatch({
            type: "info",
            message: "Transaction Complete!",
            title: "Tx Notification",
            position: "topR",
            icon: "bell",
        })
    }

    return (
        <div>
            Hi from lottery entrance
            {lotteryAddress ? (
                <div>
                    <button
                        onClick={async function () {
                            await enterLottery({
                                onSuccess: handleSuccess,
                                onError: (error) => console.log(error),
                            })
                        }}
                    >
                        Enter Lottery
                    </button>
                    <div>
                        Entrance Fee is: {ethers.utils.formatUnits(entranceFee, "ether")} ETH
                    </div>
                    <div>Number of players: {numPlayers}</div>
                    <div>Recent Winner: {recentWinner}</div>
                </div>
            ) : (
                <div>No Lottery address detected!</div>
            )}
        </div>
    )
}
