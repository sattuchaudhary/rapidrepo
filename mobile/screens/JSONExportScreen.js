import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import axios from 'axios';
import { getBaseURL } from '../utils/config';

export default function JSONExportScreen() {
	const [isDownloading, setIsDownloading] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [status, setStatus] = useState('');
	const [fileUri, setFileUri] = useState(null);
	const [meta, setMeta] = useState(null);

	const downloadJson = async () => {
		if (isDownloading) return;
		setIsDownloading(true);
		setStatus('Requesting dump...');
		setFileUri(null);
		setMeta(null);

		try {
			const token = await SecureStore.getItemAsync('token');
			if (!token) {
				Alert.alert('Login required', 'Please login again.');
				setIsDownloading(false);
				return;
			}

			const url = `${getBaseURL()}/api/tenant/data/offline-dump`;
			const res = await axios.get(url, {
				headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip, deflate' },
				timeout: 1200000,
				maxContentLength: 500 * 1024 * 1024,
				maxBodyLength: 500 * 1024 * 1024
			});

			if (!res?.data?.success) {
				throw new Error(res?.data?.message || 'Failed to get dump');
			}

			const payload = res.data;
			const data = payload.data || [];
			const tenant = payload.tenant || 'tenant';
			const total = payload.totalRecords || data.length || 0;
			setMeta({ tenant, total });
			setStatus(`Saving ${total.toLocaleString()} records...`);

			const jsonString = JSON.stringify({ tenant, totalRecords: total, data });
			const filename = `offline_dump_${tenant}_${Date.now()}.json`;
			const target = `${FileSystem.documentDirectory}${filename}`;
			await FileSystem.writeAsStringAsync(target, jsonString);
			setFileUri(target);
			setStatus('Saved successfully.');
			Alert.alert('Export Complete', `Saved ${total.toLocaleString()} records to ${filename}`);
		} catch (e) {
			console.error('JSON export failed:', e);
			Alert.alert('Export Failed', e?.message || 'Unknown error');
			setStatus('Failed');
		} finally {
			setIsDownloading(false);
		}
	};

	const shareFile = async () => {
		if (!fileUri) return;
		try {
			const available = await Sharing.isAvailableAsync();
			if (!available) {
				Alert.alert('Sharing Unavailable', 'Sharing is not available on this device');
				return;
			}
			await Sharing.shareAsync(fileUri);
		} catch (e) {
			Alert.alert('Share Failed', e?.message || 'Unable to share file');
		}
	};

	return (
		<ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1, backgroundColor: '#10121A' }}>
			<View style={{ padding: 16 }}>
				<Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12 }}>Export JSON Dump</Text>
				<Text style={{ color: '#9CA3AF', marginBottom: 16 }}>
					Downloads minimal fields of all vehicles for offline use as a JSON file.
				</Text>

				<View style={{ backgroundColor: '#1F2433', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2D3748', marginBottom: 16 }}>
					<Text style={{ color: '#E5E7EB', marginBottom: 6 }}>Endpoint</Text>
					<Text style={{ color: '#9CA3AF', fontSize: 12 }}>/api/tenant/data/offline-dump</Text>
				</View>

				{meta && (
					<View style={{ backgroundColor: '#1F2433', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2D3748', marginBottom: 16 }}>
						<Text style={{ color: '#E5E7EB' }}>Tenant: <Text style={{ fontWeight: '700' }}>{meta.tenant}</Text></Text>
						<Text style={{ color: '#E5E7EB' }}>Records: <Text style={{ fontWeight: '700' }}>{meta.total.toLocaleString()}</Text></Text>
					</View>
				)}

				<View style={{ flexDirection: 'row', gap: 10 }}>
					<TouchableOpacity
						style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
						onPress={downloadJson}
						disabled={isDownloading}
					>
						{isDownloading ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Text style={{ color: '#fff', fontWeight: '800' }}>Download JSON</Text>
						)}
					</TouchableOpacity>

					<TouchableOpacity
						style={{ flex: 1, backgroundColor: fileUri ? '#3B82F6' : '#334155', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
						onPress={shareFile}
						disabled={!fileUri}
					>
						<Text style={{ color: '#fff', fontWeight: '800' }}>Share File</Text>
					</TouchableOpacity>
				</View>
			</View>
		</ScrollView>
	);
}

