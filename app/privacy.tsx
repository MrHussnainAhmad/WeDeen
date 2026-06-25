import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { PRIVACY_POLICY_MD } from '../constants/PrivacyPolicy';
import { colors, fonts } from '../theme/colors';

export default function PrivacyPolicyScreen() {
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.startsWith('### ')) {
        return <Text key={index} style={styles.h3}>{line.replace('### ', '')}</Text>;
      } else if (line.startsWith('## ')) {
        return <Text key={index} style={styles.h2}>{line.replace('## ', '')}</Text>;
      } else if (line.startsWith('# ')) {
        return <Text key={index} style={styles.h1}>{line.replace('# ', '')}</Text>;
      } else if (line.startsWith('- ')) {
        return (
          <View key={index} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{line.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '$1')}</Text>
          </View>
        );
      } else if (line.trim() === '---') {
        return <View key={index} style={styles.divider} />;
      } else if (line.trim() === '') {
        return <View key={index} style={styles.spacing} />;
      } else {
        // Handle bold text in paragraphs
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <Text key={index} style={styles.paragraph}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
              }
              return part;
            })}
          </Text>
        );
      }
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Privacy Policy', headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderMarkdown(PRIVACY_POLICY_MD)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  h1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    fontFamily: fonts.serif,
  },
  h2: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primaryDark,
    marginTop: 16,
    marginBottom: 8,
  },
  h3: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  bold: {
    fontWeight: 'bold',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 8,
    lineHeight: 24,
  },
  listText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 20,
  },
  spacing: {
    height: 8,
  },
});
