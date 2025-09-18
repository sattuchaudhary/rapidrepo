import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

export default function IDCardScreen({ navigation }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('agent');
        if (stored) setAgent(JSON.parse(stored));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F111A" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ID Card</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/icon.png')} style={styles.brandLogo} />
          <View style={{ flex: 1 }} />
          <Text style={styles.badge}>REPO AGENT</Text>
        </View>

        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(agent?.name)}</Text>
          </View>
          <View style={{ marginLeft: 16 }}>
            <Text style={styles.nameText}>{agent?.name || '—'}</Text>
            <Text style={styles.subtle}>ID: {agent?._id || '—'}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.key}>Organization</Text>
          <Text style={styles.val}>{agent?.tenantName || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Email</Text>
          <Text style={styles.val}>{agent?.email || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Phone</Text>
          <Text style={styles.val}>{agent?.phoneNumber || '—'}</Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.issuer}>Issued by RapidRepo</Text>
          <Text style={styles.subtle}>Valid company ID required</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F111A' },
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
  backIcon: { color: '#fff', fontSize: 24, fontWeight: '600', marginLeft: -2 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  cardWrap: {
    margin: 20,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
    padding: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  brandLogo: { width: 36, height: 36, borderRadius: 8 },
  badge: {
    backgroundColor: '#4F46E5',
    color: '#fff',
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
  },
  avatarBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  nameText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtle: { color: '#9CA3AF', marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B1220',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  key: { color: '#9CA3AF' },
  val: { color: '#fff', fontWeight: '600' },
  footerRow: { marginTop: 8 },
  issuer: { color: '#E5E7EB', fontWeight: '600' },
});






