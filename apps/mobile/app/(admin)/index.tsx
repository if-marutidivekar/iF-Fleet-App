import { View, Text, StyleSheet } from 'react-native';

/**
 * Admin portal is web-only. The mobile app is for Drivers and Employees.
 */
export default function AdminMobileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🖥️</Text>
      <Text style={styles.heading}>Admin Portal</Text>
      <Text style={styles.body}>
        The Admin dashboard is available on the web app.{'\n'}
        Please open it in your browser.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: { fontSize: 56, marginBottom: 16 },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
});
