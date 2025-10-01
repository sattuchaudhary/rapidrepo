// OFFLINE/SYNC DISABLED: background tasks are inert no-ops
export const OFFLINE_SYNC_TASK = 'OFFLINE_SYNC_TASK';

export async function registerOfflineBackgroundSync() {
  return false;
}

export async function unregisterOfflineBackgroundSync() {
  return true;
}




