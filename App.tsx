import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DownsellModal } from './src/components/DownsellModal';
import { PaywallModal } from './src/components/PaywallModal';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ReceiptDetailScreen } from './src/screens/ReceiptDetailScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { CurrencyProvider, useCurrency } from './src/services/CurrencyContext';
import { BillingProvider } from './src/services/purchases';
import { colors } from './src/theme/tokens';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bgCanvas,
    card: colors.bgCard,
    primary: colors.btnPrimaryBg,
    text: colors.textPrimary,
    border: colors.borderLight,
  },
};

function Root() {
  const currency = useCurrency();
  if (!currency.ready) return <View style={{ flex: 1, backgroundColor: colors.bgCanvas }} />;
  if (!currency.onboarded) return <OnboardingScreen />;
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgCanvas } }}>
        <Stack.Screen name="Vault" component={VaultScreen} />
        <Stack.Screen name="Scanner" component={ScannerScreen} />
        <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <BillingProvider>
        <CurrencyProvider>
          <Root />
          <PaywallModal />
          <DownsellModal />
        </CurrencyProvider>
      </BillingProvider>
    </SafeAreaProvider>
  );
}
