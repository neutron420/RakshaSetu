
import { Buffer } from 'buffer';

let _bleManager: any = null;
function getBleManager() {
  if (!_bleManager) {
    try {
      const { BleManager } = require('react-native-ble-plx');
      _bleManager = new BleManager();
    } catch {
      console.warn('[BLE] react-native-ble-plx not available (Expo Go?)');
    }
  }
  return _bleManager;
}

export const RAKSHA_SETU_SOS_UUID = '0000RS0S-0000-1000-8000-00805f9b34fb';

export interface SOSPayload {
  userId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

function encodePayload(payload: SOSPayload): string {

  const str = JSON.stringify(payload);
  return Buffer.from(str).toString('base64');
}

export async function startSOSBeacon(payload: SOSPayload) {
  console.log('[BLE] Generating SOS Payload...', payload);
  try {
    const encoded = encodePayload(payload);
    console.log('[BLE] Encoded data:', encoded);
    
    console.warn('[BLE-MOCK] Advertising started (Requires Peripheral Native permissions)');
  } catch (err) {
    console.error('[BLE] Failed to start SOS Beacon', err);
  }
}

export async function stopSOSBeacon() {
  console.warn('[BLE-MOCK] Advertising stopped');
}
