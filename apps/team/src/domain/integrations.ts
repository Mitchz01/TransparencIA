// Mirrors apps/api/app/domain/integrations.py and the API contract of spec 007
// (apps/team/docs/api-contract.md, "IntegrationGateway").

import type { Member } from './project'

export interface Connection {
  repository: string
  has_token: boolean
  mode: 'github' | 'test' // test = no token anywhere, nothing reaches GitHub
  webhook_registered: boolean
  replaced: string | null
}

export interface ConnectRequest {
  repository: string // owner/name
  token?: string // omit to keep the current one; "" deletes it
}

export interface GithubUsernameResult {
  member: Member
  has_access: boolean | null // false = saved with a warning; null = couldn't check
}

export const REPOSITORY_PATTERN = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/
