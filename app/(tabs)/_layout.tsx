import React from 'react';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-paper';

import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          
        },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={22} name="view-dashboard-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: t('tabs.goals'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={22} name="flag-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={22} name="shape-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="months"
        options={{
          title: t('tabs.tools'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={22} name="hammer-wrench" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={22} name="cog-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
