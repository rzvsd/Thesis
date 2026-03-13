export interface ScreenSchema {
  id: string;
  version: string;
}

export interface EmptyStateSchema extends ScreenSchema {
  message: string;
}
