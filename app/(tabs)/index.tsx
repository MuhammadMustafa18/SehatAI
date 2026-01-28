import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const router = useRouter();

  const services = [
    { id: '1', title: 'Symptoms', icon: 'waveform.path.ecg', color: '#E3F2FD', route: '/symptomTriage' },
    { id: '2', title: 'Medicine', icon: 'doc.text.fill', color: '#F3E5F5', route: '/medicineFinder' },
    { id: '3', title: 'Reminders', icon: 'bell.fill', color: '#E8F5E9', route: '/reminders' },
    { id: '4', title: 'Emergency', icon: 'exclamationmark.triangle.fill', color: '#FFEBEE', route: '/emergencyinfo' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
        <TouchableOpacity style={styles.notificationBtn}>
          <IconSymbol name="paperplane.fill" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'light' ? '#F5F5F5' : '#1A1A1A' }]}>
        <IconSymbol name="house.fill" size={20} color="#fff" />
        <TextInput
          placeholder="Search for doctors, labs..."
          placeholderTextColor="#fff"
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {/* Services Grid */}
      <ThemedText type="subtitle" style={styles.sectionTitle}>Our Services</ThemedText>
      <View style={styles.servicesGrid}>
        {services.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={styles.serviceItem}
            onPress={() => router.push(service.route as any)}
          >
            <View style={[styles.iconCircle, { backgroundColor: service.color }]}>
              <IconSymbol name={service.icon as any} size={28} color="#111" />
            </View>
            <ThemedText style={styles.serviceTitle}>{service.title}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Promotional Card */}
      <TouchableOpacity style={styles.promoCard}>
        <View style={styles.promoTextContainer}>
          <ThemedText type="defaultSemiBold" style={styles.promoTitle}>Virtual Consultation</ThemedText>
          <ThemedText style={styles.promoSub}>Connect with experts in 5 mins</ThemedText>
        </View>
        <Image
          source={{ uri: 'https://img.freepik.com/free-vector/doctor-character-background_1270-84.jpg' }}
          style={styles.promoImage}
        />
      </TouchableOpacity>

      {/* Health Tips */}
      <ThemedText type="subtitle" style={styles.sectionTitle}>Daily Health Tips</ThemedText>
      <View style={styles.tipCard}>
        <IconSymbol name="calendar" size={24} color="#0a7ea4" />
        <ThemedText style={styles.tipText}>
          Drink at least 8 glasses of water today to stay hydrated and energized!
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 120,
    height: 40,
  },
  notificationBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 15,
    marginBottom: 30,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontFamily: Typography.regular,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 15,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  serviceItem: {
    width: '23%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Typography.medium,
  },
  promoCard: {
    backgroundColor: '#0a7ea4',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  promoTextContainer: {
    flex: 1,
  },
  promoTitle: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 4,
  },
  promoSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontFamily: Typography.regular,
  },
  promoImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  tipCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 126, 164, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 40,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
