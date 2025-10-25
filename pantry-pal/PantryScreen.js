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
import { useFocusEffect } from '@react-navigation/native';

export default function PantryScreen() {
  const [pantry, setPantry] = useState({ pantry: { items: {} } });
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnits, setEditUnits] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Reload pantry whenever screen is focused
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const data = await loadPantry();
        setPantry(data);
      })();
    }, [])
  );

  // Delete item
  const deleteItem = async (upc) => {
    const newPantry = { ...pantry };
    delete newPantry.pantry.items[upc];
    await savePantry(newPantry);
    setPantry(await loadPantry());
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
    setPantry(await loadPantry());
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
      <View style={styles.topControls}>
        <Button title="Reset Pantry" onPress={handleReset} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Sort Buttons */}
      <View style={styles.sortRow}>
        {['name', 'quantity', 'brand'].map((val) => (
          <TouchableOpacity
            key={val}
            style={[
              styles.sortButton,
              sortBy === val ? styles.sortButtonActive : null,
            ]}
            onPress={() => setSortBy(val)}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortBy === val ? { color: '#fff' } : null,
              ]}
            >
              {val.charAt(0).toUpperCase() + val.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
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
            <Text style={styles.modalTitle}>Edit {editingItem?.name}</Text>
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
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    marginLeft: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    height: 40,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  sortButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  sortButtonActive: {
    backgroundColor: '#4CAF50',
  },
  sortButtonText: {
    fontWeight: '600',
    color: '#000',
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
