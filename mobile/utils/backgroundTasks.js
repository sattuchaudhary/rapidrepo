import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { runHeadlessOfflineSync } from './offlineSync';

export const OFFLINE_SYNC_TASK = 'OFFLINE_SYNC_TASK';

// Define once at module load
TaskManager.defineTask(OFFLINE_SYNC_TASK, async () => {
  try {
    const res = await runHeadlessOfflineSync();
    return res.success
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (_) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerOfflineBackgroundSync() {
  try {
    await BackgroundFetch.registerTaskAsync(OFFLINE_SYNC_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function unregisterOfflineBackgroundSync() {
  try {
    await BackgroundFetch.unregisterTaskAsync(OFFLINE_SYNC_TASK);
    return true;
  } catch (e) {
    return false;
  }
}




