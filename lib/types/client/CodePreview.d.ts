import { type ComponentType } from 'react';
import type { PreviewProps, Translate } from '@dsh-external/dsh-file-explorer/client';
type WriteFile = (path: string, content: string) => Promise<void>;
/**
 * Create the code preview component, closing over the `writeFile` service
 * method and the plugin's own translator (the PreviewProps `t` is bound to the
 * file-explorer namespace, not ours).
 */
export declare function makeCodePreview(writeFile: WriteFile, t: Translate): ComponentType<PreviewProps>;
export {};
