import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import versionManager from '../utils/versionManager';

const { width, height } = Dimensions.get('window');

const UpdateNotification = ({ visible, onClose, updateInfo }) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  const handleUpdate = () => {
    if (updateInfo?.downloadUrl) {
      Linking.openURL(updateInfo.downloadUrl).catch(err => {
        Alert.alert('Error', 'Unable to open download link');
        console.error('Failed to open URL:', err);
      });
    } else {
      Alert.alert(
        'Update Available',
        'Please update the app from your app store.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleDismiss = async () => {
    if (updateInfo?.latestVersion) {
      await versionManager.dismissUpdate(updateInfo.latestVersion);
    }
    setIsVisible(false);
    onClose();
  };

  const handleLater = () => {
    setIsVisible(false);
    onClose();
  };

  if (!isVisible || !updateInfo) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={updateInfo.forceUpdate ? undefined : handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.gradient}
          >
            <View style={styles.header}>
              <Text style={styles.title}>
                {updateInfo.forceUpdate ? 'Update Required' : 'Update Available'}
              </Text>
              <Text style={styles.versionText}>
                v{updateInfo.latestVersion}
              </Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={styles.message}>
                {updateInfo.updateMessage || 
                  `A new version of Rapid Repo is available. Update to get the latest features and improvements.`}
              </Text>

              <View style={styles.versionInfo}>
                <Text style={styles.versionLabel}>Current Version:</Text>
                <Text style={styles.currentVersion}>v{updateInfo.currentVersion}</Text>
              </View>

              <View style={styles.versionInfo}>
                <Text style={styles.versionLabel}>Latest Version:</Text>
                <Text style={styles.latestVersion}>v{updateInfo.latestVersion}</Text>
              </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
              {!updateInfo.forceUpdate && (
                <TouchableOpacity
                  style={[styles.button, styles.laterButton]}
                  onPress={handleLater}
                >
                  <Text style={styles.laterButtonText}>Later</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.updateButton]}
                onPress={handleUpdate}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.updateButtonGradient}
                >
                  <Text style={styles.updateButtonText}>
                    {updateInfo.forceUpdate ? 'Update Now' : 'Update'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {!updateInfo.forceUpdate && (
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismiss}
              >
                <Text style={styles.dismissText}>Don't show again</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width * 0.9,
    maxHeight: height * 0.7,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    padding: 0,
  },
  header: {
    padding: 20,
    paddingBottom: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  versionText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  content: {
    padding: 20,
    maxHeight: height * 0.3,
  },
  message: {
    fontSize: 16,
    color: '#e0e0e0',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  versionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginBottom: 10,
  },
  versionLabel: {
    fontSize: 14,
    color: '#b0b0b0',
    fontWeight: '500',
  },
  currentVersion: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '600',
  },
  latestVersion: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 10,
    gap: 15,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  laterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  laterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  updateButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dismissButton: {
    padding: 15,
    alignItems: 'center',
  },
  dismissText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default UpdateNotification;
