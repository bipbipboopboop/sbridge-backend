import { Suit, Rank, rankValue, CARDS_ARRAY } from "../types/CardType";
export class Card {
  suit: Suit;
  rank: Rank;
  constructor(suit: Suit, rank: Rank) {
    this.suit = suit;
    this.rank = rank;
  }
  toString() {
    return `${this.rank} of ${this.suit}`;
  }
  rankValue() {
    return rankValue[this.rank];
  }

  equals(other: Card) {
    return this.rank === other.rank && this.suit === other.suit;
  }

  compareTo(other: Card) {
    if (this.suit === other.suit)
      return rankValue[this.rank] - rankValue[other.rank];
    return 0;
  }

  toFirestore() {
    return { suit: this.suit, rank: this.rank };
  }
  static fromFirestore(card: { suit: Suit; rank: Rank }) {
    return new Card(card.suit, card.rank);
  }
}

export class Deck {
  cards: Card[];
  constructor() {
    this.cards = CARDS_ARRAY.map((card) => new Card(card.suit, card.rank));
  }

  shuffle() {
    const { cards } = this;
    let m = cards.length,
      i;
    while (m) {
      i = Math.floor(Math.random() * m--);
      [cards[m], cards[i]] = [cards[i], cards[m]];
    }
    return this;
  }
}
