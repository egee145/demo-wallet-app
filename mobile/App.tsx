import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigation } from './src/navigation/root-navigation';
import { I18nProvider } from './src/i18n/i18n-context';
import { AuthProvider } from './src/services/auth/auth-context';
import { NotificationProvider } from './src/services/notifications/notification-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: false },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AuthProvider>
            <NotificationProvider>
              <StatusBar style="dark" />
              <RootNavigation />
            </NotificationProvider>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
