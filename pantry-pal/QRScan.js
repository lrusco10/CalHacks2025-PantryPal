import React, { useState } from 'react';
import {
  Text,
  View,
  Button,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { processBarcodeScan } from './processBarcodeScan';
import { Ionicons } from '@expo/vector-icons';

export default function QRScanner({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const [pendingItem, setPendingItem] = useState(null);
  const [isExisting, setIsExisting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [manualName, setManualName] = useState('');

  const [quantity, setQuantity] = useState('1');
  const [units, setUnits] = useState('unit');

  const [loading, setLoading] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 10 }}>
          We need your permission to use the camera
        </Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    try {
      const result = await processBarcodeScan(data, 0, units, true);
      setPendingItem(result.item);
      setIsExisting(result.existing);
      setNotFound(!result.existing && !result.found);
      setManualName('');
    } catch (e) {
      console.warn('Scan failed', e);
      Alert.alert('Error', 'Failed to process scan.');
    } finally {
      setLoading(false);
    }
  };

  const saveItem = async () => {
    if (!pendingItem) return;

    if (notFound && !manualName.trim()) {
      Alert.alert('Missing name', 'Please enter a name for this item.');
      return;
    }

    try {
      setLoading(true);
      await processBarcodeScan(
        pendingItem.upc,
        quantity,
        units,
        false,
        notFound ? { manualName } : {}
      );
      await new Promise((r) => setTimeout(r, 80));
      navigation.getParent()?.navigate('Pantry');
    } catch (e) {
      console.warn('Save failed', e);
      Alert.alert('Error', 'Failed to save item.');
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScanned(false);
    setPendingItem(null);
    setIsExisting(false);
    setNotFound(false);
    setManualName('');
    setQuantity('1');
    setUnits('unit');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {!pendingItem && (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'ean13'] }}
        />
      )}

      {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#4CAF50" />}

      {pendingItem && (
        <View style={styles.sheet}>
          <Text style={styles.upc}>UPC/EAN: {pendingItem.upc}</Text>

          {isExisting ? (
            <Text style={styles.note}>Already in pantry — update quantity:</Text>
          ) : notFound ? (
            <>
              <Text style={styles.note}>Not found — enter a name and save:</Text>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Country Fresh French Onion Dip"
                value={manualName}
                onChangeText={setManualName}
              />
            </>
          ) : (
            <>
              <Text style={styles.name}>{pendingItem.name}</Text>
              {!!pendingItem.description && (
                <Text style={styles.desc} numberOfLines={3}>
                  {pendingItem.description}
                </Text>
              )}
              <Text style={styles.note}>Confirm details and save:</Text>
            </>
          )}

          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="1"
          />

          <Text style={styles.label}>Units</Text>
          <TextInput
            style={styles.input}
            value={units}
            onChangeText={setUnits}
            placeholder="unit"
          />

          <View style={styles.actionsRow}>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={resetScan}>
              <Ionicons name="scan-outline" size={18} color="#4CAF50" />
              <Text style={[styles.btnText, { color: '#4CAF50' }]}>Scan Again</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={saveItem}>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={[styles.btnText, { color: '#fff' }]}>Save Item</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const BORDER = '#e5e7eb';

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  upc: { fontSize: 14, fontWeight: '700', marginBottom: 6, color: '#111827' },
  name: { fontSize: 18, fontWeight: '800', marginBottom: 6, color: '#111827' },
  desc: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  note: { marginBottom: 12, color: '#2563eb' },

  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 10, marginBottom: 12,
    backgroundColor: '#f9fafb',
  },

  actionsRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginTop: 6,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    columnGap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnPrimary: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  btnSecondary: { backgroundColor: '#fff', borderColor: '#4CAF50' },
  btnText: { fontWeight: '700', fontSize: 14 },
});
