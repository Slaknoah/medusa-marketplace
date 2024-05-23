import {
  EventBusService,
  OrderService,
  Order,
  Payment,
} from "@medusajs/medusa";

import { EntityManager, Repository } from "typeorm";
import { PaymentService } from "@medusajs/medusa/dist/services";

type InjectedDependencies = {
  eventBusService: EventBusService;
  orderService: OrderService;
  orderRepository: Repository<Order>;
  paymentService: PaymentService;
  manager: EntityManager;
  paymentRepository: Repository<Payment>;
};

class PaymentSubscriber {
  private readonly manager: EntityManager;
  private readonly eventBusService: EventBusService;
  private readonly paymentService: PaymentService;
  private readonly paymentRepository: Repository<Payment>;

  constructor({
    eventBusService,
    paymentService,
    manager,
    paymentRepository,
  }: InjectedDependencies) {
    this.eventBusService = eventBusService;
    this.paymentService = paymentService;
    this.paymentRepository = paymentRepository;
    this.manager = manager;

    this.eventBusService.subscribe(
      PaymentService.Events.PAYMENT_CAPTURED,
      this.handlePaymentCaptured.bind(this)
    );
  }

  private async handlePaymentCaptured({ id }: { id: string }): Promise<void> {
    //Update related payments objects
    //retrieve order
    const payment: Payment = (await this.paymentService.retrieve(id, {
      relations: [
        "order",
        "order.children",
        "order.children.payments"
      ],
    })) as any;

    console.log("Payment created", payment);
    const paymentRepository = this.manager.withRepository(this.paymentRepository);

    // Update all children payments to be captured
    const updates = [];
    for (const child of payment.order.children) {
      for (const childPayment of child.payments) {
        if (childPayment.captured_at === null) {
          childPayment.captured_at = new Date().toISOString();
          updates.push(
            paymentRepository.save(childPayment)
          )
        }
      }
    }
  }
}

export default PaymentSubscriber;
