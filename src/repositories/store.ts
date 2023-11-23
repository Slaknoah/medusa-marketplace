import { Store } from "../models/store";
import { dataSource } from "@medusajs/medusa/dist/loaders/database";
import {
  // alias the core repository to not cause a naming conflict
  StoreRepository as MedusaStoreRepository,
} from "@medusajs/medusa/dist/repositories/store";

export const StoreRepository = dataSource.getRepository(Store).extend({
  // it is important to spread the existing repository here.
  // Otherwise you will end up losing core properties.
  // you also update the target to the extended entity
  ...Object.assign(MedusaStoreRepository, { target: Store }),

  // you can add other customizations as well...
});

export default StoreRepository;
