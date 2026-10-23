import type { AuthGateway } from '../../application/ports'
import type { Account } from '../../domain/account'
import { http } from './client'

// The session is an HttpOnly cookie the browser sends by itself on /api: nothing to read or store here.
export const httpAuthGateway: AuthGateway = {
  signUp: (body) => http.post<Account>('/auth/signup', body),
  signIn: (body) => http.post<Account>('/auth/signin', body),
  signOut: () => http.post<void>('/auth/signout'),
  me: () => http.get<Account>('/me'),
  updateProfile: (body) => http.patch<Account>('/me', body),
}
