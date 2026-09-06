import { v4 as uuidv4 } from "uuid";
import type {
  ExplorationBuilderState,
  SavedExploration,
} from "@/lib/explore/exploration-models";
import { getDb } from "./db";

export async function saveExploration(input: {
  id?: string;
  name: string;
  builder: ExplorationBuilderState;
}): Promise<SavedExploration> {
  const now = new Date().toISOString();
  const id = input.id ?? uuidv4();
  const existing = await getDb().explorations.get(id);
  const record: SavedExploration = {
    id,
    name: input.name.trim() || "Custom exploration",
    builder: input.builder,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await getDb().explorations.put(record);
  return record;
}

export async function listExplorations(): Promise<SavedExploration[]> {
  const rows = await getDb().explorations.toArray();
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getExploration(
  id: string,
): Promise<SavedExploration | undefined> {
  return getDb().explorations.get(id);
}

export async function deleteExploration(id: string): Promise<void> {
  await getDb().explorations.delete(id);
}
