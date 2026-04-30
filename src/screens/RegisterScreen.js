// src/screens/RegisterScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// Registration screen for Automation app.
// - Online  → registers via Firebase Auth + writes to Firestore immediately
// - Offline → saves data locally in AsyncStorage queue, syncs when back online
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { registerUser } from '../services/firebase';
import { enqueueOperation } from '../services/offlineSync';
import useNetworkStatus from '../hooks/useNetworkStatus';

const RegisterScreen = ({ navigation }) => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const online = isConnected && isInternetReachable !== false;

  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [focusedField, setFocusedField] = useState(null);

  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const pressBounce = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 80,  useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1,    duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim())
      e.fullName = 'Full name is required';
    else if (form.fullName.trim().split(' ').length < 2)
      e.fullName = 'Please enter both your name and surname';

    if (!form.email.trim())
      e.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address';

    if (!form.password)
      e.password = 'Password is required';
    else if (form.password.length < 6)
      e.password = 'Password must be at least 6 characters';

    return e;
  };

  const handleRegister = async () => {
    pressBounce();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) { shake(); return; }

    setLoading(true);
    const { fullName, email, password } = form;

    try {
      if (online) {
        await registerUser(fullName.trim(), email.trim(), password);
        Alert.alert(
          '🎉 Account Created',
          `Welcome to Automation, ${fullName.split(' ')[0]}!`,
          [{ text: 'Continue', onPress: () => navigation?.navigate('Login') }],
        );
      } else {
        const tempId = `pending_${Date.now()}`;
        await enqueueOperation('setDoc', 'users', { fullName, email, pendingAuth: true }, tempId);
        const pending = JSON.parse((await AsyncStorage.getItem('@pending_registrations')) || '[]');
        pending.push({ tempId, fullName, email, queuedAt: new Date().toISOString() });
        await AsyncStorage.setItem('@pending_registrations', JSON.stringify(pending));
        Alert.alert(
          '📦 Saved Offline',
          "You're currently offline. Your registration has been saved and will be completed automatically once you're back online.",
          [{ text: 'Got it' }],
        );
      }
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'This email is already registered. Try logging in instead.'
        : err.message ?? 'Something went wrong. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const getFieldStyle = (field) => [
    styles.input,
    focusedField === field && styles.inputFocused,
    errors[field] && styles.inputError,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#080C12', '#0A1220', '#080C12']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSub}>
              {online
                ? 'Join Automation to get started'
                : '📡 Offline — registration will sync when connected'}
            </Text>
          </View>

          {/* ── Form ── */}
          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={getFieldStyle('fullName')}
                placeholder="Name and Surname"
                placeholderTextColor="#3A5068"
                value={form.fullName}
                onChangeText={(v) => setForm({ ...form, fullName: v })}
                onFocus={() => setFocusedField('fullName')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={getFieldStyle('email')}
                placeholder="your@email.com"
                placeholderTextColor="#3A5068"
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[getFieldStyle('password'), styles.passwordInput]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#3A5068"
                  value={form.password}
                  onChangeText={(v) => setForm({ ...form, password: v })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {!online && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineBadgeText}>
                  ⚠️  No internet detected. Your data will be saved locally and synced automatically.
                </Text>
              </View>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.ctaWrap}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={loading ? ['#1A2535', '#1A2535'] : ['#3e7cb9', '#2d5f94']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.ctaText}>
                        {online ? 'Create Account' : 'Save & Sync Later'}
                      </Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation?.navigate('Login')} activeOpacity={0.7}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },

  // Hero
  hero: { alignItems: 'center', paddingTop: 56, paddingBottom: 36, gap: 12 },
  logoWrap: {
    width: 110, height: 110, borderRadius: 28,
    backgroundColor: '#0E1520',
    borderWidth: 1.5, borderColor: '#1A2535',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#3e7cb9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  logo:      { width: 88, height: 88 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSub:   { fontSize: 14, color: '#7A90A8', textAlign: 'center', lineHeight: 20 },

  // Form
  form:       { gap: 18 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 12, fontWeight: '600', color: '#7A90A8',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0E1520', borderWidth: 1.5, borderColor: '#1A2535',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2,
  },
  inputFocused: {
    borderColor: '#3e7cb9', backgroundColor: '#0E1828',
    shadowColor: '#3e7cb9', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  inputError:    { borderColor: '#E84545' },
  passwordRow:   { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
  eyeBtn: {
    backgroundColor: '#0E1520', borderWidth: 1.5, borderColor: '#1A2535',
    borderLeftWidth: 0, borderTopRightRadius: 14, borderBottomRightRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  eyeIcon:   { fontSize: 16 },
  errorText: { fontSize: 12, color: '#E84545', marginTop: 2, letterSpacing: 0.2 },

  // Offline badge
  offlineBadge: {
    backgroundColor: '#120E00', borderWidth: 1,
    borderColor: '#F59E0B33', borderRadius: 12, padding: 14,
  },
  offlineBadgeText: { color: '#F59E0B', fontSize: 13, lineHeight: 20 },

  // CTA
  ctaWrap: {
    borderRadius: 16, overflow: 'hidden', marginTop: 6,
    shadowColor: '#3e7cb9', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  cta:     { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.4 },

  // Footer
  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { fontSize: 14, color: '#7A90A8' },
  footerLink: { fontSize: 14, color: '#3e7cb9', fontWeight: '700' },
});