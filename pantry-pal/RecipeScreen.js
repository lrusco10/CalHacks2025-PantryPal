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
  Modal,
} from 'react-native';
import { loadPantry, savePantry } from './processBarcodeScan';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';

// Load API key from secrets.json file
const secrets = require('./secrets.json');
const CLAUDE_API_KEY = secrets.anthropic_api_key;

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

  // Reload pantry every time the screen is focused
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

  // Toggle checkbox
  const toggleSelect = (upc) => {
    setSelected((prev) => ({
      ...prev,
      [upc]: !prev[upc],
    }));
  };

  // Call Claude API to generate recipe
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
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const recipeText = data.content[0]?.text || '';

      // Strip markdown code fences if present
      let cleanedText = recipeText.trim()
        .replace(/```json/g, '')
        .replace(/```/g, '');

      // Extract JSON safely
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const recipe = JSON.parse(jsonMatch[0]);
      return recipe;
    } catch (error) {
      console.error('Claude API Error:', error);
      throw error;
    }
  };

  // Generate recipe using Claude
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

    try {
      // Call Claude API
      const recipe = await callClaudeAPI(chosenDetails);

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
            onPress: () => applyRecipe(recipe),
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      setLoading(false);
      Alert.alert(
        'Error',
        'Failed to generate recipe. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Apply recipe: subtract ingredient quantities and save to history
  const applyRecipe = async (recipe) => {
    const newPantry = { ...pantry };
    recipe.ingredients.forEach((ing) => {
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

    // Save recipe to history with timestamp
    const recipeWithTimestamp = {
      ...recipe,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const updatedRecipes = [recipeWithTimestamp, ...pastRecipes];
    await savePastRecipes(updatedRecipes);
    setPastRecipes(updatedRecipes);
  };

  // Delete a past recipe
  const deleteRecipe = async (recipeId) => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
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
      .map((ing) => `- ${ing.required} ${ing.units} ${ing.name}`)
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
      <View style={styles.buttonRow}>
        <View style={styles.buttonContainer}>
          <Button title="Create Recipe" onPress={generateRecipe} disabled={loading} />
        </View>
        <View style={styles.buttonContainer}>
          <Button
            title="Past Recipes"
            onPress={() => setShowPastRecipes(true)}
            color="#2196F3"
          />
        </View>
      </View>

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

      {/* Past Recipes Modal */}
      <Modal
        visible={showPastRecipes}
        animationType="slide"
        onRequestClose={() => setShowPastRecipes(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Past Recipes</Text>
            <TouchableOpacity onPress={() => setShowPastRecipes(false)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {pastRecipes.length === 0 ? (
              <Text style={styles.emptyText}>No past recipes yet.</Text>
            ) : (
              pastRecipes.map((recipe) => (
                <View key={recipe.id} style={styles.recipeCard}>
                  <TouchableOpacity onPress={() => viewRecipe(recipe)}>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <Text style={styles.recipeDate}>
                      {new Date(recipe.createdAt).toLocaleDateString()}
                    </Text>
                    <Text style={styles.recipeIngredients}>
                      {recipe.ingredients.length} ingredients
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteRecipe(recipe.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonContainer: {
    flex: 1,
  },
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#666',
  },
  recipeCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recipeDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  recipeIngredients: {
    fontSize: 14,
    color: '#333',
  },
  deleteButton: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#ff4444',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});