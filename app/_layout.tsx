import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initDB } from '@/services/database';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbInitialized, setDbInitialized] = useState(false);

  // Load Space Grotesk fonts
  const [fontsLoaded] = useFonts({
    'SpaceGrotesk-Light': SpaceGrotesk_300Light,
    'SpaceGrotesk-Regular': SpaceGrotesk_400Regular,
    'SpaceGrotesk-Medium': SpaceGrotesk_500Medium,
    'SpaceGrotesk-SemiBold': SpaceGrotesk_600SemiBold,
    'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    initDB()
      .then(() => setDbInitialized(true))
      .catch(e => {
        console.error("Database init failed:", e);
        setDbInitialized(true);
      });
  }, []);

  // Hide splash screen when fonts and DB are ready
  useEffect(() => {
    if (fontsLoaded && dbInitialized) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbInitialized]);

  if (!fontsLoaded || !dbInitialized) {
    return (
      <View style={loadingStyles.container}>
        <Image
          source={require('../assets/logo.png')}
          style={loadingStyles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#0a7ea4" style={loadingStyles.spinner} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    width: 200,
    height: 70,
    marginBottom: 30,
  },
  spinner: {
    marginTop: 10,
  },
});
