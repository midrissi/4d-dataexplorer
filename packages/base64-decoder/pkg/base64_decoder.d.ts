export function decodeBase64ToJsonObject(base64: string, allow_plain_json_string?: boolean | null, decode_private_binary_object?: boolean | null): string;
export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly decodeBase64ToJsonObject: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}
export type SyncInitInput = BufferSource | WebAssembly.Module;
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
