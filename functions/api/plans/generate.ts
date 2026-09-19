import { generatePlanRoute } from '../../../backend/api/routes'

export const onRequestPost: PagesFunction = ({ request }) => generatePlanRoute(request)
