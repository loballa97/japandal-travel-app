
'use server';

/**
 * @fileOverview Provides real-time updates about the selected route, including traffic conditions and transit delays.
 *
 * - getRealTimeUpdates - A function that retrieves real-time updates for a given route.
 * - RealTimeUpdatesInput - The input type for the getRealTimeUpdates function.
 * - RealTimeUpdatesOutput - The return type for the getRealTimeUpdates function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RealTimeUpdatesInputSchema = z.object({
  routeDescription: z
    .string()
    .describe('A description of the route, including start and end locations and transportation mode.'),
  currentConditions: z
    .string()
    .optional()
    .describe('Optional: Current traffic or transit conditions along the route.'),
});
export type RealTimeUpdatesInput = z.infer<typeof RealTimeUpdatesInputSchema>;

const RealTimeUpdatesOutputSchema = z.object({
  overallStatus: z
    .enum(['smooth', 'minor_delays', 'significant_delays', 'disrupted'])
    .describe("The overall status of the route: 'smooth', 'minor_delays', 'significant_delays', or 'disrupted'."),
  statusMessage: z
    .string()
    .describe('A human-readable, concise summary of the route status, including potential delays or disruptions.'),
  suggestedAction: z
    .string()
    .optional()
    .describe('A specific suggested action for the user if issues are present, e.g., "Consider an alternative route via City Central." This field is optional if the route is smooth.'),
  estimatedDelay: z
    .string()
    .optional()
    .describe('An estimated delay duration if applicable, e.g., "approx. 10-15 minutes". This field is optional.'),
});
export type RealTimeUpdatesOutput = z.infer<typeof RealTimeUpdatesOutputSchema>;

export async function getRealTimeUpdates(input: RealTimeUpdatesInput): Promise<RealTimeUpdatesOutput> {
  return getRealTimeUpdatesFlow(input);
}

const realTimeUpdatesPrompt = ai.definePrompt({
  name: 'realTimeUpdatesPrompt',
  input: {schema: RealTimeUpdatesInputSchema},
  output: {schema: RealTimeUpdatesOutputSchema},
  prompt: `You are a helpful travel assistant providing real-time updates for a user's selected route.
Based on the route description and any current conditions, analyze the situation and provide a structured update.

Your output must conform to the provided schema and include:
- 'overallStatus': Categorize the route as 'smooth', 'minor_delays', 'significant_delays', or 'disrupted'.
- 'statusMessage': A concise, human-readable summary of the route status.
- 'suggestedAction': If there are delays or disruptions, suggest a concrete action (e.g., "Consider using the Metro Blue Line instead." or "Leave 10 minutes earlier."). This field is optional and should only be provided if relevant.
- 'estimatedDelay': If there's a delay, provide an estimate (e.g., "5-10 minutes"). This field is optional and should only be provided if a delay exists.

Route Description: {{{routeDescription}}}
Current Conditions: {{{currentConditions}}}

Provide your update based on this information.
`,
});

const getRealTimeUpdatesFlow = ai.defineFlow(
  {
    name: 'getRealTimeUpdatesFlow',
    inputSchema: RealTimeUpdatesInputSchema,
    outputSchema: RealTimeUpdatesOutputSchema,
  },
  async input => {
    const {output} = await realTimeUpdatesPrompt(input);
    return output!;
  }
);
