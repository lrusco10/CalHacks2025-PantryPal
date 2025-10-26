import React from 'react';
import { Image, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PantryScreen from './PantryScreen';
import QRScan from './QRScan';
import RecipeScreen from './RecipeScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
            const icon = route.name === 'Pantry' ? 'list' : 'camera';
            return <Ionicons name={icon} size={size} color={color} />;
          },
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          tabBarActiveTintColor: '#4CAF50',
        })}
      >
        <Tab.Screen
          name="Pantry"
          component={PantryScreen}
          options={{
            title: 'My Pantry',
            headerLeft: () => (
              <View style={{ marginLeft: 12 }}>
                <Image
                  source={require('./assets/icon.png')}
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                  resizeMode="contain"
                />
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Scanner"
          component={ScannerStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen
          name="Recipes"
          component={RecipeScreen}
          options={{
            title: 'Recipes',
            headerLeft: () => (
              <View style={{ marginLeft: 12 }}>
                <Image
                  source={require('./assets/icon.png')}
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                  resizeMode="contain"
                />
              </View>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
