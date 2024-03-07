import { Store } from "../models/store";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";

export const StoreRepository = dataSource.getRepository(Store);

export default StoreRepository;
