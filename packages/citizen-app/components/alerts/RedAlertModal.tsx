import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface RedAlertModalProps {
  visible: boolean;
  disasterType: string;
  location: string;
  severity: string;
  onClose: () => void;
}

export const RedAlertModal: React.FC<RedAlertModalProps> = ({ 
  visible, 
  disasterType, 
  location, 
  severity, 
  onClose 
}) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [visible]);

  const animatedCircleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
      opacity: interpolate(pulse.value, [1, 1.2], [0.5, 0], Extrapolate.CLAMP),
    };
  });

  if (!visible) return null;

  console.log('🔴 [RedAlertModal] Rendering modal on screen!');

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 99999 }]}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.container}>
          <View style={styles.alertCard}>
            {/* Pulsing Background Circle */}
            <Animated.View style={[styles.pulseCircle, animatedCircleStyle]} />
            
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="alert-decagram" size={80} color="#FF3B30" />
            </View>

            <Text style={styles.alertTitle}>RED ALERT</Text>
            <Text style={styles.disasterType}>{disasterType.toUpperCase()}</Text>
            
            <View style={styles.infoBox}>
              <Text style={styles.locationLabel}>DANGER ZONE:</Text>
              <Text style={styles.locationText}>{location}</Text>
            </View>

            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle}>IMMEDIATE ACTION:</Text>
              <Text style={styles.instructionText}>
                • Seek higher ground immediately.{"\n"}
                • Stay away from power lines.{"\n"}
                • Follow local authority instructions.
              </Text>
            </View>

            <TouchableOpacity style={styles.safeButton} onPress={onClose}>
              <Text style={styles.safeButtonText}>I AM SAFE / DISMISS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertCard: {
    width: '100%',
    backgroundColor: 'rgba(30, 0, 0, 0.85)',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FF3B30',
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF3B30',
    top: 20,
  },
  iconContainer: {
    marginBottom: 16,
    zIndex: 2,
  },
  alertTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FF3B30',
    letterSpacing: 2,
    marginBottom: 4,
  },
  disasterType: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 24,
  },
  infoBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  locationLabel: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  instructionBox: {
    width: '100%',
    marginBottom: 32,
  },
  instructionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    lineHeight: 22,
  },
  safeButton: {
    width: '100%',
    backgroundColor: '#FF3B30',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  safeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
