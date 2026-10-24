import rawSchema from '../../data/field_collection_schema.json';

export type FieldInputType = 'text' | 'date' | 'number';

export interface FieldDefinition {
  key: string;
  label: string;
  unit: string;
  input_type: FieldInputType;
  required: boolean;
  required_for_model: boolean;
  min?: number;
  max?: number;
  step?: number;
  note: string;
  importance: string;
  source_hint: string;
}

export interface FieldSection {
  title: string;
  description: string;
  fields: FieldDefinition[];
}

export interface FieldCollectionSchema {
  title: string;
  subtitle: string;
  instructions: string;
  sections: FieldSection[];
}

export const FIELD_SCHEMA = rawSchema as FieldCollectionSchema;
export const FIELD_DEFINITIONS = FIELD_SCHEMA.sections.flatMap((section) => section.fields);
export const FIELD_BY_KEY = new Map(FIELD_DEFINITIONS.map((field) => [field.key, field]));
export const MODEL_FIELDS = FIELD_DEFINITIONS.filter((field) => field.required_for_model);
export const CONTEXT_FIELDS = FIELD_DEFINITIONS.filter((field) => !field.required_for_model);
