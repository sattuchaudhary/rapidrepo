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
  Animated,
  Button
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from '../utils/config';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
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
      const res = await axios.post(`${getBaseURL()}/api/tenant/users/agents/login`, body);
      const payload = res?.data;
      const token = payload?.data?.token;
      const agent = payload?.data?.agent;
      if (!token || !agent) {
        setError(payload?.message || 'Login failed');
        return;
      }
      await SecureStore.setItemAsync('token', token);
      await SecureStore.setItemAsync('agent', JSON.stringify(agent));
      navigation.replace('Dashboard');
    } catch (e) {
      setError(e.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Repo Agent Login</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TextInput placeholder="Email or Phone" autoCapitalize="none" keyboardType="default" value={identifier} onChangeText={setIdentifier} style={styles.input} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
      {loading ? <ActivityIndicator /> : <Button title="Login" onPress={onLogin} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 12 },
  error: { color: 'red', marginBottom: 8 }
});





