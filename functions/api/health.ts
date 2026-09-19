import { json } from '../../backend/api/http'

export const onRequestGet: PagesFunction = async () => json({ ok: true })
