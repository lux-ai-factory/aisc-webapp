/** A file name without its last extension; names that are only an extension (".env") are kept whole. */
export function fileBaseName(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}
