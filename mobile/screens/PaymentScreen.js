import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, StatusBar, Image } from 'react-native';
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
        setQrUrl(cfg.qrCodeImageUrl || '');
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

      <View style={styles.card}>
        {!!qrUrl && (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Image source={{ uri: qrUrl }} style={{ width: 180, height: 180, borderRadius: 12 }} resizeMode="contain" />
          </View>
        )}
        {!!payeeName && <Text style={styles.helper}>Payee: {payeeName}</Text>}
        {!!upiId && <Text style={styles.helper}>UPI ID: {upiId}</Text>}
        {!!instructions && <Text style={styles.helper}>{instructions}</Text>}

        <Text style={styles.sectionTitle}>Choose Plan</Text>
        <View style={styles.planRow}>
          <PlanButton value="weekly" label="Weekly" />
          <PlanButton value="monthly" label="Monthly" />
          <PlanButton value="quarterly" label="Quarterly" />
          <PlanButton value="yearly" label="Yearly" />
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

      <View style={styles.info}>
        <Text style={styles.infoText}>Current status: {subRemaining && subRemaining > 0 ? `Active • ends ${subEnd ? subEnd.toLocaleDateString() : ''} (${formatRemaining()} left)` : 'Expired'}</Text>
        <TouchableOpacity onPress={fetchRemaining}><Text style={styles.refresh}>Refresh</Text></TouchableOpacity>
      </View>
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
  helper: { color: '#9CA3AF', marginBottom: 6 }
});


