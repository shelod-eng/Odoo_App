// src/screens/LoginScreen.js - Refactored for Odoo Auth

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { loginOdoo } from '../services/odoo';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Call the Odoo authentication service
      const result = await loginOdoo(username, password);

      if (result && result.uid) {
        console.log('Login successful:', result.userInfo.name);
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login');
      Alert.alert('Login Error', err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    // Navigate to registration screen
    // Note: In Odoo, user creation typically requires admin access
    // You may want to remove this or handle it differently
    navigation.navigate('Register');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dosh</Text>
          <Text style={styles.subtitle}>Field Service App</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              value={username}
              onChangeText={setUsername}
              editable={!loading}
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
          </View>

          {/* Error Message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.button, styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <TouchableOpacity
            style={styles.registerLink}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerText}>
              Don't have an account? <Text style={styles.registerBold}>Register</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Note */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Odoo</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ff6d03',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#333',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButton: {
    backgroundColor: '#ff6d03',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerBold: {
    color: '#ff6d03',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});

export default LoginScreen;
