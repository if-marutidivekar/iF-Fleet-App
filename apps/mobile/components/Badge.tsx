import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  color: string;
}

export function Badge({ label, color }: Props) {
  return (
    <View style={[s.wrap, { backgroundColor: color + '20', borderColor: color + '50' }]}>
      <Text style={[s.text, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700' },
});
