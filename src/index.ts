export { TokenStore } from "./token-store/token-store.ts";
import * as metaData from "./meta.ts";
export const meta = { ...metaData };
export type {
  SyntaxElement,
  TokenFilter,
  CursorWithSkipOptionsWithoutFilter,
  CursorWithSkipOptionsWithFilter,
  CursorWithSkipOptionsWithComment,
  CursorWithCountOptionsWithoutFilter,
  CursorWithCountOptionsWithFilter,
  CursorWithCountOptionsWithComment,
} from "./types.ts";
