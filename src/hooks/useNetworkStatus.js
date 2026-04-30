// src/hooks/useNetworkStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// Reactive hook that exposes the current network connectivity state.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Returns an object with:
 *   isConnected      – boolean (null while loading)
 *   isInternetReachable – boolean (null while loading)
 *   connectionType   – 'wifi' | 'cellular' | 'none' | 'unknown'
 */
const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState({
    isConnected: null,
    isInternetReachable: null,
    connectionType: 'unknown',
  });

  useEffect(() => {
    // Fetch immediately on mount
    NetInfo.fetch().then((state) => {
      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return networkState;
};

export default useNetworkStatus;