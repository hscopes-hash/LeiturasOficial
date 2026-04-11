import crypto from 'node:crypto';

/**
 * Gera um token JWT para autenticação com a API da Zhipu AI (GLM).
 *
 * A API Key da Zhipu AI tem formato: {id}.{secret}
 * O JWT é gerado usando HMAC-SHA256 com o secret como chave.
 *
 * @param apiKey - API Key completa no formato "{id}.{secret}"
 * @param expSeconds - Validade do token em segundos (padrão: 3600 = 1 hora)
 * @returns Token JWT string
 */
export function generateZhipuToken(apiKey: string, expSeconds: number = 3600): string {
  const dotIndex = apiKey.indexOf('.');
  if (dotIndex === -1) {
    throw new Error('Formato de API Key Zhipu AI inválido. Esperado: {id}.{secret}');
  }

  const id = apiKey.substring(0, dotIndex);
  const secret = apiKey.substring(dotIndex + 1);

  // Header com sign_type obrigatório
  const header = JSON.stringify({ alg: 'HS256', sign_type: 'SIGN' });

  // Payload com timestamps em MILISSEGUNDOS (diferente do JWT padrão)
  const now = Date.now();
  const payload = JSON.stringify({
    api_key: id,
    exp: now + expSeconds * 1000,
    timestamp: now,
  });

  // Base64url sem padding
  function base64url(str: string): string {
    return Buffer.from(str, 'utf-8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  const encodedHeader = base64url(header);
  const encodedPayload = base64url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Assinar com HMAC-SHA256 usando o secret
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signature}`;
}
