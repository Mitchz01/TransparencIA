// Where the executing entity signs in: the team app (spec 018). Its own origin, so it's a full URL.
export const TEAM_APP_URL = (import.meta.env.VITE_TEAM_APP_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5173'
