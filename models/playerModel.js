const mongoose = require("mongoose");
const Room = require("./roomModel");

const Schema = mongoose.Schema;

/**
 * Join a room instance that the `player` instance might be in.
 * @param {string} roomID The id of a room.
 */
const joinRoom = async function (roomID) {
  const roomInstance = await Room.findOne({ roomID });
  if (!roomInstance) {
    throw new Error(`Room ${roomID} is not found! Please try another room!`);
  }

  // A player can only join the room if the room has space left. Check this case first.
  const newRoomHasSpace = roomInstance.players.length < 4;
  console.log(
    `newRoomHasSpace : ${newRoomHasSpace} ? players : ${roomInstance.players}`
  );
  if (!newRoomHasSpace) {
    throw new Error(
      `Room ${roomInstance.roomID} is full! Please try another room!`
    );
  }

  await this.leaveRoom();
  this.room = roomInstance;

  await roomInstance.addPlayer(this);
  await this.save();
  console.log(`player.joinRoom: player = ${this}`);
  console.log(`player.joinRoom: roomInstance = ${roomInstance}`);
};

/**
 * Leave any room that the player might be in.
 */
const leaveRoom = async function () {
  // A player can only leave a room if they are already in a room.
  if (!this.room) {
    console.log(`Player ${this.playerID} is not in any room!`);
    return;
  }
  await this.populate("room");
  console.log(`(${this.playerID})player.leaveRoom: room = ${this.room}`);
  // Remove room from player instance.

  const oldRoom = this.room;
  this.room = null;
  await oldRoom.removePlayer(this);
  await this.save();
  if (oldRoom.players.length === 0)
    await Room.deleteOne({ roomID: oldRoom.roomID });
  console.log(`player.leaveRoom: player = ${this}`);
  console.log(`player.leaveRoom: roomInstance = ${oldRoom}`);
};

/**
 * Returns a player instance if the player exists in the database
 * or create a new player instance if it doesn't exists.
 * @param {object} condition A condition object.
 * @param {object} defaultValue The attributes for creating a player instance if this player isn't in database yet.
 */
const findOneOrCreate = async function (condition, defaultValue) {
  const player = await this.findOne(condition);
  if (player) {
    return player;
  } else {
    return this.create(defaultValue);
  }
};

const toggleReady = async function () {};

/**
 * Make the player deal a card if it's their turn. Throw an error if it's not their turn.
 * @param {string} suit Suit of the card, i.e `C`,`D`,`H`,`S`,`NT` for `Clubs`, `Diamonds`, `Hearts`, `Spades`, and `No Trump` respectively
 * @param {number} cardValue The value of the card. `A` is worth 14 points, `K` 13 points, `2` 2 points
 */
const playCard = async function (suit, cardValue) {};

const playerSchema = new Schema(
  {
    playerID: {
      type: String,
      required: true,
      unique: true,
    },
    name: String,
    room: { type: Schema.Types.ObjectId, ref: "Room" },
    positionToPlay: Number,
    cardsInHand: [{ String, Number }],
  },
  { methods: { joinRoom, leaveRoom, playCard }, statics: { findOneOrCreate } }
);

module.exports = mongoose.model("Player", playerSchema);
