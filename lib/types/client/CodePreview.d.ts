import { type ComponentType } from 'react';
import type { PreviewProps, Translate } from '@dsh-external/dsh-file-explorer/client';
type WriteFile = (path: string, content: string) => Promise<void>;
type ReadRaw = (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>;
/**
 * Create the code preview component, closing over the `writeFile` service
 * method, `readRaw` for large/binary files, and the plugin's own translator.
 */
export declare function makeCodePreview(writeFile: WriteFile, readRaw: ReadRaw | undefined, t: Translate): ComponentType<PreviewProps>;
export {};
