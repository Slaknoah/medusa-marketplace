import {
  LineItem,
  OrderStatus,
  EventBusService,
  OrderService,
  Order,
  Product,
  ShippingMethod,
  Payment,
  PaymentStatus,
} from "@medusajs/medusa";
import { BaseService } from "medusa-interfaces"

import { EntityManager, Repository } from "typeorm";
import ProductService from "./product";
import { StripeOptions } from "src/types/stripe";
import { PaymentService } from "@medusajs/medusa/dist/services";

type InjectedDependencies = {
  eventBusService: EventBusService;
  orderService: OrderService;
  orderRepository: Repository<Order>;
  productService: ProductService;
  paymentService: PaymentService;
  manager: EntityManager;
  lineItemRepository: Repository<LineItem>;
  shippingMethodRepository: Repository<ShippingMethod>;
  paymentRepository: Repository<Payment>;
};

class OrderSubscriberService extends BaseService {
  private readonly manager: EntityManager;
  private readonly eventBusService: EventBusService;
  private readonly orderService: OrderService;
  private readonly orderRepository: Repository<Order>;
  private readonly productService: ProductService;
  private readonly paymentService: PaymentService;
  private readonly lineItemRepository: Repository<LineItem>;
  private readonly shippingMethodRepository: Repository<ShippingMethod>;
  private readonly paymentRepository: Repository<Payment>;
  protected readonly stripeOptions_: StripeOptions

  constructor({
    eventBusService,
    orderService,
    orderRepository,
    productService,
    manager,
    lineItemRepository,
    shippingMethodRepository,
    paymentRepository,
    paymentService,
  }: InjectedDependencies, options) {
    super();

    this.eventBusService = eventBusService;
    this.orderService = orderService;
    this.orderRepository = orderRepository;
    this.productService = productService;
    this.paymentService = paymentService;
    this.manager = manager;
    this.lineItemRepository = lineItemRepository;
    this.shippingMethodRepository = shippingMethodRepository;
    this.paymentRepository = paymentRepository;

    this.stripeOptions_ = options.stripe || options.projectConfig.stripe;
  }

  async handlePaymentCaptured({ id }: { id: string }): Promise<void> {
    console.log('payment captured', id)

    //Update related payments objects
    //retrieve order
    const order: Order = (await this.orderService.retrieve(id, {
      relations: [
        "payments",
        "children",
        "children.payments"
      ],
    }));

    const paymentRepository = this.manager.withRepository(this.paymentRepository);
    const orderRepository = this.manager.withRepository(this.orderRepository);

    // Update all children payments to be captured
    const updates = [];
    for (const child of order.children) {
      for (const childPayment of child.payments) {
        if (childPayment.captured_at === null) {
          childPayment.captured_at = new Date().toISOString();
          updates.push(
            paymentRepository.save(childPayment)
          )
        }
      }
      child.payment_status = PaymentStatus.CAPTURED;
      updates.push(
        orderRepository.save(child)
      )
    }

    await Promise.all(updates);
  }

  async handleOrderPlaced({ id }: { id: string }): Promise<void> {
    //create child orders
    //retrieve order
    const order: Order = (await this.orderService.retrieve(id, {
      relations: [
        "items",
        "items.variant",
        "cart",
        "shipping_methods",
        "payments",
      ],
    })) as any;

    //group items by store id
    const groupedItems = {};

    for (const item of order.items) {
      const product: Product = (await this.productService.retrieve(
        item.variant.product_id,
        { select: ["store_id"] }
      )) as any;
      const store_id = product.store_id;
      if (!store_id) {
        continue;
      }
      if (!groupedItems.hasOwnProperty(store_id)) {
        groupedItems[store_id] = [];
      }

      groupedItems[store_id].push(item);
    }

    // If cart has only items from one store, do nothing, just update order store_id to the store_id of the items
    if (Object.keys(groupedItems).length === 1) {
      const store_id = Object.keys(groupedItems)[0];
      if (store_id) {
        order.store_id = store_id;
        await this.manager.withRepository(this.orderRepository).save(order);

        // auto-capture payment, we do this last because we want to capture payment  on previously created payments on child orders
        if (order.payment_status !== "captured" && this.stripeOptions_.capture) {
          await this.orderService.capturePayment(order.id)
        }
        return;
      }
    }

    const orderRepo = this.manager.withRepository(this.orderRepository);
    const lineItemRepo = this.manager.withRepository(this.lineItemRepository);
    const shippingMethodRepo = this.manager.withRepository(
      this.shippingMethodRepository
    );
    const paymentRepository = this.manager.withRepository(
      this.paymentRepository
    );

    // Throw error if more than one store is found and payment provider is stripe
    const isStripe = order.payments.some((payment) => payment.provider_id === "stripe");
    if (Object.keys(groupedItems).length > 1 && isStripe) {
      throw new Error("Multiple stores cart not supported with stripe payments at the moment");
    }
    
    for (const store_id in groupedItems) {
      //create order
      const childOrder = orderRepo.create({
        ...order,
        order_parent_id: id,
        store_id: store_id,
        cart_id: null,
        cart: null,
        id: null,
        shipping_methods: [],
      }) as Order;
      const orderResult = await orderRepo.save(childOrder);

      //create shipping methods
      for (const shippingMethod of order.shipping_methods) {
        const newShippingMethod = shippingMethodRepo.create({
          ...shippingMethod,
          id: null,
          cart_id: null,
          cart: null,
          order_id: orderResult.id,
        });

        await shippingMethodRepo.save(newShippingMethod);
      }

      //create line items
      const items: LineItem[] = groupedItems[store_id];
      for (const item of items) {
        const newItem = lineItemRepo.create({
          ...item,
          id: null,
          order_id: orderResult.id,
          cart_id: null,
        });
        await lineItemRepo.save(newItem);
      }

      // Create payments

      // TODO: implement once multiple shipping methods are supported and multistore cart is supported
      const shipping_price = 0;
      const total = items.reduce((acc, item) => {
        return acc + item.quantity * item.unit_price;
      }, 0) + shipping_price;

      for (const payment of order.payments) {
        const newPayment = paymentRepository.create({
          ...payment,
          id: null,
          order_id: orderResult.id,
          cart_id: null,
          cart: null,
          // TODO: enable once above is implemented
          // amount: total,
        });

        await this.manager.withRepository(this.paymentRepository).save(newPayment);
      }
    }

    // auto-capture payment, we do this last because we want to capture payment  on previously created payments on child orders
    if (order.payment_status !== "captured" && this.stripeOptions_.capture) {
      await this.orderService.capturePayment(order.id)
    }
  }

  public async checkStatus({ id }: { id: string }): Promise<void> {
    //retrieve order
    const order: Order = (await this.orderService.retrieve(id)) as any;

    if (order.order_parent_id) {
      //retrieve parent
      const orderRepo = this.manager.withRepository(this.orderRepository);
      const parentOrder = await this.orderService.retrieve(
        order.order_parent_id,
        {
          relations: ["children"],
        }
      );

      const newStatus = this.getStatusFromChildren(parentOrder as any) as any;
      if (newStatus !== parentOrder.status) {
        switch (newStatus) {
          case OrderStatus.CANCELED:
            this.orderService.cancel(parentOrder.id);
            break;
          case OrderStatus.ARCHIVED:
            this.orderService.archive(parentOrder.id);
            break;
          case OrderStatus.COMPLETED:
            this.orderService.completeOrder(parentOrder.id);
            break;
          default:
            parentOrder.status = newStatus;
            parentOrder.fulfillment_status = newStatus;
            parentOrder.payment_status = newStatus;
            await orderRepo.save(parentOrder);
        }
      }
    }
  }

  public getStatusFromChildren(order: Order): string {
    if (!order.children) {
      return order.status;
    }

    //collect all statuses
    let statuses = order.children.map((child) => child.status);

    //remove duplicate statuses
    statuses = [...new Set(statuses)];

    if (statuses.length === 1) {
      return statuses[0];
    }

    //remove archived and canceled orders
    statuses = statuses.filter(
      (status) =>
        status !== OrderStatus.CANCELED && status !== OrderStatus.ARCHIVED
    );

    if (!statuses.length) {
      //all child orders are archived or canceled
      return OrderStatus.CANCELED;
    }

    if (statuses.length === 1) {
      return statuses[0];
    }

    //check if any order requires action
    const hasRequiresAction = statuses.some(
      (status) => status === OrderStatus.REQUIRES_ACTION
    );
    if (hasRequiresAction) {
      return OrderStatus.REQUIRES_ACTION;
    }

    //since more than one status is left and we filtered out canceled, archived,
    //and requires action statuses, only pending and complete left. So, return pending
    return OrderStatus.PENDING;
  }
}

export default OrderSubscriberService;
