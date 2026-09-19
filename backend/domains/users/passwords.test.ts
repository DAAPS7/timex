import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './passwords'

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse')
    expect(hash.startsWith('pbkdf2$')).toBe(true)
    expect(await verifyPassword('correct horse', hash)).toBe(true)
    expect(await verifyPassword('wrong horse', hash)).toBe(false)
  })

  it('salts each hash and rejects malformed values', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })
})
