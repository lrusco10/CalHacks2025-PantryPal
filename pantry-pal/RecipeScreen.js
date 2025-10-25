import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Button,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadPantry, savePantry } from './processBarcodeScan';

export default function RecipeScreen() {
  const [pantry, setPantry] = useState({ pantry: { items: {} } });
  const [selected, setSelected] = useState({}); // upc -> true/false

  const refresh = useCallback(async () => {
    const data = await loadPantry();
    setPantry(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleSelect = (upc) => {
    setSelected((prev) => ({
      ...prev,
      [upc]: !prev[upc],
    }));
  };

  const createRecipe = async () => {
    const chosen = Object.entries(pantry.pantry.items)
      .filter(([upc]) => selected[upc])
      .map(([upc, item]) => ({
        upc,
        name: item.name,
        quantity: item.quantity,
        units: item.units,
      }));

    if (chosen.length === 0) {
      Alert.alert('No ingredients', 'Please select some items first.');
      return;
    }

    // --- AI call placeholder ---
    // Here you would send `chosen` to your recipe generation API
    // Example:
    // const res = await fetch('https://your-ai-api/recipe', { method: 'POST', body: JSON.stringify(chosen) });
    // const recipe = await res.json();

    const recipe = {
      title: 'Sample Recipe',
      instructions: 'Mix everything together and enjoy!',
      usedIngredients: chosen,
    };

    Alert.alert(
      'Recipe Created',
      `${recipe.title}\n\n${recipe.instructions}\n\nDo you want to use this recipe?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use Recipe',
          onPress: async () => {
            // Remove chosen items from pantry
            const updated = { ...pantry };
            recipe.usedIngredients.forEach((ing) => {
              if (updated.pantry.items[ing.upc]) {
                updated.pantry.items[ing.upc].quantity -= ing.quantity;
                if (updated.pantry.items[ing.upc].quantity <= 0) {
                  delete updated.pantry.items[ing.upc];
                }
              }
            });
            await savePantry(updated);
            refresh();
            setSelected({});
            Alert.alert('Pantry Updated', 'Ingredients used have been deducted.');
          },
        },
      ]
    );
  };

  const items = Object.values(pantry.pantry.items);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recipe Builder</Text>
      <Button title="Create Recipe" onPress={createRecipe} />

      {items.length === 0 ? (
        <Text style={styles.empty}>No items in pantry</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.upc}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => toggleSelect(item.upc)}
            >
              <View style={styles.checkbox}>
                {selected[item.upc] && <View style={styles.checkboxSelected} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.details}>
                  {item.quantity} {item.units}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  empty: { marginTop: 20, fontStyle: 'italic' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  checkbox: {
    width: 24,
    height: 24,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    width: 16,
    height: 16,
    backgroundColor: 'blue',
  },
  name: { fontSize: 18, fontWeight: 'bold' },
  details: { fontSize: 14, color: '#555' },
});
