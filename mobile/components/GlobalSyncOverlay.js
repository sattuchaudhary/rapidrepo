import React from 'react';
import { StyleSheet } from 'react-native';

const GlobalSyncOverlay = () => {
  return null;
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




