import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import {
  DocumentReference,
  CollectionReference,
} from "firebase-admin/firestore";

const getDocRefAndData = async <T>(
  path: string
): Promise<[ref: DocumentReference<T>, data: T | null]> => {
  const ref = admin.firestore().doc(path) as DocumentReference<T>;
  const data = (await ref.get()).data() as T | null;
  return [ref, data];
};

const getCollectionRef = <T>(path: string) => {
  const ref = admin.firestore().collection(path) as CollectionReference<T>;
  return ref;
};

const HTTPError = (
  errorCode: functions.https.FunctionsErrorCode,
  msg: string
) => {
  return new functions.https.HttpsError(errorCode, msg);
};

export { getDocRefAndData, getCollectionRef, HTTPError };
