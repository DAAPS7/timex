import { health } from '../../backend/api/routes'

export const onRequestGet: PagesFunction = () => health()
