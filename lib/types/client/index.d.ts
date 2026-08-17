import type { FileExplorerService, Translate } from '@dsh-external/dsh-file-explorer/client';
type MyFileExplorer = FileExplorerService & {
    readRawFile?: (path: string, offset?: number, limit?: number) => Promise<ArrayBuffer>;
};
interface ClientContext {
    fileExplorer: MyFileExplorer;
    locale: {
        register(ns: string, locale: string, dict: Record<string, string>): () => void;
        bind(ns: string): Translate;
    };
    effect(callback: () => (() => void), label?: string): void;
}
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
