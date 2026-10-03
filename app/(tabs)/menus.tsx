import { RestaurantExplorer } from '@/components/RestaurantExplorer';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { menuDatabase, useMenuRevision } from '@/services/MenuDatabase';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function TabTwoScreen() {
  useMenuRevision(); // the "updated" date follows newer menus
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>Explore Menus</ThemedText>
        <ThemedText style={styles.subtitle}>
          Duke dining · menus updated {new Date(menuDatabase.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {__DEV__ ? ` · ${menuDatabase.source}` : ''}
        </ThemedText>
      </ThemedView>
      
      <RestaurantExplorer />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    marginBottom: 8,
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
});