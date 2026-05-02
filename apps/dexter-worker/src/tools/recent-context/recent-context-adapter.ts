import type { RecentContextToolData, RecentContextToolInput } from "./recent-context-tool";

export interface RecentContextProvider {
  search(input: RecentContextToolInput): Promise<RecentContextToolData>;
}
