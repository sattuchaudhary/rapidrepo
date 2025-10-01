// OFFLINE/SYNC DISABLED: no-op implementations preserving API shape
export const downloadAndSaveJson = async () => {
  return { success: false, data: [], downloaded: 0, totalRecords: 0, hasMore: false, nextOffset: 0, batchNumber: 0 };
};

export const convertJsonToSqlite = async () => {
  return 0;
};

export const loadJsonFromFileAndConvert = async () => {
  return { success: false, inserted: 0, totalRecords: 0, batchNumber: 0, downloadedAt: null };
};

export const singleBatchSync = async () => {
  return { success: false, totalDownloaded: 0, totalInserted: 0, batchesProcessed: 0, hasMore: false, nextOffset: 0, syncType: 'single_batch' };
};

export const hybridSync = async () => {
  return { success: false, totalDownloaded: 0, totalInserted: 0, batchesProcessed: 0, extraRecordsCleaned: 0, syncType: 'simple' };
};

export const resetSyncProgress = async () => {
  return { success: true };
};

export const listSavedJsonFiles = async () => {
  return [];
};

export const cleanupOldJsonFiles = async () => {
  return 0;
};
