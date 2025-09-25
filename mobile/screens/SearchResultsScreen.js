import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, Modal, TouchableOpacity, TextInput, StatusBar, ScrollView, InteractionManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import * as FileSystem from 'expo-file-system/legacy';
import { searchByRegSuffix, searchByChassis } from '../utils/db';

export default function SearchResultsScreen({ route, navigation }) {
  const { q = '', preloadedData = null, fromDashboard = false, instantSearch = false, offline = false } = route.params || {};
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  // Initialize results with preloadedData if available
  const initialResults = Array.isArray(preloadedData) && preloadedData.length > 0 ? preloadedData : [];
  const [results, setResults] = useState(initialResults);
  
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
  const [hasUserSearched, setHasUserSearched] = useState(false);
  const [suppressClearOnce, setSuppressClearOnce] = useState(false);

  // Helper: log search click to server with robust error reporting
  const logSearchClick = useCallback(async (vehicle, queryText) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        console.warn('[history] No token found; skipping search-click logging');
        return;
      }
      const payload = {
        vehicleId: vehicle._id || vehicle.id,
        vehicleType: (vehicle.vehicleType || 'other').toString().toLowerCase().includes('two') ? 'two_wheeler' : (vehicle.vehicleType || '').toString().toLowerCase().includes('four') ? 'four_wheeler' : (vehicle.vehicleType || '').toString().toLowerCase().includes('cv') ? 'cv' : 'other',
        query: queryText || '',
        metadata: { regNo: vehicle.regNo || '', chassisNo: vehicle.chassisNo || '' }
      };
      await axios.post(`${getBaseURL()}/api/history/search-click`, payload, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.warn('[history] search-click failed', { status, data, message: err?.message });
    }
  }, []);


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
  };

  const runSearch = async (qVal, type, showLoading = false, clearInputsAfter = false) => {
    try {
      // Check cache first for INSTANT results (no loading state)
      const cacheKey = `${qVal}_${type}_${offline ? 'offline' : 'online'}`;
      if (searchCache.has(cacheKey)) {
        const cachedResults = searchCache.get(cacheKey);
        setResults(cachedResults);
        setError('');
        return; // No loading state for cached results
      }
      
      // Only show loading if explicitly requested (for online searches)
      if (showLoading) {
        setLoading(true); 
      }
      setError('');
      
      // In OFFLINE mode, always prefer full SQLite dataset over any preloaded subset
      const useLocalData = offline || (Array.isArray(offlineData) && offlineData.length > 0);
      if (useLocalData) {
        // LOCAL MODE (offline or local dataset available)
        if (!offline && offlineData && Array.isArray(offlineData) && offlineData.length > 0) {
          let filtered = [];
          
          // SIMPLE: Find registration numbers ending with the 4-digit query
          if (type === 'reg' && /^\d{4}$/.test(qVal)) {
            for (let i = 0; i < offlineData.length; i++) {
              const item = offlineData[i];
              const regNo = String(item.regNo || '').trim();
              
              // Simple check: Does registration number end with the 4-digit query?
              if (regNo.endsWith(qVal)) {
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
          
          
          setResults(unique);
          if (clearInputsAfter) {
            setSuppressClearOnce(true);
            setRegSuffixInput('');
            setChassisInput('');
            setTimeout(() => setSuppressClearOnce(false), 0);
          }
          setError('');
          setLoading(false);
          return; // Exit early with offline results
        } else {
          // Fallback to SQLite-based offline search
          let rows = [];
          if (type === 'reg' && /^\d{4}$/.test(qVal)) {
            rows = await searchByRegSuffix(qVal);
          } else if (type === 'chassis' && String(qVal).trim().length >= 3) {
            rows = await searchByChassis(qVal);
          } else {
            // Try both if type ambiguous
            const a = await searchByRegSuffix(String(qVal).slice(-4));
            const b = await searchByChassis(qVal);
            const seen = new Set();
            rows = [];
            for (const it of [...a, ...b]) {
              const k = String(it._id || it.regNo || '').toUpperCase();
              if (seen.has(k)) continue;
              seen.add(k);
              rows.push(it);
            }
          }
          setResults(rows || []);
          if (clearInputsAfter) {
            setSuppressClearOnce(true);
            setRegSuffixInput('');
            setChassisInput('');
            setTimeout(() => setSuppressClearOnce(false), 0);
          }
          setError(rows && rows.length > 0 ? '' : '');
          setLoading(false);
          return;
        }
      } else {
        // ONLINE MODE: Fetch from server
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
          const seen = new Set();
          const unique = [];
          for (const it of items) {
            const k = String(it.regNo || '').trim().toUpperCase();
            if (!k || seen.has(k)) continue;
            seen.add(k);
            unique.push(it);
          }
          setSearchCache(prev => {
            const newCache = new Map(prev);
            newCache.set(cacheKey, unique);
            if (newCache.size > 50) {
              const firstKey = newCache.keys().next().value;
              newCache.delete(firstKey);
            }
            return newCache;
          });
          setResults(unique);
          if (clearInputsAfter) {
            setSuppressClearOnce(true);
            setRegSuffixInput('');
            setChassisInput('');
            setTimeout(() => setSuppressClearOnce(false), 0);
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Search failed');
        }
      }
    } finally { 
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

  // Handle pre-loaded data from Dashboard (authoritative)
  useEffect(() => {
    if (fromDashboard && Array.isArray(preloadedData) && preloadedData.length > 0) {
      // Force update results immediately with timeout to ensure state update
      setTimeout(() => {
        setResults(preloadedData);
        setLoading(false);
        setError('');
        // Clear header inputs so user can type next query immediately
        setRegSuffixInput('');
        setChassisInput('');
      }, 100);
      
      // Prepare data source for future searches
      if (!offline) {
        // Only keep local copy when online; in offline mode we want to use full SQLite dataset
        setOfflineData(preloadedData);
        buildLocalSearchIndex(preloadedData);
      }
      
      return;
    }
  }, [preloadedData, fromDashboard, offline, q]);

  // Instant search on screen load (skip if dashboard provided data)
  useEffect(() => {
    const value = String(q || '').trim();
    
    // Skip if dashboard provided data (both online and offline)
    if (fromDashboard && Array.isArray(preloadedData) && preloadedData.length > 0) {
      return;
    }
    
    if (/^\d{4}$/.test(value)) { 
      // Instant search - no loading state
      runSearch(value, 'reg', false);
    }
  }, [q, fromDashboard, preloadedData]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        // Load offline dump from filesystem (created by download flow)
        const dataPath = `${FileSystem.documentDirectory}offline_data.json`;
        const exists = await FileSystem.getInfoAsync(dataPath);
        if (exists?.exists) {
          const offlineStr = await FileSystem.readAsStringAsync(dataPath);
          const parsed = JSON.parse(offlineStr);
          const arr = Array.isArray(parsed?.records) ? parsed.records : [];
          setOfflineData(arr);
          buildLocalSearchIndex(arr);
        }
      } catch (error) {
        console.error('Error loading cached offline data:', error);
      }
    });
    return () => task.cancel && task.cancel();
  }, []);

  const keyExtractor = useCallback((item, index) => String(item._id || item.id || item.regNo || item.chassisNo || index), []);
  const renderListItem = useCallback(({ item, index }) => (
    <TouchableOpacity key={String(item._id || item.id || item.regNo || item.chassisNo || index)} style={styles.listItem} onPress={async () => {
      try {
        if (offline) {
          // OFFLINE MODE: Use local data directly
          setDetail(item);
          setDetailOpen(true);
        } else {
          // ONLINE MODE: Fetch from server
          const token = await SecureStore.getItemAsync('token');
          const res = await axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setDetail(res.data?.data || null);
          setDetailOpen(true);

          // Log search click to per-tenant history
          await logSearchClick(item, regSuffixInput || chassisInput || '');
        }
      } catch (error) {
        console.error('Error fetching vehicle details:', error);
        // Fallback to local data if server fails
        setDetail(item);
        setDetailOpen(true);
      }
    }}>
      <Text numberOfLines={1} style={styles.listTitle}>{item.regNo || ''}</Text>
    </TouchableOpacity>
  ), [regSuffixInput, chassisInput, offline, logSearchClick]);

  // Trigger registration suffix search when exactly 4 digits
  useEffect(() => {
    const value = String(regSuffixInput || '').trim();
    
    if (suppressClearOnce) return;

    // Skip if this is the initial load from dashboard and user hasn't searched yet
    if (fromDashboard && Array.isArray(preloadedData) && !hasUserSearched && value === String(q || '').trim()) {
      return;
    }
    // Also skip initial empty state after arriving from dashboard
    if (fromDashboard && !hasUserSearched && value === '') {
      return;
    }
    
    if (!/^\d{4}$/.test(value)) { 
      if (hasUserSearched) setResults([]);
      return; 
    }
    
    // Mark that user has started searching
    setHasUserSearched(true);
    
    // INSTANT search - no loading state; clear inputs after showing results
    runSearch(value, 'reg', false, true);
  }, [regSuffixInput, q, fromDashboard, preloadedData, hasUserSearched]);

  // Trigger chassis search when input length >= 3 (INSTANT for local data)
  useEffect(() => {
    const value = String(chassisInput || '').trim();
    
    if (suppressClearOnce) return;

    // Skip if this is the initial load from dashboard and user hasn't searched yet
    if (fromDashboard && Array.isArray(preloadedData) && !hasUserSearched && value === '') {
      return;
    }
    
    if (value.length >= 3) {
      // Mark that user has started searching
      setHasUserSearched(true);
      // INSTANT search for local data - no loading state; clear inputs after
      runSearch(value, 'chassis', false, true);
    } else if (value.length === 0) {
      if (hasUserSearched) setResults([]);
    }
  }, [chassisInput, fromDashboard, preloadedData, hasUserSearched]);

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
      {/* A–Z is default; toggle buttons removed */}

      {!!error && <Text style={styles.error}>{error}</Text>}
      
      
      {results.length === 0 && (
        <View style={styles.center}><Text>No results found</Text></View>
      )}
      {/* Non A–Z list removed; always showing A–Z columns */}
      {results.length > 0 && azMode && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              {azColumns.left.map((item, index) => (
                <TouchableOpacity key={String(item._id || item.id || item.regNo || item.chassisNo || index)} style={styles.listItem} onPress={async () => {
                  try {
                    if (offline) {
                      // OFFLINE MODE: Use local data directly
                      setDetail(item);
                      setDetailOpen(true);
                    } else {
                      // ONLINE MODE: Fetch from server
                      const token = await SecureStore.getItemAsync('token');
                      const res = await axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setDetail(res.data?.data || null);
                      setDetailOpen(true);

                      // Log search click to per-tenant history
                      await logSearchClick(item, regSuffixInput || chassisInput || '');
                    }
                  } catch (error) {
                    console.error('Error fetching vehicle details (A-Z):', error);
                    // Fallback to local data if server fails
                    setDetail(item);
                    setDetailOpen(true);
                  }
                }}>
                  <Text numberOfLines={1} style={styles.listTitle}>{item.regNo || ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {azColumns.right.map((item, index) => (
                <TouchableOpacity key={String(item._id || item.id || item.regNo || item.chassisNo || index)} style={styles.listItem} onPress={async () => {
                  try {
                    if (offline) {
                      // OFFLINE MODE: Use local data directly
                      setDetail(item);
                      setDetailOpen(true);
                    } else {
                      // ONLINE MODE: Fetch from server
                      const token = await SecureStore.getItemAsync('token');
                      const res = await axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setDetail(res.data?.data || null);
                      setDetailOpen(true);

                      // Log search click to per-tenant history
                      await logSearchClick(item, regSuffixInput || chassisInput || '');
                    }
                  } catch (error) {
                    console.error('Error fetching vehicle details (A-Z):', error);
                    // Fallback to local data if server fails
                    setDetail(item);
                    setDetailOpen(true);
                  }
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
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Section */}
                <View style={styles.modalHeader}>
                  <View style={styles.vehicleIcon}>
                    <Text style={styles.vehicleIconText}>🚗</Text>
                  </View>
                  <View style={styles.headerContent}>
                    <Text style={styles.modalTitle}>{detail.regNo || 'Vehicle'}</Text>
                    <Text style={styles.vehicleType}>{detail.vehicleType || 'Vehicle'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailOpen(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Details Section */}
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Vehicle Information</Text>
                  
                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Text style={styles.detailIconText}>🔢</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Registration Number</Text>
                      <Text style={styles.detailValue}>{detail.regNo || '—'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Text style={styles.detailIconText}>🔧</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Chassis Number</Text>
                      <Text style={styles.detailValue}>{detail.chassisNo || '—'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Text style={styles.detailIconText}>📄</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Loan Number</Text>
                      <Text style={styles.detailValue}>{detail.loanNo || '—'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Text style={styles.detailIconText}>🏦</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Bank</Text>
                      <Text style={styles.detailValue}>{detail.bank || '—'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Text style={styles.detailIconText}>🏭</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Make</Text>
                      <Text style={styles.detailValue}>{detail.make || '—'}</Text>
                    </View>
                  </View>
                </View>

                {/* Customer Section */}
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Customer Information</Text>
                  
                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Text style={styles.detailIconText}>👤</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Customer Name</Text>
                      <Text style={styles.detailValue}>{detail.customerName || '—'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Text style={styles.detailIconText}>📍</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Address</Text>
                      <Text style={styles.detailValue}>{detail.address || '—'}</Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionSection}>
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
                    <Text style={styles.primaryBtnText}>
                      {confirming ? '⏳ Confirming...' : '✅ Confirm Vehicle'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.whatsBtn} onPress={async () => {
                    try {
                      const text = `🚗 *Vehicle Details*\n\n🔢 *Registration:* ${detail.regNo}\n🔧 *Chassis:* ${detail.chassisNo}\n📄 *Loan:* ${detail.loanNo}\n🏦 *Bank:* ${detail.bank}\n👤 *Customer:* ${detail.customerName}\n📍 *Address:* ${detail.address}`;
                      const token = await SecureStore.getItemAsync('token');
                      // Fire-and-forget share history
                      axios.post(`${getBaseURL()}/api/history/share`, {
                        vehicleId: detail._id,
                        vehicleType: (detail.vehicleType || 'other').toString().toLowerCase().includes('two') ? 'two_wheeler' : (detail.vehicleType || '').toString().toLowerCase().includes('four') ? 'four_wheeler' : (detail.vehicleType || '').toString().toLowerCase().includes('cv') ? 'cv' : 'other',
                        channel: 'whatsapp',
                        payloadPreview: text.slice(0, 500),
                        metadata: { regNo: detail.regNo || '', chassisNo: detail.chassisNo || '' }
                      }, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>{});

                      const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
                      const { Linking } = require('react-native');
                      Linking.openURL(url).catch(() => {});
                    } catch (_) {}
                  }}>
                    <Text style={styles.whatsBtnText}>📱 Share on WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#222636" />
                <Text style={styles.loadingText}>Loading vehicle details...</Text>
              </View>
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
  ,modalWrap: { flex:1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }
  ,modalCard: { width: '95%', maxHeight: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 0, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }
  ,modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#F8FAFC' }
  ,vehicleIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222636', alignItems: 'center', justifyContent: 'center', marginRight: 15 }
  ,vehicleIconText: { fontSize: 24 }
  ,headerContent: { flex: 1 }
  ,modalTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 4 }
  ,vehicleType: { fontSize: 14, color: '#666', fontWeight: '600' }
  ,closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }
  ,closeBtnText: { fontSize: 16, color: '#666', fontWeight: '600' }
  ,detailsSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }
  ,sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 }
  ,detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingVertical: 8 }
  ,detailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 15 }
  ,detailIconText: { fontSize: 18 }
  ,detailContent: { flex: 1 }
  ,detailLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }
  ,detailValue: { fontSize: 16, color: '#111', fontWeight: '600', lineHeight: 22 }
  ,actionSection: { padding: 20, gap: 12 }
  ,primaryBtn: { backgroundColor: '#222636', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }
  ,primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
  ,whatsBtn: { backgroundColor: '#25D366', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }
  ,whatsBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
  ,loadingContainer: { padding: 40, alignItems: 'center' }
  ,loadingText: { marginTop: 15, color: '#666', fontSize: 16, fontWeight: '500' }
  ,linkish: { color: '#007AFF', textAlign: 'center' }
  ,segmentWrap: { flexDirection: 'row', gap: 8, marginBottom: 8 }
  ,segBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }
  ,segBtnActive: { backgroundColor: '#222636', borderColor: '#222636' }
  ,segText: { color: '#111', fontWeight: '700' }
  ,segTextActive: { color: '#fff' }
});


