import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  StyleSheet,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { loadPantry, resetPantry, savePantry } from './processBarcodeScan';

export default function PantryScreen() {
  const [pantry, setPantry] = useState({ pantry: { items: {} } });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const refresh = useCallback(async () => {
    const data = await loadPantry();
    setPantry(data);
  }, []);

  // ✅ Refresh EVERY time this screen comes into focus (tab switched back)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const items = Object.values(pantry.pantry.items || {});

  // Filter + sort
  const filteredItems = items
    .filter((item) => {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'brand') return (a.brand || '').localeCompare(b.brand || '');
      if (sortBy === 'quantity') return b.quantity - a.quantity;
      return 0;
    });

  const handleDelete = (upc) => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = { ...pantry };
          delete updated.pantry.items[upc];
          await savePantry(updated);
          refresh();
        },
      },
    ]);
  };

  const handleEditQuantity = (upc) => {
    Alert.prompt(
      'Edit Quantity',
      'Enter new quantity:',
      async (value) => {
        const updated = { ...pantry };
        updated.pantry.items[upc].quantity = Number(value);
        await savePantry(updated);
        refresh();
      },
      'plain-text',
      pantry.pantry.items[upc].quantity.toString()
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Pantry</Text>

      {/* Search + Sort Controls */}
      <TextInput
        style={styles.search}
        placeholder="Search by name or brand..."
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.sortRow}>
        <Text style={{ marginRight: 10 }}>Sort by:</Text>
        <Picker selectedValue={sortBy} style={styles.picker} onValueChange={setSortBy}>
          <Picker.Item label="Name" value="name" />
          <Picker.Item label="Brand" value="brand" />
          <Picker.Item label="Quantity" value="quantity" />
        </Picker>
      </View>

      <Button
        title="Reset Pantry"
        color="red"
        onPress={async () => {
          await resetPantry();
          await refresh();
          alert('Pantry has been cleared!');
        }}
      />

      {filteredItems.length === 0 ? (
        <Text style={styles.empty}>
          {items.length === 0 ? 'No items yet. Scan something!' : 'No items match your search.'}
        </Text>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, index) => item.upc || index.toString()}
          renderItem={({ item }) => (
            <View style={styles.item}>
              {/* Thumbnail */}
              {item.images && item.images.length > 0 ? (
                <Image source={{ uri: item.images[0] }} style={styles.thumbnail} />
              ) : (
                <View style={styles.noImage}>
                  <Text>No Image</Text>
                </View>
              )}

              {/* Details */}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.brand && <Text style={styles.brand}>Brand: {item.brand}</Text>}
                <Text style={styles.details}>
                  {item.quantity} {item.units}
                </Text>
                {!!item.description && <Text style={styles.sub}>{item.description}</Text>}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <Button title="Edit" onPress={() => handleEditQuantity(item.upc)} />
                <Button title="Delete" color="red" onPress={() => handleDelete(item.upc)} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  search: {
    borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 10, borderRadius: 5,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  picker: { flex: 1, height: 40 },
  empty: { fontSize: 16, fontStyle: 'italic', marginTop: 20 },
  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 15, borderBottomWidth: 1, borderColor: '#ccc', paddingBottom: 10,
  },
  thumbnail: { width: 60, height: 60, marginRight: 10, borderRadius: 5 },
  noImage: {
    width: 60, height: 60, marginRight: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#aaa', borderRadius: 5,
  },
  name: { fontSize: 18, fontWeight: 'bold' },
  brand: { fontSize: 15, fontStyle: 'italic', color: '#333' },
  details: { fontSize: 16 },
  sub: { fontSize: 14, color: '#555' },
  actions: { justifyContent: 'space-around', marginLeft: 10 },
});
