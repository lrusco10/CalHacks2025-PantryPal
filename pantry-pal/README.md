# PantryPal

PantryPal is a mobile app built with **React Native** + **Expo** that lets you scan barcodes/UPCs, look up product info from [UPCItemDB](https://www.upcitemdb.com/), and store them in a virtual pantry (`pantry.json`) on your device.  
Features include:
- Barcode/QR scanning (via camera)
- Product lookup (name, brand, description, images)
- Add/Edit/Delete pantry items
- Search + filter pantry
- Reset pantry
- Bottom tab navigation (Pantry + Scanner)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/PantryPal.git
cd PantryPal/pantry-pal
```

### 2. Starting the development environment

Make sure you’re on Node 18 or 20 (LTS). Then install:

```bash
npm install
```

Install dependencies:

```bash
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated react-native-vector-icons
npx expo install @react-native-picker/picker
```

Then, start the development server with:

```bash
npx expo start
```

### 3. Compiling into an app

Expo uses EAS for compiling. Install with 

```bash
npm install -g eas-cli
```

Login:

```bash
eas login
```

Configure with:

```bash 
eas build:configure
```

Finally, build for Android:

```bash
eas build -p android --profile preview
```

Build for iOS (note that a developer apple account is required):
```bash
eas build -p ios --profile preview
```

## Development Notes:  

- The pantry database is stored within the sandbox filesystem - FileSystem.documentDirectory + pantry.json. Anything that interacts with the pantry modifies this pantry json file. An **example** file is included in the project directory.
- Product info is fetched from UPCItemDB trial API: 
```
https://api.upcitemdb.com/prod/trial/lookup?upc=<UPC_CODE>
```
- Images, brand, description are stored only if available; otherwise the app does not display or store them. 