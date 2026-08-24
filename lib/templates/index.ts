import { Template } from "./types";
import { appointmentTemplate } from "./appointment";
import { elderCheckupTemplate } from "./elder_checkup";
import { cancellationTemplate } from "./cancellation";
import { orderStatusTemplate } from "./orderStatus";
import { relayMessageTemplate } from "./relayMessage";

export { recipientSchema, userInfoSchema } from "./types";

export const templates: Record<string, Template<any>> = {
  appointment: appointmentTemplate,
  elder_checkup: elderCheckupTemplate,
  cancellation: cancellationTemplate,   
  order_status: orderStatusTemplate,
  relay_message: relayMessageTemplate,
};