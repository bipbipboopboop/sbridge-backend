export const suitValue = {
  "♣": 1,
  "♦": 2,
  "♥": 3,
  "♠": 4,
} as const;
export type Suit = keyof typeof suitValue;

export const rankValue = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  10: 10,
  9: 9,
  8: 8,
  7: 7,
  6: 6,
  5: 5,
  4: 4,
  3: 3,
  2: 2,
} as const;
export type Rank = keyof typeof rankValue;

export type CardType = {
  suit: Suit;
  rank: Rank;
};

/**
 * A fresh deck of cards used for creating a `Deck` instance
 */
export const CARDS_ARRAY: CardType[] = [
  {
    suit: "♥",
    rank: 2,
  },
  {
    suit: "♥",
    rank: 3,
  },
  {
    suit: "♥",
    rank: 4,
  },
  {
    suit: "♥",
    rank: 5,
  },
  {
    suit: "♥",
    rank: 6,
  },
  {
    suit: "♥",
    rank: 7,
  },
  {
    suit: "♥",
    rank: 8,
  },
  {
    suit: "♥",
    rank: 9,
  },
  {
    suit: "♥",
    rank: 10,
  },
  {
    suit: "♥",
    rank: "J",
  },
  {
    suit: "♥",
    rank: "Q",
  },
  {
    suit: "♥",
    rank: "K",
  },
  {
    suit: "♥",
    rank: "A",
  },
  {
    suit: "♦",
    rank: 2,
  },
  {
    suit: "♦",
    rank: 3,
  },
  {
    suit: "♦",
    rank: 4,
  },
  {
    suit: "♦",
    rank: 5,
  },
  {
    suit: "♦",
    rank: 6,
  },
  {
    suit: "♦",
    rank: 7,
  },
  {
    suit: "♦",
    rank: 8,
  },
  {
    suit: "♦",
    rank: 9,
  },
  {
    suit: "♦",
    rank: 10,
  },
  {
    suit: "♦",
    rank: "J",
  },
  {
    suit: "♦",
    rank: "Q",
  },
  {
    suit: "♦",
    rank: "K",
  },
  {
    suit: "♦",
    rank: "A",
  },
  {
    suit: "♣",
    rank: 2,
  },
  {
    suit: "♣",
    rank: 3,
  },
  {
    suit: "♣",
    rank: 4,
  },
  {
    suit: "♣",
    rank: 5,
  },
  {
    suit: "♣",
    rank: 6,
  },
  {
    suit: "♣",
    rank: 7,
  },
  {
    suit: "♣",
    rank: 8,
  },
  {
    suit: "♣",
    rank: 9,
  },
  {
    suit: "♣",
    rank: 10,
  },
  {
    suit: "♣",
    rank: "J",
  },
  {
    suit: "♣",
    rank: "Q",
  },
  {
    suit: "♣",
    rank: "K",
  },
  {
    suit: "♣",
    rank: "A",
  },
  {
    suit: "♠",
    rank: 2,
  },
  {
    suit: "♠",
    rank: 3,
  },
  {
    suit: "♠",
    rank: 4,
  },
  {
    suit: "♠",
    rank: 5,
  },
  {
    suit: "♠",
    rank: 6,
  },
  {
    suit: "♠",
    rank: 7,
  },
  {
    suit: "♠",
    rank: 8,
  },
  {
    suit: "♠",
    rank: 9,
  },
  {
    suit: "♠",
    rank: 10,
  },
  {
    suit: "♠",
    rank: "J",
  },
  {
    suit: "♠",
    rank: "Q",
  },
  {
    suit: "♠",
    rank: "K",
  },
  {
    suit: "♠",
    rank: "A",
  },
];
