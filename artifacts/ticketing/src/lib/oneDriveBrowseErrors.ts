export type OneDriveFolderErrorMessages = {
  loadFolderError: string;
  reconnectFolderError: string;
  accessFolderError: string;
  missingFolderError: string;
  setupFolderError: string;
};

export function getFolderLoadError(error: unknown, copy: OneDriveFolderErrorMessages): string {
  const status = error && typeof error === "object" && "status" in error
    ? (error as { status?: unknown }).status
    : undefined;
  if (status === 401) return copy.reconnectFolderError;
  if (status === 403) return copy.accessFolderError;
  if (status === 404) return copy.missingFolderError;
  if (status === 503) return copy.setupFolderError;
  return copy.loadFolderError;
}
