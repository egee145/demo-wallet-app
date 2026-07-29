import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  createNavigationContainerRef,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { AuthStackParams, MerchantStackParams, UserStackParams } from './types';
import type { Role } from '../domain/types';
import type { NotificationRoute } from '../services/notifications/notification-routing';
import { LoginScreen } from '../screens/auth/login-screen';
import { NfcDiagnosticsScreen } from '../screens/diagnostics/nfc-diagnostics-screen';
import { MerchantHistoryScreen, UserHistoryScreen } from '../screens/history/history-screens';
import { MerchantHomeScreen } from '../screens/merchant/merchant-home-screen';
import {
  AmountEntryScreen,
  MerchantPaymentResultScreen,
  MerchantPaymentSessionScreen,
} from '../screens/merchant/receive-payment-screens';
import {
  PaymentSessionDetailScreen,
  QrScannerScreen,
  UserPaymentResultScreen,
} from '../screens/user/qr-payment-screens';
import { UserHomeScreen } from '../screens/user/user-home-screen';
import { CardManagementScreen } from '../screens/user/card-management-screen';
import { MockTopUpScreen } from '../screens/user/mock-top-up-screen';
import { SettingsScreen } from '../screens/settings/settings-screen';
import { env } from '../config/env';
import { useI18n } from '../i18n/i18n-context';
import { useAuth } from '../services/auth/auth-context';
import { colors } from '../theme';

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const UserStack = createNativeStackNavigator<UserStackParams>();
const MerchantStack = createNativeStackNavigator<MerchantStackParams>();
type RootNavigationParams = AuthStackParams & UserStackParams & MerchantStackParams;
export const navigationRef = createNavigationContainerRef<RootNavigationParams>();
let pendingNotificationRoute: NotificationRoute | null = null;

export function queueNotificationNavigation(route: NotificationRoute) {
  pendingNotificationRoute = route;
}

export function flushNotificationNavigation(role: Role) {
  if (!pendingNotificationRoute || !navigationRef.isReady() || role !== 'USER') {
    return;
  }
  const route = pendingNotificationRoute;
  pendingNotificationRoute = null;
  navigationRef.navigate(route);
}

export function RootNavigation() {
  const { user, restoring } = useAuth();
  const { ready, t } = useI18n();
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => flushNotificationNavigation(user.role), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [user]);
  if (restoring || !ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  const stackOptions = {
    headerStyle: { backgroundColor: colors.canvas },
    headerShadowVisible: false,
    headerTintColor: colors.ink,
    headerTitleStyle: { fontWeight: '800' as const },
    contentStyle: { backgroundColor: colors.canvas },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => {
        if (user) {
          flushNotificationNavigation(user.role);
        }
      }}
    >
      {!user ? (
        <AuthStack.Navigator>
          <AuthStack.Screen component={LoginScreen} name="Login" options={{ headerShown: false }} />
        </AuthStack.Navigator>
      ) : user.role === 'MERCHANT' || user.role === 'ADMIN' ? (
        <MerchantStack.Navigator screenOptions={stackOptions}>
          <MerchantStack.Screen
            component={MerchantHomeScreen}
            name="MerchantHome"
            options={{ headerShown: false }}
          />
          <MerchantStack.Screen
            component={AmountEntryScreen}
            name="AmountEntry"
            options={{ title: t('payment.receiveTitle') }}
          />
          <MerchantStack.Screen
            component={MerchantHistoryScreen}
            name="MerchantHistory"
            options={{ title: t('history.merchantTitle') }}
          />
          <MerchantStack.Screen
            component={SettingsScreen}
            name="Settings"
            options={{ title: t('settings.title') }}
          />
          <MerchantStack.Screen
            component={MerchantPaymentSessionScreen}
            name="MerchantPaymentSession"
            options={{ title: t('payment.waitingTitle') }}
          />
          <MerchantStack.Screen
            component={MerchantPaymentResultScreen}
            name="MerchantPaymentResult"
            options={{ title: t('payment.received') }}
          />
          {env.diagnostics ? (
            <MerchantStack.Screen component={NfcDiagnosticsScreen} name="NfcDiagnostics" />
          ) : null}
        </MerchantStack.Navigator>
      ) : (
        <UserStack.Navigator screenOptions={stackOptions}>
          <UserStack.Screen
            component={UserHomeScreen}
            name="UserHome"
            options={{ headerShown: false }}
          />
          <UserStack.Screen
            component={QrScannerScreen}
            name="QrScanner"
            options={{ title: t('payment.scanTitle') }}
          />
          <UserStack.Screen
            component={UserHistoryScreen}
            name="UserHistory"
            options={{ title: t('history.walletTitle') }}
          />
          <UserStack.Screen
            component={MockTopUpScreen}
            name="MockTopUp"
            options={{ title: t('topup.title') }}
          />
          <UserStack.Screen
            component={CardManagementScreen}
            name="CardManagement"
            options={{ title: t('card.title') }}
          />
          <UserStack.Screen
            component={SettingsScreen}
            name="Settings"
            options={{ title: t('settings.title') }}
          />
          <UserStack.Screen
            component={PaymentSessionDetailScreen}
            name="PaymentSessionDetail"
            options={{ title: t('payment.confirmTitle') }}
          />
          <UserStack.Screen
            component={UserPaymentResultScreen}
            name="UserPaymentResult"
            options={{ headerShown: false }}
          />
        </UserStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.teal,
    background: colors.canvas,
    card: colors.canvas,
    text: colors.ink,
    border: colors.border,
    notification: colors.coral,
  },
  fonts: {
    regular: { fontFamily: 'sans-serif', fontWeight: '400' },
    medium: { fontFamily: 'sans-serif-medium', fontWeight: '500' },
    bold: { fontFamily: 'sans-serif', fontWeight: '700' },
    heavy: { fontFamily: 'sans-serif', fontWeight: '800' },
  },
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
});
