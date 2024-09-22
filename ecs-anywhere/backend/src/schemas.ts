import { z } from 'zod';

/**
 * Defines a schema for the PutPaste api action.
 */
export const PutPasteSchema = z.object({
  /**
   * The paste text.
   */
  text: z.string()
});

export type PutPasteSchema = z.infer<typeof PutPasteSchema>;

/**
 * Defines a schema for the GetPaste api action.
 */
export const GetPasteSchema = z.object({
  /**
   * The paste id.
   */
  id: z.string()
});

export type GetPasteSchema = z.infer<typeof GetPasteSchema>;
