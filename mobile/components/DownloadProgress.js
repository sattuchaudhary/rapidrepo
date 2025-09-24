import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import SimpleProgressBar from './SimpleProgressBar';

const DownloadProgress = ({ visible = false, progress = null, onCancel = null }) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (progress && typeof progress === 'object' && typeof progress.percentage === 'number') {
      const safePercentage = Math.max(0, Math.min(100, progress.percentage));
      setDisplayProgress(safePercentage);
    } else {
      setDisplayProgress(0);
    }
  }, [progress]);

  const formatNumber = (num) => {
    return num ? num.toLocaleString() : '0';
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Downloading Data</Text>
          
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {formatNumber(progress?.processed || 0)} / {formatNumber(progress?.total || 0)} records
            </Text>
            
            <SimpleProgressBar 
              progress={displayProgress}
              height={8}
              color="#4CAF50"
              backgroundColor="#E0E0E0"
            />
            
            <Text style={styles.percentageText}>{displayProgress}%</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.statusText}>
              {displayProgress === 100 ? 'Finalizing...' : 'Processing data...'}
            </Text>
          </View>
          
          {onCancel && (
            <Text style={styles.cancelText} onPress={onCancel}>
              Cancel
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  cancelText: {
    color: '#FF5722',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default DownloadProgress;
