// App.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point for the Automation React Native app.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import AppNavigator from './src/navigation/AppNavigator';
import NetworkHeader from './src/components/NetworkHeader';
import { startSyncListener, stopSyncListener } from './src/services/offlineSync';

export default function App() {
  useEffect(() => {
    // Start listening for connectivity changes to auto-flush the offline queue
    startSyncListener();
    return () => stopSyncListener();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />

        {/* Global network-aware header — sits above the navigator */}
        <NetworkHeader title="Automation" />

        {/* App screens */}
        <View style={styles.content}>
          <AppNavigator />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    flex: 1,
  },
});