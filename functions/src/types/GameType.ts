import { BidType, PastBid } from "../utils/bids";
import { CardType, Suit } from "./CardType";
import { SimplePlayer, SimpleRoomPlayer } from "./PlayerType";

export type GameState = {
  turn: number; // An integer to determine which player's turn to play
  startingPosition: number; // For setting z-index in frontend

  players: SimpleRoomPlayer[];

  trumpSuit: Suit | "NT";

  declarerTeam: Team;
  defendingTeam: Team;

  winnerTeam: string | null;

  tableCards: (CardType | null)[];
  firstTableCard: CardType | null;
};

export type BiddingState = {
  turn: number;
  players: SimpleRoomPlayer[];
  currHighestBid: BidType | null;
  currHighestBidder: SimplePlayer | null;
  pastBids: PastBid[];
  numConsecutivePasses: number;
};

export type Team = {
  teamTricksNeeded: number;
  teamTricksWon: number;
  members: string[];
};
