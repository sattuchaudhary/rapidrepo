// import React, { useEffect, useState } from 'react';
// import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
// import * as SecureStore from 'expo-secure-store';

// export default function ProfileScreen({ navigation }) {
//   const [agent, setAgent] = useState(null);
//   useEffect(() => {
//     (async () => {
//       const stored = await SecureStore.getItemAsync('agent');
//       if (stored) setAgent(JSON.parse(stored));
//     })();
//   }, []);

//   return (
//     <SafeAreaView style={styles.container}>
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{'‹'}</Text></TouchableOpacity>
//         <Text style={styles.title}>Profile</Text>
//         <View style={{ width: 20 }} />
//       </View>
//       <View style={styles.card}>
//         <Text style={styles.key}>Name</Text>
//         <Text style={styles.val}>{agent?.name || '-'}</Text>
//         <Text style={styles.key}>Email</Text>
//         <Text style={styles.val}>{agent?.email || '-'}</Text>
//         <Text style={styles.key}>Phone</Text>
//         <Text style={styles.val}>{agent?.phoneNumber || '-'}</Text>
//         <Text style={styles.key}>Tenant</Text>
//         <Text style={styles.val}>{agent?.tenantName || '-'}</Text>
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#10121A', padding: 16 },
//   header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
//   back: { color: '#fff', fontSize: 24, fontWeight: '800' },
//   title: { color: '#fff', fontSize: 18, fontWeight: '800' },
//   card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
//   key: { color: '#666', marginTop: 8 },
//   val: { color: '#111', fontWeight: '700' }
// });



import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, StatusBar, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import VersionChecker from '../components/VersionChecker';
import UpdateNotification from '../components/UpdateNotification';
import { getBaseURL } from '../utils/config';
import axios from 'axios';
import { maskPhoneNumber } from '../utils/format';

export default function ProfileScreen({ navigation }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remainingMs, setRemainingMs] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [stats, setStats] = useState({
    totalSearches: 0,
    totalShares: 0,
    lastSync: null
  });

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('agent');
        if (stored) setAgent(JSON.parse(stored));
        
        // Load user statistics
        await loadUserStats();
        await loadSubscriptionRemaining();
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadUserStats = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      const response = await axios.get(`${getBaseURL()}/api/history/user-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadSubscriptionRemaining = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      const res = await axios.get(`${getBaseURL()}/api/tenants/subscription/remaining`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const remaining = res?.data?.data?.remainingMs || 0;
      const end = res?.data?.data?.endDate || null;
      setRemainingMs(remaining);
      setEndDate(end ? new Date(end) : null);
    } catch (_) {}
  };

  const ProfileField = ({ icon, label, value }) => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldIcon}>{icon}</Text>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <Text style={styles.fieldValue}>{value || 'Not available'}</Text>
    </View>
  );

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleUpdateAvailable = (updateData) => {
    setUpdateInfo(updateData);
    setShowUpdateModal(true);
  };

  const handleUpdateModalClose = () => {
    setShowUpdateModal(false);
    setUpdateInfo(null);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync('token');
              await SecureStore.deleteItemAsync('agent');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all offline data and cached files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              const offlineDataPath = `${FileSystem.documentDirectory}offline_data.json`;
              const exists = await FileSystem.getInfoAsync(offlineDataPath);
              if (exists.exists) {
                await FileSystem.deleteAsync(offlineDataPath);
              }
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              console.error('Clear cache error:', error);
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };

  const handleSyncData = async () => {
    try {
      Alert.alert('Sync', 'Syncing data...');
      // Add sync logic here
      await loadUserStats();
      Alert.alert('Success', 'Data synced successfully');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync data');
    }
  };

  const handleContactSupport = () => {
    const phoneNumber = '+91-9876543210'; // Replace with actual support number
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer');
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F111A" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F111A" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(agent?.name)}</Text>
          </View>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.nameText}>{agent?.name || 'User'}</Text>
        </View>

        {/* Profile Information Card */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <ProfileField 
            icon="👤"
            label="Full Name"
            value={agent?.name}
          />
          
          <ProfileField 
            icon="📧"
            label="Email Address"
            value={agent?.email}
          />
          
          <ProfileField 
            icon="📱"
            label="Phone Number"
            value={agent?.phoneNumber ? maskPhoneNumber(agent.phoneNumber) : undefined}
          />
          
          <ProfileField 
            icon="🏢"
            label="Organization"
            value={agent?.tenantName}
          />

          <ProfileField 
            icon="🎭"
            label="Role"
            value={agent?.role || agent?.designation || agent?.userType || 'User'}
          />
        </View>

        {/* Subscription Info */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <ProfileField 
            icon="⏳"
            label="Status"
            value={remainingMs != null ? (remainingMs > 0 ? 'Active' : 'Expired') : 'Loading...'}
          />
          <ProfileField 
            icon="📅"
            label="Ends On"
            value={endDate ? endDate.toLocaleString() : '—'}
          />
          <ProfileField 
            icon="🕒"
            label="Time Remaining"
            value={remainingMs != null ? `${Math.floor(remainingMs / (1000*60*60*24))}d ${Math.floor((remainingMs/(1000*60*60))%24)}h` : '—'}
          />
          <TouchableOpacity style={[styles.actionButton, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => navigation.navigate('Payment')}>
            <Text style={styles.actionIcon}>💳</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Renew / Submit Payment</Text>
              <Text style={styles.actionSubtitle}>Proceed to payment submission</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Statistics Card */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Activity Summary</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalSearches}</Text>
              <Text style={styles.statLabel}>Total Searches</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalShares}</Text>
              <Text style={styles.statLabel}>Total Shares</Text>
            </View>
          </View>

          {stats.lastSync && (
            <View style={styles.lastSyncContainer}>
              <Text style={styles.lastSyncLabel}>Last Sync:</Text>
              <Text style={styles.lastSyncValue}>
                {new Date(stats.lastSync).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={handleSyncData}>
            <Text style={styles.actionIcon}>🔄</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Sync Data</Text>
              <Text style={styles.actionSubtitle}>Refresh your data</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={handleClearCache}>
            <Text style={styles.actionIcon}>🗑️</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Clear Cache</Text>
              <Text style={styles.actionSubtitle}>Free up storage space</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.actionIcon}>⚙️</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Sync Settings</Text>
              <Text style={styles.actionSubtitle}>Manage background sync</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={handleContactSupport}>
            <Text style={styles.actionIcon}>📞</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Contact Support</Text>
              <Text style={styles.actionSubtitle}>Get help from our team</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.accountCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <View style={styles.logoutContent}>
              <Text style={styles.logoutTitle}>Logout</Text>
              <Text style={styles.logoutSubtitle}>Sign out of your account</Text>
            </View>
            <Text style={styles.logoutChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Version Checker Section */}
        <View style={styles.versionSection}>
          <VersionChecker onUpdateAvailable={handleUpdateAvailable} />
        </View>
      </ScrollView>

      {/* Update Notification Modal */}
      <UpdateNotification
        visible={showUpdateModal}
        onClose={handleUpdateModalClose}
        updateInfo={updateInfo}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F111A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D29',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1A1D29',
  },
  backIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    marginLeft: -2,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  welcomeText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 4,
  },
  nameText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#1A1D29',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  actionsCard: {
    backgroundColor: '#1A1D29',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  statsCard: {
    backgroundColor: '#1A1D29',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  accountCard: {
    backgroundColor: '#1A1D29',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  fieldLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  fieldValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    paddingLeft: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  actionSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  actionChevron: {
    color: '#6B7280',
    fontSize: 20,
    fontWeight: '600',
  },
  versionSection: {
    backgroundColor: '#1A1D29',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    color: '#4F46E5',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  lastSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
  },
  lastSyncLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginRight: 8,
  },
  lastSyncValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  logoutContent: {
    flex: 1,
  },
  logoutTitle: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  logoutSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  logoutChevron: {
    color: '#6B7280',
    fontSize: 20,
    fontWeight: '600',
  },
});



