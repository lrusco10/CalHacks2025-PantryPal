import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadPantry, resetPantry, savePantry } from './processBarcodeScan';

export default function PantryScreen() {
  const [pantry, setPantry] = useState({ pantry: { items: {} } });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'brand' | 'quantity'

  // Edit modal state (cross-platform, nicer than Alert.prompt)
  const [editUPC, setEditUPC] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const refresh = useCallback(async () => {
    const data = await loadPantry();
    setPantry(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const items = Object.values(pantry.pantry.items || {});

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

  const openEditModal = (upc) => {
    const current = pantry.pantry.items[upc];
    const quantity = current.units;
    setEditUPC(upc);
    setEditQty(String(current?.quantity ?? current.quantity));
    setEditUnit(String(current?.units ?? quantity));
  };

  const commitEditQuantity = async () => {
    if (!editUPC) return;
    const updated = { ...pantry };
    updated.pantry.items[editUPC].quantity = Number(editQty) || 0;
    updated.pantry.items[editUPC].units = String(editUnit) || "Units"
    await savePantry(updated);
    setPantry(updated);
    setEditUPC(null);
    setEditQty('');
    setEditUnit('');
  };

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
          setPantry(updated);
        },
      },
    ]);
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Pantry',
      'This will remove all items. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const cleared = await resetPantry();
            setPantry(cleared);
          },
        },
      ]
    );
  };

  const SortPill = ({ value, label }) => {
    const active = sortBy === value;
    return (
      <Pressable
        onPress={() => setSortBy(value)}
        style={[
          styles.pill,
          active ? styles.pillActive : styles.pillInactive,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {/* Thumbnail */}
      {item.images && item.images.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.thumbnail} />
      ) : (
        <View style={styles.noImage}>
          <Ionicons name="image-outline" size={22} color="#9aa0a6" />
        </View>
      )}

      {/* Details */}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {!!item.brand && <Text style={styles.brand}>Brand: {item.brand}</Text>}
        <Text style={styles.qty}>
          {item.quantity} {item.units}
        </Text>
        {!!item.description && (
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>

      {/* Actions as icons */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => openEditModal(item.upc)}
          hitSlop={12}
          accessibilityLabel="Edit quantity"
        >
          <Ionicons name="create-outline" size={22} color="#4CAF50" />
        </Pressable>
        <Pressable
          onPress={() => handleDelete(item.upc)}
          hitSlop={12}
          accessibilityLabel="Delete item"
        >
          <Ionicons name="trash-outline" size={22} color="#E53935" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or brand..."
          placeholderTextColor="#9aa0a6"
          value={search}
          onChangeText={setSearch}
        />
        <Pressable onPress={() => setSearch('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={search ? '#9aa0a6' : 'transparent'} />
        </Pressable>
      </View>

      {/* Segmented Sort */}
      <View style={styles.sortRow}>
        <SortPill value="name" label="Name" />
        <SortPill value="brand" label="Brand" />
        <SortPill value="quantity" label="Qty" />
        <Pressable style={styles.resetAllBtn} onPress={handleReset}>
          <Ionicons name="refresh" size={18} color="#E53935" />
          <Text style={styles.resetAllText}>Reset</Text>
        </Pressable>
      </View>

      {/* List */}
      {filteredItems.length === 0 ? (
        <Text style={styles.empty}>
          {items.length === 0 ? 'No items yet. Scan something!' : 'No items match your search.'}
        </Text>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, idx) => item.upc || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      {/* Edit Quantity Modal */}
      <Modal visible={!!editUPC} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Quantity</Text>
            <TextInput
              style={styles.modalInput}
              value={editQty}
              onChangeText={setEditQty}
              keyboardType="numeric"
              placeholder="Quantity"
            />
          <Text style={styles.modalTitle}>Edit Unit</Text>
            <TextInput
              style={styles.modalInput}
              value={editUnit}
              onChangeText={setEditUnit}
              placeholder="Quantity"
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setEditUPC(null)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSave]} onPress={commitEditQuantity}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CARD_BG = '#fff';
const BORDER = '#e5e7eb';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f9', padding: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2f7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 8,
    color: '#111827',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    columnGap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillInactive: { backgroundColor: '#fff', borderColor: BORDER },
  pillActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  pillText: { fontSize: 13 },
  pillTextInactive: { color: '#111827' },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    columnGap: 6,
  },
  resetAllText: { color: '#E53935', fontWeight: '600', fontSize: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  thumbnail: { width: 56, height: 56, borderRadius: 8, marginRight: 10 },
  noImage: {
    width: 56, height: 56, borderRadius: 8, marginRight: 10,
    backgroundColor: '#eef2f7', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  brand: { fontSize: 13, fontStyle: 'italic', color: '#374151', marginTop: 2 },
  qty: { fontSize: 14, color: '#111827', marginTop: 6 },
  desc: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  actions: { rowGap: 10, alignItems: 'flex-end' },

  empty: { textAlign: 'center', color: '#6b7280', marginTop: 30 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    width: '86%', backgroundColor: '#fff', borderRadius: 12, padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', columnGap: 8 },
  modalBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
  },
  modalCancel: { backgroundColor: '#fff' },
  modalSave: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  modalBtnText: { color: '#111827', fontWeight: '600' },
});
