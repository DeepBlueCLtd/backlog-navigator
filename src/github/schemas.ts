/**
 * Zod schemas for GitHub REST responses. All API JSON crosses through one of
 * these before reaching domain code (Article XV — typed boundaries).
 *
 * See specs/242-backlog-navigator/contracts/github-api.md.
 */

import { z } from 'zod';

export const ContentsResponseSchema = z.object({
  type: z.literal('file'),
  encoding: z.literal('base64'),
  content: z.string(),
  sha: z.string(),
  path: z.string(),
});
export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;

export const ContentsWriteResponseSchema = z.object({
  content: z.object({
    sha: z.string(),
    path: z.string(),
  }),
  commit: z.object({
    sha: z.string(),
  }),
});
export type ContentsWriteResponse = z.infer<typeof ContentsWriteResponseSchema>;

export const PullResponseSchema = z.object({
  number: z.number(),
  state: z.union([z.literal('open'), z.literal('closed')]),
  title: z.string(),
  head: z.object({ ref: z.string(), sha: z.string() }),
  html_url: z.string(),
});
export type PullResponse = z.infer<typeof PullResponseSchema>;

export const RefResponseSchema = z.object({
  ref: z.string(),
  object: z.object({ sha: z.string() }),
});
export type RefResponse = z.infer<typeof RefResponseSchema>;

export const CreatePullResponseSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.union([z.literal('open'), z.literal('closed')]),
});
export type CreatePullResponse = z.infer<typeof CreatePullResponseSchema>;
