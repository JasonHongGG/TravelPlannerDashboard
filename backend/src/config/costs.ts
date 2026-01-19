import { calculateTripCost } from '../utils/sharedUtils';

export const COSTS = {
    GENERATE_TRIP: 50,
    CHAT_UPDATE: 10,
    GET_RECOMMENDATIONS: 20,
    CHECK_FEASIBILITY: 0 // Free check
};

export type PointAction = keyof typeof COSTS;

export const calculateCost = (action: string, params?: any): number => {
    if (action === 'GENERATE_TRIP') {
        if (params && params.dateRange) {
            return calculateTripCost(params.dateRange);
        }
        return COSTS.GENERATE_TRIP;
    }
    return (COSTS as any)[action] || 9999;
};
