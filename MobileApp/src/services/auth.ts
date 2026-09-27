import * as SecureStore from 'expo-secure-store';

const accessTokenKey = 'travelhub.driver.access-token';

export function saveToken(token: string) {
  return SecureStore.setItemAsync(accessTokenKey, token);
}

export function getToken() {
  return SecureStore.getItemAsync(accessTokenKey);
}

export function deleteToken() {
  return SecureStore.deleteItemAsync(accessTokenKey);
}
