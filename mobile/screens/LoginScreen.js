import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Dimensions,
  Animated
} from 'react-native';
import { useColorScheme, StatusBar } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = {
    bg: isDark ? '#0b1220' : '#0f172a',
    cardBg: isDark ? '#111827' : '#ffffff',
    textPrimary: isDark ? '#e5e7eb' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#475569',
    inputBg: isDark ? '#0f172a' : '#f8fafc',
    inputBorder: isDark ? '#1f2937' : '#e2e8f0',
    accent: '#2563eb',
    muted: isDark ? '#9ca3af' : '#64748b',
    surfaceBorder: isDark ? '#1f2937' : '#E5E7EB',
    danger: '#dc2626'
  };
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onLogin = async () => {
    if (!identifier || !password) { setError('Email/phone and password required'); return; }
    setLoading(true); setError('');
    try {
      const isEmail = identifier.includes('@');
      const body = { password };
      if (isEmail) body.email = identifier.trim(); else body.phoneNumber = identifier.trim();

      // Try repo agent login first
      try {
        const res = await axios.post(`${getBaseURL()}/api/tenant/users/agents/login`, body);
        const payload = res?.data;
        const token = payload?.data?.token;
        const agent = payload?.data?.agent;
        if (!token || !agent) {
          throw new Error(payload?.message || 'Login failed');
        }
        await SecureStore.setItemAsync('token', token);
        // Fetch current profile to get agentCode via /me
        try {
          const me = await axios.get(`${getBaseURL()}/api/tenant/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const full = me?.data?.data || {};
          const merged = { ...agent, agentCode: full.agentCode, agentId: full.agentId, staffCode: full.staffCode, staffId: full.staffId };
          await SecureStore.setItemAsync('agent', JSON.stringify(merged));
        } catch (_) {
          await SecureStore.setItemAsync('agent', JSON.stringify(agent));
        }
        navigation.replace('Dashboard');
        return;
      } catch (agentErr) {
        // If not email, attempt office staff login using phone number
        if (!isEmail) {
          const staffBody = { phoneNumber: identifier.trim(), password };
          const staffRes = await axios.post(`${getBaseURL()}/api/tenant/users/staff/login`, staffBody);
          const payload = staffRes?.data;
          const token = payload?.data?.token;
          const staff = payload?.data?.staff;
          if (!token || !staff) {
            throw new Error(payload?.message || 'Login failed');
          }
          const agentLike = {
            id: staff.id,
            name: staff.name,
            email: null,
            phoneNumber: staff.phoneNumber,
            status: staff.status,
            role: staff.role || 'office_staff',
            tenantName: staff.tenantName
          };
          await SecureStore.setItemAsync('token', token);
          // Fetch current profile to get staffCode via /me
          try {
            const me = await axios.get(`${getBaseURL()}/api/tenant/users/me`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const full = me?.data?.data || {};
            const merged = { ...agentLike, agentCode: full.agentCode, agentId: full.agentId, staffCode: full.staffCode, staffId: full.staffId };
            await SecureStore.setItemAsync('agent', JSON.stringify(merged));
          } catch (_) {
            await SecureStore.setItemAsync('agent', JSON.stringify(agentLike));
          }
          navigation.replace('Dashboard');
          return;
        }
        throw agentErr;
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.card, { backgroundColor: theme.cardBg, opacity: fadeAnim, transform: [{ translateY: slideAnim }], borderColor: theme.surfaceBorder }]}> 
            <Text style={[styles.brand, { color: theme.accent }]}></Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Rapid Repo</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in to continue</Text>

            {!!error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.muted }]}>Email or Phone</Text>
              <TextInput
                placeholder="98XXXXXXXX"
                autoCapitalize="none"
                keyboardType="default"
                value={identifier}
                onChangeText={setIdentifier}
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.muted }]}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showBtn}>
                  <Text style={[styles.showBtnText, { color: theme.accent }]}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity disabled={loading} onPress={onLogin} style={[styles.primaryBtn, { backgroundColor: theme.accent }, loading && styles.primaryBtnDisabled]}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </TouchableOpacity>

            <Text style={[styles.helperText, { color: theme.muted }]}>Use your registered email or phone number</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6
  },
  brand: { fontSize: 20, fontWeight: '800', color: '#2563eb', textAlign: 'center', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 20 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 10 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  showBtn: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 10 },
  showBtnText: { color: '#2563eb', fontWeight: '700' },
  primaryBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  helperText: { textAlign: 'center', color: '#64748b', marginTop: 12 },
  error: { color: '#dc2626', textAlign: 'center', marginBottom: 12 }
});





