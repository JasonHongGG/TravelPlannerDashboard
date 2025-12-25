
import { TripInput, TripData, Message, AttractionRecommendation } from "../types";

export interface UpdateResult {
    responseText: string;
    updatedData?: TripData;
}

export interface IAIService {
    /**
     * Generates a full trip itinerary based on user input.
     */
    generateTrip(input: TripInput): Promise<TripData>;

    /**
     * Updates an existing itinerary based on chat history and user request.
     * Supports streaming "thoughts" or text back to the UI via the onThought callback.
     */
    updateTrip(
        currentData: TripData, 
        history: Message[], 
        onThought?: (text: string) => void
    ): Promise<UpdateResult>;

    /**
     * Gets a list of recommendations for a specific location and category.
     */
    getRecommendations(
        location: string, 
        interests: string,
        category?: 'attraction' | 'food',
        excludeNames?: string[]
    ): Promise<AttractionRecommendation[]>;
}
