const trimTrailingSlash = (value?: string) => value?.replace(/\/+$/, '') ?? ''

const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_URL)
const agentBaseUrl = trimTrailingSlash(import.meta.env.VITE_AGENT_URL)

function buildUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath
}

export function apiUrl(path: string): string {
  return buildUrl(apiBaseUrl, path)
}

export function agentUrl(path: string): string {
  return buildUrl(agentBaseUrl, path)
}
