import { assistantMessageRoute } from '../../../backend/api/routes'

export const onRequestPost: PagesFunction = ({ request }) => assistantMessageRoute(request)
