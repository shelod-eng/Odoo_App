// src/screens/DashboardScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard for Automation app after login
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// DEV_ONLY_START — remove before production
const DEV_MODE = true;
// DEV_ONLY_END
import { getQueue } from '../services/offlineSync';
import { logoutOdoo, odooSession } from '../services/odoo';
import { getMyTravelLogs } from '../services/modules/travelLogModule';
import useNetworkStatus from '../hooks/useNetworkStatus';

const C = {
  primary:      '#3e7cb9',
  primaryDark:  '#2d5f94',
  primaryBorder:'#3e7cb940',
  bg:           '#080C12',
  surface:      '#0E1520',
  surfaceAlt:   '#111A28',
  border:       '#1A2535',
  textPrimary:  '#FFFFFF',
  textSecondary:'#7A90A8',
  textMuted:    '#3A5068',
  offline:      '#E8A020',
  offlineDim:   '#E8A02015',
  offlineBorder:'#E8A02040',
  success:      '#22C55E',
  successDim:   '#22C55E15',
  successBorder:'#22C55E40',
  danger:       '#E84545',
  dangerDim:    '#E8454515',
  dangerBorder: '#E8454540',
};

const DashboardScreen = ({ navigation }) => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const online = isConnected && isInternetReachable !== false;

  const [submittedCount, setSubmittedCount] = useState(0);
  const [queuedCount,    setQueuedCount]    = useState(0);
  const [currentUser,    setCurrentUser]    = useState(null);

  useFocusEffect(
    useCallback(() => {
      const fetchCounts = async () => {
        await odooSession.load();
        setCurrentUser(odooSession.userInfo);

        try {
          const queue   = await getQueue();
          const myQueue = queue.filter((op) => op.operation === 'travel.log.submit');
          setQueuedCount(myQueue.length);
        } catch {
          setQueuedCount(0);
        }

        if (online && odooSession.uid) {
          try {
            const logs = await getMyTravelLogs(100);
            setSubmittedCount(logs.length);
          } catch {
            setSubmittedCount(0);
          }
        } else {
          setSubmittedCount(0);
        }
      };

      fetchCounts();
    }, [online])
  );

  const handleLogout = async () => {
    try {
      await logoutOdoo();
      navigation?.navigate('Login');
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to logout.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={[C.bg, '#0A1220', C.bg]} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero ── */}
          <View style={s.hero}>
            <View style={s.logoWrap}>
              <Image
                source={require('../../assets/logo.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={s.heroTitle}>
              Welcome{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : '!'}
            </Text>
            <View style={[s.statusPill, online ? s.statusPillOnline : s.statusPillOffline]}>
              <View style={[s.statusDot, online ? s.statusDotOnline : s.statusDotOffline]} />
              <Text style={[s.statusText, online ? s.statusTextOnline : s.statusTextOffline]}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          {/* ── Modules ── */}
          <View style={s.sectionLabel}>
            <Text style={s.sectionLabelText}>MODULES</Text>
            <View style={s.sectionLine} />
          </View>

          {/* Travel Log */}
          <TouchableOpacity
            style={s.moduleCard}
            onPress={() => navigation?.navigate('TravelLog')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[`${C.primary}18`, `${C.primary}06`]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.moduleIconWrap, { backgroundColor: `${C.primary}25` }]}>
              <Ionicons name="car-outline" size={26} color={C.primary} />
            </View>
            <View style={s.moduleInfo}>
              <Text style={s.moduleTitle}>Travel Log</Text>
              <Text style={s.moduleSub}>Log a new travel expense for Odoo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>

          {/* Submitted Logs */}
          <TouchableOpacity
            style={s.moduleCard}
            onPress={() => navigation?.navigate('SubmittedLogs')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[`${C.success}12`, `${C.success}05`]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.moduleIconWrap, { backgroundColor: `${C.success}20` }]}>
              <Ionicons name="receipt-outline" size={26} color={C.success} />
            </View>
            <View style={s.moduleInfo}>
              <Text style={s.moduleTitle}>Submitted Logs</Text>
              <Text style={s.moduleSub}>View your travel expense history</Text>
            </View>
            <View style={s.badgeGroup}>
              {submittedCount > 0 && (
                <View style={[s.countBadge, s.countBadgeGreen]}>
                  <Ionicons name="checkmark-circle" size={10} color={C.success} />
                  <Text style={[s.countBadgeText, { color: C.success }]}>{submittedCount}</Text>
                </View>
              )}
              {queuedCount > 0 && (
                <View style={[s.countBadge, s.countBadgeAmber]}>
                  <Ionicons name="time" size={10} color={C.offline} />
                  <Text style={[s.countBadgeText, { color: C.offline }]}>{queuedCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Job Report */}
          <TouchableOpacity
            style={s.moduleCard}
            onPress={() => navigation?.navigate('JobReport')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#06B6D412', '#06B6D405']}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.moduleIconWrap, { backgroundColor: '#06B6D420' }]}>
              <Ionicons name="document-text-outline" size={26} color="#06B6D4" />
            </View>
            <View style={s.moduleInfo}>
              <Text style={s.moduleTitle}>Job Report</Text>
              <Text style={s.moduleSub}>Submit a timesheet job report</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>

          {/* Dev Task Manager — DEV ONLY */}
          {DEV_MODE && (
            <TouchableOpacity
              style={[s.moduleCard, s.moduleCardDev]}
              onPress={() => navigation?.navigate('DevTaskManager')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#A855F712', '#A855F705']}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.moduleIconWrap, { backgroundColor: '#A855F720' }]}>
                <Ionicons name="code-slash-outline" size={26} color="#A855F7" />
              </View>
              <View style={s.moduleInfo}>
                <Text style={s.moduleTitle}>Task Manager</Text>
                <Text style={s.moduleSub}>Create and assign tasks (dev only)</Text>
              </View>
              <View style={s.devTag}>
                <Text style={s.devTagText}>DEV</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Account ── */}
         
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={C.danger} />
            <Text style={s.logoutText}>Log Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

export default DashboardScreen;

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1, paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40, gap: 12,
  },

  hero: { alignItems: 'center', paddingBottom: 20, gap: 12 },
  logoWrap: {
    width: 100, height: 100, borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
    overflow: 'hidden',
  },
  logo: { width: 80, height: 80 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1,
  },
  statusPillOnline:  { backgroundColor: C.successDim, borderColor: C.successBorder },
  statusPillOffline: { backgroundColor: C.offlineDim,  borderColor: C.offlineBorder },
  statusDot:         { width: 6, height: 6, borderRadius: 3 },
  statusDotOnline:   { backgroundColor: C.success },
  statusDotOffline:  { backgroundColor: C.offline },
  statusText:        { fontSize: 13, fontWeight: '600' },
  statusTextOnline:  { color: C.success },
  statusTextOffline: { color: C.offline },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  sectionLabelText: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1 },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  moduleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5,
    borderColor: C.border, padding: 16, overflow: 'hidden',
  },
  moduleIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  moduleInfo:  { flex: 1 },
  moduleTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  moduleSub:   { fontSize: 12, color: C.textSecondary, marginTop: 2 },

  badgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1,
  },
  countBadgeGreen: { backgroundColor: C.successDim, borderColor: C.successBorder },
  countBadgeAmber: { backgroundColor: C.offlineDim,  borderColor: C.offlineBorder },
  countBadgeText:  { fontSize: 11, fontWeight: '700' },

  moduleCardDev: { borderColor: '#A855F730' },
  devTag: {
    backgroundColor: '#A855F715', borderRadius: 6, borderWidth: 1, borderColor: '#A855F740',
    paddingHorizontal: 8, paddingVertical: 3, marginRight: 4,
  },
  devTagText: { fontSize: 10, fontWeight: '700', color: '#A855F7', letterSpacing: 0.5 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.dangerDim, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.dangerBorder, paddingVertical: 15, marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: C.danger },
});
