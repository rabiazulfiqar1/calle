import { z } from "zod";

const e164Regex = /^\+[1-9]\d{7,14}$/;
// + followed by 8-15 digits total (country code + number), no leading zero after +

export const phoneSchema = z
  .string()
  .regex(e164Regex, "Phone number must be in E.164 format, e.g. +923316062436");

export const supportedRegions = ["PK", "US", "GB", "IN", "AE"] as const;
export const supportedLocales = ["en", "ur"] as const;

export const regionSchema = z.enum(supportedRegions);
export const localeSchema = z.enum(supportedLocales);

export const recipientSchema = z.object({
  phone: phoneSchema,
  region: regionSchema,
  locale: localeSchema,
});

export const userInfoSchema = z.object({
  callbackPhone: phoneSchema.optional(),  // the non-speaker's own number, if they want it mentioned
  name: z.string().max(80).optional(),           // e.g. "on behalf of Rabia"
});

export const appointmentDetailsSchema = z.object({
  bookingType: z.string().min(1).max(100),
  purpose: z.string().min(1).max(300),
  preferredTimeRange: z.string().min(1).max(100),
});

export const elderCheckupDetailsSchema = z.object({
  personName: z.string().min(1).max(80),
  thingsToAsk: z.array(z.string().min(1).max(200)).min(1).max(10),
  reminder: z.string().max(300).optional(),
});

export const cancellationDetailsSchema = z.object({
  serviceName: z.string().min(1).max(100),
  accountReference: z.string().max(100).optional(),
  reasonForCancelling: z.string().max(300).optional(),
});

export const orderStatusDetailsSchema = z.object({
  orderReference: z.string().min(1).max(100),
  whatWasOrdered: z.string().min(1).max(200),
  orderedFrom: z.string().min(1).max(100),
});

export const relayMessageDetailsSchema = z.object({
  contactName: z.string().min(1).max(80),
  relationship: z.string().max(50).optional(),
  messageToRelay: z.string().min(1).max(300),   // e.g. "I'd like you to call me back when you can" / "I'm okay, just wanted to check in" / "Please come by when you get a chance"
  location: z.string().max(300).optional(),      // still allowed — "here's where I am" is informational, not an emergency dispatch
  locationConsent: z.boolean(),
});

export interface Template<TDetails> {
  id: string;
  label: string;
  detailsSchema: z.ZodType<TDetails>;
  buildTask: (details: TDetails, user: z.infer<typeof userInfoSchema>) => string;
  resultSchema: Record<string, any>;
  recipientResultSchema: Record<string, any>;
}