import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, StatusBar, Image, Modal, Share } from 'react-native';
import { Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';

export default function PaymentScreen({ navigation }) {
  const [planPeriod, setPlanPeriod] = useState('monthly');
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [subRemaining, setSubRemaining] = useState(null);
  const [subEnd, setSubEnd] = useState(null);
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [planPrices, setPlanPrices] = useState({});
  const [qrVisible, setQrVisible] = useState(false);

  const fetchRemaining = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      const res = await axios.get(`${getBaseURL()}/api/tenants/subscription/remaining`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const remainingMs = res?.data?.data?.remainingMs || 0;
      const endDate = res?.data?.data?.endDate || null;
      setSubRemaining(remainingMs);
      setSubEnd(endDate ? new Date(endDate) : null);
    } catch (_) {}
  };

  useEffect(() => {
    fetchRemaining();
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        const res = await axios.get(`${getBaseURL()}/api/tenants/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const cfg = res?.data?.data?.paymentConfig || {};
        setUpiId(cfg.upiId || '');
        setPayeeName(cfg.payeeName || '');
        const rawQr = cfg.qrCodeImageUrl || '';
        const absoluteQr = normalizeQrUrl(rawQr);
        setQrUrl(absoluteQr);
        setInstructions(cfg.instructions || '');
        setPlanPrices(cfg.planPrices || {});
        const defaultPrice = cfg.planPrices?.[planPeriod];
        if (defaultPrice != null) setAmount(String(defaultPrice));
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    const price = planPrices?.[planPeriod];
    if (price != null) setAmount(String(price));
  }, [planPeriod, planPrices]);

  const submit = async () => {
    try {
      if (!amount || !transactionId) {
        Alert.alert('Required', 'Amount and Transaction ID are required');
        return;
      }
      const token = await SecureStore.getItemAsync('token');
      if (!token) { Alert.alert('Login required', 'Please login again'); return; }
      const body = { planPeriod, amount: Number(amount), transactionId, notes };
      const res = await axios.post(`${getBaseURL()}/api/payments/submit`, body, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        Alert.alert('Submitted', 'Payment submitted for approval');
        navigation.goBack();
      } else {
        Alert.alert('Failed', res.data?.message || 'Submission failed');
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || e.message);
    }
  };

  const normalizeQrUrl = (url) => {
    if (!url) return '';
    // Server relative path -> prefix base URL
    if (url.startsWith('/')) return `${getBaseURL()}${url}`;
    // Google Drive share links -> convert to direct view link
    // Formats: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // or https://drive.google.com/open?id=FILE_ID
    try {
      if (url.includes('drive.google.com')) {
        let id = '';
        const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        id = (m1 && m1[1]) || (m2 && m2[1]) || '';
        if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
      }
    } catch (_) {}
    return url;
  };

  const copyUpi = async () => {
    if (!upiId) return;
    try {
      await Share.share({ message: upiId });
    } catch (_) {}
  };

  const openUpiIntent = () => {
    if (!upiId) { Alert.alert('Missing UPI', 'UPI ID is not configured'); return; }
    const amt = amount && Number(amount) > 0 ? Number(amount).toFixed(2) : '';
    const note = notes ? encodeURIComponent(notes) : encodeURIComponent('RapidRepo Subscription');
    const pn = encodeURIComponent(payeeName || '');
    const pa = encodeURIComponent(upiId);
    const url = `upi://pay?pa=${pa}&pn=${pn}${amt ? `&am=${amt}` : ''}&tn=${note}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('UPI App Not Found', 'Install any UPI app (GPay/PhonePe/Paytm) and try again.');
    });
  };

  const PlanButton = ({ value, label }) => (
    <TouchableOpacity
      style={[styles.planBtn, planPeriod === value && styles.planBtnActive]}
      onPress={() => setPlanPeriod(value)}
    >
      <Text style={[styles.planBtnText, planPeriod === value && styles.planBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const formatRemaining = () => {
    if (subRemaining == null) return '';
    const days = Math.floor(subRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((subRemaining / (1000 * 60 * 60)) % 24);
    return `${days}d ${hours}h`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F111A" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{'‹'}</Text></TouchableOpacity>
        <Text style={styles.title}>Subscription Payment</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        {!!qrUrl && (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setQrVisible(true)} activeOpacity={0.8}>
              <Image 
                source={{ uri: qrUrl }} 
                style={{ width: 180, height: 180, borderRadius: 12 }} 
                resizeMode="contain"
                onError={() => setQrUrl('')}
              />
            </TouchableOpacity>
            <Text style={[styles.helper, { marginTop: 6 }]}>Tap to enlarge QR</Text>
          </View>
        )}
        {!!payeeName && <Text style={styles.helper}>Payee: {payeeName}</Text>}
        {!!upiId && (
          <View style={{ marginBottom: 8 }}>
            <Text selectable style={styles.helper}>UPI ID: {upiId}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity style={styles.smallBtn} onPress={copyUpi}><Text style={styles.smallBtnText}>Copy UPI</Text></TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={openUpiIntent}><Text style={styles.smallBtnText}>Pay in UPI App</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {!!instructions && <Text style={styles.helper}>{instructions}</Text>}

        <Text style={styles.sectionTitle}>Choose Plan</Text>
        <View style={styles.planRow}>
          <PlanButton value="weekly" label={`Weekly${planPrices.weekly!=null?` • ₹${planPrices.weekly}`:''}`} />
          <PlanButton value="monthly" label={`Monthly${planPrices.monthly!=null?` • ₹${planPrices.monthly}`:''}`} />
          <PlanButton value="quarterly" label={`Quarterly${planPrices.quarterly!=null?` • ₹${planPrices.quarterly}`:''}`} />
          <PlanButton value="yearly" label={`Yearly${planPrices.yearly!=null?` • ₹${planPrices.yearly}`:''}`} />
        </View>

        <Text style={styles.label}>Amount</Text>
        <TextInput 
          style={styles.input} 
          keyboardType="numeric" 
          value={amount} 
          onChangeText={setAmount} 
          placeholder="e.g. 499" 
          editable={!(planPrices && planPrices[planPeriod] != null)}
        />

        <Text style={styles.label}>Transaction ID</Text>
        <TextInput style={styles.input} value={transactionId} onChangeText={setTransactionId} placeholder="Txn/UPI Ref ID" autoCapitalize="characters" />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput style={[styles.input, { height: 90 }]} multiline value={notes} onChangeText={setNotes} placeholder="Anything for admin" />

        <TouchableOpacity style={styles.submitBtn} onPress={submit}>
          <Text style={styles.submitText}>Submit for Approval</Text>
        </TouchableOpacity>
      </View>

      {/* QR Fullscreen Modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setQrVisible(false)} />
          <View style={styles.modalCard}>
            {qrUrl ? (
              <Image source={{ uri: qrUrl }} style={{ width: 280, height: 280, borderRadius: 16 }} resizeMode="contain" />
            ) : (
              <Text style={{ color: '#fff' }}>QR not available</Text>
            )}
            <TouchableOpacity style={[styles.smallBtn, { marginTop: 12 }]} onPress={() => setQrVisible(false)}>
              <Text style={styles.smallBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.info}>
        <Text style={styles.infoText}>Current status: {subRemaining && subRemaining > 0 ? `Active • ends ${subEnd ? subEnd.toLocaleDateString() : ''} (${formatRemaining()} left)` : 'Expired'}</Text>
        <TouchableOpacity onPress={fetchRemaining}><Text style={styles.refresh}>Refresh</Text></TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F111A', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  back: { color: '#fff', fontSize: 24, fontWeight: '800' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  card: { backgroundColor: '#1A1D29', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2D3748' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  planRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  planBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  planBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4338CA' },
  planBtnText: { color: '#E5E7EB', fontWeight: '700' },
  planBtnTextActive: { color: '#fff' },
  label: { color: '#9CA3AF', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#0f172a', borderColor: '#1f2937', color: '#fff', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  submitBtn: { backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '800' },
  info: { alignItems: 'center', marginTop: 12 },
  infoText: { color: '#9CA3AF' },
  refresh: { color: '#60A5FA', marginTop: 6 },
  helper: { color: '#9CA3AF', marginBottom: 6 },
  scrollContent: { paddingBottom: 32 }
});

// Extend styles for modal and small buttons
Object.assign(styles, {
  smallBtn: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: '#e5e7eb', fontWeight: '700' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: { backgroundColor: '#111827', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#374151' }
});


