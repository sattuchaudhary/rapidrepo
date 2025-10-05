import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, Modal, TouchableOpacity, TextInput, StatusBar, ScrollView, InteractionManager, useColorScheme, Animated, Appearance, Keyboard, Linking, Alert, Share, Platform, Easing } from 'react-native';
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
  const [colorScheme, setColorScheme] = useState(useColorScheme());
  const isDark = colorScheme === 'dark';
  const theme = {
    bg: isDark ? '#0b1220' : '#ffffff',
    cardBg: isDark ? '#111827' : '#ffffff',
    textPrimary: isDark ? '#e5e7eb' : '#111827',
    textSecondary: isDark ? '#9CA3AF' : '#666',
    inputBg: isDark ? '#0f172a' : '#F3F4F6',
    inputBorder: isDark ? '#1f2937' : '#E5E7EB',
    surfaceBorder: isDark ? 'rgba(255,255,255,0.12)' : '#F1F1F1',
    accent: '#2563eb'
  };
  
  // Helper: dedupe results by normalized keys (regNo > chassisNo > _id)
  const dedupeResults = useCallback((items) => {
    const output = [];
    const seen = new Set();
    for (const it of Array.isArray(items) ? items : []) {
      const regKey = String(it?.regNo || '').trim().toUpperCase();
      const chassisKey = !regKey ? String(it?.chassisNo || '').trim().toUpperCase() : '';
      const idKey = !regKey && !chassisKey ? String(it?._id || it?.id || '') : '';
      const key = regKey || chassisKey || idKey;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(it);
    }
    return output;
  }, []);

  // Initialize results with preloadedData if available (deduped)
  const initialResults = Array.isArray(preloadedData) && preloadedData.length > 0 ? dedupeResults(preloadedData) : [];
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
  
  // Performance optimization: Memoize search functions
  const memoizedSearchByRegSuffix = useCallback(async (suffix) => {
    try {
      return await searchByRegSuffix(suffix);
    } catch (error) {
      console.error('Reg suffix search error:', error);
      return [];
    }
  }, []);

  const memoizedSearchByChassis = useCallback(async (needle) => {
    try {
      return await searchByChassis(needle);
    } catch (error) {
      console.error('Chassis search error:', error);
      return [];
    }
  }, []);

  // Performance optimization: Debounced search to reduce database calls
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId;
      return (query, type) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          runSearch(query, type, false, false);
        }, 150); // 150ms debounce for better performance
      };
    })(),
    []
  );
  const [azMode, setAzMode] = useState(true);
  const [hasUserSearched, setHasUserSearched] = useState(false);
  const [suppressClearOnce, setSuppressClearOnce] = useState(false);
  const [agent, setAgent] = useState(null);
  const [fieldMapping, setFieldMapping] = useState(null);
  const [agencyConfirmers, setAgencyConfirmers] = useState([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chassisInputRef = useRef(null);
  const regSuffixInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  
  // Keep content visible above keyboard
  useEffect(() => {
    const onShow = (e) => setKeyboardHeight(e?.endCoordinates?.height || 0);
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener('keyboardDidShow', onShow);
    const subHide = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      subShow?.remove && subShow.remove();
      subHide?.remove && subHide.remove();
    };
  }, []);
  
  // Animation values for smooth transitions
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  
  // Modal animation values for smooth right-to-left slide
  const modalSlideAnim = useState(new Animated.Value(300))[0];
  const modalOpacityAnim = useState(new Animated.Value(0))[0];
  
  // Search results animation for ultra-smooth experience
  const resultsFadeAnim = useState(new Animated.Value(0))[0];
  const resultsSlideAnim = useState(new Animated.Value(30))[0];
  const [isAnimating, setIsAnimating] = useState(false);

  // Ensure preloaded results from dashboard are visible immediately
  useEffect(() => {
    try {
      if (Array.isArray(initialResults) && initialResults.length > 0) {
        resultsFadeAnim.setValue(1);
        resultsSlideAnim.setValue(0);
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
        }
      }
    } catch (_) {}
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal animation functions for ULTRA-SMOOTH right-to-left slide
  const openModal = useCallback((vehicleData) => {
    setDetail(vehicleData);
    setDetailOpen(true);
    
    // Reset animation values
    modalSlideAnim.setValue(300);
    modalOpacityAnim.setValue(0);
    
    // ULTRA-FAST animation with spring physics for natural feel
    Animated.parallel([
      Animated.spring(modalSlideAnim, {
        toValue: 0,
        tension: 140, // lower tension for smoother slide
        friction: 20, // moderate friction to avoid snap
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [modalSlideAnim, modalOpacityAnim]);

  const closeModal = useCallback(() => {
    // ULTRA-FAST modal close with spring physics
    Animated.parallel([
      Animated.spring(modalSlideAnim, {
        toValue: 300,
        tension: 180, // slightly snappier than open, but still smooth
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDetailOpen(false);
      setDetail(null);
    });
  }, [modalSlideAnim, modalOpacityAnim]);

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

  // Listen for theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
      setColorScheme(newColorScheme);
    });
    return () => subscription?.remove();
  }, []);

  // ULTRA-SMOOTH screen entrance animation
  useEffect(() => {
    // Start entrance animation when component mounts
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 200,
          friction: 20,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 200,
          friction: 20,
          useNativeDriver: true,
        }),
      ]).start();
    }, 30); // Reduced delay for faster feel
    
    return () => clearTimeout(timer);
  }, []);

  // Load logged-in agent and field mapping in parallel - Optimized for faster loading
  useEffect(() => {
    (async () => {
      try {
        // Load agent data first (faster)
        const stored = await SecureStore.getItemAsync('agent');
        if (stored) setAgent(JSON.parse(stored));
        
        // Load field mapping in background (non-blocking) - OFFLINE OPTIMIZED
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          // Defer field mapping loading to avoid blocking initial render
          setTimeout(async () => {
            try {
              // First try to load cached field mapping for offline use
              const cachedMapping = await SecureStore.getItemAsync('fieldMapping');
              if (cachedMapping) {
                console.log('Using cached field mapping for offline mode');
                setFieldMapping(JSON.parse(cachedMapping));
              }
              
              // Then try to fetch fresh mapping from server
              const res = await axios.get(`${getBaseURL()}/api/tenants/field-mapping`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000 // 10 second timeout
              });
              if (res?.data?.success) {
                console.log('Field mapping received from server:', res.data.fieldMapping);
                setFieldMapping(res.data.fieldMapping || null);
                // Cache the fresh mapping for offline use
                await SecureStore.setItemAsync('fieldMapping', JSON.stringify(res.data.fieldMapping || {}));
              }
            } catch (error) {
              console.error('Error fetching field mapping:', error);
              
              // Try to use cached mapping if server fails
              try {
                const cachedMapping = await SecureStore.getItemAsync('fieldMapping');
                if (cachedMapping) {
                  console.log('Using cached field mapping due to server error');
                  setFieldMapping(JSON.parse(cachedMapping));
                  return;
                }
              } catch (cacheError) {
                console.log('No cached field mapping available');
              }
              
              // Set default field mapping if both server and cache fail
              const defaultMapping = {
                regNo: true,
                chassisNo: true,
                loanNo: true,
                bank: true,
                make: true,
                customerName: true,
                engineNo: true,
                emiAmount: true,
                address: true,
                branch: true,
                pos: true,
                model: true,
                productName: true,
                bucket: true,
                season: true,
                inYard: false,
                yardName: false,
                yardLocation: false,
                status: true,
                uploadDate: false,
                fileName: false
              };
              setFieldMapping(defaultMapping);
              // Cache default mapping for future offline use
              await SecureStore.setItemAsync('fieldMapping', JSON.stringify(defaultMapping));
            }
          }, 100); // Small delay to prioritize UI rendering
        }
      } catch (_) {}
    })();
  }, []);

  const isRepoAgent = useMemo(() => {
    if (!agent) return false;
    try {
      const possible = [
        agent.role,
        agent.type,
        agent.designation,
        agent.userType,
        agent.title,
        agent.team,
        agent.department,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      if (possible.some((v) => v.includes('repo'))) return true;
      // Fallback: scan full object text once
      const blob = JSON.stringify(agent).toLowerCase();
      return blob.includes('repo');
    } catch (_) {
      return false;
    }
  }, [agent]);

  // Helper: fetch agency confirmer data for repo agents
  const fetchAgencyConfirmers = useCallback(async () => {
    try {
      if (!isRepoAgent) return;
      
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      
      const res = await axios.get(`${getBaseURL()}/api/tenant/agency-confirmers/mobile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data?.success) {
        setAgencyConfirmers(res.data.data || []);
      }
    } catch (err) {
      console.warn('[agency-confirmers] failed to fetch:', err?.response?.status, err?.message);
    }
  }, [isRepoAgent]);

  // Helper: build WhatsApp vehicle text (shared across actions)
  const buildVehicleWhatsAppText = useCallback((veh) => {
    const fm = fieldMapping || {};
    const getFieldValue = (value, key) => {
      if (fm[key] === false) return 'N/A';
      return value || '—';
    };
    try {
      let text = '🚗 *Vehicle Details*\n\n';
      text += `👤 *Name:* ${getFieldValue(veh.customerName, 'customerName')}\n`;
      text += `🔢 *Vehicle:* ${getFieldValue(veh.regNo, 'regNo')}\n`;
      text += `🔧 *Chassis:* ${getFieldValue(veh.chassisNo, 'chassisNo')}\n`;
      text += `⚙️ *Engine:* ${getFieldValue(veh.engineNo, 'engineNo')}\n`;
      text += `🏭 *Make:* ${getFieldValue(veh.make, 'make')}\n`;
      text += `🚘 *Model:* ${getFieldValue(veh.model, 'model')}\n`;
      return text;
    } catch (_) {
      return 'Vehicle details';
    }
  }, [fieldMapping]);

  // Helper: send WhatsApp message to a specific number with chooser each time
  const sendWhatsAppMessage = useCallback(async (phoneNumber, message) => {
    try {
      const cleanNumber = String(phoneNumber || '').replace(/[^\d]/g, '');
      const formattedNumber = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;

      if (Platform.OS === 'android') {
        // Probe known WhatsApp packages
        const candidates = [
          { label: 'WhatsApp', pkg: 'com.whatsapp' },
          { label: 'WhatsApp Business', pkg: 'com.whatsapp.w4b' }
        ];

        const available = [];
        for (const c of candidates) {
          const intentUrl = `intent://send?phone=${formattedNumber}&text=${encodeURIComponent(message)}#Intent;scheme=whatsapp;package=${c.pkg};end`;
          try {
            const ok = await Linking.canOpenURL(intentUrl);
            if (ok) available.push({ ...c, intentUrl });
          } catch (_) {}
        }

        if (available.length === 0) {
          // Fallback to wa.me link (browser)
          const webUrl = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
          await Linking.openURL(webUrl);
          return;
        }

        // Show chooser via Alert (simple list)
        const buttons = available.map((app) => ({
          text: app.label,
          onPress: () => Linking.openURL(app.intentUrl).catch(() => {})
        }));
        buttons.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Send with', 'Choose WhatsApp app', buttons, { cancelable: true });
        return;
      }

      // iOS: single WhatsApp app expected
      const url = `whatsapp://send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        const webUrl = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      Alert.alert('Error', 'Could not open WhatsApp. Please make sure WhatsApp is installed.');
    }
  }, []);

  const runSearch = async (qVal, type, showLoading = false, clearInputsAfter = false) => {
    try {
      // Check cache first for INSTANT results (no loading state)
      const cacheKey = `${qVal}_${type}_${offline ? 'offline' : 'online'}`;
      if (searchCache.has(cacheKey)) {
        const cachedResults = searchCache.get(cacheKey);
        // Safety: ensure deduplication even for cached entries
        setResults(dedupeResults(cachedResults));
        
        // SMOOTH CACHED RESULTS ANIMATION
        setIsAnimating(true);
        resultsFadeAnim.setValue(0);
        resultsSlideAnim.setValue(30);
        
        Animated.parallel([
          Animated.timing(resultsFadeAnim, {
            toValue: 1,
            duration: 150, // Faster for cached results
            useNativeDriver: true,
          }),
          Animated.spring(resultsSlideAnim, {
            toValue: 0,
            tension: 250,
            friction: 15,
            useNativeDriver: true,
          }),
        ]).start(() => setIsAnimating(false));
        
        // SCROLL TO TOP when cached results are shown
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
        
        // Ensure inputs clear even when using cached results
        if (clearInputsAfter) {
          setSuppressClearOnce(true);
          setRegSuffixInput('');
          setChassisInput('');
          setTimeout(() => setSuppressClearOnce(false), 0);
          setTimeout(() => {
            if (type === 'reg') {
              regSuffixInputRef.current && regSuffixInputRef.current.focus();
            } else if (type === 'chassis') {
              chassisInputRef.current && chassisInputRef.current.focus();
            }
          }, 50);
        }

        setError('');
        return; // INSTANT results from cache
      }
      
      // INSTANT search - no loading states
      setError('');
      
      // PRIORITIZE OFFLINE DATA - Always try offline first for faster performance
      let offlineResults = [];
      try {
        if (type === 'reg' && /^\d{4}$/.test(qVal)) {
          offlineResults = await memoizedSearchByRegSuffix(qVal);
        } else if (type === 'chassis' && String(qVal).trim().length >= 3) {
          offlineResults = await memoizedSearchByChassis(qVal);
        } else {
          // Try both if type ambiguous
          const regResults = await memoizedSearchByRegSuffix(String(qVal).slice(-4));
          const chassisResults = await memoizedSearchByChassis(qVal);
          const seen = new Set();
          offlineResults = [];
          for (const it of [...regResults, ...chassisResults]) {
            const k = String(it._id || it.regNo || '').toUpperCase();
            if (seen.has(k)) continue;
            seen.add(k);
            offlineResults.push(it);
          }
        }
      } catch (offlineError) {
        console.log('Offline search failed:', offlineError);
      }
      
      // If we have offline results, use them immediately for fast performance
      if (offlineResults && offlineResults.length > 0) {
        const unique = dedupeResults(offlineResults);
        
        // Cache results for future instant access
        setSearchCache(prev => {
          const newCache = new Map(prev);
          newCache.set(cacheKey, unique);
          if (newCache.size > 100) {
            const firstKey = newCache.keys().next().value;
            newCache.delete(firstKey);
          }
          return newCache;
        });
        
        setResults(unique);
        
        // SMOOTH RESULTS ANIMATION
        setIsAnimating(true);
        resultsFadeAnim.setValue(0);
        resultsSlideAnim.setValue(30);
        
        Animated.parallel([
          Animated.timing(resultsFadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(resultsSlideAnim, {
            toValue: 0,
            tension: 200,
            friction: 20,
            useNativeDriver: true,
          }),
        ]).start(() => setIsAnimating(false));
        
        // SCROLL TO TOP when new results arrive
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }
        
        if (clearInputsAfter) {
          setSuppressClearOnce(true);
          setRegSuffixInput('');
          setChassisInput('');
          setTimeout(() => setSuppressClearOnce(false), 0);
          setTimeout(() => {
            if (type === 'reg') {
              regSuffixInputRef.current && regSuffixInputRef.current.focus();
            } else if (type === 'chassis') {
              chassisInputRef.current && chassisInputRef.current.focus();
            }
          }, 50);
        }
        setError('');
        return; // INSTANT offline results - fastest performance
      }
      
      // Fallback to local dataset if available
      const useLocalData = offline || (offlineData && Array.isArray(offlineData) && offlineData.length > 0);
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
          
          // Deduplicate
          const unique = dedupeResults(filtered);
          
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
          
          // SMOOTH ONLINE RESULTS ANIMATION
          setIsAnimating(true);
          resultsFadeAnim.setValue(0);
          resultsSlideAnim.setValue(30);
          
          Animated.parallel([
            Animated.timing(resultsFadeAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.spring(resultsSlideAnim, {
              toValue: 0,
              tension: 200,
              friction: 20,
              useNativeDriver: true,
            }),
          ]).start(() => setIsAnimating(false));
          
          // SCROLL TO TOP when new results arrive
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: 0, animated: true });
          }
          
          if (clearInputsAfter) {
            setSuppressClearOnce(true);
            setRegSuffixInput('');
            setChassisInput('');
            setTimeout(() => setSuppressClearOnce(false), 0);
            setTimeout(() => {
              if (type === 'reg') {
                regSuffixInputRef.current && regSuffixInputRef.current.focus();
              } else if (type === 'chassis') {
                chassisInputRef.current && chassisInputRef.current.focus();
              }
            }, 50);
          }
          setError('');
          return; // INSTANT results - no loading state
        } else {
          // Fallback to SQLite-based offline search
          let rows = [];
          if (type === 'reg' && /^\d{4}$/.test(qVal)) {
            rows = await memoizedSearchByRegSuffix(qVal);
          } else if (type === 'chassis' && String(qVal).trim().length >= 3) {
            rows = await memoizedSearchByChassis(qVal);
          } else {
            // Try both if type ambiguous
            const a = await memoizedSearchByRegSuffix(String(qVal).slice(-4));
            const b = await memoizedSearchByChassis(qVal);
            const seen = new Set();
            rows = [];
            for (const it of [...a, ...b]) {
              const k = String(it._id || it.regNo || '').toUpperCase();
              if (seen.has(k)) continue;
              seen.add(k);
              rows.push(it);
            }
          }
          setResults(dedupeResults(rows || []));
          
          // SMOOTH SQLITE RESULTS ANIMATION
          setIsAnimating(true);
          resultsFadeAnim.setValue(0);
          resultsSlideAnim.setValue(30);
          
          Animated.parallel([
            Animated.timing(resultsFadeAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.spring(resultsSlideAnim, {
              toValue: 0,
              tension: 200,
              friction: 20,
              useNativeDriver: true,
            }),
          ]).start(() => setIsAnimating(false));
          
          // SCROLL TO TOP when new results arrive
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: 0, animated: true });
          }
          
          if (clearInputsAfter) {
            setSuppressClearOnce(true);
            setRegSuffixInput('');
            setChassisInput('');
            setTimeout(() => setSuppressClearOnce(false), 0);
            setTimeout(() => {
              if (type === 'reg') {
                regSuffixInputRef.current && regSuffixInputRef.current.focus();
              } else if (type === 'chassis') {
                chassisInputRef.current && chassisInputRef.current.focus();
              }
            }, 50);
          }
          setError(rows && rows.length > 0 ? '' : '');
          return; // INSTANT results
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
          const unique = dedupeResults(items);
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
            setTimeout(() => {
              if (type === 'reg') {
                regSuffixInputRef.current && regSuffixInputRef.current.focus();
              } else if (type === 'chassis') {
                chassisInputRef.current && chassisInputRef.current.focus();
              }
            }, 50);
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Search failed');
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // Build balanced A–Z columns when azMode is enabled
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
    const mid = Math.ceil(sorted.length / 2);
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);
    return { left, right };
  }, [results, azMode]);

  // Handle pre-loaded data from Dashboard (authoritative) - INSTANT display
  useEffect(() => {
    if (fromDashboard && Array.isArray(preloadedData) && preloadedData.length > 0) {
      // INSTANT state update - no delays
      setResults(dedupeResults(preloadedData));
      setLoading(false);
      setError('');
      
      // Smooth entrance animation from right
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Clear header inputs immediately
      setRegSuffixInput('');
      setChassisInput('');
      
      // Prepare data source for future searches (deferred to avoid blocking UI)
      if (offline) {
        // In offline mode we can use a preloaded subset; otherwise rely on full SQLite dataset
        setOfflineData(preloadedData);
        // Defer index building to avoid blocking initial render
        setTimeout(() => buildLocalSearchIndex(preloadedData), 0);
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
        const dataPath = `${FileSystem.documentDirectory}offline_data.json`;
        const exists = await FileSystem.getInfoAsync(dataPath);
        if (exists?.exists) {
          const offlineStr = await FileSystem.readAsStringAsync(dataPath);
          const parsed = JSON.parse(offlineStr);
          const arr = Array.isArray(parsed?.records) ? parsed.records : [];
          setOfflineData(arr);
          setTimeout(() => buildLocalSearchIndex(arr), 50);
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
      // INSTANT OFFLINE MODE - Use local data immediately for fast performance
      openModal(item);
      
      // Background server fetch (non-blocking) for additional data if online
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          // Fire-and-forget server fetch for enhanced data
          axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000 // Quick timeout for offline detection
          }).then(res => {
            // Update modal with server data if available
            if (res.data?.data) {
              setDetail(res.data.data);
            }
          }).catch(() => {
            // Server unavailable - keep using local data
            console.log('Server unavailable, using local data');
          });
        }
        
        // Log search click to per-tenant history (non-blocking)
        logSearchClick(item, regSuffixInput || chassisInput || '').catch(() => {});
        
        // Fetch agency confirmers for repo agents (non-blocking)
        fetchAgencyConfirmers().catch(() => {});
      } catch (error) {
        console.log('Background fetch failed, using local data only');
      }
    }}>
      <Text numberOfLines={1} style={styles.listTitle}>{item.regNo || ''}</Text>
    </TouchableOpacity>
  ), [regSuffixInput, chassisInput, logSearchClick]);

  // Trigger registration suffix search when exactly 4 digits - INSTANT
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
      // Preserve previous results while typing partial input
      // Only clear when user fully clears the input
      if (value === '' && hasUserSearched) setResults([]);
      return;
    }
    
    // Mark that user has started searching
    setHasUserSearched(true);
    
    // INSTANT search - immediate execution for 4-digit queries, debounced for others
    if (/^\d{4}$/.test(value)) {
      runSearch(value, 'reg', false, true);
    } else {
      debouncedSearch(value, 'reg');
    }
  }, [regSuffixInput, q, fromDashboard, preloadedData, hasUserSearched]);

  // Trigger chassis search when input length >= 3 - INSTANT
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
      // INSTANT search - immediate execution for chassis queries
      runSearch(value, 'chassis', false, true);
    } else if (value.length === 0) {
      if (hasUserSearched) setResults([]);
    }
  }, [chassisInput, fromDashboard, preloadedData, hasUserSearched]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg } ] }>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <Animated.View 
        style={[
          { flex: 1 },
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        <View style={styles.headerBar}>
          <TextInput
            ref={chassisInputRef}
            style={[styles.input, { flex: 0.5, backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.inputBorder }]}
            value={chassisInput}
            onChangeText={(t)=>setChassisInput(String(t || '').toUpperCase())}
            placeholder="Chassis number"
            autoCapitalize="characters"
            blurOnSubmit={false}
          />
          <TextInput
            ref={regSuffixInputRef}
            style={[styles.input, { flex: 0.5, backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.inputBorder }]}
            value={regSuffixInput}
            onChangeText={(t)=>setRegSuffixInput(String(t||'').replace(/\D/g,'').slice(0,4))}
            placeholder="Reg tail (1234)"
            keyboardType="numeric"
            maxLength={4}
            blurOnSubmit={false}
          />
        </View>
      

      {!!error && <Text style={[styles.error, { color: isDark ? '#F87171' : 'red' }]}>{error}</Text>}
      
      {/* INSTANT results - no loading states */}
      {results.length === 0 && (
        <View style={styles.center}><Text style={{ color: theme.textSecondary }}>No results found</Text></View>
      )}
      {/* Non A–Z list removed; always showing A–Z columns */}
      {results.length > 0 && azMode && (
        <Animated.View 
          style={{ 
            flex: 1,
            opacity: resultsFadeAnim,
            transform: [{ translateY: resultsSlideAnim }]
          }}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingBottom: keyboardHeight + 6 }} 
            keyboardShouldPersistTaps="always" 
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            bounces={true}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={20}
            getItemLayout={(data, index) => ({
              length: 60,
              offset: 60 * index,
              index,
            })}
          >
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, gap: 8 }}>
                {azColumns.left.map((item, index) => (
                <TouchableOpacity key={String(item._id || item.id || item.regNo || item.chassisNo || index)} style={[styles.listItem, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]} onPress={async () => {
                  // Open modal immediately for offline-first UX
                  openModal(item);
                  
                  // Background server fetch (non-blocking) for additional data if online
                  try {
                    const token = await SecureStore.getItemAsync('token');
                    if (token) {
                      axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: 5000
                      }).then(res => {
                        if (res.data?.data) {
                          setDetail(res.data.data);
                        }
                      }).catch(() => {
                        console.log('Server unavailable, using local data');
                      });
                    }
                    // Log search click and fetch confirmers (non-blocking)
                    logSearchClick(item, regSuffixInput || chassisInput || '').catch(() => {});
                    fetchAgencyConfirmers().catch(() => {});
                  } catch (error) {
                    console.log('Background fetch failed, using local data only');
                  }
                }}>
                  <Text numberOfLines={1} style={[styles.listTitle, { color: theme.textPrimary }]}>{item.regNo || ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {azColumns.right.map((item, index) => (
                <TouchableOpacity key={String(item._id || item.id || item.regNo || item.chassisNo || index)} style={[styles.listItem, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]} onPress={async () => {
                  // Open modal immediately for offline-first UX
                  openModal(item);
                  
                  // Background server fetch (non-blocking) for additional data if online
                  try {
                    const token = await SecureStore.getItemAsync('token');
                    if (token) {
                      axios.get(`${getBaseURL()}/api/tenant/data/vehicle/${item._id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: 5000
                      }).then(res => {
                        if (res.data?.data) {
                          setDetail(res.data.data);
                        }
                      }).catch(() => {
                        console.log('Server unavailable, using local data');
                      });
                    }
                    // Log search click and fetch confirmers (non-blocking)
                    logSearchClick(item, regSuffixInput || chassisInput || '').catch(() => {});
                    fetchAgencyConfirmers().catch(() => {});
                  } catch (error) {
                    console.log('Background fetch failed, using local data only');
                  }
                }}>
                  <Text numberOfLines={1} style={[styles.listTitle, { color: theme.textPrimary }]}>{item.regNo || ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
        </Animated.View>
      )}
      </Animated.View>

      <Modal visible={detailOpen} transparent animationType="none" onRequestClose={closeModal}>
        <View style={styles.modalWrap}>
          <Animated.View style={[
            styles.modalCard, 
            { 
              backgroundColor: theme.cardBg,
              transform: [{ translateX: modalSlideAnim }],
              opacity: modalOpacityAnim
            }
          ]}>
            {detail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Section */}
                <View style={[styles.modalHeader, { backgroundColor: isDark ? '#0f172a' : '#F8FAFC', borderBottomColor: theme.surfaceBorder }] }>
                  <View style={styles.vehicleIcon}>
                    <Text style={styles.vehicleIconText}>🚗</Text>
                  </View>
                  <View style={styles.headerContent}>
                    <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{detail.regNo || 'Vehicle'}</Text>
                    <Text style={[styles.vehicleType, { color: theme.textSecondary }]}>{detail.vehicleType || 'Vehicle'}</Text>
                  </View>
                  <TouchableOpacity onPress={closeModal} style={[styles.closeBtn, { backgroundColor: isDark ? '#1f2937' : '#E5E7EB' }]}>
                    <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {isRepoAgent ? (
                  <>
                    <View style={[styles.detailsSection, { borderBottomColor: theme.surfaceBorder }]}>
                      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Vehicle Information</Text>
                      {(() => {
                        const fm = fieldMapping || {};
                        console.log('Field mapping in render (Repo Agent):', fm);
                        const row = (label, value, key, icon='•') => {
                          const shouldHide = key in fm && fm[key] === false;
                          console.log(`Field ${key}: shouldHide=${shouldHide}, value=${fm[key]}`);
                          // Show field with N/A if disabled, don't hide completely
                          const displayValue = shouldHide ? 'N/A' : (value ?? '—');
                          return (
                            <View key={label} style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>{label}:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>{displayValue}</Text>
                            </View>
                          );
                        };
                        return [
                          // Required fields only
                          row('Registration Number', detail.regNo, 'regNo', '🔢'),
                          row('Name', detail.customerName, 'customerName', '👤'),
                          row('Make', detail.make, 'make', '🏭'),
                          row('Chassis No', detail.chassisNo, 'chassisNo', '🔧'),
                          row('Engine No', detail.engineNo, 'engineNo', '⚙️'),
                          row('Model', detail.model, 'model', '🚘'),
                          row('Upload Date', detail.uploadDate ? new Date(detail.uploadDate).toLocaleDateString() : '—', 'uploadDate', '🗓️'),
                          row('Bank', detail.bank, 'bank', '🏦'),
                          row('Branch', detail.branch, 'branch', '🏢'),
                          row('Agreement No', detail.loanNo, 'loanNo', '📄'),
                          row('Emi', detail.emiAmount, 'emiAmount', '💳'),
                          row('POS', detail.pos, 'pos', '🧾'),
                          row('BKTS', detail.bucket, 'bucket', '🪣'),
                          
                          // Commented out fields for future use
                          // row('Address', detail.address, 'address', '📍'),
                          // row('Product Name', detail.productName, 'productName', '🏷️'),
                          // row('Season', detail.season, 'season', '📆'),
                          // row('In Yard', detail.inYard ? 'Yes' : 'No', 'inYard', '🏚️'),
                          // row('Yard Name', detail.yardName, 'yardName', '🏷️'),
                          // row('Yard Location', detail.yardLocation, 'yardLocation', '🗺️'),
                          // row('Status', detail.status, 'status', '📌'),
                          // row('File Name', detail.fileName, 'fileName', '📁')
                        ];
                      })()}
                    </View>

                    {/* Confirmed by Section */}
                    <View style={[styles.detailsSection, { borderBottomColor: theme.surfaceBorder }]}>
                      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Agency Confirmer</Text>
                      
                      {agencyConfirmers && agencyConfirmers.length > 0 ? (
                        agencyConfirmers.map((confirmer, index) => (
                          <View key={index}>
                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>
                                Confirmer By{index + 1}:
                              </Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {confirmer.name || 'N/A'}
                              </Text>
                            </View>

                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>
                                Confirmer Phone No{index + 1}:
                              </Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {confirmer.phoneNumber || 'N/A'}
                              </Text>
                              {confirmer.phoneNumber && (
                                <TouchableOpacity 
                                  style={styles.whatsappIcon}
                                  onPress={() => {
                                    const text = buildVehicleWhatsAppText(detail || {});
                                    sendWhatsAppMessage(confirmer.phoneNumber, text);
                                  }}
                                >
                                  <Text style={styles.whatsappIconText}>💬</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))
                      ) : (
                        <View style={styles.compactDetailRow}>
                          <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>
                            No agency confirmers configured
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Action: WhatsApp share (dynamic fields based on mapping) */}
                    <View style={styles.actionSection}>
                      <TouchableOpacity style={styles.whatsBtn} onPress={async () => {
                        try {
                          const text = buildVehicleWhatsAppText(detail);
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
                          const canOpen = await Linking.canOpenURL(url);
                          if (canOpen) await Linking.openURL(url);
                          else await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
                        } catch (_) {}
                      }}>
                        <Text style={styles.whatsBtnText}>📱 Share on WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Details Section (dynamic by field mapping) */}
                    <View style={[styles.detailsSection, { borderBottomColor: theme.surfaceBorder }]}>
                      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Vehicle Information</Text>
                      {(() => {
                        const fm = fieldMapping || {};
                        const row = (label, value, key, icon='•') => {
                          const shouldHide = key in fm && fm[key] === false;
                          // Show field with N/A if disabled, don't hide completely
                          const displayValue = shouldHide ? 'N/A' : (value ?? '—');
                          return (
                            <View key={label} style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>{label}:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>{displayValue}</Text>
                            </View>
                          );
                        };
                        return [
                          row('Registration Number', detail.regNo, 'regNo', '🔢'),
                          row('Chassis Number', detail.chassisNo, 'chassisNo', '🔧'),
                          row('Loan Number', detail.loanNo, 'loanNo', '📄'),
                          row('Bank', detail.bank, 'bank', '🏦'),
                          row('Make', detail.make, 'make', '🏭'),
                          row('Engine Number', detail.engineNo, 'engineNo', '⚙️'),
                          row('EMI Amount', detail.emiAmount, 'emiAmount', '💳'),
                          row('Address', detail.address, 'address', '📍'),
                          row('Branch', detail.branch, 'branch', '🏢'),
                          row('POS', detail.pos, 'pos', '🧾'),
                          row('Model', detail.model, 'model', '🚘'),
                          row('Product Name', detail.productName, 'productName', '🏷️'),
                          row('Bucket', detail.bucket, 'bucket', '🪣'),
                          row('Season', detail.season, 'season', '📆'),
                          row('In Yard', detail.inYard ? 'Yes' : 'No', 'inYard', '🏚️'),
                          row('Yard Name', detail.yardName, 'yardName', '🏷️'),
                          row('Yard Location', detail.yardLocation, 'yardLocation', '🗺️'),
                          row('Status', detail.status, 'status', '📌'),
                          row('Upload Date', detail.uploadDate ? new Date(detail.uploadDate).toLocaleDateString() : '—', 'uploadDate', '🗓️'),
                          row('File Name', detail.fileName, 'fileName', '📁')
                        ];
                      })()}
                    </View>

                    {/* Customer Section */}
                    <View style={[styles.detailsSection, { borderBottomColor: theme.surfaceBorder }]}>
                      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Customer Information</Text>
                      
                      <View style={styles.compactDetailRow}>
                        <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Customer Name:</Text>
                        <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>{detail.customerName || '—'}</Text>
                      </View>

                      <View style={styles.compactDetailRow}>
                        <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Address:</Text>
                        <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>{detail.address || '—'}</Text>
                      </View>
                    </View>

                    {/* Confirmer Details Section for Office Staff */}
                    {(detail.firstConfirmerName || detail.firstConfirmerPhone || detail.secondConfirmerName || detail.secondConfirmerPhone || detail.thirdConfirmerName || detail.thirdConfirmerPhone) && (
                      <View style={[styles.detailsSection, { borderBottomColor: theme.surfaceBorder }]}>
                        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Confirmer Details</Text>
                        
                        {/* First Confirmer */}
                        {(detail.firstConfirmerName || detail.firstConfirmerPhone) && (
                          <View>
                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Confirmer 1:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {detail.firstConfirmerName || 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Phone 1:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {detail.firstConfirmerPhone || 'N/A'}
                              </Text>
                              {detail.firstConfirmerPhone && (
                                <TouchableOpacity 
                                  style={styles.whatsappIcon}
                                  onPress={() => {
                                    const text = buildVehicleWhatsAppText(detail || {});
                                    sendWhatsAppMessage(detail.firstConfirmerPhone, text);
                                  }}
                                >
                                  <Text style={styles.whatsappIconText}>💬</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        )}

                        {/* Second Confirmer */}
                        {(detail.secondConfirmerName || detail.secondConfirmerPhone) && (
                          <View>
                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Confirmer 2:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {detail.secondConfirmerName || 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Phone 2:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {detail.secondConfirmerPhone || 'N/A'}
                              </Text>
                              {detail.secondConfirmerPhone && (
                                <TouchableOpacity 
                                  style={styles.whatsappIcon}
                                  onPress={() => {
                                    const text = buildVehicleWhatsAppText(detail || {});
                                    sendWhatsAppMessage(detail.secondConfirmerPhone, text);
                                  }}
                                >
                                  <Text style={styles.whatsappIconText}>💬</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        )}

                        {/* Third Confirmer */}
                        {(detail.thirdConfirmerName || detail.thirdConfirmerPhone) && (
                          <View>
                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Confirmer 3:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {detail.thirdConfirmerName || 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.compactDetailRow}>
                              <Text style={[styles.compactDetailLabel, { color: theme.textSecondary }]}>Phone 3:</Text>
                              <Text style={[styles.compactDetailValue, { color: theme.textPrimary }]}>
                                {detail.thirdConfirmerPhone || 'N/A'}
                              </Text>
                              {detail.thirdConfirmerPhone && (
                                <TouchableOpacity 
                                  style={styles.whatsappIcon}
                                  onPress={() => {
                                    const text = buildVehicleWhatsAppText(detail || {});
                                    sendWhatsAppMessage(detail.thirdConfirmerPhone, text);
                                  }}
                                >
                                  <Text style={styles.whatsappIconText}>💬</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    )}

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
                          closeModal();
                        } catch (_) { setConfirming(false); }
                      }}>
                        <Text style={styles.primaryBtnText}>
                          {confirming ? '⏳ Confirming...' : '✅ Confirm Vehicle'}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity style={styles.whatsBtn} onPress={async () => {
                        try {
                          const text = buildVehicleWhatsAppText(detail);
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
                          const canOpen = await Linking.canOpenURL(url);
                          if (canOpen) await Linking.openURL(url);
                          else await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
                        } catch (_) {}
                      }}>
                        <Text style={styles.whatsBtnText}>📱 Share on WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#222636" />
                <Text style={styles.loadingText}>Loading vehicle details...</Text>
              </View>
            )}
          </Animated.View>
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
  ,detailsSection: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }
  ,sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }
  ,detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingVertical: 4 }
  ,detailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 15 }
  ,detailIconText: { fontSize: 18 }
  ,detailContent: { flex: 1 }
  ,detailLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }
  ,detailValue: { fontSize: 16, color: '#111', fontWeight: '600', lineHeight: 22 }
  ,compactDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingVertical: 2 }
  ,compactDetailLabel: { fontSize: 13, fontWeight: '600', marginRight: 8, minWidth: 100, textTransform: 'uppercase', letterSpacing: 0.3 }
  ,compactDetailValue: { fontSize: 14, fontWeight: '500', flex: 1 }
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
  ,whatsappIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', marginLeft: 10 }
  ,whatsappIconText: { fontSize: 16, color: '#fff' }
  
  // Loading skeleton styles
  ,loadingSkeleton: { flex: 1, paddingVertical: 8 }
  ,skeletonItem: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderWidth: 1, 
    borderRadius: 8, 
    marginBottom: 8,
    backgroundColor: '#fff'
  }
  ,skeletonLine: { 
    height: 16, 
    borderRadius: 4, 
    width: '70%' 
  }
});


