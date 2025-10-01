// OFFLINE/SYNC DISABLED: no-op implementations preserving API shape
export const downloadAndConvert = async () => {
  return { success: false, downloaded: 0, inserted: 0, totalRecords: 0, hasMore: false, nextOffset: 0 };
};

export const simpleSync = async () => {
  return { success: false, totalDownloaded: 0, totalInserted: 0, batchesProcessed: 0, extraRecordsCleaned: 0 };
};

export const singleBatchSync = async () => {
  return { success: false, downloaded: 0, inserted: 0, hasMore: false, nextOffset: 0, totalRecords: 0, currentOffset: 0 };
};

export const isSyncNeeded = async () => {
  return false;
};

export const getSyncStatus = async () => {
  return { localCount: 0, needsSync: false, lastSync: null };
};

export const markSyncCompleted = async () => {
  return;
};
