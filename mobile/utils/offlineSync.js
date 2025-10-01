// OFFLINE/SYNC DISABLED: no-op implementations preserving API shape
export const runOptimizedBulkDownload = async (onProgress = null) => {
  try {
    if (onProgress) {
      try { onProgress({ processed: 0, total: 0, percentage: 0 }); } catch (_) {}
    }
  } catch (_) {}
  return { success: false, message: 'offline sync disabled', inserted: 0 };
};

export const runHeadlessOfflineSync = async () => {
  return { success: false, message: 'offline sync disabled', inserted: 0 };
};

export const runMissingOnlySync = async (onProgress = null) => {
  try {
    if (onProgress) {
      try { onProgress({ processed: 0, total: 0, percentage: 0 }); } catch (_) {}
    }
  } catch (_) {}
  return { success: false, message: 'offline sync disabled', inserted: 0, seen: 0 };
};