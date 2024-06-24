import StripeBase from "../core/stripe-base"
import { PaymentIntentOptions, PaymentProviderKeys } from "../types/stripe"
import { Lifetime } from "awilix"
import { IsNull, Not } from "typeorm";
import StoreService from "./store";

class StripeProviderService extends StripeBase {
  static identifier = PaymentProviderKeys.STRIPE
  static LIFE_TIME = Lifetime.SINGLETON
  storeService: StoreService

  constructor(container, options) {
    const { storeService } = container
    super(container, options)
    this.storeService = storeService;
  }

  async migrateAccounts() {
    console.log("Migrating accounts")
    const storesWithStripe = await this.storeService.list({
      c_stripe_account_id: Not(IsNull()),
    })
    // console.log(storesWithStripe.length)
    const updates = storesWithStripe.map(async (store) => {
      return this.stripe_.accounts.update(
        store.c_stripe_account_id,
        {
          settings: {
            payouts: {
              schedule: {
                interval: "manual",
              },
            },
          },
        }
      )
    })
    await Promise.all(updates)
  }

  get paymentIntentOptions(): PaymentIntentOptions {
    return {}
  }
}

export default StripeProviderService
