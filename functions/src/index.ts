import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { Room } from "./types/RoomType";

import { Player, RoomPlayer } from "./types/PlayerType";
import { getCollectionRef, getDocRefAndData, HTTPError } from "./utils/utils";
import {
  toggleReady as toggleReadyFn,
  startBid as startBidFn,
} from "./handlers/roomHandlers";
import {
  castBid as castBidFn,
  selectTeammate as selectTeammateFn,
  dealCard as dealCardFn,
} from "./handlers/gameHandlers";

import { removePlayerFromReadyUIDs } from "./utils/player_utils";

// // Start writing funcions
// // https://firebase.google.com/docs/functions/typescript
//
admin.initializeApp();

/**
 * Deletes a player if they are logged in.
 */
export const deletePlayer = functions.https.onCall(async (_, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "This player is not authenticated!"
    );
  }
  const playerUID = context.auth.uid;
  const playerRef = admin.firestore().doc(`players/${playerUID}`);

  await leaveRoomFunction(context);
  await playerRef.delete();
  const result = {
    status: "success",
    code: 202,
    message: "Successfully deleted player",
  };
  return result;
});

/**
 * Adds a player instance in Firestore. Used immediately after User authentication.
 * Creates a player instance with the following fields :
 * @field playerName{string}
 * @field uid{string}
 * @field roomID{string}
 * @param playerName{string} Name of the player
 */
export const addPlayer = functions.https.onCall(
  async (playerName: string, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "This player is not authenticated!"
      );
    }
    const playerUID = context.auth.uid;
    const playerRef = admin.firestore().doc(`players/${playerUID}`);
    // console.log({ playerRef: JSON.stringify(playerRef) });
    await playerRef.set({ playerName, uid: playerUID, roomID: null });
    const result = {
      status: "success",
      code: 201,
      message: "Successfully added player",
    };
    return result;
  }
);

/**
 * The the room of the current player.
 */
export const leaveRoom = functions.https.onCall(async (_, context) => {
  await leaveRoomFunction(context);
});

/**
 * A helper function for leaving the room of the current player.
 * Deletes the room immediately if the current player is the only one in the room.
 * If they are the owner, find a new owner for the room.
 * Else, leave immediately.
 * @param context - The interface for metadata for the API as passed to the handler onCall handler.
 */
const leaveRoomFunction = async (context: functions.https.CallableContext) => {
  if (!context.auth)
    throw HTTPError("failed-precondition", "This player is not authenticated!");
  // Check if player is in any room or not
  const [playerRef, plyr] = await getDocRefAndData<Player>(
    `players/${context.auth.uid}`
  );
  const player = plyr as Player;
  const isPlayerInRoom = player.roomID !== null;
  if (!isPlayerInRoom)
    throw HTTPError("failed-precondition", "Player is not room");

  // Check if room exists or not
  const [roomRef, room] = await getDocRefAndData<Room>(
    `rooms/${player.roomID}`
  );
  if (!room) throw HTTPError("not-found", "This room doesn't exist!");

  // Check if player is in this room or not
  const isRoomHasPlayer = room.playersUID.includes(player.uid);
  if (!isRoomHasPlayer)
    throw HTTPError("failed-precondition", "Player not in this room");

  // Update the player
  const updatedPlayer = { ...player, roomID: null } as Player;
  playerRef.update(updatedPlayer);

  // Check what to do after player leaves.
  // If room only has one player. Delete the room
  if (room.currNumPlayers == 1) {
    const [roomPlayerRef] = await getDocRefAndData<RoomPlayer>(
      `rooms/${roomRef.id}/roomPlayers/${player.uid}`
    );

    await roomPlayerRef.delete();
    await roomRef.delete();
    return;
  }

  // Else, the room has multiple players.
  let newRoom: Room;
  newRoom = {
    ...room,
    // Delete this player from room and remove the player from ready array.
    currNumPlayers: room.currNumPlayers - 1,
    currReadyPlayersUID: removePlayerFromReadyUIDs(room, player),
    players: room.players.filter((rmPlyr) => rmPlyr.playerUID !== player.uid),
    playersUID: room.playersUID.filter((rmPlyrUID) => rmPlyrUID !== player.uid),
  };
  // Delete this player from the roomPlayer sub-collection
  const [roomPlayerRef] = await getDocRefAndData<RoomPlayer>(
    `rooms/${roomRef.id}/roomPlayers/${player.uid}`
  );

  await roomPlayerRef.delete();

  // If this player is an owner, make the next player Owner.
  const isPlayerOwner = room.roomOwnerUID === player.uid;
  if (isPlayerOwner) {
    newRoom.roomOwnerUID = newRoom.players[0].playerUID;
    newRoom.roomOwnerName = newRoom.players[0].playerName;
  }
  await roomRef.update(newRoom);
};

/**
 * Create a room and leave the existing one if the player is already in one.
 * The `roomOwner` will be set to the player calling this function.
 */
export const createRoom = functions.https.onCall(async (_, context) => {
  if (!context.auth)
    throw HTTPError("failed-precondition", "This player is not authenticated!");

  const [playerRef, plyr] = await getDocRefAndData<Player>(
    `players/${context.auth.uid}`
  );
  const player = plyr as Player;

  if (player.roomID) await leaveRoomFunction(context);

  const roomsCollectionRef = getCollectionRef<Room>("rooms");
  const newRoom: Room = {
    roomOwnerUID: player.uid,
    roomOwnerName: player.playerName,
    gameStatus: "Not Ready",
    currNumPlayers: 1,
    currReadyPlayersUID: [],
    players: [
      {
        playerName: player.playerName,
        playerUID: player.uid,
      },
    ],
    playersUID: [player.uid],
    biddingPhase: null,
    gameState: null,
  };
  const newRoomRef = await roomsCollectionRef.add(newRoom);

  const [roomPlayerRef] = await getDocRefAndData<RoomPlayer>(
    `rooms/${newRoomRef.id}/roomPlayers/${player.uid}`
  );
  roomPlayerRef.set({
    playerUID: player.uid,
    playerName: player.playerName,
    isReady: false,

    position: null,
    cardsOnHand: null,

    numTricksWon: 0,
    tricksWon: [],
  });

  await playerRef.update({ roomID: newRoomRef.id });
  return { ...newRoom, roomID: newRoomRef.id };
});

/**
 * Join a room with id `roomID`
 * @param roomID{string} ID of the room.
 */
export const joinRoom = functions.https.onCall(
  async (roomID: string, context) => {
    if (!context.auth)
      throw HTTPError(
        "failed-precondition",
        "This player is not authenticated!"
      );

    // Find the desired room, throw error if room is not found
    const [roomRef, room] = await getDocRefAndData<Room>(`rooms/${roomID}`);
    if (!room)
      throw HTTPError("failed-precondition", "This room doesn't exist");

    // Check if room is full, throw error if it is.
    const isRoomFull = room.currNumPlayers >= 4;
    if (isRoomFull)
      throw HTTPError(
        "failed-precondition",
        `Room ${roomID} is full, please try another one`
      );

    // Make the player leave the room if the player is already in a room.
    const [playerRef, plyr] = await getDocRefAndData<Player>(
      `players/${context.auth.uid}`
    );
    const player = plyr as Player;

    if (player.roomID) await leaveRoomFunction(context);

    // Update the room
    let newRoom: Room;
    newRoom = {
      ...room,
      // Add this player into room with roomID.
      currNumPlayers: room.currNumPlayers + 1,
      players: room.players.concat([
        {
          playerName: player.playerName,
          playerUID: player.uid,
        },
      ]),
      playersUID: room.playersUID.concat([player.uid]),
    };
    roomRef.update(newRoom);

    // Add this player from the roomPlayer sub-collection
    const [roomPlayerRef] = await getDocRefAndData<RoomPlayer>(
      `rooms/${roomRef.id}/roomPlayers/${player.uid}`
    );

    await roomPlayerRef.set({
      playerUID: player.uid,
      playerName: player.playerName,
      isReady: false,

      position: null,
      cardsOnHand: null,

      numTricksWon: 0,
      tricksWon: [],
    });

    // Update the player
    playerRef.update({ roomID });
  }
);

export const toggleReady = toggleReadyFn;
export const startBid = startBidFn;
export const castBid = castBidFn;
export const selectTeammate = selectTeammateFn;
export const dealCard = dealCardFn;
