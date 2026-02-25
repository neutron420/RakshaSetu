import { SOSPayload } from './beacon';
import { BASE_URL } from '../api'; 
import { getToken } from '../auth-store';
import NetInfo from '@react-native-community/netinfo';

export async function relayOfflineSosBeacon(victimPayload: SOSPayload): Promise<boolean> {
  const netState = await NetInfo.fetch();
  
  if (!netState.isConnected) {
    console.warn('[BLE Relay] Cannot relay victim beacon. We also do not have internet!');
    return false;
  }

  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/sos/ble-relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
         victimId: victimPayload.userId,
         latitude: victimPayload.lat,
         longitude: victimPayload.lng,
         originalTimestamp: victimPayload.timestamp,
         meshProtocol: 'v1'
      })
    });

    if (!response.ok) {
       console.error('[BLE Relay] Backend rejected our relay packet', response.status);
       return false;
    }

    console.log('[BLE Relay] Payload handed off to API successfully!');
    return true;

  } catch (err) {
    console.error('[BLE Relay] Network request failed', err);
    return false;
  }
}
