import { CardType } from "./CardType";

// For players collection
export type Player = {
  playerName: string;
  roomID: string | null;
  uid: string;
};

// For room docs : room.players
export type SimplePlayer = {
  playerName: string;
  playerUID: string;
};

// For room.biddingPhase and room.gamePhase
export type SimpleRoomPlayer = {
  playerUID: string;
  playerName: string;

  position: number;
  numCardsOnHand: number;

  numTricksWon: number;
};

// For roomPlayers sub-collection

export type RoomPlayer = {
  playerUID: string;
  playerName: string;
  isReady: boolean;

  position: number | null;
  cardsOnHand: CardType[] | null;

  numTricksWon: number;
  tricksWon: CardType[][];
};
