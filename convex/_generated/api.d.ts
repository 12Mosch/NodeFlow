/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as blocks from "../blocks.js";
import type * as cardStates from "../cardStates.js";
import type * as crons from "../crons.js";
import type * as databaseRows from "../databaseRows.js";
import type * as databaseSchemas from "../databaseSchemas.js";
import type * as documents from "../documents.js";
import type * as exams from "../exams.js";
import type * as files from "../files.js";
import type * as helpers_documentAccess from "../helpers/documentAccess.js";
import type * as helpers_examDocuments from "../helpers/examDocuments.js";
import type * as helpers_flashcardContext from "../helpers/flashcardContext.js";
import type * as helpers_fsrs from "../helpers/fsrs.js";
import type * as helpers_leech from "../helpers/leech.js";
import type * as http from "../http.js";
import type * as presence from "../presence.js";
import type * as prosemirrorSync from "../prosemirrorSync.js";
import type * as search from "../search.js";
import type * as sharing from "../sharing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  blocks: typeof blocks;
  cardStates: typeof cardStates;
  crons: typeof crons;
  databaseRows: typeof databaseRows;
  databaseSchemas: typeof databaseSchemas;
  documents: typeof documents;
  exams: typeof exams;
  files: typeof files;
  "helpers/documentAccess": typeof helpers_documentAccess;
  "helpers/examDocuments": typeof helpers_examDocuments;
  "helpers/flashcardContext": typeof helpers_flashcardContext;
  "helpers/fsrs": typeof helpers_fsrs;
  "helpers/leech": typeof helpers_leech;
  http: typeof http;
  presence: typeof presence;
  prosemirrorSync: typeof prosemirrorSync;
  search: typeof search;
  sharing: typeof sharing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  prosemirrorSync: {
    lib: {
      deleteDocument: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        null
      >;
      deleteSnapshots: FunctionReference<
        "mutation",
        "internal",
        { afterVersion?: number; beforeVersion?: number; id: string },
        null
      >;
      deleteSteps: FunctionReference<
        "mutation",
        "internal",
        {
          afterVersion?: number;
          beforeTs: number;
          deleteNewerThanLatestSnapshot?: boolean;
          id: string;
        },
        null
      >;
      getSnapshot: FunctionReference<
        "query",
        "internal",
        { id: string; version?: number },
        { content: null } | { content: string; version: number }
      >;
      getSteps: FunctionReference<
        "query",
        "internal",
        { id: string; version: number },
        {
          clientIds: Array<string | number>;
          steps: Array<string>;
          version: number;
        }
      >;
      latestVersion: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | number
      >;
      submitSnapshot: FunctionReference<
        "mutation",
        "internal",
        {
          content: string;
          id: string;
          pruneSnapshots?: boolean;
          version: number;
        },
        null
      >;
      submitSteps: FunctionReference<
        "mutation",
        "internal",
        {
          clientId: string | number;
          id: string;
          steps: Array<string>;
          version: number;
        },
        | {
            clientIds: Array<string | number>;
            status: "needs-rebase";
            steps: Array<string>;
          }
        | { status: "synced" }
      >;
    };
  };
};
