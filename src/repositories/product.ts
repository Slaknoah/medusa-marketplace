import { Product } from "../models/product";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";

export const ProductRepository = dataSource.getRepository(Product);

export default ProductRepository;
