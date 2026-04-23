import type { OfficialRetrievalMetadata, OfficialSourceFamily } from "./official-source";
import {
  officialMissingFieldStateSchema,
  officialRetrievalMetadataSchema,
  officialSourceFamilies
} from "./official-source";

export const structuralContextCoverageStates = ["full", "partial", "limited"] as const;
export type StructuralContextCoverageState = (typeof structuralContextCoverageStates)[number];

export const structuralContextSubjectTypes = ["issuer", "market_pulse"] as const;
export type StructuralContextSubjectType = (typeof structuralContextSubjectTypes)[number];

export const structuralContextFamilies = [
  "gdp_level",
  "gdp_per_capita",
  "population",
  "trade_openness",
  "debt_context",
  "inequality",
  "logistics",
  "infrastructure",
  "education",
  "energy_access",
  "sector_mix",
  "gdp_growth_outlook",
  "inflation_regime",
  "fiscal_balance",
  "public_debt",
  "fx_reserves",
  "current_account"
] as const;
export type StructuralContextFamily = (typeof structuralContextFamilies)[number];

export interface StructuralContextIssuerMetadata {
  name?: string;
  exchange?: string;
  currency?: string;
  domicile_country?: string;
  region?: string;
  sector?: string;
  industry?: string;
}

export interface StructuralContextObservation {
  observation_id: string;
  family: StructuralContextFamily;
  label: string;
  summary: string;
  geography: string;
  period: string;
  source_family: OfficialSourceFamily;
  retrieval: OfficialRetrievalMetadata;
  missing_fields: Array<Record<string, unknown>>;
  value?: number;
  unit?: string;
}

export interface StructuralContextOmission {
  omission_id: string;
  family: StructuralContextFamily | "registry";
  source_family: OfficialSourceFamily;
  reason_code: string;
  reason_text: string;
  blocking: boolean;
}

export interface StructuralContextPack {
  subject_type: StructuralContextSubjectType;
  subject_id: string;
  as_of: string;
  coverage_state: StructuralContextCoverageState;
  summary: string;
  issuer_metadata?: StructuralContextIssuerMetadata;
  observations: StructuralContextObservation[];
  omissions: StructuralContextOmission[];
  retrievals: OfficialRetrievalMetadata[];
}

export const structuralContextIssuerMetadataSchema = {
  $id: "StructuralContextIssuerMetadata",
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    exchange: { type: "string" },
    currency: { type: "string" },
    domicile_country: { type: "string" },
    region: { type: "string" },
    sector: { type: "string" },
    industry: { type: "string" }
  }
} as const;

export const structuralContextObservationSchema = {
  $id: "StructuralContextObservation",
  type: "object",
  additionalProperties: false,
  required: [
    "observation_id",
    "family",
    "label",
    "summary",
    "geography",
    "period",
    "source_family",
    "retrieval",
    "missing_fields"
  ],
  properties: {
    observation_id: { type: "string" },
    family: {
      type: "string",
      enum: structuralContextFamilies
    },
    label: { type: "string" },
    summary: { type: "string" },
    geography: { type: "string" },
    period: { type: "string" },
    source_family: {
      type: "string",
      enum: officialSourceFamilies
    },
    retrieval: officialRetrievalMetadataSchema,
    missing_fields: {
      type: "array",
      items: officialMissingFieldStateSchema
    },
    value: { type: "number" },
    unit: { type: "string" }
  }
} as const;

export const structuralContextOmissionSchema = {
  $id: "StructuralContextOmission",
  type: "object",
  additionalProperties: false,
  required: [
    "omission_id",
    "family",
    "source_family",
    "reason_code",
    "reason_text",
    "blocking"
  ],
  properties: {
    omission_id: { type: "string" },
    family: {
      type: "string",
      enum: [...structuralContextFamilies, "registry"]
    },
    source_family: {
      type: "string",
      enum: officialSourceFamilies
    },
    reason_code: { type: "string" },
    reason_text: { type: "string" },
    blocking: { type: "boolean" }
  }
} as const;

export const structuralContextPackSchema = {
  $id: "StructuralContextPack",
  type: "object",
  additionalProperties: false,
  required: [
    "subject_type",
    "subject_id",
    "as_of",
    "coverage_state",
    "summary",
    "observations",
    "omissions",
    "retrievals"
  ],
  properties: {
    subject_type: {
      type: "string",
      enum: structuralContextSubjectTypes
    },
    subject_id: { type: "string" },
    as_of: { type: "string" },
    coverage_state: {
      type: "string",
      enum: structuralContextCoverageStates
    },
    summary: { type: "string" },
    issuer_metadata: structuralContextIssuerMetadataSchema,
    observations: {
      type: "array",
      items: structuralContextObservationSchema
    },
    omissions: {
      type: "array",
      items: structuralContextOmissionSchema
    },
    retrievals: {
      type: "array",
      items: officialRetrievalMetadataSchema
    }
  }
} as const;
