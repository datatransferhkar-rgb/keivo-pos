/* eslint-disable @typescript-eslint/no-explicit-any */
interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  watchAdvertisements?: () => Promise<void>;
  addEventListener: (type: string, listener: (this: this, ev: any) => any) => void;
  [key: string]: any;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGATTServer>;
  disconnect: () => void;
  getPrimaryService: (service: any) => Promise<BluetoothRemoteGATTService>;
  getPrimaryServices: (service?: any) => Promise<BluetoothRemoteGATTService[]>;
  [key: string]: any;
}

interface BluetoothRemoteGATTService {
  device: BluetoothDevice;
  uuid: string;
  isPrimary: boolean;
  getCharacteristic: (characteristic: any) => Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics: (characteristic?: any) => Promise<BluetoothRemoteGATTCharacteristic[]>;
  [key: string]: any;
}

interface BluetoothRemoteGATTCharacteristic {
  service: BluetoothRemoteGATTService;
  uuid: string;
  properties: {
    broadcast?: boolean;
    read?: boolean;
    writeWithoutResponse?: boolean;
    write?: boolean;
    notify?: boolean;
    indicate?: boolean;
    authenticatedSignedWrites?: boolean;
    reliableWrite?: boolean;
    writableAuxiliaries?: boolean;
  };
  value?: DataView;
  writeValue: (value: BufferSource) => Promise<void>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse: (value: BufferSource) => Promise<void>;
  [key: string]: any;
}

interface Navigator {
  bluetooth?: {
    requestDevice: (options?: any) => Promise<BluetoothDevice>;
    getDevices?: () => Promise<BluetoothDevice[]>;
    [key: string]: any;
  };
}
