import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, Modal, TouchableOpacity, TextInput, StatusBar, ScrollView, InteractionManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import { searchByRegSuffix, searchByChassis, initDatabase, buildSearchIndex as buildDbSearchIndex } from '../utils/db';

export default function SearchResultsScreen({ route, navigation }) {
  const { q = '', preloadedData = null, fromDashboard = false, instantSearch = false } = route.params || {};
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(Array.isArray(preloadedData) ? preloadedData : []);
  const [error, setError] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [chassisInput, setChassisInput] = useState('');
  const [regSuffixInput, setRegSuffixInput] = useState(q);
  const [offlineData, setOfflineData] = useState(null);
  
  const [searchCache, setSearchCache] = useState(new Map());
  const [searchIndex, setSearchIndex] = useState(new Map());
  const [azMode, setAzMode] = useState(true);

  // Debug function to compare search results
  const debugSearchResults = (qVal, filtered, unique) => {
    console.log(`=== SEARCH DEBUG for ${qVal} ===`);
    console.log(`Total offline data: ${offlineData?.length || 0}`);
    console.log(`Filtered results: ${filtered.length}`);
    console.log(`Unique results: ${unique.length}`);
    
    // Show first few results for debugging
    if (filtered.length > 0) {
      console.log('First 5 filtered results:');
      filtered.slice(0, 5).forEach((item, i) => {
        console.log(`${i+1}. RegNo: ${item.regNo}, Chassis: ${item.chassisNo}`);
      });
    }
    
    if (unique.length > 0) {
      console.log('First 5 unique results:');
      unique.slice(0, 5).forEach((item, i) => {
        console.log(`${i+1}. RegNo: ${item.regNo}, Chassis: ${item.chassisNo}`);
      });
    }
    console.log('=== END DEBUG ===');
  };

  // Build search index for instant lookups (local in-screen)
  const buildLocalSearchIndex = (data) => {
    const regIndex = new Map();
    const chassisIndex = new Map();
    
    (Array.isArray(data) ? data : []).forEach((item, index) => {
      // Index by registration number suffix (last 4 digits)
      const regNo = String(item.regNo || '').trim();
      if (regNo.length >= 4) {
        const suffix = regNo.slice(-4);
        if (!regIndex.has(suffix)) regIndex.set(suffix, []);
        regIndex.get(suffix).push(item);
      }
      
      // Index by chassis number
      const chassisNo = String(item.chassisNo || '').trim().toLowerCase();
      if (chassisNo.length >= 3) {
        // Index by first 3 characters for partial matches
        const prefix = chassisNo.slice(0, 3);
        if (!chassisIndex.has(prefix)) chassisIndex.set(prefix, []);
        chassisIndex.get(prefix).push(item);
      }
    });
    
    setSearchIndex({ regIndex, chassisIndex });
    console.log(`Search index built: ${regIndex.size} reg suffixes, ${chassisIndex.size} chassis prefixes`);
  };

  const runSearch = async (qVal, type, showLoading = false) => {
    try {
      // Check cache first for INSTANT results (no loading state)
      const cacheKey = `${qVal}_${type}`;
      if (searchCache.has(cacheKey)) {
        const cachedResults = searchCache.get(cacheKey);
        console.log(`Using cached results: ${cachedResults.length} items`);
        setResults(cachedResults);
        setError('');
        return; // No loading state for cached results
      }
      
      // Only show loading if explicitly requested (for online searches)
      if (showLoading) {
        setLoading(true); 
      }
      setError('');
      
      // PRIORITY 1: Use SQLite if available (FAST - NO LOADING)
      if (type === 'reg' && /^\d{4}$/.test(qVal)) {
        try {
          const rows = await searchByRegSuffix(qVal);
          if (rows.length > 0) {
            setResults(rows);
            setLoading(false);
            // Cache the results for instant future access
            setSearchCache(prev => {
              const newCache = new Map(prev);
              newCache.set(cacheKey, rows);
              if (newCache.size > 200) { // Increased cache size
                const firstKey = newCache.keys().next().value;
                newCache.delete(firstKey);
              }
              return newCache;
            });
            return;
          }
        } catch (error) {
          console.error('SQLite reg search error:', error);
        }
      }
      
      if (type === 'chassis' && String(qVal).trim().length >= 3) {
        try {
          const rows = await searchByChassis(qVal);
          if (rows.length > 0) {
            setResults(rows);
            setLoading(false);
            // Cache the results for instant future access
            setSearchCache(prev => {
              const newCache = new Map(prev);
              newCache.set(cacheKey, rows);
              if (newCache.size > 200) { // Increased cache size
                const firstKey = newCache.keys().next().value;
                newCache.delete(firstKey);
              }
              return newCache;
            });
            return;
          }
        } catch (error) {
          console.error('SQLite chassis search error:', error);
        }
      }

      // PRIORITY 2: Use in-memory offline dump if present
      if (offlineData && Array.isArray(offlineData) && offlineData.length > 0) {
        let filtered = [];
        console.log(`Searching in ${offlineData.length} offline records for: ${qVal} (type: ${type})`);
        
        // Use same search logic as Dashboard for consistency
        if (type === 'reg' && /^\d{4}$/.test(qVal)) {
          // Direct search for 4-digit registration - EXACT same as Dashboard
          const searchTerm = String(qVal).toLowerCase();
          for (let i = 0; i < offlineData.length; i++) {
            const item = offlineData[i];
            const regNo = String(item.regNo || '').toLowerCase();
            const chassisNo = String(item.chassisNo || '').toLowerCase();
            
            // Check if search term matches end of regNo or chassisNo (EXACT same as Dashboard)
            if (regNo.endsWith(searchTerm) || chassisNo.includes(searchTerm)) {
              filtered.push(item);
            }
          }
        } else if (type === 'chassis' && qVal.length >= 3) {
          // Direct search for chassis
          const needle = String(qVal).trim().toLowerCase();
          for (let i = 0; i < offlineData.length; i++) {
            const item = offlineData[i];
            const chassisNo = String(item.chassisNo || '').toLowerCase();
            
            if (chassisNo.includes(needle)) {
              filtered.push(item);
            }
          }
        } else {
          // Fallback to direct search for other cases
          if (type === 'reg') {
            const tail = new RegExp(String(qVal) + '$', 'i');
            filtered = offlineData.filter(it => tail.test(String(it.regNo)));
          } else if (type === 'chassis') {
            const needle = String(qVal).trim().toLowerCase();
            filtered = offlineData.filter(it => String(it.chassisNo || '').toLowerCase().includes(needle));
          } else {
            // For auto type, search both
            const tail = new RegExp(String(qVal) + '$', 'i');
            const needle = String(qVal).trim().toLowerCase();
            filtered = offlineData.filter(it => 
              tail.test(String(it.regNo)) || 
              String(it.chassisNo || '').toLowerCase().includes(needle)
            );
          }
        }
        
        // Deduplicate by normalized regNo
        const seen = new Set();
        const unique = [];
        for (const it of filtered) {
          const k = String(it.regNo || '').trim().toUpperCase();
          if (!k || seen.has(k)) continue;
          seen.add(k);
          unique.push(it);
        }
        
        // Cache results for future instant access
        setSearchCache(prev => {
          const newCache = new Map(prev);
          newCache.set(cacheKey, unique);
          if (newCache.size > 100) { // Increased cache size
            const firstKey = newCache.keys().next().value;
            newCache.delete(firstKey);
          }
          return newCache;
        });
        
        // Debug search results
        debugSearchResults(qVal, filtered, unique);
        
        console.log(`Offline search completed: ${unique.length} results for ${qVal} (filtered: ${filtered.length}, unique: ${unique.length})`);
        setResults(unique);
        setError('');
        setLoading(false);
        return; // Exit early with offline results
      }
      
      // PRIORITY 2: Fallback to online search if no offline data
      const token = await SecureStore.getItemAsync('token');
      try {
        const res = await axios.get(`${getBaseURL()}/api/tenant/data/search`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { q: qVal, type: type, limit: 1000 }
        });
        let items = res.data?.data || [];
        if (type === 'reg') {
          const tail = new RegExp(String(qVal) + '$', 'i');
          items = items.filter(it => tail.test(String(it.regNo)));
        } else if (type === 'chassis') {
          const needle = String(qVal).trim().toLowerCase();
          items = items.filter(it => String(it.chassisNo || '').toLowerCase().includes(needle));
        }
        // Deduplicate by normalized regNo
        const seen = new Set();
        const unique = [];
        for (const it of items) {
          const k = String(it.regNo || '').trim().toUpperCase();
          if (!k || seen.has(k)) continue;
          seen.add(k);
          unique.push(it);
        }
        
        // Cache the results for future use
        setSearchCache(prev => {
          const newCache = new Map(prev);
          newCache.set(cacheKey, unique);
          // Limit cache size to prevent memory issues
          if (newCache.size > 50) {
            const firstKey = newCache.keys().next().value;
            newCache.delete(firstKey);
          }
          return newCache;
        });
        
        console.log(`Online search completed: ${unique.length} results for ${qVal}`);
        setResults(unique);
      } catch (err) {
        console.error('Online search failed:', err);
        setError(err.response?.data?.message || 'Search failed');
      }
    } finally { 
      console.log(`Search finished for ${qVal}, loading: false`);
      setLoading(false); 
    }
  };

  // Build balanced A-Z columns when azMode is enabled
  const azColumns = useMemo(() => {
    if (!azMode || !Array.isArray(results) || results.length === 0) {
      return { left: [], right: [] };
    }
    const getKey = (it) => (it.regNo || '').toString().trim().toUpperCase();
    const parseNumTail = (k) => {
      const tail = k.slice(2).match(/\d+/);
      return tail ? parseInt(tail[0], 10) : Number.MAX_SAFE_INTEGER;
    };
    const cmp = (a, b) => {
      const ka = getKey(a);
      const kb = getKey(b);
      const alpha = ka.localeCompare(kb, undefined, { sensitivity: 'base' });
      if (alpha !== 0) return alpha;
      const na = parseNumTail(ka);
      const nb = parseNumTail(kb);
      return na - nb;
    };
    const sorted = [...results].sort(cmp);
    const left = [];
    const right = [];
    for (let i = 0; i < sorted.length; i++) {
      const k = getKey(sorted[i]);
      const ch = k[0] || '';
      if (ch >= 'A' && ch <= 'M') left.push(sorted[i]); else right.push(sorted[i]);
    }
    return { left, right };
  }, [results, azMode]);

  // Handle pre-loaded data from Dashboard
  useEffect(() => {
    if (preloadedData && fromDashboard) {
      console.log(`Using pre-loaded data: ${preloadedData.length} results`);
      setResults(preloadedData);
      setLoading(false);
      setError('');
      return;
    }
  }, [preloadedData, fromDashboard]);

  // Instant search on screen load
  useEffect(() => {
    const value = String(q || '').trim();
    if (/^\d{4}$/.test(value)) { 
      // Instant search - no loading state
      runSearch(value, 'reg', false);
    }
  }, [q]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        // Pre-initialize database for faster searches (deferred until after first paint)
        await initDatabase();
        // Build search index for ultra-fast searches (DB-level)
        await buildDbSearchIndex();
        
        const cached = await SecureStore.getItemAsync('offline_dump');
        if (cached) {
          const data = JSON.parse(cached);
          const arr = Array.isArray(data) ? data : [];
          setOfflineData(arr);
          // Build search index for instant lookups (local data)
          buildLocalSearchIndex(arr);
        }
      } catch (error) {
        console.error('Error loading cached offline data:', error);
      }
    });
    return () => task.cancel && task.cancel();
  }, []);

  const keyExtractor = useCallback((item) => String(item._id), []);
  const renderListItem = useCallback(({ item }) => (
    <TouchableOpacity key={String(item._id)} style={styles.listItem} onPress={async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const res = await axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDetail(res.data?.data || null);
        setDetailOpen(true);
        try {
          await axios.post(`${getBaseURL()}/api/tenant/data/search/history`, {
            vehicleId: item._id,
            regNo: item.regNo || '',
            chassisNo: item.chassisNo || '',
            query: regSuffixInput || chassisInput || '',
            type: regSuffixInput ? 'reg' : 'chassis'
          }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (_) {}
      } catch (_) {}
    }}>
      <Text numberOfLines={1} style={styles.listTitle}>{item.regNo || ''}</Text>
    </TouchableOpacity>
  ), [regSuffixInput, chassisInput]);

  // Trigger registration suffix search when exactly 4 digits (INSTANT)
  useEffect(() => {
    const value = String(regSuffixInput || '').trim();
    if (!/^\d{4}$/.test(value)) { 
      setResults([]);
      return; 
    }
    
    console.log(`Triggering reg search for: ${value}`);
    
    // INSTANT search - no loading state
    runSearch(value, 'reg', false);
  }, [regSuffixInput]);

  // Trigger chassis search when input length >= 3 (INSTANT for local data)
  useEffect(() => {
    const value = String(chassisInput || '').trim();
    if (value.length >= 3) {
      console.log(`Triggering chassis search for: ${value}`);
      
      // INSTANT search for local data - no loading state
      runSearch(value, 'chassis', false);
    } else if (value.length === 0) {
      setResults([]);
    }
  }, [chassisInput]);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }] }>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.headerBar}>
        <TextInput
          style={[styles.input, { flex: 0.5 }]}
          value={chassisInput}
          onChangeText={(t)=>setChassisInput(String(t || '').toUpperCase())}
          placeholder="Chassis number"
          autoCapitalize="characters"
        />
        <TextInput
          style={[styles.input, { flex: 0.5 }]}
          value={regSuffixInput}
          onChangeText={(t)=>setRegSuffixInput(String(t||'').replace(/\D/g,'').slice(0,4))}
          placeholder="Reg tail (1234)"
          keyboardType="numeric"
          maxLength={4}
        />
      </View>
      <View style={styles.segmentWrap}>
        <TouchableOpacity style={[styles.segBtn, azMode ? styles.segBtnActive : null]} onPress={() => setAzMode(true)}>
          <Text style={[styles.segText, azMode ? styles.segTextActive : null]}>A–Z</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segBtn, !azMode ? styles.segBtnActive : null]} onPress={() => setAzMode(false)}>
          <Text style={[styles.segText, !azMode ? styles.segTextActive : null]}>Default</Text>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {results.length === 0 && (
        <View style={styles.center}><Text>No results found</Text></View>
      )}
      {results.length > 0 && !azMode && (
        <FlatList
          style={{ flex: 1 }}
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderListItem}
          numColumns={2}
          columnWrapperStyle={{ gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          initialNumToRender={24}
          maxToRenderPerBatch={40}
          windowSize={10}
          removeClippedSubviews
        />
      )}
      {results.length > 0 && azMode && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              {azColumns.left.map(item => (
                <TouchableOpacity key={String(item._id)} style={styles.listItem} onPress={async () => {
                  try {
                    const token = await SecureStore.getItemAsync('token');
                    const res = await axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    setDetail(res.data?.data || null);
                    setDetailOpen(true);
                  } catch (_) {}
                }}>
                  <Text numberOfLines={1} style={styles.listTitle}>{item.regNo || ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {azColumns.right.map(item => (
                <TouchableOpacity key={String(item._id)} style={styles.listItem} onPress={async () => {
                  try {
                    const token = await SecureStore.getItemAsync('token');
                    const res = await axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    setDetail(res.data?.data || null);
                    setDetailOpen(true);
                  } catch (_) {}
                }}>
                  <Text numberOfLines={1} style={styles.listTitle}>{item.regNo || ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            {detail ? (
              <>
                <Text style={styles.modalTitle}>{detail.regNo || 'Vehicle'}</Text>
                <Text style={styles.muted}>Chassis: {detail.chassisNo || '—'}</Text>
                <Text style={styles.muted}>Loan: {detail.loanNo || '—'}</Text>
                <Text style={styles.muted}>Bank: {detail.bank || '—'}</Text>
                <Text style={styles.muted}>Make: {detail.make || '—'}</Text>
                <Text style={styles.muted}>Customer: {detail.customerName || '—'}</Text>
                <Text style={styles.muted}>Address: {detail.address || '—'}</Text>
                <View style={{ height: 12 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={async () => {
                    try {
                      setConfirming(true);
                      const token = await SecureStore.getItemAsync('token');
                      await axios.put(`${getBaseURL()}/api/tenant/data/vehicle/${detail._id}/confirm`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setConfirming(false);
                      setDetailOpen(false);
                    } catch (_) { setConfirming(false); }
                  }}>
                    <Text style={styles.primaryBtnText}>{confirming ? 'Confirming...' : 'Confirm Vehicle'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.whatsBtn} onPress={() => {
                    const text = `Vehicle Details\nReg: ${detail.regNo}\nChassis: ${detail.chassisNo}\nLoan: ${detail.loanNo}\nBank: ${detail.bank}\nCustomer: ${detail.customerName}`;
                    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
                    // Linking imported lazily via require to avoid unused import warning
                    const { Linking } = require('react-native');
                    Linking.openURL(url).catch(() => {});
                  }}>
                    <Text style={styles.whatsBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setDetailOpen(false)} style={{ marginTop: 10 }}>
                  <Text style={styles.linkish}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 12, paddingVertical: 10 },
  header: { color: '#111', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  headerBar: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: 'red', marginBottom: 8 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  title: { color: '#111', fontSize: 16, fontWeight: '800' },
  listItem: { paddingVertical: 2, paddingHorizontal: 4, borderWidth: 1, borderColor: '#F1F1F1', borderRadius: 8, backgroundColor: '#fff' },
  listTitle: { color: '#111', fontSize: 18, fontWeight: '800' },
  muted: { color: '#666', fontSize: 12 },
  badge: { backgroundColor: '#222636', color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: '700' }
  ,input: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontWeight: '700', color: '#111' }
  ,modalWrap: { flex:1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }
  ,modalCard: { width: '90%', backgroundColor: '#fff', borderRadius: 16, padding: 16 }
  ,modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 }
  ,primaryBtn: { backgroundColor: '#222636', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }
  ,primaryBtnText: { color: '#fff', fontWeight: '800' }
  ,whatsBtn: { backgroundColor: '#25D366', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }
  ,whatsBtnText: { color: '#fff', fontWeight: '800' }
  ,linkish: { color: '#007AFF', textAlign: 'center' }
  ,loadingText: { marginTop: 8, color: '#666', fontSize: 14 }
  ,segmentWrap: { flexDirection: 'row', gap: 8, marginBottom: 8 }
  ,segBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }
  ,segBtnActive: { backgroundColor: '#222636', borderColor: '#222636' }
  ,segText: { color: '#111', fontWeight: '700' }
  ,segTextActive: { color: '#fff' }
});


