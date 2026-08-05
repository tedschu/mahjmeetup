import React, { useState } from 'react';
import { StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { AnimatedIcon } from '@/components/animated-icon';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data: { session }, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) Alert.alert('Error', error.message);
    else if (!session) Alert.alert('Check Inbox', 'Please check your inbox for email verification!');
    setLoading(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AnimatedIcon />
        <ThemedText type="title" style={styles.title}>Mahjong Meetup</ThemedText>
        
        <ThemedView type="backgroundElement" style={styles.formCard}>
          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="email@address.com"
            autoCapitalize={'none'}
            placeholderTextColor={Colors.light.textSecondary}
          />
          <TextInput
            style={styles.input}
            onChangeText={setPassword}
            value={password}
            secureTextEntry={true}
            placeholder="Password"
            autoCapitalize={'none'}
            placeholderTextColor={Colors.light.textSecondary}
          />
          
          <TouchableOpacity style={styles.primaryButton} onPress={signInWithEmail} disabled={loading}>
            <ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={signUpWithEmail} disabled={loading}>
            <ThemedText style={styles.secondaryButtonText}>Create Account</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.secondaryButton, {marginTop: 24}]} disabled={loading} onPress={() => Alert.alert('Coming Soon', 'Google sign-in requires Google Cloud setup first!')}>
            <ThemedText style={styles.secondaryButtonText}>Continue with Google</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    alignItems: 'center',
    gap: 32,
  },
  title: {
    textAlign: 'center',
    color: Colors.light.text,
  },
  formCard: {
    alignSelf: 'stretch',
    padding: 24,
    borderRadius: 16,
    gap: 16,
  },
  input: {
    backgroundColor: Colors.light.background,
    color: Colors.light.text,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: Colors.light.accent,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
  },
  secondaryButtonText: {
    color: Colors.light.text,
    fontWeight: '600',
    fontSize: 16,
  },
});
