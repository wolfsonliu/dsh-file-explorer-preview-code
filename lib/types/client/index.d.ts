import type { FileExplorerService, Translate } from '@dsh-external/dsh-file-explorer/client';
interface ClientContext {
    fileExplorer: FileExplorerService;
    locale: {
        register(ns: string, locale: string, dict: Record<string, string>): () => void;
        bind(ns: string): Translate;
    };
    effect(callback: () => (() => void), label?: string): void;
}
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
