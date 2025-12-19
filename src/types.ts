export type SunExposure = "full_sun" | "partial_shade" | "shade";
export type SoilType = "clay" | "sandy" | "loam" | "well_drained" | "organic";
export type WaterPreference = "low" | "medium" | "high";
export type MaintenanceLevel = "low" | "medium" | "high";
export type WindExposure = "exposed" | "sheltered";

export interface RecommendationRequest {
  city: string;
  country: string;
  sun_exposure: SunExposure;
  soil_type: SoilType;
  watering_preference: WaterPreference;
  maintenance_preference: MaintenanceLevel;
  wind_exposure: WindExposure;
}

export interface PlantScoreBreakdown {
  sun: number;
  soil: number;
  water: number;
  maintenance: number;
  wind: number;
  climate: number;
}

export interface PlantRecommendation {
  plant_id: number;
  name_tr: string;
  name_latin: string;
  suitability_status: string;
  total_score: number;
  cost_level: string;
  maintenance_summary: string;
  breakdown: PlantScoreBreakdown;
}

export interface AIRecommendationRequest extends RecommendationRequest {
  top_n?: number;
  language?: string;
}

export interface AIChosenPlant {
  plant_id: number;
  reasoning: string;
  source: string;
}

export interface AIRecommendationResponse {
  rule_based_results: PlantRecommendation[];
  ai_best: AIChosenPlant | null;
}
