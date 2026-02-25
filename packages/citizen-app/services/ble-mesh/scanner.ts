import { RAKSHA_SETU_SOS_UUID, SOSPayload } from './beacon';
import { relayOfflineSosBeacon } from './relay-api';
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

let isScanning = false;


function decodePayload(base64Payload: string): SOSPayload | null {
  try {
    const jsonStr = Buffer.from(base64Payload, 'base64').toString('ascii');
    return JSON.parse(jsonStr) as SOSPayload;
  } catch (err) {
    console.error('[BLE] Failed to parse beacon payload', err);
    return null;
  }
}


export async function startBackgroundBLEScanner() {
  if (isScanning) return;

  const bleManager = getBleManager();
  if (!bleManager) {
    console.warn('[BLE] Scanner unavailable — native BLE module not loaded.');
    return;
  }

  console.log('[BLE] Starting passive Scanner for SOS devices...');

  try {
    const state = await bleManager.state();
    if (state !== 'PoweredOn') {
      console.warn('[BLE] Bluetooth is not powered on');
      return;
    }

    isScanning = true;

    // Scan ONLY for devices broadcasting the exact RakshaSetu Service UUID.
    bleManager.startDeviceScan(
      [RAKSHA_SETU_SOS_UUID], 
      { allowDuplicates: false }, 
      async (error: any, device: any) => {
        if (error) {
           console.error('[BLE] Scan Error', error);
           isScanning = false;
           return;
        }

        if (device) {
          console.log(`[BLE] 🚨 MESH DETECTED! Found offline citizen beacon: ${device.id}`);
          
          if (device.name) {
             console.log(`[BLE] Extracted offline payload bytes:`, device.name);
             const victimData = decodePayload(device.name);
             
             if (victimData) {
               console.log(`[BLE] Successfully decoded offline victim coordinates: `, victimData.lat, victimData.lng);
               
               // The Savior's phone will now attempt to relay this over the internet
               const wasRelayed = await relayOfflineSosBeacon(victimData);
               
               if (wasRelayed) {
                  console.log(`[BLE] Successfully relayed offline victim to the backend map!`);
               } else {
                  console.warn(`[BLE] Could not relay (Savior might also be offline).`);
               }
             }
          }
        }
      }
    );
  } catch (err) {
    console.error('[BLE] Critical scanner failure', err);
    isScanning = false;
  }
}

export function stopBLEScanner() {
  if (isScanning) {
    const bleManager = getBleManager();
    bleManager?.stopDeviceScan();
    isScanning = false;
    console.log('[BLE] Scanner stopped');
  }
}
