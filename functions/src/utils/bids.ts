import { SimpleRoomPlayer } from "../types/PlayerType";

const suitValue = {
  "♣": 1,
  "♦": 2,
  "♥": 3,
  "♠": 4,
  NT: 5,
} as const;
export type Suit = keyof typeof suitValue;

export type BidValue = 1 | 2 | 3 | 4 | 5 | 6;
export class Bid {
  suit: Suit | null;
  value: BidValue | null;
  constructor(bid: BidType | null) {
    if (!bid) {
      this.suit = null;
      this.value = null;
    } else {
      this.suit = bid.suit;
      this.value = bid.value;
    }
  }

  /**
   *
   * @param other
   * @returns A positive number if this bid is larger and negative if the bid is larger.
   */
  compareTo(other: Bid) {
    if (other.isPass()) {
      return true;
    }
    if (this.isPass()) {
      return false;
    }
    if (this.value === other.value) {
      return suitValue[this.suit as Suit] - suitValue[other.suit as Suit];
    } else {
      return (this.value as BidValue) - (other.value as BidValue);
    }
  }

  /**
   *
   * @param other
   * @returns Returns a `true` if this bid is larger than `other` bid.
   */
  canOutbid(other: Bid) {
    if (other.isPass()) return true;
    return this.compareTo(other) > 0;
  }

  static isBid(object: any) {
    const objectSuit = object?.suit;
    const objectValue = object?.value;

    if (objectSuit === null && objectValue === null) return true;

    const isSuitValid = ["♣", "♦", "♥", "♠", "NT"].indexOf(objectSuit) !== -1;
    const isValueCorrect = [1, 2, 3, 4, 5, 6].indexOf(objectValue) !== -1;
    return isSuitValid && isValueCorrect;
  }

  toBidType(): BidType {
    return {
      suit: this.suit,
      value: this.value,
    };
  }

  isPass() {
    return this.suit === null || this.value === null;
  }
}

export type BidType = {
  suit: Suit | null;
  value: BidValue | null;
};

export type PastBid = {
  player: SimpleRoomPlayer;
  bid: BidType;
};
