import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import SyncManager from '../utils/SyncManager';
import SimpleProgressBar from './SimpleProgressBar';

const GlobalSyncOverlay = () => {
  const [{ isSyncing, progress }, setState] = useState(SyncManager.getState());
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const unsub = SyncManager.subscribe((state) => setState(state));
    return unsub;
  }, []);

  if (!isSyncing) return null;

  const percentage = Math.max(0, Math.min(100, progress?.percentage || 0));

  if (minimized) {
    return (
      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity style={styles.fab} onPress={() => setMinimized(false)}>
          <Text style={styles.fabText}>{percentage}%</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Sync in progress</Text>
          <Text style={styles.subtitle}>
            {(progress?.processed || 0).toLocaleString()} / {(progress?.total || 0).toLocaleString()} records
          </Text>
          <SimpleProgressBar progress={percentage} height={10} />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => setMinimized(true)}>
              <Text style={styles.btnText}>Minimize</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  btnText: { color: 'white', fontWeight: 'bold' },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    left: 0,
    top: 0,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  fabText: { color: 'white', fontWeight: 'bold' },
});

export default GlobalSyncOverlay;




