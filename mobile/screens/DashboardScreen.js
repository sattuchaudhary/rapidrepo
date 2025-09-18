import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity, TextInput, FlatList, Image, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerOfflineBackgroundSync, unregisterOfflineBackgroundSync } from '../index';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { Alert } from 'react-native';
import { initDatabase, clearVehicles, bulkInsertVehicles, countVehicles, searchByRegSuffix, resetSeen, markSeenIds, deleteNotSeen, buildSearchIndex, progressiveSearch, predictNextDigits, isSearchIndexReady, quickLookupByRegSuffix, rebuildSearchIndex } from '../utils/db';
import * as FileSystem from 'expo-file-system';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [agent, setAgent] = useState(null);
  const [searchType, setSearchType] = useState('Chassis');
  const [searchValue, setSearchValue] = useState('');
  const [lastDownloadedAt, setLastDownloadedAt] = useState(null);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [offlineData, setOfflineData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [progressiveResults, setProgressiveResults] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [isOfflineMode, setIsOfflineMode] = useState(true);
  const [bgSyncEnabled, setBgSyncEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('agent');
        if (stored) setAgent(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading agent data:', error);
      }
      
      try {
        // Pre-initialize database for instant searches
        await initDatabase();
        const c = await countVehicles();
        setLocalCount(c);
        console.log(`Database initialized with ${c} records for instant search`);
        
        // Build search index for ultra-fast searches
        if (c > 0) {
          await buildSearchIndex();
          console.log('Search index built for ultra-fast searches');
        }
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    })();
  }, []);

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('agent');
    navigation.replace('Login');
  };

  // Attractive Progress Bar Component
  const ProgressBar = ({ progress, status }) => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Downloading Database</Text>
        <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${progress}%` }
            ]} 
          />
        </View>
      </View>
      <Text style={styles.progressStatus}>{status}</Text>
    </View>
  );

  const downloadOffline = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus('Preparing…');

    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      setDownloading(false);
      Alert.alert('Login required', 'Please login again.');
      return;
    }

    const trySnapshotDownload = async () => {
      try {
        setDownloadStatus('Checking for snapshot…');
        // Try to get snapshot metadata (optional)
        let expectedMd5 = null;
        let expectedSize = null;
        let version = null;
        try {
          const meta = await axios.get(`${getBaseURL()}/api/tenant/data/offline-snapshot-meta`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
          });
          expectedMd5 = meta.data?.md5 || null;
          expectedSize = meta.data?.size || null;
          version = meta.data?.version || null;
        } catch (_) {
          // meta endpoint may not exist; continue
        }

        setDownloadStatus('Downloading snapshot…');
        const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
        try { await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true }); } catch (_) {}
        const tmpPath = `${sqliteDir}/rapidrepo.db.tmp`;
        const finalPath = `${sqliteDir}/rapidrepo.db`;

        // Clean temp if exists
        try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch (_) {}

        const downloadRes = await FileSystem.createDownloadResumable(
          `${getBaseURL()}/api/tenant/data/offline-snapshot`,
          tmpPath,
          { headers: { Authorization: `Bearer ${token}` } }
        ).downloadAsync();

        if (!downloadRes || !downloadRes.uri) throw new Error('Snapshot download failed');

        // Validate size if provided
        if (expectedSize && downloadRes?.headers && downloadRes.headers['Content-Length']) {
          // Some platforms lowercase headers; best-effort validation skipped to avoid platform variance
        }

        // Optional MD5 validation via expo-file-system (compute hash)
        if (expectedMd5) {
          try {
            const md5 = await FileSystem.getInfoAsync(tmpPath, { md5: true });
            if (md5?.md5 && md5.md5.toLowerCase() !== String(expectedMd5).toLowerCase()) {
              throw new Error('Snapshot checksum mismatch');
            }
          } catch (e) {
            // If hashing not supported/failed, treat as failure to avoid corrupted DB
            throw e;
          }
        }

        setDownloadStatus('Finalizing…');
        // Atomically replace existing DB
        try { await FileSystem.deleteAsync(finalPath, { idempotent: true }); } catch (_) {}
        await FileSystem.moveAsync({ from: tmpPath, to: finalPath });

        // Initialize connection and optionally build in-memory search index
        await initDatabase();
        const c = await countVehicles();
        setLocalCount(c);

        try { await buildSearchIndex(); } catch (_) {}

        const metadata = {
          totalRecords: c,
          downloadedAt: new Date().toISOString(),
          tenant: agent?.tenantName || 'Unknown',
          version: version || null,
          source: 'snapshot'
        };
        await SecureStore.setItemAsync('offline_metadata', JSON.stringify(metadata));
        setLastDownloadedAt(new Date(metadata.downloadedAt).toLocaleString());
        setDownloadProgress(100);
        setDownloadStatus('Ready for offline search');
        return true;
      } catch (e) {
        return false;
      }
    };

    try {
      // Try instant snapshot path first
      const ok = await trySnapshotDownload();
      if (ok) {
        // Done instantly
        return;
      }

      // Fallback to legacy chunked approach
      setDownloadProgress(3);
      setDownloadStatus('Snapshot unavailable, using legacy mode…');

      try {
        await axios.get(`${getBaseURL()}/api/health`, { timeout: 5000 });
      } catch (_) {}

      setDownloadStatus('Fetching counts…');
      const statsRes = await axios.get(`${getBaseURL()}/api/tenant/data/offline-stats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });

      const tenant = statsRes.data?.tenant || 'Unknown';
      const counts = statsRes.data?.counts || {};
      const colKeys = ['two','four','comm'];
      const grandTotal = colKeys.reduce((sum, k) => sum + parseInt(counts[k] || 0), 0);
      if (!grandTotal) {
        setDownloadProgress(100);
        setDownloadStatus('No data available');
        return;
      }

      setDownloadStatus('Initializing database…');
      await initDatabase();
      await resetSeen();

      let processed = 0;
      let inserted = 0;
      const CHUNK_SIZE = 5000;

      for (const key of colKeys) {
        const total = parseInt(counts[key] || 0);
        if (!total) continue;
        for (let skip = 0; skip < total; skip += CHUNK_SIZE) {
          const end = Math.min(skip + CHUNK_SIZE, total);
          setDownloadStatus(`Downloading ${key.toUpperCase()} ${skip + 1}-${end} of ${total}…`);
          try {
            const resp = await axios.get(`${getBaseURL()}/api/tenant/data/offline-chunk`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { col: key, skip, limit: CHUNK_SIZE },
              timeout: 120000
            });
            const items = (resp.data?.data || []).filter(it => it && (it.regNo || it.chassisNo));
            if (items.length > 0) {
              inserted += await bulkInsertVehicles(items, { reindex: false });
              await markSeenIds(items.map(it => it._id));
            }
          } catch (e) {
            // Skip this chunk on error, continue
          }
          processed = Math.min(processed + CHUNK_SIZE, grandTotal);
          const progress = Math.max(5, Math.min(95, Math.round((processed / grandTotal) * 100)));
          setDownloadProgress(progress);
        }
      }

      setDownloadStatus('Cleaning up…');
      try { await deleteNotSeen(); } catch (_) {}

      setDownloadStatus('Building search index…');
      try { await rebuildSearchIndex(); } catch (_) {}

      const metadata = {
        totalRecords: inserted,
        downloadedAt: new Date().toISOString(),
        tenant,
        source: 'chunked'
      };
      await SecureStore.setItemAsync('offline_metadata', JSON.stringify(metadata));

      const c = await countVehicles();
      setLocalCount(c);
      setLastDownloadedAt(new Date(metadata.downloadedAt).toLocaleString());

      setDownloadProgress(100);
      setDownloadStatus(`Done. ${inserted} records downloaded.`);
    } catch (error) {
      setDownloadStatus('Failed');
      Alert.alert('Download failed', error?.message || 'Something went wrong.');
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };


  useEffect(() => {
    (async () => {
      try {
        // Load metadata if available
        const metadata = await SecureStore.getItemAsync('offline_metadata');
        if (metadata) {
          const meta = JSON.parse(metadata);
          setLastDownloadedAt(new Date(meta.downloadedAt).toLocaleString());
          console.log(`Data downloaded: ${meta.downloadedAt}, Records: ${meta.totalRecords}`);
        }
        const c = await countVehicles();
        setLocalCount(c);
      } catch (error) {
        console.error('Error loading cached data:', error);
      }
    })();
  }, []);

  const runSearch = async () => {
    if (!/^\d{4}$/.test(String(searchValue))) { 
      setResults([]); 
      return; 
    }
    
    const q = String(searchValue);
    const type = /loan/i.test(searchType) ? 'loan' : /reg/i.test(searchType) ? 'reg' : 'chassis';
    
    if (isOfflineMode) {
      if (!localCount || localCount <= 0) {
        setResults([]);
        return; // No offline data: do nothing, show nothing
      }
      // OFFLINE: navigate instantly with local preloaded data
      let preloaded = [];
      if (isSearchIndexReady()) {
        preloaded = quickLookupByRegSuffix(q) || [];
      }
      navigation.navigate('SearchResults', { 
        q: searchValue, 
        type: 'reg',
        fromDashboard: true,
        instantSearch: true,
        preloadedData: preloaded
      });
      try {
        const rows = await searchByRegSuffix(q);
        setResults(rows);
      } catch (error) {
        console.error('SQLite search error:', error);
        setResults([]);
      }
    } else {
      // ONLINE: navigate immediately, then fetch from server
      navigation.navigate('SearchResults', { 
        q: searchValue, 
        type: 'reg',
        fromDashboard: true,
        instantSearch: true,
        preloadedData: []
      });
      try {
        const token = await SecureStore.getItemAsync('token');
        const res = await axios.get(`${getBaseURL()}/api/tenant/data/search`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { q: searchValue, type, limit: 12 }
        });
        setResults(res.data?.data || []);
      } catch (error) {
        console.error('Online search error:', error);
        setResults([]);
      }
    }
  };

  // Progressive search - starts from 2 digits for background prefetching
  useEffect(() => {
    const value = String(searchValue || '').trim();
    
    if (value.length < 2) {
      setResults([]);
      setProgressiveResults([]);
      setPredictions([]);
      return;
    }
    
    // Start progressive search for 2+ digits in OFFLINE mode only
    if (isOfflineMode && localCount > 0 && value.length >= 2) {
      runProgressiveSearch(value);
    } else {
      setProgressiveResults([]);
      setPredictions([]);
    }
    
    // Navigate to results when 4 digits complete
    if (/^\d{4}$/.test(value)) {
      runSearch();
    }
  }, [searchValue, searchType, isOfflineMode]);

  // Progressive search function
  const runProgressiveSearch = async (input) => {
    try {
      // Get progressive results (instant from cache or partial results)
      const results = await progressiveSearch(input, (finalResults) => {
        // Background search completed - update results
        setProgressiveResults(finalResults);
        console.log(`Progressive search completed for ${input}: ${finalResults.length} results`);
      });
      
      // Show progressive results immediately
      setProgressiveResults(results);
      
      // Get predictions for next digits
      let nextPredictions = [];
      if (input.length < 4) {
        nextPredictions = await predictNextDigits(input);
        setPredictions(nextPredictions);
      } else {
        setPredictions([]);
      }
      
      console.log(`Progressive search for ${input}: ${results.length} results, ${nextPredictions?.length || 0} predictions`);
    } catch (error) {
      console.error('Progressive search error:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top , paddingBottom: insets.bottom }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
          <Text style={styles.menuIcon}>≡</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.appTitle}>RapidRepo</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.link}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Brand + search */}
      <View style={styles.brandBlock}>
        <Image source={require('../assets/icon.png')} style={styles.logoImage} resizeMode="cover" />
        <Text style={styles.orgName}>{agent?.tenantName || 'Your Organization'}</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 0.55 }]}
            value={searchType}
            onChangeText={setSearchType}
            placeholder="Search Type"
          />
          <TextInput
            style={[styles.input, { flex: 0.45 }]}
            value={searchValue}
            onChangeText={(t)=>{
              const digits = String(t || '').replace(/\D/g,'').slice(0,4);
              setSearchValue(digits);
            }}
            placeholder="Enter value"
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={runSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      {downloading && (
        <ProgressBar progress={downloadProgress} status={downloadStatus} />
      )}

      {/* Last downloaded info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoKey}>Last Downloaded DB File:</Text>
        <Text style={styles.infoVal}>{lastDownloadedAt || '—'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoKey}>Offline Records:</Text>
        <Text style={styles.infoVal}>{localCount}</Text>
      </View>

      {/* Progressive Results - Show while typing */}
      {progressiveResults.length > 0 && searchValue.length >= 2 && searchValue.length < 4 && (
        <View style={styles.progressiveContainer}>
          <Text style={styles.progressiveTitle}>
            Found {progressiveResults.length} vehicles starting with "{searchValue}"
          </Text>
          <FlatList
            data={progressiveResults.slice(0, 6)}
            numColumns={2}
            keyExtractor={(item) => String(item._id)}
            contentContainerStyle={{ gap: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <View style={[styles.tile, { flex: 1, backgroundColor: '#E8F4FD' }]}> 
                <View>
                  <Text style={styles.tileTitle}>{item.regNo || '—'}</Text>
                  <Text style={styles.muted}>Chassis: {item.chassisNo || '—'}</Text>
                  <Text style={styles.muted}>Loan: {item.loanNo || '—'}</Text>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* Predictions - Show next likely digits */}
      {predictions.length > 0 && searchValue.length >= 2 && searchValue.length < 4 && (
        <View style={styles.predictionsContainer}>
          <Text style={styles.predictionsTitle}>Next likely digits:</Text>
          <View style={styles.predictionsRow}>
            {predictions.map((pred, index) => (
              <TouchableOpacity
                key={index}
                style={styles.predictionButton}
                onPress={() => setSearchValue(searchValue + pred.digit)}
              >
                <Text style={styles.predictionDigit}>{pred.digit}</Text>
                <Text style={styles.predictionCount}>({pred.count})</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Final Results grid (2 columns) */}
      {results.length > 0 && (
        <FlatList
          data={results}
          numColumns={2}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={{ gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.tile, { flex: 1 }]}> 
              <View>
                <Text style={styles.tileTitle}>{item.regNo || '—'}</Text>
                <Text style={styles.muted}>Chassis: {item.chassisNo || '—'}</Text>
                <Text style={styles.muted}>Loan: {item.loanNo || '—'}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Quick tiles */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.tile}>
          <Text style={styles.tileTitle}>Holds</Text>
          <Text style={styles.tileIcon}>⏸️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile}>
          <Text style={styles.tileTitle}>In Yard</Text>
          <Text style={styles.tileIcon}>📦</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.tile, { width: '100%' }]}>
        <Text style={styles.tileTitle}>Release</Text>
        <Text style={styles.tileIcon}>↩️</Text>
      </TouchableOpacity>

      {/* Bottom bar: left toggle, right download */}
      <View style={styles.bottomBar}>
        <View style={styles.modeGroup}>
          <TouchableOpacity
            style={[styles.modeBtn, isOfflineMode ? styles.modeBtnActive : null]}
            onPress={() => setIsOfflineMode(true)}
          >
            <Text style={[styles.modeBtnText, isOfflineMode ? styles.modeBtnTextActive : null]}>OFFLINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, !isOfflineMode ? styles.modeBtnActive : null]}
            onPress={() => setIsOfflineMode(false)}
          >
            <Text style={[styles.modeBtnText, !isOfflineMode ? styles.modeBtnTextActive : null]}>ONLINE</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.downloadButton} onPress={downloadOffline}>
          <Text style={styles.bottomButtonText}>{downloading ? 'DOWNLOADING…' : '⟳  DOWNLOAD'}</Text>
        </TouchableOpacity>
      </View>

      {/* Simple left drawer */}
      <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerOverlay}>
          <View style={styles.drawer}>
            <Text style={styles.drawerTitle}>Menu</Text>
            <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <Text style={styles.drawerItemText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerOpen(false); navigation.navigate('IDCard'); }}>
              <Text style={styles.drawerItemText}>My ID Card</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={downloadOffline}>
              <Text style={styles.drawerItemText}>Download (Offline)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={async ()=>{
              if (!bgSyncEnabled) {
                const ok = await registerOfflineBackgroundSync();
                setBgSyncEnabled(!!ok);
                Alert.alert(ok ? 'Background sync enabled' : 'Could not enable background sync');
              } else {
                const ok = await unregisterOfflineBackgroundSync();
                setBgSyncEnabled(!ok);
                Alert.alert(ok ? 'Background sync disabled' : 'Could not disable background sync');
              }
            }}>
              <Text style={styles.drawerItemText}>{bgSyncEnabled ? 'Disable Auto Download' : 'Enable Auto Download'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={logout}>
              <Text style={styles.drawerItemText}>Logout</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10121A', paddingHorizontal: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  menuBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  menuIcon: { color: '#fff', fontSize: 22, fontWeight: '900' },
  titleWrap: { flex: 1, alignItems: 'center' },
  appTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  link: { color: '#9ecbff', fontSize: 14 },
  brandBlock: { alignItems: 'center', marginBottom: 10 },
  logoImage: { width: 120, height: 120, borderRadius: 30, marginTop: 2 },
  orgName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 12 },
  searchRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#FFD548', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  searchBtnText: { fontWeight: '800' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoKey: { color: '#333', fontWeight: '700' },
  infoVal: { color: '#555' },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 18, justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row' },
  tileTitle: { color: '#111', fontSize: 18, fontWeight: '700' },
  tileIcon: { fontSize: 22 },
  muted: { color: '#666', fontSize: 12 },
  badge: { backgroundColor: '#222636', color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: '700' },
  bottomButton: { position: 'absolute', bottom: 12, left: 16, right: 16, backgroundColor: '#222636', paddingVertical: 16, borderRadius: 28, alignItems: 'center' },
  bottomButtonText: { color: '#fff', fontWeight: '800', letterSpacing: 1 }
  ,drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)' }
  ,drawer: { width: 260, backgroundColor: '#fff', paddingTop: 40, paddingHorizontal: 16 }
  ,drawerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 }
  ,drawerItem: { paddingVertical: 12 }
  ,drawerItemText: { fontSize: 16, color: '#111' }
  ,progressContainer: { 
    backgroundColor: '#1A1D29', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3748'
  }
  ,progressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  }
  ,progressTitle: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700' 
  }
  ,progressPercent: { 
    color: '#FFD548', 
    fontSize: 18, 
    fontWeight: '800' 
  }
  ,progressBarContainer: { 
    marginBottom: 8 
  }
  ,progressBarBackground: { 
    height: 8, 
    backgroundColor: '#2D3748', 
    borderRadius: 4, 
    overflow: 'hidden' 
  }
  ,progressBarFill: { 
    height: '100%', 
    backgroundColor: '#FFD548', 
    borderRadius: 4,
    shadowColor: '#FFD548',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  }
  ,progressStatus: { 
    color: '#9CA3AF', 
    fontSize: 12, 
    textAlign: 'center' 
  }
  ,progressiveContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9'
  }
  ,progressiveTitle: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  }
  ,predictionsContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B'
  }
  ,predictionsTitle: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  }
  ,predictionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  }
  ,predictionButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 50
  }
  ,predictionDigit: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  }
  ,predictionCount: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.8
  }
  ,bottomBar: { position: 'absolute', bottom: 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }
  ,modeGroup: { flex: 1, flexDirection: 'row', gap: 8 }
  ,downloadButton: { backgroundColor: '#222636', paddingVertical: 16, borderRadius: 28, alignItems: 'center', paddingHorizontal: 18 }
  ,modeRow: undefined
  ,modeBtn: {
    flex: 1,
    backgroundColor: '#1F2433',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3748'
  }
  ,modeBtnActive: {
    backgroundColor: '#FFD548',
    borderColor: '#FFD548'
  }
  ,modeBtnText: {
    color: '#9CA3AF',
    fontWeight: '700'
  }
  ,modeBtnTextActive: {
    color: '#111111'
  }
});


