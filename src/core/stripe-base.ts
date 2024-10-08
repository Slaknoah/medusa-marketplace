import {
  AbstractPaymentProcessor,
  CartService,
  isPaymentProcessorError,
  LineItemService,
  OrderService,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
  Store,
  User,
} from "@medusajs/medusa"
import { EOL } from "os"
import Stripe from "stripe"
import {
  ErrorCodes,
  ErrorIntentStatus,
  PaymentIntentOptions,
  StripeOptions,
} from "../types/stripe"
import { MedusaError } from "@medusajs/utils"

const APPLICATION_FEE_PERCENTAGE = 0.05
abstract class StripeBase extends AbstractPaymentProcessor {
  static identifier = ""

  protected readonly options_: StripeOptions
  protected stripe_: Stripe
  protected cartService: CartService
  protected lineItemService: LineItemService

  protected constructor(_, options) {
    super(_, options)

    this.options_ = options.stripe || options.projectConfig.stripe;
    this.cartService = _.cartService
    this.lineItemService = _.lineItemService
    this.options_.default_application_fee_multiplier = this.options_.default_application_fee_multiplier ?? APPLICATION_FEE_PERCENTAGE

    this.init()
  }

  protected init(): void {
    this.stripe_ =
      this.stripe_ ||
      new Stripe(this.options_.api_key, {
        apiVersion: "2023-10-16",
      })
  }

  abstract get paymentIntentOptions(): PaymentIntentOptions

  getStripe() {
    return this.stripe_
  }

  getPaymentIntentOptions(): PaymentIntentOptions {
    const options: PaymentIntentOptions = {}

    if (this?.paymentIntentOptions?.capture_method) {
      options.capture_method = this.paymentIntentOptions.capture_method
    }

    if (this?.paymentIntentOptions?.setup_future_usage) {
      options.setup_future_usage = this.paymentIntentOptions.setup_future_usage
    }

    if (this?.paymentIntentOptions?.payment_method_types) {
      options.payment_method_types =
        this.paymentIntentOptions.payment_method_types
    }

    return options
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    const id = paymentSessionData.id as string
    const paymentIntent = await this.stripe_.paymentIntents.retrieve(id)

    switch (paymentIntent.status) {
      case "requires_payment_method":
      case "requires_confirmation":
      case "processing":
        return PaymentSessionStatus.PENDING
      case "requires_action":
        return PaymentSessionStatus.REQUIRES_MORE
      case "canceled":
        return PaymentSessionStatus.CANCELED
      case "requires_capture":
      case "succeeded":
        return PaymentSessionStatus.AUTHORIZED
      default:
        return PaymentSessionStatus.PENDING
    }
  }

  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    const intentRequestData = this.getPaymentIntentOptions()
    const {
      email,
      context: cart_context,
      currency_code,
      amount,
      resource_id,
      customer,
    } = context

    const lineItems = await this.lineItemService.list({
      cart_id: resource_id,
    }, {
      relations: ["variant", "variant.product", "variant.product.store"],    
      take: 1,
    })
    if (lineItems.length === 0) {
      return this.buildError(
        "An error occurred in initiatePayment, no line items found",
        new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "No line items found for cart"
        )
      )
    }

    // We pick store from line items because currently we only allow
    // one store per cart
    const store = lineItems[0].variant.product.store as Store
    const accountId = store?.c_stripe_account_id ? store?.c_stripe_account_id : undefined
    
    if (!accountId) {
      return this.buildError(
        "An error occurred in initiatePayment, no stripe account found",
        new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "No stripe account found for store"
        )
      )
    }

    const description = (cart_context.payment_description ??
      this.options_?.payment_description) as string

    const multiplier = store.application_fee_multiplier ?? this.options_.default_application_fee_multiplier;

    // Remove shipping from transaction
    const response = await this.cartService.retrieveWithTotals(resource_id, {
      relations: ["shipping_methods", "shipping_methods.shipping_option"]
    })
    const total = amount;
    // Update payment intent transfer amount
    const isManualShipping = response.shipping_methods.some((sm) => sm.shipping_option.provider_id === "manual")

    const shippingPrice = isManualShipping ? 0 : response.shipping_methods.reduce((acc, curr) => acc + curr.price, 0)
    // Shipping price to remove from payment intent amount
    const appliedShippingPrice = isManualShipping ? 0 : response.shipping_methods.reduce((acc, curr) => acc + curr.price, 0)

    
    if (total - appliedShippingPrice < 0) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Shipping cost exceeds payment intent amount"
        )
    }

    const subTotal = total - appliedShippingPrice;
    const applicationFee = Math.round(subTotal * multiplier);
    const storePrice = subTotal - applicationFee;
    

    const intentRequest: Stripe.PaymentIntentCreateParams = {
      description,
      amount: Math.round(amount),
      currency: currency_code,
      metadata: { 
        resource_id,
        shipping_price: shippingPrice,
        applied_shipping_price: appliedShippingPrice,
        application_fee: applicationFee,
        sub_total: subTotal,
        store_price: storePrice,
      },
      // We do this post payment cloning so capturing happens afterwards
      capture_method: this.options_.capture ? "automatic" : "manual",
      ...intentRequestData,
      // capture_method: 'manual',
      on_behalf_of: accountId,
      // application_fee_amount: Math.round(amount * (multiplier)),
      transfer_data: {
        amount: storePrice,
        destination: accountId,
      },
    }

    if (this.options_?.automatic_payment_methods) {
      intentRequest.automatic_payment_methods = { enabled: true }
    }

    if (customer?.metadata?.stripe_id) {
      intentRequest.customer = customer.metadata.stripe_id as string
    } else {
      let stripeCustomer
      try {
        stripeCustomer = await this.stripe_.customers.create({
          email,
        })
      } catch (e) {
        return this.buildError(
          "An error occurred in initiatePayment when creating a Stripe customer",
          e
        )
      }

      intentRequest.customer = stripeCustomer.id
    }

    // Get all sub orders and 

    let session_data
    try {
      session_data = (await this.stripe_.paymentIntents.create(
        intentRequest
      )) as unknown as Record<string, unknown>
    } catch (e) {
      console.log(e)
      return this.buildError(
        "An error occurred in InitiatePayment during the creation of the stripe payment intent",
        e
      )
    }

    return {
      session_data,
      update_requests: customer?.metadata?.stripe_id
        ? undefined
        : {
            customer_metadata: {
              stripe_id: intentRequest.customer,
            },
          },
    }
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<
    | PaymentProcessorError
    | {
        status: PaymentSessionStatus
        data: PaymentProcessorSessionResponse["session_data"]
      }
  > {
    const status = await this.getPaymentStatus(paymentSessionData)
    return { data: paymentSessionData, status }
  }

  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    try {
      const id = paymentSessionData.id as string
      return (await this.stripe_.paymentIntents.cancel(
        id
      )) as unknown as PaymentProcessorSessionResponse["session_data"]
    } catch (error) {
      // TODO: Figure out charging the seller for the associated stripe fee
      // If cancel fails due to succeeded payment do a full refund with reversal
      if (error.code === ErrorCodes.PAYMENT_INTENT_UNEXPECTED_STATE && error.payment_intent?.status === ErrorIntentStatus.SUCCEEDED) {
        const payment_intent = error.payment_intent;
        await this.stripe_.refunds.create({
          payment_intent: payment_intent.id as string,
          reverse_transfer: true,
          metadata: {
            ...((paymentSessionData.metadata as any) || {}),
            refund_reason: "cancel",
          },
        });

        return payment_intent;
      }

      if (error.payment_intent?.status === ErrorIntentStatus.CANCELED) {
        return error.payment_intent
      }

      return this.buildError("An error occurred in cancelPayment", error)
    }
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    const id = paymentSessionData.id as string
    try {
      const intent = await this.stripe_.paymentIntents.capture(id)
      return intent as unknown as PaymentProcessorSessionResponse["session_data"]
    } catch (error) {
      if (error.code === ErrorCodes.PAYMENT_INTENT_UNEXPECTED_STATE) {
        if (error.payment_intent?.status === ErrorIntentStatus.SUCCEEDED) {
          return error.payment_intent
        }
      }

      return this.buildError("An error occurred in capturePayment", error)
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    return await this.cancelPayment(paymentSessionData)
  }

  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    const id = paymentSessionData.id as string

    try {
      const paymentIntent = await this.stripe_.paymentIntents.retrieve(id, {
        expand: ["latest_charge", "latest_charge.balance_transaction"],
      })

      const cart = await this.cartService.retrieve((paymentIntent.metadata as any)?.resource_id, {
        relations: ["items.tax_lines"]
      })

      if (!cart) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "Cart not found"
        )
      }

      if (!paymentIntent.latest_charge) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "No charge found"
        )
      }

      // console.log(paymentIntent)
      const storePrice = paymentIntent.transfer_data.amount ?? parseInt(((paymentIntent.metadata as any)?.store_price || '0'), 10) as number;
      const stripeFee = ((paymentIntent.latest_charge as Stripe.Charge)?.balance_transaction as Stripe.BalanceTransaction)?.fee;
      const transferId = (paymentIntent.latest_charge as Stripe.Charge)?.transfer as string;

      // Is shipping price of seller refundable if not we need to remove it from the refund amount
      const appliedShipping = parseInt(((paymentIntent.metadata as any)?.applied_shipping_price || '0'), 10);
      const shipping = cart.shipping_total || parseInt(((paymentIntent.metadata as any)?.shipping_price || '0'), 10);

      const totalPaid = paymentIntent.amount;
      const maxRefundable = totalPaid - stripeFee - shipping;

      if (refundAmount > maxRefundable) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Refund amount exceeds max refundable amount"
        )
      }

      // If seller took shipping we need to remove from the seller price before computing percentage
      const storeBase = (appliedShipping === 0 && shipping > 0) ? storePrice - shipping : storePrice;
      const reversedTransfer = (storeBase / maxRefundable) * refundAmount;
      const applicationRefund = refundAmount - reversedTransfer;

      const refundsMetadata = {
        reversedTransfer, 
        totalPaid, 
        storePrice, 
        refundAmount, 
        transferId,
        stripeFee, 
        shipping, 
        maxRefundable,
        applicationRefund,
        appliedShipping,
        storeBase,
      }
      console.log(refundsMetadata);

      const transferReversal = await this.stripe_.transfers.createReversal(
        transferId,
        {
          amount: Math.round(reversedTransfer),
          metadata: refundsMetadata,
        }
      );

      await this.stripe_.refunds.create({
        amount: Math.round(refundAmount),
        payment_intent: id as string,
        metadata: {
          ...refundsMetadata,
          reversedTransferId: transferReversal.id,
        },
      })
    } catch (e) {
      console.log(e);
      return this.buildError("An error occurred in refundPayment", e)
    }

    return paymentSessionData
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    try {
      const id = paymentSessionData.id as string
      const intent = await this.stripe_.paymentIntents.retrieve(id)
      return intent as unknown as PaymentProcessorSessionResponse["session_data"]
    } catch (e) {
      return this.buildError("An error occurred in retrievePayment", e)
    }
  }

  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse | void> {
    const { amount, customer, paymentSessionData, resource_id } = context
    const stripeId = customer?.metadata?.stripe_id

    if (stripeId !== paymentSessionData.customer) {
      const result = await this.initiatePayment(context)
      if (isPaymentProcessorError(result)) {
        return this.buildError(
          "An error occurred in updatePayment during the initiate of the new payment for the new customer",
          result
        )
      }

      return result
    } else {
      if (amount && paymentSessionData.amount === Math.round(amount)) {
        return
      }

      try {
        const id = paymentSessionData.id as string

        // TODO: implemenent shipping deduction
        // Remove shipping fee before transfering
        // const cart = await this.cartService.retrieve(resource_id, {
        //   relations: ['shipping_methods', 'items.variant.product.store'],
        // })
        // const store = cart?.items?.[0]?.variant?.product?.store as Store;
        // const multiplier = parseFloat(`${store.application_fee_multiplier ?? this.options_.default_application_fee_multiplier}`);
        // const shippingPrice = cart.shipping_methods.reduce((acc, curr) => acc + curr.price, 0)
        // const subTotal = amount - shippingPrice;
        // const applicationFee = Math.round(subTotal * multiplier);

        // Update transfer data
        const sessionData = (await this.stripe_.paymentIntents.update(id, {
          amount: Math.round(amount),
          // Transfer data
          // application_fee_amount: null,
          // transfer_data: {
          //     amount: subTotal - applicationFee,
          // },
          // metadata: {
          //     ...((paymentSessionData.metadata as any) || {}),
          //     shipping_price: shippingPrice,
          //     application_fee: applicationFee,
          //     sub_total: subTotal,
          // },
        })) as unknown as PaymentProcessorSessionResponse["session_data"]

        return { session_data: sessionData }
      } catch (e) {
        return this.buildError("An error occurred in updatePayment", e)
      }
    }
  }

  async updatePaymentData(sessionId: string, data: Record<string, unknown>) {
    try {
      // Prevent from updating the amount from here as it should go through
      // the updatePayment method to perform the correct logic
      if (data.amount) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Cannot update amount, use updatePayment instead"
        )
      }

      return (await this.stripe_.paymentIntents.update(sessionId, {
        ...data,
      })) as unknown as PaymentProcessorSessionResponse["session_data"]
    } catch (e) {
      return this.buildError("An error occurred in updatePaymentData", e)
    }
  }

  async createStoreAccount(user: User, accountData: Partial<Stripe.AccountCreateParams> = {}) {
    const account = await this.stripe_.accounts.create({
      type: "standard",
      metadata: {
        user_id: user.id,
        store_id: user.store_id,
      },
      business_type: "individual",
      company: {
        name: user.store.name,
      },
      individual: {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      },
      ...accountData,
    })

    return account
  }

  async createAccountOnBoardingLink({
    accountId, 
    source,
  }: {
    accountId: string,
    source?: string
  }) {
    return this.stripe_.accountLinks.create({
      account: accountId,
      refresh_url: `${this.options_.app_url}/admin/store/stripe/connect-complete?accountId=${accountId}&source=${
        source || ""
      }`,
      return_url: `${this.options_.app_url}/admin/store/stripe/connect-complete?accountId=${accountId}&source=${
        source || ""
      }`,
      type: "account_onboarding",
    });
  }

  async retrieveAccount(accountId: string) {
    return this.stripe_.accounts.retrieve(accountId)
  }


  /**
   * Constructs Stripe Webhook event
   * @param {object} data - the data of the webhook request: req.body
   * @param {object} signature - the Stripe signature on the event, that
   *    ensures integrity of the webhook event
   * @return {object} Stripe Webhook event
   */
  constructWebhookEvent(data, signature) {
    return this.stripe_.webhooks.constructEvent(
      data,
      signature,
      this.options_.webhook_secret
    )
  }

  protected buildError(
    message: string,
    e: Stripe.StripeRawError | PaymentProcessorError | Error
  ): PaymentProcessorError {
    return {
      error: message,
      code: "code" in e ? e.code : "",
      detail: isPaymentProcessorError(e)
        ? `${e.error}${EOL}${e.detail ?? ""}`
        : "detail" in e
        ? e.detail
        : e.message ?? "",
    }
  }
}

export default StripeBase
