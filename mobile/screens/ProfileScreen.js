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
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import VersionChecker from '../components/VersionChecker';
import UpdateNotification from '../components/UpdateNotification';

export default function ProfileScreen({ navigation }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('agent');
        if (stored) setAgent(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
            value={agent?.phoneNumber}
          />
          
          <ProfileField 
            icon="🏢"
            label="Organization"
            value={agent?.tenantName}
          />
        </View>

        {/* Additional Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>✏️</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Edit Profile</Text>
              <Text style={styles.actionSubtitle}>Update your information</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🔒</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Privacy Settings</Text>
              <Text style={styles.actionSubtitle}>Manage your privacy</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>❓</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Help & Support</Text>
              <Text style={styles.actionSubtitle}>Get assistance</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
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
});



