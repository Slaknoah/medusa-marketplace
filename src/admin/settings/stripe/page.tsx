import type { SettingConfig } from "@medusajs/admin"
import StripeLogo from "../../shared/icons/stripe-logo"
import type { SettingProps } from "@medusajs/admin"
import { Badge, Button, Container, Label, RadioGroup, Text } from "@medusajs/ui"
import { useAdminStore, useAdminCustomPost } from "medusa-react"
import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

type AdminStripeConnectReq = {
  business_type?: string,
  source?: string,
}

function useQueryParams() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  let params: any = {};

  for (let param of searchParams) {
      params[param[0]] = param[1];
  }

  return params;
}

type AdminStripeConnectRes = {
  data: {
    status: string,
    account_id: string,
    account_enabled: boolean
    link?: string
  }
}
const CustomSettingPage = ({notify}: SettingProps) => {
  const q = useQueryParams();

  const [notified, setNotified] = useState(false)
  useEffect(() => {
    if (notified) return
    if (q.error) {
      notify.error("Setup Failed", "Something went wrong. Please try again.")
    }

    if (q.success) {
      notify.success("Setup Complete", "You can now accept payments.")
    }
    setNotified(true)
  }, [q])

  const { mutate, isLoading } = useAdminCustomPost<
    AdminStripeConnectReq,
    AdminStripeConnectRes
  >(
    `/admin/store/stripe/connect`,
    ["store-stripe-connect"],
    // {
    //   product: true,
    // }
  )

  const { store } = useAdminStore()
  const [businessType, setBusinessType] = useState("individual")


  const handleClick = () => {
    return mutate({
      source: window.location.origin + "/a/settings/stripe",
      business_type: businessType,
    }, {
      onSuccess: (data) => {
        if (data.data.link) {
          notify.success("Setup Successful", "You will be redirected to stripe to complete the setup.")
          window.location.href = data.data.link
        } else if(data.data.status === "success") {
          notify.success("Setup Successful", "You can now accept payments.")
        } else {
          notify.error("Setup Failed", "Something went wrong. Please try again.")
        }
      },
    })

  }
  const storeEnabled = store.c_stripe_account_id && store.c_stripe_account_enabled
  return (
    <Container>
        <Text weight="plus" size="xlarge" as="div">Setup stripe payment</Text>

        <Text className="mb-4">
            This is a custom setting page. You can use it to setup your stripe
            account.
        </Text>

        <div className="flex gap-4 mb-8">
            <div>Status:</div>
            <Badge color={storeEnabled ? 'green' : 'orange'} className="mr-2">
                {
                  storeEnabled ? (
                    "Connected"
                  ) : (
                    "Not connected"
                  )
                }
            </Badge>
        </div>

        {
          !storeEnabled && (
            <div>
              <Label weight="plus" className="mb-2">
                Business Type:
              </Label>
              <RadioGroup value={businessType} onValueChange={e => setBusinessType(e)} className="mb-4">
                <div className="flex items-center gap-x-3">
                  <RadioGroup.Item value="individual" id="individual" />
                  <Label htmlFor="individual" weight="plus">
                    Individual
                  </Label>
                </div>
                <div className="flex items-center gap-x-3">
                  <RadioGroup.Item value="company" id="company" />
                  <Label htmlFor="company" weight="plus">
                    Company
                  </Label>
                </div>
              </RadioGroup>

              <Button onClick={handleClick} isLoading={isLoading} disabled={isLoading}>
                  Setup Stripe
              </Button>
            </div>
          )
        }
    </Container>
  )
}

export const config: SettingConfig = {
  card: {
    label: "Stripe",
    description: "Manage your stripe settings",
    // optional
    icon: StripeLogo,
  },
}

export default CustomSettingPage