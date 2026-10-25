let pendingFile: File | null = null;

/** Hands the file the player chose to the report screen that reads it; a file cannot travel in a URL. */
export function setPendingImportFile(file: File): void {
  pendingFile = file;
}

export function takePendingImportFile(): File | null {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
