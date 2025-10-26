import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { loadPantry, savePantry } from './processBarcodeScan';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const CLAUDE_API_KEY = Constants.expoConfig?.extra?.claudeAPI;
const recipesFileUri = FileSystem.documentDirectory + 'pastRecipes.json';

// Load past recipes from file
const loadPastRecipes = async () => {
  try {
    const data = await FileSystem.readAsStringAsync(recipesFileUri);
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// Save past recipes to file
const savePastRecipes = async (recipes) => {
  try {
    await FileSystem.writeAsStringAsync(recipesFileUri, JSON.stringify(recipes, null, 2));
  } catch (error) {
    console.error('Error saving past recipes:', error);
  }
};

export default function RecipeScreen() {
  const [pantry, setPantry] = useState({ pantry: { items: {} } });
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showPastRecipes, setShowPastRecipes] = useState(false);
  const [pastRecipes, setPastRecipes] = useState([]);

  // Reload pantry & past recipes on focus
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const data = await loadPantry();
        setPantry(data);
        const recipes = await loadPastRecipes();
        setPastRecipes(recipes);
      })();
    }, [])
  );

  // Toggle selection
  const toggleSelect = (upc) => {
    setSelected((prev) => ({ ...prev, [upc]: !prev[upc] }));
  };

  // ===== Claude API (same logic as your original) =====
  const callClaudeAPI = async (chosenDetails) => {
    const prompt = `You are a helpful recipe generator. Based on the following pantry items, create ONE recipe that uses some or all of these ingredients.

Available items:
${chosenDetails.map(item => `- ${item.name}: ${item.quantity} ${item.units}${item.brand ? ` (${item.brand})` : ''} [UPC: ${item.upc}]`).join('\n')}

IMPORTANT RULES:
1. Use ONLY the ingredients from the list above
2. Do NOT use more of any ingredient than the quantity specified
3. Use the EXACT same units provided in the list (for example: cups, tbsp, grams, etc.)
4. Return ONLY valid JSON, no other text
5. You may use fewer than the total quantity provided, depending on the recipe.

Required JSON format:
{
  "title": "Recipe Name",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "ingredients": [
    {
      "upc": "item_upc_code",
      "name": "Item Name",
      "required": 1.5,
      "units": "cups"
    }
  ]
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const recipeText = data.content[0]?.text || '';

      // Strip markdown code fences if present
      let cleanedText = recipeText.trim()
        .replace(/```json/g, '')
        .replace(/```/g, '');

      // Extract JSON safely
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No valid JSON found in response');

      const recipe = JSON.parse(jsonMatch[0]);
      return recipe;
    } catch (error) {
      console.error('Claude API Error:', error);
      throw error;
    }
  };

  // Generate recipe using Claude
  const generateRecipe = async () => {
    if (loading) return;
    setLoading(true);

    const chosenItems = Object.keys(selected).filter((k) => selected[k]);
    if (chosenItems.length === 0) {
      Alert.alert('No items selected', 'Please choose at least one pantry item.');
      setLoading(false);
      return;
    }

    const chosenDetails = chosenItems.map((code) => pantry.pantry.items[code]);

    try {
      const recipe = await callClaudeAPI(chosenDetails);
      setLoading(false);

      const ingredientList = recipe.ingredients
        .map((ing) => `- ${ing.required} ${ing.units} ${ing.name}`)
        .join('\n');

      Alert.alert(
        recipe.title,
        `${ingredientList}\n\n${recipe.steps.join('\n')}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Recipe', onPress: () => applyRecipe(recipe) },
        ],
        { cancelable: true }
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to generate recipe. Please try again.', [{ text: 'OK' }]);
    }
  };

  // Apply recipe: subtract ingredient quantities and save to history
  const applyRecipe = async (recipe) => {
    try {
      // Deep-ish clone to avoid mutating state directly
      const newPantry = {
        ...pantry,
        pantry: {
          ...pantry.pantry,
          items: { ...(pantry.pantry?.items || {}) },
        },
      };

      recipe.ingredients.forEach((ing) => {
        const upc = ing.upc;
        if (!upc) return;

        const item = newPantry.pantry.items[upc];
        if (!item) return;

        const currentQty = Number(item.quantity) || 0;
        const required = Number(ing.required) || 0;

        const nextQty = currentQty - required;
        if (nextQty <= 0) {
          delete newPantry.pantry.items[upc];
        } else {
          newPantry.pantry.items[upc] = {
            ...item,
            quantity: nextQty,
          };
        }
      });

      // Persist pantry
      await savePantry(newPantry);

      // Reload pantry from storage to stay in sync
      const reloaded = await loadPantry();
      setPantry(reloaded);

      // Clear selections
      setSelected({});

      // Save recipe to history with timestamp
      const recipeWithTimestamp = {
        ...recipe,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      const updatedRecipes = [recipeWithTimestamp, ...pastRecipes];
      await savePastRecipes(updatedRecipes);
      setPastRecipes(updatedRecipes);
    } catch (e) {
      console.error('applyRecipe error:', e);
      Alert.alert('Error', 'Could not apply the recipe. Please try again.');
    }
  };

  // Delete a past recipe
  const deleteRecipe = async (recipeId) => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedRecipes = pastRecipes.filter((r) => r.id !== recipeId);
            await savePastRecipes(updatedRecipes);
            setPastRecipes(updatedRecipes);
          },
        },
      ]
    );
  };

  // View a past recipe in detail
  const viewRecipe = (recipe) => {
    const ingredientList = recipe.ingredients
      .map((ing, idx) => `- ${ing.required} ${ing.units} ${ing.name}`)
      .join('\n');

    const dateStr = new Date(recipe.createdAt).toLocaleDateString();

    Alert.alert(
      recipe.title,
      `Created: ${dateStr}\n\nIngredients:\n${ingredientList}\n\nSteps:\n${recipe.steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}`,
      [{ text: 'OK' }]
    );
  };

  // Filter + sort items
  const getFilteredAndSortedItems = () => {
    const items = Object.entries(pantry.pantry.items || {}).filter(
      ([, item]) =>
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    items.sort((a, b) => {
      const itemA = a[1], itemB = b[1];
      if (sortBy === 'name') return itemA.name.localeCompare(itemB.name);
      if (sortBy === 'quantity') return (itemB.quantity || 0) - (itemA.quantity || 0);
      if (sortBy === 'brand') return (itemA.brand || '').localeCompare(itemB.brand || '');
      return 0;
    });

    return items;
  };

  const SortPill = ({ value, label }) => {
    const active = sortBy === value;
    return (
      <Pressable
        onPress={() => setSortBy(value)}
        style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top action row */}
      <View style={styles.sortRow}>
        <Pressable
          style={[styles.resetAllBtn, loading && { opacity: 0.6 }]}
          onPress={generateRecipe}
          disabled={loading}
          accessibilityLabel="Create recipe from selected items"
        >
          <Ionicons name="restaurant-outline" size={18} color="#4CAF50" />
          <Text style={[styles.resetAllText, { color: '#4CAF50' }]}>
            {loading ? 'Creating…' : 'Create Recipe'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.resetAllBtn}
          onPress={() => setShowPastRecipes(true)}
          accessibilityLabel="Open past recipes"
        >
          <Ionicons name="book-outline" size={18} color="#2196F3" />
          <Text style={[styles.resetAllText, { color: '#2196F3' }]}>Past Recipes</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or brand..."
          placeholderTextColor="#9aa0a6"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={searchQuery ? '#9aa0a6' : 'transparent'} />
        </Pressable>
      </View>

      {/* Sort Pills */}
      <View style={styles.sortRow}>
        <SortPill value="name" label="Name" />
        <SortPill value="brand" label="Brand" />
        <SortPill value="quantity" label="Qty" />
      </View>

      {/* Items as Pantry-style cards */}
      <ScrollView style={{ flex: 1 }}>
        {getFilteredAndSortedItems().map(([code, item]) => (
          <Pressable
            key={code}
            style={[
              styles.card,
              selected[code] && { borderColor: '#4CAF50', backgroundColor: '#e0f7e9' },
            ]}
            onPress={() => toggleSelect(code)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected[code] }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {!!item.brand && <Text style={styles.brand}>{item.brand}</Text>}
              <Text style={styles.qty}>{item.quantity} {item.units}</Text>
            </View>
          </Pressable>
        ))}
        {Object.keys(pantry.pantry.items || {}).length === 0 && (
          <Text style={styles.empty}>Pantry is empty.</Text>
        )}
      </ScrollView>

      {/* Past Recipes Modal */}
      <Modal visible={showPastRecipes} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Past Recipes</Text>
              <Pressable onPress={() => setShowPastRecipes(false)} accessibilityLabel="Close past recipes">
                <Ionicons name="close" size={22} color="#111827" />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              {pastRecipes.length === 0 ? (
                <Text style={styles.empty}>No past recipes yet.</Text>
              ) : (
                pastRecipes.map((recipe) => (
                  <View key={recipe.id} style={styles.card}>
                    <Pressable onPress={() => viewRecipe(recipe)} style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{recipe.title}</Text>
                      <Text style={styles.brand}>
                        {new Date(recipe.createdAt).toLocaleDateString()}
                      </Text>
                      <Text style={styles.desc}>
                        {recipe.ingredients.length} ingredients
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => deleteRecipe(recipe.id)} accessibilityLabel="Delete recipe">
                      <Ionicons name="trash-outline" size={20} color="#E53935" />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
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
  searchInput: { flex: 1, marginHorizontal: 8, color: '#111827' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    columnGap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
  },
  pillInactive: { backgroundColor: '#fff', borderColor: BORDER },
  pillActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  pillText: { fontSize: 13 },
  pillTextInactive: { color: '#111827' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    columnGap: 6,
  },
  resetAllText: { fontWeight: '600', fontSize: 12 },
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
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  brand: { fontSize: 13, fontStyle: 'italic', color: '#374151', marginTop: 2 },
  qty: { fontSize: 14, color: '#111827', marginTop: 6 },
  desc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 30 },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '80%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
});
