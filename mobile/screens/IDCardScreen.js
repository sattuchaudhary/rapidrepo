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

      <View style={styles.cardOuter}>
        <View style={styles.cardHeader}>
          <Image source={require('../assets/icon.png')} style={styles.headerLogo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerOrg} numberOfLines={1}>{agent?.tenantName || 'RapidRepo Tenant'}</Text>
            <Text style={styles.headerTitle}>Identity Card</Text>
          </View>
          <Text style={styles.headerBadge}>AGENT</Text>
        </View>

        <View style={styles.photoWrap}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgText}>{getInitials(agent?.name)}</Text>
          </View>
        </View>

        <View style={styles.detailsWrap}>
          <Text style={styles.personName} numberOfLines={1}>{agent?.name || '—'}</Text>
          <Text style={styles.personId} numberOfLines={1}>ID: {agent?._id || '—'}</Text>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldKey}>Organization</Text>
            <Text style={styles.fieldVal} numberOfLines={1}>{agent?.tenantName || '—'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldKey}>Email</Text>
            <Text style={styles.fieldVal} numberOfLines={1}>{agent?.email || '—'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldKey}>Phone</Text>
            <Text style={styles.fieldVal} numberOfLines={1}>{agent?.phoneNumber || '—'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.divider} />
          <View style={styles.footerRow2}>
            <Text style={styles.issuerText}>Issued by RapidRepo</Text>
            <Text style={styles.validityText}>Valid Company ID Required</Text>
          </View>
          <View style={styles.barcode}>
            <View style={styles.bar} />
            <View style={[styles.bar, { height: 18 }]} />
            <View style={[styles.bar, { height: 26 }]} />
            <View style={[styles.bar, { height: 14 }]} />
            <View style={[styles.bar, { height: 22 }]} />
            <View style={[styles.bar, { height: 16 }]} />
            <View style={[styles.bar, { height: 28 }]} />
            <View style={[styles.bar, { height: 12 }]} />
            <View style={[styles.bar, { height: 24 }]} />
          </View>
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
  cardOuter: {
    marginHorizontal: 20,
    marginVertical: 24,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    alignSelf: 'center',
    width: '88%',
    aspectRatio: 0.62,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6
  },
  cardHeader: {
    backgroundColor: '#0B2A6F',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerLogo: { width: 32, height: 32, borderRadius: 6, marginRight: 6 },
  headerOrg: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  headerTitle: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  headerBadge: { color: '#0B2A6F', backgroundColor: '#FACC15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: '900', fontSize: 10 },
  photoWrap: { alignItems: 'center', marginTop: -22 },
  avatarLg: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#ffffff' },
  avatarLgText: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  detailsWrap: { paddingHorizontal: 16, paddingTop: 8, flex: 1 },
  personName: { color: '#0F172A', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  personId: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 2 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  fieldKey: { color: '#64748B', fontSize: 12 },
  fieldVal: { color: '#0F172A', fontSize: 13, fontWeight: '700', marginLeft: 10, flexShrink: 1, textAlign: 'right' },
  cardFooter: { paddingHorizontal: 12, paddingVertical: 8 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 10, marginBottom: 8 },
  footerRow2: { alignItems: 'center' },
  issuerText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  validityText: { color: '#6B7280', fontSize: 10, marginTop: 2 },
  barcode: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginTop: 6 },
  bar: { width: 4, height: 20, backgroundColor: '#111827', borderRadius: 1 }
});






