import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { loadPantry, savePantry, resetPantry } from './processBarcodeScan';
import { useIsFocused } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

export default function PantryScreen() {
  const [pantry, setPantry] = useState({ pantry: { items: {} } });
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnits, setEditUnits] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      (async () => {
        const data = await loadPantry();
        setPantry(data);
      })();
    }
  }, [isFocused]);

  // Delete item
  const deleteItem = async (upc) => {
    const newPantry = { ...pantry };
    delete newPantry.pantry.items[upc];
    await savePantry(newPantry);
    setPantry(newPantry);
  };

  // Open edit modal
  const openEdit = (upc, item) => {
    setEditingItem({ upc, ...item });
    setEditQuantity(String(item.quantity));
    setEditUnits(item.units || 'unit');
  };

  // Save edit
  const saveEdit = async () => {
    if (!editingItem) return;
    const newPantry = { ...pantry };
    newPantry.pantry.items[editingItem.upc].quantity = Number(editQuantity);
    newPantry.pantry.items[editingItem.upc].units = editUnits;
    await savePantry(newPantry);
    setPantry(newPantry);
    setEditingItem(null);
  };

  // Reset pantry
  const handleReset = async () => {
    Alert.alert(
      'Reset Pantry',
      'Are you sure you want to clear all items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            const empty = await resetPantry();
            setPantry(empty);
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Filter + sort items
  const getFilteredAndSortedItems = () => {
    const items = Object.entries(pantry.pantry.items).filter(
      ([, item]) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    items.sort((a, b) => {
      const itemA = a[1];
      const itemB = b[1];
      if (sortBy === 'name') {
        return itemA.name.localeCompare(itemB.name);
      } else if (sortBy === 'quantity') {
        return itemB.quantity - itemA.quantity;
      } else if (sortBy === 'brand') {
        return (itemA.brand || '').localeCompare(itemB.brand || '');
      }
      return 0;
    });

    return items;
  };

  return (
    <View style={{ flex: 1, padding: 10 }}>
      {/* Top Controls */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Button title="Reset Pantry" onPress={handleReset} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Picker
          selectedValue={sortBy}
          style={styles.picker}
          onValueChange={(val) => setSortBy(val)}
        >
          <Picker.Item label="Name" value="name" />
          <Picker.Item label="Quantity" value="quantity" />
          <Picker.Item label="Brand" value="brand" />
        </Picker>
      </View>

      {/* Pantry List */}
      <ScrollView>
        {getFilteredAndSortedItems().map(([code, item]) => (
          <View key={code} style={styles.itemRow}>
            {item.images && item.images.length > 0 ? (
              <Image
                source={{ uri: item.images[0] }}
                style={{ width: 60, height: 60, marginRight: 10 }}
              />
            ) : null}

            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>
                {item.name} ({item.quantity} {item.units})
              </Text>
              {item.brand ? (
                <Text style={styles.itemDesc}>{item.brand}</Text>
              ) : null}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => openEdit(code, item)}
              >
                <Text style={styles.btnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteItem(code)}
              >
                <Text style={styles.btnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {Object.keys(pantry.pantry.items).length === 0 && (
          <Text style={{ marginTop: 20, textAlign: 'center' }}>
            Pantry is empty.
          </Text>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={!!editingItem}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {editingItem?.name}
            </Text>
            <TextInput
              style={styles.input}
              value={editQuantity}
              keyboardType="numeric"
              onChangeText={setEditQuantity}
              placeholder="Quantity"
            />
            <TextInput
              style={styles.input}
              value={editUnits}
              onChangeText={setEditUnits}
              placeholder="Units"
            />

            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setEditingItem(null)} />
              <Button title="Save" onPress={saveEdit} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    marginHorizontal: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    height: 40,
  },
  picker: {
    width: 120,
    height: 40,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemDesc: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  editBtn: {
    padding: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    marginRight: 5,
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#f44336',
    borderRadius: 6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '80%',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 8,
    borderRadius: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
});
