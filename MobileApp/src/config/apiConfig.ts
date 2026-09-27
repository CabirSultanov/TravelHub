import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const apiPort = 5207;

export class ApiConfigurationError extends Error {}

type ApiConfigInput = {
  explicitUrl?: string | null;
  expoHostUri?: string | null;
  isAndroidEmulator?: boolean;
};

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function getHostFromExpoUri(hostUri: string) {
  const trimmedHostUri = hostUri.trim();
  if (!trimmedHostUri) {
    return null;
  }

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedHostUri)
        ? trimmedHostUri
        : `http://${trimmedHostUri}`,
    );

    return url.hostname;
  } catch {
    return null;
  }
}

function isLocalOnlyHost(host: string) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host === '0.0.0.0';
}

export function resolveApiBaseUrl({ explicitUrl, expoHostUri, isAndroidEmulator = false }: ApiConfigInput) {
  if (explicitUrl?.trim()) {
    return normalizeApiBaseUrl(explicitUrl);
  }

  const host = expoHostUri ? getHostFromExpoUri(expoHostUri) : null;
  if (isAndroidEmulator && host && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    // Android Emulator's built-in alias for the development computer, not the phone's localhost.
    return `http://10.0.2.2:${apiPort}`;
  }
  if (!host || isLocalOnlyHost(host)) {
    throw new ApiConfigurationError(
      'Unable to determine a LAN address for TravelHub.Api. Start Expo in LAN mode or configure EXPO_PUBLIC_API_URL.',
    );
  }

  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${formattedHost}:${apiPort}`;
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl({
    explicitUrl: process.env.EXPO_PUBLIC_API_URL,
    expoHostUri: Constants.expoConfig?.hostUri,
    isAndroidEmulator: __DEV__ && Platform.OS === 'android' && !Device.isDevice,
  });
}

export function getApiDebugInfo() {
  try {
    return getApiBaseUrl();
  } catch {
    return null;
  }
}
