import * as FileSystem from 'expo-file-system/legacy';

const fileUri = FileSystem.documentDirectory + 'pantry.json';

// --- Normalize UPC/EAN ---
function normalizeUPC(code) {
  if (code.length === 13 && code.startsWith("0")) {
    return code.substring(1);
  }
  return code;
}

// --- Pantry JSON Handling ---
export async function loadPantry() {
  try {
    const data = await FileSystem.readAsStringAsync(fileUri);
    return JSON.parse(data);
  } catch {
    return { pantry: { items: {} } };
  }
}

export async function savePantry(pantry) {
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(pantry, null, 2));
}

// --- UPCItemDB Lookup ---
async function lookupProduct(upc) {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`);
    const json = await res.json();

    if (json.code === "OK" && json.total > 0) {
      const item = json.items[0];
      return {
        name: item.title || upc,
        description: item.description || "",
        brand: item.brand || "",        // ✅ include brand safely
        images: item.images || [],
      };
    }
    return { name: upc, description: "", brand: "", images: [] };
  } catch (e) {
    console.warn("UPC lookup failed", e);
    return { name: upc, description: "", brand: "", images: [] };
  }
}

// --- Main Scan Handler ---
// dryRun = true → preview only, don't save
export async function processBarcodeScan(rawCode, quantity = 1, units = "unit", dryRun = false) {
  const code = normalizeUPC(rawCode);
  const pantry = await loadPantry();

  // If item already exists
  if (pantry.pantry.items[code]) {
    if (!dryRun) {
      pantry.pantry.items[code].quantity += Number(quantity);
      await savePantry(pantry);
    }
    return { pantry, existing: true, item: pantry.pantry.items[code] };
  }

  // Otherwise fetch from UPCItemDB
  const product = await lookupProduct(code);
  const newItem = {
    upc: code,
    name: product.name,
    description: product.description,
    brand: product.brand,         // ✅ stored
    images: product.images,
    quantity: Number(quantity),
    units,
  };

  if (!dryRun) {
    pantry.pantry.items[code] = newItem;
    await savePantry(pantry);
  }

  return { pantry, existing: false, item: newItem };
}

// --- Reset Pantry ---
export async function resetPantry() {
  const empty = { pantry: { items: {} } };
  await savePantry(empty);
  return empty;
}
