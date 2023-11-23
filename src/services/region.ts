import { User } from "@medusajs/medusa";
import { Lifetime } from "awilix"

import { RegionService as MedusaRegionService } from "@medusajs/medusa";

class RegionService extends MedusaRegionService {
  // The default life time for a core service is SINGLETON
  static LIFE_TIME = Lifetime.TRANSIENT

  protected readonly loggedInUser_: User | null;

  constructor(container) {
    // @ts-expect-error prefer-rest-params
    // eslint-disable-next-line prefer-rest-params
    super(...arguments);

    try {
      this.loggedInUser_ = container.loggedInUser;
    } catch (e) {
      // avoid errors when backend first runs
    }
  }
}

export default RegionService;
