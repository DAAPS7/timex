import type { Credentials, User, UserData } from '../../../shared/domain'
import type { Db } from '../../core/env'
import { AppError } from '../../core/errors'
import { hashPassword, verifyPassword } from './passwords'

export const SESSION_DAYS = 30
const DAY_MS = 86_400_000

interface UserRow {
  id: string
  email: string
  password_hash: string
}

// Sessions are stored as a SHA-256 of the cookie token, so a leaked database does not leak usable sessions.
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const publicUser = (row: UserRow): User => ({ id: row.id, email: row.email })

export async function registerUser(db: Db, { email, password }: Credentials): Promise<User> {
  const taken = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (taken) throw new AppError('CONFLICT', 'Já existe uma conta com este email.')
  const user: User = { id: crypto.randomUUID(), email }
  await db
    .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(user.id, email, await hashPassword(password), new Date().toISOString())
    .run()
  return user
}

// Lazy because Workers forbid crypto work in global scope. Lets unknown emails cost the same as known ones.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('timex-dummy-password'))

export async function authenticate(db: Db, { email, password }: Credentials): Promise<User> {
  const row = await db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').bind(email).first<UserRow>()
  const ok = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()))
  if (!row || !ok) throw new AppError('UNAUTHORIZED', 'Email ou palavra-passe incorretos.')
  return publicUser(row)
}

/** Creates a session and returns the raw token (only ever sent to the client as an HttpOnly cookie). */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS).toISOString()
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), userId, expires).run()
  return token
}

export async function userFromSession(db: Db, token: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT u.id, u.email, u.password_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?')
    .bind(await sha256(token), new Date().toISOString())
    .first<UserRow>()
  return row ? publicUser(row) : null
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run()
}

export async function loadUserData(db: Db, userId: string): Promise<UserData | null> {
  const row = await db.prepare('SELECT data FROM user_data WHERE user_id = ?').bind(userId).first<{ data: string }>()
  return row ? (JSON.parse(row.data) as UserData) : null
}

export async function saveUserData(db: Db, userId: string, data: UserData): Promise<void> {
  await db
    .prepare(
      'INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
    )
    .bind(userId, JSON.stringify(data), new Date().toISOString())
    .run()
}
