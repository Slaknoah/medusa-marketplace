import { UserService } from "@medusajs/medusa"
import StoreRepository from "@medusajs/medusa/dist/repositories/store"
import StripeBase from "src/core/stripe-base"


export async function connectStripe(req) {
  const loggedInUser = req.scope.resolve("loggedInUser")
  const userService: UserService = req.scope.resolve("userService")
  const storeRepository: typeof StoreRepository = req.scope.resolve("storeRepository")
  const stripeBase: StripeBase = req.scope.resolve("stripeProviderService")

  const user = await userService.retrieve(loggedInUser.id, {
    relations: ["store"],
  })
  const store = user.store

  // If setup and enabled
  if (store.c_stripe_account_enabled && store.c_stripe_account_id) {
    return {
      status: "success",
      account_id: store.c_stripe_account_id,
      account_enabled: store.c_stripe_account_enabled,
    }
  }

  try {
    // If setup but not complete
    if (store.c_stripe_account_id) {
      // Check first if charges enabled
      const account = await stripeBase.retrieveAccount(store.c_stripe_account_id)
      if (account.charges_enabled) {
        store.c_stripe_account_enabled = true
        await storeRepository.save(store)
        return {
          status: "success",
          account_id: store.c_stripe_account_id,
          account_enabled: store.c_stripe_account_enabled,
        }
      } else {
          // Create stripe onboarding response
          const accountOnBoardingResponse = await stripeBase.createAccountOnBoardingLink(
              {
                  accountId: account.id,
                  source: req.body.source,
              }
          );
      
          if (!accountOnBoardingResponse) {
            return {
              status: 'error',
              message: 'Stripe onboarding failed'
            }
          }
      
          return {
              status: "success",
              account_id: store.c_stripe_account_id,
              account_enabled: store.c_stripe_account_enabled,
              link: accountOnBoardingResponse.url,
          }
      }
    }
    
    // If not setup
    const { source, ...stripeOptions } = req.body
    const account = await stripeBase.createStoreAccount(user, {
      ...stripeOptions,
      business_type: req.body.business_type || "individual",
      settings: {
        ...(stripeOptions.settings || {}),
        branding: { secondary_color: "#BE0000" },
        payouts: {
          ...(stripeOptions?.settings?.payouts || {}),
          schedule: {
            interval: "manual",
          },
        },
      },
    })
  
    // Save account id to store
    store.c_stripe_account_id = account.id
    store.c_stripe_account_enabled = false
    await storeRepository.save(store)
  
    // Create stripe onboarding response
    const accountOnBoardingResponse = await stripeBase.createAccountOnBoardingLink(
      {
          accountId: account.id,
          source: source,
      }
    );
  
    if (!accountOnBoardingResponse) {
      return {
        status: 'error',
        message: 'Stripe onboarding failed'
      }
    }
  
    return {
      status: "success",
      account_id: account.id,
      account_enabled: store.c_stripe_account_enabled,
      link: accountOnBoardingResponse.url,
    }
  } catch (error) {
    console.log(error)
    return {
      status: "error",
      message: error.message,
    }
  }
}

export async function completeStripeConnect(req, res) {
    const { accountId, source } = req.query
    const stripeBase: StripeBase = req.scope.resolve("stripeProviderService")

    const account = await stripeBase.retrieveAccount(accountId)

    if (!account || !account.metadata.store_id) {
        if (source) {
            // Redirect to sourceUrl adding error query param
            return res.redirect(`${source}?error=stripe_account_not_found`)
        } else {
            return res.json({
                data: {
                    status: "error",
                    message: "Stripe account not found",
                },
            });
        }
    }

    if (!account.charges_enabled) {
        if (source) {
            // Redirect to sourceUrl adding error query param
            return res.redirect(`${source}?error=stripe_account_not_enabled`)
        } else {
            return res.json({
                data: {
                    status: "error",
                    message: "Stripe account not enabled",
                },
            });
        }
    }

    const storeRepository: typeof StoreRepository = req.scope.resolve("storeRepository")

    await storeRepository.update(account.metadata.store_id, {
        c_stripe_account_enabled: true,
        c_stripe_account_id: account.id,
    })
    if (source) {
        return res.redirect(`${source}?success=stripe_account_enabled`)
    }
    return res.json({
        data: {
            status: "success",
            account_id: account.id,
            account_enabled: true,
        },
    });
}

export async function refreshStripeConnect(req, res) {
    const { accountId, source = '' } = req.query
    const stripeBase: StripeBase = req.scope.resolve("stripeProviderService")

    const account = await stripeBase.retrieveAccount(accountId)

    if (!account || !account.metadata.store_id) {
      // Redirect to sourceUrl adding error query param
      return res.redirect(`${source}?error=stripe_account_not_found`)
    }

    if (!account.charges_enabled) {
      // Create stripe onboarding response
      const accountOnBoardingResponse = await stripeBase.createAccountOnBoardingLink(
          {
              accountId: account.id,
              source: source,
          }
      );

      if (!accountOnBoardingResponse) {
        return res.redirect(`${source}?success=stripe_refresh_failed`)
      }

      return res.redirect(accountOnBoardingResponse.url);
    }

    return res.redirect(`${source}?success=stripe_account_enabled`)
}