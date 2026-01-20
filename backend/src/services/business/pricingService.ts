import { COSTS, TRIP_DAILY_COST, NEW_USER_BONUS, ATTRACTION_SEARCH_COST, calculateCost, PointAction } from "../../config/costConfig";

export class PricingService {
    getConfig() {
        return {
            TRIP_BASE_COST: COSTS.GENERATE_TRIP,
            TRIP_DAILY_COST,
            NEW_USER_BONUS,
            ATTRACTION_SEARCH_COST
        };
    }

    calculate(action: string, params?: any): number {
        return calculateCost(action as PointAction, params);
    }
}

export const pricingService = new PricingService();
