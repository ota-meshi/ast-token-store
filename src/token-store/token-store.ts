import type {
  CursorWithCountOptionsWithoutFilter,
  CursorWithCountOptionsWithComment,
  CursorWithCountOptionsWithFilter,
  CursorWithSkipOptionsWithoutFilter,
  CursorWithSkipOptionsWithComment,
  CursorWithSkipOptionsWithFilter,
  SyntaxElement,
  TokenFilter,
} from "../types.ts";

/**
 * Binary search for the index of the first token that is after the given location.
 */
function search(tokens: SyntaxElement[], location: number): number {
  let minIndex = 0;
  let maxIndex = tokens.length - 1;

  while (minIndex <= maxIndex) {
    const index = Math.floor((minIndex + maxIndex) / 2);
    const token = tokens[index];
    const tokenStartLocation = token.range[0];

    if (tokenStartLocation < location) {
      minIndex = index + 1;
    } else if (tokenStartLocation > location) {
      maxIndex = index - 1;
    } else {
      return index;
    }
  }

  return minIndex;
}

/**
 * Get the index of the first token that is after the given location.
 */
function getFirstIndex(
  tokens: SyntaxElement[],
  indexMap: Map<number, number>,
  startLoc: number,
): number {
  let index = indexMap.get(startLoc);
  if (index == null) {
    index = search(tokens, startLoc);
  }
  while (
    index < tokens.length &&
    tokens[index].range[1] <= tokens[index].range[0]
  ) {
    index++;
  }
  return index;
}

/**
 * Get the index of the last token that is before the given location.
 */
function getLastIndex(
  tokens: SyntaxElement[],
  indexMap: Map<number, number>,
  endLoc: number,
): number {
  let index = indexMap.get(endLoc);
  if (index != null) {
    index--;
  } else {
    index = search(tokens, endLoc) - 1;
  }
  while (index >= 0 && tokens[index].range[1] <= tokens[index].range[0]) {
    index--;
  }
  return index;
}

type TokenContext<
  Token extends SyntaxElement,
  Comment extends SyntaxElement,
> = {
  isComment: (token: Token | Comment) => token is Comment;
  isNotComment: (token: Token | Comment) => boolean;
};

/**
 * Normalizes the options for cursor methods.
 */
function normalizeSkipOptions<
  Token extends SyntaxElement,
  Comment extends SyntaxElement,
>(
  options:
    | CursorWithSkipOptionsWithoutFilter
    | CursorWithSkipOptionsWithFilter<Token, Token>
    | CursorWithSkipOptionsWithComment<Token, Comment, Token | Comment>
    | undefined,
  ctx: TokenContext<Token, Comment>,
): {
  filter: TokenFilter<Token | Comment>;
  skip: number;
} {
  if (typeof options === "number") {
    return { filter: ctx.isNotComment, skip: options };
  }
  if (typeof options === "function") {
    return {
      filter: (n) => {
        if (ctx.isComment(n)) {
          return false;
        }
        return options(n);
      },
      skip: 0,
    };
  }
  let filter: TokenFilter<Token | Comment>;
  if (options?.includeComments) {
    filter = options?.filter ?? (() => true);
  } else if (options?.filter) {
    const baseFilter = options?.filter;
    filter = (token) => {
      if (ctx.isComment(token)) {
        return false;
      }
      return baseFilter(token);
    };
  } else {
    filter = ctx.isNotComment;
  }
  return {
    filter,
    skip: options?.skip ?? 0,
  };
}

/**
 * Normalizes the options for cursor methods with count.
 */
function normalizeCountOptions<
  Token extends SyntaxElement,
  Comment extends SyntaxElement,
>(
  options:
    | CursorWithCountOptionsWithoutFilter
    | CursorWithCountOptionsWithFilter<Token, Token>
    | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>
    | undefined,
  ctx: TokenContext<Token, Comment>,
): {
  filter: TokenFilter<Token | Comment>;
  count: number;
} {
  if (typeof options === "number") {
    return { filter: ctx.isNotComment, count: options };
  }
  if (typeof options === "function") {
    return {
      filter: (n) => {
        if (ctx.isComment(n)) {
          return false;
        }
        return options(n);
      },
      count: 0,
    };
  }
  let filter: TokenFilter<Token | Comment>;
  if (options?.includeComments) {
    filter = options?.filter ?? (() => true);
  } else if (options?.filter) {
    const baseFilter = options?.filter;
    filter = (token) => {
      if (ctx.isComment(token)) {
        return false;
      }
      return baseFilter(token);
    };
  } else {
    filter = ctx.isNotComment;
  }
  return {
    filter,
    count: options?.count ?? 0,
  };
}

const PRIVATE = Symbol("private");

export class TokenStore<
  Node extends SyntaxElement,
  Token extends SyntaxElement,
  Comment extends SyntaxElement,
> {
  private readonly [PRIVATE]: {
    /**
     * Combined and sorted list of tokens and comments
     */
    allTokens: (Token | Comment)[];
    /**
     * Map from token start location to index in allTokens
     */
    tokenStartToIndex: Map<number, number>;
    ctx: TokenContext<Token, Comment>;
    cacheAllComments: Comment[] | null;
  };

  public constructor(params: {
    tokens: (Token | Comment)[];
    isComment: (token: Token | Comment) => token is Comment;
  }) {
    // Sort tokens by range start
    const allTokens = [...params.tokens].sort(
      (a, b) => a.range[0] - b.range[0],
    );

    // Create index map for fast lookup (exclude zero-width tokens)
    const tokenStartToIndex = new Map<number, number>();
    for (let i = 0; i < allTokens.length; i++) {
      const token = allTokens[i];
      if (token.range[0] < token.range[1]) {
        tokenStartToIndex.set(token.range[0], i);
      }
    }
    const ctx: TokenContext<Token, Comment> = {
      isComment: params.isComment,
      isNotComment: (token): token is Token => !params.isComment(token),
    };

    this[PRIVATE] = {
      allTokens,
      tokenStartToIndex,
      ctx,
      cacheAllComments: null,
    };
  }

  /**
   * Gets all tokens, including comments.
   */
  public getAllTokens(): (Token | Comment)[] {
    return this[PRIVATE].allTokens;
  }

  /**
   * Gets all comments.
   */
  public getAllComments(): Comment[] {
    const { ctx, allTokens, cacheAllComments } = this[PRIVATE];
    if (cacheAllComments) {
      return cacheAllComments;
    }
    const result: Comment[] = [];
    for (const token of allTokens) {
      if (ctx.isComment(token)) {
        result.push(token);
      }
    }
    this[PRIVATE].cacheAllComments = result;
    return result;
  }

  /**
   * Gets the first token of the given node.
   */
  public getFirstToken(node: Node | Token): Token;

  /**
   * Gets the first token of the given node with simple options.
   */
  public getFirstToken(
    node: Node | Token | Comment,
    options?: CursorWithSkipOptionsWithoutFilter,
  ): Token | null;

  /**
   * Gets the first token of the given node with options.
   */
  public getFirstToken<R extends Token>(
    node: Node | Token | Comment,
    options: CursorWithSkipOptionsWithFilter<Token, R>,
  ): R | null;

  /**
   * Gets the first token of the given node with options.
   */
  public getFirstToken<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the first token of the given node with complex options.
   */
  public getFirstToken<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, R & Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  public getFirstToken(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, Token | Comment>,
  ): Token | Comment | null {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, skip } = normalizeSkipOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      node.range[0],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, node.range[1]);

    let skipped = 0;
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      if (skipped < skip) {
        skipped++;
        continue;
      }
      return token;
    }
    return null;
  }

  /**
   * Gets the first tokens of the given node.
   */
  public getFirstTokens(
    node: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Gets the first tokens of the given node.
   */
  public getFirstTokens<R extends Token>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Gets the first tokens of the given node with comment options.
   */
  public getFirstTokens<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets the first tokens of the given node with complex options.
   */
  public getFirstTokens<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  public getFirstTokens(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      node.range[0],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, node.range[1]);

    const result: (Token | Comment)[] = [];
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.push(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets the last token of the given node.
   */
  public getLastToken(node: Node | Token): Token;

  /**
   * Gets the last token of the given node with options.
   */
  public getLastToken(
    node: Node | Token | Comment,
    options?: CursorWithSkipOptionsWithoutFilter,
  ): Token | null;

  /**
   * Gets the last token of the given node with options.
   */
  public getLastToken<R extends Token>(
    node: Node | Token | Comment,
    options: CursorWithSkipOptionsWithFilter<Token, R>,
  ): R | null;

  /**
   * Gets the last token of the given node with options.
   */
  public getLastToken<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the last token of the given node with complex options.
   */
  public getLastToken<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, R & Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  public getLastToken(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, Token | Comment>,
  ): Token | Comment | null {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, skip } = normalizeSkipOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      node.range[0],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, node.range[1]);

    let skipped = 0;
    for (let i = endIndex; i >= startIndex && i >= 0; i--) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      if (skipped < skip) {
        skipped++;
        continue;
      }
      return token;
    }
    return null;
  }

  /**
   * Get the last tokens of the given node.
   */
  public getLastTokens(
    node: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Get the last tokens of the given node.
   */
  public getLastTokens<R extends Token>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Get the last tokens of the given node with comment options.
   */
  public getLastTokens<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Get the last tokens of the given node with complex options.
   */
  public getLastTokens<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  public getLastTokens(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      node.range[0],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, node.range[1]);

    const result: (Token | Comment)[] = [];
    for (let i = endIndex; i >= startIndex && i >= 0; i--) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.unshift(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets the token that follows a given node or token.
   */
  public getTokenAfter(
    node: Node | Token | Comment,
    options?: CursorWithSkipOptionsWithoutFilter,
  ): Token | null;

  /**
   * Gets the token that follows a given node or token.
   */
  public getTokenAfter<R extends Token>(
    node: Node | Token | Comment,
    options?: CursorWithSkipOptionsWithFilter<Token, R>,
  ): R | null;

  /**
   * Gets the token that follows a given node or token with comment options.
   */
  public getTokenAfter<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the token that follows a given node or token with complex options.
   */
  public getTokenAfter<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, R & Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the token that follows a given node or token.
   */
  public getTokenAfter(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, Token | Comment>,
  ): Token | Comment | null {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, skip } = normalizeSkipOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      node.range[1],
    );

    let skipped = 0;
    for (let i = startIndex; i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      if (skipped < skip) {
        skipped++;
        continue;
      }
      return token;
    }
    return null;
  }

  /**
   * Gets the `count` tokens that follows a given node or token.
   */
  public getTokensAfter(
    node: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Gets the `count` tokens that follows a given node or token.
   */
  public getTokensAfter<R extends Token>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Gets the `count` tokens that follows a given node or token with comment options.
   */
  public getTokensAfter<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets the `count` tokens that follows a given node or token with complex options.
   */
  public getTokensAfter<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  public getTokensAfter(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      node.range[1],
    );

    const result: (Token | Comment)[] = [];
    for (let i = startIndex; i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.push(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets the token that precedes a given node or token.
   */
  public getTokenBefore(
    node: Node | Token | Comment,
    options?: CursorWithSkipOptionsWithoutFilter,
  ): Token | null;

  /**
   * Gets the token that precedes a given node or token.
   */
  public getTokenBefore<R extends Token>(
    node: Node | Token | Comment,
    options: CursorWithSkipOptionsWithFilter<Token, R>,
  ): R | null;

  /**
   * Gets the token that precedes a given node or token with comment options.
   */
  public getTokenBefore<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the token that precedes a given node or token with complex options.
   */
  public getTokenBefore<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, R & Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the token that precedes a given node or token.
   */
  public getTokenBefore(
    node: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, Token | Comment>,
  ): Token | Comment | null {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, skip } = normalizeSkipOptions(options, ctx);
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, node.range[0]);

    let skipped = 0;
    for (let i = endIndex; i >= 0; i--) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      if (skipped < skip) {
        skipped++;
        continue;
      }
      return token;
    }
    return null;
  }

  /**
   * Gets the `count` tokens that precedes a given node or token.
   */
  public getTokensBefore(
    node: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Gets the `count` tokens that precedes a given node or token.
   */
  public getTokensBefore<R extends Token>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Gets the `count` tokens that precedes a given node or token with comment options.
   */
  public getTokensBefore<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets the `count` tokens that precedes a given node or token with complex options.
   */
  public getTokensBefore<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets the `count` tokens that precedes a given node or token.
   */
  public getTokensBefore(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(options, ctx);
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, node.range[0]);

    const result: (Token | Comment)[] = [];
    for (let i = endIndex; i >= 0; i--) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.unshift(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets the first token between two non-overlapping nodes.
   */
  public getFirstTokenBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?: CursorWithSkipOptionsWithoutFilter,
  ): Token | null;

  /**
   * Gets the first token between two non-overlapping nodes.
   */
  public getFirstTokenBetween<R extends Token>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithSkipOptionsWithFilter<Token, R>,
  ): R | null;

  /**
   * Gets the first token between two non-overlapping nodes with comment options.
   */
  public getFirstTokenBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the first token between two non-overlapping nodes with complex options.
   */
  public getFirstTokenBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, R & Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  public getFirstTokenBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, Token | Comment>,
  ): Token | Comment | null {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, skip } = normalizeSkipOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      left.range[1],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, right.range[0]);

    let skipped = 0;
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      if (skipped < skip) {
        skipped++;
        continue;
      }
      return token;
    }
    return null;
  }

  /**
   * Gets the first tokens between two non-overlapping nodes.
   */
  public getFirstTokensBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Gets the first tokens between two non-overlapping nodes.
   */
  public getFirstTokensBetween<R extends Token>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Gets the first tokens between two non-overlapping nodes with comment options.
   */
  public getFirstTokensBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets the first tokens between two non-overlapping nodes with complex options.
   */
  public getFirstTokensBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  public getFirstTokensBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      left.range[1],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, right.range[0]);

    const result: (Token | Comment)[] = [];
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.push(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets the last token between two non-overlapping nodes.
   */
  public getLastTokenBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?: CursorWithSkipOptionsWithoutFilter,
  ): Token | null;

  /**
   * Gets the last token between two non-overlapping nodes.
   */
  public getLastTokenBetween<R extends Token>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithSkipOptionsWithFilter<Token, R>,
  ): R | null;

  /**
   * Gets the last token between two non-overlapping nodes with comment options.
   */
  public getLastTokenBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  /**
   * Gets the last token between two non-overlapping nodes with complex options.
   */
  public getLastTokenBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, R & Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, R>,
  ): R | null;

  public getLastTokenBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithSkipOptionsWithoutFilter
      | CursorWithSkipOptionsWithFilter<Token, Token>
      | CursorWithSkipOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment) | null {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, skip } = normalizeSkipOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      left.range[1],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, right.range[0]);

    let skipped = 0;
    for (let i = endIndex; i >= startIndex; i--) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      if (skipped < skip) {
        skipped++;
        continue;
      }
      return token;
    }
    return null;
  }

  /**
   * Gets the last tokens between two non-overlapping nodes.
   */
  public getLastTokensBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Gets the last tokens between two non-overlapping nodes.
   */
  public getLastTokensBetween<R extends Token>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Gets the last tokens between two non-overlapping nodes with comment options.
   */
  public getLastTokensBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets the last tokens between two non-overlapping nodes with complex options.
   */
  public getLastTokensBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  public getLastTokensBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      left.range[1],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, right.range[0]);

    const result: (Token | Comment)[] = [];
    for (let i = endIndex; i >= startIndex; i--) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.unshift(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets all tokens that are related to the given node.
   */
  public getTokens(
    node: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Gets all tokens that are related to the given node.
   */
  public getTokens<R extends Token>(
    node: Node | Token | Comment,
    options?: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Gets all tokens that are related to the given node with comment options.
   */
  public getTokens<R extends Token | Comment>(
    node: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets all tokens that are related to the given node with complex options.
   */
  public getTokens<R extends Token | Comment>(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets all tokens that are related to the given node.
   */
  public getTokens(
    node: Node | Token | Comment,
    options?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(options, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      node.range[0],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, node.range[1]);

    const result: (Token | Comment)[] = [];
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.push(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets all of the tokens between two non-overlapping nodes.
   */
  public getTokensBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?: CursorWithCountOptionsWithoutFilter,
  ): Token[];

  /**
   * Gets all of the tokens between two non-overlapping nodes.
   */
  public getTokensBetween<R extends Token>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options?: CursorWithCountOptionsWithFilter<Token, R>,
  ): R[];

  /**
   * Gets all of the tokens between two non-overlapping nodes with comment options.
   */
  public getTokensBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    options: CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets all of the tokens between two non-overlapping nodes with complex options.
   */
  public getTokensBetween<R extends Token | Comment>(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    paddingOrOptions?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, R & Token>
      | CursorWithCountOptionsWithComment<Token, Comment, R>,
  ): R[];

  /**
   * Gets all of the tokens between two non-overlapping nodes.
   */
  public getTokensBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
    paddingOrOptions?:
      | CursorWithCountOptionsWithoutFilter
      | CursorWithCountOptionsWithFilter<Token, Token>
      | CursorWithCountOptionsWithComment<Token, Comment, Token | Comment>,
  ): (Token | Comment)[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const { filter, count } = normalizeCountOptions(paddingOrOptions, ctx);
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      left.range[1],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, right.range[0]);

    const result: (Token | Comment)[] = [];
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (filter && !filter(token)) {
        continue;
      }
      result.push(token);
      if (count > 0 && result.length >= count) {
        break;
      }
    }
    return result;
  }

  /**
   * Gets all comment tokens inside the given node or token.
   */
  public getCommentsInside(nodeOrToken: Node | Token | Comment): Comment[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      nodeOrToken.range[0],
    );
    const endIndex = getLastIndex(
      allTokens,
      tokenStartToIndex,
      nodeOrToken.range[1],
    );

    const result: Comment[] = [];
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (ctx.isComment(token)) {
        result.push(token);
      }
    }
    return result;
  }

  /**
   * Gets all comment tokens directly before the given node or token.
   */
  public getCommentsBefore(nodeOrToken: Node | Token | Comment): Comment[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const endIndex = getLastIndex(
      allTokens,
      tokenStartToIndex,
      nodeOrToken.range[0],
    );

    const result: Comment[] = [];
    for (let i = endIndex; i >= 0; i--) {
      const token = allTokens[i];
      if (ctx.isComment(token)) {
        result.unshift(token);
      } else {
        // Stop at the first non-comment token
        break;
      }
    }
    return result;
  }

  /**
   * Gets all comment tokens directly after the given node or token.
   */
  public getCommentsAfter(nodeOrToken: Node | Token | Comment): Comment[] {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      nodeOrToken.range[1],
    );

    const result: Comment[] = [];
    for (let i = startIndex; i < allTokens.length; i++) {
      const token = allTokens[i];
      if (ctx.isComment(token)) {
        result.push(token);
      } else {
        // Stop at the first non-comment token
        break;
      }
    }
    return result;
  }

  /**
   * Checks if there are any comment tokens between two non-overlapping nodes.
   */
  public commentsExistBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
  ): boolean {
    const { ctx, allTokens, tokenStartToIndex } = this[PRIVATE];
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      left.range[1],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, right.range[0]);

    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (ctx.isComment(token)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if there is whitespace between two non-overlapping nodes.
   */
  public isSpaceBetween(
    left: Node | Token | Comment,
    right: Node | Token | Comment,
  ): boolean {
    if (left.range[1] >= right.range[0]) {
      return false;
    }
    const { allTokens, tokenStartToIndex } = this[PRIVATE];
    const startIndex = getFirstIndex(
      allTokens,
      tokenStartToIndex,
      left.range[1],
    );
    const endIndex = getLastIndex(allTokens, tokenStartToIndex, right.range[0]);

    let prev: Node | Token | Comment = left;
    for (let i = startIndex; i <= endIndex && i < allTokens.length; i++) {
      const token = allTokens[i];
      if (prev.range[1] < token.range[0]) {
        return true;
      }
      prev = token;
    }
    return prev.range[1] < right.range[0];
  }
}
