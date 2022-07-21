//Raffle

//Enter the lottery (paying some amount)
//Pick a random winner(verifiably random)
//Winner to be selected every X minuts - completly automated

//Chainlink Oracle -> Randomness, Automated execution (Chainlink Keepers)

//SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

error Lottery__NotEnoughEthEntered();
error Lottery__TransferFailed();

contract Lottery is VRFConsumerBaseV2 {
    //STATE VARIABLES
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    //Lottery variables
    address private s_recentWinner;

    //Events

    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_entranceFee = entranceFee;
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
    }

    function enterLottery() public payable {
        if (msg.value > i_entranceFee) {
            revert Lottery__NotEnoughEthEntered();
        }
        s_players.push(payable(msg.sender));
        //Events
        //always emit events when updating dynamic data structures arrays and mappings
        //Named events with the function name reversed
        emit LotteryEnter(msg.sender);
    }

    //external cheaper then public because this contract is not able to use this function, this function is used
    //bu ChainLink VRF v2
    function requestRandomWinner() external {
        //request random number
        //once we get it do something with it
        // 2 transactions process
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, //gasLane max gas we are willing to pay
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit, //max gas for callback function// fullfiling
            NUM_WORDS
        );
        emit RequestedLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    //View /Pure functions
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }
}
