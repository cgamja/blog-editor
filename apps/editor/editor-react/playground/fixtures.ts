import { fixtures } from "@blog-editor/content-schema";

export type FixtureName = keyof typeof fixtures;
export const FIXTURE_NAMES = Object.keys(fixtures) as FixtureName[];
