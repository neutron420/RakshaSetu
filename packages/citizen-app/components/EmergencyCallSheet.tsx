import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type EmergencyContact = {
  name: string;
  number: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
};

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { name: 'Police', number: '100', icon: 'shield', color: '#1565C0', description: 'Law enforcement' },
  { name: 'Fire Brigade', number: '101', icon: 'flame', color: '#E53935', description: 'Fire emergencies' },
  { name: 'Ambulance', number: '102', icon: 'medkit', color: '#43A047', description: 'Medical emergencies' },
  { name: 'Unified Emergency', number: '112', icon: 'call', color: '#D32F2F', description: 'All emergencies' },
  { name: 'Disaster (NDRF)', number: '1078', icon: 'thunderstorm', color: '#5E35B1', description: 'Natural disasters' },
  { name: 'Women Helpline', number: '1091', icon: 'people', color: '#AD1457', description: 'Women safety' },
  { name: 'Child Helpline', number: '1098', icon: 'heart', color: '#FB8C00', description: 'Child protection' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function EmergencyCallSheet({ visible, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  function handleCall(number: string) {
    const phoneUrl = Platform.OS === 'android' ? `tel:${number}` : `telprompt:${number}`;
    Linking.openURL(phoneUrl).catch(() => {
      Linking.openURL(`tel:${number}`);
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="call" size={24} color="#D32F2F" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Emergency Contacts</Text>
            <Text style={styles.headerSubtitle}>Tap to call immediately</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            onPress={onClose}
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color="#7A8BA8" />
          </Pressable>
        </View>

        {/* Contact List */}
        {EMERGENCY_CONTACTS.map((contact, index) => (
          <Pressable
            key={contact.number}
            style={({ pressed }) => [
              styles.contactRow,
              pressed && styles.contactRowPressed,
              index === EMERGENCY_CONTACTS.length - 1 && { borderBottomWidth: 0 },
            ]}
            onPress={() => handleCall(contact.number)}
          >
            <View style={[styles.contactIcon, { backgroundColor: contact.color + '15' }]}>
              <Ionicons name={contact.icon} size={22} color={contact.color} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactDesc}>{contact.description}</Text>
            </View>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{contact.number}</Text>
            </View>
            <Ionicons name="call-outline" size={20} color="#43A047" />
          </Pressable>
        ))}

        {/* Safety Tip */}
        <View style={styles.tipRow}>
          <Ionicons name="information-circle" size={16} color="#9CABC2" />
          <Text style={styles.tipText}>
            Dial 112 for any emergency — it connects to all services
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D8E4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
    marginBottom: 4,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CABC2',
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F8FC',
  },
  contactRowPressed: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  contactDesc: {
    fontSize: 12,
    color: '#9CABC2',
    fontWeight: '500',
    marginTop: 1,
  },
  numberBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
  },
  numberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  tipText: {
    fontSize: 12,
    color: '#9CABC2',
    fontWeight: '500',
    flex: 1,
  },
});
