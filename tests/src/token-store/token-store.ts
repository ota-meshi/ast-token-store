import assert from "node:assert";
import { parseTOML } from "toml-eslint-parser";
import type { AST } from "toml-eslint-parser";
import { TokenStore } from "../../../src/index.ts";

function parse(code: string): AST.TOMLProgram {
  return parseTOML(code);
}

class TOMLTokenStore extends TokenStore<AST.TOMLNode, AST.Token, AST.Comment> {
  public constructor(options: { ast: AST.TOMLProgram }) {
    super({
      tokens: [...options.ast.tokens, ...options.ast.comments],
      isComment: (token): token is AST.Comment => token.type === "Block",
    });
  }
}

describe("TokenStore", () => {
  describe("getAllTokens", () => {
    it("should return sorted tokens including comments", () => {
      const ast = parse(`key1 = "value1" # comment\nkey2 = "value2"`);
      const store = new TOMLTokenStore({ ast });

      const tokens = store.getAllTokens();

      assert.ok(tokens.length > 0);
      for (let i = 1; i < tokens.length; i++) {
        assert.ok(tokens[i - 1].range[0] <= tokens[i].range[0]);
      }
      assert.ok(tokens.some((t) => t.type === "Block"));
    });
  });

  describe("getAllComments", () => {
    it("should return all comment tokens", () => {
      const ast = parse(
        `key1 = "value1" # comment1\nkey2 = "value2" # comment2`,
      );
      const store = new TOMLTokenStore({ ast });

      const comments = store.getAllComments();

      assert.ok(comments.length === 2);
      assert.strictEqual(comments[0].type, "Block");
      assert.strictEqual(comments[1].type, "Block");
      for (let i = 0; i < comments.length; i++) {
        assert.ok(comments[i].range[0] <= comments[i].range[1]);
      }
    });

    it("should return empty array when there are no comments", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });

      const comments = store.getAllComments();

      assert.deepStrictEqual(comments, []);
    });

    it("should preserve comment order", () => {
      const ast = parse(`# first\nkey = "value" # second\n# third`);
      const store = new TOMLTokenStore({ ast });

      const comments = store.getAllComments();

      assert.ok(comments.length >= 2);
      for (let i = 1; i < comments.length; i++) {
        assert.ok(comments[i - 1].range[0] <= comments[i].range[0]);
      }
    });
  });

  describe("getFirstToken", () => {
    it("should return the first token of a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getFirstToken(keyValue);

      assert.ok(token);
      assert.strictEqual(token.type, "Bare");
      assert.strictEqual(token.value, "key");
    });

    it("should return the first token with skip option", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getFirstToken(keyValue, { skip: 1 });

      assert.ok(token);
      assert.strictEqual(token.type, "Punctuator");
      assert.strictEqual(token.value, "=");
    });

    it("should return null when skip exceeds available tokens", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getFirstToken(keyValue, { skip: 10 });

      assert.strictEqual(token, null);
    });

    it("should include comments when option is set", () => {
      const ast = parse(`# comment
key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getFirstToken(keyValue, { includeComments: true });

      assert.ok(token);
      assert.strictEqual(token.type, "Bare");
      assert.strictEqual(token.value, "key");
    });

    it("should exclude comments by default", () => {
      const ast = parse(`arr = [1, # comment
2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      // Get all tokens including comments
      const tokens = store.getTokens(arr, { includeComments: true });
      const hasComment = tokens.some((t) => t.type === "Block");
      assert.ok(
        hasComment,
        "Test setup: there should be a comment in the node",
      );

      // getFirstToken should skip comments by default
      const firstToken = store.getFirstToken(arr);
      assert.ok(firstToken);
      assert.notStrictEqual(firstToken.type, "Block");
      assert.strictEqual(firstToken.value, "[");
    });

    it("should filter tokens with filter option", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getFirstToken(keyValue, {
        filter: (t): t is AST.Token & { type: "BasicString" } =>
          t.type === "BasicString",
      });

      assert.ok(token);
      assert.strictEqual(token.type, "BasicString");
    });
  });

  describe("getLastToken", () => {
    it("should return the last token of a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getLastToken(keyValue);

      assert.ok(token);
      assert.strictEqual(token.type, "BasicString");
    });

    it("should return the last token with skip option", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getLastToken(keyValue, { skip: 1 });

      assert.ok(token);
      assert.strictEqual(token.type, "Punctuator");
      assert.strictEqual(token.value, "=");
    });

    it("should exclude comments by default", () => {
      const ast = parse(`arr = [1 # comment
]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      // Get all tokens including comments
      const tokens = store.getTokens(arr, { includeComments: true });
      const hasComment = tokens.some((t) => t.type === "Block");
      assert.ok(
        hasComment,
        "Test setup: there should be a comment in the node",
      );

      // getLastToken should skip comments by default
      const lastToken = store.getLastToken(arr);
      assert.ok(lastToken);
      assert.notStrictEqual(lastToken.type, "Block");
      assert.strictEqual(lastToken.value, "]");
    });

    it("should include comments when option is set", () => {
      const ast = parse(`arr = [1 # comment
]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      // The comment is between "1" and "]" so lastToken with includeComments
      // should still be "]" since comment is not the last
      // Instead, let's test that we can retrieve the comment with skip
      const lastTokenWithComments = store.getLastToken(arr, {
        includeComments: true,
        skip: 1,
      });

      assert.ok(lastTokenWithComments);
      assert.strictEqual(lastTokenWithComments.type, "Block");
    });
  });

  describe("getTokenBefore", () => {
    it("should return the token before a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const value = keyValue.value;

      const token = store.getTokenBefore(value);

      assert.ok(token);
      assert.strictEqual(token.type, "Punctuator");
      assert.strictEqual(token.value, "=");
    });

    it("should return null when there is no token before", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;

      const token = store.getTokenBefore(key);

      assert.strictEqual(token, null);
    });

    it("should include comments when option is set", () => {
      const ast = parse(`# comment
key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;

      const token = store.getTokenBefore(key, { includeComments: true });

      // TOML only has line comments, which are stored as "Block" type in the AST
      assert.ok(token);
      assert.strictEqual(token.type, "Block");
    });

    it("should exclude comments by default", () => {
      const ast = parse(`key1 = "value1" # comment
key2 = "value2"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue2 = ast.body[0].body[1];
      assert.strictEqual(keyValue2.type, "TOMLKeyValue");
      const key2 = keyValue2.key;

      // getTokenBefore should skip comments by default
      const token = store.getTokenBefore(key2);
      assert.ok(token);
      assert.notStrictEqual(token.type, "Block");
      assert.strictEqual(token.type, "BasicString");
    });
  });

  describe("getTokenAfter", () => {
    it("should return the token after a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;

      const token = store.getTokenAfter(key);

      assert.ok(token);
      assert.strictEqual(token.type, "Punctuator");
      assert.strictEqual(token.value, "=");
    });

    it("should return null when there is no token after", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getTokenAfter(keyValue);

      assert.strictEqual(token, null);
    });

    it("should include comments when option is set", () => {
      const ast = parse(`key = "value" # comment`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getTokenAfter(keyValue, { includeComments: true });

      // TOML only has line comments, which are stored as "Block" type in the AST
      assert.ok(token);
      assert.strictEqual(token.type, "Block");
    });

    it("should exclude comments by default", () => {
      const ast = parse(`key1 = "value1" # comment
key2 = "value2"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue1 = ast.body[0].body[0];
      assert.strictEqual(keyValue1.type, "TOMLKeyValue");

      // getTokenAfter should skip comments by default
      const token = store.getTokenAfter(keyValue1);
      assert.ok(token);
      assert.notStrictEqual(token.type, "Block");
      assert.strictEqual(token.type, "Bare");
      assert.strictEqual(token.value, "key2");
    });
  });

  describe("getTokensBefore", () => {
    it("should return tokens before a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const value = keyValue.value;

      const tokens = store.getTokensBefore(value, { count: 2 });

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].value, "key");
      assert.strictEqual(tokens[1].value, "=");
    });

    it("should return all tokens before when count is 0", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const value = keyValue.value;

      const tokens = store.getTokensBefore(value, undefined);

      assert.strictEqual(tokens.length, 2);
    });
  });

  describe("getTokens", () => {
    it("should return all tokens within a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const tokens = store.getTokens(keyValue);

      assert.strictEqual(tokens.length, 3);
      assert.strictEqual(tokens[0].value, "key");
      assert.strictEqual(tokens[1].value, "=");
      assert.strictEqual(tokens[2].type, "BasicString");
    });

    it("should limit tokens with count option", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const tokens = store.getTokens(keyValue, { count: 2 });

      assert.strictEqual(tokens.length, 2);
    });

    it("should filter tokens with filter option", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const tokens = store.getTokens(keyValue, {
        filter: (t) => t.type === "Punctuator",
      });

      assert.strictEqual(tokens.length, 1);
      assert.strictEqual(tokens[0].value, "=");
    });
  });

  describe("getFirstTokens", () => {
    it("should return first tokens from a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const tokens = store.getFirstTokens(keyValue, { count: 2 });

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].value, "key");
      assert.strictEqual(tokens[1].value, "=");
    });

    it("should include comments when option is set", () => {
      const ast = parse(`arr = [1, # comment\n2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const tokens = store.getFirstTokens(arr, {
        includeComments: true,
        count: 3,
      });

      assert.strictEqual(tokens.length, 3);
      assert.strictEqual(tokens[0].value, "[");
      assert.strictEqual(tokens[1].value, "1");
      assert.strictEqual(tokens[2].value, ",");
    });
  });

  describe("getLastTokens", () => {
    it("should return last tokens from a node", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const tokens = store.getLastTokens(keyValue, { count: 2 });

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].value, "=");
      assert.strictEqual(tokens[1].type, "BasicString");
    });

    it("should include comments when option is set", () => {
      const ast = parse(`arr = [1 # comment\n]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const tokens = store.getLastTokens(arr, {
        includeComments: true,
        count: 2,
      });

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].type, "Block");
      assert.strictEqual(tokens[1].value, "]");
    });
  });

  describe("getTokensBetween", () => {
    it("should return tokens between two nodes", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;
      const value = keyValue.value;

      const tokens = store.getTokensBetween(key, value);

      assert.strictEqual(tokens.length, 1);
      assert.strictEqual(tokens[0].value, "=");
    });

    it("should return empty array when no tokens between", () => {
      const ast = parse(`[table]`);
      const store = new TOMLTokenStore({ ast });
      const table = ast.body[0];
      const leftBracket = store.getFirstToken(table);
      const rightBracket = store.getLastToken(table);

      // Since they are tokens (not nodes), getTokensBetween should return tokens between
      if (leftBracket && rightBracket) {
        const tokens = store.getTokensBetween(leftBracket, rightBracket);
        // Between "[" and "]" there is "table"
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].value, "table");
      }
    });

    it("should limit tokens between nodes with count option", () => {
      const ast = parse(`arr = [1, # comment\n2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const tokens = store.getTokensBetween(arr.elements[0], arr.elements[2], {
        count: 2,
      });

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].value, ",");
      assert.strictEqual(tokens[1].value, "2");
    });

    it("should filter out comments between nodes", () => {
      const ast = parse(`arr = [1, # comment\n2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const tokens = store.getTokensBetween(arr.elements[0], arr.elements[1], {
        includeComments: true,
        filter: (t): t is AST.Token =>
          t.type !== "Block" && t.type === "Punctuator",
      });

      assert.strictEqual(tokens.length, 1);
      assert.strictEqual(tokens[0].value, ",");
    });
  });

  describe("getFirstTokenBetween", () => {
    it("should return the first token between two nodes", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;
      const value = keyValue.value;

      const token = store.getFirstTokenBetween(key, value);

      assert.ok(token);
      assert.strictEqual(token.value, "=");
    });

    it("should return null when no tokens between", () => {
      const ast = parse(`a=1`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;
      const eq = store.getTokenAfter(key);

      if (eq) {
        const token = store.getFirstTokenBetween(key, eq);
        assert.strictEqual(token, null);
      }
    });

    it("should exclude comments by default", () => {
      const ast = parse(`arr = [1, # comment
2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");
      const firstElement = arr.elements[0];
      const secondElement = arr.elements[1];

      // getFirstTokenBetween should skip comments by default
      const token = store.getFirstTokenBetween(firstElement, secondElement);
      assert.ok(token);
      assert.notStrictEqual(token.type, "Block");
      assert.strictEqual(token.type, "Punctuator");
      assert.strictEqual(token.value, ",");
    });

    it("should include comments when option is set", () => {
      const ast = parse(`arr = [1, # comment
2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");
      const firstElement = arr.elements[0];
      const secondElement = arr.elements[1];

      // with includeComments, it should return the "," first
      const token = store.getFirstTokenBetween(firstElement, secondElement, {
        includeComments: true,
      });
      assert.ok(token);
      assert.strictEqual(token.type, "Punctuator");
      assert.strictEqual(token.value, ",");

      // skip 1 should get the comment
      const commentToken = store.getFirstTokenBetween(
        firstElement,
        secondElement,
        {
          includeComments: true,
          skip: 1,
        },
      );
      assert.ok(commentToken);
      assert.strictEqual(commentToken.type, "Block");
    });
  });

  describe("getTokenAfter/getTokensAfter", () => {
    it("should support skip for getTokenAfter", () => {
      const ast = parse(`key1 = "value1" # comment\nkey2 = "value2"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue1 = ast.body[0].body[0];
      assert.strictEqual(keyValue1.type, "TOMLKeyValue");

      const token = store.getTokenAfter(keyValue1, {
        includeComments: true,
        skip: 1,
      });

      assert.ok(token);
      assert.strictEqual(token.type, "Bare");
      assert.strictEqual(token.value, "key2");
    });

    it("should return tokens after a node", () => {
      const ast = parse(`key1 = "value1" # comment\nkey2 = "value2"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue1 = ast.body[0].body[0];
      assert.strictEqual(keyValue1.type, "TOMLKeyValue");

      const tokens = store.getTokensAfter(keyValue1, { count: 2 });

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].type, "Bare");
      assert.strictEqual(tokens[0].value, "key2");
      assert.strictEqual(tokens[1].value, "=");
    });
  });

  describe("getFirstTokensBetween", () => {
    it("should return first tokens between two nodes", () => {
      const ast = parse(`arr = [1, # comment\n2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const tokens = store.getFirstTokensBetween(
        arr.elements[0],
        arr.elements[2],
        {
          count: 2,
        },
      );

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].value, ",");
      assert.strictEqual(tokens[1].value, "2");
    });

    it("should include comments when option is set", () => {
      const ast = parse(`arr = [1, # comment\n2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const tokens = store.getFirstTokensBetween(
        arr.elements[0],
        arr.elements[1],
        {
          includeComments: true,
        },
      );

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].value, ",");
      assert.strictEqual(tokens[1].type, "Block");
    });
  });

  describe("getLastTokenBetween/getLastTokensBetween", () => {
    it("should return last token between two nodes", () => {
      const ast = parse(`arr = [1, # comment\n2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const token = store.getLastTokenBetween(arr.elements[0], arr.elements[1]);
      assert.ok(token);
      assert.strictEqual(token.value, ",");
    });

    it("should return last tokens between two nodes", () => {
      const ast = parse(`arr = [1, # comment\n2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const tokens = store.getLastTokensBetween(
        arr.elements[0],
        arr.elements[2],
        {
          count: 2,
        },
      );

      assert.strictEqual(tokens.length, 2);
      assert.strictEqual(tokens[0].value, "2");
      assert.strictEqual(tokens[1].value, ",");
    });

    it("should return null when there are no tokens between", () => {
      const ast = parse(`a=1`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;
      const eq = store.getTokenAfter(key);

      if (eq) {
        const token = store.getLastTokenBetween(key, eq);
        assert.strictEqual(token, null);
      }
    });

    it("should filter out comments in last tokens between nodes", () => {
      const ast = parse(`arr = [1, # comment\n2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const tokens = store.getLastTokensBetween(
        arr.elements[0],
        arr.elements[1],
        {
          includeComments: true,
          filter: (t): t is AST.Token =>
            t.type !== "Block" && t.type === "Punctuator",
        },
      );

      assert.strictEqual(tokens.length, 1);
      assert.strictEqual(tokens[0].value, ",");
    });
  });

  describe("getCommentsBefore", () => {
    it("should return comments directly before a node", () => {
      const ast = parse(`# comment
key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;

      const comments = store.getCommentsBefore(key);

      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].value, " comment");
    });

    it("should return multiple consecutive comments", () => {
      const ast = parse(`# comment1
# comment2
key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;

      const comments = store.getCommentsBefore(key);

      assert.strictEqual(comments.length, 2);
      assert.strictEqual(comments[0].value, " comment1");
      assert.strictEqual(comments[1].value, " comment2");
    });

    it("should return empty array when no comments before", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const comments = store.getCommentsBefore(keyValue);

      assert.strictEqual(comments.length, 0);
    });

    it("should stop at non-comment token", () => {
      const ast = parse(`key1 = "value1"
# comment
key2 = "value2"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue2 = ast.body[0].body[1];
      assert.strictEqual(keyValue2.type, "TOMLKeyValue");
      const key2 = keyValue2.key;

      const comments = store.getCommentsBefore(key2);

      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].value, " comment");
    });
  });

  describe("getCommentsAfter", () => {
    it("should return comments directly after a node", () => {
      const ast = parse(`key = "value" # comment`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const comments = store.getCommentsAfter(keyValue);

      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].value, " comment");
    });

    it("should return empty array when no comments after", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const comments = store.getCommentsAfter(keyValue);

      assert.strictEqual(comments.length, 0);
    });

    it("should stop at non-comment token", () => {
      const ast = parse(`key1 = "value1" # comment
key2 = "value2"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue1 = ast.body[0].body[0];
      assert.strictEqual(keyValue1.type, "TOMLKeyValue");

      const comments = store.getCommentsAfter(keyValue1);

      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].value, " comment");
    });
  });

  describe("getCommentsInside", () => {
    it("should return comments inside a node", () => {
      const ast = parse(`arr = [1, # comment\n2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const comments = store.getCommentsInside(arr);

      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].value, " comment");
    });

    it("should return empty array when no comments inside", () => {
      const ast = parse(`arr = [1, 2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const comments = store.getCommentsInside(arr);

      assert.strictEqual(comments.length, 0);
    });

    it("should not include comments before the node", () => {
      const ast = parse(`# comment\nkey = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const comments = store.getCommentsInside(keyValue);

      assert.strictEqual(comments.length, 0);
    });
  });

  describe("commentsExistBetween", () => {
    it("should return true when comment exists between nodes", () => {
      const ast = parse(`arr = [1, # comment\n2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const exists = store.commentsExistBetween(
        arr.elements[0],
        arr.elements[1],
      );
      assert.strictEqual(exists, true);
    });

    it("should return false when no comment exists between nodes", () => {
      const ast = parse(`arr = [1, 2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const exists = store.commentsExistBetween(
        arr.elements[0],
        arr.elements[1],
      );
      assert.strictEqual(exists, false);
    });
  });

  describe("isSpaceBetween", () => {
    it("should return true when there is whitespace between tokens", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const keyToken = store.getFirstToken(keyValue);
      const eqToken = keyToken ? store.getTokenAfter(keyToken) : null;

      assert.ok(keyToken);
      assert.ok(eqToken);
      assert.strictEqual(store.isSpaceBetween(keyToken, eqToken), true);
    });

    it("should return false when there is no whitespace between tokens", () => {
      const ast = parse(`key="value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const keyToken = store.getFirstToken(keyValue);
      const eqToken = keyToken ? store.getTokenAfter(keyToken) : null;

      assert.ok(keyToken);
      assert.ok(eqToken);
      assert.strictEqual(store.isSpaceBetween(keyToken, eqToken), false);
    });

    it("should return true when a comment exists between tokens", () => {
      const ast = parse(`key = "value" # comment\nnext = 1`);
      const store = new TOMLTokenStore({ ast });
      const keyValue1 = ast.body[0].body[0];
      const keyValue2 = ast.body[0].body[1];
      assert.strictEqual(keyValue1.type, "TOMLKeyValue");
      assert.strictEqual(keyValue2.type, "TOMLKeyValue");

      const leftToken = store.getLastToken(keyValue1);
      const rightToken = store.getFirstToken(keyValue2);

      assert.ok(leftToken);
      assert.ok(rightToken);
      assert.strictEqual(store.isSpaceBetween(leftToken, rightToken), true);
    });

    it("should return true when only newlines exist between tokens", () => {
      const ast = parse(`arr = [\n1]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const leftToken = store.getFirstToken(arr);
      const rightToken = leftToken ? store.getTokenAfter(leftToken) : null;

      assert.ok(leftToken);
      assert.ok(rightToken);
      assert.strictEqual(store.isSpaceBetween(leftToken, rightToken), true);
    });

    it("should return false when nodes/tokens overlap", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      assert.strictEqual(store.isSpaceBetween(keyValue, keyValue), false);
    });

    it("should return false when left end equals right start", () => {
      const ast = parse(`a=1`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const key = keyValue.key;
      const value = keyValue.value;

      assert.strictEqual(store.isSpaceBetween(key, value), false);
    });

    it("should work with nodes instead of tokens", () => {
      const ast = parse(`arr = [1, 2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const firstElement = arr.elements[0];
      const secondElement = arr.elements[1];

      // With nodes, the comma is between them but since there's no space around comma,
      // isSpaceBetween checks gaps which exist (before comma is "1", after is ",")
      assert.strictEqual(
        store.isSpaceBetween(firstElement, secondElement),
        true,
      );
    });

    it("should return true with spaces in array", () => {
      const ast = parse(`arr = [ 1 , 2 ]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const firstElement = arr.elements[0];
      const commaToken = store.getTokenAfter(firstElement);

      assert.ok(firstElement);
      assert.ok(commaToken);
      assert.strictEqual(store.isSpaceBetween(firstElement, commaToken), true);
    });
  });

  describe("options as number", () => {
    it("should treat number option as skip for getFirstToken", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getFirstToken(keyValue, 1);

      assert.ok(token);
      assert.strictEqual(token.value, "=");
    });

    it("should treat number option as count for getTokens", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const tokens = store.getTokens(keyValue, 2);

      assert.strictEqual(tokens.length, 2);
    });
  });

  describe("options as filter function", () => {
    it("should use function as filter for getFirstToken", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");

      const token = store.getFirstToken(
        keyValue,
        (t) => t.type === "BasicString",
      );

      assert.ok(token);
      assert.strictEqual(token.type, "BasicString");
    });

    it("should use function as filter for getTokens and skip comments", () => {
      const ast = parse(`arr = [1, # comment\n2]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const tokens = store.getTokens(arr, (t) => t.type === "Punctuator");

      assert.ok(tokens.length >= 2);
      assert.ok(tokens.every((t) => (t.type as string) !== "Block"));
      assert.ok(tokens.every((t) => t.type === "Punctuator"));
    });
  });

  describe("complex TOML structures", () => {
    it("should handle array tokens", () => {
      const ast = parse(`arr = [1, 2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const tokens = store.getTokens(arr);

      assert.ok(tokens.length > 0);
      const values = tokens.map((t) => t.value);
      assert.ok(values.includes("["));
      assert.ok(values.includes("]"));
    });

    it("should handle inline table tokens", () => {
      const ast = parse(`inline = { a = 1, b = 2 }`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const inlineTable = keyValue.value;

      const tokens = store.getTokens(inlineTable);

      assert.ok(tokens.length > 0);
      const values = tokens.map((t) => t.value);
      assert.ok(values.includes("{"));
      assert.ok(values.includes("}"));
    });

    it("should handle table header tokens", () => {
      const ast = parse(`[table]
key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const table = ast.body[0];

      const firstToken = store.getFirstToken(table);
      const lastToken = store.getLastToken(table);

      assert.ok(firstToken);
      assert.strictEqual(firstToken.value, "[");
      assert.ok(lastToken);
      // Last token of table is the value's string
      assert.strictEqual(lastToken.type, "BasicString");
    });
  });

  describe("zero-width tokens", () => {
    type TestElement = {
      range: [number, number];
      type: "token" | "comment" | "node";
      value: string;
    };

    class TestTokenStore extends TokenStore<
      TestElement,
      TestElement,
      TestElement
    > {
      public constructor(tokens: TestElement[]) {
        super({
          tokens,
          isComment: (token): token is TestElement => token.type === "comment",
        });
      }
    }

    it("should ignore zero-width tokens", () => {
      const nodeA: TestElement = {
        range: [0, 1],
        type: "node",
        value: "A",
      };
      const nodeB: TestElement = {
        range: [5, 6],
        type: "node",
        value: "B",
      };
      const tokenA: TestElement = { range: [0, 1], type: "token", value: "a" };
      const tokenB: TestElement = { range: [2, 3], type: "token", value: "b" };
      const zeroWidth: TestElement = {
        range: [5, 5],
        type: "token",
        value: "zero-width",
      };
      const tokenC: TestElement = { range: [5, 6], type: "token", value: "c" };

      const store = new TestTokenStore([tokenA, zeroWidth, tokenB, tokenC]);

      assert.deepStrictEqual(
        store.getAllTokens().map((token) => token.value),
        ["a", "b", "zero-width", "c"],
      );
      assert.deepStrictEqual(
        store
          .getTokens(nodeA, { includeComments: true })
          .map((token) => token.value),
        ["a"],
      );
      assert.deepStrictEqual(
        store
          .getTokens(nodeB, { includeComments: true })
          .map((token) => token.value),
        ["c"],
      );
      assert.deepStrictEqual(
        store.getFirstToken(nodeB, { includeComments: true })?.value,
        "c",
      );
      assert.deepStrictEqual(
        store
          .getTokensBetween(nodeA, nodeB, { includeComments: true })
          .map((token) => token.value),
        ["b"],
      );
    });
  });

  describe("edge cases and complex scenarios", () => {
    it("should handle multiple consecutive spaces and comments", () => {
      const ast = parse(`key1 = "value1"
# comment1
# comment2
key2 = "value2"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue2 = ast.body[0].body[1];

      const comments = store.getCommentsBefore(keyValue2);
      assert.strictEqual(comments.length, 2);
    });

    it("should handle token skipping with filter", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];

      const tokens = store.getFirstTokens(keyValue, {
        filter: (t) => t.type !== "Punctuator",
        count: 2,
      });

      assert.strictEqual(tokens.length, 2);
      assert.ok(tokens.every((t) => (t.type as string) !== "Punctuator"));
    });

    it("should return correct token count with filter", () => {
      const ast = parse(`arr = [1, 2, 3, 4, 5]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const numbers = store.getTokens(arr, {
        filter: (t) => /\d/.test(t.value),
      });

      assert.strictEqual(numbers.length, 5);
    });

    it("should handle getLastToken with skip", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];

      const lastToken = store.getLastToken(keyValue);
      const secondLastToken = store.getLastToken(keyValue, { skip: 1 });

      assert.ok(lastToken);
      assert.ok(secondLastToken);
      assert.notStrictEqual(lastToken.value, secondLastToken.value);
    });

    it("should handle getTokensBefore with count", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const value = keyValue.value;

      const tokens = store.getTokensBefore(value, { count: 3 });

      assert.ok(tokens.length <= 3);
      assert.strictEqual(tokens[tokens.length - 1].value, "=");
    });

    it("should handle getTokensAfter with count", () => {
      const ast = parse(`key1 = "value1"
key2 = "value2"
key3 = "value3"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue1 = ast.body[0].body[0];

      const tokens = store.getTokensAfter(keyValue1, { count: 3 });

      assert.ok(tokens.length > 0);
      assert.ok(tokens.length <= 3);
    });

    it("should correctly identify space between elements in array", () => {
      const ast = parse(`arr = [ 1 , 2 , 3 ]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const firstToken = store.getFirstToken(arr);
      const secondToken = store.getTokenAfter(firstToken);

      assert.ok(firstToken);
      assert.ok(secondToken);
      assert.strictEqual(store.isSpaceBetween(firstToken, secondToken), true);
    });

    it("should handle deeply nested structures", () => {
      const ast = parse(`nested = { inner = [1, 2, 3] }`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const inlineTable = keyValue.value;

      const tokens = store.getTokens(inlineTable);
      assert.ok(tokens.length > 0);
      assert.ok(tokens.some((t) => t.value === "["));
      assert.ok(tokens.some((t) => t.value === "]"));
    });

    it("should handle commentsExistBetween with spaces but no comments", () => {
      const ast = parse(`arr = [ 1 , 2 ]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;
      assert.strictEqual(arr.type, "TOMLArray");

      const exists = store.commentsExistBetween(
        arr.elements[0],
        arr.elements[1],
      );

      assert.strictEqual(exists, false);
    });

    it("should handle getCommentsInside with nested structures", () => {
      const ast = parse(`arr = [
  # comment inside
  1
]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const comments = store.getCommentsInside(arr);

      assert.strictEqual(comments.length, 1);
      assert.ok(comments[0].value.includes("comment inside"));
    });

    it("should handle getFirstTokens with filter and count", () => {
      const ast = parse(`arr = [1, 2, 3]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const intTokens = store.getFirstTokens(arr, {
        filter: (t) => /\d/.test(t.value),
        count: 2,
      });

      assert.strictEqual(intTokens.length, 2);
    });

    it("should handle getLastTokens in reverse order", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];

      const lastTokens = store.getLastTokens(keyValue, { count: 2 });

      assert.strictEqual(lastTokens.length, 2);
      assert.strictEqual(lastTokens[0].value, "=");
      assert.strictEqual(lastTokens[1].type, "BasicString");
    });

    it("should handle getTokenBefore on first token", () => {
      const ast = parse(`key = "value"`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      const firstToken = store.getFirstToken(keyValue);

      const token = store.getTokenBefore(firstToken);

      assert.strictEqual(token, null);
    });

    it("should handle filtering with type guard", () => {
      const ast = parse(`arr = [
        # comment
        1,
        2
      ]`);
      const store = new TOMLTokenStore({ ast });
      const keyValue = ast.body[0].body[0];
      assert.strictEqual(keyValue.type, "TOMLKeyValue");
      const arr = keyValue.value;

      const tokens = store.getTokens(arr, {
        includeComments: true,
        filter: (t): t is AST.Token =>
          t.type !== "Block" && t.type === "Integer",
      });

      assert.strictEqual(tokens.length, 2);
    });
  });
});
