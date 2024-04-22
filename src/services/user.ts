import { Lifetime } from "awilix";
import { User, UserService as MedusaUserService, SalesChannelService, Store } from "@medusajs/medusa";
import {
  FilterableUserProps,
  CreateUserInput as MedusaCreateUserInput,
} from "@medusajs/medusa/dist/types/user";
import * as crypto from "crypto";
import StoreRepository from "@medusajs/medusa/dist/repositories/store";
import CurrencyRepository from "@medusajs/medusa/dist/repositories/currency";

type CreateUserInput = {
  store_id?: string;
} & MedusaCreateUserInput;

type UsersSelector = {
  store_id?: string;
} & FilterableUserProps;

class UserService extends MedusaUserService {
  static LIFE_TIME = Lifetime.TRANSIENT;
  protected readonly loggedInUser_: User | null;
  protected readonly storeRepository_: typeof StoreRepository;
  protected readonly salesChannelService_: SalesChannelService;

  constructor(container) {
    // eslint-disable-next-line prefer-rest-params
    super(container);
    this.storeRepository_ = container.storeRepository;
    this.salesChannelService_ = container.salesChannelService;

    try {
      this.loggedInUser_ = container.loggedInUser;
    } catch (e) {
      // avoid errors when backend first runs
    }
  }

  async create(user: CreateUserInput, password: string, storeDetails?: Partial<Store>): Promise<User> {
    // Create store if missing
    if (!user.store_id) {
      const storeRepo = this.manager_.withRepository(this.storeRepository_);

      let newStore = storeRepo.create(storeDetails);
      newStore = await storeRepo.save(newStore);
      user.store_id = newStore.id;
    }

    // Ensure api token is created
    if (!user.api_token) {
      user.api_token = crypto.randomBytes(64).toString("hex");
    }

    return super.create(user, password);
  }

  async list(selector: UsersSelector, config): Promise<User[]> {
    console.log(this.loggedInUser_, "logged in user");
    if (!selector.store_id && this.loggedInUser_?.store_id) {
      selector.store_id = this.loggedInUser_.store_id;
    }

    return await super.list(selector, config);
  }
}

export default UserService;
