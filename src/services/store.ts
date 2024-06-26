import { FindConfig, Selector, Store, User, buildQuery } from "@medusajs/medusa";
import { MedusaError } from "medusa-core-utils";
import { Lifetime } from "awilix"

import { StoreService as MedusaStoreService } from "@medusajs/medusa";
import { FindOptionsWhere, ILike } from "typeorm";

class StoreService extends MedusaStoreService {
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

  async listAndCount(
    selector?: Selector<Store> & {
      q?: string
    },
    config: FindConfig<Store> = {
      skip: 0,
      take: 20,
      relations: [],
      order: { created_at: "DESC" },
  }): Promise<[Store[], number]> {
    const storeRepo = this.activeManager_.withRepository(
      this.storeRepository_
    )

    const { q, ...storeSelector } = selector

    const query = buildQuery(storeSelector, config)
    query.where = query.where as FindOptionsWhere<Store>

    if (q) {
      query.where.name = ILike(`%${q}%`)
    }

    return storeRepo.findAndCount(query)
  }

  async list(
    selector?: Selector<Store> & {
      q?: string
    },
    config: FindConfig<Store> = {
      skip: 0,
      take: 20,
      relations: [],
      order: { created_at: "DESC" },
  }): Promise<Store[]> {
    const storeRepo = this.activeManager_.withRepository(
      this.storeRepository_
    )

    const { q, ...storeSelector } = selector

    const query = buildQuery(storeSelector, config)
    query.where = query.where as FindOptionsWhere<Store>

    if (q) {
      query.where.name = ILike(`%${q}%`)
    }

    return storeRepo.find(query)
  }

  /**
   * Create a store for a particular user. It mainly used from the event BeforeInsert to create a store
   * for the user that is being inserting.
   * @param user
   */
  // public async createForUser(user: User): Promise<Store | void> {
  //   if (user.store_id) {
  //     return;
  //   }
  //   const store = StoreRepository.create() as Store;
  //   return StoreRepository.save(store);
  // }

  async retrieve(config?: FindConfig<Store>): Promise<Store> {
    if (!this.loggedInUser_ || this.loggedInUser_?.role === "admin") {
      return super.retrieve(config);
    }

    return this.retrieveForLoggedInUser(config);
  }

  async retrieveForLoggedInUser(config?: FindConfig<Store>) {
    const storeRepo = this.activeManager_.withRepository(this.storeRepository_);
    const query = buildQuery(
      {
        id: this.loggedInUser_?.store_id,
      },
      config
    );
    const store = await storeRepo.findOne(query);

    if (!store) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Store does not exist"
      );
    }

    return store;
  }
}

export default StoreService;
