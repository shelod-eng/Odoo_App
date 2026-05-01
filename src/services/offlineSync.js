import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { submitTravelLogToOdoo } from './modules/travelLogModule';

const QUEUE_KEY = '@automation_odoo_offline_queue';

export const getQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('[OfflineSync] Could not read queue:', error);
    return [];
  }
};

const saveQueue = (queue) =>
  AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

export const enqueueOdooOperation = async (operation, payload) => {
  const queue = await getQueue();
  const op = {
    id: `${operation}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    operation,
    payload,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  queue.push(op);
  await saveQueue(queue);
  console.log(`[OfflineSync] Queued Odoo operation ${operation}`);
  return op;
};

export const enqueueOperation = async (type, collectionPath, data, docId = null) => {
  if (collectionPath === 'travelLogs') {
    return enqueueOdooOperation('travel.log.submit', data);
  }

  return enqueueOdooOperation(`${collectionPath}.${type}`, {
    collectionPath,
    docId,
    data,
  });
};

const runOperation = async (op) => {
  if (op.operation === 'travel.log.submit') {
    return submitTravelLogToOdoo(op.payload);
  }

  throw new Error(`Unsupported offline Odoo operation: ${op.operation}`);
};

export const flushQueue = async () => {
  const queue = await getQueue();
  if (!queue.length) return;

  const remaining = [];

  for (const op of queue) {
    try {
      await runOperation(op);
      console.log(`[OfflineSync] Synced ${op.operation}`);
    } catch (error) {
      console.error(`[OfflineSync] Failed ${op.operation}:`, error.message);
      remaining.push({
        ...op,
        attempts: (op.attempts || 0) + 1,
        lastError: error.message,
        lastAttemptAt: new Date().toISOString(),
      });
    }
  }

  await saveQueue(remaining);
};

let unsubscribeSyncListener = null;

export const startSyncListener = () => {
  if (unsubscribeSyncListener) return unsubscribeSyncListener;

  unsubscribeSyncListener = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      flushQueue();
    }
  });

  return unsubscribeSyncListener;
};

export const stopSyncListener = () => {
  if (unsubscribeSyncListener) {
    unsubscribeSyncListener();
    unsubscribeSyncListener = null;
  }
};

export const clearQueue = () => AsyncStorage.removeItem(QUEUE_KEY);
