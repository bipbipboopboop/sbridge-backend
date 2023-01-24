import * as functions from "firebase-functions";

import { DocumentReference } from "firebase-admin/firestore";

import { checkPlayerAccessPrivilege } from "../utils/player_utils";
import { getDocRefAndData, HTTPError } from "../utils/utils";
import { Bid, BidType } from "../utils/bids";
import { updatePastBids } from "../utils/game_utils";

import { Room } from "../types/RoomType";
import { BiddingState, GameState, Team } from "../types/GameType";
import { CardType, Suit } from "../types/CardType";
import {
  Player,
  RoomPlayer,
  SimplePlayer,
  SimpleRoomPlayer,
} from "../types/PlayerType";

import produce from "immer";

import { Trick } from "../utils/tricks";

export const castBid = functions.https.onCall(async (bid: BidType, context) => {
  if (!context.auth)
    throw HTTPError("failed-precondition", "This player is not authenticated!");

  // Check whether the player is in the room
  const { roomRef, room } = await checkPlayerAccessPrivilege(context); // TODO : Change function name to checkIsPlayerInRoom

  // Check if the game is in bidding stage
  const isBiddingPhase = room.gameStatus === "Bidding";
  if (!isBiddingPhase)
    throw HTTPError("failed-precondition", "The game is not in bidding phase!");
  const biddingPhase = room.biddingPhase as BiddingState;

  // Check if it's the player's turn to bid.
  const isPlayerTurn =
    biddingPhase.turn ===
    biddingPhase.players.find((plyr) => plyr.playerUID === context.auth?.uid)
      ?.position;

  if (!isPlayerTurn)
    throw HTTPError("failed-precondition", "It's not your turn yet!");

  // Check if incoming bid is valid
  const isBidValid = Bid.isBid(bid);
  if (!isBidValid) throw HTTPError("failed-precondition", "Bid is not valid!");

  const bidInstance = new Bid(bid);

  // If the incoming bid is a pass.
  if (bidInstance.isPass()) {
    const isBidJustStarted = !biddingPhase.currHighestBid;

    // If the bid just started(First round of bidding) and 3 persons already passed.
    // This player's pass will make it a 4 consecutive pass and the game resets.
    const allPlayersPassAtStart =
      biddingPhase.numConsecutivePasses === 3 && isBidJustStarted;

    if (allPlayersPassAtStart) {
      // resetBid()
      return;
    }

    // If there are already 2 consecutive passes and this player also passes.
    // There will be 3 consecutive passes, the game begins.
    const isThreeConsecutivePass =
      biddingPhase.currHighestBid && biddingPhase.numConsecutivePasses === 2;

    if (isThreeConsecutivePass) {
      await startGame(roomRef, room, context);
      return;
    }

    // Else, it's a normal pass.
    // Update the players turn and numConsecutivePasses then return immediately
    const updatedBiddingPhase: BiddingState = {
      turn: (biddingPhase.turn + 1) % 4,
      players: biddingPhase.players,
      currHighestBid: biddingPhase.currHighestBid,
      currHighestBidder: biddingPhase.currHighestBidder,
      pastBids: updatePastBids(biddingPhase, bidInstance, context),
      numConsecutivePasses: biddingPhase.numConsecutivePasses + 1,
    };

    await roomRef.update({ biddingPhase: updatedBiddingPhase });
    return;
  }

  // Check if bid is larger than currHighestBid
  const currHighestBid = new Bid(biddingPhase.currHighestBid);

  const isOutBiddable = bidInstance.canOutbid(currHighestBid);
  if (!isOutBiddable)
    throw HTTPError("failed-precondition", "Your bid is too small!");

  const newHighestBid = bidInstance.toBidType();

  const updatedBiddingPhase: BiddingState = {
    turn: (biddingPhase.turn + 1) % 4,
    players: biddingPhase.players,
    currHighestBid: newHighestBid,
    currHighestBidder: room.players.find(
      (plyr) => plyr.playerUID === context.auth?.uid
    ) as SimplePlayer,
    pastBids: updatePastBids(biddingPhase, bidInstance, context),
    numConsecutivePasses: 0,
  };

  await roomRef.update({ biddingPhase: updatedBiddingPhase });
});

const startGame = async (
  roomRef: DocumentReference<Room>,
  room: Room,
  context: functions.https.CallableContext
) => {
  const updatedRoom = produce(room, (room) => {
    room.gameStatus = "Choosing Teammate";

    room.biddingPhase = room.biddingPhase as BiddingState;
    room.biddingPhase.numConsecutivePasses++;
    room.biddingPhase.pastBids = updatePastBids(
      room.biddingPhase,
      new Bid(null),
      context
    );
    room.biddingPhase.turn = (room.biddingPhase.turn + 1) % 4;
  });

  await roomRef.update(updatedRoom);
};

export const selectTeammate = functions.https.onCall(
  async (card: CardType, context) => {
    const { player, room, roomRef } = await checkPlayerAccessPrivilege(context);

    const roomPlayer = (
      await getDocRefAndData<RoomPlayer>(
        `rooms/${roomRef.id}/roomPlayers/${player.uid}`
      )
    )[1];

    const isChoosingTeammateState = room.gameStatus === "Choosing Teammate";
    if (!isChoosingTeammateState)
      throw HTTPError(
        "failed-precondition",
        `The game status is currently ${room.gameStatus}`
      );

    const isPlayerBidWinner = room.biddingPhase?.turn === roomPlayer?.position;

    if (!isPlayerBidWinner)
      throw HTTPError(
        "failed-precondition",
        `You do not have the permission to choose your teammate`
      );

    // Check whether the bid winner has picked a card that they own.
    // The bid winner can only pick a card that they don't own(otherwise, they'd be calling themselves as their teammates)
    const isTargetValid =
      (roomPlayer?.cardsOnHand?.filter(
        (cardOnHand) =>
          cardOnHand.rank === card.rank && cardOnHand.suit === card.suit
      )?.length as number) === 0;

    if (!isTargetValid)
      throw HTTPError("failed-precondition", "You cannot pick your own card!");

    const teammate = await getTeammate(room, roomRef, card);

    const declarerTeamMembers = room.playersUID.filter((uid) =>
      [player.uid, teammate?.playerUID].includes(uid)
    );

    const defendingTeamMembers = room.playersUID.filter(
      (uid) => ![player.uid, teammate?.playerUID].includes(uid)
    );

    const declarerTeam: Team = {
      members: declarerTeamMembers,
      teamTricksNeeded:
        (room.biddingPhase?.currHighestBid?.value as number) + 6,
      teamTricksWon: 0,
    };

    const defendingTeam: Team = {
      members: defendingTeamMembers,
      teamTricksNeeded: 13 - declarerTeam.teamTricksNeeded,
      teamTricksWon: 0,
    };

    const gameState: GameState = {
      turn: ((roomPlayer?.position as number) + 1) % 4, // The person next to Bid Winner should start the game.
      startingPosition: ((roomPlayer?.position as number) + 1) % 4,
      players: room.biddingPhase?.players as SimpleRoomPlayer[],
      trumpSuit: room.biddingPhase?.currHighestBid?.suit as Suit,
      declarerTeam,
      defendingTeam,
      winnerTeam: null,
      tableCards: [null, null, null, null],
      firstTableCard: null,
    };
    const updatedRoom = produce(room, (room) => {
      // room.biddingPhase = null; // TODO: Check frontend to see if we should make this null
      room.gameState = gameState;
      room.gameStatus = "Taking Tricks";
    });

    roomRef.update(updatedRoom);
  }
);

const getTeammate = async (
  room: Room,
  roomRef: DocumentReference<Room>,
  card: CardType
) => {
  for (const index in room.playersUID) {
    const uid = room.playersUID[index];
    const roomPlayer = (
      await getDocRefAndData<RoomPlayer>(
        `rooms/${roomRef.id}/roomPlayers/${uid}`
      )
    )[1];

    const isPlayerOwnerOfCard =
      (roomPlayer?.cardsOnHand?.filter(
        (handCard) => handCard.rank === card.rank && handCard.suit === card.suit
      ).length as number) > 0;

    if (isPlayerOwnerOfCard) {
      return roomPlayer;
    }
  }
  return null;
};

export const dealCard = functions.https.onCall(
  async (card: CardType, context) => {
    const { player, room, roomRef } = await checkPlayerAccessPrivilege(context);
    const [roomPlayerRef, roomPlayer] = await getDocRefAndData<RoomPlayer>(
      `rooms/${roomRef.id}/roomPlayers/${player.uid}`
    );

    checkCanPlayerDeal(room, player);
    const gameState = room.gameState as GameState;
    checkIsValidDeal(gameState, card, roomPlayer);

    // If the code reaches here. Player has passed all checks and can deal this card.
    const playerTurnInThisTrick = getPlayerTrickTakingPosition(room);
    const playerPosition = roomPlayer?.position as number;

    const isPlayerFirstToTake = playerTurnInThisTrick === 0;
    const isPlayerLastToTake = playerTurnInThisTrick === 3;

    console.log({ playerPosition, playerTurnInThisTrick, isPlayerLastToTake });

    // If player is the last to deal. Get the winner

    if (isPlayerLastToTake) {
      const updatedGameState = produce(gameState, (gameState) => {
        gameState.tableCards[playerPosition] = card;
        gameState.players[playerPosition].numCardsOnHand--;
      });
      const updatedRoomPlayer = produce(
        roomPlayer as RoomPlayer,
        (roomPlayer) => {
          roomPlayer.cardsOnHand = removeCardFromHand(
            card,
            roomPlayer.cardsOnHand as CardType[]
          );
        }
      );
      await roomPlayerRef.update(updatedRoomPlayer);

      const {
        resetedGameState,
        winnerRoomPlayer,
        winnerRoomPlayerRef,
        trickWon,
      } = await processTrick(updatedGameState, roomRef.id);

      const updatedWinnerRoomPlayer = produce(
        winnerRoomPlayer as RoomPlayer,
        (winnerRoomPlayer) => {
          // winnerRoomPlayer.tricksWon = winnerRoomPlayer.tricksWon.concat([
          //   trickWon,
          // ] as [CardType[]]);
          winnerRoomPlayer.numTricksWon++;
        }
      );

      console.log("Last player");
      console.log({
        updatedGameState,
        resetedGameState,
        winnerRoomPlayer,
        trickWon,
        updatedWinnerRoomPlayer,
      });

      await winnerRoomPlayerRef.update(updatedWinnerRoomPlayer);
      await roomRef.update({ gameState: resetedGameState });

      return;
    }

    if (isPlayerFirstToTake) {
      const updatedGameState = produce(gameState, (gameState) => {
        gameState.firstTableCard = card;
        gameState.tableCards[playerPosition] = card;
        gameState.turn = (gameState.turn + 1) % 4;
        gameState.players[playerPosition].numCardsOnHand--;
      });

      const updatedRoomPlayer = produce(
        roomPlayer as RoomPlayer,
        (roomPlayer) => {
          roomPlayer.cardsOnHand = removeCardFromHand(
            card,
            roomPlayer.cardsOnHand as CardType[]
          );
        }
      );

      await roomRef.update({ gameState: updatedGameState });
      await roomPlayerRef.update(updatedRoomPlayer);

      console.log("First Player");
      console.log({ updatedGameState, updatedRoomPlayer });
      return;
    }

    const updatedGameState = produce(gameState, (gameState) => {
      gameState.tableCards[playerPosition] = card;
      gameState.turn = (gameState.turn + 1) % 4;
      gameState.players[playerPosition].numCardsOnHand--;
    });
    const updatedRoomPlayer = produce(
      roomPlayer as RoomPlayer,
      (roomPlayer) => {
        roomPlayer.cardsOnHand = removeCardFromHand(
          card,
          roomPlayer.cardsOnHand as CardType[]
        );
      }
    );

    console.log({
      updatedGameState,
      updatedRoomPlayer,
    });

    await roomRef.update({ gameState: updatedGameState });
    await roomPlayerRef.update(updatedRoomPlayer);

    console.log("2nd or 3rd");
    console.log({ updatedGameState, updatedRoomPlayer });
  }
);

/**
 * Checks the following:
 * 1) whether the game allows taking tricks.
 * 2) whether it's the player's turn to take this trick.
 * 3) whether the player has dealt any cards in this trick before
 * @param room
 * @param player
 * @param roomPlayer
 * @param desiredCard
 */
const checkCanPlayerDeal = (room: Room, player: Player) => {
  const gameState = room?.gameState as GameState;

  // Check if the game is in Trick Taking stage
  const isTakingTricksState = room.gameStatus === "Taking Tricks";
  if (!isTakingTricksState)
    throw HTTPError("failed-precondition", "You cannot deal in this stage");

  // Check if it's this player's turn to deal card
  const playerPosition = gameState.players.find(
    (plyr) => plyr.playerUID === player.uid
  )?.position;

  const isPlayerTurn = gameState.turn === playerPosition;

  if (!isPlayerTurn)
    throw HTTPError("failed-precondition", "It's not your turn yet!");

  // Check if this player has dealt a card before or not
  const cardDealtByPlayer = gameState.tableCards.at(playerPosition);
  if (cardDealtByPlayer)
    throw HTTPError("already-exists", "You've already dealt a card before!");
};

/**
 * Checks the following:
 * 1) This player owns `desiredCard`
 * 2) This player hasn't dealt any card yet
 * 3) This player has followed the suit of the this trick when they have any card of this suit.
 * @param gameState
 * @param desiredCard
 * @param roomPlayer
 */
const checkIsValidDeal = (
  gameState: GameState,
  desiredCard: CardType,
  roomPlayer: RoomPlayer | null
) => {
  // Check if the player cheated by not playing firstCard.suit when they have cards of firstCard.suit
  const numCardsOnTable = gameState.tableCards.filter(
    (card) => card !== null
  ).length;

  const isFirstToPlay = numCardsOnTable === 0;
  const isPlayerWithholdingCard =
    (roomPlayer?.cardsOnHand?.filter(
      (card) => card.suit === gameState.firstTableCard?.suit
    ).length as number) > 0;

  const isDealtCardSuitEqualFirstCardSuit =
    desiredCard.suit === gameState.firstTableCard?.suit;
  const isPlayerCheatingSuit =
    !isDealtCardSuitEqualFirstCardSuit && isPlayerWithholdingCard;

  const isPlayerOwnerOfCard =
    (roomPlayer?.cardsOnHand?.filter(
      (cardOnHand) =>
        cardOnHand.suit === desiredCard.suit &&
        cardOnHand.rank === desiredCard.rank
    ).length as number) > 0;

  const isValidDeal =
    isPlayerOwnerOfCard && (isFirstToPlay || !isPlayerCheatingSuit);

  if (!isValidDeal)
    throw HTTPError("permission-denied", "Your deal is not valid");
};

const getPlayerTrickTakingPosition = (room: Room) => {
  return room.gameState?.tableCards.filter((tableCard) => tableCard !== null)
    .length as number;
};

const processTrick = async (gameState: GameState, roomID: string) => {
  const trick = new Trick(
    gameState.firstTableCard as CardType,
    gameState.tableCards,
    gameState.trumpSuit
  );

  const winnerPos = trick.getWinnerPos();
  const winner = gameState.players[winnerPos];
  const trickWonTeam: "declarerTeam" | "defendingTeam" =
    gameState.declarerTeam.members.includes(winner.playerUID)
      ? "declarerTeam"
      : "defendingTeam";
  const trickWon = gameState.tableCards;

  let resetedGameState: GameState;
  if (trickWonTeam === "declarerTeam") {
    resetedGameState = produce(gameState, (gameState) => {
      gameState.firstTableCard = null;
      gameState.declarerTeam.teamTricksWon++;
      gameState.tableCards = [null, null, null, null];
      gameState.turn = winner.position;
    });
  } else {
    resetedGameState = produce(gameState, (gameState) => {
      gameState.firstTableCard = null;
      gameState.defendingTeam.teamTricksWon++;
      gameState.tableCards = [null, null, null, null];
      gameState.turn = winner.position;
    });
  }
  const [winnerRoomPlayerRef, winnerRoomPlayer] =
    await getDocRefAndData<RoomPlayer>(
      `rooms/${roomID}/roomPlayers/${winner.playerUID}`
    );

  return { resetedGameState, winnerRoomPlayerRef, winnerRoomPlayer, trickWon };
};

const removeCardFromHand = (targetCard: CardType, cardOnHand: CardType[]) => {
  return cardOnHand.filter(
    (card) => !(card.rank === targetCard.rank && card.suit === targetCard.suit)
  );
};
