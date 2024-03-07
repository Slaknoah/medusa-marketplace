import { Order } from "../models/order";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";
import {
  // alias the core repository to not cause a naming conflict
  OrderRepository as MedusaOrderRepository,
} from "@medusajs/medusa/dist/repositories/order";

export const OrderRepository = dataSource.getRepository(Order).extend(
  Object.assign(MedusaOrderRepository, {
    // you can add other customizations as well...
  })
);

export default OrderRepository;
