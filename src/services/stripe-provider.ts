import StripeBase from "../core/stripe-base"
import { PaymentIntentOptions, PaymentProviderKeys } from "../types/stripe"

class StripeProviderService extends StripeBase {
  static identifier = PaymentProviderKeys.STRIPE

  constructor(_, options) {
    super(_, options)
  }

  get paymentIntentOptions(): PaymentIntentOptions {
    return {}
  }
}

export default StripeProviderService
