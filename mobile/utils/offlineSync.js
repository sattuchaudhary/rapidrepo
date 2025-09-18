import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from './config';
import { initDatabase, bulkInsertVehicles, resetSeen, markSeenIds, deleteNotSeen, rebuildSearchIndex } from './db';

export const runHeadlessOfflineSync = async () => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) return { success: false, message: 'No token' };

  try {
    // Preflight
    await axios.get(`${getBaseURL()}/api/health`, { timeout: 5000 });

    // Stats
    const statsRes = await axios.get(`${getBaseURL()}/api/tenant/data/offline-stats`, {
      headers: { Authorization: `Bearer ${token}` }, timeout: 15000
    });
    const tenant = statsRes.data?.tenant || 'Unknown';
    const counts = statsRes.data?.counts || {};
    const colKeys = ['two','four','comm'];

    // Init DB
    await initDatabase();
    await resetSeen();

    let inserted = 0;
    const CHUNK_SIZE = 5000;
    for (const key of colKeys) {
      const total = parseInt(counts[key] || 0);
      for (let skip = 0; skip < total; skip += CHUNK_SIZE) {
        try {
          const resp = await axios.get(`${getBaseURL()}/api/tenant/data/offline-chunk`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { col: key, skip, limit: CHUNK_SIZE },
            timeout: 120000
          });
          const items = (resp.data?.data || []).filter(it => it && (it.regNo || it.chassisNo));
          if (items.length === 0) continue;
          inserted += await bulkInsertVehicles(items, { reindex: false });
          await markSeenIds(items.map(it => it._id));
        } catch (_) {
          // skip
        }
      }
    }

    await deleteNotSeen();
    await rebuildSearchIndex();

    const metadata = {
      totalRecords: inserted,
      downloadedAt: new Date().toISOString(),
      tenant
    };
    await SecureStore.setItemAsync('offline_metadata', JSON.stringify(metadata));
    return { success: true, inserted };
  } catch (e) {
    return { success: false, message: e?.message || 'sync failed' };
  }
};




