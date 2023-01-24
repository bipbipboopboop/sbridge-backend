import { DocumentReference } from "firebase-admin/firestore";
import { CallableContext } from "firebase-functions/v1/https";

import { Player, RoomPlayer } from "../types/PlayerType";
import { Room } from "../types/RoomType";

import { getDocRefAndData, HTTPError } from "./utils";
import { AuthData } from "firebase-functions/lib/common/providers/tasks";

export const checkIsPlayerHasRoom = async (
  context: CallableContext
): Promise<[DocumentReference<Player>, Player]> => {
  const auth = context.auth as AuthData;
  const [playerRef, plyr] = await getDocRefAndData<Player>(
    `players/${auth.uid}`
  );
  const player = plyr as Player;

  const isPlayerInRoom = player.roomID !== null;
  if (!isPlayerInRoom)
    throw HTTPError("failed-precondition", "Player is not room");

  return [playerRef, player];
};

export const checkIsPlayerRoomExist = async (
  player: Player
): Promise<[DocumentReference<Room>, Room]> => {
  const [roomRef, room] = await getDocRefAndData<Room>(
    `rooms/${player.roomID}`
  );
  if (!room) throw HTTPError("not-found", "This room doesn't exist!");
  return [roomRef, room];
};

export const checkIfRoomContainsPlayer = (room: Room, player: Player) => {
  const isRoomHasPlayer = room.playersUID.includes(player.uid);
  if (!isRoomHasPlayer)
    throw HTTPError("failed-precondition", "Player not in this room");
};

export const updateReadyPlayersUID = async (
  room: Room,
  player: Player,
  roomRef: FirebaseFirestore.DocumentReference<Room>
) => {
  const isPlayerReady = room.currReadyPlayersUID.includes(player.uid);
  if (isPlayerReady) {
    // If player is ready, remove the player
    const currReadyPlayersUID = removePlayerFromReadyUIDs(room, player);
    await roomRef.update({ currReadyPlayersUID });
  } else {
    // If player is not ready, add the player
    const currReadyPlayersUID = addPlayerToReadyUIDs(room, player);
    await roomRef.update({ currReadyPlayersUID });
  }
};

export const togglePlayerReady = async (
  roomPlayerRef: FirebaseFirestore.DocumentReference<RoomPlayer>,
  roomPlayer: RoomPlayer | null
) => {
  await roomPlayerRef.update({ isReady: !roomPlayer?.isReady });
};

/**
 *
 * @param room
 * @param player
 * @returns The currReadyPlayersUID array without `player` in it.
 */
export const removePlayerFromReadyUIDs = (room: Room, player: Player) =>
  room.currReadyPlayersUID.filter((plyrUID) => plyrUID !== player.uid);

/**
 *
 * @param room
 * @param player
 * @returns The currReadyPlayersUID array with the `player` in it.
 */
export const addPlayerToReadyUIDs = (room: Room, player: Player) => {
  const isPlayerInRoom = room.currReadyPlayersUID.includes(player.uid);
  return !isPlayerInRoom
    ? room.currReadyPlayersUID.concat([player.uid])
    : room.currReadyPlayersUID;
};

export const checkPlayerAccessPrivilege = async (context: CallableContext) => {
  if (!context.auth)
    throw HTTPError("failed-precondition", "This player is not authenticated!");

  // Throw Error if player has no room. Return player if otherwise
  const [playerRef, player] = await checkIsPlayerHasRoom(context);

  // Defensive code, player's room should exist if player is in a room.
  // Throw Error if player's room doesn't exist. Return player's room if otherwise
  const [roomRef, room] = await checkIsPlayerRoomExist(player);

  // Defensive code, player's room should contain player.
  // Throw error if player's room doesn't contain player.
  checkIfRoomContainsPlayer(room, player);

  return { playerRef, player, roomRef, room };
};
