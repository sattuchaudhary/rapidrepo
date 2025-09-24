import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { listVehiclesPage, countVehicles } from '../utils/db';

export default function OfflineDataBrowser({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  useEffect(() => {
    (async () => {
      try {
        const cnt = await countVehicles();
        setTotal(cnt || 0);
      } catch (_) {}
    })();
  }, []);

  const loadPage = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const offset = page * PAGE_SIZE;
      const rows = await listVehiclesPage(offset, PAGE_SIZE);
      const next = [...items, ...rows];
      setItems(next);
      setPage(page + 1);
      if (!rows || rows.length < PAGE_SIZE) setHasMore(false);
    } catch (_) {}
    setLoading(false);
  }, [loading, hasMore, page, items]);

  useEffect(() => { loadPage(); }, []);

  const renderItem = ({ item }) => (
    <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#EEE' }}>
      <Text style={{ fontWeight: '800', fontSize: 16 }}>{item.regNo || '—'}</Text>
      <Text style={{ color: '#555' }}>{item.chassisNo || '—'}</Text>
      <Text style={{ color: '#777', fontSize: 12 }}>{item.customerName || '—'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>Offline Data ({total.toLocaleString()})</Text>
        <TouchableOpacity onPress={() => { setItems([]); setPage(0); setHasMore(true); loadPage(); }} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#222636', borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it, idx) => String(it?._id || `${it?.regNo || 'unknown'}#${it?.chassisNo || 'unknown'}#${idx}`)}
        renderItem={renderItem}
        onEndReachedThreshold={0.4}
        onEndReached={() => loadPage()}
        ListFooterComponent={loading ? (
          <View style={{ padding: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}


