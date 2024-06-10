import { 
    type SubscriberConfig, 
    type SubscriberArgs,
    OrderService, 
} from "@medusajs/medusa"
import OrderSubscriberService from "src/services/order-subscriber"

export default async function orderEventHandler({ 
    data, eventName, container, pluginOptions, 
}: SubscriberArgs<{ id: string }>) {
    const orderSubscriberService: OrderSubscriberService = container.resolve(
        "orderSubscriberService"
    )

    switch (eventName) {
        case OrderService.Events.PLACED:
            return orderSubscriberService.handleOrderPlaced(data)
        case OrderService.Events.CANCELED:
            return orderSubscriberService.checkStatus(data)
        case OrderService.Events.UPDATED:
            return orderSubscriberService.checkStatus(data)
        case OrderService.Events.COMPLETED:
            return orderSubscriberService.checkStatus(data)
        case OrderService.Events.PAYMENT_CAPTURED:
            return orderSubscriberService.handlePaymentCaptured(data)
        default:
            return
    }
}

export const config: SubscriberConfig = {
    event: [
        OrderService.Events.PLACED, 
        OrderService.Events.CANCELED, 
        OrderService.Events.UPDATED, 
        OrderService.Events.COMPLETED, 
        OrderService.Events.PAYMENT_CAPTURED
    ],
    context: {
        subscriberId: "order-event-handler",
    },
}