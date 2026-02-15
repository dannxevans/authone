import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';
import { apiClient } from '../api/client.ts';

export interface PasskeyInfo {
  id: string;
  name: string;
  aaguid: string;
  transports: string[];
  createdAt: number;
  lastUsedAt: number | null;
}

export async function getRegistrationChallenge(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { data } = await apiClient.post<PublicKeyCredentialCreationOptionsJSON>(
    '/auth/passkey/register/challenge'
  );
  return data;
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  name?: string
): Promise<{ ok: boolean; passkeyId: string; name: string }> {
  const { data } = await apiClient.post<{ ok: boolean; passkeyId: string; name: string }>(
    '/auth/passkey/register/verify',
    { response, name }
  );
  return data;
}

export async function getAuthChallenge(): Promise<
  PublicKeyCredentialRequestOptionsJSON & { sessionId: string }
> {
  const { data } = await apiClient.post<
    PublicKeyCredentialRequestOptionsJSON & { sessionId: string }
  >('/auth/passkey/authenticate/challenge');
  return data;
}

export async function verifyAuthentication(
  sessionId: string,
  response: AuthenticationResponseJSON
): Promise<{ accessToken: string; user: { id: string; username: string } }> {
  const { data } = await apiClient.post<{
    accessToken: string;
    user: { id: string; username: string };
  }>('/auth/passkey/authenticate/verify', { sessionId, response });
  return data;
}

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  const { data } = await apiClient.get<PasskeyInfo[]>('/auth/passkey/credentials');
  return data;
}

export async function deletePasskey(id: string): Promise<void> {
  await apiClient.delete(`/auth/passkey/credentials/${id}`);
}
