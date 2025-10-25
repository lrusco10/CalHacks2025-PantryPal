import React, { useState } from 'react';
import { Text, View, Button, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { processBarcodeScan } from './processBarcodeScan';

export default function QRScanner({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [units, setUnits] = useState('unit');
  const [loading, setLoading] = useState(false);
  const [isExisting, setIsExisting] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>We need your permission to use the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    const result = await processBarcodeScan(data, 0, units, true); // dry run
    setPendingItem(result.item);
    setIsExisting(result.existing);
    setLoading(false);
  };

  const saveItem = async () => {
    if (pendingItem) {
      await processBarcodeScan(pendingItem.upc, quantity, units, false); // commit to pantry
      navigation.goBack();
    }
  };

  const resetScan = () => {
    setScanned(false);
    setPendingItem(null);
    setQuantity('1');
    setUnits('unit');
    setIsExisting(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {!pendingItem && (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'ean13'] }}
        />
      )}

      {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" />}

      {pendingItem && (
        <View style={styles.form}>
          <Text style={styles.upc}>{pendingItem.upc}</Text>

          {!isExisting ? (
            <>
              <Text style={styles.name}>{pendingItem.name}</Text>
              <Text style={styles.desc}>{pendingItem.description}</Text>
              <Text style={styles.note}>New item detected — confirm details and save:</Text>
            </>
          ) : (
            <Text style={styles.note}>
              Item already exists — update quantity:
            </Text>
          )}

          <Text>Quantity:</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />

          <Text>Units:</Text>
          <TextInput style={styles.input} value={units} onChangeText={setUnits} />

          <Button title="SAVE ITEM" onPress={saveItem} />
          <Button title="SCAN AGAIN" onPress={resetScan} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 20 },
  upc: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  name: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  desc: { fontSize: 14, fontStyle: 'italic', marginBottom: 10 },
  note: { marginBottom: 15, color: 'blue' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
