// OFFLINE/SYNC DISABLED: no-op implementations preserving API shape
export const getLastSyncTimestamp = async () => {
  return null;
};

export const setLastSyncTimestamp = async () => {
  return;
};

export const isIncrementalSyncNeeded = async () => {
  return false;
};

export const getNewRecordsSince = async () => {
  return { success: false, newRecords: 0, inserted: 0, totalNewRecords: 0, hasMore: false, nextOffset: 0 };
};

export const incrementalSync = async () => {
  return { success: false, newRecordsFound: 0, newRecordsInserted: 0, lastSyncTime: null, syncType: 'incremental' };
};

export const smartSync = async () => {
  return { success: true, message: 'No sync needed', syncType: 'none' };
};

export const getIncrementalSyncStatus = async () => {
  return { lastSync: null, localCount: 0, needsSync: false, syncType: 'full' };
};
