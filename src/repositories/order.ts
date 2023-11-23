import { Order } from "../models/order";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";
import {
  // alias the core repository to not cause a naming conflict
  OrderRepository as MedusaOrderRepository,
} from "@medusajs/medusa/dist/repositories/order";

export const OrderRepository = dataSource.getRepository(Order).extend({
  // it is important to spread the existing repository here.
  // Otherwise you will end up losing core properties.
  // you also update the target to the extended entity
  ...Object.assign(MedusaOrderRepository, { target: Order }),

  // you can add other customizations as well...
});

export default OrderRepository;
