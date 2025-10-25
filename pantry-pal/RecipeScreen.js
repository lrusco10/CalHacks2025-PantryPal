import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
} from 'react-native';
import { loadPantry, savePantry } from './processBarcodeScan';
import { useFocusEffect } from '@react-navigation/native';

export default function RecipeScreen() {
  const [pantry, setPantry] = useState({ pantry: { items: {} } });
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Reload pantry every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const data = await loadPantry();
        setPantry(data);
      })();
    }, [])
  );

  // Toggle checkbox
  const toggleSelect = (upc) => {
    setSelected((prev) => ({
      ...prev,
      [upc]: !prev[upc],
    }));
  };

  // Simulated AI call
  const generateRecipe = async () => {
    setLoading(true);

    const chosenItems = Object.keys(selected).filter((k) => selected[k]);
    if (chosenItems.length === 0) {
      Alert.alert('No items selected', 'Please choose at least one pantry item.');
      setLoading(false);
      return;
    }

    // Grab full item details
    const chosenDetails = chosenItems.map((code) => pantry.pantry.items[code]);

    // --- FAKE AI RECIPE CALL ---
    // Here’s where you would send chosenDetails to your AI API.
    // Example payload:
    // fetch("/my-ai-recipe", { method: "POST", body: JSON.stringify(chosenDetails) })
    // The AI should return a JSON like:
    // {
    //   title: "Rice & Beans Bowl",
    //   steps: ["Cook rice", "Mix beans", "Serve hot"],
    //   ingredients: [
    //     { upc: "123", name: "Rice", required: 1, units: "cup" },
    //     { upc: "456", name: "Beans", required: 2, units: "cup" }
    //   ]
    // }

    const recipe = {
      title: 'Demo Recipe',
      steps: [
        'Cook the rice with water until fluffy.',
        'Add beans and stir.',
        'Serve with seasoning of choice.',
      ],
      ingredients: [
        {
          upc: chosenItems[0],
          name: pantry.pantry.items[chosenItems[0]].name,
          required: 1,
          units: 'cup',
        },
        chosenItems[1]
          ? {
              upc: chosenItems[1],
              name: pantry.pantry.items[chosenItems[1]].name,
              required: 2,
              units: 'cup',
            }
          : null,
      ].filter(Boolean),
    };
    // ---------------------------

    setLoading(false);

    // Ask user to accept recipe
    const ingredientList = recipe.ingredients
      .map((ing) => `- ${ing.required} ${ing.units} ${ing.name}`)
      .join('\n');

    Alert.alert(
      recipe.title,
      `${ingredientList}\n\n${recipe.steps.join('\n')}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Use Recipe',
          onPress: () => applyRecipe(recipe.ingredients),
        },
      ],
      { cancelable: true }
    );
  };

  // Apply recipe: subtract ingredient quantities
  const applyRecipe = async (ingredients) => {
    const newPantry = { ...pantry };
    ingredients.forEach((ing) => {
      if (newPantry.pantry.items[ing.upc]) {
        // subtract the recipe-required amount
        newPantry.pantry.items[ing.upc].quantity -= ing.required;

        // clean up if <= 0
        if (newPantry.pantry.items[ing.upc].quantity <= 0) {
          delete newPantry.pantry.items[ing.upc];
        }
      }
    });
    await savePantry(newPantry);
    setPantry(await loadPantry()); // reload to stay fresh
    setSelected({});
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
      <Button title="Create Recipe" onPress={generateRecipe} disabled={loading} />

      {/* Search + Sort Controls */}
      <View style={styles.topControls}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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
      </View>

      <ScrollView style={{ marginTop: 15 }}>
        {getFilteredAndSortedItems().map(([code, item]) => (
          <TouchableOpacity
            key={code}
            style={[
              styles.itemRow,
              selected[code] ? styles.itemRowSelected : null,
            ]}
            onPress={() => toggleSelect(code)}
          >
            <Text style={styles.itemName}>
              {item.name} ({item.quantity} {item.units})
            </Text>
            {item.brand ? (
              <Text style={styles.itemDesc}>{item.brand}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
        {Object.keys(pantry.pantry.items).length === 0 && (
          <Text style={{ marginTop: 20, textAlign: 'center' }}>
            Pantry is empty.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topControls: {
    marginTop: 10,
    marginBottom: 10,
  },
  searchBar: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 8,
    borderRadius: 6,
    height: 40,
    marginBottom: 10,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  itemRowSelected: {
    backgroundColor: '#e0f7e9',
    borderColor: '#4CAF50',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemDesc: {
    fontSize: 12,
    color: '#666',
  },
});
