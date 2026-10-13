import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DownsellModal } from './src/components/DownsellModal';
import { PaywallModal } from './src/components/PaywallModal';
import { ReceiptDetailScreen } from './src/screens/ReceiptDetailScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { BillingProvider } from './src/services/purchases';
import { colors } from './src/theme/tokens';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.obsidian,
    card: colors.obsidian,
    primary: colors.yellow,
    text: colors.white,
    border: colors.hairline,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <BillingProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.obsidian },
              headerTintColor: colors.white,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.obsidian },
            }}
          >
            <Stack.Screen name="Vault" component={VaultScreen} options={{ title: 'Tax Vault' }} />
            <Stack.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} options={{ title: 'Review' }} />
          </Stack.Navigator>
        </NavigationContainer>
        <PaywallModal />
        <DownsellModal />
      </BillingProvider>
    </SafeAreaProvider>
  );
}
