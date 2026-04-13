import crypto from 'node:crypto';

// ============================================
// DETECÇÃO DE PROVEDOR
// ============================================

export type Provider = 'gemini' | 'glm' | 'openrouter';

/**
 * Detecta o provedor baseado no nome do modelo.
 * OpenRouter: contém "/" (ex: google/gemini-2.0-flash-exp:free)
 * GLM: começa com "glm-"
 * Gemini: demais casos
 */
export function detectProvider(model: string): Provider {
  if (model.includes('/')) return 'openrouter';
  if (model.startsWith('glm-')) return 'glm';
  return 'gemini';
}

/**
 * Retorna a API Key correta baseada no provedor do modelo.
 * - OpenRouter: usa a key do usuário (mesma lógica do Gemini)
 * - GLM: usa LLM_API_KEY_GLM (ou fallback para LLM_API_KEY)
 * - Gemini: usa LLM_API_KEY
 */
export function getApiKeyForModel(model: string, empresaApiKey?: string | null, empresaApiKeyFallback?: string | null, empresaApiKeyGlm?: string | null, empresaApiKeyOpenrouter?: string | null): string | null {
  const provider = detectProvider(model);
  if (provider === 'glm') {
    // GLM: key do provedor > key informada > env var
    return empresaApiKey?.trim() || empresaApiKeyGlm?.trim() || empresaApiKeyFallback?.trim() || process.env.LLM_API_KEY_GLM?.trim() || process.env.LLM_API_KEY?.trim() || null;
  }
  if (provider === 'openrouter') {
    // OpenRouter: key do provedor > key informada > env var
    return empresaApiKey?.trim() || empresaApiKeyOpenrouter?.trim() || empresaApiKeyFallback?.trim() || process.env.LLM_API_KEY?.trim() || null;
  }
  // Gemini: key informada > key fallback > env var
  return empresaApiKey?.trim() || empresaApiKeyFallback?.trim() || process.env.LLM_API_KEY?.trim() || null;
}

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
