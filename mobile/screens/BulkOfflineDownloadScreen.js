import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initDatabase, countVehicles } from '../utils/db';
import { singleClickPerFileSync, getPerFileSyncStatus, downloadAllViaChunks } from '../utils/fileSync';
import { getBaseURL, setBaseURLOverride } from '../utils/config';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export default function BulkOfflineDownloadScreen() {
  const insets = useSafeAreaInsets();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [inserted, setInserted] = useState(0);
  const [localCount, setLocalCount] = useState(0);
  const [serverTotal, setServerTotal] = useState(0);
  const [localDownloaded, setLocalDownloaded] = useState(0);
  const [filesInfo, setFilesInfo] = useState({ serverFileCount: 0, localFileCount: 0 });
  const [mirrorDeletes, setMirrorDeletes] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      try {
        await initDatabase();
        const cnt = await countVehicles();
        if (isMountedRef.current) setLocalCount(cnt || 0);
        await refreshServerStats();
      } catch (e) {}
    })();
    return () => { isMountedRef.current = false; };
  }, []);

  const refreshServerStats = useCallback(async () => {
    try {
      const s = await getPerFileSyncStatus();
      if (!isMountedRef.current) return;
      setServerTotal(s?.totalServer || 0);
      setLocalDownloaded(s?.totalLocal || 0);
      setFilesInfo({ serverFileCount: s?.serverFileCount || 0, localFileCount: s?.localFileCount || 0 });
    } catch (_) {}
  }, []);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setProgressPct(0);
    setInserted(0);
    setStatusText('Starting...');

    try {
      // Preflight diagnostics
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        throw new Error('Not logged in (no token). Please login again.');
      }

      const net = await NetInfo.fetch();
      if (!net?.isConnected || !net?.isInternetReachable) {
        throw new Error(`No internet connection. Connected: ${String(net?.isConnected)} Reachable: ${String(net?.isInternetReachable)}`);
      }

      // Ping health endpoint quickly
      const base = getBaseURL();
      try {
        await axios.get(`${base}/api/health`, { timeout: 2500 });
      } catch (pingErr) {
        // Fallback to api subdomain if primary host isn't reachable
        const alt = base.includes('api.') ? base.replace('api.', '') : base.replace('https://', 'https://api.');
        try {
          await axios.get(`${alt}/api/health`, { timeout: 2500 });
          setBaseURLOverride(alt);
        } catch (altErr) {
          const msg = pingErr?.message || altErr?.message || 'Ping failed';
          throw new Error(`API not reachable: ${msg}`);
        }
      }

      await initDatabase();
      // Prefer chunk-based download (bypasses file listing)
      const res = await downloadAllViaChunks((p) => {
        if (!isMountedRef.current) return;
        const pct = typeof p?.percentage === 'number' ? p.percentage : 0;
        setProgressPct(pct);
        setInserted(p?.inserted || 0);
        const current = p?.currentFile ? ` (${String(p.currentFile).slice(0, 28)})` : '';
        setStatusText(`Downloaded ${p?.downloadedRecords || 0}/${p?.totalRecords || 0}${current}`);
      }, 50000, { mirror: mirrorDeletes });

      await refreshServerStats();
      const cnt = await countVehicles();
      if (isMountedRef.current) setLocalCount(cnt || 0);
      if (res?.success) {
        setProgressPct((prev) => (prev < 99 ? 99 : prev));
        setStatusText('Finalizing...');
        setTimeout(() => { if (isMountedRef.current) setProgressPct(100); }, 500);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setStatusText('Download failed');
        const status = error?.response?.status;
        const serverMsg = error?.response?.data?.message || error?.response?.data?.error;
        const msg = [
          status ? `HTTP ${status}` : null,
          error?.code ? `Code: ${error.code}` : null,
          serverMsg ? `Server: ${serverMsg}` : null,
          error?.message || null,
          `Base URL: ${getBaseURL()}`
        ].filter(Boolean).join('\n');
        Alert.alert('Download failed', msg || 'Unknown error');
      }
    } finally {
      setTimeout(() => { if (isMountedRef.current) setIsDownloading(false); }, 600);
    }
  }, [isDownloading, refreshServerStats]);

  const Stat = ({ label, value }) => (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 }}>{(value || 0).toLocaleString()}</Text>
    </View>
  );

  const Progress = () => (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>Downloading</Text>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{Math.round(progressPct)}%</Text>
      </View>
      <View style={{ height: 10, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(100, progressPct))}%`, backgroundColor: '#22C55E', height: 10 }} />
      </View>
      {!!statusText && (
        <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>{statusText}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#10121A', paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 }}>Bulk Offline Download</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>Saare records offline save karne ke liye yeh process run karein. Isse fast offline search possible hoga.</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Stat label="Local Records" value={localCount} />
          <Stat label="Server Total" value={serverTotal} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Stat label="Downloaded (server calc)" value={localDownloaded} />
          <Stat label="Files (local/server)" value={`${filesInfo.localFileCount}/${filesInfo.serverFileCount}`} />
        </View>

        <View style={{ marginTop: 18 }}>
          <TouchableOpacity onPress={() => setMirrorDeletes(!mirrorDeletes)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: mirrorDeletes ? '#22C55E' : 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: mirrorDeletes ? 'rgba(34,197,94,0.25)' : 'transparent' }}>
              {mirrorDeletes ? <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#22C55E' }} /> : null}
            </View>
            <Text style={{ color: '#fff' }}>Mirror server deletions (extra step after download)</Text>
          </TouchableOpacity>
          {!isDownloading ? (
            <TouchableOpacity onPress={handleDownload} style={{ backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Start Bulk Download</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 14, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800' }}>Downloading...</Text>
            </View>
          )}
          <Progress />
        </View>

        <TouchableOpacity onPress={refreshServerStats} style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Refresh Stats</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}


