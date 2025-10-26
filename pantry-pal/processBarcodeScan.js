// processBarcodeScan.js
// Keeps pantry.json in the app sandbox, supports dry runs, UPCItemDB lookup,
// manual name override, and exposes resetPantry().

import * as FileSystem from 'expo-file-system/legacy';

const fileUri = FileSystem.documentDirectory + 'pantry.json';

// --- Normalize UPC/EAN ---
function normalizeUPC(code) {
  if (!code) return '';
  const s = String(code).trim();
  // Treat EAN-13 with leading 0 as UPC-A (common case)
  if (s.length === 13 && s.startsWith('0')) return s.substring(1);
  return s;
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

    if (json && json.code === 'OK' && json.total > 0 && Array.isArray(json.items) && json.items.length > 0) {
      const item = json.items[0];
      return {
        found: true,
        name: item.title || upc,
        description: item.description || '',
        brand: item.brand || '',
        images: Array.isArray(item.images) ? item.images : [],
      };
    }

    // Not found in API
    return { found: false, name: upc, description: '', brand: '', images: [] };
  } catch (e) {
    console.warn('UPC lookup failed', e);
    return { found: false, name: upc, description: '', brand: '', images: [] };
  }
}

/**
 * Main handler
 * @param {string} rawCode - scanned barcode
 * @param {number} quantity - quantity to add
 * @param {string} units - units label
 * @param {boolean} dryRun - if true, don't save; return preview
 * @param {{manualName?: string}} opts - optional overrides
 * @returns {{pantry: any, existing: boolean, found: boolean, item: any}}
 */
export async function processBarcodeScan(
  rawCode,
  quantity = 1,
  units = 'unit',
  dryRun = false,
  opts = {}
) {
  const code = normalizeUPC(rawCode);
  const pantry = await loadPantry();

  // If it already exists, just update quantity (unless dryRun)
  if (pantry.pantry.items[code]) {
    if (!dryRun) {
      pantry.pantry.items[code].quantity += Number(quantity);
      await savePantry(pantry);
    }
    return {
      pantry,
      existing: true,
      found: true, // it exists in our db
      item: pantry.pantry.items[code],
    };
  }

  // Otherwise look it up
  const product = await lookupProduct(code);

  const nameOverride = (opts.manualName || '').trim();
  const finalName = nameOverride || product.name;

  const newItem = {
    upc: code,
    name: finalName,
    description: product.description,
    brand: product.brand,
    images: product.images,
    quantity: Number(quantity),
    units,
  };

  if (!dryRun) {
    pantry.pantry.items[code] = newItem;
    await savePantry(pantry);
  }

  return {
    pantry,
    existing: false,
    found: product.found || !!nameOverride, // treat as found if user provided a name
    item: newItem,
  };
}

// --- Reset Pantry ---
export async function resetPantry() {
  const empty = { pantry: { items: {} } };
  await savePantry(empty);
  return empty;
}
