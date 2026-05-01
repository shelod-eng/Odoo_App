// src/components/NetworkHeader.js
// ─────────────────────────────────────────────────────────────────────────────
// Sticky header that shows a subtle status banner when offline.
// When back online it briefly shows "Back Online" then disappears.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useNetworkStatus from '../hooks/useNetworkStatus';

const NetworkHeader = ({ title = 'Automation' }) => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  const online = isConnected && isInternetReachable !== false;

  // Track previous online state to detect "just came back online"
  const prevOnlineRef = useRef(null);
  const [bannerMode, setBannerMode] = useState(null); // null | 'offline' | 'restored'

  const bannerAnim = useRef(new Animated.Value(0)).current;
  const restoreTimer = useRef(null);

  useEffect(() => {
    if (isConnected === null) return; // still loading

    const prev = prevOnlineRef.current;
    prevOnlineRef.current = online;

    if (!online) {
      // Went offline
      setBannerMode('offline');
      Animated.spring(bannerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else if (prev === false) {
      // Just came back online
      setBannerMode('restored');
      // Keep banner visible for 2.5 s then slide away
      clearTimeout(restoreTimer.current);
      restoreTimer.current = setTimeout(() => {
        Animated.timing(bannerAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setBannerMode(null));
      }, 2500);
    }

    return () => clearTimeout(restoreTimer.current);
  }, [online, isConnected]);

  const bannerTranslateY = bannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0],
  });

  const bannerBg   = bannerMode === 'restored' ? '#00C896' : '#E84545';
  const bannerText = bannerMode === 'restored'
    ? 'Eita, You are back online — syncing data…'
    :  'Eishhh, No internet connection';

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      {/* ── Main App Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Logo mark */}
        <View style={styles.logoMark}>
          <View style={styles.logoInner} />
        </View>

        <Text style={styles.title}>{title}</Text>

        {/* Live connectivity dot */}
        <View style={styles.statusDot}>
          <View
            style={[
              styles.dot,
              { backgroundColor: online ? '#00C896' : '#E84545' },
            ]}
          />
          <Text style={[styles.statusLabel, { color: online ? '#00C896' : '#E84545' }]}>
            {online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* ── Connectivity Banner ──────────────────────────────────────── */}
      {bannerMode !== null && (
        <Animated.View
          style={[
            styles.banner,
            { backgroundColor: bannerBg },
            { transform: [{ translateY: bannerTranslateY }] },
          ]}
        >
          <Text style={styles.bannerText}>{bannerText}</Text>
        </Animated.View>
      )}
    </View>
  );
};

export default NetworkHeader;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#0A0A0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
    zIndex: 100,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#3e7cb9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});