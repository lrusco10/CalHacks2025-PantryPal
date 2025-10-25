import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PantryScreen from './PantryScreen';
import QRScan from './QRScan';
import RecipeScreen from './RecipeScreen';  // 👈 new tab
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Scanner gets its own stack
function ScannerStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="QRScan"
        component={QRScan}
        options={{ title: 'Scan Item' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Pantry"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === 'Pantry') {
              iconName = 'list';
            } else if (route.name === 'Scanner') {
              iconName = 'camera';
            } else if (route.name === 'Recipes') {
              iconName = 'restaurant';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        })}
      >
        <Tab.Screen name="Pantry" component={PantryScreen} />
        <Tab.Screen
          name="Scanner"
          component={ScannerStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen name="Recipes" component={RecipeScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
