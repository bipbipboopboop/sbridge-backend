import * as functions from "firebase-functions";
import { DocumentReference } from "firebase-admin/firestore";
import { BiddingState } from "../types/GameType";
import {
  RoomPlayer,
  SimplePlayer,
  SimpleRoomPlayer,
} from "../types/PlayerType";
import { Room } from "../types/RoomType";
import { Bid, PastBid } from "./bids";
import { Deck } from "./cards";
import { getDocRefAndData } from "./utils";
import produce from "immer";

const createSimpleRoomPlayer = (
  player: SimplePlayer,
  position: number
): SimpleRoomPlayer => {
  return {
    playerName: player.playerName,
    playerUID: player.playerUID,
    position,
    numTricksWon: 0,
    numCardsOnHand: 13,
  };
};

/**
 *
 * For populating room.biddingPhase
 * @param room
 * @returns
 */
export const updateSimpleRoomPlayersPosition = (
  room: Room
): SimpleRoomPlayer[] => {
  return room.players.map((plyr, pos) => createSimpleRoomPlayer(plyr, pos));
};

/**
 * For populating roomPlayers
 * @param room
 * @param deck
 * @returns
 */
export const initRoomPlayers = async (
  roomRef: DocumentReference<Room>,
  simpleRoomPlayers: SimpleRoomPlayer[],
  deck: Deck
) => {
  const serializedDeck = deck.cards.map((card) => card.toFirestore());

  simpleRoomPlayers.forEach(async (smPlyr) => {
    const [roomPlayerRef, rmPlyr] = await getDocRefAndData<RoomPlayer>(
      `rooms/${roomRef.id}/roomPlayers/${smPlyr.playerUID}`
    );

    const roomPlayer = rmPlyr as RoomPlayer;
    const startingDeckIndex = smPlyr.position * 13;
    const endDeckIndex = startingDeckIndex + 13;

    await roomPlayerRef.update({
      playerUID: roomPlayer.playerUID,
      playerName: roomPlayer.playerName,
      isReady: roomPlayer.isReady,

      position: smPlyr.position,
      cardsOnHand: serializedDeck.slice(startingDeckIndex, endDeckIndex),
      numTricksWon: 0,
      tricksWon: [],
    });
  });
};

/**
 *
 * Used in castBid.
 * @param biddingPhase
 * @param bidInstance
 * @param context
 * @returns The updated past bids which includes the playerInfo and their latest bid.
 */
export const updatePastBids = (
  biddingPhase: BiddingState,
  bidInstance: Bid,
  context: functions.https.CallableContext
): PastBid[] => {
  const pastBids = produce(biddingPhase.pastBids, (pastBids) => {
    const playersInRoom = biddingPhase.players;
    const thisPlayer = playersInRoom.find(
      (plyr) => plyr.playerUID === context.auth?.uid
    ) as SimpleRoomPlayer;
    pastBids.push({ player: thisPlayer, bid: bidInstance.toBidType() });
  });
  return pastBids;
};
