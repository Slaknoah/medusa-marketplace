import {
  FindConfig,
  Order,
  QuerySelector,
  Selector,
  User,
} from "@medusajs/medusa";
import { Lifetime } from "awilix"

import { OrderService as MedusaOrderService } from "@medusajs/medusa/dist/services";

class OrderService extends MedusaOrderService {
  // The default life time for a core service is SINGLETON
  static LIFE_TIME = Lifetime.SCOPED

  protected readonly loggedInUser_: User | null;
  protected readonly isStoreRequest: boolean | null;

  constructor(container) {
    // @ts-expect-error prefer-rest-params
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);

    try {
      this.isStoreRequest = container.isStoreRequest;
    } catch (e) {}

    try {
      this.loggedInUser_ = container.loggedInUser;
    } catch (e) {}
  }

  list(
    selector: Selector<Order>,
    config?: FindConfig<Order>
  ): Promise<Order[]> {
    if (this.loggedInUser_?.role === "admin") {
      return super.list(selector, config);
    }

    if (!selector.store_id && this.loggedInUser_?.store_id) {
      selector.store_id = this.loggedInUser_.store_id;
    }

    return super.list(selector, config);
  }

  listAndCount(
    selector: QuerySelector<Order>,
    config: FindConfig<Order> = {
      skip: 0,
      take: 50,
      order: { created_at: "DESC" },
    }
  ): Promise<[Order[], number]> {
    if (this.loggedInUser_?.role === "admin") {
      return super.listAndCount(selector, config);
    }

    if (!selector.store_id && this.loggedInUser_?.store_id) {
      selector.store_id = this.loggedInUser_.store_id;
    }

    // If fetching orders for customers dont fetch child orders
    if (this.isStoreRequest) {
      selector.order_parent_id = null;
    }

    return super.listAndCount(selector, config);
  }
}

export default OrderService;
