import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0a7ea4',
        tabBarInactiveTintColor: '#888',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontFamily: Typography.medium,
          fontSize: 10,
        },
        tabBarStyle: {
          paddingTop: 5,
          height: 85,
          paddingBottom: 25,
          backgroundColor: '#fff',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="symptomTriage"
        options={{
          title: 'Symptoms',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="waveform.path.ecg" color={color} />,
        }}
      />
      <Tabs.Screen
        name="medicineFinder"
        options={{
          title: 'Medicine',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="bell.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="emergencyinfo"
        options={{
          title: 'SOS',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="exclamationmark.triangle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
