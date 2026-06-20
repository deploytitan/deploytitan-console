/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actors from "../actors.js";
import type * as console from "../console.js";
import type * as crons from "../crons.js";
import type * as github from "../github.js";
import type * as githubWebhook from "../githubWebhook.js";
import type * as http from "../http.js";
import type * as platform from "../platform.js";
import type * as releaseControl from "../releaseControl.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actors: typeof actors;
  console: typeof console;
  crons: typeof crons;
  github: typeof github;
  githubWebhook: typeof githubWebhook;
  http: typeof http;
  platform: typeof platform;
  releaseControl: typeof releaseControl;
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

export declare const components: {};
